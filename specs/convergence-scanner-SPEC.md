# CONVERGENCE SCANNER — Claude Code Handoff Spec
**Version:** carries over from `convergence-scanner-v2.html` (working reference implementation, ship alongside this spec)
**Owner:** Tony
**Date:** 2026-07-08

---

## 1. What this is

A zero-input MLB slate scanner. Pick a date, press SCAN: it pulls the full slate, lineups, stats, and DOBs from the MLB Stats API (client-side), auto-builds every milestone rung for every batter, cross-references each rung against ~15 independent "lanes" of gematria/numerology signal, and surfaces ONLY stacked convergences — rendered as human-readable sentence cards in the style of the Discord decode posts.

The reference HTML is fully working and tested. The Claude Code job is: **migrate it into a proper repo, split into modules, without changing behavior**, then build the Phase 2 items.

## 2. Repo structure (target)

```
convergence-scanner/
├── index.html              # shell: setup panel, controls bar, results container
├── js/
│   ├── gematria-core.js    # cipher engine — SHARED, see §3 (also future dep of batter ranker)
│   ├── numbers.js          # sieve, prime/composite index, nth prime/composite
│   ├── clocks.js           # clockFrom(), date numerology, day ruler
│   ├── data-static.js      # CORE_VALUES, T_FAMILY, SEVEN_FAMILY, STATE_*, STADIUM_DATES, FRANCHISE_DATES, TEAM_STATE, VOCAB defaults, VOCAB_STAT, STAT_DEPTH, COMPOUND_WORDS
│   ├── api.js              # MLB Stats API fetch layer
│   ├── scan.js             # buildGameEntries, buildPlayerEntries, scanPlayer, mergeRows
│   ├── render.js           # 4 views, filters, carousel, tabs
│   └── state.js            # RESULTS, LAST, ADJ (live steppers), filter state incl. LANE_ON, rescan()
├── netlify.toml            # standard config (functions dir declared even if unused, node_bundler none)
├── data/                   # future: card-logging JSON (YYYY-MM-DD.json) per existing plan
└── SPEC.md                 # this file
```

Build constraint: **no build step**. ES modules via `<script type="module">` or simple concatenation — must remain Netlify drag-drop deployable and previewable via `python3 -m http.server 8000`. Validate all JS with `node --check`.

## 3. Cipher engine (gematria-core.js) — DO NOT ALTER VALUES

Eight ciphers. Display labels differ from keys:

| Key | Display label | Definition |
|---|---|---|
| Ord | Ord | a=1..z=26 |
| Red | **most pure** | full reduction to single digit, **NO K/V exceptions** (K=2, V=4, S=1) |
| Rev | Rev | 27−ordinal |
| RR | RR | reverse then full-reduce |
| Sat | Satanic | Ordinal + 35 per letter |
| Chal | Chal | Chaldean map: A1 B2 C3 D4 E5 F8 G3 H5 I1 J1 K2 L3 M4 N5 O7 P8 Q1 R2 S3 T4 U6 V6 W6 X5 Y1 Z7 |
| Sept | Sept | Septenary 1-7 pyramid: A1..G7..M1 N1..T7..Z1 (default **OFF**) |
| Latin | Jewish | Agrippa: A1..I9, K10 L20 M30 N40 O50 P60 Q70 R80 S90, T100 **U200** X300 Y400 Z500 J600 **V700 W900** |

**Regression lock (must pass in tests, exact):**
- Wednesday = 100 / 37 / 143 / 44 (Ord/Red/Rev/RR) — matches Zach's posts
- Mercury = 103 / 40 / 86 / 41
- Jesuit Order: Ord 144, Red 54, Rev 153, RR 72, Satanic 529, Latin 1223
- Society of Jesus Latin = 1698; Freemason Latin = 307
- Baltimore Orioles Jewish = 601
- George Chal = 25; Giants Red = 25; San Francisco Red = 50; Homerun RR = 32, Rev = 95; Rangers Red = 37; Luis Garcia Jr Homer Ord = 187; Astros Chal = 20; Mercury Red = 40

User-selectable cipher set (`CIPHER_ON`), default all except Sept. Toggling re-scans from cached data (no refetch).

## 4. Number theory (numbers.js)

Sieve of Eratosthenes to 100,000 at load. Prefix-count arrays give O(1): `isPrime`, `primeIndex`, `compositeIndex`, `nthPrime`, `nthComposite`. Regression: nthPrime(12)=37, nthPrime(8)=19, nthComposite(8)=15, primeIndex(61)=18.

## 5. Clocks (clocks.js)

