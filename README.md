# Ledger Accounting Software

## 1. Overview

Ledger is a desktop-style accounting application for Crown King. It records partner investments, partner-paid expenses, petty cash advances, accountant expenses, joint company income, and the resulting partner settlement. It also provides reporting, Excel/CSV exchange, and SQLite backup/restore.

The repository is a pnpm workspace monorepo. The browser application and API are separate workspace packages, but the API stores data locally in SQLite rather than using a hosted database.

## 2. Technology stack

The versions below are the versions declared by the repository. A `catalog:` declaration is resolved from the workspace catalog in `pnpm-workspace.yaml` and should be checked there when upgrading.

- Node.js 24 (`.replit` requests the `nodejs-24` module)
- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript `~5.9.3` (`package.json`)
- React `19` via the workspace catalog (`artifacts/ledger/package.json`)
- Vite via the workspace catalog
- Tailwind CSS via the workspace catalog
- shadcn/ui-style components built on Radix UI
- wouter `^3.3.5` for client-side routing
- TanStack React Query via the workspace catalog
- Express `^5.2.1`
- better-sqlite3 `^13.0.2`
- Zod v3 via the workspace catalog
- Orval-generated API client and schemas
- Recharts `^2.15.2`
- SheetJS/xlsx `^0.18.5` for spreadsheet import/export
- esbuild `0.27.3` for the API build
- Pino `^9.14.0` and pino-http `^10.5.0` for logging
- Drizzle ORM is declared in `lib/db` and the API package, but the API's runtime database access is direct better-sqlite3.

Node.js 24 is important. better-sqlite3 13 requires the newer N-API available in the configured Node.js 24 environment.

## 3. Repository structure

```text
.
├── artifacts/
│   ├── api-server/                 Express API workspace
│   │   ├── src/index.ts            API entry point
│   │   ├── src/app.ts              Express application setup
│   │   ├── src/routes/              REST route modules
│   │   ├── src/lib/database.ts      SQLite initialization
│   │   └── src/lib/migrations/      Versioned schema migrations
│   ├── ledger/                     React/Vite frontend workspace
│   │   └── src/
│   │       ├── App.tsx              Routes and providers
│   │       ├── pages/               Feature pages
│   │       ├── components/          Layout and UI components
│   │       ├── context/             Shared date-period state
│   │       └── index.css            Theme and global styles
│   └── mockup-sandbox/              Isolated UI preview workspace
├── lib/
│   ├── api-spec/openapi.yaml       API contract source
│   ├── api-spec/orval.config.ts    API code-generation configuration
│   ├── api-client-react/           Generated React Query client
│   ├── api-zod/                    Generated Zod request/response schemas
│   └── db/                         Drizzle/PostgreSQL package; not used by API runtime
├── data/ledger.db                  Current local SQLite database when run from repository root
├── data/backups/                   Default backup directory (created at runtime)
├── scripts/post-merge.sh           Post-merge setup script
├── package.json                    Root scripts and workspace metadata
├── pnpm-workspace.yaml             Workspace and dependency catalogs
└── .replit                         Node, workflow, and deployment configuration
```

## 4. Frontend architecture

The frontend is in `artifacts/ledger/`. `src/main.tsx` mounts the React application. `src/App.tsx` creates the TanStack Query provider, tooltip/toast providers, wouter router, and application layout.

`src/components/layout/AppLayout.tsx` provides the sidebar and header shell. `src/components/layout/PeriodFilter.tsx` renders the shared period selector. The reusable shadcn/ui-compatible controls are in `src/components/ui/`.

The generated hooks imported from `@workspace/api-client-react` call the API and are consumed by the page components. The app uses the Vite base URL through wouter's `base` configuration, so it can be served behind an artifact path.

### Frontend pages, routes, and API usage

The pages use generated React Query hooks from `@workspace/api-client-react`; mutations invalidate/refetch related queries in the page components so lists and summary cards refresh after writes. The mapping below reflects the current page imports and route usage.

