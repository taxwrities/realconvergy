# Open questions — morning board pipeline (2026-08-05)

Two spec assumptions in the pipeline task didn't match the repo. Both were
resolved the least-surprising way and are flagged here per the guardrail
("leave a question rather than silently resolving"). Confirm or correct:

## 1. `scripts/landings-scanner.py` was not committed

The task said it was "already committed and working" — it existed only at
`Downloads\landings-scanner.py`. It was copied into `scripts/` **byte-for-byte,
zero logic changes** and committed. If a newer copy exists somewhere else,
replace the committed one.

## 2. trio-scanner's slate is a different schema than landings-scanner reads

`trio-scanner.py` writes `data/slates/{date}.json` as `{games:[{home:"Houston
Astros",...}], hits:[...]}` — no `people`, no per-player season/career stats.
`landings-scanner.py` requires `{games:[{home:{abbrev},homeIds,awayIds}],
people:{id:{fullName,position,season,career}}}` (the shape of the 8/5 session's
hand-built slate / the MLB app's `fetchSlate`).

So the task's "invoke trio-scanner to produce the slate" step cannot work.
Resolution: `run-board.py` builds its own slate at
`data/slates/{date}-landings.json` using the **same statsapi calls as
`apps/mlb/src/data/mlb.js` fetchSlate** (schedule hydrate=probablePitcher,lineups
→ team abbrevs → active-roster fallback → bulk people with career+season
hitting). Trio slates are never read or written by run-board.

**Question:** is statsapi-direct the intended slate source for the morning
board, or should an app-side "export slate" button become the producer?
