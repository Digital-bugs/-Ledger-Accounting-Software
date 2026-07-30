import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetReportsMonthlyDataQueryParams,
  GetReportsMonthlyDataResponse,
  GetReportsAnalyticsQueryParams,
  GetReportsAnalyticsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateFilter(col: string, dateFrom?: string, dateTo?: string): string {
  const parts: string[] = [];
  if (dateFrom) parts.push(`${col} >= '${dateFrom}'`);
  if (dateTo)   parts.push(`${col} <= '${dateTo}'`);
  return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
}

type MonthTotals = Map<string, number>;

function queryMonthlyTotals(table: string, col: string, dateFrom?: string, dateTo?: string): MonthTotals {
  const filter = buildDateFilter(col, dateFrom, dateTo);
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', ${col}) AS month, COALESCE(SUM(amount), 0) AS total
       FROM ${table} ${filter}
       GROUP BY month`
    )
    .all() as { month: string; total: number }[];
  return new Map(rows.map((r) => [r.month, r.total]));
}

function allMonths(...maps: MonthTotals[]): string[] {
  const set = new Set<string>();
  for (const m of maps) for (const k of m.keys()) set.add(k);
  return Array.from(set).sort();
}

// ── GET /reports/monthly-data ─────────────────────────────────────────────────

router.get("/reports/monthly-data", (req, res): void => {
  const { dateFrom, dateTo } = GetReportsMonthlyDataQueryParams.parse(req.query);

  const df = dateFrom ?? undefined;
  const dt = dateTo ?? undefined;

  const invMap  = queryMonthlyTotals("investments",      "entry_date", df, dt);
  const dirMap  = queryMonthlyTotals("direct_expenses",  "entry_date", df, dt);
  const petMap  = queryMonthlyTotals("petty_cash_given", "entry_date", df, dt);
  const acctMap = queryMonthlyTotals("petty_cash_spent", "entry_date", df, dt);
  const incMap  = queryMonthlyTotals("joint_incomes",    "entry_date", df, dt);

  const months = allMonths(invMap, dirMap, petMap, acctMap, incMap).map((month) => {
    const investments       = invMap.get(month)  ?? 0;
    const directExpenses    = dirMap.get(month)  ?? 0;
    const pettyCashGiven    = petMap.get(month)  ?? 0;
    const accountantExpenses = acctMap.get(month) ?? 0;
    const jointIncome       = incMap.get(month)  ?? 0;
    const totalExpenses     = directExpenses + pettyCashGiven + accountantExpenses;
    return { month, investments, directExpenses, pettyCashGiven, accountantExpenses, jointIncome, totalExpenses };
  });

  res.json(GetReportsMonthlyDataResponse.parse({ months }));
});

// ── GET /reports/analytics ────────────────────────────────────────────────────

router.get("/reports/analytics", (req, res): void => {
  const { dateFrom, dateTo } = GetReportsAnalyticsQueryParams.parse(req.query);

  const df = dateFrom ?? undefined;
  const dt = dateTo ?? undefined;

  // Monthly expenses (direct + petty cash given + accountant)
  const dirMap  = queryMonthlyTotals("direct_expenses",  "entry_date", df, dt);
  const petMap  = queryMonthlyTotals("petty_cash_given", "entry_date", df, dt);
  const acctMap = queryMonthlyTotals("petty_cash_spent", "entry_date", df, dt);
  const incMap  = queryMonthlyTotals("joint_incomes",    "entry_date", df, dt);

  const expenseMonths = allMonths(dirMap, petMap, acctMap);
  const monthlyExpenses = expenseMonths.map((m) => ({
    month: m,
    total: (dirMap.get(m) ?? 0) + (petMap.get(m) ?? 0) + (acctMap.get(m) ?? 0),
  }));

  const incomeMonths = Array.from(incMap.keys()).sort();
  const monthlyIncome = incomeMonths.map((m) => ({ month: m, total: incMap.get(m) ?? 0 }));

  // Transaction counts
  function countRows(table: string, col: string): number {
    const filter = buildDateFilter(col, df, dt);
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM ${table} ${filter}`)
      .get() as { c: number };
    return row.c;
  }

  const totalTransactions =
    countRows("investments",      "entry_date") +
    countRows("direct_expenses",  "entry_date") +
    countRows("petty_cash_given", "entry_date") +
    countRows("petty_cash_spent", "entry_date") +
    countRows("joint_incomes",    "entry_date");

  // KPIs
  const highestExpense = monthlyExpenses.reduce(
    (max, r) => (r.total > max.total ? r : max),
    { month: null as string | null, total: 0 }
  );
  const highestIncome = monthlyIncome.reduce(
    (max, r) => (r.total > max.total ? r : max),
    { month: null as string | null, total: 0 }
  );

  const avgMonthlyExpense =
    monthlyExpenses.length
      ? monthlyExpenses.reduce((s, r) => s + r.total, 0) / monthlyExpenses.length
      : 0;
  const avgMonthlyIncome =
    monthlyIncome.length
      ? monthlyIncome.reduce((s, r) => s + r.total, 0) / monthlyIncome.length
      : 0;

  res.json(
    GetReportsAnalyticsResponse.parse({
      highestMonthlyExpense: highestExpense.total,
      highestMonthlyIncome:  highestIncome.total,
      totalTransactions,
      avgMonthlyExpense,
      avgMonthlyIncome,
      highestExpenseMonth: highestExpense.month,
      highestIncomeMonth:  highestIncome.month,
    })
  );
});

export default router;
