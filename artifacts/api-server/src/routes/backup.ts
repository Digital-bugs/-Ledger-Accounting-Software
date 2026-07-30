import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { db, BACKUPS_DIR } from "../lib/database";
import { ListBackupsResponse, CreateBackupResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function readBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((filename) => {
      const fullPath = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        createdAt: stat.birthtime.toISOString(),
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

router.get("/backup", (_req, res): void => {
  const backups = readBackups();
  res.json(ListBackupsResponse.parse(backups));
});

router.post("/backup", async (_req, res): Promise<void> => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const filename = `ledger-backup-${timestamp}.db`;
  const destPath = path.join(BACKUPS_DIR, filename);

  // better-sqlite3's backup() creates an atomic, consistent snapshot
  await db.backup(destPath);

  const stat = fs.statSync(destPath);
  const backup = {
    filename,
    createdAt: stat.birthtime.toISOString(),
    sizeBytes: stat.size,
  };

  res.status(201).json(CreateBackupResponse.parse(backup));
});

export default router;
