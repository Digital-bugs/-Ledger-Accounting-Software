# Task: Finalize `README.md` as Complete A-to-Z Developer Handover Documentation

Work **ONLY on the root `README.md`**. This is a documentation-only task.

## Strict scope — do not touch the application

Before doing anything, understand this clearly:

* Do **not** modify any application/business logic.
* Do **not** modify the database or SQLite data.
* Do **not** run migrations against the live database.
* Do **not** delete, reset, seed, replace, or modify any client/demo data.
* Do **not** change accounting calculations or the Final Summary.
* Do **not** change Joint Company Income / Joint Payments behavior.
* Do **not** modify API routes, frontend pages, OpenAPI, generated code, dependencies, workflows, `.replit`, build configuration, or any other project files.
* Do **not** start workflows, Preview, API, frontend, build, typecheck, install, or setup commands.
* Do **not** spend time fixing unrelated project issues.

Your job is **documentation inspection and README.md improvement only**.

---

# Main objective

The final `README.md` must become a **complete A-to-Z technical handover guide** for this exact software in its current state.

The goal is that a future developer — whether human or AI — can receive only this source code, read the README, inspect the referenced files, and understand:

1. what the software does;
2. how to set it up and run it;
3. how the frontend, backend, API, and database connect;
4. where every important part of the code lives;
5. how all current accounting modules work;
6. how current calculations and Final Summary work;
7. how to safely fix or modify a feature;
8. how to add a future feature;
9. how to safely evolve SQLite without losing client data;
10. how backups and restore work;
11. how to update the application safely in the future;
12. how to troubleshoot common problems;
13. what is confirmed by the repository and what is not confirmed.

The documentation should reduce future dependency on the original developer as much as possible.

---

# Required process

First, inspect the **actual repository source code and current existing README** carefully.

Do not guess.

Where information already exists in the current README, preserve and improve it rather than unnecessarily removing useful information.

For every important claim:

* verify it from the repository where possible;
* use actual file paths;
* use actual route names;
* use actual table names;
* use actual commands;
* use actual calculation behavior;
* clearly mark anything that cannot be confirmed from the current codebase as **Not confirmed by the current codebase**.

Do not invent features, infrastructure, deployment systems, security systems, EXE packaging, authentication, tests, or cloud services that do not actually exist.

---

# README.md must cover all of the following

## 1. Project overview

Explain:

* software name;
* business purpose;
* current accounting scope;
* major modules;
* offline/local-data behavior;
* what the software does in practical terms.

## 2. Technology stack

Document the actual stack and important versions/requirements, including where confirmed:

* Node.js requirement;
* pnpm workspaces;
* TypeScript;
* React/Vite;
* Express;
* SQLite / better-sqlite3;
* validation;
* OpenAPI;
* Orval/code generation;
* charts/import libraries;
* build tooling.

Clearly explain why any critical runtime requirement matters.

## 3. Complete repository architecture

Provide a useful repository tree and explain the purpose of all important directories and files.

At minimum cover:

* frontend;
* backend/API;
* routes;
* database code;
* migrations;
* API specification;
* generated API client;
* generated schemas;
* reports;
* import/export;
* backup/restore;
* data directories;
* scripts;
* workspace configuration.

The purpose is that a developer can quickly locate where to make a change.

## 4. Frontend architecture

Document:

* application entry point;
* routing;
* main layout;
* pages;
* reusable components;
* global period/date state;
* API client usage;
* React Query/query invalidation behavior if present;
* where styling/theme lives.

Include a table mapping:

`Frontend Page → URL → Main Component/File → API Route(s) Used`

Use actual repository information only.

## 5. Backend/API architecture

Explain:

* API entry point;
* Express app setup;
* middleware;
* route registration;
* database initialization;
* validation;
* API contract;
* response behavior;
* important shared HTTP behavior.

Include an endpoint inventory based on the actual code/OpenAPI.

For each important endpoint group, explain its purpose and relevant request parameters.

## 6. Complete database documentation

Document the actual SQLite database:

* database location behavior;
* configurable data directory;
* backup directory;
* WAL behavior;
* foreign keys;
* synchronous mode;
* all important tables;
* key columns;
* relationships;
* date fields;
* amount storage;
* timestamps.

Include a clear table:

`Database Table → Purpose → Important Columns → Relationships`

Do not expose or invent data values beyond what is required for documentation.

## 7. Database migration system — critical

This section must be especially clear.

Explain the current versioned migration architecture:

