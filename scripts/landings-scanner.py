#!/usr/bin/env python3
"""
landings-scanner.py — tiered rung sheets + depth-default scanning
(LAYER-SCANNER-V2, 2026-08-06; supersedes the flat top-N board)

Usage:
  python landings-scanner.py data/slates/2026-08-06-landings.json
  python landings-scanner.py slate.json --theme 60,24,40,22
  python landings-scanner.py slate.json --theme-file theme.json
  python landings-scanner.py slate.json --grade          # postgame denominators

Windows: set PYTHONUTF8=1

V2 rules encoded (receipts 2026-08-06):
  * Change 1 — theme-family expansion pre-match: every field number t also
    fields P[t] / C[t] / zero-strip, provenance-tagged ("89=p#24<-...").
  * Change 2 — depth chaining ON by default: v, idx(v), idx(idx(v)) vs the
    expanded field, tagged [d1]/[d2]/[d3]. d3 never elevates alone.
  * Change 3 — name cross-ref: full/first/last x 4 ciphers vs expanded family
    (Young RO=157 rule). Decoration flag, never a leg.
  * Change 4 — ranking: d1 next-event (Wong) > exact-fit delivery (Benge,
    computed across hit siblings on TB) > chains. PA/AB/G autolanders are
    confirms, never calls; G+1 index = own-name cipher -> MARKED MAN
    (Endy/Neto/Benge/Serven candidate). Parkings decorate (DeLauter 57).
  * Change 5 — tiers: T1 LEGS (max 3 full stacks) / T2 WATCHLIST (all d1
    next-event lines + autolanders, soft cap 15) / T3 full sheet JSON
    data/boards/{date}-rungs.json — every batter, no top-N (Neto rule).
  * Change 6 — --grade: postgame per-class denominators ->
    data/graded/{date}-classes.json.
V1 carry-overs: landings predict / parkings decorate; Lopez chains live on as
name-family + depth chains; skip-gate framing via delivery vehicle on legs.
"""
import json, sys, os, unicodedata, argparse, urllib.request
from datetime import date, datetime, timezone

def now_utc():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, 'reconfigure'):
        _s.reconfigure(encoding='utf-8', errors='replace')

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
    """One-step zero drop (Zach convention: 60=6, 907=97). Degenerate strips —
    a single-digit remainder off a 3+ digit number (100->1) — return None:
    they flood every rookie counter with ->1 matches and carry no signature."""
    s = str(v).replace('0', '')
    if not s:
        return None
    r = int(s)
    if r < 10 and v >= 100:
        return None
    return r

# ---------- base field (unchanged from v1) ----------
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
    add(m + day + sum(int(x) for x in str(yy % 100)), 'lesser date num')
    add(m + day, 'm+d')
    add(int(f"{m}{day}"), 'date stamp')
    add(int(f"{day}{m}"), 'date flip')
    doy = (d - date(yy, 1, 1)).days + 1
    add(doy, 'day of year')
    rem = (date(yy, 12, 31) - d).days
    add(rem, 'days remain')
    dayname = DAY_NAMES[d.weekday()]
    planet = PLANETS[d.weekday()]
    for cn, cv in ciphers(dayname).items(): add(cv, f'{dayname} {cn}')
    for cn, cv in ciphers(planet).items():  add(cv, f'{planet} {cn}')
    for cv, labs in INSTITUTIONAL.items():
        for lab in labs: add(cv, lab)
    for v in extra: add(v, 'theme (Zach)')
    return field, dayname, planet

