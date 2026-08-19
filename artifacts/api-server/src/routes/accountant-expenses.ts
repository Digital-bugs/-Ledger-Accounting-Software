import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetAccountantExpenseSummaryResponse,
  ListAccountantExpensesResponse,
  CreateAccountantExpenseBody,
  UpdateAccountantExpenseBody,
  CreateAccountantExpenseResponse,
  UpdateAccountantExpenseResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSummary(dateFrom?: string, dateTo?: string) {
  const receivedConditions: string[] = [];
  const receivedParams: string[] = [];
  const expenseConditions: string[] = [];
  const expenseParams: string[] = [];
  if (dateFrom) {
    receivedConditions.push("entry_date >= ?");
    receivedParams.push(dateFrom);
    expenseConditions.push("entry_date >= ?");
    expenseParams.push(dateFrom);
  }
  if (dateTo) {
    receivedConditions.push("entry_date <= ?");
    receivedParams.push(dateTo);
    expenseConditions.push("entry_date <= ?");
    expenseParams.push(dateTo);
  }
  const receivedWhere = receivedConditions.length
    ? `WHERE ${receivedConditions.join(" AND ")}`
    : "";
  const expenseWhere = expenseConditions.length
    ? `WHERE ${expenseConditions.join(" AND ")}`
    : "";

  const { totalPettyCashReceived } = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as totalPettyCashReceived
       FROM petty_cash_given ${receivedWhere}`,
    )
    .get(...receivedParams) as { totalPettyCashReceived: number };

  const { totalExpenses } = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as totalExpenses
       FROM petty_cash_spent ${expenseWhere}`,
    )
    .get(...expenseParams) as { totalExpenses: number };

  const accountantCashBalance = totalPettyCashReceived - totalExpenses;
  return { totalExpenses, totalPettyCashReceived, accountantCashBalance };
}

function getRecordById(id: number | bigint) {
  return db
    .prepare(
      `SELECT id,
              COALESCE(receipt_number, '') as receiptNumber,
              entry_date as entryDate,
              description,
              amount,
              created_at as createdAt
       FROM petty_cash_spent
       WHERE id = ?`
    )
    .get(id);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /accountant-expenses/summary  — must come BEFORE /:id
router.get("/accountant-expenses/summary", (req, res): void => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  res.json(GetAccountantExpenseSummaryResponse.parse(getSummary(dateFrom, dateTo)));
});

// GET /accountant-expenses
router.get("/accountant-expenses", (req, res): void => {
  const {
    search,
    dateFrom,
    dateTo,
    page = "1",
    pageSize = "25",
    sortDir = "desc",
  } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push("(receipt_number LIKE ? OR description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    conditions.push("entry_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("entry_date <= ?");
    params.push(dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const pageNum = Math.max(1, Number(page));
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM petty_cash_spent ${where}`)
    .get(...(params as Parameters<ReturnType<typeof db.prepare>["get"]>)) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT id,
              COALESCE(receipt_number, '') as receiptNumber,
              entry_date as entryDate,
              description,
              amount,
              created_at as createdAt
       FROM petty_cash_spent
       ${where}
       ORDER BY entry_date ${dir}, id ${dir}
       LIMIT ? OFFSET ?`
    )
    .all(
      ...((params as unknown[]).concat([pageSizeNum, offset]) as Parameters<
        ReturnType<typeof db.prepare>["all"]
      >)
    );

  res.json(
    ListAccountantExpensesResponse.parse({
      data: rows,
      total: count,
       summary: getSummary(dateFrom, dateTo),
    })
  );
});

// POST /accountant-expenses
router.post("/accountant-expenses", (req, res): void => {
  const body = CreateAccountantExpenseBody.parse(req.body);
  const { accountantCashBalance } = getSummary();

  if (body.amount > accountantCashBalance) {
    res.status(422).json({ error: "Insufficient Accountant Cash Balance." });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO petty_cash_spent (receipt_number, entry_date, description, amount)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      body.receiptNumber.trim() || null,
      body.entryDate,
      body.description?.trim() ?? "",
      body.amount
    );

  const row = getRecordById(result.lastInsertRowid);
  res.status(201).json(CreateAccountantExpenseResponse.parse(row));
});

// PUT /accountant-expenses/:id
router.put("/accountant-expenses/:id", (req, res): void => {
  const id = Number(req.params.id);
  const body = UpdateAccountantExpenseBody.parse(req.body);

  const existing = getRecordById(id) as
    | { id: number; amount: number }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  // When editing, the existing amount is freed — only the *net new* portion
  // needs to be covered by the current balance.
  const { accountantCashBalance } = getSummary();
  const availableForEdit = accountantCashBalance + existing.amount;

  if (body.amount > availableForEdit) {
    res.status(422).json({ error: "Insufficient Accountant Cash Balance." });
    return;
  }

  const updated = db
    .prepare(
      `UPDATE petty_cash_spent
       SET receipt_number = ?, entry_date = ?, description = ?, amount = ?
       WHERE id = ?`
    )
    .run(
      body.receiptNumber.trim() || null,
      body.entryDate,
      body.description?.trim() ?? "",
      body.amount,
      id
    );

  if (updated.changes === 0) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const row = getRecordById(id);
  res.json(UpdateAccountantExpenseResponse.parse(row));
});

// DELETE /accountant-expenses/:id
router.delete("/accountant-expenses/:id", (req, res): void => {
  const id = Number(req.params.id);
  const result = db
    .prepare("DELETE FROM petty_cash_spent WHERE id = ?")
    .run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.status(204).send();
});

export default router;
