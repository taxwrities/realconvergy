#!/usr/bin/env python3
"""
run-board.py — morning landings-board pipeline (wiring only; scan logic lives
in landings-scanner.py and is never touched here).

    python scripts/run-board.py                      # today's board, printed
    python scripts/run-board.py --commit             # pre-Zach board, pushed
    python scripts/run-board.py --theme 5,23,59      # themed variant
    python scripts/run-board.py --retheme --commit   # post-Zach re-run, board only

Slate resolution (data/slates/{date}-landings.json — the people/games schema
landings-scanner consumes; trio-scanner's {date}.json is a DIFFERENT artifact
and is never read or written here, see QUESTIONS.md):
  1. local file if present
  2. origin/main copy if present (git fetch + git show)
  3. built fresh from statsapi (same calls as apps/mlb fetchSlate: schedule
     hydrate=probablePitcher,lineups → team abbrevs → active-roster fallback
     → bulk people with career+season hitting)

Theme numbers: --theme csv UNION data/themes/board-theme-{date}.json numbers.
Themed output goes to data/boards/{date}-themed.txt; the untheme'd base file
data/boards/{date}.txt is written by untheme'd runs (or backfilled by a themed
run if missing) and is never overwritten with themed content.
"""
import argparse, json, os, re, subprocess, sys, urllib.request
from datetime import date, datetime

# Windows consoles default to cp1252, which can't print the board's arrows
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, 'reconfigure'):
        _s.reconfigure(encoding='utf-8', errors='replace')

REPO    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLATES  = os.path.join(REPO, 'data', 'slates')
BOARDS  = os.path.join(REPO, 'data', 'boards')
THEMES  = os.path.join(REPO, 'data', 'themes')
SCANNER = os.path.join(REPO, 'scripts', 'landings-scanner.py')
API     = 'https://statsapi.mlb.com/api/v1'


def die(msg):
    print(f"run-board: {msg}", file=sys.stderr)
    sys.exit(1)


