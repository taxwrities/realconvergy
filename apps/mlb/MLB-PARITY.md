# MLB convergence — parity changes (mirror of WNBA session, 2026-07-15)

Wrap-up of the changes to bring the MLB app to parity with the eight commits just
shipped on `apps/wnba` (`f757c4d`..`3c7bc19`), **translated to baseball** rather than
find-replaced. Read the "Key divergence" box first — it changes what's needed.

---

## ⚠ Key divergence: MLB uses the official Stats API, not balldontlie

WNBA sums player **game logs** from balldontlie through a Netlify proxy and builds
totals by hand. MLB (`src/data/mlb.js`) calls **`statsapi.mlb.com`** directly (no
proxy, no key) and hydrates **pre-computed official `career`/`season` stat objects**
(`hydrate=stats(group=[hitting],type=[career,season,…])`). Consequences:

- **There is no accumulator** (`statLine`/`addRow`/`zero`), **no cursor pagination**,
  and **no game-log summing** in MLB. Three of the WNBA commits existed *only* to fix
  problems that arise from hand-summing logs — those **do not apply** to MLB (see §"N/A").
- The `career`/`season` objects already carry **every Baseball-Reference field**
  (`rbi, stolenBases, avg, obp, slg, ops, groundIntoDoublePlay, hitByPitch, …`) — they're
  just never read. So the totals table needs **no new fetch**, only a renderer.
- The opposing **pitcher** is a first-class, genuinely useful entity here (unlike WNBA's
  inferred "opposing center"). **Do not blindly port "drop opposing center."** See §2.

---

## 1. Singles (1B) + XBH lanes + RBI wired  ⟵ mirrors `f757c4d`  ✅ decided

**Decision (Tony):** add **1B** (definite), add **XBH** but toggle-off-able, **wire RBI** as
a real stat/lane. All three are counting stats — Tony wants counting stats only.

- `1B = H − 2B − 3B − HR` (the exact 2PM analog: total minus the broken-out subset).
- `XBH = 2B + 3B + HR` (additive cousin). Since every entry in `LANES` is a RefineBox toggle
  chip, XBH is inherently "toggle-off-able" — ship it as a lane that is **NOT in
  `DEFAULT_LANES_ON`** (off by default, one tap to enable). 1B goes in the default set.
- **RBI** exists in `STAT_DEPTH` (`RBI:4`) but has no `STATS`/`LANE_STAT` entry, so it never
  produces rungs today — wire it (`['RBI','rbi']`, `RBI:'RBI'`, add to `LANES`).

Because MLB has no accumulator, inject the derived keys at ingest:

- **`src/data/mlb.js`** — after assigning `rec.career`/`rec.season`/each `rec.split[…]`
  (the `st.type.displayName` block ~L80-90), call `deriveStats(stat)` mutating in
  `stat['1B'] = (hits||0)−(doubles||0)−(triples||0)−(homeRuns||0)` and
  `stat['XBH'] = (doubles||0)+(triples||0)+(homeRuns||0)` (guard nulls). Mirrors WNBA's
  `twoPM` injection.
- **`src/data/defaults.js`** — `STATS` gains `['1B','1B'],['XBH','XBH'],['RBI','rbi']`;
  `STAT_DEPTH` gains `'1B':3,'XBH':2` (keep `RBI:4`); `LANES` gains `'1B','XBH','RBI'`;
  `LANE_STAT` gains `'1B':'1B','XBH':'XBH','RBI':'RBI'`. `DEFAULT_LANES_ON` stays `['HR','TB']`
  (or add `1B`); **XBH deliberately excluded from the default-on set**.
- **`src/engine/patterns.js`** `STAT_KEY` (~L31) and **`src/engine/forecast.js`** `KEYS` +
  gradeForecast map — add `1B`, `XBH`, `RBI` (RBI field = `rbi`).

**Verify:** RefineBox chips render/toggle for `1B`/`XBH`/`RBI`; XBH starts off; picking each
filters batters and shows `season/career` rungs; unit tests lock `1B = H−2B−3B−HR` and
`XBH = 2B+3B+HR` on a sample.

---

## 2. Baseball-Reference batting totals table + clickable rung popups  ⟵ mirrors `f757c4d`

