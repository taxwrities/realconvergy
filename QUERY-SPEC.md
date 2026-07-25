# QUERY-SPEC.md — Slate Query Engine ("Daily Matches")
*Claude Code handoff spec. Read fully before writing any code. This is a NEW PAGE inside the existing MLB convergence app deploy — not a new site, not a rewrite of existing tabs.*

---

## 0. PRIME DIRECTIVE — INGREDIENTS, NOT RECIPES

**The app computes; Tony judges.** This principle overrides every instinct to be "smart":

- NO hidden scoring, NO opinionated ranking, NO quality tiers unless Tony authors them.
- NO match filtered out that Tony didn't filter out. If a match type is enabled, every hit renders — even ones that look like noise.
- All defaults are NEUTRAL. Sort default = match count (dumb). Dedupe of sibling ciphers (Reduction vs Single Reduction) = a visible toggle, default OFF (both show).
- Every knob visible and user-controlled. Weighting, if added later, is user-authored per preset — the engine ships with dials, never opinions.
- Skip-gate, ranker weights, and house scoring live in OTHER tools. This page is the raw instrument panel.

If a feature decision isn't covered by this spec, choose the option that gives Tony more control and shows more, not less.

---

## 1. VERSION SAFETY — DO THIS BEFORE ANY CODE

Tony needs the current site recoverable at all times.

1. In the repo, tag current state: `git tag pre-query-v1 && git push --tags` (or commit + tag if uncommitted work exists).
2. Copy the current deployed `index.html` (and any sibling files) into `archive/2026-07-25-pre-query/` in the repo, committed. Belt and suspenders — the tag is the real backup, the folder is the "I can see it" backup.
3. Netlify itself keeps deploy history (Deploys tab → any previous deploy → "Publish deploy" restores it instantly). Note this in the final handoff message to Tony so he knows the third recovery path exists.
4. NEVER modify the existing four-tab app files in this build except to add one nav link to the new page. Surgical rule applies: no working feature removed or altered.

---

## 2. WHAT THIS IS

A query assembler → slate-wide scanner → evidence-card results grid, modeled on a reference site Tony likes, merged with data layers the reference site lacks.

Three stages:

1. **ASSEMBLE** — left rail + config dialogs build a query: which match types, which ciphers, which date calcs, which stats and modes, which value sources.
2. **SCAN** — one button runs the query over the full slate (or one player) for the chosen date. Pure client-side computation over cached slate data.
3. **RESULTS** — evidence cards: counter-grouped, claim + receipt per line, silence for non-hits. Tony filters/tightens until it looks right. Filtering IS the analysis.

Out of scope for this build (explicitly deferred, do not build, do not preclude): freeze/backlog/grading/logging (state must auto-persist so this can be wired later — never throw away state), theme features beyond phrase presets, live in-game anything, WNBA live data (phantom only), commercial multi-user features.

---

## 3. FILE + DEPLOY STRUCTURE

