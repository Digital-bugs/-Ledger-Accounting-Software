import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", (req, res): void => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

  const buildWhere = (dateCol: string): string => {
    const clauses: string[] = [];
    if (dateFrom) clauses.push(`${dateCol} >= '${dateFrom}'`);
    if (dateTo) clauses.push(`${dateCol} <= '${dateTo}'`);
    return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  };

  const sumAll = (table: string, dateCol = "entry_date") => {
    const where = buildWhere(dateCol);
    return (
      db
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM ${table} ${where}`)
        .get() as { total: number }
    ).total;
  };

  const sumByPartner = (table: string, dateCol = "entry_date") => {
    const where = buildWhere(dateCol);
    return db
      .prepare(
        `SELECT partner_id, COALESCE(SUM(amount), 0) as total
         FROM ${table} ${where}
         GROUP BY partner_id`
      )
      .all() as { partner_id: number; total: number }[];
  };

  const totalInvestments = sumAll("investments");
  const totalDirectExpenses = sumAll("direct_expenses");
  const totalPettyCashGiven = sumAll("petty_cash_given");
  const totalAccountantExpenses = sumAll("petty_cash_spent");
  const totalJointIncome = sumAll("joint_incomes");
  const accountantCashBalance = totalPettyCashGiven - totalAccountantExpenses;

  const investmentsByPartner = sumByPartner("investments");
  const directExpensesByPartner = sumByPartner("direct_expenses");
  const pettyCashByPartner = sumByPartner("petty_cash_given");

  const rawPartners = db
    .prepare(
      "SELECT id, name, share_percentage as sharePercentage FROM partners ORDER BY id"
    )
    .all() as { id: number; name: string; sharePercentage: number }[];

  const partners = rawPartners.map((p) => {
    const investmentTotal =
      investmentsByPartner.find((r) => r.partner_id === p.id)?.total ?? 0;
    const directExpenseTotal =
      directExpensesByPartner.find((r) => r.partner_id === p.id)?.total ?? 0;
    const pettyCashTotal =
      pettyCashByPartner.find((r) => r.partner_id === p.id)?.total ?? 0;
    const totalContribution = investmentTotal + directExpenseTotal + pettyCashTotal;

    return {
      id: p.id,
      name: p.name,
      sharePercentage: p.sharePercentage,
      investmentTotal,
      directExpenseTotal,
      pettyCashTotal,
      totalContribution,
    };
  });

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