# ---------- entity threads (specs/entity-threads.md) ----------
def load_threads(theme_json, slate_date):
    """Curated entity_threads from the theme JSON → (value, provenance) pairs.
    The scanner NEVER invents thread values (rule 1); it enforces the hook
    gate (rule 2) and expiry (rule 4: active while slate date <= expiry, so
    Nagasaki threads stay live ON 8/9). Merged into the base field BEFORE
    family expansion, so chains inherit thread provenance (rule 3) and thread
    matches weigh exactly like base-field d1 hits (rule 6)."""
    pairs, active, expired = [], [], []
    for th in theme_json.get('entity_threads', []):
        label = th.get('label', 'thread')
        exp = th.get('expiry')
        if exp and slate_date > exp:
            expired.append(f"{label} (expired {exp})")
            continue
        if not th.get('hook'):
            print(f"entity-thread '{label}' has no hook — dropped (hook gate)",
                  file=sys.stderr)
            continue
        pmap = {}
        for k, txt in (th.get('provenance') or {}).items():
            for part in str(k).split('/'):
                part = part.strip()
                if part.isdigit():
                    pmap[int(part)] = txt
        n = 0
        for v in th.get('values', []):
            v = int(v)
            if v > 0:
                pairs.append((v, f"{pmap.get(v, 'thread value')} <- {label}"))
                n += 1
        active.append(f"{label} ({n})")
    return pairs, active, expired

# ---------- Change 1: theme-family expansion ----------
def expand_field(field):
    """One expansion level: self, P[t], C[t], zero-strip. Provenance mandatory
    on every member so match density stays visible (open-Q1: full expansion)."""
    F = {}
    def add(v, prov):
        if v and v > 0:
            F.setdefault(v, [])
            if prov not in F[v]:
                F[v].append(prov)
    for t, labs in field.items():
        for lab in labs:
            add(t, lab)
            if t <= len(PRIMES):
                add(PRIMES[t - 1], f"p#{t}<-{lab}")
            if t <= len(COMPOSITES):
                add(COMPOSITES[t - 1], f"c#{t}<-{lab}")
            zs = zero_strip(t)
            if zs and zs != t:
                add(zs, f"0strip {t}<-{lab}")
    return F

# ---------- Change 2: depth chaining ----------
def match_value(v, F):
    """[(depth, provenance)] for v vs the expanded field.
    d1 = v itself (zero-strip of v counts as d1, tagged);
    d2 = idx(v); d3 = idx(idx(v)). d3 never elevates alone (ranking)."""
    hits = []
    def land(x, depth, chain):
        for lab in F.get(x, ()):
            hits.append((depth, f"{chain}{lab}" if chain else lab))
    land(v, 1, '')
    zs = zero_strip(v)
    if zs and zs != v:
        land(zs, 1, f'0strip {v}->')
    for idx_map, tag in ((P_IDX, 'p#'), (C_IDX, 'c#')):
        if v in idx_map:
            i1 = idx_map[v]
            land(i1, 2, f'{v}={tag}{i1}->')
            for idx_map2, tag2 in ((P_IDX, 'p#'), (C_IDX, 'c#')):
                if i1 in idx_map2:
                    i2 = idx_map2[i1]
                    land(i2, 3, f'{v}={tag}{i1}={tag2}{i2}->')
    # dedupe, best depth first
    seen, out = set(), []
    for depth, prov in sorted(hits):
        if prov not in seen:
            seen.add(prov)
            out.append((depth, prov))
    return out

def best_depth(hits):
    return min((d for d, _ in hits), default=None)

def fmt_hits(hits, cap=3):
    return ' ; '.join(f"[d{d}] {p}" for d, p in hits[:cap])

# ---------- scanning ----------
STATK = {'PA':'plateAppearances','AB':'atBats','H':'hits','TB':'totalBases',
         '2B':'doubles','3B':'triples','HR':'homeRuns','RBI':'rbi','R':'runs',
         'BB':'baseOnBalls','G':'gamesPlayed','SO':'strikeOuts'}
REACH = {'PA':5,'AB':4,'H':2,'TB':4,'RBI':2,'R':2,'2B':1,'3B':1,'HR':1,'BB':2,'G':1,'SO':3}
NEXT_EVENT = {('H',1),('HR',1),('RBI',1),('R',1)}          # Wong rule
AUTO_STATS = {'PA','AB','G'}                               # confirms, never calls
TB_SIBLING = {1:'SINGLE', 2:'DOUBLE', 3:'TRIPLE', 4:'HOMER'}  # Benge rule
K_REACH, OUT_REACH = 8, 21                                 # pitcher ladders (T3)

