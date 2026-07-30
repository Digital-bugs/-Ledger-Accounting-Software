---
name: Artifact registration on GitHub import
description: When a project is imported from GitHub, artifact.toml files exist on disk but are NOT registered in the Replit platform — causing a blank preview. Fix is to delete and recreate via createArtifact.
---

## Rule
GitHub-imported projects that already have `artifacts/*/. replit-artifact/artifact.toml` on disk are NOT automatically registered in the Replit artifact router. `listArtifacts()` returns `[]` and `presentArtifact()` fails even though the workflow runs fine.

**Why:** The artifact router registers artifacts through the `createArtifact()` platform callback. An import that brings in pre-existing `artifact.toml` files bypasses this flow. The result: the proxy has no routing rules, so the preview URL shows a blank white page even though Vite/Express are listening on their ports.

**Symptom:** Both workflows show `RUNNING`, `curl localhost:<port>` returns HTML, but the Replit preview is a blank white page with zero browser console logs (browser never reaches the dev server).

**How to apply:**
1. Back up `artifacts/<slug>/` to `/tmp/<slug>_backup/`
2. `rm -rf artifacts/<slug>/`
3. `createArtifact({ artifactType, slug, previewPath, title })` — gets a proper platform ID and registers routing
4. `pnpm install` (lockfile is up to date, fast)
5. Restore source files: `cp -r /tmp/<slug>_backup/src/* artifacts/<slug>/src/` and copy back `package.json`, `tsconfig.json`, `vite.config.ts`, `components.json`, `index.html`, `public/`
6. `WorkflowsRestart` the managed workflow

**Note:** `id = "artifacts/ledger"` (path-style) in artifact.toml is the tell that the artifact was never platform-registered. Proper IDs look like `3B4_FFSkEVBkAeYMFRJ2e`.
