# MLB convergence — pattern-recipe phase (planned 2026-07-16)

Goal: make Zach-style prop lines writable as pattern recipes, **precisely and fast**.
Decision (Tony): keep the current condition-grammar engine — extend its vocabulary
(Phase 1) and reverse the authoring flow (Phase 2). No redesign.

**Acceptance test — the Bryson Stott post (2026-07-16).** Every leg below must be
expressible as a recipe condition when Phase 1 lands:

1. "Looking for 57th career HR, with 168 days left in the year. Mets=57 & New York Mets=168."
2. "Looking for 31st career HR at home and Homerun Eight=31, on the season, 31 days after
   the Pitcher's birthday."
3. "Bryson Stott Homerun=83… playing 23 days after his last HR. 83=23rd prime."

---

## ⚠ Key design: "Homerun Eight = 31" is a SPELLED COUNTER, not a phrase

Verified against the engine (ciphers: Ord, Red, Rev, RR, Sat, Chal, Sept, Latin):

| claim                    | engine                                | status |
|--------------------------|---------------------------------------|--------|
| Mets = 57                | 57 Ord                                | ✓ |
| New York Mets = 168      | 168 Ord                               | ✓ |
| Homerun Eight = 31       | 143 Ord / 71 Red / … — **no 31**      | ✗ as a phrase |
| **EIGHT = 31**           | **31 Red**                            | ✓ — confirmed by Tony: the spelled number ALONE |
| Bryson Stott Homerun = 83| 83 Red                                | ✓ |
| 83 = 23rd prime          | `primeIndex(83) = 23`                 | ✓ |

So Zach's convention: take a counter's value (season HR count next = 8), **spell it**
("EIGHT"), run the ciphers, and match the result against another counter (career-home
HR rung → 31). The app has **no number-spelling anywhere** (checked `apps/mlb`,
`packages/`, `convergence-scanner-v2.html`) and no way for a source to reference a
counter. That is the grammar extension at the heart of Phase 1 (§2).

Leg-to-grammar map once Phase 1 lands:

- Leg 1: `career HR rung +1 = oppTeam` (§3 makes 168 reachable) AND `dateFig = oppTeam` (§6).
- Leg 2: `career HR rung +1 (venue·home) = numberWord(season HR rung)` (§1+§2)
  AND `oppPitcherClock = <same 31>` (§4).
- Leg 3: `sinceLast:HR = prime# of template("{batter full}" + HOMERUN)` (§5; template
  source + primeIdx rmod already exist).

---

# Phase 1 — engine vocabulary (one commit per section)

## 1. `numberToWords()` helper

**`src/engine/numbers.js`** (30 lines today) gains `numberToWords(n)` → uppercase
cardinal, **no hyphens, no "AND"** (Zach convention): `8→'EIGHT'`, `31→'THIRTY ONE'`,
`57→'FIFTY SEVEN'`, `168→'ONE HUNDRED SIXTY EIGHT'`. Range 0–9999 (career PA tops out
~15k for legends; clamp → `''` beyond range, condition just resolves empty). Letters
only, so `calcAll()` works on the output unchanged.

**Verify:** unit tests for 0, 8, 13, 31, 40, 57, 100, 168, 197, 1000, 2026;
`calcAll('EIGHT').Red === 31` locked as a fixture.

## 2. `numberWord` source — a counter reference on the right-hand side

**`src/engine/patterns.js`:**

- `SOURCES` (~L24) gains `{id:'numberWord',label:'spelled counter'}`.
- `sourceArg` for this source is an **object** `{counter,scope,off}` (persistence is
  JSON localStorage — fine; `summarizeCondition` and the editor must handle non-string
  args). Reuses the same vocabulary as the left side.
- `resolveSource` (~L95): for `numberWord`, call `resolveCounter({counter:arg.counter,
  scope:arg.scope, counterArg:{off:arg.off||1}}, ctx)`, then for each candidate
  `{n,label}` emit every enabled cipher of `numberToWords(n)`:
  `{n:cipherVal, label:\`\${numberToWords(n)} \${cipher} \${cipherVal} (\${label})\`}` —
  so a match card reads `EIGHT Red 31 (season HR 7+1)`, exactly like the worksheet.
  Cap referenced candidates (rung off-window already bounds this).

