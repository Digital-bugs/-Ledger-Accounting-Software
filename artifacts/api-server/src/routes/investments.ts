import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetInvestmentSummaryResponse,
  ListInvestmentsResponse,
  CreateInvestmentBody,
  UpdateInvestmentBody,
  CreateInvestmentResponse,
  UpdateInvestmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSummary() {
  const rows = db
    .prepare(
      `SELECT p.name, COALESCE(SUM(i.amount), 0) as total
       FROM partners p
       LEFT JOIN investments i ON p.id = i.partner_id
       GROUP BY p.id, p.name
       ORDER BY p.id`
    )
    .all() as { name: string; total: number }[];

  const yasirTotal = rows.find((r) => r.name === "Yasir")?.total ?? 0;
  const khurramTotal = rows.find((r) => r.name === "Khurram")?.total ?? 0;
  return { yasirTotal, khurramTotal, combinedTotal: yasirTotal + khurramTotal };
}

function getInvestmentById(id: number | bigint) {
  return db
    .prepare(
      `SELECT i.id,
              COALESCE(i.receipt_number, '') as receiptNumber,
              i.entry_date as entryDate,
              i.description,
              i.partner_id as partnerId,
              p.name as partnerName,
              i.amount,
              i.created_at as createdAt
       FROM investments i
       JOIN partners p ON p.id = i.partner_id
       WHERE i.id = ?`
    )
    .get(id);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /investments/summary  — must come BEFORE /:id
router.get("/investments/summary", (_req, res): void => {
  res.json(GetInvestmentSummaryResponse.parse(getSummary()));
});

// GET /investments
router.get("/investments", (req, res): void => {
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
    conditions.push("(i.receipt_number LIKE ? OR i.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (partnerId) {
    conditions.push("i.partner_id = ?");
    params.push(Number(partnerId));
  }
  if (dateFrom) {
    conditions.push("i.entry_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("i.entry_date <= ?");
    params.push(dateTo);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const pageNum = Math.max(1, Number(page));
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM investments i ${where}`)
    .get(...(params as Parameters<ReturnType<typeof db.prepare>["get"]>)) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT i.id,
              COALESCE(i.receipt_number, '') as receiptNumber,
              i.entry_date as entryDate,
              i.description,
              i.partner_id as partnerId,
              p.name as partnerName,
              i.amount,
              i.created_at as createdAt
       FROM investments i
       JOIN partners p ON p.id = i.partner_id
       ${where}
       ORDER BY i.entry_date ${dir}, i.id ${dir}
       LIMIT ? OFFSET ?`
    )
    .all(
      ...((params as unknown[]).concat([pageSizeNum, offset]) as Parameters<
        ReturnType<typeof db.prepare>["all"]
      >)
    );

  res.json(
    ListInvestmentsResponse.parse({
      data: rows,
      total: count,
      summary: getSummary(),
    })
  );
});

// POST /investments
router.post("/investments", (req, res): void => {
  const body = CreateInvestmentBody.parse(req.body);

  const result = db
    .prepare(
      `INSERT INTO investments (receipt_number, entry_date, description, partner_id, amount)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description,
      body.partnerId,
      body.amount
    );

  const row = getInvestmentById(result.lastInsertRowid);
  res.status(201).json(CreateInvestmentResponse.parse(row));
});

// PUT /investments/:id
router.put("/investments/:id", (req, res): void => {
  const id = Number(req.params.id);
  const body = UpdateInvestmentBody.parse(req.body);

  const updated = db
    .prepare(
      `UPDATE investments
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
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  const row = getInvestmentById(id);
  res.json(UpdateInvestmentResponse.parse(row));
});

// DELETE /investments/:id
router.delete("/investments/:id", (req, res): void => {
  const id = Number(req.params.id);
  const result = db
    .prepare("DELETE FROM investments WHERE id = ?")
    .run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  res.status(204).send();
});

export default router;