def scan_batter(p, F):
    name = p.get('fullName', '?')
    parts = name.split()
    first, last = parts[0] if parts else '', parts[-1] if len(parts) > 1 else ''
    cips = ciphers(name)
    name_cip_vals = set(cips.values())

    # Change 3 — name cross-ref vs expanded family (full + first + last; open-Q5
    # yes) + the legal First-Middle-Last name when the slate carries it
    name_flags = []
    for label, s in (('full', name), ('first', first), ('last', last),
                     ('legal', p.get('fullFMLName'))):
        if not s or (label != 'full' and s == name):
            continue
        for cn, cv in ciphers(s).items():
            if label != 'full':
                name_cip_vals.add(cv)
            for d, prov in match_value(cv, F):
                name_flags.append({'part': label, 'cipher': cn, 'n': cv,
                                   'depth': d, 'prov': prov})

    out = {'name': name, 'ciphers': cips, 'nameFlags': name_flags,
           'projections': [], 'parked': [], 'markedMan': [], 'exclusive': []}

    for scope in ('season', 'career'):
        st = p.get(scope) or {}
        if not st:
            continue
        g = lambda k: st.get(STATK[k])
        # parked values decorate (DeLauter 57) — never rank
        for k in STATK:
            base = g(k)
            if base and base in F:
                out['parked'].append(f"{scope} {k}={base} ON {F[base][0]}")
        # projections: every counter, every step to reach — full sheet, no fallback gaps
        for k, rc in REACH.items():
            base = g(k)
            if base is None:
                continue
            for delta in range(1, rc + 1):
                tgt = base + delta
                hits = match_value(tgt, F)
                if not hits:
                    continue
                bd = best_depth(hits)
                cls = ('direct' if bd == 1 and (k, delta) in NEXT_EVENT else
                       'auto'   if k in AUTO_STATS and bd == 1 else
                       'chain')
                out['projections'].append({
                    'scope': scope, 'stat': k, 'base': base, 'target': tgt,
                    'delta': delta, 'depth': bd, 'class': cls,
                    'hits': [{'depth': d, 'prov': pr} for d, pr in hits]})
        # exact-fit delivery (Benge): which hit sibling lands the TB counter.
        # Exclusivity judged on d1/d2 hits only — a d3-only landing neither
        # claims exclusivity nor spoils it ("d3 never elevates alone").
        tb = g('TB')
        if tb is not None:
            landing = {d: [h for h in match_value(tb + d, F) if h[0] <= 2]
                       for d in TB_SIBLING}
            landed = [d for d, h in landing.items() if h]
            if len(landed) == 1:
                d = landed[0]
                out['exclusive'].append({
                    'scope': scope, 'outcome': TB_SIBLING[d], 'stat': 'TB',
                    'base': tb, 'target': tb + d, 'depth': best_depth(landing[d]),
                    'hits': [{'depth': dd, 'prov': pr} for dd, pr in landing[d]]})
        # marked-man G-stamp (Endy/Neto/Benge/Serven candidate): G+1 index = own name cipher
        gp = g('G')
        if gp is not None:
            nxt = gp + 1
            for idx_map, tag in ((P_IDX, 'p#'), (C_IDX, 'c#')):
                if nxt in idx_map and idx_map[nxt] in name_cip_vals:
                    out['markedMan'].append(
                        f"{scope} G+1={nxt}={tag}{idx_map[nxt]} = own name cipher")
    return out

