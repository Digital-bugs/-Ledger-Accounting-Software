import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { BulkImportBody, BulkImportResponse } from "@workspace/api-zod";

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

const PARTNER_MODULES: ModuleKey[] = [
  "investments",
  "direct-expenses",
  "petty-cash-given",
];
const INCOME_TYPE_MODULES: ModuleKey[] = ["joint-incomes"];

router.post("/excel-import", (req, res): void => {
  let body;
  try {
    body = BulkImportBody.parse(req.body);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const { module: moduleKey, rows } = body;
  const tableName = TABLE_MAP[moduleKey as ModuleKey];
  if (!tableName) {
    res.status(400).json({ error: `Invalid module: ${moduleKey}` });
    return;
  }

  const requiresPartner = PARTNER_MODULES.includes(moduleKey as ModuleKey);
  const requiresIncomeType = INCOME_TYPE_MODULES.includes(moduleKey as ModuleKey);

  // Fetch existing receipt numbers for dedup (case-insensitive)
  const existingReceipts = new Set(
    (
      db
        .prepare(
          `SELECT receipt_number FROM ${tableName} WHERE receipt_number IS NOT NULL AND receipt_number != ''`
        )
        .all() as { receipt_number: string }[]
    ).map((r) => r.receipt_number.toLowerCase().trim())
  );

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];
  const validRows: { row: (typeof rows)[number]; rowNum: number }[] = [];

  // Validate all rows first
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;

    // Skip truly empty rows
    const hasContent =
      row.entryDate ||
      row.amount ||
      row.receiptNumber ||
      row.description;
    if (!hasContent) {
      skipped++;
      return;
    }

    // Duplicate receipt number check
    const rn = (row.receiptNumber ?? "").trim();
    if (rn && existingReceipts.has(rn.toLowerCase())) {
      skipped++;
      return;
    }

    // Field-level validation
    const rowErrors: string[] = [];

    if (!row.entryDate) rowErrors.push("Date is required");
    if (row.amount == null || isNaN(row.amount)) rowErrors.push("Amount is required and must be a number");
    if (requiresPartner && !row.partnerId) rowErrors.push("Partner is required");
    if (requiresIncomeType && !row.incomeType) rowErrors.push("Income Type is required");

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, message: rowErrors.join("; ") });
      return;
    }

    validRows.push({ row, rowNum });
  });

  // Bulk insert in a single transaction for performance
  try {
    if (requiresPartner) {
      const stmt = db.prepare(
        `INSERT INTO ${tableName} (receipt_number, entry_date, description, partner_id, amount)
         VALUES (?, ?, ?, ?, ?)`
      );
      db.transaction((items: typeof validRows) => {
        for (const { row } of items) {
          stmt.run(
            row.receiptNumber || null,
            row.entryDate,
            row.description || "",
            row.partnerId,
            row.amount
          );
        }
      })(validRows);
    } else if (requiresIncomeType) {
      const stmt = db.prepare(
        `INSERT INTO ${tableName} (receipt_number, entry_date, description, income_type, amount)
         VALUES (?, ?, ?, ?, ?)`
      );
      db.transaction((items: typeof validRows) => {
        for (const { row } of items) {
          stmt.run(
            row.receiptNumber || null,
            row.entryDate,
            row.description || "",
            row.incomeType || null,
            row.amount
          );
        }
      })(validRows);
    } else {
      // accountant-expenses (petty_cash_spent) — no partner_id, no income_type
      const stmt = db.prepare(
        `INSERT INTO ${tableName} (receipt_number, entry_date, description, amount)
         VALUES (?, ?, ?, ?)`
      );
      db.transaction((items: typeof validRows) => {
        for (const { row } of items) {
          stmt.run(
            row.receiptNumber || null,
            row.entryDate,
            row.description || "",
            row.amount
          );
        }
      })(validRows);
    }

    imported = validRows.length;
  } catch (err: any) {
    res.status(500).json({ error: `Database error: ${err.message}` });
    return;
  }

  res.json(BulkImportResponse.parse({ imported, skipped, errors }));
});

export default router;
