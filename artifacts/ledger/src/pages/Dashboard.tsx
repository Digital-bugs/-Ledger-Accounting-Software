import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ReceiptText, Coins, Calculator, Briefcase, Wallet } from "lucide-react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { usePeriod } from "@/context/PeriodContext";
import { PeriodFilter } from "@/components/layout/PeriodFilter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PARTNER_COLORS = ["#3b82f6", "#6366f1"];

const CHART_BARS = [
  { key: "totalInvestments", label: "Investments", color: "#3b82f6" },
  { key: "totalDirectExpenses", label: "Direct Exp.", color: "#f59e0b" },
  { key: "totalPettyCashGiven", label: "Petty Cash", color: "#8b5cf6" },
  { key: "totalAccountantExpenses", label: "Accountant Exp.", color: "#ef4444" },
  { key: "totalJointIncome", label: "Joint Income", color: "#10b981" },
] as const;

function formatCurrency(value: number) {
  return `Rs ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `Rs ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Rs ${(value / 1_000).toFixed(0)}K`;
  return `Rs ${value.toFixed(0)}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-popover-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { dateFrom, dateTo, label: periodLabel } = usePeriod();

  const params = {
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data: summary, isLoading, isError } = useGetDashboardSummary(params);

  const summaryCards = [
    { title: "Total Investments", amount: summary?.totalInvestments ?? 0, icon: Landmark },
    { title: "Total Direct Expenses", amount: summary?.totalDirectExpenses ?? 0, icon: ReceiptText },
    { title: "Total Petty Cash Given", amount: summary?.totalPettyCashGiven ?? 0, icon: Coins },
    { title: "Total Accountant Expenses", amount: summary?.totalAccountantExpenses ?? 0, icon: Calculator },
    { title: "Total Joint Company Income", amount: summary?.totalJointIncome ?? 0, icon: Briefcase },
    { title: "Accountant Cash Balance", amount: summary?.accountantCashBalance ?? 0, icon: Wallet },
  ];

  const chartData = CHART_BARS.map((b) => ({
    name: b.label,
    amount: summary?.[b.key] ?? 0,
    color: b.color,
  }));

  const totalExpenses =
    (summary?.totalInvestments ?? 0) +
    (summary?.totalDirectExpenses ?? 0) +
    (summary?.totalPettyCashGiven ?? 0) +
    (summary?.totalAccountantExpenses ?? 0);

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Financial summary and partner overview for Crown King.
            </p>
          </div>
        </div>
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
          Failed to load dashboard summary. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header with period filter */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Financial summary and partner overview for Crown King.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-1">
          <PeriodFilter />
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              Showing data for {periodLabel}
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-[120px]" />
                ) : (
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {formatCurrency(card.amount)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts + Partner Overview side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Expense breakdown chart */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Financial Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Totals by category — {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCompact}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Stats row */}
            {!isLoading && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
                  <p className="text-sm font-semibold font-mono text-foreground mt-0.5">
                    {formatCurrency(totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joint Income</p>
                  <p className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">
                    {formatCurrency(summary?.totalJointIncome ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partner Overview */}
        <div className="xl:col-span-2 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Partner Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
          </div>

          {isLoading ? (
            <>
              {[0, 1].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-1.5 w-full" />
                    <div className="grid grid-cols-3 gap-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : summary?.partners?.length ? (
            summary.partners.map((partner, index) => {
              const colorClass = PARTNER_COLORS[index % PARTNER_COLORS.length];
              return (
                <Card key={partner.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: colorClass }}
                        />
                        <span className="font-semibold text-sm text-foreground">
                          {partner.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {partner.sharePercentage}%
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-foreground">
                          {formatCurrency(partner.totalContribution)}
                        </div>
                        <div className="text-xs text-muted-foreground">total contributed</div>
                      </div>
                    </div>

                    <Progress
                      value={partner.sharePercentage}
                      indicatorColor={index === 0 ? "bg-blue-500" : "bg-indigo-500"}
                      className="h-1.5 mb-3"
                    />

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/60 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground leading-tight">Invested</p>
                        <p className="text-xs font-mono font-semibold text-foreground mt-0.5">
                          {formatCompact(partner.investmentTotal)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/60 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground leading-tight">Direct Exp.</p>
                        <p className="text-xs font-mono font-semibold text-foreground mt-0.5">
                          {formatCompact(partner.directExpenseTotal)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/60 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground leading-tight">Petty Cash</p>
                        <p className="text-xs font-mono font-semibold text-foreground mt-0.5">
                          {formatCompact(partner.pettyCashTotal)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground bg-muted p-6 rounded-md text-center border border-dashed border-border">
              No partners found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