def scan_pitcher(p, F):
    """Tier-3-only K/out ladders (Castillo 86->89->90 class; open-Q4 yes).
    Needs seasonPitching/careerPitching on the slate person (newer slates)."""
    ladders = []
    for scope in ('season', 'career'):
        st = p.get(scope + 'Pitching') or {}
        if not st:
            continue
        k = st.get('strikeOuts')
        if k is not None:
            for delta in range(1, K_REACH + 1):
                hits = match_value(k + delta, F)
                if hits:
                    ladders.append({'scope': scope, 'stat': 'K', 'base': k,
                                    'target': k + delta, 'delta': delta,
                                    'depth': best_depth(hits),
                                    'hits': [{'depth': d, 'prov': pr} for d, pr in hits]})
        for wk, wlab in (('wins', 'W'), ('losses', 'L')):
            wv = st.get(wk)
            if wv is not None:
                hits = match_value(wv + 1, F)
                if hits:
                    ladders.append({'scope': scope, 'stat': wlab, 'base': wv,
                                    'target': wv + 1, 'delta': 1,
                                    'depth': best_depth(hits),
                                    'hits': [{'depth': d, 'prov': pr} for d, pr in hits]})
        ip = st.get('inningsPitched')
        if ip is not None:
            try:
                w, frac = (str(ip).split('.') + ['0'])[:2]
                outs = int(w) * 3 + int(frac)
            except ValueError:
                continue
            for delta in range(3, OUT_REACH + 1, 3):
                hits = match_value(outs + delta, F)
                if hits:
                    ladders.append({'scope': scope, 'stat': 'OUTS', 'base': outs,
                                    'target': outs + delta, 'delta': delta,
                                    'depth': best_depth(hits),
                                    'hits': [{'depth': d, 'prov': pr} for d, pr in hits]})
    return ladders

# ---------- ranking (Change 4) ----------
def rank_score(r):
    """d3 contributes nothing on its own (never elevates alone)."""
    direct = sum(1 for pj in r['projections'] if pj['class'] == 'direct')
    excl   = len(r['exclusive'])
    namef  = sum(1 for f in r['nameFlags'] if f['depth'] <= 2)
    auto   = sum(1 for pj in r['projections'] if pj['class'] == 'auto')
    d2     = sum(1 for pj in r['projections'] if pj['class'] == 'chain' and pj['depth'] == 2)
    return direct * 8 + excl * 5 + namef * 3 + auto * 2 + d2

def tier1_eligible(r):
    """Full stack: name-family (d<=2) + counter hit (d<=2) + exclusive delivery."""
    return (any(f['depth'] <= 2 for f in r['nameFlags'])
            and any(pj['depth'] <= 2 for pj in r['projections'])
            and r['exclusive'])

# ---------- board ----------
def leg_line(r):
    ex = sorted(r['exclusive'], key=lambda e: (e['depth'], e['scope'] != 'season'))[0]
    call = (f"CALL {ex['outcome']}: {ex['scope']} TB {ex['base']}->{ex['target']} "
            f"[exact-fit] {fmt_hits([(h['depth'], h['prov']) for h in ex['hits']], 2)}")
    directs = [pj for pj in r['projections'] if pj['class'] == 'direct']
    alt = (f"ALT {directs[0]['stat']}+{directs[0]['delta']}->{directs[0]['target']} "
           f"({directs[0]['scope']}) {fmt_hits([(h['depth'], h['prov']) for h in directs[0]['hits']], 1)}"
           if directs else
           (f"ALT {r['exclusive'][1]['outcome']} TB->{r['exclusive'][1]['target']} ({r['exclusive'][1]['scope']})"
            if len(r['exclusive']) > 1 else 'ALT 2-RBI ladder (see T3)'))
    nf = min((f for f in r['nameFlags'] if f['depth'] <= 2), key=lambda f: f['depth'])
    stack = f"NAME {nf['part']} {nf['cipher']}={nf['n']} [d{nf['depth']}] {nf['prov']}"
    return f"{r['name']} ({r['team']}) — {call} · {alt} · {stack}"

