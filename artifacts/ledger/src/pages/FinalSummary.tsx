import { useState, useCallback } from "react";
import { useGetFinalSummary } from "@workspace/api-client-react";
import type { FinalSummaryResult } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  X,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return `Rs. ${(value ?? 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeNum(v: number | undefined | null): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Date filter helpers ────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  isLoading,
  highlight,
}: {
  title: string;
  value: string;
  isLoading: boolean;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    highlight === "positive"
      ? "text-green-600"
      : highlight === "negative"
        ? "text-red-600"
        : "text-foreground";

  return (
    <Card>
      <CardHeader className="pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <div className={`text-lg font-bold font-mono ${valueColor}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function DifferenceCell({ value }: { value: number }) {
  const safe = safeNum(value);
  if (Math.abs(safe) < 0.005) {
    return (
      <span className="flex items-center gap-1 font-mono text-muted-foreground">
        <Minus className="h-3 w-3" /> {fmt(0)}
      </span>
    );
  }
  if (safe > 0) {
    return (
      <span className="flex items-center gap-1 font-mono text-green-600 font-medium">
        <TrendingUp className="h-3 w-3" />
        {fmt(safe)}{" "}
        <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] ml-1">
          Extra Paid
        </Badge>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 font-mono text-red-600 font-medium">
      <TrendingDown className="h-3 w-3" />
      {fmt(Math.abs(safe))}{" "}
      <Badge variant="outline" className="text-red-600 border-red-300 text-[10px] ml-1">
        Less Paid
      </Badge>
    </span>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────────

function exportCSV(d: FinalSummaryResult, label: string) {
  const rows: string[][] = [
    ["Crown King — Final Summary & Settlement", label],
    [],
    ["Category", "Yasir", "Khurram", "Combined"],
    [
      "Investment",
      d.yasirInvestment.toFixed(2),
      d.khurramInvestment.toFixed(2),
      d.totalInvestment.toFixed(2),
    ],
    [
      "Direct Expenses",
      d.yasirDirectExpenses.toFixed(2),
      d.khurramDirectExpenses.toFixed(2),
      d.totalDirectExpenses.toFixed(2),
    ],
    [
      "Petty Cash Given",
      d.yasirPettyCashGiven.toFixed(2),
      d.khurramPettyCashGiven.toFixed(2),
      (d.yasirPettyCashGiven + d.khurramPettyCashGiven).toFixed(2),
    ],
    ["Accountant Expenses", "", "", d.totalAccountantExpenses.toFixed(2)],
    ["Total Expenses", "", "", d.totalExpenses.toFixed(2)],
    ["Joint Company Income", "", "", d.totalJointIncome.toFixed(2)],
    ["Accountant Cash Balance", "", "", d.accountantCashBalance.toFixed(2)],
    [],
    ["Settlement", "", "", ""],
    [
      "Total Paid",
      d.yasirTotalPaid.toFixed(2),
      d.khurramTotalPaid.toFixed(2),
      d.combinedTotalPaid.toFixed(2),
    ],
    [
      `Expected Share (${d.yasirSharePercentage}% / ${d.khurramSharePercentage}%)`,
      d.yasirExpectedShare.toFixed(2),
      d.khurramExpectedShare.toFixed(2),
      d.totalExpenses.toFixed(2),
    ],
    [
      "Difference",
      d.yasirDifference.toFixed(2),
      d.khurramDifference.toFixed(2),
      "",
    ],
    [],
    ["Final Settlement", d.settlementText],
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crown-king-settlement-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FinalSummary() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterLabel, setFilterLabel] = useState("All Time");

  const { data, isLoading, isError, refetch } = useGetFinalSummary(
    { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }
  );

  const applyPreset = useCallback(
    (preset: "all" | "month" | "year", month?: number, year?: number) => {
      if (preset === "all") {
        setDateFrom("");
        setDateTo("");
        setFilterLabel("All Time");
        return;
      }
      const y = year ?? today.getFullYear();
      if (preset === "year") {
        setDateFrom(`${y}-01-01`);
        setDateTo(`${y}-12-31`);
        setFilterLabel(`Year ${y}`);
        return;
      }
      // month
      const m = month ?? today.getMonth();
      const first = `${y}-${padTwo(m + 1)}-01`;
      const last = `${y}-${padTwo(m + 1)}-${padTwo(lastDayOfMonth(y, m))}`;
      setDateFrom(first);
      setDateTo(last);
      setFilterLabel(`${MONTHS[m]} ${y}`);
    },
    [today]
  );

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (data) exportCSV(data, filterLabel);
  };

  // ── Derived display values ───────────────────────────────────────────────────

  const d = data;
  const isEmpty = !isLoading && (!d || !d.hasData);

  const settlementBg =
    d?.settlementDirection === "settled"
      ? "bg-green-50 border-green-200"
      : "bg-amber-50 border-amber-200";

  const settlementTextColor =
    d?.settlementDirection === "settled" ? "text-green-700" : "text-amber-800";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #final-summary-print-area { display: block !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div id="final-summary-print-area" className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Final Summary &amp; Settlement
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crown King — complete financial settlement between partners.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!d || isLoading}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* ── Date filters ── */}
        <Card className="no-print">
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>

              <Button
                variant={filterLabel === "All Time" ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset("all")}
              >
                All Time
              </Button>
              <Button
                variant={filterLabel === `Year ${today.getFullYear()}` ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset("year", undefined, today.getFullYear())}
              >
                This Year
              </Button>
              <Button
                variant={
                  filterLabel === `${MONTHS[today.getMonth()]} ${today.getFullYear()}`
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => applyPreset("month", today.getMonth(), today.getFullYear())}
              >
                This Month
              </Button>

              {/* Month quick-select */}
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const [y, m] = val.split("-").map(Number);
                  applyPreset("month", m, y);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>Pick month…</option>
                {Array.from({ length: 3 }, (_, yi) => {
                  const yr = today.getFullYear() - yi;
                  return MONTHS.map((mn, mi) => (
                    <option key={`${yr}-${mi}`} value={`${yr}-${mi}`}>
                      {mn} {yr}
                    </option>
                  ));
                })}
              </select>
            </div>

            {/* Custom date range */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setFilterLabel("Custom Range");
                  }}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setFilterLabel("Custom Range");
                  }}
                  className="w-40 h-8 text-sm"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset("all")}
                  className="gap-1 h-8"
                >
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
              <div className="text-sm text-muted-foreground italic self-end pb-1">
                Showing: <span className="font-medium text-foreground">{filterLabel}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-dashed rounded-lg border-border">
            <Scale className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">
                No accounting data available.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Add transactions in other modules to generate the settlement.
              </p>
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
            Failed to load settlement data. Please try again.
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* ── Summary cards ── */}
        {(isLoading || (d && d.hasData)) && (
          <>
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Summary Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <SummaryCard title="Total Investment" value={fmt(d?.totalInvestment ?? 0)} isLoading={isLoading} />
                <SummaryCard title="Total Expenses" value={fmt(d?.totalExpenses ?? 0)} isLoading={isLoading} />
                <SummaryCard title="Total Joint Income" value={fmt(d?.totalJointIncome ?? 0)} isLoading={isLoading} highlight="positive" />
                <SummaryCard title="Accountant Cash Balance" value={fmt(d?.accountantCashBalance ?? 0)} isLoading={isLoading} highlight={safeNum(d?.accountantCashBalance) >= 0 ? "positive" : "negative"} />
                <SummaryCard title="Yasir Total Paid" value={fmt(d?.yasirTotalPaid ?? 0)} isLoading={isLoading} />
                <SummaryCard title="Khurram Total Paid" value={fmt(d?.khurramTotalPaid ?? 0)} isLoading={isLoading} />
                <SummaryCard
                  title={`Yasir Expected (${d?.yasirSharePercentage ?? 42.5}%)`}
                  value={fmt(d?.yasirExpectedShare ?? 0)}
                  isLoading={isLoading}
                />
                <SummaryCard
                  title={`Khurram Expected (${d?.khurramSharePercentage ?? 57.5}%)`}
                  value={fmt(d?.khurramExpectedShare ?? 0)}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* ── Detailed accounting table ── */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Detailed Breakdown</h2>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-1/2">#&nbsp;&nbsp;Description</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Yasir</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Khurram</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Combined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <AccountingRow
                        n={1} label="Total Investment"
                        yasir={d?.yasirInvestment} khurram={d?.khurramInvestment}
                        combined={d?.totalInvestment} isLoading={isLoading}
                      />
                      <AccountingRow
                        n={2} label="Total Direct Expenses"
                        yasir={d?.yasirDirectExpenses} khurram={d?.khurramDirectExpenses}
                        combined={d?.totalDirectExpenses} isLoading={isLoading}
                      />
                      <AccountingRow
                        n={3} label="Total Petty Cash Given"
                        yasir={d?.yasirPettyCashGiven} khurram={d?.khurramPettyCashGiven}
                        combined={safeNum(d?.yasirPettyCashGiven) + safeNum(d?.khurramPettyCashGiven)}
                        isLoading={isLoading}
                      />
                      <AccountingRow
                        n={4} label="Total Accountant Expenses"
                        combined={d?.totalAccountantExpenses} isLoading={isLoading}
                      />
                      <AccountingRow
                        n={5} label="Total Expenses (Direct + Accountant)"
                        combined={d?.totalExpenses} isLoading={isLoading}
                        highlight
                      />
                      <AccountingRow
                        n={6} label="Total Joint Company Income"
                        combined={d?.totalJointIncome} isLoading={isLoading}
                        positiveColor
                      />
                      <AccountingRow
                        n={7} label="Accountant Cash Balance"
                        combined={d?.accountantCashBalance} isLoading={isLoading}
                        positiveColor
                      />
                      <AccountingRow
                        n={8} label="Total Paid by Partner"
                        yasir={d?.yasirTotalPaid} khurram={d?.khurramTotalPaid}
                        combined={d?.combinedTotalPaid} isLoading={isLoading}
                        highlight
                      />
                      <AccountingRow
                        n={9}
                        label={`Expected Share (${d?.yasirSharePercentage ?? 42.5}% / ${d?.khurramSharePercentage ?? 57.5}%)`}
                        yasir={d?.yasirExpectedShare} khurram={d?.khurramExpectedShare}
                        combined={d?.totalExpenses} isLoading={isLoading}
                      />
                      <tr className={isLoading ? "" : ""}>
                        <td className="px-4 py-3 font-medium">
                          <span className="text-muted-foreground mr-2">10</span>
                          Difference (Actual − Expected)
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isLoading ? <Skeleton className="h-5 w-24 ml-auto" /> : <DifferenceCell value={safeNum(d?.yasirDifference)} />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isLoading ? <Skeleton className="h-5 w-24 ml-auto" /> : <DifferenceCell value={safeNum(d?.khurramDifference)} />}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">—</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* ── Settlement section ── */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Final Settlement</h2>
              <div className={`rounded-lg border-2 p-6 ${settlementBg}`}>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-80" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`text-xl font-bold ${settlementTextColor}`}>
                      {d?.settlementText}
                    </div>

                    {d && d.settlementDirection !== "settled" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <SettlementDetail
                          label="Settlement Amount"
                          value={fmt(d.settlementAmount)}
                          color="text-amber-800"
                          large
                        />
                        <SettlementDetail
                          label="Yasir Net Difference"
                          value={`${d.yasirDifference >= 0 ? "+" : ""}${fmt(d.yasirDifference)}`}
                          color={d.yasirDifference >= 0 ? "text-green-700" : "text-red-700"}
                        />
                        <SettlementDetail
                          label="Khurram Net Difference"
                          value={`${d.khurramDifference >= 0 ? "+" : ""}${fmt(d.khurramDifference)}`}
                          color={d.khurramDifference >= 0 ? "text-green-700" : "text-red-700"}
                        />
                      </div>
                    )}

                    {d?.settlementDirection === "settled" && (
                      <p className="text-sm text-green-700">
                        Both partners have paid exactly their expected share of total expenses.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

          </>
        )}
      </div>
    </>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────────

