#!/usr/bin/env python3
"""
landings-scanner.py — pregame event-landing board
Usage:
  python landings-scanner.py slate-2026-08-06.json
  python landings-scanner.py slate-2026-08-06.json --theme 60,24,40,22
  python landings-scanner.py slate-2026-08-06.json --theme-file theme.json --top 12

Encodes the 8/5 session rules:
  * LANDINGS PREDICT, PARKINGS DECORATE — everything is +N projection, entering-ON is garnish
  * Event simulation: which outcome (single/double/HR/2-RBI) lands the most counters
  * Lopez chains: name value -> nth prime/composite == live counter (one event away)
  * Day-name chains: day/planet cipher -> prime/composite index -> name value (Betts 74 rule)
  * Phrase signatures: "{Name} Two RBI" vs institutional/day targets (Baldwin 191 rule)
  * Signed-name convergence: institutional value in base name + loaded rung
  * Zero-strip transform on 3-digit targets (907 -> 97)
  * Skip-gate framing: RBI rungs cash without hits; outputs note delivery vehicle
Theme numbers from Zach's post get added via --theme once the post drops; the
script self-computes date numerology, day-of-year, day-name and planet ciphers.
"""
import json, sys, unicodedata, argparse
from datetime import date, datetime

# ---------- ciphers ----------
def _norm(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s.upper() if c.isalpha())

def _red(v):
    while v > 9:
        v = sum(int(x) for x in str(v))
    return v

def ciphers(s):
    n = _norm(s)
    o  = sum(ord(c) - 64 for c in n)
    r  = sum(_red(ord(c) - 64) for c in n)
    ro = sum(27 - (ord(c) - 64) for c in n)
    rr = sum(_red(27 - (ord(c) - 64)) for c in n)
    return {'Ord': o, 'Red': r, 'RevOrd': ro, 'RevRed': rr}

# ---------- primes / composites ----------
N = 40000
_sieve = [True] * (N + 1); _sieve[0] = _sieve[1] = False
for i in range(2, int(N ** .5) + 1):
    if _sieve[i]:
        for j in range(i * i, N + 1, i):
            _sieve[j] = False
PRIMES = [i for i in range(N + 1) if _sieve[i]]
COMPOSITES = [i for i in range(4, N + 1) if not _sieve[i]]
P_IDX = {p: i + 1 for i, p in enumerate(PRIMES)}
C_IDX = {c: i + 1 for i, c in enumerate(COMPOSITES)}

def zero_strip(v):
    s = str(v).replace('0', '')
    return int(s) if s else None

# ---------- day field ----------
DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
PLANETS   = ['Moon','Mars','Mercury','Jupiter','Venus','Saturn','Sun']  # Mon..Sun rulers

INSTITUTIONAL = {}
for phrase in ('Society of Jesus','Jesuit Order','Jesuit','Pope Leo XIV','Pope Leo','Pope'):
    for cn, cv in ciphers(phrase).items():
        INSTITUTIONAL.setdefault(cv, []).append(f"{phrase} {cn}")

