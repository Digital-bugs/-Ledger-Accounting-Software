import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import {
  GetFinalSummaryQueryParams,
  GetFinalSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /final-summary
router.get("/final-summary", (req, res): void => {
  const { dateFrom, dateTo } = GetFinalSummaryQueryParams.parse(req.query);

  // ── Date filter helpers ──────────────────────────────────────────────────────
  const dateCondition = (table: string) => {
    const parts: string[] = [];
    if (dateFrom) parts.push(`${table}.entry_date >= '${dateFrom}'`);
    if (dateTo) parts.push(`${table}.entry_date <= '${dateTo}'`);
    return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  };

  // ── Fetch partner share percentages ─────────────────────────────────────────
  const partners = db
    .prepare("SELECT id, name, share_percentage FROM partners ORDER BY id")
    .all() as { id: number; name: string; share_percentage: number }[];

  const yasir = partners.find((p) => p.name === "Yasir") ?? partners[0];
  const khurram = partners.find((p) => p.name === "Khurram") ?? partners[1];

  if (!yasir || !khurram) {
    res.status(500).json({ error: "Partner data not found" });
    return;
  }

  const yasirSharePct = yasir.share_percentage;
  const khurramSharePct = khurram.share_percentage;

  // ── Investments ─────────────────────────────────────────────────────────────
  const investmentsFilter = dateCondition("investments");
  const invRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN partner_id = ${yasir.id} THEN amount ELSE 0 END), 0) AS yasirTotal,
        COALESCE(SUM(CASE WHEN partner_id = ${khurram.id} THEN amount ELSE 0 END), 0) AS khurramTotal
       FROM investments ${investmentsFilter}`
    )
    .get() as { yasirTotal: number; khurramTotal: number };

  const yasirInvestment = invRow.yasirTotal;
  const khurramInvestment = invRow.khurramTotal;

  // ── Direct Expenses ──────────────────────────────────────────────────────────
  const directFilter = dateCondition("direct_expenses");
  const dirRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN partner_id = ${yasir.id} THEN amount ELSE 0 END), 0) AS yasirTotal,
        COALESCE(SUM(CASE WHEN partner_id = ${khurram.id} THEN amount ELSE 0 END), 0) AS khurramTotal
       FROM direct_expenses ${directFilter}`
    )
    .get() as { yasirTotal: number; khurramTotal: number };

  const yasirDirectExpenses = dirRow.yasirTotal;
  const khurramDirectExpenses = dirRow.khurramTotal;

  // ── Petty Cash Given ─────────────────────────────────────────────────────────
  const pettyFilter = dateCondition("petty_cash_given");
  const pettyRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN partner_id = ${yasir.id} THEN amount ELSE 0 END), 0) AS yasirTotal,
        COALESCE(SUM(CASE WHEN partner_id = ${khurram.id} THEN amount ELSE 0 END), 0) AS khurramTotal
       FROM petty_cash_given ${pettyFilter}`
    )
    .get() as { yasirTotal: number; khurramTotal: number };

  const yasirPettyCashGiven = pettyRow.yasirTotal;
  const khurramPettyCashGiven = pettyRow.khurramTotal;

  // ── Accountant Expenses (petty_cash_spent) ───────────────────────────────────
  const acctFilter = dateCondition("petty_cash_spent");
  const acctRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM petty_cash_spent ${acctFilter}`
    )
    .get() as { total: number };

  const totalAccountantExpenses = acctRow.total;

  // ── Joint Income ─────────────────────────────────────────────────────────────
  const incomeFilter = dateCondition("joint_incomes");
  const incomeRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM joint_incomes ${incomeFilter}`
    )
    .get() as { total: number };

  const totalJointIncome = incomeRow.total;

  // ── Total Petty Cash Given (for accountant cash balance, date-filtered) ──────
  const totalPettyCashGiven = yasirPettyCashGiven + khurramPettyCashGiven;
  const accountantCashBalance = totalPettyCashGiven - totalAccountantExpenses;

  // ── Derived totals ───────────────────────────────────────────────────────────
  const totalInvestment = yasirInvestment + khurramInvestment;
  const totalDirectExpenses = yasirDirectExpenses + khurramDirectExpenses;
  const totalExpenses = totalDirectExpenses + totalAccountantExpenses;

  const yasirTotalPaid =
    yasirInvestment + yasirDirectExpenses + yasirPettyCashGiven;
  const khurramTotalPaid =
    khurramInvestment + khurramDirectExpenses + khurramPettyCashGiven;
  const combinedTotalPaid = yasirTotalPaid + khurramTotalPaid;

  // ── Expected shares ───────────────────────────────────────────────────────────
  // Base is combinedTotalPaid so that yasirExpected + khurramExpected always
  // equals combinedTotalPaid and the two differences always sum to zero.
  const yasirExpectedShare = (combinedTotalPaid * yasirSharePct) / 100;
  const khurramExpectedShare = (combinedTotalPaid * khurramSharePct) / 100;

  // ── Differences ──────────────────────────────────────────────────────────────
  // Positive = paid more than expected (Extra Paid)
  // Negative = paid less than expected (Under Paid)
  // Invariant: yasirDifference + khurramDifference === 0
  const yasirDifference = yasirTotalPaid - yasirExpectedShare;
  const khurramDifference = khurramTotalPaid - khurramExpectedShare;

  // ── Settlement ───────────────────────────────────────────────────────────────
  // Because the differences are always equal and opposite, either absolute value
  // gives the same settlement amount.
  const settlementAmount = Math.abs(yasirDifference);

  let settlementDirection: "yasir_pays_khurram" | "khurram_pays_yasir" | "settled";
  let settlementText: string;

  const EPSILON = 0.005; // tolerate floating-point rounding below half a paisa
  if (settlementAmount < EPSILON) {
    settlementDirection = "settled";
    settlementText = "Accounts are balanced. No payment required.";
  } else if (yasirDifference > 0) {
    // Yasir overpaid → Khurram owes Yasir
    settlementDirection = "khurram_pays_yasir";
    settlementText = `Khurram must pay Yasir Rs. ${settlementAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    // Yasir underpaid → Yasir owes Khurram
    settlementDirection = "yasir_pays_khurram";
    settlementText = `Yasir must pay Khurram Rs. ${settlementAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ── hasData flag ──────────────────────────────────────────────────────────────
  const hasData = combinedTotalPaid > 0 || totalJointIncome > 0;

  const result = {
    yasirInvestment,
    khurramInvestment,
    yasirDirectExpenses,
    khurramDirectExpenses,
    yasirPettyCashGiven,
    khurramPettyCashGiven,
    totalInvestment,
    totalDirectExpenses,
    totalAccountantExpenses,
    totalExpenses,
    totalJointIncome,
    accountantCashBalance,
    yasirTotalPaid,
    khurramTotalPaid,
    combinedTotalPaid,
    yasirSharePercentage: yasirSharePct,
    khurramSharePercentage: khurramSharePct,
    yasirExpectedShare,
    khurramExpectedShare,
    yasirDifference,
    khurramDifference,
    settlementDirection,
    settlementAmount,
    settlementText,
    hasData,
  };

  res.json(GetFinalSummaryResponse.parse(result));
});

export default router;
