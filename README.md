# realconvergy — Convergence monorepo

Per `specs/WNBA-REDESIGN-SPEC.md` §1. Two Netlify sites, one repo.

```
packages/gematria-core/   shared cipher engine + checksum
packages/ui-theme/        Astryx gothic re-skin (scanner palette)
apps/mlb/                 LAYOUT-SPEC four-tab app (live: convergence-board.netlify.app)
apps/wnba/                WNBA app (WNBA-REDESIGN-SPEC)
data/                     birthdays.json · wnba-h2h.json · registries (build-time imports)
specs/                    committed design docs (the recovery path)
scripts/                  one-time harvesters (h2h, birthdays)
```

- Dev: `npm install` at root (workspaces), then `npm run dev:mlb` / `dev:wnba`.
- Deploys: Netlify site per app — base dir `apps/mlb` / `apps/wnba` (or CLI: `npm run build:wnba && npx netlify-cli deploy --prod --dir apps/wnba/dist`).
- `specs/live-session-rules-2026-06-10.md` referenced by the redesign spec was not found on disk at migration time — recover it if it resurfaces.
- `Downloads/convergence-app` remains the Netlify-CLI-linked working copy of the MLB app until the site is repointed to this repo; `apps/mlb` is the version-controlled source going forward.