def watch_line(r):
    """Per-category slots so no class starves another: directs 4 / autos 2 /
    marked 1 / name 1. The name flag ALWAYS prints when present (Young-class
    regression 5c) — decoration, never a leg."""
    directs = [f"{pj['stat']}+{pj['delta']}->{pj['target']} ({pj['scope']}) "
               f"{fmt_hits([(h['depth'], h['prov']) for h in pj['hits']], 1)}"
               for pj in r['projections'] if pj['class'] == 'direct'][:4]
    autos = [f"auto {pj['stat']}->{pj['target']} in {pj['delta']} ({pj['scope']})"
             for pj in r['projections'] if pj['class'] == 'auto' and pj['delta'] <= 4][:2]
    marked = [f"MARKED MAN {m}" for m in r['markedMan'][:1]]
    nf = [f for f in r['nameFlags'] if f['depth'] <= 2]
    named = []
    if nf:
        # entity-thread provenance (' <- {label}', spaced — load_threads format)
        # outranks base-field flags at equal depth: the curated signal prints
        f = min(nf, key=lambda x: (' <- ' not in x['prov'], x['depth']))
        named = [f"NAME {f['part']} {f['cipher']}={f['n']} [d{f['depth']}] {f['prov']}"]
    return f"{r['name']} ({r['team']}) — " + ' | '.join(directs + autos + marked + named)

def render_game(gkey, rows):
    lines = [f"\n## {gkey}"]
    legs = sorted([r for r in rows if tier1_eligible(r)], key=rank_score, reverse=True)[:3]
    lines.append("TIER 1 · LEGS" + ('' if legs else ' — none (no full stacks)'))
    for r in legs:
        lines.append(f"  LEG: {leg_line(r)}")
    directs = [r for r in rows if any(pj['class'] == 'direct' for pj in r['projections'])]
    autos   = [r for r in rows if r not in directs
               and (any(pj['class'] == 'auto' and pj['delta'] <= 4 for pj in r['projections'])
                    or r['markedMan'])]
    named   = [r for r in rows if r not in directs and r not in autos
               and any(f['depth'] <= 2 for f in r['nameFlags'])]
    watch = sorted(directs, key=rank_score, reverse=True)   # every d1 next-event prints
    for pool in (autos, named):                             # fill to soft cap 15
        for r in sorted(pool, key=rank_score, reverse=True):
            if len(watch) >= 15:
                break
            watch.append(r)
    lines.append("TIER 2 · WATCHLIST")
    for r in watch:
        lines.append(f"  {watch_line(r)}")
    if not watch:
        lines.append("  (no direct hits / auto-landers)")
    return lines

# ---------- grading (Change 6) ----------
GRADE_DEFS = {
    'd1-direct':     'entering + boxscore line reached the flagged target on that counter',
    'exclusive-fit': 'entering + boxscore line reached the exact-fit TB target',
    'auto-lander':   'entering + boxscore line reached the flagged PA/AB/G target',
    'name-family':   'flagged player homered that day (Young receipt class)',
    'g-stamp':       'flagged player homered that day (Endy/Neto/Benge/Serven class)',
}
BOX_KEY = {'PA':'plateAppearances','AB':'atBats','H':'hits','TB':'totalBases',
           '2B':'doubles','3B':'triples','HR':'homeRuns','RBI':'rbi','R':'runs',
           'BB':'baseOnBalls','G':'gamesPlayed','SO':'strikeOuts'}

