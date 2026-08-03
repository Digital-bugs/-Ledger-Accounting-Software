import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  BulkImportBody,
  BulkImportResponse,
  CheckImportDuplicatesBody,
  CheckImportDuplicatesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type ModuleKey =
  | "investments"
  | "direct-expenses"
  | "petty-cash-given"
  | "accountant-expenses"
  | "joint-incomes";

const TABLE_MAP: Record<ModuleKey, string> = {
  investments: "investments",
  "direct-expenses": "direct_expenses",
  "petty-cash-given": "petty_cash_given",
  "accountant-expenses": "petty_cash_spent",
  "joint-incomes": "joint_incomes",
};

const PARTNER_MODULES: Set<ModuleKey> = new Set([
  "investments",
  "direct-expenses",
  "petty-cash-given",
]);

const INCOME_TYPE_MODULES: Set<ModuleKey> = new Set(["joint-incomes"]);

// ─── POST /excel-import/check-duplicates ────────────────────────────────────
router.post("/excel-import/check-duplicates", (req, res): void => {
  let body;
  try {
    body = CheckImportDuplicatesBody.parse(req.body);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const results = body.checks.map((check) => {
    const tableName = TABLE_MAP[check.module as ModuleKey];
    if (!tableName || check.receiptNumbers.length === 0) {
      return { module: check.module, existingReceiptNumbers: [] };
    }

    // Query which receipt numbers already exist (case-insensitive)
    const placeholders = check.receiptNumbers.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT DISTINCT receipt_number FROM ${tableName}
         WHERE receipt_number IS NOT NULL
           AND LOWER(TRIM(receipt_number)) IN (${placeholders})`
      )
      .all(...check.receiptNumbers.map((r) => r.toLowerCase().trim())) as {
      receipt_number: string;
    }[];

    return {
      module: check.module,
      existingReceiptNumbers: rows.map((r) => r.receipt_number),
    };
  });

  res.json(CheckImportDuplicatesResponse.parse({ results }));
});

// ─── POST /excel-import ──────────────────────────────────────────────────────
router.post("/excel-import", (req, res): void => {
  let body;
  try {
    body = BulkImportBody.parse(req.body);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const { module: moduleKey, rows, duplicateAction = "skip" } = body;
  const tableName = TABLE_MAP[moduleKey as ModuleKey];
  if (!tableName) {
    res.status(400).json({ error: `Invalid module: ${moduleKey}` });
    return;
  }

  const requiresPartner = PARTNER_MODULES.has(moduleKey as ModuleKey);
  const requiresIncomeType = INCOME_TYPE_MODULES.has(moduleKey as ModuleKey);

  // Fetch existing receipt numbers (case-insensitive) for dedup
  const existingMap = new Map<string, number>(); // normalised-rn → row id
  (
    db
      .prepare(
        `SELECT id, receipt_number FROM ${tableName}
         WHERE receipt_number IS NOT NULL AND receipt_number != ''`
      )
      .all() as { id: number; receipt_number: string }[]
  ).forEach((r) => {
    existingMap.set(r.receipt_number.toLowerCase().trim(), r.id);
  });

  let imported = 0;
  let replaced = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];
  const validRows: {
    row: (typeof rows)[number];
    rowNum: number;
    existingId: number | null;
  }[] = [];

  // ── Validate all rows ────────────────────────────────────────────────────
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;

    // Skip truly empty rows
    const hasContent =
      row.entryDate || row.amount || row.receiptNumber || row.description;
    if (!hasContent) {
      skipped++;
      return;
    }

    const rowErrors: string[] = [];

    if (!row.entryDate) rowErrors.push("Date is required");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.entryDate))
      rowErrors.push(`Date "${row.entryDate}" must be in YYYY-MM-DD format`);

    if (row.amount == null || isNaN(row.amount))
      rowErrors.push("Amount is required and must be a number");
    else if (row.amount < 0) rowErrors.push("Amount must be non-negative");

    if (requiresPartner && !row.partnerId)
      rowErrors.push("Partner is required");

    if (requiresIncomeType) {
      if (!row.incomeType) rowErrors.push("Source/Income Type is required");
      else if (
        !["Rent", "Office Sale", "Flat Sale", "Other"].includes(row.incomeType)
      )
        rowErrors.push(
          `Invalid source "${row.incomeType}" — must be one of: Rent, Office Sale, Flat Sale, Other`
        );
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, message: rowErrors.join("; ") });
      return;
    }

    // Check duplicate
    const rn = (row.receiptNumber ?? "").trim();
    const existingId = rn ? (existingMap.get(rn.toLowerCase()) ?? null) : null;

    if (existingId !== null && duplicateAction === "skip") {
      skipped++;
      return;
    }

    validRows.push({ row, rowNum, existingId });
  });

  // ── Bulk insert / replace in a single transaction ────────────────────────
  try {
    db.transaction(() => {
      for (const { row, existingId } of validRows) {
        const rn = (row.receiptNumber ?? "").trim() || null;
        const isDuplicate = existingId !== null;

        // Replace: delete the existing record first
        if (isDuplicate && duplicateAction === "replace") {
          db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(existingId);
          replaced++;
        } else {
          imported++;
        }

        if (requiresPartner) {
          db.prepare(
            `INSERT INTO ${tableName} (receipt_number, entry_date, description, partner_id, amount)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            rn,
            row.entryDate,
            row.description ?? "",
            row.partnerId,
            row.amount
          );
        } else if (requiresIncomeType) {
          db.prepare(
            `INSERT INTO ${tableName} (receipt_number, entry_date, description, income_type, amount)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            rn,
            row.entryDate,
            row.description ?? "",
            row.incomeType ?? null,
            row.amount
          );
        } else {
          // accountant-expenses — no partner_id or income_type
          db.prepare(
            `INSERT INTO ${tableName} (receipt_number, entry_date, description, amount)
             VALUES (?, ?, ?, ?)`
          ).run(rn, row.entryDate, row.description ?? "", row.amount);
        }
      }
    })();
  } catch (err: any) {
    res.status(500).json({ error: `Database error: ${err.message}` });
    return;
  }

  res.json(
    BulkImportResponse.parse({ imported, replaced, skipped, errors })
  );
});

export default router;