| Frontend page | URL | Main component/file | API route(s) used |
|---|---|---|---|
| Dashboard | `/` | `src/pages/Dashboard.tsx` | `GET /dashboard/summary` |
| Partner Investments | `/partner-investments` | `src/pages/PartnerInvestments.tsx` | `GET/POST /investments`, `PUT/DELETE /investments/:id`, `GET /partners` |
| Partner Direct Expenses | `/partner-expenses` | `src/pages/PartnerDirectExpenses.tsx` | `GET/POST /direct-expenses`, `PUT/DELETE /direct-expenses/:id`, `GET /partners` |
| Petty Cash Given | `/petty-cash` | `src/pages/PettyCashGiven.tsx` | `GET/POST /petty-cash-given`, `PUT/DELETE /petty-cash-given/:id`, `GET /partners` |
| Accountant Expenses | `/accountant-expenses` | `src/pages/AccountantExpenses.tsx` | `GET/POST /accountant-expenses`, `PUT/DELETE /accountant-expenses/:id` |
| Joint Company Income | `/joint-income` | `src/pages/JointCompanyIncome.tsx` | `GET/POST /joint-incomes`, `PUT/DELETE /joint-incomes/:id` |
| Final Summary & Settlement | `/settlement` | `src/pages/FinalSummary.tsx` | `GET /final-summary` |
| Excel Data Import | `/excel-import` | `src/pages/ExcelImport.tsx` | `GET /partners`, `POST /excel-import/check-duplicates`, `POST /excel-import` |
| Reports | `/reports` | `src/pages/Reports.tsx` | `GET /dashboard/summary`, transaction list routes, `GET /final-summary`, `GET /reports/monthly-data`, `GET /reports/analytics` |
| Backup & Restore | `/backup` | `src/pages/Backup.tsx` | `GET/POST /backup`, `GET /backup/health`, `GET/PUT /backup/settings`, `POST /backup/restore`, `POST /backup/upload-restore`, `DELETE /backup/:filename`, `GET /backup/download/:filename` |
| Settings | `/settings` | Inline `PageWrapper` in `src/App.tsx` | None; current page is a placeholder |

Unmatched URLs render `src/pages/not-found.tsx`.

## 5. Backend/API architecture

`artifacts/api-server/src/index.ts` is the process entry point. `src/app.ts` configures Express, CORS, JSON and URL-encoded body parsing, Pino request logging, and the `/api` route prefix. It imports the database module during startup and starts the backup scheduler.

Route modules are registered by `artifacts/api-server/src/routes/index.ts`. API responses and request bodies are validated with schemas from `@workspace/api-zod`. The OpenAPI source for the generated contract is `lib/api-spec/openapi.yaml`.

### API endpoint inventory

All endpoints below are relative to `/api`.

#### Health and partners

- `GET /healthz` — process/API health response.
- `GET /partners` — fixed partner list and share percentages.

#### Dashboard

- `GET /dashboard/summary` — totals and partner contribution breakdown. Accepts optional `dateFrom` and `dateTo`.

#### Transaction modules

Each transaction module has a list endpoint, a summary endpoint, and create/update/delete endpoints:

- Investments: `GET /investments`, `GET /investments/summary`, `POST /investments`, `PUT /investments/:id`, `DELETE /investments/:id`
- Partner direct expenses: `GET /direct-expenses`, `GET /direct-expenses/summary`, `POST /direct-expenses`, `PUT /direct-expenses/:id`, `DELETE /direct-expenses/:id`
- Petty cash given: `GET /petty-cash-given`, `GET /petty-cash-given/summary`, `POST /petty-cash-given`, `PUT /petty-cash-given/:id`, `DELETE /petty-cash-given/:id`
- Accountant expenses: `GET /accountant-expenses`, `GET /accountant-expenses/summary`, `POST /accountant-expenses`, `PUT /accountant-expenses/:id`, `DELETE /accountant-expenses/:id`
- Joint company income: `GET /joint-incomes`, `GET /joint-incomes/summary`, `POST /joint-incomes`, `PUT /joint-incomes/:id`, `DELETE /joint-incomes/:id`