### Totals table — COUNTING STATS ONLY (Tony), placement differs from WNBA
WNBA put its bbref table *inside* the matchup panel, replacing the opposing-center
gematria. **For MLB, keep the opposing-pitcher panel** (§3) and instead put the **batter's**
totals table in the batter-card column (the `card-col` pattern from `3c7bc19`), under the
card. A pitcher's *batting* line is meaningless post-DH, so the table is the **batter,
Career + Season** only. **No pitcher pitching table** (Tony: doesn't care about ERA-type
stats).

- **Decision (Tony): counting stats only — DROP the rate columns** (BA/OBP/SLG/OPS). Final
  column set: **G, PA, AB, R, H, 1B, 2B, 3B, HR, RBI, TB, BB, SO, SB, CS, GDP, HBP, SH, SF,
  IBB** (add the new `1B`/`XBH` from §1 where wanted). All read straight off
  `p.career`/`p.season` — API fields `gamesPlayed, plateAppearances, atBats, runs, hits,
  doubles, triples, homeRuns, rbi, totalBases, baseOnBalls, strikeOuts, stolenBases,
  caughtStealing, groundIntoDoublePlay, hitByPitch, sacBunts, sacFlies, intentionalWalks`
  (+ derived `1B`/`XBH`). No rate cells to format; **every cell is a clickable `RungNum`.**
- Neutral theme text, monospace numerics, tight padding, static header — same visual spec
  as WNBA's `.totals`. Horizontal-scroll on desktop (§3).

### Clickable rung popups — MLB has no `engine/rungs.js`; create it
WNBA extracted `twoPM`, `rungOffsets`, `classifyRungs`, `INSTITUTIONAL_TABLE` into
`engine/rungs.js`. **MLB has no such module** (staircase logic is inlined in `store.jsx`).
Create `apps/mlb/src/engine/rungs.js` with:

- `deriveStats` (1B/XBH from §1).
- `rungOffsets(stat, value)` — same magnitude-scaled ladder as WNBA, with the small
  counting stats (`HR, 2B, 3B, 1B, XBH, CS, SB`) getting the tight `+1..8` tick (like
  3PM/2PM), and thousands-scale career stats (`H, TB, AB, PA, SO, RBI, BB`) getting the
  `+25/50/100/250` steps.
- `classifyRungs(stat, value, {loaded})` — identical to WNBA.

