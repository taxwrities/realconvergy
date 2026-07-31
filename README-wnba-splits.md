# WNBA Career Splits & Game Log Store — realconvergy

Full career game logs (2003–present, ESPN via wehoop) + precomputed splits for every
player active in 2025/2026. 262 players, ~3.8MB total. Current through last completed slate.

## Files
- `scripts/build_splits.py` — regenerates everything. Downloads season parquet files, emits JSONs.
- `scripts/query_splits.py` — CLI: splits tables, "last N+ stat game / days ago", career counts.
- `data/wnba-splits/index.json` — name → athlete_id lookup
- `data/wnba-splits/{id}.json` — per player: full game log + splits

## Per-player JSON shape
- `log_legend`: column order for log rows
- `log`: oldest→newest, one row per game:
  `[date, opp, H/A, season_type, pts, reb, ast, stl, blk, fgm, fga, 3pm, 3pa, ftm, fta, to, oreb, dreb, pf, min, starter]`
- `splits`: sums + game counts by `weekday`, `month`, `homeaway`, `opponent`, `seasontype`

Any query is a scan of `log` — days since last 10+ AST, first career 20-pt game vs a team,
whatever. Splits are just cached rollups of the same rows.

## Daily refresh (one command)
```
curl -sL -o raw/player_box_2026.parquet https://raw.githubusercontent.com/sportsdataverse/wehoop-wnba-data/main/wnba/player_box/parquet/player_box_2026.parquet
python scripts/build_splits.py
git add data/wnba-splits && git commit -m "splits $(date +%F)" && git push
```
Run from the repo root — `build_splits.py` resolves `raw/` and `data/wnba-splits/`
relative to the working directory. The upstream file updates daily after games.
Historical seasons never change — keep the raw/ folder.

## Query examples
```
python scripts/query_splits.py "Alyssa Thomas" last ast 10     # date + days ago
python scripts/query_splits.py "A'ja Wilson" splits weekday
python scripts/query_splits.py "Angel Reese" splits opponent
python scripts/query_splits.py "Caitlin Clark" games ast 10    # every qualifying game listed
python scripts/query_splits.py "Napheesa Collier" count pts 30
```

## Front-end use (Netlify tools)
Fetch `https://raw.githubusercontent.com/taxwrities/realconvergy/main/data/wnba-splits/index.json`
then the player file by id. Same pattern as birthdays.json.

## Notes
- 2002 season file upstream is empty; logs start 2003. did_not_play rows excluded.
- season_type: 2 = regular, 3 = playoffs. Splits include both; `seasontype` split separates them.
- Add new split dims (e.g. by-starter, day-of-season) by adding one add_bucket() line.