`clockFrom(originISO, dateISO)` → `{years, since, until, totalDays, weeks, months}` — calendar-exact, leap-aware (never mod-365).
Regression (vs Tony's Date Decoder output for 2026-07-09): PNC groundbreaking 1999-04-07 → 27y 93d, 327mo, 1422w, 9955d. Giants SF arrival 1958-04-15 → 68y 85d, 24922d. CA admission 1850-09-09 → 175y 303d, 64221d. Vs Zach 7/8 post: b.1948-11-12 → since 238, until 127.

`dateNumerology(dateISO)` → the ranker's full formula set PLUS: M||DD and DD||M concatenations (78 and 87 on 7/8), day name gematria, day prime, and day-ruler planet (Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn by weekday).

## 6. Data flow

1. `GET /api/v1/schedule?sportId=1&date=D&hydrate=probablePitcher,lineups,venue`
2. `GET /api/v1/teams?teamIds=...` (teamName, locationName)
3. Lineup fallback: if not posted → `teams/{id}/roster?rosterType=active`, position players only (keep TWP), tag game `projected`
4. Bulk people in chunks of 50: `people?personIds=...&season=Y&hydrate=stats(group=[hitting],type=[career,season,careerStatSplits,statSplits],sitCodes=[h,a],season=Y)` → fullName, **fullFMLName** (legal name), birthDate, **primaryNumber** (jersey), career, season, home/away splits
   - ⚠ UNVERIFIED IN PROD: the `careerStatSplits/statSplits + sitCodes` hydrate syntax was never live-fired (sandbox blocks statsapi). Degrade gracefully if absent; verify first thing in the repo.
5. `runScan(games, people, dateStr)` — pure, cached in `LAST` for instant re-scan on cipher/vocab/filter changes.

Game status tag (Scheduled/Live/Final) is a wanted-but-unbuilt warning for stat contamination — Phase 2 quick win. Freeze rule: scan pre-first-pitch = frozen card.

## 7. Milestone targets per batter

Stats: HR, H, 2B, 3B, BB, SO, TB, RBI, AB, PA — career and season each.
Rung depth per stat (`STAT_DEPTH`): TB 4, RBI 4, AB 5, PA 5, H 3, SO 3, HR 2, BB 2, 2B 2, 3B 1. Depth > 1 renders ⚠+N (overshoot marker).
Home/away HR split: career + season, **venue side only** (home batter → home split).

## 8. Lanes (per candidate number N, scored by count of DISTINCT lanes)

| Lane | Source | Notes |
|---|---|---|
| CONTEXT | both teams' name/teamName/locationName, venue name, both states' names, state order numbers (CA = #31) | all active ciphers |
| NAME | first, last, full roster name, full legal name (fullFMLName) | all active ciphers |
| COMPOUND | (full name / legal name) + each of COMPOUND_WORDS ["HOMER","HOME RUN","HOMERUN"] | stat-tagged HR/TB/RBI |
| VOCAB | editable word list | stat-tagged, see §9 |
| DN | date numerology set incl. concats | |
| RULER | day-ruler planet gematria | |
| CORE | CORE_VALUES table (baseball/Masonic ONLY — never basketball) | |
| THREAD | user-pasted numbers from Zach's daily post | amber accent |
| DELTA | batter birthday clock: since/until/age/age+1/totalDays/weeks; opposing SP: since/until only (SP age deliberately excluded — noise) | exact clockFrom |
| CLOCK | state admission, stadium groundbreaking + opening, franchise origin + arrival: years/since/until/months/weeks/totalDays each | |
| JERSEY | primaryNumber as value; plus header badge when jersey matches date/DN | |
| PRIME | forward: N prime → index vs all sets AND vs other +1 targets. Reverse: nthPrime(N) vs all sets (N ≤ 250) | each bridge entry carries `dest` = destination lane (see §10 lane filter) |
| COMP | same both directions for composites | dest-tagged like PRIME |
| XCOL | same N loaded in another of the player's columns | dropped on merged cards |

**Stat relevance (`VOCAB_STAT`)**: outcome words only match columns that outcome advances. HOME RUN/HOMERUN/HOMER → HR,TB,RBI; GRAND SLAM → HR,RBI; STRIKEOUT → SO; WALK → BB; SINGLE/HIT → H,TB; DOUBLE → 2B,H,TB; TRIPLE → 3B,H,TB; TOTAL BASES → TB; RBI/RUN BATTED IN → RBI; BASEBALL/MLB → any. AB and PA columns accept everything (universal advance). User-added words default to any-column.

**Accents:** T-family {40,43,57,58,59,62,191,69,84,177,201,1336} (value or its prime index) → gold. Thread → amber. Seven-family {7,13,14,17,28,49} → badge. Chain (6, 15, 24, … +9) → badge.

## 9. Card merging

After threshold/filter: rows sharing (gamePk, player, N) merge into one card — all columns in header ("20th season HR + season 2B"), lanes deduped by text, XCOL removed, depth = merged lane count, tFam/thread OR'd. Clone lane objects — never mutate RESULTS.

## 10. UI

- Setup panel: date, thread paste box, cipher chips, vocab chips (add via Enter, × to remove), SCAN, Demo
- Sticky controls: view A/B/C/D toggle, min-lanes 2+/3+/4+, scope Both/Career/Season, 10 stat chips (tap-to-isolate from all-on; clearing last resets to all)
- Game tabs (ALL + per game); picking a game shows the **player carousel**: horizontal scroll, all lineup batters sorted by max depth, jersey + name + depth (zero-hit grayed), tap to filter, tap again to clear
- Views: A sentence (default, ⭐ per lane, dot-separated proofs); B ticket (big number, chips, lane count); C ledger (dense gutter rows); D receipt (full sentences, "Can get his Nth … (sits X, needs +k)", one line per merged column)
- Bright ink for lane text (no muted gray on content); matching numbers green (gold when T-family, amber for thread)
- Render cap: top 400 cards; count shows "(top 400 shown)"
- All filter/view changes re-render only; cipher/vocab changes re-scan from `LAST`; only date change refetches
- **Lane-type filter**: chip row with readable labels (Team/City, Name, Name+Word, Word, Date, Ruler, Core, Thread, Birthday, Clocks, Jersey, Prime, Composite, Cross-col). Tap-to-isolate from all-on, toggle to add/remove, clearing last resets to all. Filtering **recomputes depth from enabled lanes only** and re-applies the threshold (a 4-lane card that was carried by disabled lanes drops out). PRIME/COMP bridge entries pass the filter if PRIME/COMP is on **or** their `dest` lane is on — e.g. "13th prime is 41 → Mercury 41" surfaces under Ruler as well as Prime.
- Threshold includes **1+** (needed for single-lane isolation, which can never stack to 2)
- Carousel scroll arrows: ‹ › overlay each end with background fade, smooth-scroll ~240px, auto-disable at ends
- **Live stat steppers (ADJ layer)**: with a game + player selected, a LIVE strip shows −/+ per stat with season count and today's adds in green ("TB 95 +4"). Each + advances season AND career (per house rule: API totals exclude today), homeRuns also advances the venue-side career/season split. − floors at the API baseline (can only remove what was added live). Every change re-scans from LAST and rebuilds carousel depths. This is a live-tracking aid ONLY — the frozen pregame scan is still what grades; mid-game surfacing is next-rung intel, never a retroactive call.
- Demo Slate button: mock 2-game slate through the real engine (keep for design iteration)

## 11. Performance budget

Full slate (~15 games / 400 players / ~60 targets each): scan < 1.5s, any re-render < 500ms. Achieved via sieve + Map-indexed entry lookup (game entries indexed once per game, player entries per player).

## 12. Phase 2 backlog (in priority order)

1. **Verify/fix split hydrate syntax** in prod (see §6 warning)
2. **Game status tag** (Scheduled/Live/Final) with stat-contamination warning
3. **Deep scan (per game, on demand)**: per-player extra calls for vsTeam career splits (career HR/AB vs tonight's opponent), byMonth (HR in July), byPosition, vs-league — the "70th HR vs the AL / 7th vs the Rangers / 7th in July / 50th as a RF" lanes from the Discord posts. Never slate-wide (request volume).
4. **All-time team W/L staircases**: next franchise win/loss number (home/away/total) as CLOCK-style lanes — needs live aggregation or paste-in from Tony's Date Decoder; do not embed snapshots (stale in a day)
5. **Missing static dates**: STADIUM_DATES lacks Dodger Stadium, Yankee Stadium, Fenway, Wrigley, Chase, Truist, Coors, Kauffman, Angel Stadium, Daikin/Minute Maid, American Family, T-Mobile, Rogers Centre, Nationals Park, Sutter Health; FRANCHISE_DATES lacks Dodgers, Astros, Nationals, Blue Jays. Source: Tony pastes Date Decoder output for those matchups.
6. **`gematria-core.js` adoption by the batter ranker / other tools** (existing dedup roadmap item)
7. **Card-logging hook**: freeze-scan export to `data/YYYY-MM-DD.json` per the planned logging schema
8. Persist user vocab + cipher prefs (URL params or export/import — NOT localStorage while previewed in Claude artifacts; fine on Netlify)

## 13. House rules that bind this tool

- MLB scan vocabulary only — never basketball/NBA/WNBA table values in CORE
- Reduction is pure full reduction, no exceptions, labeled "most pure"
- Only pre-scan (frozen) output counts as a call; no retrofitting
- Trimmed raw output ≠ prediction; only rendered cards count
- New recurring patterns → `candidate-rules.md` first; promote to spec only after repeat sessions
