# Workflow Viewer for Bitbucket

Owner: sorenbcoding
Brand: sorenb-brand
Category: app (slate accent, ID `SorenB.WorkflowViewer`)

npm-workspaces monorepo:

- `packages/xaml-core`: XAML and project.json parser. Pure TypeScript with no DOM; tested with vitest against `samples/`.
- `packages/xaml-render`: React components, styled only with `--sb-*` tokens from `src/styles/sorenb-tokens.css`. Never use raw hex.
- `apps/dev-harness`: local Vite app (`npm run dev`) for samples and local folders.
- `apps/forge-app`: Bitbucket Cloud Forge app. Custom UI bundles the renderer and calls Bitbucket through `requestBitbucket` as the current user.

Rules:
- `samples/` holds synthetic workflows only. Never commit workflows from employer or customer repositories.
- Run `npm test`, `npm run typecheck`, and `python ~/.claude/skills/sorenb-brand/scripts/brand_check.py . --category app` before committing.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, tests, `npm run build:forge` and `npm audit --omit=dev --audit-level=high` on every pull request. The brand check runs locally only.
- Releases: none yet. The Forge app is deployed by hand with `npm run deploy` in `apps/forge-app`.
