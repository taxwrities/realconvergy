# WNBA-REDESIGN-SPEC.md — WNBA app in the Convergence monorepo + historic H2H

Addendum to LAYOUT-SPEC.md. That spec defines the four-tab shell, pattern grammar, vocab manager, forecast engine, color rules, search, and quick-add — all of it applies here. This file covers only what's different for WNBA, the monorepo structure that version-controls both apps, and the new historic H2H data pipeline.

---

## 1. Monorepo structure (this is the "version-controlled way")

```
realconvergy/                  (or whatever the repo is named)
  packages/
    gematria-core/             shared cipher engine + checksum (built in MLB Phase 1)
    ui-theme/                  Astryx theme overrides, color tokens, shared components
  apps/
    mlb/                       the LAYOUT-SPEC.md app
    wnba/                      this app
  data/
    birthdays.json             WNBA player DOBs (existing plan, existing partial harvest)
    wnba-h2h.json              historic head-to-head totals (§4)
    registry-mlb.json          theme figures (Phase 4)
    registry-wnba.json
  specs/
    LAYOUT-SPEC.md             ← commit the design docs so they can't be lost again
    WNBA-REDESIGN-SPEC.md
    ranker-fix-v2.md
    live-session-rules-2026-06-10.md
  scripts/
    harvest-h2h.mjs            one-time BDL season-loop harvester (§4)
    harvest-birthdays.mjs
```

- **Two Netlify sites, one repo.** Site A base directory `apps/mlb`, site B base directory `apps/wnba`. Each has its own netlify.toml (or set base/publish in Netlify UI). Push once, both build; Netlify only rebuilds a site when its paths change if you add `ignore` commands — optional optimization, skip for v1.
- Static data is fetched by the apps from `raw.githubusercontent.com/{user}/{repo}/main/data/...` (existing birthdays.json plan) OR bundled at build time since the apps now live in the same repo — prefer **build-time import** for h2h and birthdays (simpler, no CDN latency, updates ship with deploys).
- All mockups from the design session are described zone-by-zone in LAYOUT-SPEC.md; committing these specs is the recovery path for "lost the design."

## 2. WNBA app — same shell, different rules

The four tabs, batter-list-→-card-→-matchup-panel structure, pattern editor, templates, color rules, quick-add, and search all carry over. Renames and rule differences:

