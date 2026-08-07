# LAYER-SCANNER-V2.md — Tiered Rung Sheets + Depth-Default Scanning

*Status: DRAFT v1 — 2026-08-06 (written live during the night slate). Supersedes the
matching/curation portions of LAYER-SCANNER.md; the layer inventory there still
stands. Build target: scripts/landings-scanner.py + board output.*

## Why (receipts from 2026-08-06)

Detected-but-buried cashes: Wong H→37 (Enola direct), Meidroth PA 461=p#89 homer,
Yoshida PA 263=p#56=c#39. Missed pregame entirely: Young name RO=157=37th prime
(Enola family), Neto (off board top-N), Benge triple-only TB→170 (outcome ranked
as Double). Root causes: top-N shortlist output, depth-2 on demand only, no
theme-family expansion, no full-counter fallback, sibling-outcome ranking blind.

## Change 1 — Theme-family expansion (pre-match)

Every theme/field number expands before matching:

- self; prime-index member (v = p#t); comp-index member (v = c#t); the t-th prime
  P[t]; the t-th composite C[t]; zero-strip relatives.
- Example: 24 → {24, 89 (p#24), 36 (c#24), P[24]=89, C[24]=36}; 37 → {37, 157, 54...}.
- Family members carry provenance tags (e.g. "89 = p#24 ← Truman/24") on every line.
- Cap: one expansion level for matching; deeper chains handled by Change 2.

## Change 2 — Depth-2/3 chaining ON BY DEFAULT

For every projected value v: check v, idx(v), idx(idx(v)) against the expanded field.

- Tag depth on every match: [d1] [d2] [d3].
- d1 direct > d2 > d3 for ranking (see Change 4). d3 never elevates alone.

## Change 3 — Name-cipher cross-ref vs expanded family

All 4 ciphers of fullName, firstName, lastName matched against the expanded family
(catches Young RO=157 pregame). Name-only match = decoration flag, never a leg.

## Change 4 — Ranking rules (hard, ordered)

1. Direct field hit on next-event H+1 / HR+1 / RBI+1 / R+1 beats any depth chain
   (Wong rule).
2. Exact-fit delivery (only one outcome lands it: triple-only TB+3, double-only
   TB+2, HR-only TB+4) beats non-exclusive landings (Benge rule). Scanner must
   compute sibling outcomes and rank the exclusive one, not default to Double.
3. Auto-landers (PA/AB/G reachable in ≤4) rank as confirms, never as calls; G+1
   index = own-name cipher is a marked-man flag (Endy/Neto/Benge/Serven rule —
   candidate w/ 4 receipts, promote on 2nd session).
4. Full stack (name-family + counter + exclusive delivery) = Tier 1 eligible.
5. Parked values (counter sitting ON a field number) = decoration note only
   ("landings predict, parkings decorate" — DeLauter 57 rule).

## Change 5 — Tiered board output (per game)

- TIER 1 · LEGS (max 3): full stacks only, primary + alt call format.
- TIER 2 · WATCHLIST (10–15): one line per batter with next-event direct hits and
  ≤4-step auto-landers. Includes every d1 next-event match — nothing direct gets
  buried below the fold.
- TIER 3 · FULL SHEET: machine-readable JSON (data/boards/{date}-rungs.json):
  every batter, every counter, every projection with depth + provenance tags.
  Feeds live grading, DECODE-CHAT bundles, and postgame denominator logging.
- No global top-N cutoff: every rostered batter appears in Tier 3; Neto rule.

## Change 6 — Denominator logging

Postgame job records, per pattern class (d1 direct, exclusive-fit, auto-lander,
name-family, G-stamp): flagged count, hit count, miss count →
data/graded/{date}-classes.json. Feeds the 100-day hit-rate analysis.

## Non-changes

- Field values remain from theme JSON + locked regression tables. No invention.
- Card discipline unchanged: only Tier 1 frozen legs grade as calls.
- MLB scope only; WNBA tools untouched.

## Open questions

1. Family expansion for ALL theme numbers or only Zach-flagged tops (60/24-class)?
   Full expansion multiplies match density — recommend full, but with provenance
   tags mandatory so density is visible.
2. Exact-fit rule: require exclusivity across {1B,2B,3B,HR} only, or also vs
   BB/HBP paths on PA-driven counters?
3. Tier 2 line count — hard cap at 15 or scale with slate size?
4. Should Tier 3 JSON also commit pitcher K/out ladders (Castillo 86→89→90
   class)? Recommend yes; tonight's K props came from manual runs.
5. First/last-name ciphers in the name cross-ref add ~2x lines — include both
   (Kiki/Endy first-name locks argue yes)?

## BUILD DEFAULTS (2026-08-06 first build — defaults, not locks; flip on Tony's word)

Answers the open questions as implemented by scripts/landings-scanner.py v2:

1. **Full expansion of every field number**, provenance tags on every line
   (spec's own recommendation).
2. **Exclusivity computed across the four hit siblings {1B,2B,3B,HR} on the TB
   counter only.** BB/HBP paths on PA-driven counters stay out — PA/AB are
   auto-lander class by rule 3 and never calls, so exclusivity there would
   change nothing they're allowed to do.
3. **Soft cap 15: every d1 next-event batter always prints (spec: nothing
   direct buried); auto-lander-only lines fill remaining space up to 15.**
4. **Yes — pitcher K/out ladders committed to Tier 3 JSON** when the slate
   carries pitching stats (run-board slate builder now hydrates probables with
   group=[hitting,pitching]; older slates degrade to batters-only).
5. **Yes — first + last name ciphers included** alongside full name (Kiki/Endy).

Grading definitions written into data/graded/{date}-classes.json: d1-direct /
exclusive-fit / auto-lander grade their own counter target (entering + boxscore
line reaches the target; multi-step stats like TB can overshoot — final-exact is
recorded separately); name-family and G-stamp grade as "flagged player homered
that day" (Young/Serven receipts are HR receipts).
