# Design — WNBA Convergence App

Same locked system as the MLB app — see [`../mlb/design.md`](../mlb/design.md)
for the full spec (genre atmospheric, Workbench family, token discipline,
motion/glow rules, z ladder, bold-contrast variant). This file records only
the WNBA deltas. Canonical token source: [`public/tokens.css`](public/tokens.css).

## WNBA deltas
- **Accent:** `--cvg-acc: #ff7a2e` (league orange), `--cvg-acc-ink: #261003`.
  The body wash radial uses the orange tint.
- **Display face:** Space Grotesk 700 (`--cvg-display`) — not Manufacturing
  Consent. The wordmark treatment (accent `em`, color-only) is shared.
- **Layout:** Board uses the two-column batter-zone (sticky 118px roster rail
  + card column) — the layout MLB retired; locked here, render-layer only.
- No player-card full sheet, no query.html on this app (yet). If the query
  engine is ported, it links `/tokens.css` the same way.

## Everything else
Defers to the MLB design.md. Cross-app changes to shared values happen in
BOTH tokens.css files (they are per-site deploys; keep them in lockstep).
