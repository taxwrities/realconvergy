#!/usr/bin/env python3
"""
TRIO SCANNER — the workhorse pattern from MLB_2026_HOMERUNS.xlsx
Pattern: winner's NEXT HR ordinal (season+1 / career+1) lands on a
day-numerology value (leg 2) and/or a team gematria value (leg 3).
Leg 1 (the milestone itself) always exists — legs 2/3 are the match.

Usage:  python trio-scanner.py                      # today's slate
        python trio-scanner.py 2026-07-28           # specific date
        python trio-scanner.py 2026-07-28 --quiet   # no console output
        python trio-scanner.py 2026-07-28 --commit  # write, then add/commit/push
        python trio-scanner.py --quiet --commit     # today, silent, published

Every run writes data/slates/{date}.json — all 2- and 3-leg hits, legs desc,
with the day pool and the slate's games. --commit stages that one file,
commits "slate {date}", and pushes. Exit status is 0 on success, or the
failing git step's exit code when --commit is used.

Requires: requests (pip install requests). MLB Stats API, no auth.
Receipts printed with provenance on every line (QUERY-FIX-1 discipline).
"""
import sys, os, json, argparse, subprocess, requests
from datetime import date, datetime

API = "https://statsapi.mlb.com/api/v1"

# --- locked day tables (thread-builder spine) ---
DAY_NAME = {"Monday":[72,27,90,27],"Tuesday":[95,23,94,40],"Wednesday":[100,37,143,44],
 "Thursday":[116,35,100,46],"Friday":[63,36,99,36],"Saturday":[109,28,107,53],"Sunday":[84,21,78,33]}
PLANET = {"Monday":("Moon",[57,21,51,15]),"Tuesday":("Mars",[51,15,57,30]),
 "Wednesday":("Mercury",[103,40,86,41]),"Thursday":("Jupiter",[99,36,90,45]),
 "Friday":("Venus",[81,18,54,27]),"Saturday":("Saturn",[93,21,69,42]),"Sunday":("Sun",[54,9,27,18])}

# --- team gematria (full + short name, Ord/Red/Rev/RR) regenerated via gematria-core-validated engine ---
TEAM_VALS = {"Arizona Diamondbacks":[42,75,81,96,117,180,228,333],"Atlanta Braves":[22,37,41,67,89,95,136,215],
"Baltimore Orioles":[39,42,80,93,96,100,188,244],"Boston Red Sox":[31,32,53,64,77,85,154,170],
"Chicago Cubs":[9,27,45,46,62,63,91,206],"Chicago White Sox":[39,42,74,79,93,123,169,236],
"Cincinnati Reds":[19,26,46,62,70,92,142,236],"Cleveland Guardians":[40,59,73,94,107,149,172,314],
"Colorado Rockies":[35,46,73,80,89,109,163,242],"Detroit Tigers":[33,39,70,78,83,84,169,182],
"Houston Astros":[20,43,51,70,75,92,147,204],"Kansas City Royals":[27,36,59,72,90,103,212,220],
"Los Angeles Angels":[22,32,58,59,85,104,167,265],"Los Angeles Dodgers":[36,72,73,89,117,181,278],
"Miami Marlins":[32,49,59,85,86,103,131,193],"Milwaukee Brewers":[36,45,73,90,98,99,190,242],
"Minnesota Twins":[22,32,50,60,84,85,183,195],"New York Mets":[12,24,51,57,129,168],
"New York Yankees":[26,37,65,70,80,109,187,191],"Athletics":[34,56,97,146],
"Philadelphia Phillies":[45,90,106,110,126,191,349],"Pittsburgh Pirates":[34,47,84,88,101,105,228,231],
"San Diego Padres":[27,36,63,65,79,99,137,241],"San Francisco Giants":[25,38,70,75,92,114,192,294],
"Seattle Mariners":[43,56,62,97,100,119,179,226],"St. Louis Cardinals":[36,61,63,81,110,162,196,236],
"Tampa Bay Rays":[18,27,43,45,63,74,142,182],"Texas Rangers":[37,44,52,74,82,107,151,173],
"Toronto Blue Jays":[23,49,59,85,95,121,193,212],"Washington Nationals":[33,57,82,105,107,138,235,278]}

