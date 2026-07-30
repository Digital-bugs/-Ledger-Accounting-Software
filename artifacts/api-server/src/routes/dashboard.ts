import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", (_req, res): void => {
  const sum = (table: string) =>
    (
      db
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM ${table}`)
        .get() as { total: number }
    ).total;

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
