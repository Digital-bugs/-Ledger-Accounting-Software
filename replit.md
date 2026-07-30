# Ledger Accounting Software

Professional desktop-style accounting application for Crown King, tracking partner investments, expenses, petty cash, joint income, and settlement summaries.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/ledger run dev` — run the React frontend (managed by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Optional env: `SQLITE_DATA_DIR` — override SQLite data directory (default: `artifacts/api-server/data/`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5
- DB: SQLite (better-sqlite3) — offline-first, WAL mode, crash-safe
- Validation: Zod (v3), Orval-generated schemas
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Build: esbuild

## Where things live

- `artifacts/ledger/` — React frontend (all UI pages)
- `artifacts/ledger/src/pages/` — page components (Dashboard, Backup, etc.)
- `artifacts/ledger/src/components/layout/AppLayout.tsx` — sidebar + header shell
- `artifacts/api-server/src/lib/database.ts` — SQLite init, schema, partner seed
- `artifacts/api-server/src/routes/` — REST API routes (partners, dashboard, backup)
- `artifacts/api-server/data/ledger.db` — live SQLite database
- `artifacts/api-server/data/backups/` — manual backup files
- `lib/api-spec/openapi.yaml` — source of truth for API contract

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
