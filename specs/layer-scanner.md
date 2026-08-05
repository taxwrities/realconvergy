# LAYER-SCANNER — SPEC v1.1 (2026-08-05)
*Status: LOCKED v1.1 — 2026-08-05. Entertainment framework throughout.*

## 0. PURPOSE
Move the five-layer decode scan (proven in the 8/5/2026 Mesa / PCA / Ohtani retrodiction) out of chat and into a repeatable, version-controlled script. Chat = judgment layer. Scanner = compute layer. Same pipeline shape as trio-scanner: run local → commit → Claude fetches from raw.githubusercontent.com and grades.

## 1. PLACEMENT & INVOCATION
- Path: `layer-scanner.py` at repo root (sibling to trio-scanner.py), shared cipher code imported from a single `lib/gematria.py` extracted from the thread-builder engine (one engine, zero drift).
- Run: `python layer-scanner.py 2026-08-05 --slate data/slates/2026-08-05.json --theme "Mercury=103,40,86,41; Wednesday=100,37,143,44; date=5,23,59,..." [--commit]`
- `--commit` pushes `data/decodes/{date}.json` to GitHub (same flow as trio-scanner).
- Windows: `set PYTHONUTF8=1` documented in header.

## 2. ENGINE DISCIPLINE
- On startup, run the regression block: Jesuit Order must return Ord=144 Red=54 Rev=153 RR=72 Sat=529, plus the 11-anchor block from harvest-founders.mjs. Abort on any drift. No numbers emitted before the checksum passes.
- All 8 ciphers computed (Ord/Red/Rev/RR core; Chal/Sept/Jew/Sat auxiliary). Satanic matching applies per scope rules only (MLB tables; WNBA now approved; never basketball↔baseball bleed).

## 3. MATCH TABLE CONSTRUCTION (per run)
Built fresh each run from:
1. **Theme string** (pasted from theme-builder output) — every number, label preserved.
2. **Standing spine** — date numerology (all formulas), day name, day ruler, day-of-month specials (Nth prime/composite), season-day numbers.
3. **Core institutional table** — engine-computed, never hardcoded values.
4. **Team/venue/city values** for both clubs in each game (all forms × core ciphers; Satanic per scope).
5. **`data/hubbard/patterns.json`** — book-canon labels attached to any matched number (label only; canon numbers do NOT enter the match table by themselves — no ambient matching).
Every match line records its source chain (receipt provenance rule).

## 4. LAYERS (registry architecture)
Each layer is a module registered in `layers/` with a uniform interface: `scan(player, game, table) -> [hits]`. Adding a layer = adding a file. Launch set:

**L1 NAME** — first / last / full × 8 ciphers. Compound and hyphenated surnames additionally split into components (CROW=59/23 rule). Accents NFD-stripped.

**L2 COUNTER** — entering season+career counters for SO H HR 2B 3B BB TB AB PA. Check: entering value itself, +1..+4, and projected realistic finals (landings method). Prime/composite index depth-2 on every checked value. Contamination guard: if slate `exportedAt` > any game's first pitch, tag that game's counters CONTAMINATED in output; clean-source note = Baseball-Reference (never includes current day).

**L3 AGE** — per player from birthDate: age-in-years · days-of-life (+span) · days since last birthday · age-day (since+1) · days to next birthday (+span). All raw + P/C index depth-2. Slate-wide same-birthday pair report (cross-game included).

**L4 CAREER-DAY** — days since MLB debut (+span) + P/C indices. Flag canon-date debuts/birthdays (9/11, 3/22, 201st day of year, etc.) as narrative stamps even when span math is silent.

**L5 EVENT** *(post-game / grading mode only)* — cipher outcome phrases supplied via `--events` file: milestone names, "TWO TRIPLES"-style phrases, final scores spelled out. Never runs pregame (nothing to cipher yet); never edits the pregame decode file — writes `data/decodes/{date}-graded.json`.

**L6 ENTITY** — reserved; see ENTITY-MULTIVERSE.md.

## 5. CONJUNCTION REPORTING (ingredients, not recipes)
- Per player: full hit list per layer + `layersHit` count (independent layers with ≥1 hit).
- NO filtering, NO composite score, NO hiding single-layer players. `layersHit` is displayed data; Tony judges. Neutral default sort = lineup order; `--sort layers` available.
- Candidate-rule note embedded in output header: "8/5/2026 study: winners stacked 2+ independent layers" — informational only.

## 6. OUTPUT SCHEMA `data/decodes/{date}.json`
```
{ schema:"cvg-decode/v1", date, generatedAt, engineChecksum:"pass",
  theme:{string, numbers:[{n,label,source}]},
  games:[{pk, matchTableSize, contaminated:bool,
    players:[{id, name, team, layersHit,
      L1:[{leg,cipher,n,match,source}], L2:[...], L3:[...], L4:[...],
      stamps:[narrative flags], sameBirthday:[ids]}]}],
  sameBirthdayPairs:[[idA,idB,date]] }
```

## 7. HARD DON'TS
- No hidden scoring or opinionated filtering; all knobs user-controlled, neutral defaults.
- No retrofitting: pregame decode freezes at first pitch; grading writes a separate file.
- No basketball values in MLB tables and vice versa.
- No values from memory: engine + checksum only.
- No entity matching outside hook activation (L6, per its own spec).

## 8. LOCKED DECISIONS (v1.1)
*Answered by Tony 2026-08-05. These supersede the v1 proposals. Where a decision
changes a body section rather than confirming it, the affected section is named —
the body text above was NOT rewritten, so on conflict this section wins.*

1. **L2 projected finals — proposal ACCEPTED.** Six checked values per stat per
   scope: the entering value, +1, +2, +3, +4, and one "realistic final" =
   entering + (season per-game rate × 1 game), rounded. *Confirms §4 L2.*

2. **L3 days-of-life — REVISED: do NOT skip raw.** All three of the following
   participate in match checks:
   - raw DoL
   - zero-drop reductions, kept as **two separate reductions** (option C):
     drop-all-zeros (10500 → 15) **and** drop-trailing-zeros-only (10500 → 105)
   - prime/composite index, depth 2

   *Amends §4 L3*, which reads "All raw + P/C index depth-2" and does not carry
   the zero-drop reductions. The v1 proposal to check P/C only is rejected.

3. **WNBA scope — layer-scanner is MLB-scope for v1.** WNBA stays in the WNBA
   tools. *Amends §2*, whose "WNBA now approved" note does not extend to this
   scanner in v1; the §7 no-cross-bleed rule is unaffected.

4. **`--sort layers` — CONFIRMED opt-in.** Neutral default sort is lineup order.
   *Confirms §5.* No change.
