import express, { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { db, BACKUPS_DIR, DATA_DIR, DB_PATH } from "../lib/database";
import { logger } from "../lib/logger";
import {
  ListBackupsResponse,
  CreateBackupResponse,
  GetBackupHealthResponse,
  GetBackupSettingsResponse,
  UpdateBackupSettingsResponse,
  RestoreBackupResponse,
  DeleteBackupParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(DATA_DIR, "backup-settings.json");

interface BackupSettingsData {
  autoBackupEnabled: boolean;
  autoBackupSchedule: "startup" | "daily" | "weekly" | "monthly";
  backupFolder: string;
  maxBackupHistory: number | null;
  lastAutoBackup: string | null;
}

const DEFAULT_SETTINGS: BackupSettingsData = {
  autoBackupEnabled: false,
  autoBackupSchedule: "daily",
  backupFolder: BACKUPS_DIR,
  maxBackupHistory: 10,
  lastAutoBackup: null,
};

function readSettings(): BackupSettingsData {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings: BackupSettingsData): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBackupFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `Ledger_Accounting_Backup_${yyyy}-${MM}-${dd}_${HH}-${mm}.db`;
}

function readBackups(folder?: string): Array<{ filename: string; createdAt: string; sizeBytes: number }> {
  const dir = folder ?? BACKUPS_DIR;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const stat = fs.statSync(fullPath);
      return { filename, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function enforceMaxBackups(folder: string, maxCount: number | null): void {
  if (maxCount === null) return;
  const files = readBackups(folder);
  if (files.length > maxCount) {
    const toDelete = files.slice(maxCount);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(path.join(folder, file.filename));
        logger.info({ filename: file.filename }, "Auto-deleted old backup (max history enforced)");
      } catch { /* ignore */ }
    }
  }
}

async function performAutoBackup(): Promise<void> {
  const settings = readSettings();
  const folder = settings.backupFolder;
  fs.mkdirSync(folder, { recursive: true });
  const filename = makeBackupFilename();
  const destPath = path.join(folder, filename);
  try {
    await db.backup(destPath);
    settings.lastAutoBackup = new Date().toISOString();
    writeSettings(settings);
    enforceMaxBackups(folder, settings.maxBackupHistory);
    logger.info({ filename }, "Auto-backup created");
  } catch (err) {
    logger.error({ err }, "Auto-backup failed");
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let _schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function initBackupScheduler(): void {
  if (_schedulerTimer) {
    clearInterval(_schedulerTimer);
    _schedulerTimer = null;
  }
  const settings = readSettings();
  if (!settings.autoBackupEnabled) return;

  if (settings.autoBackupSchedule === "startup") {
    performAutoBackup().catch(() => {});
    return;
  }

  const msPerSchedule: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  const ms = msPerSchedule[settings.autoBackupSchedule];
  if (ms) {
    _schedulerTimer = setInterval(() => performAutoBackup().catch(() => {}), ms);
    logger.info({ schedule: settings.autoBackupSchedule }, "Auto-backup scheduler started");
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /backup — list backups
router.get("/backup", (_req, res): void => {
  const settings = readSettings();
  const backups = readBackups(settings.backupFolder);
  res.json(ListBackupsResponse.parse(backups));
});

// POST /backup — create manual backup
router.post("/backup", async (_req, res): Promise<void> => {
  const settings = readSettings();
  const folder = settings.backupFolder;
  fs.mkdirSync(folder, { recursive: true });

  const filename = makeBackupFilename();
  const destPath = path.join(folder, filename);

  await db.backup(destPath);

  const stat = fs.statSync(destPath);
  const backup = { filename, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };

  enforceMaxBackups(folder, settings.maxBackupHistory);

  res.status(201).json(CreateBackupResponse.parse(backup));
});

// GET /backup/health — SQLite integrity + foreign-key check
router.get("/backup/health", (_req, res): void => {
  const checks: Array<{ name: string; passed: boolean; message: string }> = [];

  // Integrity check
  const integrityRows = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
  const integrityOk = integrityRows.length === 1 && integrityRows[0]!.integrity_check === "ok";
  checks.push({
    name: "Integrity Check",
    passed: integrityOk,
    message: integrityOk ? "All database pages are intact" : integrityRows.map((r) => r.integrity_check).join("; "),
  });

  // Foreign key check
  const fkRows = db.pragma("foreign_key_check") as Array<unknown>;
  const fkOk = fkRows.length === 0;
  checks.push({
    name: "Foreign Key Check",
    passed: fkOk,
    message: fkOk ? "No broken relationships found" : `${fkRows.length} foreign key violation(s) detected`,
  });

  // WAL mode check
  const walRows = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
  const walOk = walRows[0]?.journal_mode === "wal";
  checks.push({
    name: "WAL Mode",
    passed: walOk,
    message: walOk ? "Write-Ahead Logging enabled (crash-safe)" : "WAL mode not active",
  });

  // Table existence check
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all() as Array<{ name: string }>;
  const expectedTables = ["partners", "investments", "direct_expenses", "petty_cash_given", "petty_cash_spent", "joint_incomes"];
  const missingTables = expectedTables.filter((t) => !tables.some((row) => row.name === t));
  const tablesOk = missingTables.length === 0;
  checks.push({
    name: "Schema Check",
    passed: tablesOk,
    message: tablesOk ? `All ${expectedTables.length} tables present` : `Missing tables: ${missingTables.join(", ")}`,
  });

  const allPassed = checks.every((c) => c.passed);

  res.json(
    GetBackupHealthResponse.parse({
      status: allPassed ? "healthy" : "error",
      integrity: integrityOk,
      foreignKeys: fkOk,
      checks,
    })
  );
});

// GET /backup/settings
router.get("/backup/settings", (_req, res): void => {
  const settings = readSettings();
  res.json(
    GetBackupSettingsResponse.parse({
      autoBackupEnabled: settings.autoBackupEnabled,
      autoBackupSchedule: settings.autoBackupSchedule,
      backupFolder: settings.backupFolder,
      maxBackupHistory: settings.maxBackupHistory,
    })
  );
});

// PUT /backup/settings
router.put("/backup/settings", (req, res): void => {
  const existing = readSettings();
  const updated: BackupSettingsData = {
    ...existing,
    autoBackupEnabled: req.body.autoBackupEnabled ?? existing.autoBackupEnabled,
    autoBackupSchedule: req.body.autoBackupSchedule ?? existing.autoBackupSchedule,
    backupFolder: req.body.backupFolder ?? existing.backupFolder,
    maxBackupHistory: req.body.maxBackupHistory !== undefined ? req.body.maxBackupHistory : existing.maxBackupHistory,
    lastAutoBackup: existing.lastAutoBackup,
  };

  // Ensure new backup folder exists
  fs.mkdirSync(updated.backupFolder, { recursive: true });
  writeSettings(updated);

  // Restart scheduler with new settings
  initBackupScheduler();

  res.json(
    UpdateBackupSettingsResponse.parse({
      autoBackupEnabled: updated.autoBackupEnabled,
      autoBackupSchedule: updated.autoBackupSchedule,
      backupFolder: updated.backupFolder,
      maxBackupHistory: updated.maxBackupHistory,
    })
  );
});

// POST /backup/upload-restore — restore from a raw .db file uploaded by the browser
router.post(
  "/backup/upload-restore",
  express.raw({ type: "application/octet-stream", limit: "200mb" }),
  async (req, res): Promise<void> => {
    const body = req.body as Buffer;

    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ success: false, message: "No file data received" });
      return;
    }

    // Write to a temp file first
    const tmpPath = path.join(DATA_DIR, `_upload_restore_${Date.now()}.db`);
    try {
      fs.writeFileSync(tmpPath, body);
    } catch {
      res.status(500).json({ success: false, message: "Failed to write uploaded file to disk" });
      return;
    }

    // Validate it is a real SQLite database
    try {
      const testDb = new Database(tmpPath, { readonly: true });
      testDb.pragma("integrity_check");
      testDb.close();
    } catch {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      res.status(400).json({ success: false, message: "Uploaded file is not a valid SQLite database" });
      return;
    }

    // Replace the live database
    try {
      db.close();
      fs.copyFileSync(tmpPath, DB_PATH);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      logger.info("Database restored from uploaded file — server restarting");
    } catch {
      res.status(500).json({ success: false, message: "Failed to replace database with uploaded file" });
      return;
    }

    res.json({ success: true, message: "Database restored successfully. Server is restarting…" });
    setTimeout(() => process.exit(0), 500);
  }
);

// POST /backup/restore — restore from backup, then restart server
router.post("/backup/restore", async (req, res): Promise<void> => {
  const { filename } = req.body as { filename: string };

  if (!filename || typeof filename !== "string" || !filename.endsWith(".db")) {
    res.status(400).json({ success: false, message: "Invalid backup filename" });
    return;
  }

  // Disallow path traversal
  const safeName = path.basename(filename);
  const settings = readSettings();
  const srcPath = path.join(settings.backupFolder, safeName);

  if (!fs.existsSync(srcPath)) {
    res.status(404).json({ success: false, message: "Backup file not found" });
    return;
  }

  // Validate the backup is a valid SQLite database
  try {
    const testDb = new Database(srcPath, { readonly: true });
    testDb.pragma("integrity_check");
    testDb.close();
  } catch {
    res.status(400).json({ success: false, message: "Backup file is not a valid SQLite database" });
    return;
  }

  // Close current db and copy backup over the main DB file
  try {
    db.close();
    fs.copyFileSync(srcPath, DB_PATH);
    logger.info({ filename: safeName }, "Database restored from backup — server restarting");
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to copy backup file" });
    return;
  }

  res.json(
    RestoreBackupResponse.parse({
      success: true,
      message: "Database restored successfully. Server is restarting…",
    })
  );

  // Exit after response is flushed — workflow manager restarts the process
  setTimeout(() => process.exit(0), 500);
});

// DELETE /backup/:filename
router.delete("/backup/:filename", (req, res): void => {
  const params = DeleteBackupParams.parse({ filename: req.params.filename });
  const safeName = path.basename(params.filename);
  const settings = readSettings();
  const filePath = path.join(settings.backupFolder, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Backup not found" });
    return;
  }

  fs.unlinkSync(filePath);
  res.status(204).send();
});

// GET /backup/download/:filename — stream backup file to browser
router.get("/backup/download/:filename", (req, res): void => {
  const safeName = path.basename(req.params.filename ?? "");
  if (!safeName.endsWith(".db")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const settings = readSettings();
  const filePath = path.join(settings.backupFolder, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Backup not found" });
    return;
  }

  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

export default router;