List and summary routes support date filtering where implemented. Transaction lists also support search, pagination, and sort direction in the relevant route modules. Exact request and response schemas are in `lib/api-spec/openapi.yaml` and the generated packages.

#### Settlement, reports, and import

- `GET /final-summary` — calculated partner totals, expected shares, differences, and settlement direction. Accepts `dateFrom` and `dateTo`.
- `GET /reports/monthly-data` — month-by-month totals for investments, expenses, petty cash, accountant expenses, and income.
- `GET /reports/analytics` — monthly expense/income KPIs and total transaction count.
- `POST /excel-import/check-duplicates` — checks receipt numbers against the selected module.
- `POST /excel-import` — validates and bulk-imports rows with `skip` or `replace` duplicate behavior.

#### Backup and restore

- `GET /backup` — lists `.db` backup files.
- `POST /backup` — creates a manual SQLite backup.
- `GET /backup/health` — integrity, foreign-key, WAL, and expected-table checks.
- `GET /backup/settings` — reads persisted backup settings.
- `PUT /backup/settings` — updates automatic backup settings and restarts the scheduler.
- `POST /backup/upload-restore` — accepts a raw `application/octet-stream` SQLite file, validates it, replaces the live database, and exits so the process manager can restart it.
- `POST /backup/restore` — restores a named backup after validation and exits for restart.
- `DELETE /backup/:filename` — deletes a backup file.
- `GET /backup/download/:filename` — downloads a backup file.

## 6. SQLite storage

The database implementation is `artifacts/api-server/src/lib/database.ts`.

- Data directory: `path.resolve(process.env.SQLITE_DATA_DIR)` when `SQLITE_DATA_DIR` is set; otherwise `path.resolve(process.cwd(), "data")`.
- Database file: `<data directory>/ledger.db`.
- Default repository-root location: `data/ledger.db` when the server is started from the repository root.
- Backups: `<data directory>/backups/`.
- Backup settings: `<data directory>/backup-settings.json`.

The startup code creates the data and backup directories, opens the database with better-sqlite3, enables `journal_mode = WAL`, enables foreign keys, and uses `synchronous = NORMAL`. The database is created automatically if it does not exist.

The checked-in `data/ledger.db`, `data/ledger.db-shm`, and `data/ledger.db-wal` files are local database artifacts. Do not assume a checked-in database is a clean production baseline; inspect and back it up before any destructive work.

## 7. Database schema and relationships

The current schema is defined in `artifacts/api-server/src/lib/migrations/001_initial_schema.ts`.

| Database table | Purpose | Important columns | Relationships |
|---|---|---|
| `partners` | Fixed partner master data and settlement percentages | `id`, `name`, `share_percentage` | Referenced by partner transaction tables |
| `investments` | Money invested by a named partner | `id`, `receipt_number`, `entry_date`, `description`, `partner_id`, `amount`, `created_at` | `partner_id → partners.id` |
| `direct_expenses` | Company expenses paid directly by a named partner | Same record fields as investments | `partner_id → partners.id` |
| `petty_cash_given` | Petty cash advanced by a named partner | Same record fields as investments | `partner_id → partners.id` |
| `petty_cash_spent` | Accountant expenses paid from petty cash | `id`, `receipt_number`, `entry_date`, `description`, `amount`, `created_at` | No partner foreign key |
| `joint_incomes` | Company income not assigned to a single partner | `id`, `receipt_number`, `entry_date`, `description`, `income_type`, `amount`, `created_at` | No foreign key |
| `schema_migrations` | Tracks which versioned schema changes have run | `version`, `name`, `applied_at` | Migration bookkeeping |

Amounts are stored as SQLite `REAL`, dates as text, and generated timestamps use SQLite `datetime('now')`. Foreign keys are enabled at connection initialization.

Partners are seeded once when the table is empty:

