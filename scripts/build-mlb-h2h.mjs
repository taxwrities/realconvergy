// build-mlb-h2h.mjs — one-time MLB historic head-to-head crawler (MLB-PARITY.md §8).
// Pattern mirrors harvest-h2h.mjs: crawl once → static data/mlb-h2h.json → app
// live-tops-up the current season from the slate's own per-pair season series.
//
// One statsapi schedule call per season (1901..cutoff year, gameTypes=R), raw
// responses cached to scripts/cache/ so re-runs are free. Reduction is keyed by
// statsapi team id, which is franchise-stable across relocations (verified:
// Expos→120, Brooklyn→119, Browns→110, NY Giants→137, Phil. A's→133). Ids not
// in the current-30 table (e.g. 298 = defunct 1901-02 AL Orioles) are counted
// into team totals but produce no pair records, and are reported loudly.
//
// Counting rules (matches Tony's MLB Date Decoder, fixtures in
// data/decoder-exports/): regular season only, Final games only, deduped by
// gamePk (suspended/resumed games appear on multiple dates), ties = equal
// final scores, cutoff date EXCLUDED ("entering" convention).
//
// Run: node scripts/build-mlb-h2h.mjs [cutoff-date]   (default 2026-07-16)

import fs from "node:fs";
import path from "node:path";
import {MLB_TEAMS} from "../apps/mlb/src/data/teams.js";

const CUTOFF = process.argv[2] || "2026-07-16"; // games strictly BEFORE this date
const FIRST_SEASON = 1901;
const LAST_SEASON = +CUTOFF.slice(0, 4);
const CACHE = path.join(import.meta.dirname, "cache");
const OUT = path.join(import.meta.dirname, "..", "data", "mlb-h2h.json");
fs.mkdirSync(CACHE, { recursive: true });

const API = "https://statsapi.mlb.com/api/v1";
const FIELDS = "dates,date,games,gamePk,officialDate,gameType,status,abstractGameState,teams,home,away,team,id,name,score";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function season(y) {
  const f = path.join(CACHE, "mlb-sched-" + y + ".json");
  // never cache the in-progress season — it must re-fetch to honor CUTOFF
  const cacheable = y < LAST_SEASON;
  if (cacheable && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const url = `${API}/schedule?sportId=1&season=${y}&gameTypes=R&fields=${FIELDS}`;
  for (let a = 0; ; a++) {
    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      if (cacheable) fs.writeFileSync(f, JSON.stringify(d));
      return d;
    }
    if (a >= 3) throw new Error(`statsapi ${r.status} for season ${y}`);
    await sleep(1500 * (a + 1));
  }
}

const abbrevOf = (id) => MLB_TEAMS[id]?.abbrev || null;
const pairKey = (a, b) => [a, b].sort().join("|");

const pairs = {}; // key -> {games,wins:{},ties,home:{ab:{W,L}},away:{ab:{W,L}},firstMeeting,lastMeeting}
const totals = {}; // abbrev -> {games,W,L,T,home:{games,W,L},away:{games,W,L}}
const unknownIds = {}; // id -> {name, games}
const perSeason = {};

function totalsFor(ab) {
  return (totals[ab] ??= { games: 0, W: 0, L: 0, T: 0,
    home: { games: 0, W: 0, L: 0 }, away: { games: 0, W: 0, L: 0 } });
}

function countTeam(ab, side, res) { // res: 'W'|'L'|'T'
  const t = totalsFor(ab);
  t.games++; t[res]++;
  t[side].games++;
  if (res !== "T") t[side][res]++;
}

function countPair(homeAb, awayAb, res /* 'home'|'away'|'tie' */, date) {
  const key = pairKey(homeAb, awayAb);
  const p = (pairs[key] ??= { games: 0, wins: {}, ties: 0,
    home: {}, away: {}, firstMeeting: null, lastMeeting: null });
  p.home[homeAb] ??= { W: 0, L: 0 }; p.home[awayAb] ??= { W: 0, L: 0 };
  p.away[homeAb] ??= { W: 0, L: 0 }; p.away[awayAb] ??= { W: 0, L: 0 };
  p.wins[homeAb] ??= 0; p.wins[awayAb] ??= 0;
  p.games++;
  if (res === "tie") p.ties++;
  else if (res === "home") { p.wins[homeAb]++; p.home[homeAb].W++; p.away[awayAb].L++; }
  else { p.wins[awayAb]++; p.away[awayAb].W++; p.home[homeAb].L++; }
  if (!p.firstMeeting || date < p.firstMeeting) p.firstMeeting = date;
  if (!p.lastMeeting || date > p.lastMeeting) p.lastMeeting = date;
}

const seen = new Set(); // gamePk dedupe across resume dates + seasons

