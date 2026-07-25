// apply-founder-dobs.mjs — merge the reviewed founder-DOB report into the SEED.
// The seed is the source of truth; data/founders.json is regenerated from it by
// harvest-founders.mjs. Ciphers are NEVER written here — the builder computes them.
//
// Field discipline:
//   founder_dob         YYYY-MM-DD (or YYYY when only year-precision was available)
//   founder_birthplace  "City, State" (US) / "City, Country"
//   founder_dob_status  locked | verify   <- deliberately NOT the entity's date_status,
//                       which governs the FOUNDING date and the decoder gate.
//   founder_dob_source  the fetched URL the values came from
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "founders-seed.json");
const REPORT = join(__dirname, "founder-dobs.report.json");

const seed = JSON.parse(readFileSync(SEED, "utf8"));
const report = JSON.parse(readFileSync(REPORT, "utf8"));
const byFounder = new Map(report.map((r) => [r.seed_founder, r]));

let applied = 0, skipped = [], locked = 0, verify = 0;
for (const [cat, items] of Object.entries(seed)) {
  if (cat === "_meta") continue;
  for (const e of items) {
    if (!e.founder) continue;
    const r = byFounder.get(e.founder);
    if (!r) { skipped.push(`${cat}/${e.name} (no report row for "${e.founder}")`); continue; }
    if (!r.founder_dob && !r.founder_birthplace) {
      skipped.push(`${cat}/${e.name} (no dob/birthplace harvested: ${r.note || r.error || "unknown"})`);
      continue;
    }
    if (r.founder_dob) e.founder_dob = r.founder_dob;
    if (r.founder_birthplace) e.founder_birthplace = r.founder_birthplace;
    e.founder_dob_status = r.date_status;
    e.founder_dob_source = r.source;
    if (r.note) e.founder_dob_note = r.note;
    r.date_status === "locked" ? locked++ : verify++;
    applied++;
  }
}

const tmp = SEED + ".tmp";
writeFileSync(tmp, JSON.stringify(seed, null, 2) + "\n");
renameSync(tmp, SEED);
console.log(`applied to ${applied} seed entries — founder_dob_status locked=${locked} verify=${verify}`);
if (skipped.length) console.log(`skipped ${skipped.length}:\n  ` + skipped.join("\n  "));