- Yasir — `42.5%`
- Khurram — `57.5%`

The current API does not provide a partner-editing endpoint. The code describes these as fixed seeded partners; changing them requires a deliberate database/code change.

## 8. Migrations and safe schema changes

Migrations live in `artifacts/api-server/src/lib/migrations/`. Each migration implements the `Migration` type from `types.ts`, with a numeric `version`, a name, and an `up(db)` function. The ordered migration list is currently in `migrations/index.ts`.

On startup, `runMigrations()`:

1. Creates `schema_migrations` if needed.
2. Reads already-applied versions.
3. Detects pending migrations.
4. Creates a SQLite backup in the backup directory before applying pending work.
5. Adopts an older database that already has the complete initial application schema by marking migration 001 applied rather than recreating its tables.
6. Runs each pending migration in a transaction and records its version/name.

### Creating a future migration

1. Back up the client database independently before editing schema code.
2. Add a new file such as `002_descriptive_name.ts` in `artifacts/api-server/src/lib/migrations/`.
3. Export a migration with the next unused numeric version and a deterministic `up(db)` implementation.
4. Add it to the ordered `migrations` array in `artifacts/api-server/src/lib/migrations/index.ts`.
5. Prefer additive, backwards-compatible changes; preserve existing rows and IDs.
6. Review foreign keys, nullability, defaults, indexes, and rollback/recovery implications.
7. Start the API against a copy of a real client database and verify the migration, application reads/writes, and backup health before updating the original.

Never delete or recreate the production/client database to “apply” a migration. Never drop tables, overwrite `ledger.db`, remove `schema_migrations`, or reset partner/transaction data as part of a normal update. Do not edit an already-applied migration; add a new corrective migration instead.

## 9. Preserving client data during updates

Application code updates should leave the external data directory untouched. Keep `SQLITE_DATA_DIR` stable for a client installation, and do not replace the directory when updating binaries or frontend assets. The migration runner is designed to evolve the schema in place and takes a pre-migration SQLite backup when work is pending.

For a major update:

1. Stop writes to the application.
2. Use the Backup page or `POST /api/backup` to create a fresh backup.
3. Copy the entire data directory, including `ledger.db`, WAL-related files if the database is active, `backups/`, and `backup-settings.json`.
4. Keep the backup outside the application install directory.
5. Apply the update to a test copy first.
6. Start the updated API with the same data directory and inspect `/api/backup/health`.
7. Confirm representative transaction lists, summaries, reports, imports, and settlement values before returning the client to service.

The repository does not confirm a formal retention policy, encryption-at-rest policy, or off-device backup process.

## 10. Backup and restore

Backup implementation: `artifacts/api-server/src/routes/backup.ts`; UI: `artifacts/ledger/src/pages/Backup.tsx`.

Manual backups use better-sqlite3's database backup API and are named `Ledger_Accounting_Backup_YYYY-MM-DD_HH-mm.db`. The default backup folder is `<data directory>/backups/`.

Automatic backup settings are stored in `backup-settings.json`:

- `autoBackupEnabled` — default `false`
- `autoBackupSchedule` — `startup`, `daily`, `weekly`, or `monthly`; default `daily`
- `backupFolder` — default `<data directory>/backups/`
- `maxBackupHistory` — default `10`; `null` disables automatic retention deletion
- `lastAutoBackup` — recorded internally when an automatic backup succeeds

The scheduler starts from `app.ts`. Startup backups run once; other schedules use an interval. When the maximum history is exceeded, older `.db` files in the configured backup folder are removed.

Restore validates the selected file as SQLite, uses `path.basename` to prevent path traversal, closes the live connection, copies the backup over the live database, returns a success response, and exits after the response is flushed. The workflow/process manager must restart the API. Upload restore accepts up to 200 MB of raw binary data and follows the same replacement/restart pattern.

Before restoring, preserve the current data directory and create an additional backup. Restore is destructive: all data in the live database is replaced by the selected file.

