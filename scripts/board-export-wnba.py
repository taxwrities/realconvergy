#!/usr/bin/env python3
"""
BOARD-EXPORT-WNBA — full-counters JSON export for a WNBA slate.
Spec: specs/board-export-wnba.md (LOCKED v1).

Emits data/boards/wnba/{YYYY-MM-DD}.json — raw entering counters for every
player on the slate, six scopes each, ten fixed stat keys. No scoring, no
filtering, no derived values: the grader computes those from `counters`.

Usage:  python scripts/board-export-wnba.py                      # today
        python scripts/board-export-wnba.py --date 2026-08-05
        python scripts/board-export-wnba.py --date 2026-08-05 --commit
        python scripts/board-export-wnba.py --quiet --commit

Data source: wehoop-wnba-data (sportsdataverse). Schedule from the master CSV,
box scores from the per-season player_box parquet (2003->present). Home/away
splits are not published directly, so they are computed here from the game-log
rows filtered on `home_away`, per spec.

Requires: pyarrow (parquet reader). Season files are cached under
scripts/cache/wehoop/ (gitignored) and the current season is always refetched
so the board never runs on a stale copy.

Windows: set PYTHONUTF8=1
"""
import argparse, csv, io, json, os, subprocess, sys, urllib.request
from datetime import date, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(REPO, "scripts", "cache", "wehoop")
BASE = "https://raw.githubusercontent.com/sportsdataverse/wehoop-wnba-data/main/wnba"
SCHEDULE_URL = f"{BASE}/schedules/wnba_schedule_master.csv"
BOX_URL = BASE + "/player_box/parquet/player_box_{season}.parquet"
FIRST_SEASON = 2003

# Spec rule 8 — FIXED key set. Adding a key requires a spec bump.
STAT_KEYS = ["G", "FG", "3PM", "2PM", "PTS", "REB", "AST", "STL", "BLK", "FTM"]
SCOPES = ["season", "season_home", "season_away", "career", "career_home", "career_away"]