def jget(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'realconvergy-landings'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def grade(rungs, slate, out_path):
    lines = {}   # pid -> batting line
    for gm in slate.get('games', []):
        pk = gm.get('pk')
        if not pk:
            continue
        try:
            box = jget(f"https://statsapi.mlb.com/api/v1/game/{pk}/boxscore")
        except Exception as e:
            print(f"grade: boxscore {pk} failed ({e}) — skipping game", file=sys.stderr)
            continue
        for side in ('home', 'away'):
            for pid, pl in (box.get('teams', {}).get(side, {}).get('players') or {}).items():
                st = (pl.get('stats') or {}).get('batting') or {}
                if st:
                    lines[pid.replace('ID', '')] = st
    classes = {c: {'definition': GRADE_DEFS[c], 'flagged': 0, 'hit': 0, 'miss': 0, 'hits': []}
               for c in GRADE_DEFS}
    def tally(cls, hit, label):
        classes[cls]['flagged'] += 1
        classes[cls]['hit' if hit else 'miss'] += 1
        if hit and len(classes[cls]['hits']) < 25:
            classes[cls]['hits'].append(label)
    for gm in rungs.get('games', []):
        for pl in gm.get('players', []):
            line = lines.get(str(pl['id']), {})
            homered = (line.get('homeRuns') or 0) > 0
            def reached(pj):
                # season-scope only is gradable off one game line; career moves identically
                delta = line.get(BOX_KEY[pj['stat']]) or 0
                if pj['stat'] == 'G':
                    delta = 1 if line else 0
                return pj['base'] + delta >= pj['target']
            for pj in pl.get('projections', []):
                if pj['scope'] != 'season':
                    continue
                if pj['class'] == 'direct':
                    tally('d1-direct', reached(pj), f"{pl['name']} {pj['stat']}->{pj['target']}")
                elif pj['class'] == 'auto':
                    tally('auto-lander', reached(pj), f"{pl['name']} {pj['stat']}->{pj['target']}")
            for ex in pl.get('exclusive', []):
                if ex['scope'] != 'season':
                    continue
                delta = line.get('totalBases') or 0
                tally('exclusive-fit', ex['base'] + delta >= ex['target'],
                      f"{pl['name']} {ex['outcome']} TB->{ex['target']}")
            if any(f['depth'] <= 2 for f in pl.get('nameFlags', [])):
                tally('name-family', homered, f"{pl['name']} HR")
            if pl.get('markedMan'):
                tally('g-stamp', homered, f"{pl['name']} HR")
    out = {'schema': 'cvg-classes/v1', 'date': rungs.get('date'),
           'gradedAt': now_utc(),
           'gamesGraded': sum(1 for gm in slate.get('games', []) if gm.get('pk')),
           'classes': classes}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=1)
    print(f"# CLASS DENOMINATORS — {rungs.get('date')}")
    for c, t in classes.items():
        print(f"  {c:14s} flagged {t['flagged']:4d}  hit {t['hit']:4d}  miss {t['miss']:4d}")
    print(f"wrote {out_path}", file=sys.stderr)