function AccountingRow({
  n, label, yasir, khurram, combined, isLoading, highlight, positiveColor,
}: {
  n: number;
  label: string;
  yasir?: number;
  khurram?: number;
  combined?: number;
  isLoading: boolean;
  highlight?: boolean;
  positiveColor?: boolean;
}) {
  const combinedColor = positiveColor
    ? "text-green-600 font-medium"
    : highlight
      ? "font-semibold text-foreground"
      : "text-foreground";

  const rowBg = highlight ? "bg-muted/30" : "";

  return (
    <tr className={rowBg}>
      <td className="px-4 py-3">
        <span className="text-muted-foreground mr-2">{n}</span>
        <span className={highlight ? "font-semibold" : ""}>{label}</span>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {yasir === undefined ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : isLoading ? (
          <Skeleton className="h-5 w-24 ml-auto" />
        ) : (
          fmt(safeNum(yasir))
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {khurram === undefined ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : isLoading ? (
          <Skeleton className="h-5 w-24 ml-auto" />
        ) : (
          fmt(safeNum(khurram))
        )}
      </td>
      <td className={`px-4 py-3 text-right font-mono ${combinedColor}`}>
        {combined === undefined ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : isLoading ? (
          <Skeleton className="h-5 w-24 ml-auto" />
        ) : (
          fmt(safeNum(combined))
        )}
      </td>
    </tr>
  );
}

function SettlementDetail({
  label, value, color, large,
}: {
  label: string;
  value: string;
  color: string;
  large?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-mono font-bold ${large ? "text-2xl" : "text-base"} ${color}`}>{value}</div>
    </div>
  );
}
