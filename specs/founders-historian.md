# founders-historian.md — Agent Spec v1

Sibling agent to `theme-historian`. Owns the founders/rituals reference layer.

## Ownership

- **Repo:** `github.com/taxwrities/realconvergy`
- **Owns:** `data/founders.json` (schema below). Nothing else writes to this file. Sits alongside `birthdays.json` and `wnba-h2h.json` as a build-time import for both apps.
- **This spec lives at:** `specs/founders-historian.md` (committed — recovery path).
- **Reads:** `candidate-rules.md`, daily theme output from theme-historian.
- **Feeds:** MLB Date Decoder duration engine, pregame rankers (ritual-layer flags), stream-scribe (ritual vocabulary).

## Prime Directive — Date Discipline

**Every date must come from a fetched page. Never model memory.** Same rule as the B-Ref DOB harvest — past sessions produced wrong dates from memory.

- A date is only usable by the decoder when `date_status: "locked"` AND `source` contains the URL it was fetched from.
- Seed file ships with most dates at `"verify"` — these were drafted from model knowledge and are **not trusted** until confirmed against a fetched page.
- Team founding dates ship as `"harvest"` (blank) — fill only from fetched pages.
- Sleep 15–20s between requests to any single domain (B-Ref rule generalized).
- Acceptable sources: Wikipedia, Baseball-Reference/Basketball-Reference franchise pages, official league/team pages. Record the exact URL in `source`.
- If two sources conflict, record both in `note`, keep `date_status: "verify"`, flag for Tony.

## Cipher Discipline

- All cipher values computed programmatically via `packages/gematria-core` (the shared engine + checksum). The harvest script imports it — no second cipher implementation may exist in `scripts/`. **Never from memory.**
- Cipher order everywhere (gematria-core native keys): `Ord / Red / Rev / RR / Sat / RevSat / Chal / Sept / Latin`.
- Regression anchors that must pass before any write (abort on failure):
  (implemented — 11 anchors incl. core checksum + Baltimore Orioles Jewish=601)
  - Atlanta Braves Ord = 136
  - Society of Jesus Satanic = 681, Ord = 191
  - Freemasonry Satanic = 524, Ord/Red = 139/58
  - Church of Satan = 137/56, RevOrd = 214
  - Skull and Bones = 149/41, RevOrd = 202
  - Scottish Rite Satanic = 585
  - WNBA Ord = 40
  - Kobe Bryant = 113/41; Kobe Bean Bryant = 135/54
- NFD-normalize and strip diacriticals before ciphering (implemented in harvest-founders.mjs `norm()`).

## Schema (`data/founders.json`)

```
_meta: { version, cipher_order, date_status_values, rules }
<category>: [
  {
    name, founded (YYYY-MM-DD | YYYY | ""),
    date_status: locked | verify | harvest | legendary | n/a,
    source: "<url>",
    founder?, founder_ciphers?,
    doc_main_numbers?: [...],   // rituals only — Tony's doc values, verbatim
    note?,
    ciphers: {ord, red, rev_ord, rev_red, satanic, chaldean},
    // teams only:
    sport?, city_ciphers?, nickname_ciphers?
  }
]
```

Categories: `rituals`, `secret_societies`, `institutional`, `sports_founders`, `tribute_figures`, `mlb_teams`, `wnba_teams`.

`doc_main_numbers` are recorded verbatim from Tony's rituals doc and are **not** recomputed — they may span ciphers not in the standard six (e.g. Church of Satan 669, attribution unresolved). Tracing unresolved attributions is a standing agent task; log findings in `note`, never overwrite doc values.

## Jobs

### Job 1 — Verify seed (one-time, priority)
Walk every `verify` entry, fetch a source, confirm or correct the date, set `locked` + `source`. Batch by domain with sleeps. Output a diff summary for Tony before committing.

### Job 2 — Team founding harvest (one-time)
Fill `founded` for all 30 MLB + 15 WNBA teams from franchise pages. For relocated/renamed franchises record BOTH original franchise founding and current-identity date in `note` (e.g. Braves: Boston 1871 lineage vs Atlanta 1966 — the doc's Braves=136 example implies Tony may want a specific one; **ask, don't assume** which anchors the duration probe).

### Job 3 — Append on request (ongoing)
Session command: `add founder <name> [founded <date>] [category <cat>]`.
Compute ciphers, fetch date if not supplied, append. One-line confirmation.

### Job 4 — Decoder feed (ongoing)
**Gate enforced at data layer:** the harvester emits `data/decoder-exports/founders-locked.json` — pre-filtered to `date_status === "locked"` with a `source`, each entry tagged `granularity: "day" | "year"`. The decoder imports ONLY this file, never `founders.json`. Year-granularity entries are excluded from day-span probes (year counts only) until Job 1 upgrades them.

Expose to the Date Decoder duration engine, per game date:
1. **Days-since-founding** for every `locked` entity → check landings against the day's thread numbers, ritual main numbers, and T-family values.
2. **Birthday spans** (tribute figures + any player DOBs passed in): days before/after birthday vs main numbers — **322 check always runs** (most-used ritual).
3. **Prime/composite index** on every span (Double-Core-Chain rule applies).
4. **City-bridge pass**: entity city ciphers vs team city ciphers for cross-sport routing.
Output: flat probe list `{entity, span_days, landing_value, matched_table, cipher}` — decoder owns presentation.

### Job 5 — Match logging (ongoing)
Any ritual-layer hit that confirms in a live session → append to `candidate-rules.md` with date + game. Promotion discipline unchanged: 1 session = candidate, 2 = conditional, multiple = permanent. The founders layer itself never promotes rules — it only supplies evidence.

## Scope Guardrails

- Rituals/founders layer is **auxiliary narrative** (same status as Satanic cipher ruling in MLB). It never overrides Live AB Protocol, skip-gate, or profile-fit rules. A ritual sync on a no-power bat is still a SKIP.
- Sport cipher-scope rules hold: MLB analysis draws from `mlb_teams` + `rituals` + `institutional` + `sports_founders` (MLB entries); WNBA from `wnba_teams` + same shared layers. Never cross team tables.
- NHL/NFL entities from the source doc are **excluded** until those sports enter scope.

## Session Commands

- `harvest founders` — run Jobs 1–2
- `add founder <name>` — Job 3
- `probe founders <date>` — Job 4 for a given slate date
- `founders status` — counts by date_status, unresolved attributions

## Build Notes (Claude Code)

- Harvest script: `scripts/harvest-founders.mjs` (BUILT — sibling to harvest-birthdays.mjs / harvest-h2h.mjs). Imports `packages/gematria-core` directly; NFD-normalizes before ciphering (core drops non a-z, so accents must be stripped first). Seed data in `scripts/founders-seed.json`; the .mjs regenerates `data/founders.json` from it. Jobs 1–2 edit the seed (dates + sources), then re-run the script.
- Writes `data/founders.json` via temp file + atomic rename; `node --check` before commit.
- Regression anchor block runs at script start; abort all writes on any failure.
- Apps consume via build-time import from `data/`, same as the other registries — no runtime fetch needed.
