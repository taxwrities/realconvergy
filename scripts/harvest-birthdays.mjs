// harvest-birthdays.mjs — re-runnable WNBA DOB harvester (BIRTHDAY-HARVEST-SPEC.md).
// The 2026 harvest is DONE and committed (data/birthdays.json, 201 players, 15 teams,
// published at github.com/taxwrities/wnba-birthdays). Run this only to refresh a team
// after trades/signings: `node scripts/harvest-birthdays.mjs SEA TOR`
//
// Source: Basketball Reference team pages (Birth Date column carries ISO in the csk attr).
// B-Ref bot-blocks after ~4-5 rapid requests — 18s sleep between fetches is mandatory.
// Rules (spec): never fill a DOB from memory; ISO output; strip diacritics; keep src field.

import fs from "node:fs";
import path from "node:path";

const CODES = process.argv.slice(2);
if (!CODES.length) {
  console.log("usage: node scripts/harvest-birthdays.mjs <BREF-TEAM-CODE...>  (e.g. CON IND LVA LAS MIN NYL PHO POR SEA TOR WAS ATL CHI DAL GSV)");
  process.exit(0);
}
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36";
const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseRoster(html, team) {
  const i = html.indexOf('id="roster"');
  if (i < 0) return null;
  const seg = html.slice(i, html.indexOf("</table>", i));
  const out = [];
  (seg.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).forEach((row) => {
    const nm = row.match(/data-stat="player"[^>]*><a[^>]*>([^<]+)<\/a>/);
    if (!nm) return;
    const pos = ((row.match(/data-stat="pos"[^>]*>([^<]*)</) || [])[1] || "").trim();
    const bd = row.match(/data-stat="birth_date"[^>]*csk="(\d{4})-(\d{1,2})-(\d{1,2})"/);
    const dob = bd ? bd[1] + "-" + String(+bd[2]).padStart(2, "0") + "-" + String(+bd[3]).padStart(2, "0") : null;
    out.push({ name: strip(nm[1]).trim(), team, pos, dob, src: "bref" });
  });
  return out;
}

const file = path.join(import.meta.dirname, "..", "data", "birthdays.json");
const db = JSON.parse(fs.readFileSync(file, "utf8"));
for (const code of CODES) {
  const url = `https://www.basketball-reference.com/wnba/teams/${code}/2026.html`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  const html = await res.text();
  const ros = parseRoster(html, code);
  if (!ros || !ros.length) { console.error(code + ": roster not found (blocked pages come back small/empty — wait and retry)"); }
  else {
    let added = 0, updated = 0;
    ros.forEach((p) => {
      if (!p.dob) { console.warn(code + ": " + p.name + " missing birth_date — resolve via player page/Wikidata"); return; }
      const ex = db.players.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
      if (!ex) { db.players.push(p); added++; }
      else if (ex.dob !== p.dob) { console.warn("DOB CONFLICT " + p.name + ": file " + ex.dob + " vs bref " + p.dob + " — verify manually, not auto-overwritten"); }
      else if (ex.team !== p.team) { ex.team = p.team; updated++; }
    });
    console.log(code + ": " + ros.length + " players — " + added + " added, " + updated + " team-updated");
  }
  if (CODES.indexOf(code) < CODES.length - 1) await sleep(18000);
}
db.meta.generated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(db, null, 2).replace(/\{\n\s+("name")/g, "{ $1"));
console.log("wrote", file, "—", db.players.length, "players. Push data/ + the wnba-birthdays repo copy.");
