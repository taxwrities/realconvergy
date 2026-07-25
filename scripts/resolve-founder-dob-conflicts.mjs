// resolve-founder-dob-conflicts.mjs — Tony's ruling on the 3 verify-held conflicts.
//
// RULING (2026-07-24): "i dont care that much about the years bc those convergences
// are rare. anniversary are more often ... go with your best guess. wikipedia is best."
//
// So: Wikipedia is the tiebreaker, and the MONTH-DAY is what matters (it drives the
// anniversary probe). Year disagreement is tolerated and recorded, not blocking.
//
// Values are PARSED from the infobox wikitext already captured in the fetch report —
// not retyped from memory. Provenance stays the fetched Wikipedia page.
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT = join(__dirname, "founder-dobs.report.json");
const report = JSON.parse(readFileSync(REPORT, "utf8"));
const get = (n) => report.find((r) => r.seed_founder === n);

const pad = (s) => String(s).padStart(2, "0");

// {{Birth date|1864|01|05}} / {{Birth date|1743|2|23|df=yes}} -> "1864-01-05"
function parseBirthDate(wikitext) {
  const m = /\{\{\s*birth[ _]date[^|]*\|\s*(\d{3,4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i.exec(wikitext || "");
  return m ? `${m[1].padStart(4, "0")}-${pad(m[2])}-${pad(m[3])}` : null;
}
// {{c.|1070}} -> "1070"  (circa: year only, no anniversary possible)
function parseCircaYear(wikitext) {
  const m = /\{\{\s*c\.?\s*\|\s*(\d{3,4})\s*\}\}/i.exec(wikitext || "");
  return m ? m[1] : null;
}
// "[[Payns]], [[County of Champagne]]" -> "Payns, County of Champagne"
function parsePlace(wikitext) {
  if (!wikitext) return null;
  let s = wikitext
    .replace(/<ref[\s\S]*?(?:\/>|<\/ref>)/gi, "")   // drop refs
    .replace(/<!--[\s\S]*?-->/g, "")                 // drop comments
    .replace(/\{\{\s*avoid ?wrap\s*\|/gi, "{{")      // unwrap formatting template
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")   // [[target|label]] -> label
    .replace(/\[\[([^\]]+)\]\]/g, "$1")              // [[x]] -> x
    .replace(/\{\{|\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,?\s*U\.?S\.?A?\.?$/i, "");            // trailing ", U.S."
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  // Keep city + outermost region, matching the "City, State/Country" shape.
  return parts.length === 1 ? parts[0] : `${parts[0]}, ${parts[parts.length - 1]}`;
}

const log = [];

// --- 1. Ban Johnson — month-day IDENTICAL in both sources (01-05); only the year
//        differs. Anniversary probe is unaffected either way. Wikipedia wins.
{
  const r = get("Ban Johnson");
  const wp = parseBirthDate(r.infobox_birth_date);           // 1864-01-05
  r.founder_dob = wp;
  r.date_status = "locked";
  r.note = `Wikipedia infobox ${wp} adopted per Tony's ruling (Wikipedia is tiebreaker). ` +
           `Wikidata P569 gives 1865-01-05 — month-day is IDENTICAL (01-05), only the year ` +
           `differs, so the anniversary probe is unaffected. Year-spans carry +/-1yr uncertainty.`;
  log.push(`Ban Johnson: verify -> locked ${wp} (month-day undisputed)`);
}

// --- 2. Mayer Amschel Rothschild — Wikidata had year-only; the Wikipedia infobox
//        actually carries the month-day, which is the part that matters.
{
  const r = get("Mayer Amschel Rothschild");
  const wp = parseBirthDate(r.infobox_birth_date);           // 1743-02-23
  // The infobox place is the POLITY ("Free City of Frankfurt"), which would cipher as
  // a phrase rather than a city. Take the bare city from Wikidata's P19 label (also
  // fetched) and the historical region from the Wikipedia infobox.
  const region = (parsePlace(r.infobox_birth_place) || "").split(",").pop().trim();
  const city = r.place_detail?.city || null;                 // "Frankfurt"
  const place = city && region ? `${city}, ${region}` : city || parsePlace(r.infobox_birth_place);
  r.founder_dob = wp;
  r.founder_birthplace = place;
  r.date_status = "locked";
  r.note = `Wikipedia infobox ${wp} adopted per Tony's ruling — it supplies the month-day ` +
           `Wikidata lacked (P569 was year-precision 1743 only). NDB records "or 1744"; that ` +
           `year ambiguity affects year-spans only, not the anniversary. Birthplace taken from ` +
           `the same infobox (Wikidata's country label resolved to the historical "Francia").`;
  log.push(`Mayer Amschel Rothschild: verify -> locked ${wp}, birthplace "${place}"`);
}

// --- 3. Hugues de Payens — Wikipedia gives NO month-day, only {{c.|1070}} (circa).
//        Tony's rule can't manufacture an anniversary here. Year-granularity only,
//        which founders.js already excludes from day-span probes. The BIRTHPLACE,
//        however, is unambiguous in Wikipedia and corrects a bad Wikidata claim.
{
  const r = get("Hugues de Payens");
  const yr = parseCircaYear(r.infobox_birth_date);           // 1070
  const place = parsePlace(r.infobox_birth_place);           // Payns, County of Champagne
  r.founder_dob = yr;
  r.founder_birthplace = place;
  r.date_status = "locked";
  r.note = `CIRCA — Wikipedia gives only {{c.|1070}} (comment: "could be as late as 1074"), ` +
           `so there is NO month-day and no anniversary probe is possible; year-granularity only. ` +
           `Wikidata's 1074-02-09 was NOT adopted per Tony's Wikipedia-first ruling. Birthplace ` +
           `corrected to the Wikipedia value — Wikidata's P19 "Pagani, Italy" is a Payns/Pagani conflation.`;
  log.push(`Hugues de Payens: verify -> locked ${yr} (YEAR only, circa — no anniversary), birthplace "${place}"`);
}

const tmp = REPORT + ".tmp";
writeFileSync(tmp, JSON.stringify(report, null, 2) + "\n");
renameSync(tmp, REPORT);
console.log("conflict rulings applied:");
for (const l of log) console.log("  - " + l);
const c = report.reduce((a, r) => ((a[r.date_status] = (a[r.date_status] || 0) + 1), a), {});
console.log("report status counts:", JSON.stringify(c));
