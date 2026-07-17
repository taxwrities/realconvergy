# Brief: career month / day-of-week game counts for the MLB convergence app

> **RESOLVED 2026-07-16 — no game-log architecture needed for splits.**
> `/api/v1/situationCodes` DOES carry month codes (plain numbers `1`–`10`) and
> weekday codes (`dsu`…`dsa`), and `careerStatSplits` accepts them: Baty
> `sitCodes=7` → career-July G=58 HR=7, `sitCodes=dth` → career-Thursday G=44 —
> exact hand-count matches, full stat lines, and they piggyback on the app's
> EXISTING bulk DEEP call (`sitCodes=[val,vnl,<month>,<dowCode>]`) at zero
> extra requests. Shipped: `deep.monthCareer`/`deep.dowCareer`, month/dow
> pattern scopes emit season + career bases. The only game-log piece kept from
> the external suggestion: a one-call prior-season fallback for cross-season
> `sinceLast:HR` (sitCodes can't yield dates). The brief below is retained as
> the problem history.

Self-contained problem statement — written to be pasted to another assistant for
solution ideas. All API facts below were live-verified against statsapi on
2026-07-16.

## Context

React/Vite app (`apps/mlb` in the realconvergy monorepo) for gematria-based MLB
prop analysis. A pure "pattern engine" evaluates recipes like *counter = source*
against per-batter stats, e.g. "the next career-July games-played count lands on
the batter's own name gematria." Data comes from the free, keyless
`statsapi.mlb.com` (CORS-open, fast, no hard rate limit observed). Two fetch
tiers, and this is a **house rule**: a cheap **slate load** (all games, hydrated
career/season hitting totals per batter), and an on-demand per-game **DEEP tier**
(currently: career-vs-opponent totals, current-season by-month and by-day-of-week
splits, current-season game log, league splits — about 2 calls per batter plus one
bulk call per 50). Never slate-wide deep fetching. Heavy mobile use; results are
cached in localStorage.

## The gap

Real pattern lines count **career** games in a month or on a weekday:

> "Brett Baty … **58th July game** … can hr … in **44th Thursday game**, 63d
> since his last."

Those are career-cumulative counts (career July games = 57 entering tonight,
career Thursday games = 43). The app can only resolve **current-season**
month/day-of-week splits (July G=12, useless here).

## Verified API facts (probed live 2026-07-16, player 683146 = Brett Baty)

- `stats=byMonth&group=hitting` with **no** season param → current season only.
- `/api/v1/statTypes` contains `byMonth`, `byMonthPlayoffs`, `byDayOfWeek`,
  `byDayOfWeekPlayoffs`, `career`, `careerRegularSeason`, `careerStatSplits`,
  `careerPlayoffs` — **no careerByMonth / careerByDayOfWeek**.
- `stats=careerByMonth,careerByDayOfWeek` → silently returns nothing.
- `stats=byDateRange&startDate=2022-01-01&endDate=2026-07-16&month=7` → ignores
  the month filter, returns the whole range aggregated (G=393). No month slicing.
- `careerStatSplits` + `sitCodes` works for vs-league (`val`/`vnl`) — unknown
  whether any month/weekday sitCodes exist (worth checking `/api/v1/situationCodes`).
- `stats=byMonth,byDayOfWeek&group=hitting&season=YYYY` in one call returns both
  split families for that season.
- Season game logs: `stats=gameLog&group=hitting&season=YYYY` (already used for
  current season).

## Baseline plan (works, priced out)

Per batter, fetch `byMonth,byDayOfWeek` for each **prior** season once (current
season already fetched), sum with the live current-season split. Prior seasons
are **immutable → cache the derived counts forever** in localStorage (~50 bytes
per player: career games by month[12] and by weekday[7]). Cost: ~26 batters ×
~4–5 prior seasons ≈ 100–130 one-time calls on a game's first DEEP (~3–5 s at
6-way concurrency); zero for any player ever deep-fetched before. Engine change
is tiny: the month/dow scopes emit two candidate bases (season + career), same
as the existing venue scope. Debut year needed per player (bulk
`people?personIds=…&hydrate=mlbDebutDate` or similar).

## Constraints

- No engine redesign; the condition grammar stays. Additive localStorage shapes
  only (saved patterns must keep loading).
- DEEP stays per-game on-demand. Mobile-first; first-DEEP latency should stay
  under ~5 s with visible progress text.
- Counting stats only. Numbers must exactly match reference tools
  (StatMuse/bbref-style career splits) — off-by-one vs the user's hand counts is
  a bug. Open question: do the user's counts include playoff games? (bbref
  splits are regular-season; `byMonthPlayoffs` exists separately if needed.)

## Where creative ideas are welcome

1. A cheaper endpoint or hydration trick for career month/weekday splits in one
   or few calls (multi-season `seasons=[…]` hydration? undocumented sitCodes?
   team-schedule × appearances join?).
2. Whether to build from **game logs** instead (1 call per player-season, same
   count as baseline, but also yields cross-season "days since last HR" — the
   current sinceLast counter is blind before this season — plus career game #,
   H2H career counts). Same immutable-cache property. Is the richer derived set
   worth the bigger payloads?
3. Cache-warming strategy for a big slate: e.g. background-fill career caches
   for tomorrow's probable lineups overnight or while the user works one game —
   WITHOUT violating "deep is per-game on-demand" in spirit (bandwidth is fine;
   the rule exists to keep the initial slate load fast).
4. Storage layout for the cache (per-player doc keyed by "through-season" so a
   new season invalidates only the current-season addend, never the immutable
   prefix).
5. Anything that avoids N-per-player calls entirely.
