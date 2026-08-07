# ENTITY-THREADS.md — Entity Thread Block in the Daily Theme

*Status: DRAFT v1 — 2026-08-06. Extracted from DECODE-CHAT amendment #4 after
repeated live misses (Young 157, Sheets 80, Ty France 124/81) traced to thread
values living in conversation instead of the machine.*

## Problem

Entity layers (Hiroshima/Oppenheimer, Truman/Masonic, 509th Group) are built
each morning in chat but never enter the theme JSON. Scanners, boards, and
DECODE-CHAT match only the base field key, so entity-signed players surface
postgame instead of pregame. Hand-carried hot-sets also drift between scans
(124 present in one scan, absent the next — confirmed failure mode tonight).

## Schema (theme JSON addition)

```json
"entity_threads": [
  { "label": "Hiroshima 81st",
    "values": [81, 86, 100, 143, 39, 60, 35, 37, 80, 124, 212, 218, 32],
    "provenance": {
      "81": "81st anniversary",
      "86": "Robert Oppenheimer RR; 8/6 date stamp",
      "100": "Hiroshima Ord; Thursday RevOrd",
      "39": "Little Boy Red; Pope Leo",
      "60": "Atomic Bomb RR; top date num",
      "35/37/80": "Enola Gay = Triple (O/R/RR twins)",
      "124": "Oppenheimer Ord",
      "212": "J Robert Oppenheimer Ord",
      "218": "Destroyer of Worlds RevOrd; day-of-year",
      "32": "Bomb Ord"
    },
    "hook": "date-anniversary",
    "expiry": "2026-08-09",
    "carryover_note": "Fat Man 55/19/35 + 509/97 reload for Nagasaki 8/9" },
  { "label": "Truman-Masonic",
    "values": [24, 87, 90, 223, 42, 48, 96, 144, 39],
    "provenance": {
      "24": "Truman Red; date num",
      "223": "days after Truman death; Masonic/322 mirror",
      "42/48/96/144": "Freemason O/RR-family; Jesuit Order",
      "87": "Truman Ord",
      "90": "days after Truman bday; Jupiter RevOrd"
    },
    "hook": "span + confirmed landings (Neto 223, Bleday 223, Elly 42)",
    "expiry": "2026-08-07",
    "carryover_note": "223 -> 224 tomorrow; re-derive spans daily" },
  { "label": "509th Composite Group",
    "values": [509, 97],
    "provenance": {
      "509": "bomb delivery unit",
      "97": "509 = 97th prime; Athletics Ord"
    },
    "hook": "unit designation",
    "expiry": "2026-08-09" }
]
```

## Rules

1. **AUTHORSHIP**: threads are curated in the morning theme build (user +
   Claude in chat) and written to the theme JSON before the board runs. Models
   downstream NEVER invent thread values; scanners never auto-add.
2. **HOOK GATE**: every thread carries a hook type (date-anniversary, span,
   geography, theme-mention, confirmed-landing). No hook = no thread — same
   discipline as state-routing.json.
3. **MATCHING**: thread values merge into the field key for ALL matching
   (scanner landings, name-cipher cross-ref, V2 family expansion, DECODE-CHAT).
   Every match line prints the thread label as provenance:
   "124 [Oppenheimer ← Hiroshima 81st]".
4. **EXPIRY**: threads carry an expiry date; expired threads drop from matching
   automatically. Span-derived values (223-class) recompute daily, not carry.
5. **MID-DAY ADDITIONS**: threads discovered live (Truman was found
   mid-morning) append to the JSON and a board re-run is allowed, BUT frozen
   Tier-1 cards do not mutate — new-thread matches grade as live notes
   (existing house rule).
6. **WEIGHTING**: thread matches rank equal to base-field d1 hits; they do not
   outrank exclusive-fit or Lopez distance rules from V2.
7. **PROMOTION**: a thread that produces graded receipts on 2+ sessions can
   graduate values into candidate-rules.md (e.g. anniversary-number =
   name-value class).

## Workflow (tomorrow morning)

1. Paste Zach's post → build theme (existing skill).
2. Build/refresh entity threads: recompute spans, apply expiry, add new hooks.
3. Write theme JSON WITH entity_threads → commit.
4. Board + DECODE bundles inherit automatically. No hand-carried hot-sets
   anywhere — the JSON is the single source of truth.

## Receipts justifying (2026-08-06)

Cashed thread-values the machine never held: Young RO=157/RBI→39, Wong H→37,
Sheets cHR→80 (pending), Ty France 124+parked-81, Meidroth H→110=c#80,
B. Montgomery H→39, Yoshida PA→c#39, Serven RBI→24, Benintendi 77=c#55-adjacent,
Neto 223, Bleday 223. Eleven receipts, zero pregame machine coverage.

## BUILD NOTES (2026-08-06 first build)

- landings-scanner reads `entity_threads` from `--theme-file`; values merge
  into the base field BEFORE V2 family expansion, so p#/c#/0strip members and
  d2/d3 chains inherit thread provenance automatically (rule 3). Weighting is
  automatic equality: a thread value is a field member like any date num
  (rule 6).
- Expiry enforced in the scanner: a thread is active while slate date ≤ expiry
  (Nagasaki threads stay live ON 8/9); expired threads are listed on the board
  header as dropped (rule 4). Hook gate enforced: a thread without a `hook`
  is skipped with a stderr warning (rule 2).
- Provenance keys may be slash-compound ("35/37/80") — each component maps to
  the shared text. A value with no provenance entry prints "thread value".
- run-board now hands the scanner the theme FILE (numbers + threads) instead
  of flattening to a --theme csv; --theme on the CLI remains for ad-hoc extras.
  This kills the hand-carry drift for good: the JSON is the only source.
