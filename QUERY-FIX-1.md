# QUERY-FIX-1.md — Relevance Hooks · Filter Sheet · Splits · Provenance
*Fix pass on the QUERY-SPEC.md build. Read QUERY-SPEC.md first for context; this file AMENDS it. Where the two conflict, THIS file wins. Version safety: tag `pre-fix-1` before touching code.*

---

## 0. WHY THIS FIX EXISTS (read this, it governs judgment calls)

The Phase 1–2 build followed QUERY-SPEC §0 ("everything ON, filter nothing") into a bug: the
founders/states engine matched EVERY registry entity against EVERY player — Jackie Robinson's
birthplace matched a TB rung in a Padres/Marlins game he has no connection to.

The correction is a distinction the original spec failed to make:

- **Match VALUE judgments** (is this hit important?) — still forbidden. Tony judges. §0 stands.
- **RELEVANCE routing** (does this entity belong in this game's pool at all?) — REQUIRED.
  Routing rules are Tony's own house methodology (city bridge, away-encodes-home). Applying
  the user's rules is not the app having opinions.

If a future judgment call pits "show everything" against "relevance routing": routing governs
admission to the pool; value-neutrality governs everything after admission. If genuinely
ambiguous, surface the question in the handoff notes instead of silently picking.

---

## 1. THE HOOK MODEL — entity admission to a game's match pool

An entity from the founders registry (all categories: rituals, secret societies, institutional,
sports founders, tribute figures, mlb_teams, wnba_teams, states) enters a given game's match
pool ONLY through at least one ACTIVE HOOK. No hook → the entity contributes nothing to that
game's cards: no gematria values, no spans, no date convergences.

### 1.1 Date hooks (computed, automatic)
An entity is date-hooked for the analysis date when ANY of:
- Today is its anniversary (founding month/day == today's month/day; day-granularity entries only).
- Today is a harvested founder's birthday (founder_dob month/day == today).
- Any of its computed spans vs today (days since founding · days since last anniversary ·
  days until next anniversary · founder-birthday spans) equals any value in the game's
  BASE POOL. Base pool = date calcs enabled in §6.6 + custom phrases' cipher values +
  the "specific numbers" list from §6.8. NOTE: base pool deliberately excludes per-player
  values — a date hook is slate-level, not player-level, so hooked entities apply to all
  games equally unless also routing-hooked.
- Its founding date participates in a direct date-to-date convergence with a player IN THIS
  GAME (§6.9 "Player dates × entity dates") — this hook admits the entity for that player's
  card only.

### 1.2 Routing hooks (computed, automatic, per-game)
An entity is routing-hooked into a specific game when its geography/franchise intersects it:
- mlb_teams / wnba_teams entries for the two teams playing.
- states entries for: home team's state, away team's state, venue state, and each player's
  birth state (that last one hooks the state for THAT PLAYER'S CARD only; derive birth state
  from statsapi birthCity/birthStateProvince — never inferred).
- Any entity whose harvested founder_birthplace or explicit city/location field matches either
  team's city or state (city bridge: the entity routes to the game through shared geography).

### 1.3 Manual hooks (Tony)
- **Theme activation:** any entity whose name appears in an active custom phrase, or which
  Tony toggles ON in the Entities section of the filter sheet (§2). Manual hooks are
  slate-wide and persist with working state + presets.
- **Widen scope:** a control in the filter sheet's Entities section: per-category override
  "hook entire category for this slate" (e.g. all states ON when hunting). Default OFF for
  every category. This replaces the old always-on behavior as an explicit, reversible choice.

### 1.4 Rendering
- Hooked entities' matches render normally. The hook that admitted them is part of the
  receipt (§4).
- The Entities section of the filter sheet lists hooked entities for the current slate,
  grouped by hook type, each toggleable off. Unhooked entities are reachable via search
  in that section for manual activation.

---

## 2. FILTER SHEET — replaces tap-on-match filtering

Remove the tap-a-match-line-to-hide interaction entirely (§7.3's tap-to-hide items).
Number spotlight search and sort control REMAIN on the results header.

Add a **Filters** button on the results header with an active-count badge ("Filters · 3")
opening a **bottom sheet** (mobile) / right panel (desktop ≥900px):

- Dark theme matching the app. Reference pattern: Mobbin — Character AI filter sheet
  (sectioned dark sheet, chip toggles), Tabby refine sheet (grouped chip sections),
  Revolut Business filters (per-section "N of M" counts + Clear all). Do not clone; match
  the app's existing tokens.
- Sheet is a partial overlay (~85% height mobile) with the grid visible behind it.
  **No Apply button** — recompute is instant (client-side over cache), so every toggle
  updates the grid live behind the sheet. Single "Done" closes; "Clear all" resets.
- Sections (each header shows its active count, each has a per-section reset):
  1. **Ciphers** — chip toggles, signature colors, Select Base / All / Clear (§6.2 moves
     here as the runtime surface; the rail dialog remains the pre-query config).
  2. **Match types** — toggle each engine + simple source (names, date calcs, age, stats,
     founders spans, career clocks, team totals, jersey).
  3. **Counter types** — hide entire counter families from cards (age clocks, birthday
     spans, stat rungs by stat, date calcs, founders spans, team totals).
  4. **Entities** — hooked entities grouped by hook type (date-hooked / routing-hooked /
     manual), each toggleable; search box to find and manually hook any registry entity;
     per-category "widen scope" toggles (§1.3).
  5. **Hidden words** — word-level mutes (type a word to mute it slate-wide, e.g. a noisy
     team nickname); list with un-mute.
- All sheet state = working state: persists in localStorage, captured by presets.

---

## 3. SPLITS — home/away, season + career

### 3.1 Validate FIRST (do not skip)
The statsapi hydrate syntax for splits has NEVER been verified in production. Before wiring
anything, test against live statsapi for 2-3 known players:
`hydrate=stats(group=[hitting],type=[statSplits],sitCodes=[h,a])` and career equivalent
(`careerStatSplits`). Confirm actual JSON shape and that career splits return real data.
Record the verified exact syntax + a sample response snippet in a comment block at the fetch
site. If career splits are NOT available from statsapi, ship season splits only and state
that plainly in the handoff — do not fabricate career splits by other means.

### 3.2 Wire
- Slate fetch adds home/away splits (verified scope only) per player:
  `batting.seasonSplits.home/.away`, `batting.careerSplits.home/.away` (same for pitching),
  same stat keys as §4.3. Missing = null, contributes nothing.
- Stat Matching (§6.8) gains a **Scope** control per stat lane: Overall (default) · Home ·
  Away · "Tonight's venue" (auto-resolves to home or away based on where this player's game
  is — this is the scope Tony will actually use pregame). Scope participates in Current /
  Next / Custom modes identically.
- Receipts name non-overall scopes: `Season H (home): 21 → next 22`. Split-scoped counters
  get a distinct shade of the stat-milestone color.
- Splits fetch failure degrades gracefully: Overall works, split scopes show "unavailable"
  muted in the config, zero errors on cards.

## 4. RECEIPT PROVENANCE — every line answers "what even is this"

Every receipt line gains a provenance suffix. No word appears on a card without its source
chain. Formats:

- Founders-pool words: `"Cairo, Georgia" = 28 (Reduction) · ⚑ Jackie Robinson — birthplace · hooked: birthday today`
  (entity · field that produced the word · hook that admitted it). Fields: name, founder,
  city, nickname, birthplace, state.
- Custom phrases: `· custom phrase` (or `· theme` if admitted via manual hook).
- Date calcs: `· date calc` + the formula name where ambiguous (`"Saturday" · day name`).
- Team/opponent/player name sources: no suffix needed when the quoted word IS the player's
  or either team's name (self-evident); suffix required for anything else.
- Jersey: `· jersey #25`.
- Chained (§8): provenance comes AFTER the chain notation, never replacing it.
- **Tap any receipt line → context popover:** full entity mini-card (category, dates, spans
  vs today, hook, source URL from founders.json) or, for non-entity sources, the computation
  (formula, phrase origin). One tap from "what is this" to answered, always.
- Long provenance truncates gracefully on mobile (entity name always visible; tap for full).

---

## 5. VERIFICATION (in addition to QUERY-SPEC's tests)

- Hook correctness test: for a fixture slate (SD @ MIA), assert Jackie Robinson (tribute,
  no date hook on the fixture date, no routing intersection) contributes ZERO matches;
  assert Padres/Marlins team entities, FL/CA state entities DO contribute; assert Robinson
  appears when the fixture date is set to his birthday.
- Splits: show the verified hydrate syntax + a real response snippet in the handoff.
- Provenance: assert every rendered receipt line matches a provenance-bearing template
  (regex over rendered fixture output); zero bare receipts.
- Filter sheet: jsdom test that toggling a cipher/section updates rendered card count.
- Compliance checklist against THIS file, same SHIPPED/PARTIAL/MISSING format, plus the
  judgment-calls list. Timing re-check: full-slate scan still <1s with hooks computed.
- Do not build anything from QUERY-SPEC Phase 3. Budget remaining → edge cases (player with
  no birth state, entity with founder but no DOB harvested, splits unavailable), not features.
