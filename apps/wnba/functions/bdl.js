// Same-origin proxy to the balldontlie WNBA API.
// Frontend calls: /.netlify/functions/bdl?path=<endpoint>&<params...>
//   - <endpoint> e.g. "games", "players/active", "player_season_stats"
//   - array params arrive as repeated keys (team_ids[]=1&team_ids[]=2), plus cursor/per_page/etc.
// BDL_KEY env var = the raw API key (NO "Bearer" prefix).
const BASE = "https://api.balldontlie.io/wnba/v1/";
// Route whitelist (spec §2) — reject anything else with 400 so the key can't be
// used to browse arbitrary BDL endpoints through this proxy.
const ALLOW = new Set(["teams", "players", "players/active", "player_season_stats", "player_stats", "games"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const mv = event.multiValueQueryStringParameters || {};
  const single = event.queryStringParameters || {};
  const path = String((mv.path && mv.path[0]) || single.path || "").replace(/^\/+|\/+$/g, "");
  if (!path) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing path" }) };
  if (!ALLOW.has(path)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "path not allowed: " + path }) };
  const src = Object.keys(mv).length ? mv : Object.fromEntries(Object.entries(single).map(([k, v]) => [k, [v]]));
  const qs = new URLSearchParams();
  for (const [k, arr] of Object.entries(src)) {
    if (k === "path") continue;
    (Array.isArray(arr) ? arr : [arr]).forEach(v => { if (v != null) qs.append(k, v); });
  }
  const url = BASE + String(path).replace(/^\/+/, "") + (qs.toString() ? "?" + qs.toString() : "");
  const key = process.env.BDL_KEY;
  if (!key) {
    // bootstrap relay: no key on this site yet → forward to the wnbatool site's
    // proxy (same function shape, key lives in its env). Set BDL_KEY here to cut the hop.
    try {
      const relay = await fetch("https://serene-meringue-6bd588.netlify.app/.netlify/functions/bdl?path=" + encodeURIComponent(path) + (qs.toString() ? "&" + qs.toString() : ""));
      return { statusCode: relay.status, headers: CORS, body: await relay.text() };
    } catch (e) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "no BDL_KEY and relay failed: " + e.message }) };
    }
  }
  try {
    const r = await fetch(url, { headers: { Authorization: key } });
    const text = await r.text();
    return { statusCode: r.status, headers: CORS, body: text };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "proxy fetch failed: " + e.message }) };
  }
};
