#!/usr/bin/env python3
"""
WNBA career splits builder — realconvergy
Reads wehoop player_box parquet files (2002-present), emits per-player JSON:
  - full career game log (compact rows)
  - precomputed splits: day-of-week, month, home/away, opponent, season type
Output: data/wnba-splits/{athlete_id}.json + index.json (name -> id lookup)

bbref parity (Tony 2026-08-08): basketball-reference is the reference for what
counts. Three row classes in the wehoop logs must be EXCLUDED to match it:
  1. All-Star games — tagged season_type 2 (regular!) but played by synthetic
     teams (Team Wilson / TEAM COLLIER / EAST / WEST / Team USA...). Filtered
     by display-name pattern, not id blocklist, so future captain teams drop
     out automatically.
  2. Commissioner's Cup FINALS — regular Cup games count, the standalone final
     does not; flagged postseason=false upstream, only the date knows. Same
     date list apps/wnba/src/data/gamefilter.js locks for the live-slate side.
  3. (Playoffs stay IN the log, tagged st=3 — the REG/PST split reads them.)
Verified vs Jackie Young bbref career splits: REG G/PTS/TRB/AST match exactly
once 1+2 are dropped.

Freshness: the wehoop main-branch mirror can lag ~a week. After loading the
parquets, any dates between the parquet max and yesterday are topped up
directly from ESPN's scoreboard/summary API (wehoop's own upstream), so a
rebuild is always current even when the mirror is behind.

First basket / first point (Tony 2026-08-08): derived from the play-by-play
mirror, not the box scores — a box row has no within-game ordering. Needs
raw/pbp_YYYY.parquet alongside the box files. Verified 100% game coverage for
every season 2002-2026, and every 2026 first-basket scorer joins cleanly to
that game's player_box row.

Daily refresh: re-download the current season parquets and re-run.
  B=https://raw.githubusercontent.com/sportsdataverse/wehoop-wnba-data/main/wnba
  curl -sL -o raw/player_box_2026.parquet $B/player_box/parquet/player_box_2026.parquet
  curl -sL -o raw/pbp_2026.parquet        $B/pbp/parquet/play_by_play_2026.parquet

First backfill (all seasons, ~70MB, gitignored):
  for y in $(seq 2002 2026); do
    curl -sL -o raw/pbp_$y.parquet $B/pbp/parquet/play_by_play_$y.parquet
  done
"""
import pandas as pd, json, os, glob, re, sys, urllib.request
from datetime import datetime, timedelta, timezone

RAW_DIR = "raw"
OUT_DIR = "data/wnba-splits"
ACTIVE_SEASONS = {2025, 2026}   # only emit players who appeared in these seasons
                                 # (their logs still cover their FULL career)

STATS = ["points","rebounds","assists","steals","blocks",
         "field_goals_made","field_goals_attempted",
         "three_point_field_goals_made","three_point_field_goals_attempted",
         "free_throws_made","free_throws_attempted",
         "turnovers","offensive_rebounds","defensive_rebounds","fouls"]
STAT_KEYS = ["pts","reb","ast","stl","blk","fgm","fga","3pm","3pa","ftm","fta","to","oreb","dreb","pf"]

# game log row legend (order matters; fb/fp appended so existing indices hold)
#   fb = this player scored the game's FIRST FIELD GOAL (free throws skipped)
#   fp = this player scored the game's FIRST POINTS (free throws count)
# Both are 1/0 per player-game, so they thread through the existing threshold
# query ("1+ fb" = games they got the first basket) and the splits buckets
# (fb by weekday / opponent / home-away) with no special-casing.
LOG_LEGEND = ["date","opp","ha","st"] + STAT_KEYS + ["min","start","fb","fp"]

WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

# ---- bbref-parity exclusions ------------------------------------------------
# All-Star sides are synthetic teams whose display name starts with "Team"
# (Team Wilson, TEAM CLARK, Team WNBA, Team USA) or is the bare conference
# (EAST / WEST). No franchise matches the pattern (Toronto Tempo != "Team ...").
EXHIB_RE = re.compile(r"^team\b", re.I)
EXHIB_EXACT = {"EAST", "WEST"}

def _is_exhib_name(v):
    v = "" if v is None else str(v)
    return bool(EXHIB_RE.match(v)) or v in EXHIB_EXACT

# Commissioner's Cup final dates (ET) — single standalone game per season, so a
# date match is unambiguous. Mirror of CUP_FINAL_DATES in
# apps/wnba/src/data/gamefilter.js; extend both each season.
CUP_FINAL_DATES = {
    "2021-08-12",  # SEA 79-57 CON
    "2022-07-26",  # LV 93-83 CHI
    "2023-08-15",  # NY 82-63 LV
    "2024-06-25",  # MIN 94-89 NY
    "2025-07-01",  # IND 74-59 MIN
    "2026-06-30",  # NY 93-85 LV
}

