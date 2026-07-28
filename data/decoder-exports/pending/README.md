# pending/ — staged founders artifacts, NOT wired into the decoder

Files here are received-but-not-live. Nothing imports them. They are parked so the
data isn't lost while the questions below get settled.

## founders-v4.json / states-section-v4.json

Delivered 2026-07-28 described as "the locked v4 founders dataset," to be dropped on
`data/decoder-exports/founders-locked.json`. That was not done, for three reasons:

1. **It is not a locked export.** `founders-locked.json` is a *filtered* artifact —
   `date_status === "locked"` entries with a source URL, per
   `specs/founders-historian.md`: "The decoder imports ONLY this file, never
   `founders.json`." `founders-v4.json` is a full unfiltered founders.json (all
   sections, all statuses). Writing it over the locked export puts non-locked
   entries inside the locked-only gate that `apps/mlb/src/engine/founders.js` and
   `apps/mlb/public/query.html` both consume.

2. **Its states would regress from locked to verify.** Repo states: 52 entries,
   `date_status: "locked"` (verified in `89770f4` — "run Jobs 1-2 (verify seed +
   team/state harvest)"). v4 states: 51 entries, `date_status: "verify"`, each
   carrying `"Drafted from model knowledge; harvest agent must confirm against
   fetched page then flip to locked per _meta rules."` Per `_meta.rules`, verify
   entries are "NOT decoder-usable" — the states layer would go dark.

3. **Both targets are generated files.** `scripts/harvest-founders.mjs` regenerates
   `data/founders.json` *and* `data/decoder-exports/founders-locked.json` from
   `scripts/founders-seed.json`. A hand-placed file is overwritten on the next run.

## What v4 actually has that the repo doesn't

- **Ontario dropped from `states`** (52 → 51). Correct — Ontario is not a US state,
  and `data/state-routing.json` says so explicitly: "Toronto Blue Jays: Ontario is
  not a US state; no states-layer hook exists."
- Per-entry `founded_event`, `granularity`, and `note` fields.

## The right way to land it

Port those deltas into `scripts/founders-seed.json` (drop Ontario, add the new
fields), keep `date_status: "locked"` on the already-verified states, then re-run
`node scripts/harvest-founders.mjs` so both generated files come out consistent.
That is a seed edit + regeneration, not a file drop — left for Tony to greenlight.