for (let y = FIRST_SEASON; y <= LAST_SEASON; y++) {
  const d = await season(y);
  let fetched = 0, counted = 0;
  for (const day of d.dates || []) {
    for (const g of day.games || []) {
      fetched++;
      if (g.gameType !== "R") continue;
      if (g.status?.abstractGameState !== "Final") continue;
      const date = g.officialDate || day.date;
      if (!date || date >= CUTOFF) continue;
      if (seen.has(g.gamePk)) continue;
      const hs = g.teams?.home?.score, as = g.teams?.away?.score;
      // postponed games list a scoreless "Final" entry on the original date and
      // the scored one on the makeup date under the SAME gamePk — mark seen only
      // once a scored entry is counted, so the makeup instance isn't lost.
      if (hs == null || as == null) continue;
      seen.add(g.gamePk);
      const hId = g.teams.home.team.id, aId = g.teams.away.team.id;
      const hAb = abbrevOf(hId), aAb = abbrevOf(aId);
      for (const [id, ab, t] of [[hId, hAb, g.teams.home.team], [aId, aAb, g.teams.away.team]]) {
        if (!ab) { (unknownIds[id] ??= { name: t.name, games: 0 }).games++; }
      }
      const res = hs === as ? "T" : hs > as ? "H" : "A";
      if (hAb) countTeam(hAb, "home", res === "T" ? "T" : res === "H" ? "W" : "L");
      if (aAb) countTeam(aAb, "away", res === "T" ? "T" : res === "A" ? "W" : "L");
      if (hAb && aAb) countPair(hAb, aAb, res === "T" ? "tie" : res === "H" ? "home" : "away", date);
      counted++;
    }
  }
  perSeason[y] = { fetched, counted };
  process.stdout.write(`${y}: ${counted}/${fetched} counted (${seen.size} total)\n`);
  await sleep(150);
}

// ---- assemble output (schema mirrors data/wnba-h2h.json + ties/home/away) ----
const lineage = {};
for (const [id, t] of Object.entries(MLB_TEAMS))
  lineage[id] = { id: t.abbrev, identities: t.identities };

const out = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    seasons: [FIRST_SEASON, LAST_SEASON],
    through: CUTOFF, // games strictly before this date ("entering" convention)
    source: "statsapi.mlb.com /schedule gameTypes=R; Final games, gamePk-deduped; ties = equal final scores",
    perSeason,
  },
  lineage,
  pairs: Object.fromEntries(Object.entries(pairs).sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, p]) => [k, { regularSeason: p }])),
  teamTotals: Object.fromEntries(Object.entries(totals).sort(([a], [b]) => a < b ? -1 : 1)),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\nwrote ${OUT} — ${Object.keys(pairs).length} pairs, ${seen.size} games`);

if (Object.keys(unknownIds).length) {
  console.log("\n⚠ ids outside the current-30 table (counted in NOTHING pair-wise, reported only):");
  for (const [id, u] of Object.entries(unknownIds)) console.log(`  ${id} ${u.name}: ${u.games} games`);
}

// ---- fixture verification (data/decoder-exports/date-decode-2026-07-16.txt) ----
const nymphi = pairs["NYM|PHI"];
if (nymphi) {
  const f = { games: 1100, nymW: 534, nymL: 565, ties: 1, homeW: 276, homeL: 271, awayW: 258, awayL: 294 };
  const got = {
    games: nymphi.games, nymW: nymphi.wins.NYM, nymL: nymphi.wins.PHI, ties: nymphi.ties,
    homeW: nymphi.home.NYM.W, homeL: nymphi.home.NYM.L,
    awayW: nymphi.away.NYM.W, awayL: nymphi.away.NYM.L,
  };
  const ok = Object.keys(f).every((k) => f[k] === got[k]);
  console.log(`\nNYM|PHI fixture ${ok ? "✓ MATCHES" : "✗ MISMATCH"}:`, JSON.stringify(got));
  if (!ok) console.log("  expected:", JSON.stringify(f));
}
for (const [ab, f] of Object.entries({
  PHI: { games: 19532, W: 9144, L: 10312, T: 76 },
  NYM: { games: 10229, W: 4936, L: 5279, T: 14 },
  NYY: { games: 19267, W: 10919, L: 8256, T: 92 },
  BOS: { games: 19554, W: 10081, L: 9384, T: 89 },
  MIL: { games: 9094, W: 4461, L: 4626, T: 7 },
})) {
  const t = totals[ab];
  const ok = t && t.games === f.games && t.W === f.W && t.L === f.L && t.T === f.T;
  console.log(`${ab} totals ${ok ? "✓" : "✗"}: got ${t?.games}g ${t?.W}W ${t?.L}L ${t?.T}T, want ${f.games}g ${f.W}W ${f.L}L ${f.T}T`);
}
