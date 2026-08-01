import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", (req, res): void => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

  // Build a WHERE clause for date filtering (applied to each table individually)
  const buildDateWhere = (dateCol: string): string => {
    const clauses: string[] = [];
    if (dateFrom) clauses.push(`${dateCol} >= '${dateFrom}'`);
    if (dateTo) clauses.push(`${dateCol} <= '${dateTo}'`);
    return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  };

  const sum = (table: string, dateCol = "entry_date") => {
    const where = buildDateWhere(dateCol);
    return (
      db
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM ${table} ${where}`)
        .get() as { total: number }
    ).total;
  };

  const totalInvestments = sum("investments");
  const totalDirectExpenses = sum("direct_expenses");
  const totalPettyCashGiven = sum("petty_cash_given");
  const totalAccountantExpenses = sum("petty_cash_spent"); // accountant = petty cash spent
  const totalJointIncome = sum("joint_incomes");
  const accountantCashBalance = totalPettyCashGiven - totalAccountantExpenses;

  const partners = db
    .prepare(
      "SELECT id, name, share_percentage as sharePercentage FROM partners ORDER BY id"
    )
    .all() as { id: number; name: string; sharePercentage: number }[];

  res.json(
    GetDashboardSummaryResponse.parse({
      totalInvestments,
      totalDirectExpenses,
      totalPettyCashGiven,
      totalAccountantExpenses,
      totalJointIncome,
      accountantCashBalance,
      partners,
    })
  );
});

export default router;
