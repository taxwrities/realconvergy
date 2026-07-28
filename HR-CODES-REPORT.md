# HR Codes Audit — MLB_2026_HOMERUNS.xlsx
Generated 2026-07-28 · 3,410 HR rows · 2026-03-26 → 2026-07-24 · 482 players · 80% annotated (2,744 coded winners)

## What the winners' codes actually are (frequency among annotated winners)
| Category | Count | % |
|---|---|---|
| Ordinal HR milestone (Nth HR / career HR) | 2,013 | 73% |
| DN match | 1,768 | 64% |
| Team gematria value | 1,229 | 44% |
| H2H / vs-split framing (vs AL/NL/LHP/RHP) | 931 | 33% |
| Birthday span (Nd before/after) | 721 | 26% |
| City gematria value | 715 | 26% |
| Name-carrier gematria (Homerun/Dinger = N) | 668 | 24% |
| Written-date / month values | 643 | 23% |
| Planet value | 481 | 17% |
| Jersey number | 358 | 13% |
| Day-name value | 324 | 11% |
| Game-count milestone | 280 | 10% |
| DOY / DLIY | 216 | 7% |
| Days since last HR | 171 | 6% |
| Prime index | 158 | 5% |
| Stadium/park value | 131 | 4% |
| RBI/PA/AB/hit/run/XBH milestone | 66 | 2% |
| Beast/Lucifer/Satan stamps | 10 | <1% |
| Pope | 4 | <1% |
| Jesuit/Mason | 3 | <1% |

Only 15 notes (0.5%) failed to parse — the regex map in scripts/parse-hr-codes.py covers the vocabulary.

## Promotion-discipline findings
1. **The workhorse combo is ordinal-HR-milestone x DN x team value.** That trio is the spine of the logged winners. Everything else is garnish by volume.
2. **Beast/Lucifer/Satan/Pope/Jesuit stamps: 17 notes total out of 2,744.** The Discord feed leans on these heavily; your own logged winners almost never credit them. Under one-occurrence-candidate / multiple-permanent, they stay candidate-tier in this dataset.
3. **Prime index at 5.8%** — index chaining is real but a modifier, consistent with its match-modifier status.
4. **DOY/DLIY at 7%** looks low, but usage grew over the season (recent notes use it far more) — worth a month-by-month split in the engine.

## Exposure-normalized checks (honest reads)
- **DN:** 26.3–31.9 HRs/slate-day, top DN 1/9/8. BUT normalization is per-day not per-game, and slate size varies by weekday — treat as unconfirmed until the engine divides by games played.
- **Moon phase:** First Quarter 31.8/day, Waning Crescent 31.4, Full 31.2 vs Last Quarter 25.0 — quarter/full phases are 3–5 day samples. Suggestive, not signal.
- **Zodiac:** Cancer leads raw (457) but this is confounded by roster birth-month distribution. Needs league-wide DOB baseline before it means anything.
- **Odds:** median +550, mean +603. 254 winners at ≤+300, 185 at >+1000. This distribution is the payout model input.

## THE structural gap (backtest engine design input)
This sheet is **winners only**. Every frequency above answers "what codes did winners have" — not "how often does that code fire without a HR." Nearly any number finds a match post-hoc; hit-rate requires the denominator: for each slate, every rostered batter the same code would have flagged, HR or not. The engine's first job is generating that negative set from the MLB Stats API per date. Without it, no rule can be graded.

## Data issues
- **Team column is dead** — #VALUE! pasted as literal values on every row; the original formula is unrecoverable from the file. Re-derive team from MLB Stats API by (player, date) during backtest ingestion. Do not hand-fix.
- LP column has 'Master' / '22/Master' strings (110 rows) — engine should map to 11/22 or a master flag.
- One LP=0 row; a few trailing-space zodiac values ('Pisces ') — parser leaves them as-is, engine should trim.

## Files
- data/homeruns-2026.json — full normalized dataset, one object per HR, with parsed `codes` tags
- scripts/parse-hr-codes.py — rerun against the workbook when new weeks are added
