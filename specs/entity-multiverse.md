# ENTITY-MULTIVERSE — SPEC v1.1 (2026-08-05)
*Status: LOCKED v1.1 — 2026-08-05. Generalizes founders.json into a typed, hook-gated entity registry. Entertainment framework throughout.*

## 0. PURPOSE
A permanent library of historical/institutional figures (founders, scientists, masons, popes, celebrities) with locked cipher values and dates, that the layer-scanner can activate — **only via hooks** — for daily decode and reverse-engineering studies. Core principle inherited from QUERY-FIX-1: an entity never matches against every player unconditionally. No hook = not in the pool, regardless of match quality.

## 1. REGISTRY LAYOUT
```
data/entities/
  registry.json          # all entities, typed
  hooks/state-routing.json   # existing geo gate, unchanged
```
founders.json v4 migrates into registry.json as `type:"founder"` (fields preserved 1:1, including granularity tags and admission_order). founders.json remains until query.html + historian jobs are repointed; then deprecated. Nothing about the founders hook model changes.

## 2. ENTITY SCHEMA
```
{ id:"tesla-nikola", type:"scientist",          // founder|scientist|mason|pope|institution|celebrity|athlete-historic
  name:"Nikola Tesla", altNames:["Tesla"],
  birth:{date:"1856-07-10", granularity:"day", source:"<url>"},
  death:{date:"1943-01-07", granularity:"day", source:"<url>"},   // NEW: death date = first-class hook
  ciphers:{ name:{Ord,Red,Rev,RR,Chal,Sept,Jew,Sat}, lastName:{...}, alt:{...} },  // harvester-computed only
  flags:{ mason:false, jesuitEducated:false },
  ties:{ states:["NY"], cities:["New York"], teams:[], venues:[] },   // geo/team hooks, gated by state-routing
  notes:"AC power; 3-6-9 canon figure",
  date_status:"locked" }
```
Rules carried over: granularity "year" entries excluded from day-span math; decoder-export requires `date_status:"locked"` + source URL; harvester regression block aborts on cipher drift; every value engine-computed at harvest, never hand-entered.

## 3. HOOK MODEL (activation gates — the whole point)
An entity enters a given day's pool ONLY via:
- **H1 date hook:** birthday or death anniversary = today; OR a span from birth/death (both modes, days and weeks) lands exactly on a number already in the day's field (theme/date/day-ruler). The span landing on a field number is the gate — not "any interesting number."
- **H2 theme hook:** Zach's post names the entity (or their signature work). Manual confirm required (theme-builder output lists them).
- **H3 geo/team hook:** entity's ties intersect the game's park_state/home_state/city/team per state-routing.json. Same gate discipline as state values today: no confirmed routing = excluded.
- **H4 manual:** `--activate tesla-nikola` for deliberate studies (reverse-engineering mode).
Every active entity carries `activation:{hook, evidence}` in the decode output — the receipt chain shows which gate opened and why. Dormant entities produce zero output.

## 4. SCANNER INTEGRATION (Layer L6)
For each ACTIVE entity × each player in hooked games:
- name-value mirrors (entity cipher = player cipher, exact same-cipher weighted highest — mirrors existing cross-sport anchor rule)
- entity values vs player counter landings (L2 values)
- entity birth/death spans vs player age-layer numbers (L3 values)
Output grouped under the entity with full provenance. L6 hits count as one independent layer in `layersHit`.

## 5. REVERSE-ENGINEERING MODE
`python layer-scanner.py --retro 2026-08-05 --events data/events/2026-08-05.json --activate <ids|auto>`
`auto` = H1/H2/H3 gates evaluated for the historical date. Output goes to `data/decodes/{date}-retro.json`, clearly labeled retrodiction; findings feed candidate-rules.md at one-occurrence status per promotion discipline. Retro findings never retrofit frozen cards or promote themselves.

## 6. HARVESTER EXTENSION
Extend `scripts/harvest-founders.mjs` → `harvest-entities.mjs`:
- adds `type`, `death`, `flags`, `ties`, `altNames`
- same 11-anchor regression block + abort-on-drift
- per-entity source URL required for both birth and death dates
- covers the pending founders backport (full MLB team founding dates via Date Decoder) as `type:"institution"` entries — closes that open item inside this framework.

## 7. SEED LIST (harvest batch 1 — confirm/edit)
- Existing 130+ founders (migration, no re-harvest)
- Scientists: Tesla, Edison, Einstein, Newton, Galileo, Copernicus, Darwin, Franklin (dual-typed founder/scientist)
- Masons/canon figures: Albert Pike, George Washington (dual-typed), Ben Franklin, Adam Weishaupt
- Institutional: Superior General (b. 1948-11-12), Pope Leo XIV, MLB founding, each current MLB franchise founding date
- Tony adds names by appending to a `seed.txt`; harvester does the rest.

## 8. HARD DON'TS
- No ambient matching. No hook = no pool. Ever.
- No hand-typed cipher values in the registry; harvester only.
- No silent resolution of spec conflicts — surface as questions.
- No treating retro "hits" as predictive without promotion-ladder confirmations.

## 9. LOCKED DECISIONS (v1.1)
*Answered by Tony 2026-08-05. These supersede the v1 proposals. Where a decision
changes a body section rather than confirming it, the affected section is named —
the body text above was NOT rewritten, so on conflict this section wins.*

1. **H1 span gate — REVISED, wider than proposed:** days **+ weeks + months +
   concatenated combo forms.** The combo form is **Y-M-W-D order only** — e.g.
   "6 years 6 months 6 weeks 0 days" concatenates to `6660`. **No permutations
   in v1.** *Amends §3 H1*, which reads "both modes, days and weeks."

2. **Death-anniversary hooks — SLATE-WIDE.** Date hooks are date-scoped, not
   geo-scoped, so an H1 activation applies to every game on the slate rather
   than only geo-hooked ones. *Confirms §3 H1.* H3 remains geo-gated.

3. **Seed list batch 1 — APPROVED as listed** in §7: the existing 130+ founders
   (migration, no re-harvest); Tesla, Edison, Einstein, Newton, Galileo,
   Copernicus, Darwin, Franklin (dual-typed); Albert Pike, George Washington
   (dual-typed), Ben Franklin, Adam Weishaupt; Superior General, Pope Leo XIV,
   MLB founding, and every current MLB franchise founding date. Tony will
   revisit the list later. *Confirms §7.*

4. **Cap on simultaneous active entities — NONE.** The hooks are the cap;
   revisit only if daily output gets noisy. *Confirms §3.*

5. **Dual-typing — ONE entry; `type` becomes an ARRAY.** Franklin =
   `type: ["founder", "scientist"]`. *Amends §2*, whose schema example still
   shows a single string (`type:"scientist"`) — read that field as an array.
   The harvester (§6) and any consumer must treat `type` as a list.
