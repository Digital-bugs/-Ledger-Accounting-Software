import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { logger } from "../logger";
import { initialSchemaMigration } from "./001_initial_schema";
import type { Migration } from "./types";

const migrations: Migration[] = [initialSchemaMigration];
const MIGRATIONS_TABLE = "schema_migrations";

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function hasApplicationSchema(db: Database.Database): boolean {
  const expectedTables = [
    "partners",
    "investments",
    "direct_expenses",
    "petty_cash_given",
    "petty_cash_spent",
    "joint_incomes",
  ];
  const existingTables = new Set(
    (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?,?,?,?,?,?)",
        )
        .all(...expectedTables) as Array<{ name: string }>
    ).map((row) => row.name),
  );
  return expectedTables.every((table) => existingTables.has(table));
}

function appliedVersions(db: Database.Database): Set<number> {
  const rows = db
    .prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`)
    .all() as Array<{ version: number }>;
  return new Set(rows.map((row) => row.version));
}

async function createMigrationBackup(
  db: Database.Database,
  backupsDir: string,
): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  const backupPath = path.join(
    backupsDir,
    `Ledger_PreMigration_${timestamp}_${process.pid}.db`,
  );

  await db.backup(backupPath);
  return backupPath;
}

export async function runMigrations(
  db: Database.Database,
  backupsDir: string,
): Promise<void> {
  ensureMigrationsTable(db);

  const applied = appliedVersions(db);
  const pending = migrations.filter(
    (migration) => !applied.has(migration.version),
  );

  if (pending.length === 0) {
    return;
  }

  fs.mkdirSync(backupsDir, { recursive: true });
  const backupPath = await createMigrationBackup(db, backupsDir);
  logger.info(
    { backupPath, pending: pending.map((migration) => migration.name) },
    "Created pre-migration database backup",
  );

  // Databases created before migrations existed already contain migration 001's
  // schema. Mark that baseline as applied instead of recreating or modifying it.
  if (!applied.has(initialSchemaMigration.version) && hasApplicationSchema(db)) {
    db.prepare(
      `INSERT INTO ${MIGRATIONS_TABLE} (version, name) VALUES (?, ?)`,
    ).run(initialSchemaMigration.version, initialSchemaMigration.name);
    applied.add(initialSchemaMigration.version);
  }

  for (const migration of pending) {
    if (applied.has(migration.version)) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.prepare(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name) VALUES (?, ?)`,
      ).run(migration.version, migration.name);
    });

    applyMigration();
    logger.info(
      { version: migration.version, name: migration.name },
      "Applied database migration",
    );
  }
}