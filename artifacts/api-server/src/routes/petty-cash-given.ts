import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetPettyCashGivenSummaryResponse,
  ListPettyCashGivenResponse,
  CreatePettyCashGivenBody,
  UpdatePettyCashGivenBody,
  CreatePettyCashGivenResponse,
  UpdatePettyCashGivenResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSummary() {
  const rows = db
    .prepare(
      `SELECT p.name, COALESCE(SUM(g.amount), 0) as total
       FROM partners p
       LEFT JOIN petty_cash_given g ON p.id = g.partner_id
       GROUP BY p.id, p.name
       ORDER BY p.id`
    )
    .all() as { name: string; total: number }[];

  const yasirTotal = rows.find((r) => r.name === "Yasir")?.total ?? 0;
  const khurramTotal = rows.find((r) => r.name === "Khurram")?.total ?? 0;
  const combinedTotal = yasirTotal + khurramTotal;

  const { totalSpent } = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) as totalSpent FROM petty_cash_spent`)
    .get() as { totalSpent: number };

  const accountantCashBalance = combinedTotal - totalSpent;

  return { yasirTotal, khurramTotal, combinedTotal, accountantCashBalance };
}

function getRecordById(id: number | bigint) {
  return db
    .prepare(
      `SELECT g.id,
              COALESCE(g.receipt_number, '') as receiptNumber,
              g.entry_date as entryDate,
              g.description,
              g.partner_id as partnerId,
              p.name as partnerName,
              g.amount,
              g.created_at as createdAt
       FROM petty_cash_given g
       JOIN partners p ON p.id = g.partner_id
       WHERE g.id = ?`
    )
    .get(id);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /petty-cash-given/summary
router.get("/petty-cash-given/summary", (_req, res): void => {
  res.json(GetPettyCashGivenSummaryResponse.parse(getSummary()));
});

// GET /petty-cash-given
router.get("/petty-cash-given", (req, res): void => {
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
    conditions.push("(g.receipt_number LIKE ? OR g.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (partnerId) {
    conditions.push("g.partner_id = ?");
    params.push(Number(partnerId));
  }
  if (dateFrom) {
    conditions.push("g.entry_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("g.entry_date <= ?");
    params.push(dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const pageNum = Math.max(1, Number(page));
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM petty_cash_given g ${where}`)
    .get(...(params as Parameters<ReturnType<typeof db.prepare>["get"]>)) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT g.id,
              COALESCE(g.receipt_number, '') as receiptNumber,
              g.entry_date as entryDate,
              g.description,
              g.partner_id as partnerId,
              p.name as partnerName,
              g.amount,
              g.created_at as createdAt
       FROM petty_cash_given g
       JOIN partners p ON p.id = g.partner_id
       ${where}
       ORDER BY g.entry_date ${dir}, g.id ${dir}
       LIMIT ? OFFSET ?`
    )
    .all(
      ...((params as unknown[]).concat([pageSizeNum, offset]) as Parameters<
        ReturnType<typeof db.prepare>["all"]
      >)
    );

  res.json(
    ListPettyCashGivenResponse.parse({
      data: rows,
      total: count,
      summary: getSummary(),
    })
  );
});

// POST /petty-cash-given
router.post("/petty-cash-given", (req, res): void => {
  const body = CreatePettyCashGivenBody.parse(req.body);

  const result = db
    .prepare(
      `INSERT INTO petty_cash_given (receipt_number, entry_date, description, partner_id, amount)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description,
      body.partnerId,
      body.amount
    );

  const row = getRecordById(result.lastInsertRowid);
  res.status(201).json(CreatePettyCashGivenResponse.parse(row));
});

// PUT /petty-cash-given/:id
router.put("/petty-cash-given/:id", (req, res): void => {
  const id = Number(req.params.id);
  const body = UpdatePettyCashGivenBody.parse(req.body);

  const updated = db
    .prepare(
      `UPDATE petty_cash_given
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
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const row = getRecordById(id);
  res.json(UpdatePettyCashGivenResponse.parse(row));
});

// DELETE /petty-cash-given/:id
router.delete("/petty-cash-given/:id", (req, res): void => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM petty_cash_given WHERE id = ?").run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.status(204).send();
});

export default router;
