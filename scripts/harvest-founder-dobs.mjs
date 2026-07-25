// harvest-founder-dobs.mjs — founders-historian Job: founder DOB + birthplace harvest
// PRIME DIRECTIVE (specs/founders-historian.md): every date comes from a fetched page.
// Never model memory. This script fetches Wikidata claims (P569 date-of-birth,
// P19 place-of-birth) and cross-checks the Wikipedia infobox wikitext for the same
// person. Nothing is written from the model's own knowledge.
//
// Output: scripts/founder-dobs.report.json  (a REPORT — reviewed before touching the seed)
// Status rule: locked only when Wikidata date precision == 11 (day-level) AND the
// Wikipedia infobox agrees. Anything else -> verify, with the conflict noted.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "founder-dobs.report.json");
const UA = "realconvergy-founders-historian/1.0 (research; contact gibbstony38@gmail.com)";

// Explicit page titles avoid disambiguation collisions. The TITLE is a lookup key;
// every DATE and PLACE value below still comes only from the fetched response.
const TARGETS = [
  ["Anton LaVey", "Anton LaVey"],
  ["Ignatius of Loyola", "Ignatius of Loyola"],
  ["William Huntington Russell", "William Huntington Russell"],
  ["Kobe Bean Bryant", "Kobe Bryant"],
  ["Adam Weishaupt", "Adam Weishaupt"],
  ["Hugues de Payens", "Hugues de Payens"],
  ["Prince Bernhard", "Prince Bernhard of Lippe-Biesterfeld"],
  ["David Rockefeller", "David Rockefeller"],
  ["Aleister Crowley", "Aleister Crowley"],
  ["Christian Rosenkreuz", "Christian Rosenkreuz"],
  ["Mayer Amschel Rothschild", "Mayer Amschel Rothschild"],
  ["John D Rockefeller", "John D. Rockefeller"],
  ["William Hulbert", "William Hulbert"],
  ["Ban Johnson", "Ban Johnson"],
  ["Maurice Podoloff", "Maurice Podoloff"],
  ["James Naismith", "James Naismith"],
  ["Alexander Cartwright", "Alexander Cartwright"],
  ["Jack Roosevelt Robinson", "Jackie Robinson"],
  ["George Herman Ruth", "Babe Ruth"],
  ["Henry Louis Gehrig", "Lou Gehrig"],
  ["Michael Jeffrey Jordan", "Michael Jordan"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Spec: 15-20s between requests to any single domain. Randomised in-band.
const politeDelay = () => 15000 + Math.floor(Math.random() * 5000);

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// --- Wikipedia: resolve title -> pageid + wikidata QID, and pull infobox wikitext ---
async function fetchWikipedia(title) {
  const base = "https://en.wikipedia.org/w/api.php";
  const q = `${base}?action=query&format=json&redirects=1&prop=pageprops|revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`;
  const j = await getJSON(q);
  const pages = j?.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) throw new Error(`no wikipedia page for "${title}"`);
  const wikitext = page?.revisions?.[0]?.slots?.main?.["*"] || "";
  return {
    resolved_title: page.title,
    pageid: page.pageid,
    qid: page?.pageprops?.["wikibase_item"] || null,
    shortdesc: page?.pageprops?.["wikibase-shortdesc"] || null,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    infobox_birth_date: matchField(wikitext, "birth_date"),
    infobox_birth_place: matchField(wikitext, "birth_place"),
  };
}

// Pull a single infobox field's raw value (balanced to end-of-line / next pipe at depth 0).
function matchField(wt, field) {
  const re = new RegExp(`\\|\\s*${field}\\s*=`, "i");
  const m = re.exec(wt);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 0, out = "";
  while (i < wt.length) {
    const ch = wt[i], two = wt.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; out += two; i += 2; continue; }
    if (two === "}}" || two === "]]") { if (depth === 0) break; depth--; out += two; i += 2; continue; }
    if (ch === "|" && depth === 0) break;
    if (ch === "\n" && depth === 0) break;
    out += ch; i++;
  }
  return out.trim() || null;
}