## 11. Offline and data-storage behavior

The persistence layer is local SQLite and does not require a remote database or network connection for stored data. The API and frontend still need to be running for the UI to operate. No synchronization, multi-device replication, conflict resolution, or cloud backup behavior is confirmed by the current codebase.

## 12. Accounting modules and calculations

### Dashboard

`src/pages/Dashboard.tsx` requests `/api/dashboard/summary`. `src/routes/dashboard.ts` calculates:

- Total investments: sum of `investments.amount`
- Total direct expenses: sum of `direct_expenses.amount`
- Total petty cash given: sum of `petty_cash_given.amount`
- Total accountant expenses: sum of `petty_cash_spent.amount`
- Total joint income: sum of `joint_incomes.amount`
- Accountant cash balance: total petty cash given minus total accountant expenses
- Per-partner contribution: that partner's investment total plus direct expense total plus petty cash given total

### Partner investments

UI: `artifacts/ledger/src/pages/PartnerInvestments.tsx`. API: `artifacts/api-server/src/routes/investments.ts`. Records belong to a partner and contain receipt number, date, description, and amount. They contribute to each partner's amount paid in the final settlement.

### Partner direct expenses

UI: `artifacts/ledger/src/pages/PartnerDirectExpenses.tsx`. API: `artifacts/api-server/src/routes/direct-expenses.ts`. These are partner-specific direct company expenses and contribute to the partner's amount paid.

### Petty cash given

UI: `artifacts/ledger/src/pages/PettyCashGiven.tsx`. API: `artifacts/api-server/src/routes/petty-cash-given.ts`. A partner provides petty cash and is credited for that amount in settlement. The aggregate also funds the accountant cash balance.

### Accountant expenses

UI: `artifacts/ledger/src/pages/AccountantExpenses.tsx`. API: `artifacts/api-server/src/routes/accountant-expenses.ts`. These records use the `petty_cash_spent` table and do not belong to a partner. New or edited expenses cannot exceed the current accountant cash balance; when editing, the existing amount is added back before checking the replacement amount.

### Joint company income

UI: `artifacts/ledger/src/pages/JointCompanyIncome.tsx`. API: `artifacts/api-server/src/routes/joint-incomes.ts`. Income has an optional/validated income type in the API contract and is included in dashboard, reports, and final-summary data. The import implementation recognizes `Rent`, `Office Sale`, `Flat Sale`, and `Other`.

### Final Summary & Settlement

UI: `src/pages/FinalSummary.tsx`. API and authoritative calculation: `artifacts/api-server/src/routes/final-summary.ts`.

For the selected date range:

```text
Yasir total paid =
  Yasir investments + Yasir direct expenses + Yasir petty cash given

Khurram total paid =
  Khurram investments + Khurram direct expenses + Khurram petty cash given

Combined total paid = Yasir total paid + Khurram total paid

Yasir expected share = combined total paid × Yasir share percentage / 100
Khurram expected share = combined total paid × Khurram share percentage / 100

Yasir difference = Yasir total paid - Yasir expected share
Khurram difference = Khurram total paid - Khurram expected share

Settlement amount = absolute value of Yasir difference
```

The implementation expects the two differences to be equal and opposite. A settlement amount below `0.005` is treated as settled. If Yasir's difference is positive, Khurram pays Yasir; otherwise Yasir pays Khurram. The result includes a human-readable Pakistani rupee message and a `hasData` flag based on combined paid totals or joint income.

The final-summary route also calculates:

- Total direct expenses = Yasir direct expenses + Khurram direct expenses
- Total expenses = total direct expenses + accountant expenses
- Accountant cash balance = total petty cash given − accountant expenses

Do not duplicate or “simplify” this formula in another layer; change the API implementation and contract deliberately if accounting rules change.

## 13. Period and date-filter behavior

Shared state is in `artifacts/ledger/src/context/PeriodContext.tsx`, and the control is `src/components/layout/PeriodFilter.tsx`. The default preset is **This Month**. Supported presets are Today, This Week (Monday through Sunday), This Month, Last Month, This Year, Last Year, Custom Date Range, and All Time.