def red(n):
    while n > 9 and n not in (11,22,33): n = sum(int(c) for c in str(n))
    return n

def dn_set(d):
    m,dd,yyyy = d.month, d.day, d.year
    cc,yy = yyyy//100, yyyy%100
    doy = d.timetuple().tm_yday
    dliy = (date(d.year,12,31).timetuple().tm_yday) - doy
    vals = {"M+DD+CC+YY": m+dd+cc+yy, "M+DD+ydigits": m+dd+sum(int(c) for c in str(yyyy)),
            "all-digit": sum(int(c) for c in f"{m}{dd:02d}{yyyy}"), "M+DD+YY": m+dd+yy,
            "M+DD": m+dd, "DOY": doy, "DLIY": dliy}
    vals["all-digit reduced"] = red(vals["all-digit"])
    return vals

def get(url, **params):
    r = requests.get(url, params=params, timeout=20); r.raise_for_status(); return r.json()

def git_publish(path, ds, quiet=False):
    """git add <slate> && git commit -m "slate {ds}" && git push — stops on first failure."""
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rel = os.path.relpath(path, repo).replace(os.sep, "/")
    sink = subprocess.DEVNULL if quiet else None
    for cmd in (["git", "add", rel], ["git", "commit", "-m", f"slate {ds}"], ["git", "push"]):
        rc = subprocess.run(cmd, cwd=repo, stdout=sink, stderr=sink).returncode
        if rc != 0:
            if not quiet: print(f"git step failed ({rc}): {' '.join(cmd)}")
            return rc
    if not quiet: print(f"committed + pushed slate {ds}")
    return 0