- New file: `query.html` — single-file HTML/CSS/JS, same discipline as all Tony's tools. Sits NEXT TO the existing app's `index.html` in the same Netlify deploy folder. One drag-drop deploys both.
- Existing app gets ONE addition: a nav link/button to `query.html` (and `query.html` links back). Nothing else in the existing app changes.
- Shared logic: if `gematria-core` exists as an importable module in this repo, use it. If the app is plain single-file HTML with inline engines, EMBED the engine in query.html (copy, don't refactor the old app) — extraction to a shared module is a later phase, not this one.
- `node --check` on all JS before delivery. Headless render test (jsdom) confirming cards render from stub data.

---

## 4. ARCHITECTURE — FETCH ONCE, COMPUTE FOREVER

**Daily cache + client compute.** The expensive thing is fetching; the cheap thing is computing. Never conflate them.

### 4.1 Slate cache
- On load (or "refresh slate" tap): fetch today's slate from MLB statsapi (free, no auth): schedule → games → probable pitchers → lineups when posted → rosters → per-player season + career stats (entering stats) → DOBs → jersey numbers → team season totals.
- Normalize into ONE slate object (schema §4.3). Persist to localStorage with fetch timestamp. Banner shows "slate cached from HH:MM · tap to refresh" (pattern already exists in the app — reuse it).
- Every query/filter/toggle change re-runs COMPUTATION ONLY against the cached slate. No network on knob turns. Target: full-slate scan re-render < 1s on mobile.
- statsapi rules from house knowledge: use `team.name` full names for matching, `CHW` not `CWS`, entering stats = totals BEFORE today's game.

### 4.2 Sport adapters
- The engine reads a normalized slate; it never calls sport APIs directly.
- `adapters/mlb` (inline function namespace is fine in single-file): statsapi → slate object. LIVE.
- `adapters/wnba`: PHANTOM. Stub returning empty slate + "coming soon" state in the UI when WNBA is selected in the sport dropdown. File/namespace contains a TODO block documenting the known BDL conventions so wiring is mechanical: base path `/wnba/v1/`, raw API key in Authorization header (NO Bearer prefix), GOAT tier, `player_season_stats` = per-game averages, career totals = sum across `season_type=2` rows, key must be proxied via Netlify function (`netlify.toml` at root with `directory = "functions"` and `node_bundler = "none"`) before any public deploy.
- Sport selection swaps the adapter AND the cipher/vocab profile (§6.4). NFL is a future third adapter — leave the dropdown structured to accept it, build nothing.

### 4.3 Slate object schema (normalize to exactly this)
```
slate = {
  sport: "mlb",
  date: "2026-07-25",
  fetchedAt: ISO,
  games: [{ gameId, away: teamRef, home: teamRef, venue, probables: {away: playerId, home: playerId} }],
  teams: { [teamId]: { id, fullName, city, nickname, abbr,
                       seasonTotals: { R, H, HR, TB, AB, PA, SO, BB, ... } } },
  players: { [playerId]: {
      id, fullName, firstName, lastName, teamId, gameId, oppTeamId,
      pos, isPitcher, isBatter,           // two-way = both true
      jersey, dob: "YYYY-MM-DD",
      batting:  { season: {G,AB,PA,H,2B,3B,HR,R,RBI,BB,SO,TB}, career: {...} },
      pitching: { season: {G,GS,W,L,IP,SO,BB,H,HR}, career: {...} }
  }}
}
```
Missing data = null, never fabricated. A player with no DOB simply produces no age/span matches — no error, no placeholder.

### 4.4 Static data layers (bundled or fetched from repo raw URLs, cached same as slate)
- `data/founders.json` + `data/decoder-exports/founders-locked.json` from the realconvergy repo — the founders/historian layer. ONLY `date_status === "locked"` entries with a source URL participate in span math (this is already enforced by the locked export — consume that file). Respect `granularity`: year-only entries are excluded from day-span calculations.
- Existing vocab/phrase data if present in the app's localStorage — read, don't duplicate.

---

## 5. THE QUERY RAIL (left side desktop / top sheet mobile)

Mobile-first (Tony works on a phone). Rail collapses to a sticky summary bar + expandable sheet on mobile.

Top to bottom:
1. **Sport** — dropdown: MLB (active) · WNBA (phantom, selectable, shows stub state) · [structure ready for NFL].
2. **Filter Presets** — save current ENTIRE query config under a name; load; delete. Presets are PER-SPORT (cipher scoping differs by league — a preset saved under MLB never loads under WNBA). Stored in localStorage. A preset captures: match types + all dialog configs + cipher selection + position filter + game filter + card display config + sort choice.
3. **Search Mode** — `Daily Matches` (whole slate) | `Individual` (typeahead over slate players; runs the same query for one player).
4. **Analysis Date** — date input + prev/next arrows + Today button. Changing date refetches the slate for that date. **Known boundary, render it honestly:** for past dates, statsapi lineups/probables resolve, but player "entering stats" are CURRENT stats, not stats-as-of-that-date. Show a warning chip on non-today dates: "⚠ stats shown are current, not as-of this date." True historical snapshots = future phase requiring a stat store. Do not fake it.
5. **Match Type Filter** — summary line ("N types selected") opening the Match Types dialog (§6.1).
6. **Cipher Selection** — summary line opening the cipher dialog (§6.2).
7. **Position Filter** — All · Batters only · Pitchers only. (Two-way players appear under both.)
8. **Game Filter** — All games · multi-select of today's games.
9. **RUN button** — "Find All Daily Matches" / "Analyze Player". Big, purple, unmissable.

All rail state auto-persists to localStorage on every change (no save buttons — house rule). Restore on load.

---

## 6. CONFIG DIALOGS

Model the reference site's pattern: a master Match Types dialog with per-engine Configure buttons, plus simple checkbox sources.

### 6.1 Match Types (master dialog)
Select All / Clear All. Two classes of entries:

**Configurable engines** (checkbox + Configure button each):
- Custom Matching (§6.5)
- Date Matching (§6.6)
- Player Total Age (§6.7)
- Stat Matching (§6.8)
- **Founders & Spans (§6.9) — NEW, not on the reference site**
- **Career Clocks (§6.10) — NEW, not on the reference site**

**Simple sources** (checkbox only — each contributes its gematria values to the match pool):
- Player Full Name · Player First Name · Player Last Name
- Team Full Name · Team Location · Team Mascot
- Opponent Full Name · Opponent Location · Opponent Mascot
- Jersey Number (raw number as a value source; also "Jersey Birthday Match" = jersey equals DOB day/month figures)
- **Team Totals (§6.11) — NEW**

### 6.2 Cipher Selection
Grid of toggle cards, one per cipher, each rendered in its signature color (same color used for that cipher's ink on result cards). Buttons: **Select Base** (the sport profile's default set) · Select All · Clear All.

Cipher list = everything gematria-core supports: Ordinal, Reduction, Reverse Ordinal, Reverse Reduction, Satanic, Reverse Satanic, Chaldean, Septenary, Latin/Jewish, plus any additional ciphers already implemented in the app's engine. DO NOT invent cipher variants that aren't in Tony's engine (the reference site runs 27 including Fibonacci/Sumerian/Trigonal — implement only what gematria-core actually computes; add a commented extension point).

Per-sport Base defaults (house rules):
- MLB: Ord, Red, Rev, RR core; Satanic available as auxiliary; Chaldean available but NOT in Base.
- WNBA (when live): Satanic default ON, Chaldean default ON, MLB core table values banned.

### 6.3 Sibling-cipher dedupe toggle
Visible toggle in the cipher dialog: "Collapse identical sibling values" — when a word produces the same value in cipher pairs (e.g. Reduction / Single Reduction variants), show once with combined label vs. show both lines. DEFAULT OFF (show both). Tony controls the noise; the app doesn't.

### 6.4 Sport profiles
Per-sport config object: base cipher set, vocab/core table reference, banned tables. MLB profile enforces "no basketball table values"; WNBA profile (phantom) documents its rules for later. Cross-sport table leakage is a bug, not a feature.

### 6.5 Custom Matching (Configure)
Two sections, exactly like the reference:
- **Direct Phrase Matching** — free list of phrases (add/remove rows). Every phrase is computed in all selected ciphers and its values join the match pool against every enabled target (spans, ages, stats, date calcs). This is where the day's theme lives ("Kobe Bryant Dies In Helicopter Crash In California" is just a phrase). Phrases persist; presets capture them — so a saved preset IS a saved theme.
- **Enhanced Match Type Filtering** — composition grid: append custom words to structural fields (Player First Name + "triples" → computes `"{firstName} triples"` per player at scan time). Fields: player full/first/last, team full/location/mascot, opponent full/location/mascot. This is the app's existing phrase-template concept ({batter first} + stat word) as UI.

### 6.6 Date Matching (Configure)
Two match directions (checkboxes, both can be on):
- Names/phrases whose gematria = date calculations. Sub-select which name pools participate (full/first/last/custom phrases).
- Birthday timespan values = date calculations.

Then **every date formula as an individual checkbox with today's computed value inline** (recompute on analysis-date change). Formula set = Tony's spine, from the thread-builder + ranker (implement exactly, no inventions):
- Day of Year · Days Left in Year
- M+DD+CC+YY (full) · M+DD+Y-digit-sum · all-digit sum · M+DD+(YYYY−2000) · Mdig+Ddig+YYdig · Mdig+Ddig+YY+CC · Mdig+Ddig+(YYYY−2000) · M+DD · DD (day of month)
- Day-of-month Nth prime · Nth composite
- Date concatenations (e.g. 7/25 → 725, 25/7 → 257)
- Day name + ruling planet gematria values (per selected ciphers)

### 6.7 Player Total Age (Configure)
- Global toggle: **End date included** (+1 day to all span/age counts) — the inclusive/exclusive convention as one switch.
- Match sources × targets grid like the reference: Total Age in Weeks / in Months (and total days), each matchable against: names, custom phrases, date calcs. Each lane has **Exact match only** (off = rounded/floor match allowed, on = exact).
- Birthday spans: days after last birthday · days before next birthday — matchable against the same target pools.

### 6.8 Stat Matching (Configure)
Reference-site layout, MLB stats:
- Left: **Value Sources** — which value pools test against stats: Custom Phrases · Date Matching values · Player Name · Team Name · Opponent Name · Player Age figures · Jersey Number · "Also match specific number(s)" free-entry list (comma/space separated — Tony types raw thread numbers here).
- Right: per-stat cards, batting and pitching sections both always present (two-way players match across both; zero-value stats skipped for the other role).
  - Batting: Season/Career × G, H, 2B, 3B, HR, R, RBI, BB, TB, SO, AB, PA.
  - Pitching: Season/Career × G, GS, W, L, SO, BB, H, HR, IP(outs).
- Each enabled stat has mode: **Current** (value as-is) · **Next** (+1 rung) · **Custom** (± offset input, e.g. TB+3). Modes are per-stat; **Bulk Apply** sets one mode across all enabled stats.

### 6.9 Founders & Spans (Configure) — NEW ENGINE
Consumes `founders-locked.json` (locked + sourced entries only; day-granularity only for day math).
- Entity picker: category pills (rituals, secret societies, institutional, sports founders, tribute figures, mlb_teams, wnba_teams, states) with per-entity checkboxes + select-all per category. Default: all ON.
- Per-entity computed spans vs analysis date: **days since founding (total)** · **days since last anniversary** · **days until next anniversary** · anniversary flag (=0 days). Respect the End-date-included global toggle.
- These span values join the match pool and are testable against: player stats (per §6.8 modes), player names, custom phrases, date calcs, birthday spans.
- **Direct date-to-date convergence (toggle: "Player dates × entity dates")** — spans computed BETWEEN a player's dates and an entity's dates, independent of today:
  - days from entity founding to player's birth date (total days, also weeks/months figures) → value joins that player's match pool, testable against all enabled targets (stats, names, phrases, date calcs, thread numbers).
  - anniversary alignment: player's birth month/day equals the entity's founding month/day → explicit `⚑ born on <entity> anniversary` flag line on the card.
  - offset alignment: player's birthday falls N days after/before the entity's anniversary where N matches any enabled value in the match pool (this is how "born 322 days after X" surfaces — no hardcoded offsets; the pool decides what's hot).
  - same three checks against player debut date when Career Clocks (§6.10) is enabled, and against founder DOBs when harvested.
  - Respect the End-date-included global toggle for all of these.
- Entity gematria (name/founder/city/nickname ciphers, already in the JSON) also available as a value source toggle: "Founders gematria as values."
- If the historian's founder_dob/birthplace harvest has landed by build time, founder-birthday spans and birthplace city gematria appear as additional toggles; if absent, hide (feature-detect on the JSON fields — do not error).

### 6.10 Career Clocks (Configure) — NEW ENGINE
Date-span math on player/franchise clocks:
- Player: **days since MLB debut** · **days since/until debut anniversary** (debut date from statsapi person endpoint; fetch with the slate, cache it) · days since last birthday / until next (if not already covered by §6.7 — one implementation, surfaced in both dialogs).
- Franchise: days/weeks since franchise founding (founding dates from founders.json mlb_teams) · H2H meeting counts if available cheaply from cached data (OPTIONAL — skip if it requires new heavy fetches; note as TODO).
- Same targets as §6.9.

### 6.11 Team Totals — NEW SOURCE
Team season counting stats (R, H, HR, TB, SO, BB, AB, PA) as matchable counters with the same Current/Next/Custom modes as player stats. "Team runs at 495, next milestone 500 with +5" lives here. Hits attach to the TEAM and render on that team's player cards in the team-totals section (§7.4) and in a team summary row per game.

---

## 7. RESULTS — EVIDENCE CARDS

### 7.1 Grid
Responsive card grid (1-col mobile, 2–3 col desktop). Each card header: player name · team · pos · DOB · matchup (Away @ Home) · analysis date · **match count badge**. Pitchers get a `P` marker and their probables status if known.

### 7.2 Card body — the sacred format
Counter-grouped blocks, each block:
```
<counter label>: <counter value>            ← bold, counter-type color
"<word/phrase>" = <value> (<Cipher>)        ← one receipt line per match
"<word/phrase>" = <value> (<Cipher>)
```
Rules:
- Claim + receipt together, always. Never a match without its cipher label; never a counter without its value.
- **Silence is information**: counters with zero matches DO NOT RENDER. No empty groups, no "0 matches."
- Color by counter type (consistent across all cards): age clocks · birthday spans · stat milestones · date calcs · founders spans · career clocks · team totals. Cipher name inline keeps the cipher's signature color from §6.2.
- Custom-offset stats show their arithmetic: `Season Total Bases +3: 59 + 3 = 62`.
- Prime/composite chained matches (§8) show the chain: `span 397 = prime #78 → "TRIPLE" = 78 (Ord)` with a depth chip `d2`/`d3`.
- Founders-span matches name the entity: `⚑ Jesuit Order — 177,412 days since founding` style grouping.

### 7.3 In-results filtering (the analysis surface)
Filtering after the scan is the core workflow — make it instant (recompute from cache, no refetch):
- Tap any cipher chip anywhere → toggle that cipher off globally (with an undo toast).
- Tap any match line → options: hide this word · hide this match type · hide this counter. All reversible from a "hidden items" tray.
- Number spotlight: search box accepts a number → cards filter to carriers, matching values light gold (reuse the founders-viewer interaction — Tony has approved that pattern).
- Sort control, dumb by default: Match count · Lineup/alphabetical · Team/game. NO quality weighting.
- All hide/filter state persists (localStorage) as part of the working state — this is the raw material for the future backlog phase. Never discard it on refresh.

### 7.4 Card display config (gear on the grid header)
Toggles, all default OFF except match groups:
- Match groups (ON, the point of the card)
- Age summary strip (years+days · total days · weeks+days · months+days)
- Birthday span strip
- Stat line (entering season + career, with stats-as-of timestamp)
- **Opposing pitcher section** (batter cards): probable's name gematria + his relevant stat counters, rendered in the same claim+receipt format
- **Team totals collapsible** (per §6.11): team counters + any team-total matches
- Config saves with presets.

### 7.5 Card probe — ad-hoc follow-up on one player
The main query is the hypothesis; the probe is the follow-up question asked WITHOUT leaving the card or re-running the slate. Every card gets a probe affordance (🔍 icon / "Probe" row at card bottom) opening an inline panel on that card:

- **Phrase input** with token shortcuts: one-tap chips insert `{full name}`, `{first}`, `{last}`, `{team}`, `{opp}` + free text, so "Jace Jung triple" is two taps and a word. Multiple probe phrases can be stacked.
- On entry, each probe phrase computes instantly in ALL currently-selected ciphers and is tested against **every counter this player has** — all batting/pitching stats in ALL THREE modes at once (Current, Next, and any Custom offsets currently configured), plus AB/PA always (house rule: AB/PA advance every plate appearance — they are the confirmation layer), plus age/birthday spans, plus team totals if enabled.
- Results render inline in the sacred claim+receipt format, in a visually distinct "PROBE" block (dashed border) so ad-hoc findings never masquerade as main-query results.
- Probe hits get a **⊕ promote** affordance: one tap adds the phrase to the main query's Custom Phrases (§6.5) — so a probe that proves out graduates into the slate-wide scan and future presets. Un-promoted probes persist on that card for the session (part of working state) but don't pollute the query.
- Probe panel also accepts a **raw number** (not just phrases) — "does 62 land anywhere on this guy" — tested against the same full counter set.
- Individual mode (§7.6) always shows the probe panel open by default.

### 7.6 Individual mode
Same card, full width, all groups expanded, plus every enabled counter listed EVEN IF unmatched (Individual mode is inspection, not triage — silence rule inverts here, show the counter with "no matches" muted).

---

## 8. PRIME/COMPOSITE CHAINING — MATCH MODIFIER

House methodology; the reference site lacks it entirely.
- Global toggle in Match Types dialog: **Index chaining** with depth selector: Off · d1 (direct only, default) · d2 · d3.
- d2: if a counter value is prime → its prime index joins the match pool for that counter (labeled). If composite → composite index likewise. d3: one more indexing step on the d2 result.
- Every chained hit is labeled with its full chain and depth chip. Chained hits NEVER masquerade as direct hits.
- Implement prime/composite index via the same sieve approach as the existing tools (pregame-pitcher-backtest.html has the pattern — mirror it).

---

## 9. ENGINE CORRECTNESS

- Cipher engine must pass the house checksum BEFORE first render: `Jesuit Order` → Ord=144 Red=54 Rev=153 RR=72 Sat=529. Hard-fail with a visible error banner if it doesn't — never render numbers from a broken engine.
- NFD-normalize names, strip diacriticals before ciphering (house rule for accented names).
- All date math in UTC date-only arithmetic (no timezone drift on spans).
- Entering stats only — never mix in today's in-game stats (this page is pregame).

---

## 10. BUILD PHASES

**Phase 1 — the working instrument (this handoff):**
Version safety (§1) → query.html shell + rail + slate cache + MLB adapter → cipher dialog + checksum → Match Types with: simple name sources, Custom Matching, Date Matching, Total Age, Stat Matching → results grid with sacred card format + in-results filtering + number spotlight → **card probe (§7.5)** → presets → Individual mode → phantom WNBA. `node --check` + jsdom render test + a golden-output test: one hand-computed player fixture whose expected matches are asserted.

**Phase 2 — the exclusive layers:**
Founders & Spans engine · Career Clocks · Team Totals · Index chaining d2/d3 · opposing-pitcher + team-totals card sections.

**Phase 3 — deferred (do not build now):**
Backlog/auto-snapshot + grading hooks (state already persists — wiring only) · WNBA live adapter behind Netlify function proxy · historical stat snapshots for true backtest dates · Discord digest export · shared gematria-core extraction · commercial hardening (below).

**Commercial hardening notes (for the future, keep in mind, build none of it):** API keys never ship client-side (Netlify function proxies) · nightly slate-cache job replaces per-user fetching · per-user preset storage · NFL adapter. Nothing in Phases 1–2 may architecturally preclude these.

---

## 11. HOUSE RULES THAT BIND THIS BUILD

- Single-file page, Netlify drag-drop, no build step. Mobile-first.
- Surgical edits only to the existing app (one nav link). Never remove working features. Never assume a feature is unbuilt — check the code first.
- Never recommend or use ESPN APIs. statsapi for MLB; BDL (proxied) for WNBA later.
- No dates from model memory anywhere — slate DOBs come from statsapi; founders dates come from the locked export only.
- Validate JS with `node --check`; jsdom smoke test before delivery.
- Terse handoff summary to Tony at the end: what shipped, the three recovery paths (git tag, archive folder, Netlify deploy history), and exactly what to drag-drop.