The frontend sends inclusive `dateFrom` and `dateTo` values in `YYYY-MM-DD` form. All Time sends no date bounds. Dashboard, transaction lists/summaries, final summary, reports, and relevant page exports use the selected period. Backend date filtering compares the stored `entry_date` text values to the bounds.

> When modifying or adding a financial list, summary, dashboard card, report, export, or calculation, verify that the same selected date range is applied consistently wherever the user expects period-filtered values.

When adding a new summary or report, apply the same date range to both the list and its aggregate queries. This is an important consistency rule for this application.

## 14. Excel/CSV import and export

Import UI: `artifacts/ledger/src/pages/ExcelImport.tsx`. API: `artifacts/api-server/src/routes/excel-import.ts`. Spreadsheet parsing uses `xlsx`.

Supported import modules are investments, direct expenses, petty cash given, accountant expenses, and joint incomes. The API maps those module keys to the five transaction tables. Partner modules require `partnerId`; joint income requires one of `Rent`, `Office Sale`, `Flat Sale`, or `Other`; all rows require an ISO date and non-negative numeric amount.

The duplicate check and import logic normalize receipt numbers by trimming and comparing case-insensitively. Empty rows are skipped. Duplicate rows can be skipped (default) or replaced. Validation occurs before the valid rows are inserted/replaced in one SQLite transaction. The response reports imported, replaced, skipped, and row-level errors.

The reports and transaction pages provide browser-side print, Excel, and CSV export controls. The exact exported column labels and formatting are implemented in the page components; they are not a separate server export service.

## 15. Reports

UI: `artifacts/ledger/src/pages/Reports.tsx`. API: `artifacts/api-server/src/routes/reports.ts`.

- Monthly data groups each table by `strftime('%Y-%m', entry_date)`.
- Monthly total expenses are direct expenses + petty cash given + accountant expenses.
- Analytics reports highest monthly expense, highest monthly income, total transactions across the five transaction tables, average monthly expense, average monthly income, and the month associated with each maximum.
- Reports consume the global period and expose settlement/overall summary views plus print, Excel, and CSV export controls.

## 16. Configuration and environment

Confirmed configuration:

- `SQLITE_DATA_DIR` — optional absolute or relative data-directory override, resolved by `database.ts`.
- `PORT` — supplied by the Replit workflows; the API workflow uses `8080` and the Vite workflow uses `5173`.
- `BASE_PATH` — supplied as `/` by the configured ledger workflow; Vite also provides the client base URL.
- `SESSION_SECRET` is present in the Replit environment snapshot, but no session/authentication implementation is confirmed in the current application code.

Do not put secrets in source control or README files. The repository does not confirm authentication, authorization, or a required external service integration.

## 17. Clean-machine setup and run commands

The following is the repository-confirmed setup sequence. The API process requires `PORT`; it fails fast when the variable is missing or invalid.

1. Install Node.js 24 and pnpm.
2. Clone or copy the repository and open a shell at its root.
3. Install workspace dependencies:

   ```bash
   pnpm install
   ```

4. Optionally choose a stable writable data directory by setting `SQLITE_DATA_DIR`. If omitted, the API uses `data/` relative to its current working directory.
5. Start the API in one shell:

   ```bash
   PORT=8080 pnpm --filter @workspace/api-server run dev
   ```

6. Start the frontend in another shell:

   ```bash
   PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ledger run dev
   ```

7. Confirm the API responds at `GET /api/healthz`.
8. Open the frontend at the Vite/Replit preview URL for the running ledger workflow.

The configured `.replit` workflow named `Project` runs both services in parallel. `PORT` is consumed by the API entry point and supplied to the Vite command; `BASE_PATH` is supplied to the frontend workflow. The codebase does not define a separate application-level `BASE_PATH` reader.

The API must be available under `/api` for the frontend.

