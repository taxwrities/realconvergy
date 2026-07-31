#!/usr/bin/env python3
"""
WNBA splits query tool — realconvergy
Works against data/wnba-splits/ (local) or GitHub raw URLs once pushed.

Usage:
  python query_splits.py "A'ja Wilson" splits weekday
  python query_splits.py "A'ja Wilson" splits opponent
  python query_splits.py "A'ja Wilson" splits month
  python query_splits.py "Alyssa Thomas" last ast 10      -> date + days ago of last 10+ AST game
  python query_splits.py "Caitlin Clark" last pts 30
  python query_splits.py "Angel Reese" count reb 15       -> how many career 15+ REB games
  python query_splits.py "Alyssa Thomas" games ast 10     -> list every 10+ AST game with dates

Stat keys: pts reb ast stl blk fgm fga 3pm 3pa ftm fta to oreb dreb pf min
"""
import json, sys, os
from datetime import datetime, date

# repo-root-relative: this script lives in scripts/, the data sits at the repo
# root, so resolve one level up from __file__ (works from any cwd).
DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "wnba-splits")

def load_player(name_query):
    idx = json.load(open(os.path.join(DATA, "index.json")))
    q = name_query.lower()
    matches = [n for n in idx if q in n.lower()]
    if not matches:
        sys.exit(f"no player matching '{name_query}'")
    if len(matches) > 1:
        print(f"multiple matches, using first: {matches}")
    name = matches[0]
    p = json.load(open(os.path.join(DATA, f"{idx[name]['id']}.json")))
    return name, p

def rows(p):
    L = p["log_legend"]
    ix = {k: i for i, k in enumerate(L)}
    return p["log"], ix

def days_ago(iso):
    return (date.today() - datetime.strptime(iso, "%Y-%m-%d").date()).days

def main():
    if len(sys.argv) < 3:
        print(__doc__); return
    name_q, cmd = sys.argv[1], sys.argv[2]
    name, p = load_player(name_q)
    log, ix = rows(p)
    print(f"{name} ({p['team']} {p['pos']}) — {p['games']} games, {p['first_game']} -> {p['last_game']}\n")

    if cmd == "splits":
        dim = sys.argv[3] if len(sys.argv) > 3 else "weekday"
        order = {"weekday": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
                 "month": ["May","Jun","Jul","Aug","Sep","Oct"]}
        keys = order.get(dim) or sorted(p["splits"][dim].keys())
        print(f"{'':<12}{'G':>4}{'PTS':>6}{'avg':>6}{'REB':>6}{'avg':>6}{'AST':>6}{'avg':>6}{'FGM':>6}{'3PM':>5}")
        for k in keys:
            b = p["splits"][dim].get(k)
            if not b: continue
            g = b["g"]
            print(f"{k:<12}{g:>4}{b.get('pts',0):>6}{b.get('pts',0)/g:>6.1f}"
                  f"{b.get('reb',0):>6}{b.get('reb',0)/g:>6.1f}"
                  f"{b.get('ast',0):>6}{b.get('ast',0)/g:>6.1f}"
                  f"{b.get('fgm',0):>6}{b.get('3pm',0):>5}")

    elif cmd in ("last", "count", "games"):
        stat, thresh = sys.argv[3], int(sys.argv[4])
        si, di, oi, hi = ix[stat], ix["date"], ix["opp"], ix["ha"]
        hits = [r for r in log if r[si] is not None and r[si] >= thresh]
        if cmd == "last":
            if not hits:
                print(f"never had {thresh}+ {stat}"); return
            r = hits[-1]
            print(f"Last {thresh}+ {stat.upper()}: {r[di]} {'vs' if r[hi]=='H' else '@'} {r[oi]} "
                  f"({r[si]} {stat}) — {days_ago(r[di])} days ago")
            print(f"Career {thresh}+ {stat.upper()} games: {len(hits)}")
        elif cmd == "count":
            print(f"Career {thresh}+ {stat.upper()} games: {len(hits)}")
        else:
            for r in hits:
                print(f"  {r[di]} {'vs' if r[hi]=='H' else '@'} {r[oi]:<4} {r[si]} {stat}  ({days_ago(r[di])}d ago)")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
