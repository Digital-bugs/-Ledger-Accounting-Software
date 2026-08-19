import type Database from "better-sqlite3";
import type { Migration } from "./types";

export const initialSchemaMigration: Migration = {
  version: 1,
  name: "initial_schema",
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS partners (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        name              TEXT    NOT NULL,
        share_percentage  REAL    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS investments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        entry_date     TEXT NOT NULL,
        description    TEXT NOT NULL,
        partner_id     INTEGER NOT NULL REFERENCES partners(id),
        amount         REAL    NOT NULL,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS direct_expenses (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        entry_date     TEXT NOT NULL,
        description    TEXT NOT NULL,
        partner_id     INTEGER NOT NULL REFERENCES partners(id),
        amount         REAL    NOT NULL,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS petty_cash_given (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        entry_date     TEXT NOT NULL,
        description    TEXT NOT NULL,
        partner_id     INTEGER NOT NULL REFERENCES partners(id),
        amount         REAL    NOT NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS petty_cash_spent (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        entry_date     TEXT NOT NULL,
        description    TEXT NOT NULL,
        amount         REAL    NOT NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS joint_incomes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT,
        entry_date     TEXT NOT NULL,
        description    TEXT NOT NULL,
        income_type    TEXT,
        amount         REAL    NOT NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};