Useful checks:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/ledger run typecheck
```

## 18. Build commands

Build everything:

```bash
pnpm run build
```

This runs the root TypeScript build and then the workspace build scripts. Individual builds are:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/ledger run build
```

The API build emits its bundled server to `artifacts/api-server/dist/`; the frontend build follows the Vite configuration in `artifacts/ledger/vite.config.ts`.

## 19. API specification and code generation

The source of truth is `lib/api-spec/openapi.yaml`. Orval configuration is in `lib/api-spec/orval.config.ts`. Generated client hooks are in `lib/api-client-react/`, and generated Zod schemas are in `lib/api-zod/`.

After changing the OpenAPI contract:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Review the generated changes, typecheck all affected packages, and update both server route behavior and frontend consumers as needed. Do not hand-edit generated output as the long-term fix; change the OpenAPI source and regenerate.

## 20. Safely adding or modifying features

### Add a feature

1. Understand the existing architecture and trace the affected flow.
2. Identify the affected frontend, generated client, OpenAPI contract, route, database table, and calculation layers.
3. Define or update the API contract in `lib/api-spec/openapi.yaml` when the feature crosses the API boundary.
4. Regenerate the client and Zod packages.
5. Add a new migration if persistence changes; do not alter an applied migration.
6. Add or update the focused API route under `artifacts/api-server/src/routes/`.
7. Add the page/component under `artifacts/ledger/src/` and wire its route in `App.tsx`.
8. Connect all queries and mutations through the generated client.
9. Invalidate/refetch affected queries after writes.
10. Apply the global period consistently to lists, summaries, dashboard values, reports, exports, and calculations.
11. Verify financial formulas if financial data is involved.
12. Typecheck and manually verify CRUD and the affected workflow against a disposable/copy database.
13. Create a fresh backup before updating a client installation and confirm existing record counts/data remain intact afterward.

### Modify an existing feature

Trace the change in this order:

```text
UI page/component
  → generated API client hook
  → OpenAPI source and generated schemas
  → Express route
  → SQLite table/query
  → summary/report/final calculation
```

Preserve response shapes unless the contract is intentionally updated and regenerated. For accounting behavior, treat `final-summary.ts`, `dashboard.ts`, and module summaries as authoritative implementation points and update all affected displays together.

Before changing data behavior, create a backup and test with a copied database. Avoid broad refactors of the workspace or replacing the SQLite runtime with another database unless explicitly required.

After an existing-feature change, verify existing records, list results, summaries, refresh/query invalidation, period filters, dashboard cards, reports, and Final Summary/Settlement whenever the change can affect them. Broad refactors should not be made without tracing their financial side effects.

## 22. Future Windows EXE packaging

The database module explicitly resolves `SQLITE_DATA_DIR` so an Electron or other desktop wrapper can place user data outside the packaged application directory. A Windows EXE packager must:

- ship a Node.js/runtime combination compatible with better-sqlite3 13 (Node.js 24/N-API 10 is the confirmed working target);
- keep the writable SQLite data directory separate from read-only packaged assets;
- preserve `ledger.db`, backup files, settings, and any SQLite WAL state during updates;
- stop the API before replacing/restoring the database;
- ensure the native better-sqlite3 binary is built for the target architecture;
- preserve the API restart behavior after restore.

An Electron configuration, installer, code-signing setup, update channel, or supported Windows architecture is **Not confirmed by the current codebase.**

## 23. Important dependencies and operational gotchas

- Run with Node.js 24. Older Node.js versions can fail with better-sqlite3 native-module incompatibility.
- The API uses better-sqlite3 directly. The Drizzle/PostgreSQL package under `lib/db` is not the active persistence layer.
- SQLite WAL mode creates companion `-shm` and `-wal` files while the database is active. Do not copy only the main file while writes are in progress; use the SQLite backup endpoint/API.
- Restoring a database intentionally exits the API process so the workflow manager can restart it.
- Backup retention can delete older `.db` files when `maxBackupHistory` is reached. Keep independent/off-device copies for important client data.
- The frontend currently contains an inline Settings placeholder rather than a confirmed settings-management feature.
- The API disables Express ETags because the shared client expects repeated GETs to include a JSON body rather than an empty `304` response.
- The current codebase has no confirmed authentication/authorization layer, automated test suite, audit log, multi-user conflict handling, or hosted synchronization.
- The current theme contains placeholder red color tokens in `artifacts/ledger/src/index.css`; this is a visual limitation, not an accounting behavior.