// --- Wikidata: P569 date of birth (with precision), P19 place of birth ---
async function fetchWikidata(qid) {
  const j = await getJSON(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const ent = j?.entities?.[qid];
  if (!ent) throw new Error(`no wikidata entity ${qid}`);
  const claims = ent.claims || {};

  const dobClaim = claims.P569?.find((c) => c.mainsnak?.datavalue);
  let dob = null, precision = null;
  if (dobClaim) {
    const dv = dobClaim.mainsnak.datavalue.value;
    precision = dv.precision; // 11 = day, 10 = month, 9 = year
    const mm = /^([+-]\d{4,})-(\d{2})-(\d{2})/.exec(dv.time);
    if (mm) dob = { year: mm[1].replace(/^\+/, ""), month: mm[2], day: mm[3], raw: dv.time };
  }

  const bpClaim = claims.P19?.find((c) => c.mainsnak?.datavalue);
  const bpQid = bpClaim ? bpClaim.mainsnak.datavalue.value.id : null;

  return { dob, precision, bpQid, wd_url: `https://www.wikidata.org/wiki/${qid}` };
}

// Resolve a place QID to "City, State" (US) or "City, Country".
// P131's first hop is often a county/borough ("Chicago, Cook County"), so walk the
// administrative chain upward and prefer a genuine U.S. state (P31 -> Q35657).
const Q_US_STATE = "Q35657";
const entCache = new Map();
async function getEntity(qid) {
  if (entCache.has(qid)) return entCache.get(qid);
  const j = await getJSON(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const e = j?.entities?.[qid] || null;
  entCache.set(qid, e);
  return e;
}
const labelOfEnt = (e) => e?.labels?.en?.value || null;
const isUSState = (e) =>
  (e?.claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === Q_US_STATE);

async function resolvePlace(qid) {
  const ent = await getEntity(qid);
  if (!ent) return null;
  const city = labelOfEnt(ent);
  const countryQid = ent.claims?.P17?.find((c) => c.mainsnak?.datavalue)?.mainsnak.datavalue.value.id || null;
  const country = countryQid ? labelOfEnt(await getEntity(countryQid)) : null;

  // Walk up P131 (max 5 hops) collecting the chain; stop early on a U.S. state.
  const chain = [];
  let stateLabel = null;
  let cur = ent, hops = 0;
  while (hops < 5) {
    const nextQid = cur.claims?.P131?.find((c) => c.mainsnak?.datavalue)?.mainsnak.datavalue.value.id;
    if (!nextQid) break;
    const nextEnt = await getEntity(nextQid);
    if (!nextEnt) break;
    chain.push(labelOfEnt(nextEnt));
    if (isUSState(nextEnt)) { stateLabel = labelOfEnt(nextEnt); break; }
    cur = nextEnt; hops++;
  }
  return { city, admin: stateLabel || chain[0] || null, state: stateLabel, admin_chain: chain, country, place_qid: qid };
}

function composePlace(p) {
  if (!p || !p.city) return null;
  const US = p.country === "United States" || p.country === "United States of America";
  if (US) return p.state ? `${p.city}, ${p.state}` : `${p.city}, United States`;
  if (p.country) return `${p.city}, ${p.country}`;
  return p.city;
}

// Does the Wikipedia infobox corroborate the Wikidata day-level date?
function infoboxAgrees(infoboxRaw, dob) {
  if (!infoboxRaw || !dob) return false;
  const nums = infoboxRaw.match(/\d{1,4}/g) || [];
  const y = String(Number(dob.year)), mo = String(Number(dob.month)), d = String(Number(dob.day));
  const has = (v) => nums.some((n) => String(Number(n)) === v);
  return has(y) && has(mo) && has(d);
}

const results = [];
for (let i = 0; i < TARGETS.length; i++) {
  const [seedName, title] = TARGETS[i];
  const rec = { seed_founder: seedName, wikipedia_title: title };
  try {
    const wp = await fetchWikipedia(title);
    Object.assign(rec, {
      resolved_title: wp.resolved_title, shortdesc: wp.shortdesc, source: wp.url,
      infobox_birth_date: wp.infobox_birth_date, infobox_birth_place: wp.infobox_birth_place,
    });
    if (!wp.qid) throw new Error("no wikidata QID on page");

    const wd = await fetchWikidata(wp.qid);
    rec.wikidata_url = wd.wd_url;
    rec.precision = wd.precision;

    if (wd.dob && wd.precision === 11) {
      rec.founder_dob = `${wd.dob.year.padStart(4, "0")}-${wd.dob.month}-${wd.dob.day}`;
    } else if (wd.dob) {
      rec.founder_dob = wd.dob.year.padStart(4, "0");
      rec.note = `Wikidata precision ${wd.precision} (not day-level)`;
    } else {
      rec.founder_dob = "";
      rec.note = "no P569 date-of-birth claim";
    }

    if (wd.bpQid) {
      const place = await resolvePlace(wd.bpQid);
      rec.place_detail = place;
      rec.founder_birthplace = composePlace(place) || "";
    } else {
      rec.founder_birthplace = "";
      rec.note = [rec.note, "no P19 place-of-birth claim"].filter(Boolean).join("; ");
    }

    rec.infobox_agrees = infoboxAgrees(wp.infobox_birth_date, wd.dob);
    const dayLevel = wd.precision === 11;
    rec.date_status = dayLevel && rec.infobox_agrees ? "locked" : "verify";
    if (dayLevel && !rec.infobox_agrees) {
      rec.note = [rec.note, "Wikidata day-level but infobox did not corroborate — needs eyes"].filter(Boolean).join("; ");
    }
  } catch (err) {
    rec.error = err.message;
    rec.date_status = "verify";
  }
  results.push(rec);
  console.log(
    `[${String(i + 1).padStart(2)}/${TARGETS.length}] ${seedName.padEnd(28)} ` +
    `dob=${(rec.founder_dob ?? "-").padEnd(10)} bp=${(rec.founder_birthplace ?? "-").padEnd(28)} ` +
    `${rec.date_status}${rec.error ? " ERR:" + rec.error : ""}`
  );
  if (i < TARGETS.length - 1) await sleep(politeDelay());
}

writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
const locked = results.filter((r) => r.date_status === "locked").length;
console.log(`\nwrote ${OUT}`);
console.log(`locked: ${locked}/${results.length}   verify: ${results.length - locked}/${results.length}`);