- **Terminology**: batters → players; lineup order → starters first (starter flags are manual/roster-library since BDL can't provide them), then rotation by minutes.
- **Cipher profile**: Chaldean + Satanic default ON (cross-sport lock rule). Stored as the `wnba` profile in `cvg.ciphers.wnba` — independent from MLB's toggles.
- **Vocab**: WNBA CORE table only. MLB values are banned from WNBA scoring and vice versa; the sport-scoped vocab store from LAYOUT-SPEC §7 enforces this. MLB city-bridge lane routes to home-team players only.
- **Lanes** (refine box chips): First Basket (default ON), PTS, REB, AST, 3PM, PRA. First Basket is the flagship lane and gets its own card treatment:
  - **cFG+1 / arena check runs first** — career FG+1 and season FG+1 against arena values is the highest-priority signal and renders at the top of the player card.
  - **Column-specific team lock**: stat+1 landing on own team name within a specific scoring column outranks generic arena/date matches on competing candidates — the engine must score this above, not equal.
  - **Away-encodes-home routing**: away team carries the theme; first bucket typically home side. Role-first prioritization (centers/bigs for putback profiles); gematria is the tiebreaker, not the primary filter, for this lane specifically.
  - **KAT Rule**: player name encoding BASKETBALL/WNBA values across multiple ciphers = premium first-basket lean, badge it.
- **Player card extras**: birthday spans come from `data/birthdays.json` (finish the 11-team harvest as part of this build — handoff spec exists), jersey numbers, and the forecast section identical to MLB.
- **Matchup panel** (the flex slot): opposing team's paint presence / likely first-possession finisher, cross-hits between selected player and opposing center, plus the H2H chips from §3.
- **Data**: BDL `/wnba/v1/` (raw key, no Bearer, Netlify function proxy `functions/bdl.js` pattern carries over) for career/season stats while the subscription lasts; `stats.wnba.com` (`commonallplayers`, `playercareerstats?PerMode=Totals`) as the integer-totals fallback; birthdays and H2H are static repo data. Basketball Reference is scrape-of-last-resort (15–20s delays, blocks manifest as empty tables not HTTP errors).
- **Seasonal vocab**: `PLAY IN` entries live in a commented `SEASONAL_VOCAB` block, re-enabled each April — implement as a row-level `enabled` flag with a `seasonal: "april-playin"` tag rather than comments, since vocab is data now.

## 3. Context rail — WNBA H2H chips

Same rail as MLB (theme figures purple, duration/H2H blue, date gray), with these H2H-derived chips per matchup:

- **H2H game #** — this is all-time meeting N between the franchises (regular season; playoff toggle adds postseason meetings). The headline duration number.
- **Series record values** — all-time W-L each way; both raw counts and their gematria-relevant reductions are searchable numbers.
- **Days since last meeting** and **span since first-ever meeting** (dates in the h2h file make both computable client-side).
- **Franchise lineage badge** — when a lineage rename is involved (see §4), the chip shows the franchise-total number by default with the current-identity-only number available on tap (e.g., "as Aces only: game 41").

All chips behave like MLB's: highlighted when ≥1 player rung hits their values, tap to filter the board to carriers, values feed universal search.

## 4. data/wnba-h2h.json — historic head-to-head pipeline

**Pattern: harvest once → static file → live top-up.** Same philosophy as birthdays.json.

**Harvest script** (`scripts/harvest-h2h.mjs`, run once locally by Claude Code, committed output):
1. Loop BDL `/wnba/v1/games?seasons[]={y}` for y = 1997..2025, paginate fully, cache raw responses to disk so re-runs don't re-spend API calls.
2. Reduce to pairwise records keyed by **franchise lineage id**, not current team id. Lineage map (verify against a current reference at harvest time — this list is the known set, confirm nothing changed):
   - Utah Starzz → San Antonio Silver Stars → Las Vegas Aces
   - Detroit Shock → Tulsa Shock → Dallas Wings
   - Orlando Miracle → Connecticut Sun
   - defunct franchises (Houston Comets, Sacramento Monarchs, Cleveland Rockers, Charlotte Sting, Miami Sol, Portland Fire) keyed but flagged `defunct: true` — they still matter for "franchise game #" counts of surviving teams' totals vs the league, and for historic theme work.
3. Emit per ordered pair: `{ regularSeason: {games, aWins, bWins, firstMeeting, lastMeeting}, playoffs: {...} }` plus a `lineage` block mapping every historical identity to its lineage id.
4. Fallback source if BDL's early-season coverage is thin: `stats.wnba.com` leaguegamefinder per season. Validate totals: every season's pairwise sums must equal that season's league game count, and spot-check 3 known series records against Basketball Reference manually before committing.

**Live top-up** (client, per selected matchup): fetch current-season meetings between the two teams from BDL (1 call, sessionStorage-cached per day), add to static totals. Static file regenerates once per offseason via the same script.

**Size**: ~13 active + 6 defunct franchises → a few hundred pair entries; the JSON is small enough to import at build time. No proxy needed for it at all.

## 5. Build phasing

1. **Monorepo migration**: restructure the existing convergence repo per §1, move MLB app under `apps/mlb`, extract `packages/gematria-core`, commit all specs into `specs/`. Verify both the existing Netlify site (repoint base dir) and a new WNBA site deploy.
2. **H2H harvest**: write and run `harvest-h2h.mjs`, validate, commit `data/wnba-h2h.json`. Cheap, independent, and immediately useful even to the *current* WNBA tool.
3. **WNBA app shell**: clone the MLB app structure, apply §2 rules, First Basket lane + card, context rail with §3 chips, birthdays integration (finish the 11-team harvest here).
4. **Patterns/Forecast for WNBA**: the grammar engine from MLB Phase 2/3 is shared code — enable with WNBA counters (FG, PTS, REB, AST, 3PM, MIN, games played) and scopes (season, career, vs team, home/away, day-of-week).

## 6. Out of scope

NBA profile (same engine, later), defunct-franchise theme deep-dives (registry Phase), Basketball Reference automated scraping (manual spot-checks only), live in-game WNBA tracking.
