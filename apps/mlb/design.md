# Design — MLB Convergence App

A locked design system for this app. Every page/surface redesign reads this file
before emitting code. Do not regenerate per page — extend or amend this file when
the system needs to grow. Values are recorded hex-exact (the brand predates this
file; no OKLCH re-derivation that could shift it). The canonical token source is
[`public/tokens.css`](public/tokens.css), loaded by both `index.html` and
`public/query.html`.

## Genre
atmospheric — "broadcast dark" data app (Mobbin reference pass: MLS leaderboard,
SiriusXM game cards, Apple Sports translucent panels, NBA segmented toggle).

## Macrostructure family
- App shell (Board / Patterns / Forecast / Vocab): **Workbench** — the four-tab
  LAYOUT-SPEC shell is **locked**; redesigns touch the render layer only.
- Standalone tools (`public/query.html`): **Workbench** (filter rail + results
  grid). New standalone pages join this family.
- Full-sheet overlays (player card, search page): fixed 480px column, top-bar
  back affordance, LAYOUT locked.

## Theme
Surfaces (dark → bright): `--sf-0 #0c0f15` · `--sf-1 #151a23` · `--sf-2 #1a202b`
· `--sf-3 #171c26` · `--sf-4 #121620` · `--sf-sel #202634` · wells
`rgba(10,12,17,.55/.6)`. Hairlines `rgba(148,158,180,.14/.26)`, solid edges
`#262d3a` / `#38404f`.

Ink scale: `--ink #e8eaf0` · `--ink-hi #aab2c4` · `--ink-2 #8a90a0` ·
`--ink-3 #767d8f` · `--ink-4 #5f6678`. Floor: no text below 9px; sub-10px
labels use `--ink-3` or brighter.

Signal hues (semantic, never decorative): gold `#ffb02e` (convergence) · green
`#35d07f` (cross-refs) · blue `#46a6ff` (context/stairs) · cyan `#46d0ff` ·
purple `#d046ff` (**MLB brand accent** `--cvg-acc`) · red `#e24b4a` (live/error)
· orange/pink/lime/teal for query counter-types.

Focus: `--color-focus` = `--cvg-blue`, 2px outline, offset 2px, instant.

## Typography
- Display: Manufacturing Consent (wordmarks only), 400, roman
- Body: Fustat 400–700
- Data: JetBrains Mono 400–700 (all numerals — inherently tabular)
- Headers always roman; `em` in wordmarks is color-only (`font-style: normal`)

## Spacing
Pixel-tuned dense data app (no 4pt religion here — density is the product).
Card padding 12–13px, list rows 9px, chip padding 7px 13px. Keep rhythm by
copying neighboring components, not inventing new paddings.

## Motion
- `--ease-out: cubic-bezier(0.32, 0.72, 0, 1)` · `--dur-short: 220ms`
- Transform/opacity only. `:active` scale press-downs (.88–.96) are the app's
  signature feedback; keep them.
- **No infinite/ambient animation.** Convergence markers are static tint +
  inset ring. The page settles.
- Reduced-motion: nothing currently loops; keep it that way.

## Microinteractions stance
- Silent success; toasts for failures/undo only, fixed at viewport bottom.
- Focus rings appear instantly (rule lives in tokens.css), never animated.
- Hover affordances always have a visible-at-rest or `:focus-within` fallback.

## Component voice
- Chips: pill radius 999px, selected = solid accent fill + dark ink, **no outer
  glow**. Color-variant chips tint in their own hue.
- Cards/panels: `--card-grad` + `--sf-line` border + `--card-shadow` (dark,
  tight). Elevation on dark = brighter surface, never colored halo.
- Rows inside panels are FLAT (no card-in-card): background-less, hairline
  separators, hover stripe + well tint.
- Accent boxes (call-line, cross-row): full 1px hairline in the semantic hue at
  ~30% — never a thick side-stripe.
- Icons: the hand-drawn 1.8-stroke `svg()` set in App.jsx / inline SVG. No OS
  dingbats or emoji in icon slots. `⚡` as convergence glyph is product
  vocabulary, allowed in data text only.

## z ladder (the only allowed values — tokens.css)
sticky 20 · shell 30 · dock 40 (drawer = dock−1) · sheet 60(+1) · popover 80(+1)
· dialog 100 · menu 150(+1) · toast 200.

## What surfaces MUST share
- tokens.css values by name — no raw hex/rgb in rules (translucent one-off
  washes like the header blur backgrounds are the only exception).
- The wordmark treatment (display face, accent `em`).
- The chip/badge/panel voice and the z ladder.

## What surfaces MAY differ on
- Counter-type semantic hues (query.html's `--c-*` mapping).
- Density knobs (query cards are tighter than Board panels).
- Per-app accent: WNBA or other sports swap `--cvg-acc` only.

## Exports
### tokens.css
Canonical file: [`public/tokens.css`](public/tokens.css) — served at
`/tokens.css` in dev and prod (Vite public/). Link it; don't copy it.
