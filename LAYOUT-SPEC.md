# LAYOUT-SPEC.md — Convergence App v2 (Full Redesign)

Handoff spec for Claude Code. This replaces the long-scroll layout of `convergence-scanner-v2.html` with a four-tab app. Design was locked in a design session on 2026-07-13; the interactive mockups referenced below were approved by Tony. Build on this spec, don't re-litigate the layout.

---

## 1. Goals

- Triage at a glance: see who matters before opening anything. No long single-column scroll.
- Game-first navigation. Tony picks one game; everything below is scoped to it. No slate-wide hero board.
- HR/TB hunting is the default lane. Stack depth is a tiebreaker within lane, never the headline sort.
- Everything configurable is data, not code: core tables, ciphers, patterns, phrases, colors, themes.
- Mobile-first (Tony operates on a phone during live games). Thumb-reachable nav, bottom sheets, chip rails.

## 2. Stack & pipeline

- **Repo**: new GitHub repository, connected to Netlify (build on push). This replaces drag-and-drop for this app. Drag-and-drop remains fine for the legacy single-file tools.
- **Framework**: Vite + React + `@astryxdesign/core` with `@astryxdesign/theme-gothic` as the base theme, re-skinned via CSS custom property overrides to the scanner palette (below). Astryx is Beta (v0.1.x) — pin versions. Astryx ships its own CLAUDE.md and CLI (`npm run astryx -- component --list`); use them as the component reference.
- **Palette** (carry over from existing tools): bg `#101319`, card `#171b23`, line `#2a303c`, text `#e8eaf0`, muted `#8a90a0`, gold `#ffb02e` (tier-1 / T-family default), green `#35d07f` (tier-2 / positive), blue `#46a6ff` / `#46d0ff` (thread/date/H2H), purple `#d046ff` (theme/forecast), red `#e24b4a` (user color rules).
- **APIs**: MLB Stats API (`statsapi.mlb.com`, no auth). If CORS requires it, Netlify serverless functions — folder `functions/`, `netlify.toml` with `directory = "functions"` and `node_bundler = "none"` (connected-repo builds process functions; this was the drag-and-drop blocker).
- **Cipher engine**: extract the shared engine as `gematria-core.js` (this build is the Phase-2 dedup item — do it here first, other tools migrate later). Ciphers: Ordinal, Reduction, Reverse Ordinal, Reverse Reduction, Chaldean, Jewish/Latin, Satanic, Septenary; prime/composite index; 9s chains. Verification checksum on boot and on any vocab save: JESUIT ORDER must return Ord=144, Red=54, Rev=153, RR=72, Sat=529. Refuse to save vocab edits if checksum fails.
- **House rules that the engine must enforce** (from ranker-fix-v2.md and live-session rules — read those files too):
  - MLB scope: baseball/MLB core values, Masonic tables, team gematria, date numerology, stadium values only. No basketball vocab. Satanic cipher is an approved exception with its own core values.
  - Tracked batter stats: SO, H, HR, 2B, 3B, BB, TB, AB, PA — season AND career entering counts, milestone staircases on all.
  - AB/PA rungs are green-light signals, never presented as the bet.
  - Gematria sort is primary; stats annotate and flag, never re-rank.

## 3. App shell

**Header** (persistent, all tabs): app title/context on the left; three icon actions on the right — Search, Quick-add (+), Settings (gear).

**Bottom tab bar** (4 tabs): Board · Patterns · Forecast · Vocab. Tab switches are instant and preserve state (a half-built pattern survives leaving the Patterns tab).

**Settings** is a bottom sheet, not a tab. Contents: color rules (§8), sport profile selector (future), export/import config, cipher-profile shortcuts.

**Persistence**: every change auto-saves to localStorage immediately (no save buttons anywhere except vocab edits, which gate on the checksum). Single export/import of one `config.json` containing all user state (§9). Repo-backed sync is a later phase.

**Fluidity components**: bottom sheets with swipe-dismiss (detail, quick-add, settings), horizontal chip rails with scroll-snap, sticky positioning for batter list and refine box, skeleton loading states.

## 4. Tab 1 — Board (default tab)

Zones top to bottom (mockups: `wireframe_v1_mockup`, `full_layout_integration_v1`, `full_app_four_tab_demo`, `matchup_panel_under_card`):