* migration folder;
* migration type/interface;
* migration numbering;
* migration registry/order;
* `schema_migrations`;
* startup migration behavior;
* legacy database adoption behavior if implemented;
* pre-migration backup behavior;
* transaction behavior;
* idempotency;
* why existing migrations must not be edited after production use.

Provide an exact safe workflow for adding a future migration, for example:

1. create backup;
2. add new numbered migration;
3. make only the required schema change;
4. register the migration;
5. test against a copy of a real database;
6. verify old records remain intact;
7. run application checks;
8. deploy while preserving the existing data directory.

Also add clear warnings:

* NEVER delete/recreate the client database to apply an update.
* NEVER reset transaction data during a normal software update.
* NEVER edit or reuse an already-applied migration.
* Prefer a new corrective migration.
* Test destructive/complex changes against a copy first.

## 8. Client data preservation during future updates

Provide a practical update checklist for future developers.

Explain:

* application files and user data should be separated;
* the SQLite data directory must remain stable;
* existing `ledger.db` must be preserved;
* backups should be created before major updates;
* migrations should update in place;
* updates should first be tested against a copied database;
* how to verify the application after updating.

Make this section practical enough for a future developer to follow.

## 9. Backup and restore

Document the actual implementation:

* manual backup;
* automatic backup if implemented;
* backup naming/location;
* backup settings;
* retention behavior if implemented;
* health checks;
* restore process;
* upload restore if present;
* API restart behavior after restore;
* destructive nature of restore.

Clearly explain what a developer should do before restoring a database.

## 10. Accounting modules

Document every current module separately, based on the actual code:

* Partner Investments;
* Partner Direct Expenses;
* Petty Cash Given;
* Accountant Expenses / Petty Cash Spent;
* Joint Company Income;
* Dashboard;
* Final Summary & Settlement;
* Reports;
* Excel/CSV Import.

For each module explain:

`Frontend page → API route → Database table → What the record means → Important validation → How it affects totals/calculations`

Do not redesign any accounting logic. Document the current implementation only.

## 11. Accounting calculations — critical

Document the actual authoritative formulas in clear language.

Verify them from the current code before writing.

At minimum explain:

* dashboard totals;
* partner contributions/total paid;
* investments;
* direct expenses;
* petty cash given;
* accountant cash balance;
* accountant expenses;
* joint company income;
* Final Summary totals;
* expected partner shares;
* differences;
* settlement amount;
* settlement direction;
* rounding/tolerance behavior if implemented.

Use formulas where helpful.

Also clearly identify the authoritative source file(s) for these calculations.

**Do not change any calculation code. Documentation only.**

## 12. Period and date filtering

Document:

* default period;
* all supported presets;
* custom range behavior;
* All Time behavior;
* date format;
* inclusive/exclusive boundaries based on actual code;
* frontend context;
* how dates are sent to the API;
* which pages/endpoints use the period.

Add a strict consistency rule:

> When modifying or adding a financial list, summary, dashboard card, report, export, or calculation, verify that the same selected date range is applied consistently wherever the user expects period-filtered values.

## 13. Excel/CSV import and export

Document:

* supported modules;
* expected data;
* validation;
* partner requirements;
* income type requirements if applicable;
* duplicate detection;
* skip/replace behavior;
* transaction behavior;
* import result/error reporting;
* where export functionality is implemented.

Only document actual current behavior.

## 14. Reports

Explain:

* report endpoints;
* monthly grouping;
* expense/income calculations;
* analytics;
* KPIs;
* period filtering;
* export/print behavior where implemented.

## 15. Configuration and environment

Document all confirmed configuration variables and their purpose.

For example, only where confirmed:

* `SQLITE_DATA_DIR`;
* `PORT`;
* `BASE_PATH`;
* any other actual environment variables.

Do not put secrets in the README.

Clearly distinguish environment variables that are actually used by code from variables that merely exist in an environment configuration.

## 16. How to run the project from a clean machine

Provide a practical step-by-step setup guide:

1. required Node.js version;
2. install pnpm/dependencies;
3. install project dependencies;
4. configure data directory if needed;
5. start API;
6. start frontend;
7. confirm health;
8. access the application.

Use only commands confirmed by the repository.

Do not actually run them during this task.

## 17. Build and verification commands

Document actual commands for:

* API build;
* frontend build;
* workspace build;
* typecheck;
* code generation.

If a known check currently has pre-existing errors or warnings, document that carefully only if confirmed by repository evidence. Do not falsely claim the entire project is error-free.