# ---- ESPN top-up for dates newer than the parquet mirror --------------------
ESPN_SB = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates={d}"
ESPN_SUM = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event={e}"

def _get_json(url):
    # NB: ESPN's edge 403s requests carrying a non-browser User-Agent; urllib's
    # default (no custom UA) goes through fine, so send no UA header at all.
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def _num(s):
    try: return float(s)
    except (TypeError, ValueError): return None

def _espn_rows_for_event(event_id, game_date, season, season_type):
    """One completed ESPN event -> list of player_box-shaped dicts."""
    s = _get_json(ESPN_SUM.format(e=event_id))
    comps = (s.get("header", {}).get("competitions") or [{}])[0]
    homeaway = {}   # team id -> 'home'/'away'
    tinfo = {}      # team id -> {abbr, display}
    for c in comps.get("competitors", []):
        tid = str(c.get("team", {}).get("id"))
        homeaway[tid] = c.get("homeAway")
        tinfo[tid] = {"abbr": c.get("team", {}).get("abbreviation") or "",
                      "display": c.get("team", {}).get("displayName") or ""}
    tids = list(tinfo.keys())
    rows = []
    for tblock in s.get("boxscore", {}).get("players", []):
        tid = str(tblock.get("team", {}).get("id"))
        opp = next((x for x in tids if x != tid), None)
        stat = (tblock.get("statistics") or [{}])[0]
        keys = stat.get("keys") or []
        for a in stat.get("athletes", []):
            if a.get("didNotPlay"):
                continue
            vals = dict(zip(keys, a.get("stats") or []))
            fg = (vals.get("fieldGoalsMade-fieldGoalsAttempted") or "-").split("-")
            tp = (vals.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted") or "-").split("-")
            ft = (vals.get("freeThrowsMade-freeThrowsAttempted") or "-").split("-")
            ath = a.get("athlete", {})
            if _num(vals.get("points")) is None:
                continue
            rows.append({
                "game_id": int(event_id), "season": season, "season_type": season_type,
                "game_date": game_date,
                "athlete_id": int(ath.get("id")),
                "athlete_display_name": ath.get("displayName") or "",
                "athlete_position_abbreviation": (ath.get("position") or {}).get("abbreviation") or "",
                "team_abbreviation": tinfo.get(tid, {}).get("abbr", ""),
                "team_display_name": tinfo.get(tid, {}).get("display", ""),
                "opponent_team_abbreviation": tinfo.get(opp, {}).get("abbr", ""),
                "opponent_team_display_name": tinfo.get(opp, {}).get("display", ""),
                "home_away": homeaway.get(tid) or "",
                "starter": bool(a.get("starter")),
                "did_not_play": False,
                "minutes": _num(vals.get("minutes")),
                "points": _num(vals.get("points")),
                "rebounds": _num(vals.get("totalRebounds") if "totalRebounds" in vals else vals.get("rebounds")),
                "assists": _num(vals.get("assists")),
                "steals": _num(vals.get("steals")),
                "blocks": _num(vals.get("blocks")),
                "turnovers": _num(vals.get("turnovers")),
                "fouls": _num(vals.get("fouls")),
                "offensive_rebounds": _num(vals.get("offensiveRebounds")),
                "defensive_rebounds": _num(vals.get("defensiveRebounds")),
                "field_goals_made": _num(fg[0]), "field_goals_attempted": _num(fg[-1]),
                "three_point_field_goals_made": _num(tp[0]), "three_point_field_goals_attempted": _num(tp[-1]),
                "free_throws_made": _num(ft[0]), "free_throws_attempted": _num(ft[-1]),
            })
    return rows

def espn_topup(after_date):
    """Fetch completed games for dates (after_date, yesterday] from ESPN."""
    start = datetime.strptime(after_date, "%Y-%m-%d") + timedelta(days=1)
    end = datetime.now(timezone.utc) - timedelta(hours=8)   # rough ET "today"
    end = datetime(end.year, end.month, end.day) - timedelta(days=0)
    rows, ids, d = [], [], start
    while d <= end:
        ds = d.strftime("%Y%m%d")
        try:
            sb = _get_json(ESPN_SB.format(d=ds))
        except Exception as e:
            print(f"  espn scoreboard {ds}: {e}", file=sys.stderr)
            d += timedelta(days=1); continue
        for ev in sb.get("events", []):
            st = (((ev.get("status") or {}).get("type")) or {})
            if not st.get("completed"):
                continue
            season_type = (ev.get("season") or {}).get("type") or 2
            season = (ev.get("season") or {}).get("year") or d.year
            try:
                rows.extend(_espn_rows_for_event(ev["id"], d.strftime("%Y-%m-%d"), season, season_type))
                ids.append(ev["id"])
            except Exception as e:
                print(f"  espn event {ev.get('id')}: {e}", file=sys.stderr)
        d += timedelta(days=1)
    return pd.DataFrame(rows), ids

# ---- first basket / first point (Tony 2026-08-08) ---------------------------
# Derived from wehoop's play-by-play mirror (wnba/pbp/parquet), which carries
# scoring_play + score_value + athlete_id_1 + sequence_number. Verified 100%
# game coverage 2002-2026, and every 2026 first-basket scorer joins cleanly to
# that game's player_box row. FIRST BASKET skips free throws (the sportsbook
# convention); FIRST POINT does not, because a FT can open the scoring — it did
# in 14 of 219 games in 2026, so the two answers genuinely differ.
FT_RE = re.compile(r"free\s*throw", re.I)

def _first_scorers(plays):
    """[(game_id, seq, type_text, athlete_id)] -> {game_id: {'fb':aid,'fp':aid}}"""
    plays.sort(key=lambda r: (r[0], r[1]))
    out = {}
    for gid, _seq, tt, aid in plays:
        e = out.setdefault(gid, {})
        if "fp" not in e:
            e["fp"] = aid
        if "fb" not in e and not FT_RE.search(tt or ""):
            e["fb"] = aid
    return out

def load_pbp():
    import pyarrow.parquet as pq
    plays = []
    for f in sorted(glob.glob(os.path.join(RAW_DIR, "pbp_*.parquet"))):
        if os.path.getsize(f) < 1000:
            continue
        d = pq.read_table(f, columns=["game_id", "sequence_number", "type_text",
                                      "scoring_play", "score_value", "athlete_id_1"]).to_pydict()
        for i in range(len(d["game_id"])):
            if not d["scoring_play"][i] or (d["score_value"][i] or 0) <= 0:
                continue
            aid = d["athlete_id_1"][i]
            if aid is None:
                continue
            plays.append((str(d["game_id"][i]), int(d["sequence_number"][i] or 0),
                          d["type_text"][i] or "", str(aid)))
    m = _first_scorers(plays)
    print(f"pbp: first scorers for {len(m)} games")
    return m

def espn_first_scorers(event_ids):
    """Same map for games newer than the pbp mirror, off the summary endpoint."""
    out = {}
    for eid in event_ids:
        try:
            s = _get_json(ESPN_SUM.format(e=eid))
        except Exception as e:
            print(f"  espn plays {eid}: {e}", file=sys.stderr); continue
        plays = []
        for p in (s.get("plays") or []):
            if not p.get("scoringPlay") or (p.get("scoreValue") or 0) <= 0:
                continue
            parts = p.get("participants") or []
            aid = ((parts[0].get("athlete") or {}).get("id") if parts else None) \
                  or ((p.get("athlete") or {}).get("id"))
            if not aid:
                continue
            plays.append((str(eid), int(p.get("sequenceNumber") or 0),
                          (p.get("type") or {}).get("text") or "", str(aid)))
        out.update(_first_scorers(plays))
    return out

def load_all():
    frames = []
    for f in sorted(glob.glob(os.path.join(RAW_DIR, "player_box_*.parquet"))):
        if os.path.getsize(f) < 1000:  # empty/stub seasons
            continue
        df = pd.read_parquet(f)
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    # drop DNP rows and rows with no stat line
    if "did_not_play" in df.columns:
        df = df[df["did_not_play"] != True]
    df = df[df["points"].notna()]
    df["game_date"] = pd.to_datetime(df["game_date"]).dt.strftime("%Y-%m-%d")
    # ESPN top-up: the mirror can lag; fill (max parquet date, yesterday]
    mx = df["game_date"].max()
    top, top_ids = espn_topup(mx)
    load_all.topup_event_ids = top_ids
    if len(top):
        print(f"espn top-up: {len(top)} rows after {mx} ({top['game_date'].min()} -> {top['game_date'].max()})")
        df = pd.concat([df, top], ignore_index=True)
        df = df.drop_duplicates(subset=["game_id", "athlete_id"], keep="first")
    # bbref parity: drop All-Star / exhibition rows (synthetic teams) and
    # Commissioner's Cup finals. Playoffs stay (st=3, REG/PST split).
    exhib = (df["team_display_name"].map(_is_exhib_name)
             | df["opponent_team_display_name"].map(_is_exhib_name))
    cup = df["game_date"].isin(CUP_FINAL_DATES)
    print(f"excluding {int(exhib.sum())} all-star/exhibition rows, {int(cup.sum())} cup-final rows")
    df = df[~exhib & ~cup]
    return df

def compact_row(r, firsts=None):
    dt = datetime.strptime(r["game_date"], "%Y-%m-%d")
    row = [r["game_date"],
           r.get("opponent_team_abbreviation") or "",
           "H" if r.get("home_away") == "home" else "A",
           int(r.get("season_type") or 2)]  # 2=regular, 3=playoffs
    for s in STATS:
        v = r.get(s)
        row.append(int(v) if pd.notna(v) else None)
    m = r.get("minutes")
    try: row.append(int(float(m)) if pd.notna(m) else None)
    except: row.append(None)
    row.append(1 if r.get("starter") else 0)
    # first basket / first point flags for THIS player in THIS game
    e = (firsts or {}).get(str(r.get("game_id"))) or {}
    aid = str(r.get("athlete_id"))
    row.append(1 if e.get("fb") == aid else 0)
    row.append(1 if e.get("fp") == aid else 0)
    return row

def add_bucket(splits, dim, key, stats_vals):
    b = splits.setdefault(dim, {}).setdefault(key, {"g": 0})
    b["g"] += 1
    for k, v in stats_vals.items():
        if v is not None:
            b[k] = b.get(k, 0) + v

def build():
    df = load_all()
    print(f"loaded {len(df)} player-game rows, {df['game_date'].min()} -> {df['game_date'].max()}")
    firsts = load_pbp()
    extra = espn_first_scorers(getattr(load_all, "topup_event_ids", []) or [])
    if extra:
        print(f"pbp: +{len(extra)} games from the ESPN top-up window")
        firsts.update(extra)
    active_ids = set(df[df["season"].isin(ACTIVE_SEASONS)]["athlete_id"].unique())
    print(f"{len(active_ids)} players active in {sorted(ACTIVE_SEASONS)}")
    os.makedirs(OUT_DIR, exist_ok=True)
    index = {}
    for aid, g in df[df["athlete_id"].isin(active_ids)].groupby("athlete_id"):
        g = g.sort_values("game_date")
        name = g.iloc[-1]["athlete_display_name"]
        team = g.iloc[-1]["team_abbreviation"]
        pos = g.iloc[-1].get("athlete_position_abbreviation") or ""
        log, splits = [], {}
        fb_n = fp_n = 0
        for _, r in g.iterrows():
            row = compact_row(r, firsts)
            log.append(row)
            fb_n += row[-2]; fp_n += row[-1]
            dt = datetime.strptime(r["game_date"], "%Y-%m-%d")
            sv = dict(zip(STAT_KEYS, row[4:4+len(STAT_KEYS)]))
            # fb/fp ride the buckets too, so "first baskets by weekday /
            # opponent / home-away" comes free from the existing split machinery
            sv["fb"] = row[-2]; sv["fp"] = row[-1]
            # bbref parity (Tony 2026-08-08): the dimensional splits are
            # REGULAR SEASON ONLY — bbref's splits tables exclude playoffs
            # (Caitlin Clark road PTS: 636 reg, not 672 with the 2024 playoff
            # games mixed in). Playoff games still ship in the log (st=3) and
            # in the REG/PST split below.
            if row[3] == 2:
                add_bucket(splits, "weekday", WEEKDAYS[dt.weekday()], sv)
                add_bucket(splits, "month", dt.strftime("%b"), sv)
                add_bucket(splits, "homeaway", row[2], sv)
                add_bucket(splits, "opponent", row[1], sv)
            add_bucket(splits, "seasontype", "REG" if row[3] == 2 else "PST", sv)
        out = {
            "athlete_id": int(aid), "name": name, "team": team, "pos": pos,
            "games": len(log),
            "fb": fb_n, "fp": fp_n,   # career first-basket / first-point counts
            "first_game": log[0][0], "last_game": log[-1][0],
            "log_legend": LOG_LEGEND,
            "log": log,          # oldest -> newest
            "splits": splits,
            "generated": datetime.now().strftime("%Y-%m-%d"),
        }
        fn = os.path.join(OUT_DIR, f"{int(aid)}.json")
        with open(fn, "w") as f:
            json.dump(out, f, separators=(",", ":"))
        index[name] = {"id": int(aid), "team": team, "pos": pos, "games": len(log),
                       "fb": fb_n, "fp": fp_n}
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"), sort_keys=True)
    print(f"wrote {len(index)} player files -> {OUT_DIR}/")

if __name__ == "__main__":
    build()