def build_field(slate_date, extra):
    d = date.fromisoformat(slate_date)
    m, day, yy = d.month, d.day, d.year
    field = {}
    def add(v, label):
        if v and v > 0:
            field.setdefault(v, []).append(label)
    add(m + day + (yy // 100) + (yy % 100), 'date num')
    add(m + day + sum(int(x) for x in str(yy)), 'date num')
    add(m + day + (yy % 100), 'date num')
    add(m + day + _red(yy % 100) if False else m + day + sum(int(x) for x in str(yy % 100)), 'lesser date num')
    add(m + day, 'm+d')
    add(int(f"{m}{day}"), 'date stamp')
    add(int(f"{day}{m}"), 'date flip')
    doy = (d - date(yy, 1, 1)).days + 1
    add(doy, 'day of year')
    rem = (date(yy, 12, 31) - d).days
    add(rem, 'days remain')
    for v, lab in ((doy, 'day-of-year'), (rem, 'days-remain')):
        if v in C_IDX: add(C_IDX[v], f'{lab} comp-idx')
        if v in P_IDX: add(P_IDX[v], f'{lab} prime-idx')
    dayname = DAY_NAMES[d.weekday()]
    planet = PLANETS[d.weekday()]
    day_cips, planet_cips = ciphers(dayname), ciphers(planet)
    for cn, cv in day_cips.items(): add(cv, f'{dayname} {cn}')
    for cn, cv in planet_cips.items(): add(cv, f'{planet} {cn}')
    for cv, labs in INSTITUTIONAL.items():
        for lab in labs: add(cv, lab)
    for v in extra: add(v, 'theme (Zach)')
    # day-name chain seeds (Betts 74 rule): day/planet values as prime/composite -> their index enters field
    for src in list(day_cips.values()) + list(planet_cips.values()):
        if src in C_IDX: add(C_IDX[src], f'day-name comp-idx of {src}')
        if src in P_IDX: add(P_IDX[src], f'day-name prime-idx of {src}')
    return field, dayname, planet

# ---------- scanning ----------
STATK = {'PA':'plateAppearances','AB':'atBats','H':'hits','TB':'totalBases',
         '2B':'doubles','3B':'triples','HR':'homeRuns','RBI':'rbi','R':'runs','BB':'baseOnBalls'}

def target_hit(v, field, name_vals):
    """Return list of labels if v lands in field or name, incl. zero-strip and index chains."""
    labs = []
    if v in field: labs += field[v]
    if v in name_vals: labs.append(f'NAME {name_vals[v]}')
    zs = zero_strip(v)
    if zs and zs != v:
        if zs in field: labs += [f'zero-strip→{l}' for l in field[zs]]
        if zs in name_vals: labs.append(f'zero-strip→NAME {name_vals[zs]}')
    for idx_map, tag in ((P_IDX, 'prime#'), (C_IDX, 'comp#')):
        if v in idx_map:
            ix = idx_map[v]
            if ix in field: labs += [f'{tag}{ix}→{l}' for l in field[ix]]
            if ix in name_vals: labs.append(f'{tag}{ix}→NAME {name_vals[ix]}')
    return labs

def scan_player(p, field):
    name = p.get('fullName', '?')
    cips = ciphers(name)
    name_vals = {}
    for cn, cv in cips.items():
        name_vals.setdefault(cv, cn)
    out = {'name': name, 'ciphers': cips, 'events': {}, 'lopez': [], 'signed': [], 'phrase': []}

    # signed name: institutional/day values inside base name
    for cn, cv in cips.items():
        if cv in field:
            out['signed'].append(f"{cn}={cv} [{'; '.join(field[cv])}]")

    # phrase signature
    for cn, cv in ciphers(name + ' Two RBI').items():
        if cv in field:
            out['phrase'].append(f"phrase {cn}={cv} [{'; '.join(field[cv])}]")

    for scope in ('season', 'career'):
        st = p.get(scope) or {}
        if not st:
            continue
        g = lambda k: st.get(STATK[k])
        # Lopez chains: name value -> nth prime/composite, counter within reach
        reach = {'PA': 5, 'AB': 4, 'H': 2, 'TB': 4, 'RBI': 2, 'R': 2, '2B': 1, 'HR': 1, 'BB': 2}
        for cn, cv in cips.items():
            for seq, tag in ((PRIMES, 'prime'), (COMPOSITES, 'composite')):
                if 1 <= cv <= len(seq):
                    tgt = seq[cv - 1]
                    for k, rc in reach.items():
                        v = g(k)
                        if v is not None and 0 < tgt - v <= rc:
                            out['lopez'].append(
                                f"{scope} {k}={v} → {tgt} ({cv}th {tag} of {cn}) in {tgt - v}")
        # event simulation
        PA, AB, H, TB, B2, HR, RBI, R = (g(k) for k in ('PA','AB','H','TB','2B','HR','RBI','R'))
        if None in (H, TB, RBI):
            continue
        def ev(label, deltas):
            lands = []
            for k, dv in deltas.items():
                base = g(k)
                if base is None:
                    continue
                labs = target_hit(base + dv, field, name_vals)
                if labs:
                    lands.append(f"{k}→{base + dv} [{'; '.join(sorted(set(labs))[:3])}]")
            if lands:
                key = f"{label} ({scope})"
                out['events'][key] = lands
        ev('SINGLE',  {'H': 1, 'TB': 1})
        ev('DOUBLE',  {'H': 1, 'TB': 2, '2B': 1})
        ev('HOMER',   {'H': 1, 'TB': 4, 'HR': 1, 'RBI': 1, 'R': 1})
        ev('2-RBI',   {'RBI': 2})
        ev('RUN',     {'R': 1})
    return out

def score(res):
    s = 0
    s += sum(len(v) for v in res['events'].values())
    s += 2 * sum(1 for k in res['events'] if k.startswith('2-RBI'))
    s += 2 * len(res['lopez'])
    s += 2 * len(res['signed'])
    s += len(res['phrase'])
    return s

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slate')
    ap.add_argument('--theme', default='', help='comma list of Zach thread numbers')
    ap.add_argument('--theme-file', default='', help='json file: {"numbers":[...]}')
    ap.add_argument('--top', type=int, default=10, help='players shown per game')
    ap.add_argument('--date', default='', help='override date YYYY-MM-DD (default: slate date)')
    args = ap.parse_args()

    data = json.load(open(args.slate))
    slate = data.get('slate', data)
    slate_date = args.date or data.get('date') or slate.get('_date') or date.today().isoformat()

    extra = []
    if args.theme:
        extra += [int(x) for x in args.theme.replace(' ', '').split(',') if x]
    if args.theme_file:
        extra += json.load(open(args.theme_file)).get('numbers', [])

    field, dayname, planet = build_field(slate_date, extra)
    print(f"# LANDINGS BOARD — {slate_date} ({dayname}/{planet})")
    fld = sorted((v, '/'.join(sorted(set(l))[:2])) for v, l in field.items())
    print("FIELD: " + '  '.join(f"{v}[{lab}]" for v, lab in fld))
    print("=" * 78)

    people = slate.get('people', {})
    games = slate.get('games', [])
    pgame = {}
    for gm in games:
        home = gm.get('home', {}).get('abbrev', '?')
        away = gm.get('away', {}).get('abbrev', '?')
        for pid in gm.get('homeIds', []): pgame[str(pid)] = (f"{away} @ {home}", home)
        for pid in gm.get('awayIds', []): pgame[str(pid)] = (f"{away} @ {home}", away)

    by_game = {}
    for pid, p in people.items():
        if p.get('position') == 'P' or str(pid) not in pgame:
            continue
        gkey, team = pgame[str(pid)]
        res = scan_player(p, field)
        res['team'] = team
        by_game.setdefault(gkey, []).append(res)

    for gkey in sorted(by_game):
        rows = sorted(by_game[gkey], key=score, reverse=True)[:args.top]
        print(f"\n## {gkey}")
        for r in rows:
            sc = score(r)
            if sc == 0:
                continue
            c = r['ciphers']
            print(f"\n### {r['name']} ({r['team']}) — score {sc}  "
                  f"[O={c['Ord']} R={c['Red']} RO={c['RevOrd']} RR={c['RevRed']}]")
            for s in r['signed']:  print(f"    SIGNED NAME: {s}")
            for s in r['phrase']:  print(f"    PHRASE: {s}")
            for k, v in r['events'].items():
                print(f"    {k}: " + ' | '.join(v))
            for l in r['lopez'][:4]:
                print(f"    LOPEZ: {l}")

if __name__ == '__main__':
    main()