def today_local():
    """Today in America/Indiana/Indianapolis; falls back to machine-local
    (this box lives in Indiana) when tzdata isn't installed."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo('America/Indiana/Indianapolis')).date().isoformat()
    except Exception:
        return date.today().isoformat()


def jget(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'realconvergy-run-board'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


# ---------- slate ----------
def build_slate(ds, path):
    """Build the landings-format slate from statsapi — the same endpoints the
    MLB app's fetchSlate uses, trimmed to what landings-scanner reads:
    games[{home/away:{abbrev}, homeIds, awayIds}] + people[{fullName, position,
    season, career}] with raw statsapi hitting keys (plateAppearances, ...)."""
    season = ds[:4]
    sched = jget(f"{API}/schedule?sportId=1&date={ds}&hydrate=probablePitcher,lineups")
    raw = (sched.get('dates') or [{}])[0].get('games', [])
    if not raw:
        die(f"no MLB games scheduled for {ds}")
    games = [{
        'pk': g['gamePk'],
        'home': {'id': g['teams']['home']['team']['id']},
        'away': {'id': g['teams']['away']['team']['id']},
        'homeIds': [x['id'] for x in (g.get('lineups') or {}).get('homePlayers') or []],
        'awayIds': [x['id'] for x in (g.get('lineups') or {}).get('awayPlayers') or []],
    } for g in raw]

    team_ids = sorted({g[s]['id'] for g in games for s in ('home', 'away')})
    tdata = jget(f"{API}/teams?teamIds={','.join(map(str, team_ids))}&sportId=1")
    abbrev = {t['id']: t.get('abbreviation', '?') for t in tdata.get('teams', [])}
    for g in games:
        for s in ('home', 'away'):
            g[s]['abbrev'] = abbrev.get(g[s]['id'], '?')

    # lineup fallback → active-roster position players (keep TWP), like the app
    for g in games:
        for s in ('home', 'away'):
            if not g[s + 'Ids']:
                r = jget(f"{API}/teams/{g[s]['id']}/roster?rosterType=active")
                g[s + 'Ids'] = [x['person']['id'] for x in r.get('roster', [])
                                if x['position']['type'] != 'Pitcher'
                                or x['position']['abbreviation'] == 'TWP']

    people = {}
    ids = sorted({pid for g in games for s in ('homeIds', 'awayIds') for pid in g[s]})
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        d = jget(f"{API}/people?personIds={','.join(map(str, chunk))}&season={season}"
                 f"&hydrate=stats(group=[hitting],type=[career,season],season={season})")
        for pp in d.get('people', []):
            rec = {'fullName': pp.get('fullName', '?'),
                   'position': (pp.get('primaryPosition') or {}).get('abbreviation', '')}
            for st in pp.get('stats') or []:
                tn = st.get('type', {}).get('displayName')
                if tn in ('career', 'season'):
                    s = (st.get('splits') or [{}])[0].get('stat')
                    if s:
                        rec[tn] = s
            people[str(pp['id'])] = rec

    slate = {'date': ds, 'fetched_at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
             'games': games, 'people': people}
    os.makedirs(SLATES, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(slate, f, indent=1)
    print(f"built slate from statsapi → {os.path.relpath(path, REPO)}")


def git(args, **kw):
    return subprocess.run(['git'] + args, cwd=REPO, **kw)


def resolve_slate(ds):
    path = os.path.join(SLATES, f"{ds}-landings.json")
    if os.path.exists(path):
        return path
    # try origin/main before rebuilding
    git(['fetch', 'origin', 'main'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    show = git(['show', f"origin/main:data/slates/{ds}-landings.json"],
               capture_output=True)
    if show.returncode == 0 and show.stdout.strip():
        os.makedirs(SLATES, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(show.stdout)
        print(f"pulled slate from origin/main → {os.path.relpath(path, REPO)}")
        return path
    build_slate(ds, path)
    return path


# ---------- theme ----------
def load_theme(ds, cli_theme):
    nums = []
    if cli_theme:
        try:
            nums += [int(x) for x in cli_theme.replace(' ', '').split(',') if x]
        except ValueError:
            die(f"--theme must be a comma list of integers, got: {cli_theme}")
    tf = os.path.join(THEMES, f"board-theme-{ds}.json")
    if os.path.exists(tf):
        try:
            file_nums = json.load(open(tf, encoding='utf-8')).get('numbers', [])
        except (ValueError, OSError) as e:
            die(f"bad theme file {os.path.relpath(tf, REPO)}: {e}")
        nums += [int(x) for x in file_nums]
        print(f"loaded {len(file_nums)} theme numbers from {os.path.relpath(tf, REPO)}")
    seen, out = set(), []
    for n in nums:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


# ---------- board ----------
def run_scanner(slate_path, theme_nums):
    cmd = [sys.executable, SCANNER, slate_path]
    if theme_nums:
        cmd += ['--theme', ','.join(map(str, theme_nums))]
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    res = subprocess.run(cmd, capture_output=True, encoding='utf-8', env=env)
    if res.returncode != 0:
        die(f"landings-scanner failed: {(res.stderr or '').strip().splitlines()[-1:] or 'no stderr'}")
    out = res.stdout
    if len(out.encode('utf-8')) < 500:
        die(f"board output too small ({len(out.encode('utf-8'))} bytes < 500) — not writing")
    if 'LANDINGS BOARD' not in out:
        die("board output missing 'LANDINGS BOARD' header — not writing")
    return out


def write_board(path, text):
    os.makedirs(BOARDS, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser(description='slate → landings board → data/boards/{date}.txt')
    ap.add_argument('date', nargs='?', default='',
                    help='YYYY-MM-DD (default: today, America/Indiana/Indianapolis)')
    ap.add_argument('--theme', default='', help='comma list of Zach thread numbers')
    ap.add_argument('--commit', action='store_true',
                    help='git add/commit/push the slate + board files')
    ap.add_argument('--retheme', action='store_true',
                    help='reuse the existing slate, regenerate the themed board only')
    a = ap.parse_args()

    ds = a.date or today_local()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', ds):
        die(f"bad date '{ds}' — want YYYY-MM-DD")

    slate = os.path.join(SLATES, f"{ds}-landings.json")
    if a.retheme:
        if not os.path.exists(slate):
            die(f"--retheme but no slate at {os.path.relpath(slate, REPO)} — run without --retheme first")
    else:
        slate = resolve_slate(ds)

    theme = load_theme(ds, a.theme)
    if a.retheme and not theme:
        die(f"--retheme with no theme numbers (no --theme and no data/themes/board-theme-{ds}.json)")

    base_path   = os.path.join(BOARDS, f"{ds}.txt")
    themed_path = os.path.join(BOARDS, f"{ds}-themed.txt")
    written = []

    if theme:
        board = run_scanner(slate, theme)
        write_board(themed_path, board)
        written.append(themed_path)
        # keep an untheme'd base alongside; never overwrite an existing one
        if not a.retheme and not os.path.exists(base_path):
            write_board(base_path, run_scanner(slate, []))
            written.append(base_path)
    else:
        board = run_scanner(slate, [])
        write_board(base_path, board)
        written.append(base_path)

    if a.commit:
        rels = [os.path.relpath(p, REPO).replace(os.sep, '/') for p in written]
        if not a.retheme:
            rels.insert(0, os.path.relpath(slate, REPO).replace(os.sep, '/'))
        for cmd in (['add'] + rels, ['commit', '-m', f"board: {ds}"], ['push']):
            r = git(cmd)
            if r.returncode != 0:
                die(f"git {cmd[0]} failed (exit {r.returncode})")
        print(f"committed + pushed: {', '.join(rels)}")
    else:
        print(board)
        for p in written:
            print(f"wrote {os.path.relpath(p, REPO)}")
        print("(dry run — nothing staged; use --commit to publish)")


if __name__ == '__main__':
    main()
