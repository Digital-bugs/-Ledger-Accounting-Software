import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { logger } from "./logger";
import { runMigrations } from "./migrations";

// Data directory — defaults to <cwd>/data, overridable via env for Electron packaging
export const DATA_DIR = process.env.SQLITE_DATA_DIR
  ? path.resolve(process.env.SQLITE_DATA_DIR)
  : path.resolve(process.cwd(), "data");

const DB_PATH = path.join(DATA_DIR, "ledger.db");
export const BACKUPS_DIR = path.join(DATA_DIR, "backups");

// Ensure directories exist on startup
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// Open database — created automatically if it doesn't exist
const db = new Database(DB_PATH);

// ─── Crash-safe configuration ─────────────────────────────────────────────
// WAL mode: writers don't block readers; survives app crashes mid-write
db.pragma("journal_mode = WAL");
// Honour foreign-key constraints
db.pragma("foreign_keys = ON");
// NORMAL is safe with WAL mode and gives good performance
db.pragma("synchronous = NORMAL");

logger.info({ dbPath: DB_PATH }, "SQLite database initialized");

// ─── Versioned schema migrations ──────────────────────────────────────────
// Existing databases are backed up and adopted at migration 001 without
// recreating or changing their existing application tables.
await runMigrations(db, BACKUPS_DIR);

// ─── Seed fixed partners (once only) ──────────────────────────────────────
const partnerCount = (
  db.prepare("SELECT COUNT(*) as count FROM partners").get() as {
    count: number;
  }
).count;

if (partnerCount === 0) {
  const insertPartner = db.prepare(
    "INSERT INTO partners (name, share_percentage) VALUES (?, ?)"
  );
  db.transaction(() => {
    insertPartner.run("Yasir", 42.5);
    insertPartner.run("Khurram", 57.5);
  })();
  logger.info("Seeded default partners: Yasir (42.5%) and Khurram (57.5%)");
}

export { db, DB_PATH };