## 18. API specification and code generation workflow

Explain:

`OpenAPI source → Orval generation → generated client/schemas → backend/frontend usage`

Give the exact safe workflow for changing an API contract:

1. update source OpenAPI file;
2. regenerate;
3. update server implementation;
4. update frontend consumers;
5. check generated changes;
6. typecheck/build affected packages;
7. verify the feature.

Clearly warn against hand-editing generated files as the long-term source of truth.

## 19. Safe workflow for adding a new feature

Provide a reusable step-by-step workflow:

1. understand existing architecture;
2. identify affected frontend/backend/database/API layers;
3. update API contract if required;
4. add migration if schema changes;
5. implement backend;
6. implement frontend;
7. connect generated client/hooks;
8. invalidate/refetch affected queries;
9. apply period filtering consistently;
10. verify calculations if financial data is involved;
11. test CRUD;
12. test against a copy of real client data;
13. create backup before production update;
14. verify no existing data was lost.

## 20. Safe workflow for modifying an existing feature

Explain how a developer should trace:

`UI → API client → OpenAPI → Route → Database → Calculations`

Warn against broad refactors without understanding financial side effects.

Require verification of:

* existing records;
* lists;
* summaries;
* dashboard;
* date filters;
* reports;
* Final Summary/Settlement where affected.

## 21. Common troubleshooting

Include practical troubleshooting for actual likely issues, such as:

* API does not start;
* frontend cannot load data;
* data appears empty;
* database path problem;
* migration error;
* backup health problem;
* accountant expense validation rejection;
* unexpected settlement;
* date-filter mismatch;
* code generation mismatch;
* native better-sqlite3/Node version compatibility.

Only include issues supported by the actual project.

## 22. Known limitations and not-confirmed areas

Create a clear section for anything not implemented or not verifiable, for example only if actually absent:

* authentication/authorization;
* automated test suite;
* cloud synchronization;
* multi-device sync;
* audit log;
* encrypted backups;
* production EXE packaging;
* installer;
* code signing;
* automatic application updates.

Use the exact wording:

**Not confirmed by the current codebase**

where appropriate.

## 23. Future Windows EXE packaging guidance

Document what is known from the current architecture and what a future desktop-packaging developer must preserve:

* writable SQLite data must remain outside packaged/read-only application files;
* updates must preserve the data directory;
* database migrations must run safely;
* backups/settings must survive updates;
* better-sqlite3 native compatibility must be considered;
* restore/restart behavior must be handled.

Do not claim that Electron, an installer, signing, auto-update, or a Windows packaging configuration already exists unless confirmed.

## 24. Final maintenance checklist

Add a concise but serious checklist for future developers before any major update:

* create fresh backup;
* copy data directory;
* test on copied database;
* review migrations;
* build/typecheck relevant packages;
* test representative CRUD;
* verify lists and refresh behavior;
* verify period filtering;
* verify dashboard;
* verify reports;
* verify Final Summary/Settlement if affected;
* verify backup health;
* confirm existing record counts/data were preserved.

---

# Documentation quality requirements

The final README must be:

* professional;
* clear;
* technically accurate;
* practical;
* self-contained;
* easy to navigate;
* suitable for both a human developer and AI coding agent;
* detailed enough for independent future maintenance;
* based on actual repository evidence.

Use:

* headings;
* tables where useful;
* code blocks for commands/formulas;
* warnings for destructive operations;
* actual paths;
* actual module names.

Do not make the README unnecessarily verbose with generic theory. Every section should help a future developer work on this specific repository.

---

# Important accuracy rule

Before finalizing, perform a documentation consistency review of the README against the repository.

Specifically check for:

* incorrect paths;
* incorrect database locations;
* incorrect endpoint names;
* incorrect table names;
* incorrect migration behavior;
* incorrect calculation formulas;
* outdated module names;
* guessed commands;
* contradictory statements;
* references to features that do not exist.

Correct documentation errors only inside `README.md`.

Again: **do not modify the application itself.**

---

# Completion requirement

When finished:

1. `README.md` must be the final complete developer handover document.
2. No other project/application file should be changed.
3. Do not run setup, install, workflow, preview, build, typecheck, migration, database cleanup, or application commands.
4. Report briefly:

   * that only `README.md` was changed;
   * which major documentation sections were added/improved;
   * any important item explicitly marked **Not confirmed by the current codebase**.

Do not suggest or perform any additional work after completing this README task.