1. **Date strip**: two cards — "Day N of MLB season" and "date · DOY · days left in year · date numerology set". Always visible.
2. **Refine box**: collapsible, sticky. Lane chips (HR, TB, K, H, BB, 2B, 3B) toggle which outcome lanes score/sort the board. Default ON: HR + TB. Collapsed state shows a summary ("Refine · HR + TB lanes"). Collapses after choosing but remains pinned and one tap away.
3. **Game chips**: horizontal rail of today's games; one active at a time. "▾ N more" expands the full slate. Selecting a game scopes everything below.
4. **Context rail**: per-game horizontal chips, mixed types — theme figures (purple; from registry when built, from quick-add always), H2H/duration values from the Date Decoder merge (blue; total all-time games, days since last meeting, anniversary spans), DOY/date chips (gray). Active chips (≥1 hit on board) get highlighted borders and show hit counts. Tapping a chip filters the batter list to carriers.
5. **Team toggle**: two chips (away/home), switches the batter list.
6. **Batter list** (left column, ~112px, sticky): one row per batter in lineup order. Row contents: name, then badge row — lane/pattern badges (gold "HR" etc. when a saved pattern matches) and forecast chip (purple "⟡ M/D" when an upcoming convergence exists). Light/skip batters render muted. List must be fully loaded before live use (mandatory protocol).
7. **Batter card** (right of list, fills remaining width): selected batter's detail. Contents: name + jersey number (jersey gematria checked), birthday spans (days since/until bday, day-of-age; matches flagged), pattern badges, rung rows (color rules applied), thread check Y/N, PRIMARY + ALT call lines, and a FORECAST section (purple-bordered) when the batter has a pending convergence — date, hard/soft count, condition summary. TB rungs headline for contact/XBH profiles; BB never buried; full 2B/H ladders surfaced per house rules.
8. **Matchup panel** (below batter card, contextual to selected batter — this is the "flex slot", matchup panel is v1 default): opposing pitcher card — name gematria, convergence stack, early-hook/blowup risk note, relevant vs-hand split of the selected batter — plus **CROSS rows** (green): any value where pitcher counters and batter loaded values converge (pitcher rung = batter milestone, pitcher name = batter value, either = team game #). Fold team staircases in here: team's next R/AB/PA/TB landings that hit loaded values.

## 5. Tab 2 — Patterns

**Library**: card list of saved patterns — name, condition summary, lane, on/off toggle, "N hits today" live count. Tap to open in editor. "+ new pattern".

**Editor** (mockups: `pattern_rule_editor_mockup`, `forecast_pattern_bregman_example`): a pattern = name + ordered list of conditions ANDed. Each condition is a sentence of dropdown chips:

```
[counter] [scope] [modifier?] = [modifier?] [source]    (hard | soft)
```

- **Counters**: batter stat rung (SO/H/HR/2B/3B/BB/TB/AB/PA, +1..+5), team game #, season game #, team staircases (next R/AB/PA/TB), DOY, date numerology, day-of-week value, batter age figures.
- **Scopes** (for stat rungs): season, career, vs team, vs division, vs league, home/away, month, day-of-week.
- **Modifiers** (either side): prime # of, composite # of, chain-to (9s chains from active base). This is what expresses joins like "DOY 193 = 44th prime = team next run 44".
- **Sources**: core table, date/thread numbers, theme figure, own name (12-value run), phrase template (§7), opp pitcher name, opponent team, team, stadium, free word value.
- **Hard vs soft**: soft conditions (Tony's "(if)") don't block a match/forecast; they upgrade it. Display "4✓ hard +1 soft".
- **Live preview**: every condition row evaluates against the currently selected batter and shows the resolved values green/gray as you build.

Patterns without date-dependent conditions evaluate daily and produce Board badges. Patterns with date-dependent conditions feed the Forecast engine.

**Seed patterns** (ship pre-loaded): "HR Convergence" (HR+1 = core AND TB+4 = core AND AB/PA rung lands within today's realistic PAs — Tony's favorite), "Multi-K stack" (K+1..K+3 all = core; K lane, default off), "NAME LOCK" (name cipher = milestone rung), "Double-Core-Chain" (milestone = core value AND its prime/composite index = another core value → auto-promote).

## 6. Tab 3 — Forecast

The Landings method as a screen. For every pattern with date-dependent conditions, walk the upcoming schedule (default 10 days) per batter: resolve each date's counters (day-of-week value, game #, DOY, dn, projected stat rungs at realistic accrual) and score conditions per date. Emit forecast cards where ≥2 hard conditions converge on one date.

**Card**: batter · lane, convergence date, hard/soft count, condition summary line, and a small date-window strip (adjacent dates with their ✓ counts) so near-misses are visible. Sorted by date ascending; today's maturing forecasts pin to top AND auto-appear on the Board (badge on batter row).

Frozen-card discipline applies: a forecast's conditions freeze when generated; grading later compares against the frozen card, no retrofitting. (Grading itself ships with the card-logging phase.)

Compute note: schedule-loop scanning is the heaviest feature in the app — it is **Phase 3**, behind the core layout. The Date Decoder's schedule-loop H2H probe code is the starting point.

## 7. Tab 4 — Vocab

(Mockups: `vocab_manager_mockup`, `global_phrase_template_builder`.)

**Cipher toggles**: chip row, one per cipher, tap to toggle engine-wide *for the active sport profile* (MLB profile default: Chaldean OFF is allowed; WNBA profile default: Chaldean + Satanic ON — profiles store separately). Toggling recomputes all scores, name runs, and phrase values; disabled ciphers' numbers render struck-through wherever shown.

**Core table editor**: one row per entry — word, per-cipher values, row on/off (benchmark before deleting), edit, add, delete. Jesuit checksum runs on every save; failed checksum blocks the save with an error. Sport-scoped tables (MLB table never contains basketball vocab and vice versa).

**Phrase system**, two species:
- **Templates (global, the workhorses)**: `{token} + word`, resolved per entity at scan time. Tokens: `{batter full}`, `{batter last}`, `{batter first}`, `{opp pitcher}`, `{team}`, `{opp team}`, `{stadium}`, `{theme figure}`, `{day of week}`. Words: any vocab entry (HOME RUN, TRIPLE, STRIKEOUT…). A template used as a pattern source makes that pattern scan every batter/slate. Saved templates show usage tags ("in 2 patterns") and cannot be deleted while referenced.
- **Literals**: fixed phrases (manual entries, theme-registry figures). Computed across all enabled ciphers on entry. Usable as sources but mainly registry material.

## 8. Shell features

**Universal search** (header icon, any tab): type a number → identity card (all table matches, prime/composite index, T-family membership, chain relations) + live occurrences (batters with rungs landing on it today, phrases computing to it, patterns referencing it, boards this week). Type a word → its cipher values + same live occurrences. This is the bottom-up method as UI.

**Quick-add** (header +, any tab, bottom sheet): four actions, all effective immediately with live board re-score, all persisted for the day — "+ theme to today's rail" (name → computed → purple chip on active game's rail), "+ number to thread", "+ phrase/word to vocab", "+ label on player" (freeform flags: WILDCARD, role-anomaly, etc.).

**Color rules** (Settings sheet): ordered list of rules `target → color`. Targets: exact number, number family (T-family preset: 40, 43, 57, 58, 59, 62, 191, 69, 84, 177, 201, 1336), word prefix (`JESUIT*`), category (today's date numbers, active thread, theme values). First matching rule wins (list order = priority, drag to reorder). Colors apply everywhere a value renders: rung rows, chips, search results, forecast cards, vocab tables.

## 9. Storage schema (localStorage keys, all bundled in config.json export)

```
cvg.profile            active sport profile id ("mlb")
cvg.ciphers.{profile}  { Ord: true, Red: true, ..., Chal: false }
cvg.vocab.{profile}    [ { word, values: {...}, enabled, source: "core|manual" } ]
cvg.templates          [ { id, tokens: [...], word, label } ]
cvg.phrases            [ { text, values: {...}, source: "manual|theme|auto" } ]
cvg.patterns           [ { id, name, lane, enabled, conditions: [
                           { counter, scope, lmod, rmod, source, sourceArg, hard } ] } ]
cvg.colorRules         [ { target: {type, value}, color } ]   // ordered
cvg.dayState.{date}    { adhocThemes: [...], adhocThread: [...], labels: {...} }
cvg.registry           [ { name, teams: [...], values: {...} } ]  // theme figures
cvg.settings           misc UI state (lane defaults, collapsed states)
```

## 10. Build phases

1. **Shell + Board + Vocab**: repo, Vite/React/Astryx scaffold, gematria-core.js with checksum, MLB statsapi pipeline (probables, lineups, entering season+career stats — remember: reference totals exclude the current day), date strip, game/context rails, batter list + card, matchup panel with CROSS rows, cipher toggles, core table editor, color rules, search, quick-add. Ships a usable daily tool.
2. **Patterns + templates**: grammar engine, editor with live preview, seed patterns, template resolution, board badges, splits data (vs team/division/league, day-of-week, home/away — verify the `careerStatSplits/statSplits` hydrate syntax first; it is flagged unverified).
3. **Forecast engine**: schedule-loop scanner, forecast cards, board feedback, date-window strips.
4. **Registry + logging**: Wikipedia team-figure scrape → `cvg.registry` (graduation flow from quick-add discoveries), card-logging repo (`data/YYYY-MM-DD.json` + `logs/YYYY-MM-DD.md`), forecast grading against frozen cards, pattern-discovery mining over logged results.

## 11. Out of scope for v1

WNBA profile UI (schema supports it; build after MLB ships), SQLite migration (~100 logged days), Obsidian viewer, live in-game tracking (v3-live-tracker remains the live tool; this app is pregame + forecast).
