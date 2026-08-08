/* ================================================================
   splits — career game-log + splits store (README-wnba-splits.md).

   Served as static assets from apps/wnba/public/data/wnba-splits/, mirrored
   there from the repo-root data/wnba-splits/ by scripts/copy-splits.mjs before
   dev and build. Relative paths, so no CORS and no GitHub-raw dependency.

   Lazy: index.json on first Splits-tab open, a player file on selection.
   Cached in memory for the session only — no localStorage (the player files
   run to ~50KB each and the slate cache already owns that budget).

   Raw stats only. No gematria, no scoring — the Splits tab is a facts layer.
================================================================ */
const BASE = '/data/wnba-splits';

let indexPromise = null;
const playerCache = new Map();   // athlete_id -> Promise<player>

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
  return r.json();
}

/* { "A'ja Wilson": {id, team, pos, games}, ... } — 262 players. */
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = getJSON(`${BASE}/index.json`).catch(e => {
      indexPromise = null;            // let a later open retry a failed fetch
      throw e;
    });
  }
  return indexPromise;
}

/* Full career log + precomputed splits for one athlete_id. */
export function loadPlayer(id) {
  if (!playerCache.has(id)) {
    playerCache.set(id, getJSON(`${BASE}/${id}.json`).catch(e => {
      playerCache.delete(id);
      throw e;
    }));
  }
  return playerCache.get(id);
}

/* ---- log helpers -------------------------------------------------------- */

/* The log ships column-oriented (log_legend + positional rows) to keep the
   files small; resolve indices once per player instead of per row. */
export function legendIndex(legend) {
  const m = {};
  (legend || []).forEach((k, i) => { m[k] = i; });
  return m;
}

/* Stats the QUERY view can threshold on, in the order Tony listed them
   (+ FT/attempts, + first basket / first point, Tony 2026-08-08).
   fb/fp are 1/0 per game, so a "1+" query reads as "games they got it". */
export const QUERY_STATS = ['pts', 'reb', 'ast', 'stl', 'blk', '3pm', 'fgm', 'ftm', 'fga', '3pa', 'fta', 'to', 'min', 'fb', 'fp'];

/* Stats that are a yes/no per game rather than a count — the Query view labels
   and defaults them differently (threshold locked to 1, "games they got it"). */
export const FLAG_STATS = new Set(['fb', 'fp']);

/* Columns the split tables show. `g` is the bucket's game count; the rest are
   season-long sums, so an average is sum/g. FG/3P/FT makes+attempts in bbref
   column order (Tony 2026-08-08); the table scrolls inside .sp-scroll.
   FB/FP lead — first basket is the app's flagship lane. */
export const TABLE_STATS = ['fb', 'fp', 'pts', 'reb', 'ast', 'stl', 'blk', 'fgm', 'fga', '3pm', '3pa', 'ftm', 'fta'];

/* Fixed display orders — object key order in the JSON is insertion order from
   the build script, which is neither chronological nor stable. */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

/* Rows for one splits bucket, ordered for display. `opponent` sorts by games
   desc (most-faced first); everything else follows its fixed calendar order. */
export function bucketRows(splits, kind) {
  const b = (splits && splits[kind]) || {};
  const rows = Object.entries(b).map(([key, v]) => ({ key, ...v }));
  if (kind === 'weekday') return WEEKDAYS.filter(d => b[d]).map(d => ({ key: d, ...b[d] }));
  if (kind === 'month') return MONTHS.filter(m => b[m]).map(m => ({ key: m, ...b[m] }));
  if (kind === 'homeaway') return ['H', 'A'].filter(k => b[k]).map(k => ({ key: k, ...b[k] }));
  if (kind === 'seasontype') return ['REG', 'PST'].filter(k => b[k]).map(k => ({ key: k, ...b[k] }));
  return rows.sort((x, y) => (y.g || 0) - (x.g || 0));   // opponent
}

const WD_FROM_DATE = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_FROM_DATE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Recompute every splits bucket from the shipped game log (Tony 2026-08-08:
   REG/playoffs distinction with a toggle). st=2 regular, st=3 playoffs; the
   builder already dropped All-Star/exhibition, so the log holds only real
   games. includePost=false → bbref-regular buckets (the default the shipped
   precomputed splits also hold); true → REG+PST. The seasontype bucket always
   shows both rows. Feed the result to bucketRows() for display order. */
export function computeSplits(player, includePost) {
  const ix = legendIndex(player.log_legend);
  const di = ix.date, oi = ix.opp, hi = ix.ha, sti = ix.st;
  const splits = {};
  const add = (dim, key, sv) => {
    const d = splits[dim] || (splits[dim] = {});
    const b = d[key] || (d[key] = { g: 0 });
    b.g += 1;
    for (const [k, v] of Object.entries(sv)) if (typeof v === 'number') b[k] = (b[k] || 0) + v;
  };
  for (const row of player.log || []) {
    const st = row[sti];
    const sv = {};
    for (const k of TABLE_STATS) { const v = row[ix[k]]; if (typeof v === 'number') sv[k] = v; }
    add('seasontype', st === 2 ? 'REG' : 'PST', sv);
    if (st !== 2 && !includePost) continue;
    const dt = new Date(row[di] + 'T12:00:00');
    add('weekday', WD_FROM_DATE[dt.getDay()], sv);
    add('month', MON_FROM_DATE[dt.getMonth()], sv);
    add('homeaway', row[hi], sv);
    add('opponent', row[oi], sv);
  }
  return splits;
}

/* Every game where `stat` >= threshold, newest first. Returns the raw row plus
   the decoded fields the QUERY view renders. Regular season by default;
   includePost=true adds playoff games (st carried so the UI can badge them).
   `pts` rides along so flag queries (first basket / first point, where the
   value is always 1) can show the game's actual box line instead. The result
   also carries .played and .rate — how many games were in scope and what
   percentage qualified, which is the number that matters for first basket. */
export function qualifyingGames(player, stat, threshold, includePost) {
  const ix = legendIndex(player.log_legend);
  const si = ix[stat], di = ix.date, oi = ix.opp, hi = ix.ha, sti = ix.st, pi = ix.pts;
  if (si == null) return [];
  const out = [];
  let played = 0;
  for (const row of player.log || []) {
    if (!includePost && row[sti] !== 2) continue;
    played++;
    const v = row[si];
    if (typeof v === 'number' && v >= threshold) {
      out.push({ date: row[di], opp: row[oi], ha: row[hi], value: v,
                 st: row[sti], pts: row[pi] });
    }
  }
  out.reverse();                   // log ships oldest->newest
  out.played = played;
  out.rate = played ? Math.round((out.length / played) * 1000) / 10 : null;
  return out;
}