def main(ds, quiet=False, do_commit=False):
    d = datetime.strptime(ds, "%Y-%m-%d").date()
    wd = d.strftime("%A")
    DN = dn_set(d)
    day_pool = {}   # value -> label list
    for label, v in DN.items(): day_pool.setdefault(v, []).append(f"DN {label}")
    for v in DAY_NAME[wd]: day_pool.setdefault(v, []).append(f"{wd}")
    pname, pvals = PLANET[wd]
    for v in pvals: day_pool.setdefault(v, []).append(pname)

    if not quiet:
        print(f"TRIO SCAN {ds} ({wd}) | DN: {DN} | {wd}: {DAY_NAME[wd]} | {pname}: {pvals}")

    sched = get(f"{API}/schedule", sportId=1, date=ds, hydrate="team")
    games = sched.get("dates",[{}])[0].get("games",[])
    if not games and not quiet: print("no games")
    game_list, hits = [], []
    # A doubleheader lists the same matchup twice, which would scan both rosters
    # twice. Collect the date's distinct (team, opp) pairs first — keyed on ids, so
    # a team facing two different opponents on one date is kept as two pairs.
    pairs, seen_pairs = [], set()
    for g in games:
        game_list.append({"home": g["teams"]["home"]["team"]["name"],
                          "away": g["teams"]["away"]["team"]["name"]})
        for team, opp in ((g["teams"]["home"]["team"], g["teams"]["away"]["team"]),
                          (g["teams"]["away"]["team"], g["teams"]["home"]["team"])):
            k = (team["id"], opp["id"])
            if k in seen_pairs: continue
            seen_pairs.add(k); pairs.append((team, opp))

    roster_ids, stat_cache, emitted = {}, {}, set()
    for team, opp in pairs:
        tv = {}   # value -> label
        for v in TEAM_VALS.get(team["name"], []): tv.setdefault(v, []).append(team["name"]+" (own)")
        for v in TEAM_VALS.get(opp["name"], []):  tv.setdefault(v, []).append(opp["name"]+" (opp)")
        if team["id"] not in roster_ids:
            roster = get(f"{API}/teams/{team['id']}/roster/active").get("roster",[])
            roster_ids[team["id"]] = [str(p["person"]["id"]) for p in roster
                                      if p.get("position",{}).get("type") != "Pitcher"]
        ids = roster_ids[team["id"]]
        need = [i for i in ids if i not in stat_cache]   # HR totals don't vary by opponent
        for i in range(0, len(need), 25):
            ppl = get(f"{API}/people", personIds=",".join(need[i:i+25]),
                      hydrate="stats(group=[hitting],type=[season,career])").get("people",[])
            for p in ppl:
                sea = car = None
                for s in p.get("stats",[]):
                    t = s.get("type",{}).get("displayName"); sp = s.get("splits") or [{}]
                    if t=="season": sea = sp[0].get("stat",{}).get("homeRuns")
                    if t=="career": car = sp[0].get("stat",{}).get("homeRuns")
                stat_cache[str(p["id"])] = (p["fullName"], sea, car)
        for pid in ids:
            if pid not in stat_cache: continue
            pname_, sea, car = stat_cache[pid]
            for kind, hr in (("season", sea), ("career", car)):
                if hr is None: continue
                nxt = int(hr)+1
                legs, receipts = 1, [f"next {kind} HR = #{nxt} [MLB API {kind} HR={hr}]"]
                if nxt in day_pool: legs+=1; receipts.append(f"#{nxt} = {'/'.join(day_pool[nxt])} [day pool]")
                if red(nxt) in day_pool and nxt not in day_pool:
                    receipts.append(f"#{nxt}→{red(nxt)} reduced = {'/'.join(day_pool[red(nxt)])} [day pool, reduced]")
                if nxt in tv: legs+=1; receipts.append(f"#{nxt} = {'/'.join(tv[nxt])} [team table]")
                if legs >= 2:
                    key = (pname_, team["name"], opp["name"], kind, nxt)
                    if key in emitted: continue
                    emitted.add(key)
                    hits.append({"player": pname_, "team": team["name"],
                                 "opp": opp["name"], "legs": legs, "kind": kind,
                                 "next_hr_ordinal": nxt,
                                 "day_hit": nxt in day_pool, "team_hit": nxt in tv,
                                 "receipts": receipts})
    hits.sort(key=lambda h: -h["legs"])

    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "data", "slates")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{ds}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"date": ds, "weekday": wd,
                   "dn_pool": {str(k): v for k, v in sorted(day_pool.items())},
                   "games": game_list, "hits": hits}, f, indent=1, ensure_ascii=False)
        f.write("\n")

    full = [h for h in hits if h["legs"]==3]
    if not quiet:
        print(f"\n=== FULL TRIO (milestone + day + team) — {len(full)} ===")
        for h in full:
            print(f"\n{h['player']} ({h['team']} vs {h['opp']})")
            for r in h["receipts"]: print("   ", r)
        two = [h for h in hits if h["legs"]==2]
        print(f"\n=== TWO-LEG ({len(two)}) — top 25 ===")
        for h in two[:25]:
            # kind is what separates a season-#N row from a career-#N row for the same
            # player — without it the two render identically and read as a duplicate.
            print(f"{h['player']} ({h['team']} vs {h['opp']}) [{h['kind']}] — "
                  + " | ".join(h["receipts"][1:]))
        print(f"\nwrote data/slates/{ds}.json — {len(hits)} hits, {len(full)} full trio")

    return git_publish(out_path, ds, quiet) if do_commit else 0

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Trio scanner — also writes data/slates/{date}.json")
    ap.add_argument("date", nargs="?", default=date.today().isoformat(),
                    help="slate date YYYY-MM-DD (default: today)")
    ap.add_argument("--commit", action="store_true",
                    help="git add/commit/push the slate file after writing")
    ap.add_argument("--quiet", action="store_true", help="suppress console output")
    a = ap.parse_args()
    sys.exit(main(a.date, quiet=a.quiet, do_commit=a.commit))
