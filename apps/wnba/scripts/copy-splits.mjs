// copy-splits.mjs — mirror data/wnba-splits into apps/wnba/public/ before dev/build.
//
// Netlify publishes apps/wnba/dist, so the repo-root data/ tree does not ship on its
// own. Vite copies public/ into dist/ verbatim, so staging the splits there is all it
// takes for the app to fetch them on a relative path — no CORS, no GitHub raw
// dependency, and the data always matches the commit that built it.
//
// The copy is gitignored: data/wnba-splits/ stays the single source in version control
// (263 files / ~3.2MB), and this regenerates the mirror on every dev/build run.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "..", "data", "wnba-splits");
const DEST = join(__dirname, "..", "public", "data", "wnba-splits");

if (!existsSync(SRC)) {
  console.error(`copy-splits: source missing — ${SRC}`);
  process.exit(1);
}
// rm first so files deleted upstream (a retired player) don't linger in the mirror
if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

const n = readdirSync(DEST).length;
if (!existsSync(join(DEST, "index.json"))) {
  console.error("copy-splits: index.json missing from the copy — aborting");
  process.exit(1);
}
console.log(`copy-splits: mirrored ${n} files -> apps/wnba/public/data/wnba-splits/`);