## 24. Known limitations and not-confirmed areas

The following are not implemented or verifiable from the repository:

- Authentication and authorization — **Not confirmed by the current codebase.**
- Automated test suite — **Not confirmed by the current codebase.**
- Cloud synchronization, multi-device sync, and conflict resolution — **Not confirmed by the current codebase.**
- Audit log — **Not confirmed by the current codebase.**
- Encrypted backups or an off-device backup policy — **Not confirmed by the current codebase.**
- Production Windows EXE packaging, installer, code signing, or automatic application updates — **Not confirmed by the current codebase.**
- Formal deployment/operations runbook beyond the repository's `.replit` configuration — **Not confirmed by the current codebase.**

The Settings route is currently an inline placeholder. The current API has no partner-editing endpoint. The theme contains placeholder red color tokens in `artifacts/ledger/src/index.css`.

## 25. Troubleshooting

### API does not start

Check that dependencies are installed with pnpm and that the runtime is Node.js 24. Inspect the API workflow logs. Confirm `PORT` is free and that the process can create/write the configured `SQLITE_DATA_DIR`.

### Frontend loads but data is empty or unavailable

Confirm the API workflow is running and that requests target `/api`. Check `GET /api/healthz`, then inspect browser and API logs. Ensure both services use the same artifact routing/base-path configuration.

### Migration or database error

Stop writes, preserve the current data directory, and use a known-good backup. Check `schema_migrations`, the migration list, and the pre-migration backup created under the backup directory. Never delete migration records or apply a migration by manually recreating the database.

### Backup health reports an error

Use the Backup page or `GET /api/backup/health`. The endpoint checks SQLite integrity, foreign keys, WAL mode, and the six expected application tables. Preserve the current database before attempting restore.

### Accountant expense is rejected

The amount cannot exceed the current accountant cash balance, calculated as petty cash given minus accountant expenses. When editing, the existing expense amount is temporarily added back for the availability check.

### Settlement appears unexpected

Confirm the selected date range, partner share percentages, and each partner's investment/direct-expense/petty-cash totals. The authoritative calculation is in `artifacts/api-server/src/routes/final-summary.ts`; the settlement amount is based on the absolute Yasir difference and uses a `0.005` rounding tolerance.

### Date-filter mismatch

Compare the selected period in `artifacts/ledger/src/context/PeriodContext.tsx` with the `dateFrom`/`dateTo` parameters sent by the page and the `WHERE` clauses in the corresponding route. Lists and summaries for the same module must use the same inclusive bounds.

### API specification or generated-client mismatch

Update `lib/api-spec/openapi.yaml`, run the API-spec codegen command, review generated client/schema changes, then update the server and frontend consumers. Do not use hand-edited generated files as the permanent source of truth.

## 26. Maintenance checklist

Before a schema or major application update:

1. Create and download a fresh SQLite backup.
2. Make a separate copy of the complete data directory.
3. Record the current application/database version and backup location.
4. Test the update and migrations against a copy.
5. Keep migrations additive and transactional.
6. Run typechecks and the relevant build commands.
7. Verify health, representative CRUD operations, period-filtered totals, import duplicate handling, reports, and settlement.
8. Keep the original backup until the updated data has been accepted.
9. Confirm existing record counts and representative data values were preserved.

This README documents behavior confirmed by the repository at the time it was written. Where a policy, deployment detail, or packaging implementation is not present in source, it is intentionally identified as **Not confirmed by the current codebase.**