**`src/tabs/Patterns.jsx`** editor: when `c.source==='numberWord'`, render three extra
selects (counter / scope / off-window) mirroring the left-side controls, writing the
object `sourceArg`.

**Verify:** synthetic-ctx test — batter with `split['career-home'].homeRuns=30`,
`season.homeRuns=7`; condition `rung:HR +1 venue = numberWord(rung:HR season +1)` must
pass with match `{n:31, right:'EIGHT Red 31 …'}`.

## 3. `oppTeam` / `team` sources: all name variants

**Gap found:** `ctx.oppTeamName` (store.jsx:157) is `teamName` only — the nickname.
So `oppTeam` says `Mets=57` but can never say `New York Mets=168`, while the *loaded*
map (store.jsx:119) already indexes `[t.name, t.teamName, t.locationName]`.

- **`src/state/store.jsx`** patternSources ctx (~L156-178): pass
  `teamNames`/`oppTeamNames` arrays built the same way (`name`, `teamName`,
  `locationName`, deduped; slate `tmap` has all three).
- **`src/engine/patterns.js`** `resolveSource`: `oppTeam`/`team` flatMap `enabledVals`
  over the array. Keep the old single-string fields working for one release (fallback)
  so saved patterns don't break mid-session.

**Verify:** test with names `['Mets','New York Mets']` → source contains both 57 and 168.

## 4. `oppPitcherClock` counter

The store already computes the probable pitcher's clock (`spBday`, store.jsx:482) but
only inside the matchup panel — the grammar can't see it.

- **`src/state/store.jsx`**: in the patternSources ctx, resolve the batter's opposing
  SP (same logic as matchup: `batSide==='away'?game.homeSP:game.awaySP`) and attach
  `ctx.oppPitcherClock = [{n:since,label:'Nd after SP bday'},{n:until,…},{n:age,…},
  {n:age+1,…}]` from `clockFrom(sp.birthDate,date)`.
- **`src/engine/patterns.js`**: `COUNTERS` gains `{id:'oppPitcherClock',label:'opp SP
  birthday clock'}`; `resolveCounter` returns `ctx.oppPitcherClock||[]`; add to
  `DATE_COUNTERS` (it moves daily → feeds Forecast).

**Verify:** Stott leg 2b — SP birthday 31 days before game date → counter emits 31.

## 5. `sinceLast:HR` counter (deep-fetch tier)

"Playing 23 days after his last HR" needs the batter's last-HR date. The season
`gameLog` endpoint is already used by **`src/engine/forecast.js:96`** — same fetch,
new consumer. Per-batter fetches are expensive → **join the DEEP tier** (the existing
`deepFetch` button), not the base slate load.

- **`src/data/mlb.js` / store `deepFetch`**: for each roster batter, pull
  `stats=gameLog&group=hitting`, scan backwards for the last game with
  `homeRuns>0` (also capture `hits>0`, `doubles>0`… while there — one fetch, all
  lanes), store `p.deep.lastEvent={HR:'2026-06-23',H:…,…}`.
- **`src/engine/patterns.js`**: `COUNTERS` gains `{id:'sinceLast:HR',label:'days since
  last HR'}` (+ H/2B/3B if free); `resolveCounter` → `daysBetween(lastEvent[stat],
  ctx.date)`; label `'23d since last HR'`. Add to `DATE_COUNTERS`.
- **Forecast bonus:** for a future date d the projection is exact —
  `daysBetween(lastEvent, d)` — no accrual model needed.

**Verify:** synthetic `lastEvent.HR` 23 days back → counter emits 23; combined with
`rmod:'primeIdx'` + template `{batter full}+HOMERUN` (=83 Red) the full leg-3 condition
passes.

## 6. Split `dn` → precise `dateFig` counter