def fetch(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read()


def season_box(season, refresh=False):
    """Per-season player_box rows. Cached; current season always refetched."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"player_box_{season}.parquet")
    if refresh or not os.path.exists(path):
        try:
            blob = fetch(BOX_URL.format(season=season))
        except Exception:
            return []
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(blob)
        os.replace(tmp, path)
    import pyarrow.parquet as pq
    # game_date_time carries a tz pyarrow can't localize without zoneinfo, and
    # nothing here needs it — read only the columns the counters are built from.
    cols = ["game_id", "season", "season_type", "game_date", "athlete_id",
            "athlete_display_name", "team_id", "team_display_name", "team_abbreviation",
            "athlete_position_abbreviation", "home_away", "did_not_play",
            "field_goals_made", "three_point_field_goals_made", "free_throws_made",
            "points", "rebounds", "assists", "steals", "blocks"]
    t = pq.read_table(path, columns=cols)
    return t.to_pylist()


def slate_games(ds):
    """Games scheduled on `ds`, from the wehoop schedule master."""
    raw = fetch(SCHEDULE_URL).decode("utf-8", "replace")
    out = []
    for r in csv.DictReader(io.StringIO(raw)):
        gd = (r.get("date") or r.get("game_date") or "")[:10]
        if gd != ds:
            continue
        out.append({
            "game_id": r.get("id"),
            "date": gd,
            "status": r.get("status_type_name") or "",
            "home": {"id": r.get("home_id"), "name": r.get("home_display_name") or r.get("home_name"),
                     "abbrev": r.get("home_abbreviation")},
            "away": {"id": r.get("away_id"), "name": r.get("away_display_name") or r.get("away_name"),
                     "abbrev": r.get("away_abbreviation")},
        })
    return out


def blank():
    return {k: 0 for k in STAT_KEYS}


def add(acc, row):
    fgm = row.get("field_goals_made") or 0
    tpm = row.get("three_point_field_goals_made") or 0
    acc["G"] += 1
    acc["FG"] += fgm
    acc["3PM"] += tpm
    acc["2PM"] += fgm - tpm          # wehoop has no 2PM column; FGM - 3PM per spec
    acc["PTS"] += row.get("points") or 0
    acc["REB"] += row.get("rebounds") or 0
    acc["AST"] += row.get("assists") or 0
    acc["STL"] += row.get("steals") or 0
    acc["BLK"] += row.get("blocks") or 0
    acc["FTM"] += row.get("free_throws_made") or 0


def build(ds, quiet=False):
    board_year = int(ds[:4])
    games = slate_games(ds)
    if not games:
        if not quiet:
            print(f"no WNBA games scheduled on {ds}")
        return None, games

    team_ids = set()
    for g in games:
        team_ids.add(str(g["home"]["id"]))
        team_ids.add(str(g["away"]["id"]))

    if not quiet:
        print(f"BOARD EXPORT {ds} — {len(games)} games, {len(team_ids)} clubs")
        print("loading wehoop player_box 2003-%d …" % board_year)

    # Rule 2: entering totals run through the player's LAST COMPLETED game.
    # Every row is filtered to game_date STRICTLY BEFORE the board date, so
    # same-day stats can never leak in even if the slate is already underway.
    per = {}          # athlete_id -> {meta, scopes}
    latest = {}       # athlete_id -> (date, team_id, team_name, abbrev, pos) for roster assignment
    data_through = ""
    for season in range(FIRST_SEASON, board_year + 1):
        for row in season_box(season, refresh=(season == board_year)):
            gd = row.get("game_date")
            gd = gd.isoformat() if hasattr(gd, "isoformat") else str(gd)[:10]
            if not gd or gd >= ds:            # strictly before the board date
                continue
            if row.get("did_not_play"):
                continue
            if gd > data_through:
                data_through = gd
            aid = str(row.get("athlete_id"))
            if not aid or aid == "None":
                continue
            tid = str(row.get("team_id"))
            if aid not in latest or gd > latest[aid][0]:
                latest[aid] = (gd, tid, row.get("team_display_name"),
                               row.get("team_abbreviation"),
                               row.get("athlete_position_abbreviation"),
                               row.get("season"))
            e = per.setdefault(aid, {"name": row.get("athlete_display_name"),
                                     "scopes": {s: blank() for s in SCOPES}})
            e["name"] = e["name"] or row.get("athlete_display_name")
            ha = (row.get("home_away") or "").lower()
            sc = e["scopes"]
            add(sc["career"], row)
            if ha == "home":
                add(sc["career_home"], row)
            elif ha == "away":
                add(sc["career_away"], row)
            if row.get("season") == board_year:
                add(sc["season"], row)
                if ha == "home":
                    add(sc["season_home"], row)
                elif ha == "away":
                    add(sc["season_away"], row)

    # Roster = players whose most recent completed game was THIS SEASON with a
    # club on the slate. wehoop publishes no pregame roster, so this is the
    # honest proxy: it follows in-season trades, but cannot see a player who has
    # not yet appeared. The board_year gate is what keeps retired players off
    # the sheet — without it, anyone whose final career game happened to be with
    # one of these clubs (going back to 2003) would be listed.
    by_team = {}
    for aid, (gd, tid, tname, abbrev, pos, season) in latest.items():
        if tid in team_ids and season == board_year:
            by_team.setdefault(tid, []).append((aid, tname, abbrev, pos))

    out_games, n_players, n_scopes, omitted = [], 0, 0, 0
    for g in games:
        gp = {"game_id": g["game_id"], "status": g["status"],
              "home": g["home"], "away": g["away"], "players": []}
        for side in ("home", "away"):
            tid = str(g[side]["id"])
            for aid, tname, abbrev, pos in sorted(by_team.get(tid, []),
                                                  key=lambda x: per[x[0]]["name"] or ""):
                counters = {}
                for s in SCOPES:
                    c = per[aid]["scopes"][s]
                    if c["G"] > 0:
                        counters[s] = c          # rule 7: omit empty splits,
                    else:                        # never zero-fill
                        omitted += 1
                n_scopes += len(counters)
                n_players += 1
                gp["players"].append({
                    "athlete_id": aid,
                    "name": per[aid]["name"],
                    "team": tname, "team_abbrev": abbrev, "side": side,
                    "position": pos,
                    # Rule 4: advisory only, kept for .md parity. The spec text
                    # that reached this script does not define how it is
                    # computed, so it ships null rather than invented — rule 3
                    # forbids derived values and grading reads `counters`.
                    "best_rung": None,
                    "counters": counters,
                })
        out_games.append(gp)

    board = {
        "schema": "cvg-board-wnba/v1",
        "date": ds,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "frozen": True,                                        # rule 6
        "source": {                                            # rule 5
            "dataset": "wehoop-wnba-data (sportsdataverse)",
            "urls": [SCHEDULE_URL, BOX_URL.format(season=board_year)],
            "seasons": f"{FIRST_SEASON}-{board_year}",
            "data_through": data_through,
            "retrieved_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        },
        "stat_keys": STAT_KEYS,
        "scopes": SCOPES,
        "notes": [
            "Raw entering counters only — no scoring, no filtering, no derived values (rules 1/3).",
            "Every row is filtered to game_date < board date, so same-day stats never appear (rule 2).",
            "Splits with zero games are omitted, not zero-filled (rule 7).",
            "best_rung is advisory and ships null; grading reads counters (rule 4).",
            "Counters include all season types (regular + playoffs).",
        ],
        "games": out_games,
    }
    if not quiet:
        print(f"players {n_players} · scope objects {n_scopes} · empty splits omitted {omitted}")
        print(f"counters run through {data_through} (board date {ds})")
    return board, games


def validate(board):
    """Spec conformance — abort the write on any failure."""
    errs = []
    if board.get("frozen") is not True:
        errs.append("frozen must be true")
    if not board.get("source", {}).get("dataset"):
        errs.append("source.dataset must be non-empty")
    if not board.get("source", {}).get("data_through"):
        errs.append("source.data_through must be non-empty")
    seen_scopes = set()
    for g in board.get("games", []):
        for p in g.get("players", []):
            if not p.get("counters"):
                errs.append(f"{p.get('name')}: no counters at all")
            for s, c in p["counters"].items():
                seen_scopes.add(s)
                if s not in SCOPES:
                    errs.append(f"{p.get('name')}: unknown scope {s}")
                if set(c) != set(STAT_KEYS):
                    errs.append(f"{p.get('name')}/{s}: stat keys differ from the fixed set")
                if c.get("G", 0) <= 0:
                    errs.append(f"{p.get('name')}/{s}: zero-filled split should have been omitted")
    unknown = seen_scopes - set(SCOPES)
    if unknown:
        errs.append(f"scopes outside the fixed six: {unknown}")
    return errs


def git_publish(path, ds, quiet=False):
    repo = REPO
    rel = os.path.relpath(path, repo).replace(os.sep, "/")
    sink = subprocess.DEVNULL if quiet else None
    for cmd in (["git", "add", rel], ["git", "commit", "-m", f"board wnba {ds}"], ["git", "push"]):
        rc = subprocess.run(cmd, cwd=repo, stdout=sink, stderr=sink).returncode
        if rc != 0:
            if not quiet:
                print(f"git step failed ({rc}): {' '.join(cmd)}")
            return rc
    if not quiet:
        print(f"committed + pushed board wnba {ds}")
    return 0


def main(ds, quiet=False, do_commit=False):
    board, games = build(ds, quiet)
    if board is None:
        return 0 if not games else 1

    errs = validate(board)
    if errs:
        print("VALIDATION FAILED — nothing written:", file=sys.stderr)
        for e in errs[:20]:
            print("  " + e, file=sys.stderr)
        return 2
    if not quiet:
        print("validation: all six scopes fixed, stat keys fixed, frozen+source present")

    out_dir = os.path.join(REPO, "data", "boards", "wnba")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{ds}.json")
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(board, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, out_path)
    if not quiet:
        print(f"wrote data/boards/wnba/{ds}.json")

    return git_publish(out_path, ds, quiet) if do_commit else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="WNBA full-counters board export")
    ap.add_argument("--date", default=date.today().isoformat(), help="slate date YYYY-MM-DD (default today)")
    ap.add_argument("--commit", action="store_true", help="git add/commit/push the board file after writing")
    ap.add_argument("--quiet", action="store_true", help="suppress console output")
    a = ap.parse_args()
    sys.exit(main(a.date, quiet=a.quiet, do_commit=a.commit))
