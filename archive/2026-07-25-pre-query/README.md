# archive/2026-07-25-pre-query

Belt-and-suspenders snapshot taken per **QUERY-SPEC.md §1 (Version Safety)**, immediately
before the `query.html` (Slate Query Engine / "Daily Matches") build began on **2026-07-25**.

This folder is the *"I can see it"* backup. The git tags are the real backup.

## What is in here

| Path | What it is |
|---|---|
| `deployed-build/` | The literal Vite build output of `apps/mlb` at snapshot time — `index.html` + hashed `assets/` + `favicon.svg` + `icons.svg`. This is byte-for-byte what Netlify serves. (Named `deployed-build/`, not `dist/`, because `.gitignore` ignores every `dist/`.) |
| `source-index.html` | `apps/mlb/index.html` — the Vite entry HTML. |
| `source-netlify.toml` | `apps/mlb/netlify.toml` — build command + publish dir + functions config. |
| `source-vite.config.js` | `apps/mlb/vite.config.js`. |
| `source-package.json` | `apps/mlb/package.json`. |

Note: `apps/mlb` is a **Vite/React app**, not a single-file HTML page. The full recoverable
source is the git tree, not this folder — hence the tags below.

## THREE RECOVERY PATHS

1. **Git tags (the real backup)**
   - `pre-query-v1` → commit `f09e544` — the complete working tree on branch
     `founders-dob-harvest`, including the founders DOB/birthplace harvest, immediately
     before any query.html code was written.
   - `pre-query-v1-deployed` → commit `11055d4` (= `origin/main` at snapshot time) — the
     exact commit Netlify had built and published for **convergence-board**.

   Restore either with:
   ```
   git checkout pre-query-v1
   ```

2. **This archive folder** — visible, browsable copy of the deployed artifact.

3. **Netlify deploy history** — Netlify site → **Deploys** tab → pick any previous deploy →
   **Publish deploy**. Restores the live site instantly with zero git work.

## Snapshot facts

- Snapshot date: 2026-07-25
- Branch at snapshot: `founders-dob-harvest`
- `HEAD` at snapshot: `f09e544` (tagged `pre-query-v1`)
- `origin/main` at snapshot: `11055d4` (tagged `pre-query-v1-deployed`)
- Build verified: `npm run build:mlb` → `vite v8.1.4`, 1839 modules, built in 287ms.
- Build output sizes: `index.html` 0.92 kB · CSS 180.33 kB · JS 572.79 kB.

## Surgical rule (QUERY-SPEC §1.4)

The only permitted change to the existing four-tab app during the query.html build is
**one nav link** to the new page. No existing feature is removed or altered.
