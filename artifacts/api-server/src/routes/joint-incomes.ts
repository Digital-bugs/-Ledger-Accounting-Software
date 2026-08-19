import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetJointIncomeSummaryResponse,
  ListJointIncomesResponse,
  CreateJointIncomeBody,
  UpdateJointIncomeBody,
  CreateJointIncomeResponse,
  UpdateJointIncomeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSummary(dateFrom?: string, dateTo?: string) {
  const conditions: string[] = [];
  const params: string[] = [];
  if (dateFrom) {
    conditions.push("entry_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("entry_date <= ?");
    params.push(dateTo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { total } = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM joint_incomes ${where}`,
    )
    .get(...params) as { total: number };

  return { combinedTotal: total };
}

function getRecordById(id: number | bigint) {
  return db
    .prepare(
      `SELECT id,
              COALESCE(receipt_number, '') as receiptNumber,
              entry_date as entryDate,
              COALESCE(description, '') as description,
              COALESCE(income_type, '') as incomeSource,
              amount,
              created_at as createdAt
       FROM joint_incomes
       WHERE id = ?`
    )
    .get(id);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /joint-incomes/summary  — must come BEFORE /:id
router.get("/joint-incomes/summary", (req, res): void => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  res.json(GetJointIncomeSummaryResponse.parse(getSummary(dateFrom, dateTo)));
});

// GET /joint-incomes
router.get("/joint-incomes", (req, res): void => {
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
    .prepare(`SELECT COUNT(*) as count FROM joint_incomes ${where}`)
    .get(...(params as Parameters<ReturnType<typeof db.prepare>["get"]>)) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT id,
              COALESCE(receipt_number, '') as receiptNumber,
              entry_date as entryDate,
              COALESCE(description, '') as description,
              COALESCE(income_type, '') as incomeSource,
              amount,
              created_at as createdAt
       FROM joint_incomes
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
    ListJointIncomesResponse.parse({
      data: rows,
      total: count,
       summary: getSummary(dateFrom, dateTo),
    })
  );
});

// POST /joint-incomes
router.post("/joint-incomes", (req, res): void => {
  const body = CreateJointIncomeBody.parse(req.body);

  const result = db
    .prepare(
      `INSERT INTO joint_incomes (receipt_number, entry_date, description, income_type, amount)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description ?? "",
      body.incomeSource,
      body.amount
    );

  const row = getRecordById(result.lastInsertRowid);
  res.status(201).json(CreateJointIncomeResponse.parse(row));
});

// PUT /joint-incomes/:id
router.put("/joint-incomes/:id", (req, res): void => {
  const id = Number(req.params.id);
  const body = UpdateJointIncomeBody.parse(req.body);

  const updated = db
    .prepare(
      `UPDATE joint_incomes
       SET receipt_number = ?, entry_date = ?, description = ?, income_type = ?, amount = ?
       WHERE id = ?`
    )
    .run(
      body.receiptNumber || null,
      body.entryDate,
      body.description ?? "",
      body.incomeSource,
      body.amount,
      id
    );

  if (updated.changes === 0) {
    res.status(404).json({ error: "Joint income record not found" });
    return;
  }

  const row = getRecordById(id);
  res.json(UpdateJointIncomeResponse.parse(row));
});

// DELETE /joint-incomes/:id
router.delete("/joint-incomes/:id", (req, res): void => {
  const id = Number(req.params.id);
  const result = db
    .prepare("DELETE FROM joint_incomes WHERE id = ?")
    .run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Joint income record not found" });
    return;
  }

  res.status(204).send();
});

export default router;
