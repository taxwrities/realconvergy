// harvest-h2h.mjs — one-time WNBA historic head-to-head harvester (WNBA-REDESIGN-SPEC §4).
// Pattern: harvest once → static data/wnba-h2h.json → apps live-top-up the current season.
//
// Loops BDL /wnba/v1/games?seasons[]=Y for 1997..2025 through the same-origin-style proxy
// (the key lives in Netlify env; this script goes through the deployed function). Raw season
// responses cache to scripts/cache/ so re-runs don't re-spend API calls.
//
// Reduction is keyed by FRANCHISE LINEAGE id. Discovery pass first: BDL may already key
// historic games to the surviving franchise's current id (making lineage the identity map);
// any distinct historic ids are mapped via LINEAGE_MAP below, and anything unmapped is
// reported loudly instead of silently merged.

import fs from "node:fs";
import path from "node:path";

const PROXY = "https://serene-meringue-6bd588.netlify.app/.netlify/functions/bdl";
const CACHE = path.join(import.meta.dirname, "cache");
const OUT = path.join(import.meta.dirname, "..", "data", "wnba-h2h.json");
const SEASONS = Array.from({ length: 2025 - 1997 + 1 }, (_, i) => 1997 + i);
fs.mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bdl(params) {
  const qs = new URLSearchParams(params);
  for (let a = 0; ; a++) {
    const r = await fetch(PROXY + "?" + qs.toString());
    if (r.ok) return r.json();
    if (a >= 3) throw new Error("proxy " + r.status + " for " + qs);
    await sleep(1500 * (a + 1));
  }
}