`dn` dumps the full ~20-value numerology map (store.jsx:108) — it matches almost
anything, so recipes built on it carry no evidence weight. Keep it, but add the
precise set:

- **`src/engine/patterns.js`**: `COUNTERS` gains `{id:'dateFig',label:'date figures
  (5 formulas + DOY + left)'}`; `resolveCounter` maps `dateFigures(ctx.date)` (from
  `engine/clocks.js`, shipped 8068832) → 7 values with their calc labels. Add to
  `DATE_COUNTERS`. `dn` stays for the wide net.

**Verify:** for 2026-07-16 the counter emits exactly {69,33,24,49,22,197,168};
`dateFig = oppTeam` passes vs the Mets on 168 (leg 1b) once §3 lands.

## 7. Stott acceptance test + example recipe

- **`tests/engine.test.mjs`**: end-to-end `evalPattern` fixture — synthetic batter
  (career HR 56, career-home HR 30, season HR 7, last HR 23d back, opp
  `['Mets','New York Mets']`, SP bday 31d back, date 2026-07-16) against the 3-leg
  recipe; assert match + the exact match labels.
- Ship the recipe in the pattern library as a **disabled example** named
  `MILESTONE SPELL (Stott ex.)` — not force-enabled like seeds; it's documentation
  you can open in the editor.

---

## 7b. Addendum (shipped with Phase 1) — the Brett Baty line, 2026-07-16

Second acceptance post from Tony exposed three more vocabulary gaps, all shipped:

- **`rung:G`** (games played) — "58th July game / 35th game vs PHI / 44th Thursday
  game" are games-played counters; `gamesPlayed` was in every split object but
  unmapped. **Excluded from the `rung:*` wildcard** so NAME LOCK et al keep their
  pre-existing hit counts.
- **`counterRef` source** — raw counter-vs-counter (numberWord without the spelling):
  `rung:G dow = comp# of counterRef(sinceLast:HR)` expresses "44th Thursday game,
  63d since his last, 63-44c".
- **`jersey` source** — "next hr 7 = #7".

Verified fixtures: Brett Baty 58 RR · Philadelphia 101 Ord = 26th prime ·
35 = 23rd composite (23 = 7+16) · 63 = 44th composite. Ships disabled as
**COMPOSITE WEB (Baty ex.)**; locked end-to-end in tests (2/2 hard + 3/3 soft).

---

# Phase 2 — reverse the authoring flow (separate session)

## 8. Tap-to-recipe drawer

The board already computes the evidence; authoring should start there.

- Long-press / `⊕` affordance on: batter-card **rung rows**, **PRIMARY/ALT call
  lines**, and matchup **CROSS rows**. Tapping infers a draft condition: counter =
  the row's stat/scope/off; source guessed from the hit's `cat`
  (`core→core, date→dateFig, theme→theme, bday→ownName-age, h2h→dateThread`).
- Drafts accumulate in a sticky bottom **recipe drawer** (chip per condition, × to
  drop, hard/soft toggle). "Save as pattern" → opens the existing editor pre-filled
  (editor stays the source of truth; the drawer is only a collector).

## 9. Editor preview: pick the batter

`previewPattern` previews against the currently selected batter only. Add a batter
select to the editor preview line (defaults to current selection) — building from a
blog line means the target batter usually isn't the one selected.

*(Already shipped, this session: pattern tiles get the context-chip selection
treatment — `6837b0e`.)*

---

## N/A / non-goals

- **No engine redesign** — `evalPattern`/hard-soft/lane routing untouched.
- **No Zach-post text parser** (Phase 3 candidate; revisit after 1+2 show the shapes).
- **No ordinal spelling** ("FIFTY SEVENTH") until a real line needs it — cardinal only.
- **WNBA**: nothing here ports until Tony asks; WNBA has no pattern engine divergence
  today, but §1-§6 are engine-file-local and would port mechanically.

## Ship flow

Per section: `npm run test:mlb` → `npm run build:mlb` → commit → push (Netlify:
https://mlb-convergence-board.netlify.app). Tests before UI; every new counter/source
lands with its fixture in the same commit.
