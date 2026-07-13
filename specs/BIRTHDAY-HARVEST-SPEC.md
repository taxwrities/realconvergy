# WNBA birthdays.json — Finish the Harvest (Claude Code handoff)

## Goal
Complete `birthdays.json` (attached, 4 teams done) with verified DOBs for the remaining 11 teams, then push to the public GitHub repo so all tools fetch it from `raw.githubusercontent.com`. DOBs never change — this is a one-time job that permanently removes the DOB dependency from every WNBA tool.

## Already complete (do NOT re-harvest, but fix flagged entries)
- ATL (14), CHI (16), DAL (12), GSV (13)
- Fix: DAL Costanza Verona `"dob": "PENDING"` — pull from her B-Ref or Wikipedia player page. Also confirm DAL has no players alphabetically after Verona (source truncated).
- Fix: verify GSV roster is current (snapshot was early-season; Kate Martin has since moved to LAS dev pool — update her team code or leave with flag).

## Remaining teams
CON, IND, LVA, LAS, MIN, NYL, PHO, POR, SEA, TOR, WAS

## Sources, in order of preference
1. **Basketball Reference team pages**: `https://www.basketball-reference.com/wnba/teams/{CODE}/2026.html` — Roster table has full "Birth Date" column. Team codes: CON, IND, LVA, LAS, MIN, NYL, PHO, POR, SEA, TOR, WAS.
   - **Rate limit hard**: B-Ref bot-blocks after ~4-5 rapid requests. Sleep 15-20s between fetches, set a browser User-Agent, and expect to need retries. This is why the in-chat harvest stopped at 4 teams.
2. **Wikipedia fallback**: `https://en.wikipedia.org/wiki/2026_{Team_Name}_season` — roster template has a DOB column in ISO format. Note: extraction of the roster template is flaky on some pages (rendered empty for Connecticut); if parsing rendered HTML fails, fetch raw wikitext via `?action=raw` and parse the roster template parameters directly.
3. **Per-player fallback** for stragglers: individual B-Ref or Wikipedia player pages.

## Verification rules (mandatory — this feeds date-numerology math)
- Never fill a DOB from model memory. Every DOB must come from a fetched page. (Past sessions produced wrong memory-DOBs for Hillmon, Gray, and Canada before correction.)
- Cross-check any DOB that disagrees between two sources; prefer B-Ref.
- Output ISO `YYYY-MM-DD` only.
- Keep `src` field per entry (`bref` or `wiki`).

## Schema (match existing file exactly)
```json
{ "name": "First Last", "team": "XXX", "pos": "G", "dob": "YYYY-MM-DD", "src": "bref" }
```
Optional `"flag"` for DP/unsigned, dev-contract, or team-moved notes. Diacritics stripped from names (Kone not Koné) so lookups match ASCII input from the tools; if a tool needs the accented form, normalize on lookup, not in the file.

## Deliverables
1. Completed `birthdays.json` (~170-190 players, all 15 teams).
2. Push to public GitHub repo (the planned permanent-DOB repo), path `birthdays.json` at repo root.
3. Print the `raw.githubusercontent.com` URL for the tools to consume.
4. Sanity check: count per team (11-13 each), zero `PENDING`, all dates parse, no duplicate names.

## Tool integration (after push — separate small task)
- WNBA first-basket tool (`serene-meringue-6bd588.netlify.app`) and WNBA daily tool: on load, fetch the raw GitHub URL, build a `name → dob` map, drop the per-player DOB paste field. Keep a manual-override input for players not in the file (mid-season signings) and log misses to console so the JSON can be patched.
