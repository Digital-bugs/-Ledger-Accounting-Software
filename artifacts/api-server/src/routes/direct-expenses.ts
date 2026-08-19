import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetDirectExpenseSummaryResponse,
  ListDirectExpensesResponse,
  CreateDirectExpenseBody,
  UpdateDirectExpenseBody,
  CreateDirectExpenseResponse,
  UpdateDirectExpenseResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSummary(dateFrom?: string, dateTo?: string) {
  const dateConditions: string[] = [];
  const dateParams: string[] = [];
  if (dateFrom) {
    dateConditions.push("e.entry_date >= ?");
    dateParams.push(dateFrom);
  }
  if (dateTo) {
    dateConditions.push("e.entry_date <= ?");
    dateParams.push(dateTo);
  }
  const dateFilter = dateConditions.length
    ? `AND ${dateConditions.join(" AND ")}`
    : "";

  const rows = db
    .prepare(
      `SELECT p.name, COALESCE(SUM(e.amount), 0) as total
       FROM partners p
       LEFT JOIN direct_expenses e ON p.id = e.partner_id ${dateFilter}
       GROUP BY p.id, p.name
       ORDER BY p.id`
    )
    .all(...dateParams) as { name: string; total: number }[];

  const yasirTotal = rows.find((r) => r.name === "Yasir")?.total ?? 0;
  const khurramTotal = rows.find((r) => r.name === "Khurram")?.total ?? 0;
  return { yasirTotal, khurramTotal, combinedTotal: yasirTotal + khurramTotal };
}

function getExpenseById(id: number | bigint) {
  return db
    .prepare(
      `SELECT e.id,
              COALESCE(e.receipt_number, '') as receiptNumber,
              e.entry_date as entryDate,
              e.description,
              e.partner_id as partnerId,
              p.name as partnerName,
              e.amount,
              e.created_at as createdAt
       FROM direct_expenses e
       JOIN partners p ON p.id = e.partner_id
       WHERE e.id = ?`
    )
    .get(id);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /direct-expenses/summary  — must come BEFORE /:id
router.get("/direct-expenses/summary", (req, res): void => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  res.json(GetDirectExpenseSummaryResponse.parse(getSummary(dateFrom, dateTo)));
});

// GET /direct-expenses
router.get("/direct-expenses", (req, res): void => {
  const {
    search,
    partnerId,
    dateFrom,
    dateTo,
    page = "1",
    pageSize = "25",
    sortDir = "desc",
  } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push("(e.receipt_number LIKE ? OR e.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (partnerId) {
    conditions.push("e.partner_id = ?");
    params.push(Number(partnerId));
  }
  if (dateFrom) {
    conditions.push("e.entry_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("e.entry_date <= ?");
    params.push(dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const pageNum = Math.max(1, Number(page));
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM direct_expenses e ${where}`)
    .get(...(params as Parameters<ReturnType<typeof db.prepare>["get"]>)) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT e.id,
              COALESCE(e.receipt_number, '') as receiptNumber,
              e.entry_date as entryDate,
              e.description,
              e.partner_id as partnerId,
              p.name as partnerName,
              e.amount,
              e.created_at as createdAt
       FROM direct_expenses e
       JOIN partners p ON p.id = e.partner_id
       ${where}
       ORDER BY e.entry_date ${dir}, e.id ${dir}
       LIMIT ? OFFSET ?`
    )
    .all(
      ...((params as unknown[]).concat([pageSizeNum, offset]) as Parameters<
        ReturnType<typeof db.prepare>["all"]
      >)
    );

  res.json(
    ListDirectExpensesResponse.parse({
      data: rows,
      total: count,
       summary: getSummary(dateFrom, dateTo),
    })
  );
});

// POST /direct-expenses
router.post("/direct-expenses", (req, res): void => {
  const body = CreateDirectExpenseBody.parse(req.body);

  const result = db
    .prepare(
      `INSERT INTO direct_expenses (receipt_number, entry_date, description, partner_id, amount)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description,
      body.partnerId,
      body.amount
    );

  const row = getExpenseById(result.lastInsertRowid);
  res.status(201).json(CreateDirectExpenseResponse.parse(row));
});

// PUT /direct-expenses/:id
router.put("/direct-expenses/:id", (req, res): void => {
  const id = Number(req.params.id);
  const body = UpdateDirectExpenseBody.parse(req.body);

  const updated = db
    .prepare(
      `UPDATE direct_expenses
       SET receipt_number = ?, entry_date = ?, description = ?, partner_id = ?, amount = ?
       WHERE id = ?`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description,
      body.partnerId,
      body.amount,
      id
    );

  if (updated.changes === 0) {
    res.status(404).json({ error: "Direct expense not found" });
    return;
  }

  const row = getExpenseById(id);
  res.json(UpdateDirectExpenseResponse.parse(row));
});

// DELETE /direct-expenses/:id
router.delete("/direct-expenses/:id", (req, res): void => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM direct_expenses WHERE id = ?").run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Direct expense not found" });
    return;
  }

  res.status(204).send();
});

export default router;