# ---------- main ----------
def repo_paths(slate_path, slate_date):
    d = os.path.dirname(os.path.abspath(slate_path))
    if os.path.basename(d) == 'slates':
        repo = os.path.dirname(os.path.dirname(d))
        return (os.path.join(repo, 'data', 'boards', f'{slate_date}-rungs.json'),
                os.path.join(repo, 'data', 'graded', f'{slate_date}-classes.json'))
    return (None, None)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slate')
    ap.add_argument('--theme', default='', help='comma list of Zach thread numbers')
    ap.add_argument('--theme-file', default='', help='json file: {"numbers":[...]}')
    ap.add_argument('--date', default='', help='override date YYYY-MM-DD')
    ap.add_argument('--json-out', default='', help='Tier 3 rungs JSON path (default data/boards/{date}-rungs.json)')
    ap.add_argument('--no-json', action='store_true', help='skip the Tier 3 JSON write')
    ap.add_argument('--grade', action='store_true', help='postgame class denominators from the rungs JSON')
    ap.add_argument('--top', type=int, default=0, help='(v1 compat — ignored; no top-N cutoff, Neto rule)')
    args = ap.parse_args()

    data = json.load(open(args.slate, encoding='utf-8'))
    slate = data.get('slate', data)
    slate_date = args.date or data.get('date') or slate.get('_date') or date.today().isoformat()
    rungs_path, graded_path = repo_paths(args.slate, slate_date)
    if args.json_out:
        rungs_path = args.json_out

    if args.grade:
        if not rungs_path or not os.path.exists(rungs_path):
            sys.exit(f"--grade needs the pregame rungs JSON ({rungs_path or 'unresolvable path'}) — run the scan first")
        grade(json.load(open(rungs_path, encoding='utf-8')), slate,
              graded_path or f'{slate_date}-classes.json')
        return

    extra, thread_pairs, th_active, th_expired = [], [], [], []
    if args.theme:
        extra += [int(x) for x in args.theme.replace(' ', '').split(',') if x]
    if args.theme_file:
        tj = json.load(open(args.theme_file, encoding='utf-8'))
        extra += tj.get('numbers', [])
        thread_pairs, th_active, th_expired = load_threads(tj, slate_date)

    field, dayname, planet = build_field(slate_date, extra)
    for v, lab in thread_pairs:      # threads join the field pre-expansion
        if lab not in field.setdefault(v, []):
            field[v].append(lab)
    F = expand_field(field)

    print(f"# LANDINGS BOARD — {slate_date} ({dayname}/{planet}) — V2 tiered rungs")
    base = sorted((v, '/'.join(sorted(set(l))[:2])) for v, l in field.items())
    print("FIELD: " + '  '.join(f"{v}[{lab}]" for v, lab in base))
    if th_active or th_expired:
        print("THREADS: " + ' · '.join(th_active) +
              ('   DROPPED: ' + ' · '.join(th_expired) if th_expired else ''))
    print(f"EXPANDED FAMILY: {len(F)} values from {len(field)} base numbers "
          f"(p#/c#/0strip, provenance on every line)")
    print("=" * 78)

    people = slate.get('people', {})
    pgame = {}
    for gm in slate.get('games', []):
        home = gm.get('home', {}).get('abbrev', '?')
        away = gm.get('away', {}).get('abbrev', '?')
        gk = f"{away} @ {home}"
        for pid in gm.get('homeIds', []): pgame[str(pid)] = (gk, home, gm)
        for pid in gm.get('awayIds', []): pgame[str(pid)] = (gk, away, gm)
        for pid in gm.get('probableIds', []) or []:
            pgame.setdefault(str(pid), (gk, '?', gm))

    by_game, t3_games = {}, {}
    for pid, p in people.items():
        if str(pid) not in pgame:
            continue
        gkey, team, gm = pgame[str(pid)]
        t3 = t3_games.setdefault(gkey, {'pk': gm.get('pk'), 'matchup': gkey, 'players': []})
        is_pitcher = p.get('position') == 'P'
        if not is_pitcher or p.get('position') == 'TWP':
            r = scan_batter(p, F)
            r['team'], r['id'], r['position'] = team, int(pid), p.get('position', '')
            by_game.setdefault(gkey, []).append(r)
            t3['players'].append(r)
        if is_pitcher or p.get('position') == 'TWP' or p.get('seasonPitching'):
            ladder = scan_pitcher(p, F)
            if ladder:
                t3['players'].append({'id': int(pid), 'name': p.get('fullName', '?'),
                                      'team': team, 'position': p.get('position', ''),
                                      'pitcherLadder': ladder,
                                      'nameFlags': [], 'projections': [],
                                      'parked': [], 'markedMan': [], 'exclusive': []})

    for gkey in sorted(by_game):
        for ln in render_game(gkey, by_game[gkey]):
            print(ln)

    if rungs_path and not args.no_json:
        out = {'schema': 'cvg-rungs/v1', 'date': slate_date,
               'generatedAt': now_utc(),
               'dayname': dayname, 'planet': planet,
               'field': {str(v): labs for v, labs in sorted(field.items())},
               'entityThreads': {'active': th_active, 'dropped': th_expired},
               'expandedSize': len(F),
               'games': [t3_games[k] for k in sorted(t3_games)]}
        os.makedirs(os.path.dirname(rungs_path), exist_ok=True)
        with open(rungs_path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, indent=1)
        print(f"wrote {rungs_path}", file=sys.stderr)

if __name__ == '__main__':
    main()