**Institutional = editable core vocab, NOT a hardcoded number list (Tony's decision #3).**
Do **not** port WNBA's frozen `INSTITUTIONAL_TABLE` array. Instead, a rung is flagged
"institutional/spine" when its value matches an **enabled Core-table word** — which already
flows through the `loaded` map as `cat:'core'`. This makes the set fully **editable in the
Vocab tab** and sport-appropriate. Concretely: the popup's institutional tag = "this value
hits an enabled core word" (reuse the existing `cat:'core'` loaded hits). Seed
`CORE_WORDS_MLB` keeps the Jesuit/Masonic words (`JESUIT ORDER, SOCIETY OF JESUS, FREEMASON,
FREEMASONRY, SCOTTISH RITE`), keeps/adds the **Kabbalah**-related words Tony wants, and keeps
the baseball words (`BASEBALL, MLB, MAJOR LEAGUE BASEBALL`) — all editable/toggleable/
deletable via the existing Core-table editor (`Vocab.jsx`). (Same treatment should later
backport to WNBA to replace its hardcoded table, but that's out of scope here.)

Then port `RungNum` + `NumPopup` into MLB `Board.jsx` and make the card rung-rows and every
totals-table cell a `RungNum` (popover shows `value+N` ladder vs the loaded
date/thread/theme/**core** spine, colored via `colorFor`).

**Verify:** tap a rung/cell → ladder popover with DN/thread/core flags in the board's own
colors; adding a word in Vocab makes new values light up as institutional; dismiss on
outside-click/✕. Unit-test `rungOffsets` ranges + `classifyRungs`.

---

## 3. Desktop h-scroll + rung-click feedback  ⟵ mirrors `ab9604f`  (KEEP the pitcher)

- **`useHScroll`** — port the callback-ref wheel→horizontal helper verbatim into MLB
  `Board.jsx`; attach to the chip rails (`GameRail`, `ContextRail`) and the new totals
  table `.totals-wrap`. Add the `(pointer:fine)` visible-scrollbar CSS block.
- **Rung-click feedback** — the `.active` highlight on the tapped `RungNum` + selectable
  popover rows: comes for free with the `RungNum`/`NumPopup` port.
- **Opposing pitcher: DO NOT DROP.** This is the one place the WNBA change must *not* be
  mirrored. WNBA dropped the opposing center because it was noise; the MLB opposing
  **pitcher** (name-run gematria driving K/first-pitch props, venue splits, CROSS rows,
  team staircases) is the core of baseball prop analysis. Keep `MatchupPanel` as-is and
  just make its numbers clickable (§5). The batter totals table lives in the card column,
  not in place of the pitcher.

---

## 4. Context-chip click highlights the matching rung on the card  ⟵ mirrors `c3d92d5`

Clean port. In `BatterCard`: when `contextFilter` is set, sort rungs landing on that number
first, give the row a `.flt` blue ring + `◈ CHIP` badge. `contextFilter` already exists in
the MLB store; no new state.

---

## 5. More clickable numbers (number facts) + week-of-life  ⟵ mirrors `752a08d` + `3c7bc19`

Port `FactNum` (span-based, `stopPropagation`) + `NumPopup` (needs `engine/rungs.js` from §2
for `INSTITUTIONAL_TABLE`; MLB already has `engine/numbers.js` for `isPrime/primeIndex/
compositeIndex/nthPrime/nthComposite/chainBase/chainMembers`). Wrap in `FactNum`:

- **Batter bday line** — since / until / age / day-of-life, **and add the `week N` figure**
  (already computed in the store's `bdayNums`, just not displayed — same gap WNBA had).
- **Date-spine figures** in `DateStrip` (the `v-cyan` values).
- **Day-of-season** ("Day N"), the **team game #s** (`game #{away}/{home}`).
- **Jersey #** on the batter card.
- **Context-chip values** in `ContextRail` (`<span className="n">` → `FactNum`).
- Pitcher's numbers in `MatchupPanel` (name-run values, splits) — optional but consistent.

**H2H — port from Tony's MLB Date Decoder (§8).** Once the H2H data + chips land (§8), the
H2H game # / series-wins numbers become `FactNum`s too, same as WNBA's DateStrip H2H #.

---

## 6. Pattern-hits panel (pills + names)  ⟵ mirrors `3c7bc19`

Clean port — MLB already carries `patternHits` on `board` rows and has `patternCounts`.

- Add `patternFilter`/`setPatternFilter` to the store (sibling of `contextFilter`); extend
  `BatterZone`'s dim logic to union both filters.
- Wrap `BatterCard` in a `card-col` div; render `<PatternHitsPanel/>` below it (the empty
  space between the card and the matchup/totals content).
- Panel = filter pills (pattern name + this-game count, tap dims non-hitters, slate-wide
  `patternCounts` as sub-badge) + tap-through names list (first 4 hitters w/ team abbrev,
  `+N more` expands; tap → `setSide` + `setBatterId`). Hidden when no pattern hits the game.

---

## 7. Slate persistence — instant rehydrate, manual refresh  ⟵ mirrors `3c7bc19`

Clean port; the MLB slate fetch is also heavy (career + home/away splits for ~50 batters and
both probable pitchers via statsapi) and today reloads on every mount.

- **`src/data/storage.js`** — add `saveSlateCache`/`loadSlateCache`/`isSlateCacheValid`
  (`cvg.slateCache`, schema `cvg-slateCache/v1`, `{date,savedAt,slate,seasonInfo}`, 4 MB
  size-guard + fail-soft), and exclude `cvg.slateCache` from `exportConfig`.
- **`src/state/store.jsx`** — seed `slate`/`seasonInfo`/`gamePk`/`slateSavedAt` from
  `loadSlateCache(date)` in the `useState` initializers; mount effect becomes
  `if(!cachedSlate)refresh()` (manual-only policy Tony chose); write-through
  `useEffect(()=>{if(slate)saveSlateCache(date,slate,seasonInfo)},[slate,seasonInfo,date])`
  (covers `refresh` **and** the ⚡ deep mutation); export `slateSavedAt`.
- **`src/tabs/Board.jsx`** — `FreshnessBanner` ("slate cached from HH:MM · tap to refresh").
- MLB is actually *simpler* to cache than WNBA: no `h2hFor`-style render-time function reads
  a deep nested structure — `matchup` reads `slate.people[spId]` and `slate.teamStats`, both
  plainly serializable. Everything the board renders survives JSON round-trip.

**Verify:** cold load writes cache; reload → board paints instantly with **zero** statsapi
requests; freshness banner shows; tap → refresh while board stays up. Unit-test
`isSlateCacheValid`.

---

## N/A or collapses to a one-line check (do NOT port)

- **`3ab457b` bbref Regular-Season parity + pagination fix** — **N/A.** The Stats API returns
  official regular-season `career`/`season` totals; spring training / postseason are *separate*
  stat types (`springTraining`, `postSeason`) the app never requests. Baseball-Reference uses
  the same official source, so totals already match. No `gamefilter.js`, no accumulator, no
  pagination guard. **Only check:** confirm the batter totals table reads `type=[season]`/
  `[career]` (it does) — nothing to filter.
- **`20d1626` game #s + 2026 Cup final** — **mostly N/A.** No Commissioner's Cup in MLB. The
  team game # comes from the schedule; **one check:** ensure the game-# source counts
  regular-season games only (a March spring-training game shouldn't inflate it — verify against
  `mlb.js` schedule/gameType).
- **`f86f5a2` de-MLB phrase tokens** — **N/A** (this was fixing MLB *leftovers in WNBA*). MLB's
  tokens `{batter…}/{opp pitcher}/{stadium}` and the `HOME RUN` default are already correct.
  **But port the two copy fixes:** SettingsSheet.jsx:28 still says *"WNBA profile ships later —
  schema ready"* (stale — WNBA shipped; change to "active — ciphers & vocab scoped to this
  profile"), and Vocab.jsx:130 still says the phrase template *"resolves … (pattern source,
  Phase 2)"* (Phase 2 shipped; point it at the Patterns "phrase template" source). Optionally
  add the self-documenting Config-panel copy (what config.json / day log actually are).

---

## 8. H2H — port from Tony's "MLB Date Decoder" tool  ⟵ new for MLB  ✅ decided

**Decision (Tony):** MLB already has all-team H2H in a separate tool
(`https://deluxe-tulumba-433821.netlify.app/`, "MLB Date Decoder"). Port that data in.

What the tool shows (verified 2026-07-16): per team-pair **all-time** counts — total games,
each team's **W / L / T** (baseball has ties), **home/away splits**
(e.g. *"NYM vs PHI: 1100 games · NYM 534W 565L 1T · NYM home 276W 271L · away 258W 294L"*),
plus franchise-origin/relocation, stadium, and state-admission dates.

**Corrected finding (2026-07-16): the tool has NO stored dataset.** The page is a single
43 KB HTML with one inline script; H2H counts are **computed live from statsapi** when the
user taps RECOUNT (the "counting 1910… N total" progress text is the crawl). Tony's TXT
exports prove it: only pairs he recounted carry numbers — the 2026-07-17 export shows `…`
for every H2H section, while 2026-07-16 has the computed NYM/PHI line.

**Port path — one-time crawl script (mirrors how `wnba-h2h.json` was generated):**
Write `scripts/build-mlb-h2h.mjs`: for each season (1901→current; extend to 1876 if statsapi
coverage holds), `GET statsapi.mlb.com/api/v1/schedule?sportId=1&season=YYYY&gameTypes=R`
(one call per season), aggregate **Final** games per team-pair: games, wins per side, **ties**
(equal final score — they exist historically), **home/away W-L per side**, first/last meeting
dates. ~125 requests total, minutes of runtime, run once + re-run occasionally to top up.
- **Lineage caveat to verify in the script:** the decoder counts franchise-continuously
  (WSH totals include the Expos era — "Franchise origin (Montreal Expos)… 9094 total" ✓).
  Confirm statsapi historical schedules use the same franchise-stable team ids; if not, add
  an id-mapping table for relocations (MON→WSH, Browns→BAL, etc.).

**Verification fixtures — Tony's exports, saved at `data/decoder-exports/`:**
- `date-decode-2026-07-16.txt`: **NYM|PHI = 1100 games · NYM 534 W / 565 L / 1 T ·
  NYM home 276-271 · away 258-294** (through 2026-07-16, end date excluded). The built
  json's NYM|PHI pair must reproduce these exactly.
- `date-decode-2026-07-17.txt`: all-time **team totals** for ~28 franchises (e.g. PHI
  19532 total · 9144 W · 10312 L · 76 T, home/away splits) — cross-check: each team's
  pair-records must sum to its all-time totals.

**Target schema — mirror `data/wnba-h2h.json`** (`{meta, lineage, pairs}`) with MLB tweaks:
- MLB franchises are stable → the `lineage` map can be a simple `abbrev → {id:abbrev,
  identities:[current name]}` (a few relocations like MON→WSH, MON/Expos, etc. can list two
  identities). Pair key = the two current abbrevs sorted (`NYM|PHI`).
- `pairs[key].regularSeason = {games, wins:{A,B}, ties, home:{A:{W,L}}, away:{…}, firstMeeting}`
  — **add `ties` and the home/away splits** the tool provides (WNBA's schema lacks both).
- (Franchise/stadium/state dates from the tool are OUT of scope unless Tony wants them; the
  app's own clock engine already computes durations, so only the raw *dates* would be needed.)

**Wiring (mirror WNBA):**
- Add a static MLB team table (abbrev ↔ statsapi id ↔ lineage) so `fetchSlate` can stamp
  `game.home.lineage`/`away.lineage` (statsapi gives the abbrev; map to lineage). WNBA does
  this in `WNBA_TEAMS`.
- Add `h2hFor(game, dstr)` to `mlb.js` (port from `wnba.js:316`): look up the pair, compute
  all-time meeting #, series W/L, days-since-first — plus a **live current-season top-up** if
  the schedule exposes prior meetings (MLB schedule can be queried per team-pair; optional).
- Store: emit H2H chips in `contextChips` (the `h2h` color slot already exists in
  `ContextRail`) and an H2H line in `DateStrip` (meeting #, series record), all `FactNum`s.

**Verify:** load a game, H2H chip shows the correct all-time meeting # and series W/L against
the tool's numbers for that pair; the number is clickable (facts); ties handled.

---

## Resolved decisions (Tony, 2026-07-15)

1. **Totals table** — batter counting stats ONLY. No pitcher pitching table; **drop the
   BA/OBP/SLG/OPS rate columns.**
2. **New lanes** — add **1B** (default on) and **XBH** (available but **off by default**,
   toggled via its RefineBox chip). **Wire RBI** as a real lane.
3. **Institutional table** — **not** a hardcoded number list; drive it from the **editable
   Core-table vocab** (keep Jesuit/Masonic + Kabbalah words, keep baseball words, all
   editable in the Vocab tab). A rung is "institutional" when it hits an enabled core word.
4. **H2H** — port from Tony's MLB Date Decoder tool (§8); Tony can also upload a JSON export.

## Suggested commit sequence (each builds + tests + pushes for Netlify, same flow as WNBA)

1. `engine/rungs.js` (deriveStats 1B/XBH + rungOffsets + classifyRungs) + 1B/XBH/RBI lane wiring + unit tests.
2. BBRef batter counting-stats totals table in the card column + clickable RungNum/NumPopup (institutional flag from core vocab).
3. useHScroll + desktop scrollbars + rung-click feedback.
4. FactNum number-facts on bday line (+week), date spine, day-of-season, game #s, jersey, context chips.
5. context-chip → rung highlight on card.
6. pattern-hits panel (pills + names) + patternFilter.
7. slate persistence + freshness banner.
8. H2H port — run `scripts/build-mlb-h2h.mjs` (statsapi crawl → data/mlb-h2h.json, verify vs
   `data/decoder-exports/` fixtures), then team table + h2hFor + H2H chips/DateStrip.
9. copy fixes (Settings "ships later", Vocab "Phase 2").