async function season(y) {
  const f = path.join(CACHE, "games-" + y + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  let out = [], cursor = null, guard = 0;
  do {
    const p = { path: "games", "seasons[]": y, per_page: 100 };
    if (cursor != null) p.cursor = cursor;
    const r = await bdl(p);
    out = out.concat(r.data || []);
    cursor = r.meta && r.meta.next_cursor;
    await sleep(250);
  } while (cursor != null && ++guard < 60);
  fs.writeFileSync(f, JSON.stringify(out));
  return out;
}

// Current-franchise abbrs (BDL ids) + defunct ids seen in /teams. Lineage id = the string key.
// Surviving lineages per spec: Starzz→Silver Stars→Aces (LVA), Shock Det→Tul→Wings (DAL),
// Orlando Miracle→Sun (CON). If BDL serves those old games under the survivor's id, the
// discovery report shows no unknown ids and these entries simply document identity history.
const LINEAGE = {
  1: { id: "NYL", identities: ["New York Liberty"] },
  2: { id: "CON", identities: ["Orlando Miracle", "Connecticut Sun"] },
  3: { id: "IND", identities: ["Indiana Fever"] },
  4: { id: "ATL", identities: ["Atlanta Dream"] },
  5: { id: "WAS", identities: ["Washington Mystics"] },
  6: { id: "CHI", identities: ["Chicago Sky"] },
  7: { id: "MIN", identities: ["Minnesota Lynx"] },
  8: { id: "LVA", identities: ["Utah Starzz", "San Antonio Silver Stars", "San Antonio Stars", "Las Vegas Aces"] },
  9: { id: "SEA", identities: ["Seattle Storm"] },
  10: { id: "PHO", identities: ["Phoenix Mercury"] },
  11: { id: "DAL", identities: ["Detroit Shock", "Tulsa Shock", "Dallas Wings"] },
  12: { id: "LAS", identities: ["Los Angeles Sparks"] },
  13: { id: "GSV", identities: ["Golden State Valkyries"] },
  14: { id: "SAC", identities: ["Sacramento Monarchs"], defunct: true },
  15: { id: "HOU", identities: ["Houston Comets"], defunct: true },
  30: { id: "TOR", identities: ["Toronto Tempo"] },
  31: { id: "POR", identities: ["Portland Fire (2026)"] },
};
// Historic defunct franchises with no known modern BDL id — discovered ids get added here.
const DISCOVER_HINTS = ["Cleveland Rockers", "Charlotte Sting", "Miami Sol", "Portland Fire", "Detroit Shock", "Tulsa Shock", "Utah Starzz", "San Antonio", "Orlando Miracle"];

const seen = new Map(); // teamId -> {names:Set, first, last, n}
const pairs = new Map(); // "A|B" sorted lineage ids -> {regularSeason:{}, playoffs:{}}
const perSeasonCount = {}; // y -> {total, paired}
const unknownIds = new Map();

function pairFor(aId, bId) {
  const k = [aId, bId].sort().join("|");
  let p = pairs.get(k);
  if (!p) {
    p = { regularSeason: { games: 0, wins: {}, firstMeeting: null, lastMeeting: null }, playoffs: { games: 0, wins: {}, firstMeeting: null, lastMeeting: null } };
    p.regularSeason.wins[aId] = 0; p.regularSeason.wins[bId] = 0;
    p.playoffs.wins[aId] = 0; p.playoffs.wins[bId] = 0;
    pairs.set(k, p);
  }
  return p;
}

const ALLSTAR_NAME = /all.?star|team wnba|team usa|team (delle|parker|wilson|stewart|clark|collier)|east|west|brazil|japan|australia|puerto/i;

/* ---- 1997–2007: BDL has NO games before 2008 (verified — every pre-2008 season
   returns empty). Source for the early era is Basketball Reference season schedule
   pages, cached to scripts/cache/bbref-sched/ (fetched once, 18s-spaced). stats.wnba.com
   was tried first per spec §4 and is unreachable from CLI (TLS-level bot filtering). */
const BREF_LINEAGE = {
  NYL: "NYL", LAS: "LAS", PHO: "PHO", SAC: "SAC", HOU: "HOU", CLE: "CLE", CHA: "CHA",
  UTA: "LVA", SAS: "LVA", DET: "DAL", ORL: "CON", CON: "CON", MIA: "MIA", POR: "PORF",
  MIN: "MIN", IND: "IND", SEA: "SEA", WAS: "WAS", CHI: "CHI",
};
const EARLY_DEFUNCT = {
  CLE: { id: "CLE", identities: ["Cleveland Rockers"], defunct: true },
  CHA: { id: "CHA", identities: ["Charlotte Sting"], defunct: true },
  MIA: { id: "MIA", identities: ["Miami Sol"], defunct: true },
  PORF: { id: "PORF", identities: ["Portland Fire (2000-2002)"], defunct: true, note: "distinct franchise from the 2026 Portland Fire expansion (POR)" },
};
function earlySeason(y) {
  const f = path.join(CACHE, "bbref-sched", y + ".html");
  if (!fs.existsSync(f)) return null;
  const html = fs.readFileSync(f, "utf8");
  const i = html.indexOf('id="schedule"');
  if (i < 0) return null;
  const seg = html.slice(i, html.indexOf("</table>", i));
  const rows = seg.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const out = [];
  let playoffs = false;
  for (const row of rows) {
    if (/>\s*Playoffs\s*</.test(row)) { playoffs = true; continue; }
    const d = row.match(/data-stat="date_game"[^>]*csk="(\d{4})(\d{2})(\d{2})/);
    const v = row.match(/data-stat="visitor_team_name"[^>]*csk="([A-Z]{3})\./);
    const h = row.match(/data-stat="home_team_name"[^>]*csk="([A-Z]{3})\./);
    const vp = row.match(/data-stat="visitor_pts"[^>]*>(\d+)</);
    const hp = row.match(/data-stat="home_pts"[^>]*>(\d+)</);
    if (!d || !v || !h || !vp || !hp) continue;
    out.push({ date: d[1] + "-" + d[2] + "-" + d[3], v: v[1], h: h[1], vp: +vp[1], hp: +hp[1], playoffs });
  }
  return out;
}

for (const y of SEASONS) {
  if (y <= 2007) {
    const games = earlySeason(y);
    if (!games) { console.log(y + ": NO CACHED B-REF SCHEDULE — early era incomplete"); continue; }
    let paired = 0;
    for (const g of games) {
      const la = BREF_LINEAGE[g.v], lb = BREF_LINEAGE[g.h];
      if (!la || !lb) { const u = unknownIds.get(g.v + "/" + g.h) || { name: "bref " + g.v + "/" + g.h, n: 0 }; u.n++; unknownIds.set(g.v + "/" + g.h, u); continue; }
      paired++;
      const bucket = pairFor(la, lb)[g.playoffs ? "playoffs" : "regularSeason"];
      bucket.games++;
      const winner = g.hp > g.vp ? lb : la;
      bucket.wins[winner] = (bucket.wins[winner] || 0) + 1;
      if (!bucket.firstMeeting || g.date < bucket.firstMeeting) bucket.firstMeeting = g.date;
      if (!bucket.lastMeeting || g.date > bucket.lastMeeting) bucket.lastMeeting = g.date;
    }
    perSeasonCount[y] = { fetched: games.length, counted: games.length, paired, src: "bref" };
    console.log(y + ": bref schedule " + games.length + " games · paired " + paired);
    continue;
  }
  const games = await season(y);
  let total = 0, paired = 0;
  for (const g of games) {
    const h = g.home_team, v = g.visitor_team;
    if (!h || !v) continue;
    [h, v].forEach((t) => {
      const s = seen.get(t.id) || { names: new Set(), first: y, last: y, n: 0 };
      s.names.add(t.full_name || t.name); s.last = y; s.n++;
      seen.set(t.id, s);
    });
    // skip all-star / exhibition shells
    if (ALLSTAR_NAME.test(h.full_name || h.name || "") || ALLSTAR_NAME.test(v.full_name || v.name || "")) continue;
    if (String(g.status).toLowerCase() !== "post" && new Date(g.date) > new Date()) continue;
    total++;
    const lh = LINEAGE[h.id], lv = LINEAGE[v.id];
    if (!lh || !lv) {
      const miss = !lh ? h : v;
      const u = unknownIds.get(miss.id) || { name: miss.full_name || miss.name, n: 0 };
      u.n++; unknownIds.set(miss.id, u);
      continue;
    }
    if (g.home_score == null || g.away_score == null || (g.home_score === 0 && g.away_score === 0)) continue;
    paired++;
    const bucket = pairFor(lh.id, lv.id)[g.postseason ? "playoffs" : "regularSeason"];
    bucket.games++;
    const winner = g.home_score > g.away_score ? lh.id : lv.id;
    bucket.wins[winner] = (bucket.wins[winner] || 0) + 1;
    const d = String(g.date).slice(0, 10);
    if (!bucket.firstMeeting || d < bucket.firstMeeting) bucket.firstMeeting = d;
    if (!bucket.lastMeeting || d > bucket.lastMeeting) bucket.lastMeeting = d;
  }
  perSeasonCount[y] = { fetched: games.length, counted: total, paired };
  console.log(y + ": fetched " + games.length + " · counted " + total + " · paired " + paired);
}

console.log("\n== team ids seen ==");
[...seen.entries()].sort((a, b) => a[0] - b[0]).forEach(([id, s]) => console.log(id, [...s.names].join(" / "), s.first + "-" + s.last, "(" + s.n + " game-slots)"));
if (unknownIds.size) {
  console.log("\n!! UNMAPPED TEAM IDS (excluded from pairs — extend LINEAGE and re-run):");
  [...unknownIds.entries()].forEach(([id, u]) => console.log("  id", id, u.name, "×" + u.n));
}

// validation 1: pairwise sums equal counted totals per season is inherent to single-pass counting;
// validate instead that overall paired ≈ counted (drops only unmapped/zero-score rows)
const sums = Object.values(perSeasonCount).reduce((a, s) => ({ counted: a.counted + s.counted, paired: a.paired + s.paired }), { counted: 0, paired: 0 });
console.log("\ntotals — counted:", sums.counted, "paired:", sums.paired, "dropped:", sums.counted - sums.paired);

// validation 2: known-history spot checks
const pk = (a, b) => [a, b].sort().join("|");
const nylas = pairs.get(pk("NYL", "LAS"));
console.log("\nspot-check 1 — first-ever WNBA game (NYL @ LAS, 1997-06-21): firstMeeting =", nylas && nylas.regularSeason.firstMeeting);
const houArc = pairs.get(pk("HOU", "NYL"));
console.log("spot-check 2 — HOU/NYL playoffs met in 1997-2000 finals era: playoff games =", houArc && houArc.playoffs.games, "first:", houArc && houArc.playoffs.firstMeeting);
const lvasea = pairs.get(pk("LVA", "SEA"));
console.log("spot-check 3 — LVA lineage (Starzz-era) vs SEA firstMeeting should be ≤2002 if lineage games present:", lvasea && lvasea.regularSeason.firstMeeting, "games:", lvasea && lvasea.regularSeason.games);

const out = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    seasons: [SEASONS[0], SEASONS[SEASONS.length - 1]],
    source: "balldontlie /wnba/v1/games via Netlify proxy; regular season + playoffs; all-star/exhibition excluded",
    perSeason: perSeasonCount,
    note: "current season is NOT in this file — apps live-top-up from BDL per matchup (spec §4)",
  },
  lineage: { ...Object.fromEntries(Object.entries(LINEAGE).map(([bdlId, l]) => [bdlId, l])), ...EARLY_DEFUNCT },
  pairs: Object.fromEntries([...pairs.entries()].sort()),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("\nwrote", OUT, "—", pairs.size, "pairs");
