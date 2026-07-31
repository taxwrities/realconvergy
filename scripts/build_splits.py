#!/usr/bin/env python3
"""
WNBA career splits builder — realconvergy
Reads wehoop player_box parquet files (2002-present), emits per-player JSON:
  - full career game log (compact rows)
  - precomputed splits: day-of-week, month, home/away, opponent, season type
Output: data/wnba-splits/{athlete_id}.json + index.json (name -> id lookup)

Daily refresh: just re-download the current season parquet and re-run.
  curl -sL -o raw/player_box_2026.parquet \
    https://raw.githubusercontent.com/sportsdataverse/wehoop-wnba-data/main/wnba/player_box/parquet/player_box_2026.parquet
"""
import pandas as pd, json, os, glob, sys
from datetime import datetime

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

# game log row legend (order matters)
LOG_LEGEND = ["date","opp","ha","st"] + STAT_KEYS + ["min","start"]

WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

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
    return df

def compact_row(r):
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
        for _, r in g.iterrows():
            row = compact_row(r)
            log.append(row)
            dt = datetime.strptime(r["game_date"], "%Y-%m-%d")
            sv = dict(zip(STAT_KEYS, row[4:4+len(STAT_KEYS)]))
            add_bucket(splits, "weekday", WEEKDAYS[dt.weekday()], sv)
            add_bucket(splits, "month", dt.strftime("%b"), sv)
            add_bucket(splits, "homeaway", row[2], sv)
            add_bucket(splits, "opponent", row[1], sv)
            add_bucket(splits, "seasontype", "REG" if row[3] == 2 else "PST", sv)
        out = {
            "athlete_id": int(aid), "name": name, "team": team, "pos": pos,
            "games": len(log),
            "first_game": log[0][0], "last_game": log[-1][0],
            "log_legend": LOG_LEGEND,
            "log": log,          # oldest -> newest
            "splits": splits,
            "generated": datetime.now().strftime("%Y-%m-%d"),
        }
        fn = os.path.join(OUT_DIR, f"{int(aid)}.json")
        with open(fn, "w") as f:
            json.dump(out, f, separators=(",", ":"))
        index[name] = {"id": int(aid), "team": team, "pos": pos, "games": len(log)}
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"), sort_keys=True)
    print(f"wrote {len(index)} player files -> {OUT_DIR}/")

if __name__ == "__main__":
    build()
