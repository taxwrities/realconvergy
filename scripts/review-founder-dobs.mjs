// review-founder-dobs.mjs — historian adjudication pass over founder-dobs.report.json.
// Every change below is grounded in a value that came back in the FETCH (Wikidata claim
// or Wikipedia infobox wikitext captured in the report). No model-memory dates are
// introduced here. Spec rule applied: "If two sources conflict, record both in note,
// keep date_status verify, flag for Tony."
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT = join(__dirname, "founder-dobs.report.json");
const report = JSON.parse(readFileSync(REPORT, "utf8"));
const get = (n) => report.find((r) => r.seed_founder === n);

const log = [];

// 1. Ignatius of Loyola — DOB is solid (Wikidata precision 11, infobox corroborates).
//    Only the PLACE granularity is wrong: P19 points at a building (the Oratory).
//    Both fetched sources give the containing municipality as Azpeitia
//    (Wikidata P131 chain[0] = "Azpeitia"; infobox birth_place = "[[Azpeitia]], [[Gipuzkoa]]").
{
  const r = get("Ignatius of Loyola");
  r.founder_birthplace = "Azpeitia, Spain";
  r.note = "Wikidata P19 resolves to a building (Oratory of the Holy House of Loyola); " +
           "municipality taken from the same fetch — P131 chain[0] and the Wikipedia infobox both give Azpeitia.";
  log.push("Ignatius of Loyola: birthplace building -> municipality Azpeitia, Spain (DOB unchanged, still locked)");
}

// 2. Christian Rosenkreuz — allegorical/legendary founder of the Rosicrucians.
//    Wikidata has only a year (precision 9) and no P19. The spec has a dedicated
//    status for exactly this case; "verify" would imply a real date is findable.
{
  const r = get("Christian Rosenkreuz");
  r.founder_dob = "";
  r.founder_birthplace = "";
  r.date_status = "legendary";
  r.note = "Allegorical figure — no verifiable DOB or birthplace exists. Wikidata carries only a " +
           "year-precision (9) 1378 claim and no P19. Not decoder-usable.";
  log.push("Christian Rosenkreuz: verify -> legendary (no verifiable date exists)");
}

// 3-5. Genuine two-source conflicts. Keep verify, record BOTH readings for Tony.
const conflicts = [
  ["Ban Johnson",
   "CONFLICT: Wikidata P569 = 1865-01-05; Wikipedia infobox = 1864-01-05. Same month/day, " +
   "year differs by one. Birthplace agrees across both (Norwalk, Ohio). Needs Tony's call."],
  ["Hugues de Payens",
   "CONFLICT: Wikidata P569 = 1074-02-09 and P19 = Pagani, Italy; Wikipedia infobox = c.1070 " +
   "(comment: 'could be as late as 1074') and birth_place = Payns, County of Champagne (France). " +
   "Date AND place both disputed — the Wikidata place claim looks like a Payns/Pagani conflation. Needs Tony's call."],
  ["Mayer Amschel Rothschild",
   "CONFLICT: Wikidata P569 = 1743 (year precision only); Wikipedia infobox = 1743-02-23 " +
   "'or 1744' per NDB. Wikidata country label also resolved to the historical 'Francia' rather " +
   "than Germany (infobox: Free City of Frankfurt, Holy Roman Empire). Needs Tony's call."],
];
for (const [name, note] of conflicts) {
  const r = get(name);
  r.date_status = "verify";
  r.note = note;
  log.push(`${name}: held at verify with both readings recorded`);
}

const tmp = REPORT + ".tmp";
writeFileSync(tmp, JSON.stringify(report, null, 2) + "\n");
renameSync(tmp, REPORT);
console.log("adjudications applied:");
for (const l of log) console.log("  - " + l);
const c = report.reduce((a, r) => ((a[r.date_status] = (a[r.date_status] || 0) + 1), a), {});
console.log("report status counts:", JSON.stringify(c));
