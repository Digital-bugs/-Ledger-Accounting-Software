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

## Architecture decisions

- SQLite (better-sqlite3) is the persistence layer — no external database required; WAL mode + `synchronous=NORMAL` gives crash safety with good write throughput.
- Partners (Yasir 42.5%, Khurram 57.5%) are seeded once at startup in `artifacts/api-server/src/lib/database.ts` and are not user-editable by design.
- The `lib/db` Drizzle/PostgreSQL package is present but NOT used by the API server — the API uses better-sqlite3 directly. `lib/db` can be ignored unless migrating to Postgres.
- Node.js 24 is required — better-sqlite3 v13 uses NAPI 10 and segfaults silently on Node.js 20.

## Product

Crown King accounting app with modules for: Partner Investments, Partner Direct Expenses, Petty Cash Given, Accountant Expenses, Joint Company Income, Excel/CSV bulk import, Reports, Final Summary & Settlement, Backup & Restore, and a Dashboard summarising all financial totals.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Node.js 24 required** — better-sqlite3 v13 segfaults silently on Node.js 20. Always use `nodejs-24` module.
- The CSS theme (`artifacts/ledger/src/index.css`) still has all colour tokens set to `red` (placeholder). The app works but will look broken until real HSL values are filled in.
- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `lib/api-spec/openapi.yaml` before using the updated hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
