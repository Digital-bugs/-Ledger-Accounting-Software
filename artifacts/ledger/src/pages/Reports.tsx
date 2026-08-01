import { useState, useEffect, useCallback } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  useGetDashboardSummary,
  useListInvestments,
  useListDirectExpenses,
  useListPettyCashGiven,
  useListAccountantExpenses,
  useListJointIncomes,
  useGetFinalSummary,
  useGetReportsMonthlyData,
  useGetReportsAnalytics,
} from "@workspace/api-client-react";
import type {
  Investment,
  DirectExpense,
  PettyCashGivenRecord,
  AccountantExpense,
  JointIncome,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  Landmark,
  ReceiptText,
  Coins,
  Calculator,
  Briefcase,
  Wallet,
  Scale,
} from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

// ── Constants ─────────────────────────────────────────────────────────────────

const PARTNERS = [
  { id: 1, name: "Yasir" },
  { id: 2, name: "Khurram" },
];

const PAGE_SIZES = [25, 50, 100];

const CHART_COLORS = {
  investments: "#3b82f6",
  directExpenses: "#ef4444",
  pettyCashGiven: "#f59e0b",
  accountantExpenses: "#8b5cf6",
  jointIncome: "#10b981",
  totalExpenses: "#dc2626",
  yasir: "#3b82f6",
  khurram: "#6366f1",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2024, i, 1);
  return { value: String(i + 1).padStart(2, "0"), label: format(d, "MMMM") };
});

const YEARS = [2022, 2023, 2024, 2025, 2026].map((y) => ({ value: String(y) }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return format(d, "MMM yyyy");
};

function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const escapeCell = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(
    "\n"
  );
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportExcel(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = "Report"
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Auto-width columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

function openPrintWindow(title: string, headers: string[], rows: (string | number | null | undefined)[][], dateFrom?: string, dateTo?: string) {
  const now = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  const dateRange = dateFrom || dateTo
    ? `${dateFrom || "beginning"} – ${dateTo || "present"}`
    : "All dates";

  const tableRows = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`)
    .join("");
  const headerCells = headers.map((h) => `<th>${h}</th>`).join("");

  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  .header { padding: 20px 30px 12px; border-bottom: 2px solid #1e3a5f; }
  .header-top { display: flex; justify-content: space-between; align-items: center; }
  .company { font-size: 22px; font-weight: 700; color: #1e3a5f; letter-spacing: 1px; }
  .company sub { font-size: 11px; font-weight: 400; color: #666; }
  .meta { text-align: right; font-size: 10px; color: #555; }
  .report-title { font-size: 16px; font-weight: 600; color: #1e3a5f; margin: 8px 0 4px; }
  .date-range { font-size: 10px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 0; }
  th { background: #1e3a5f; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { position: fixed; bottom: 15px; width: 100%; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 4px; }
  @page { margin: 15mm; size: A4; }
</style>
</head><body>
<div class="header">
  <div class="header-top">
    <div>
      <div class="company">CROWN KING <sub>INC.</sub></div>
      <div class="report-title">${title}</div>
      <div class="date-range">Period: ${dateRange}</div>
    </div>
    <div class="meta">
      <div>Printed: ${now}</div>
      <div>Crown King Ledger System</div>
    </div>
  </div>
</div>
<table><thead><tr>${headerCells}</tr></thead><tbody>${tableRows}</tbody></table>
<div class="footer">Crown King Inc. — Ledger Accounting Software — Page <span class="pageNumber"></span></div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Export Buttons ────────────────────────────────────────────────────────────

interface ExportButtonsProps {
  onPrint: () => void;
  onExcelExport: () => void;
  onCSVExport: () => void;
  label?: string;
}

function ExportButtons({ onPrint, onExcelExport, onCSVExport, label = "Export" }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={onPrint}>
        <Printer className="h-3.5 w-3.5" />
        Print / PDF
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={onExcelExport}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={onCSVExport}>
        <Download className="h-3.5 w-3.5" />
        CSV
      </Button>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  partnerId: string;
  page: number;
  pageSize: number;
  sortDir: "asc" | "desc";
}

const INITIAL_FILTERS: FilterState = {
  search: "",
  partnerId: "",
  page: 1,
  pageSize: 25,
  sortDir: "desc",
};

interface FilterBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  showPartner?: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
}

function FilterBar({ filters, setFilters, showPartner = true, searchInput, setSearchInput }: FilterBarProps) {
  const hasActive = filters.search || filters.partnerId;

  function clear() {
    setSearchInput("");
    setFilters(INITIAL_FILTERS);
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="flex-1 min-w-[160px] space-y-1">
        <Label className="text-xs text-muted-foreground">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Receipt # or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Partner */}
      {showPartner && (
        <div className="w-36 space-y-1">
          <Label className="text-xs text-muted-foreground">Partner</Label>
          <Select
            value={filters.partnerId || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, partnerId: v === "all" ? "" : v, page: 1 }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              {PARTNERS.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clear}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ── Pagination Bar ────────────────────────────────────────────────────────────

interface PaginationBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  total: number;
}

function PaginationBar({ filters, setFilters, total }: PaginationBarProps) {
  const totalPages = Math.ceil(total / filters.pageSize);
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          Showing {Math.min((filters.page - 1) * filters.pageSize + 1, total)}–
          {Math.min(filters.page * filters.pageSize, total)} of {total}
        </span>
        <Select
          value={String(filters.pageSize)}
          onValueChange={(v) => setFilters((f) => ({ ...f, pageSize: Number(v), page: 1 }))}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={filters.page === 1}
          onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2">{filters.page} / {totalPages}</span>
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={filters.page >= totalPages}
          onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const params = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data, isLoading } = useGetDashboardSummary(Object.keys(params).length ? params : undefined);
  const cards = [
    { label: "Total Investments", value: data?.totalInvestments ?? 0, icon: Landmark, color: "text-blue-600" },
    { label: "Total Direct Expenses", value: data?.totalDirectExpenses ?? 0, icon: ReceiptText, color: "text-red-600" },
    { label: "Total Accountant Expenses", value: data?.totalAccountantExpenses ?? 0, icon: Calculator, color: "text-violet-600" },
    { label: "Total Joint Income", value: data?.totalJointIncome ?? 0, icon: Briefcase, color: "text-emerald-600" },
    { label: "Accountant Cash Balance", value: data?.accountantCashBalance ?? 0, icon: Wallet, color: "text-amber-600" },
    {
      label: "Total Company Expenses",
      value: (data?.totalDirectExpenses ?? 0) + (data?.totalAccountantExpenses ?? 0),
      icon: BarChart2,
      color: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardHeader className="pb-1 pt-3 px-3 space-y-0">
              <CardTitle className="text-[10px] font-medium text-muted-foreground leading-tight flex items-center justify-between">
                {c.label}
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className={`text-base font-bold font-mono ${c.color}`}>Rs {fmt(c.value)}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Analytics Dashboard ───────────────────────────────────────────────────────

function AnalyticsDashboard({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const params = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data, isLoading } = useGetReportsAnalytics(Object.keys(params).length ? params : undefined);

  const kpis = data
    ? [
        { label: "Highest Monthly Expense", value: `Rs ${fmt(data.highestMonthlyExpense)}`, sub: data.highestExpenseMonth ? fmtMonth(data.highestExpenseMonth) : "—", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
        { label: "Highest Monthly Income", value: `Rs ${fmt(data.highestMonthlyIncome)}`, sub: data.highestIncomeMonth ? fmtMonth(data.highestIncomeMonth) : "—", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Total Transactions", value: String(data.totalTransactions), sub: "all modules", icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Avg Monthly Expense", value: `Rs ${fmt(data.avgMonthlyExpense)}`, sub: "per month", icon: BarChart2, color: "text-violet-600", bg: "bg-violet-50" },
        { label: "Avg Monthly Income", value: `Rs ${fmt(data.avgMonthlyIncome)}`, sub: "per month", icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Analytics Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
            : kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className={`rounded-lg p-3 ${k.bg} border border-border`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground font-medium leading-tight">{k.label}</p>
                      <Icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <p className={`text-lg font-bold font-mono ${k.color}`}>{k.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                  </div>
                );
              })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function Charts({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const params = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data, isLoading } = useGetReportsMonthlyData(Object.keys(params).length ? params : undefined);

  const months = (data?.months ?? []).map((m) => ({ ...m, monthLabel: fmtMonth(m.month) }));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    );
  }

  if (!months.length) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12 border border-dashed border-border rounded-xl">
        No data available for the selected period.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Monthly Expenses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs ${fmt(v)}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="directExpenses" name="Direct Expenses" fill={CHART_COLORS.directExpenses} radius={[3, 3, 0, 0]} />
              <Bar dataKey="pettyCashGiven" name="Petty Cash" fill={CHART_COLORS.pettyCashGiven} radius={[3, 3, 0, 0]} />
              <Bar dataKey="accountantExpenses" name="Accountant Exp." fill={CHART_COLORS.accountantExpenses} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Income */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Income</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs ${fmt(v)}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="jointIncome" name="Joint Income" fill={CHART_COLORS.jointIncome} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Investment vs Total Expenses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Investments vs Total Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs ${fmt(v)}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="investments" name="Investments" stroke={CHART_COLORS.investments} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="totalExpenses" name="Total Expenses" stroke={CHART_COLORS.totalExpenses} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cash Flow Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cash Flow Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={months.map((m) => ({ ...m, netFlow: m.jointIncome - m.totalExpenses }))}
              margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs ${fmt(v)}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="jointIncome" name="Income" stroke={CHART_COLORS.jointIncome} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="totalExpenses" name="Expenses" stroke={CHART_COLORS.totalExpenses} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="netFlow" name="Net Flow" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Partner Contribution Comparison */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Investments by Partner</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs ${fmt(v)}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="investments" name="Total Investments" fill={CHART_COLORS.investments} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Partner Badge ─────────────────────────────────────────────────────────────

function PartnerBadge({ name }: { name: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        name === "Yasir"
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
      }`}
    >
      {name}
    </span>
  );
}

// ── Investment Report ─────────────────────────────────────────────────────────

function InvestmentReport() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = usePeriod();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.partnerId ? { partnerId: Number(filters.partnerId) } : {}),
    ...(globalDateFrom ? { dateFrom: globalDateFrom } : {}),
    ...(globalDateTo ? { dateTo: globalDateTo } : {}),
    page: filters.page, pageSize: filters.pageSize, sortDir: filters.sortDir,
  };
  const { data, isLoading } = useListInvestments(params);
  const summary = data?.summary;

  function buildRows(): (string | number)[][] {
    return (data?.data ?? []).map((r) => [
      r.receiptNumber, r.entryDate, r.description, r.partnerName, r.amount,
    ]);
  }

  const headers = ["Receipt #", "Date", "Description", "Partner", "Amount"];
  const title = "Investment Report";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Yasir Total", value: summary?.yasirTotal ?? 0, color: "text-blue-600" },
          { label: "Khurram Total", value: summary?.khurramTotal ?? 0, color: "text-indigo-600" },
          { label: "Combined Total", value: summary?.combinedTotal ?? 0, color: "text-foreground" },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1 pt-3 px-4 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {isLoading ? <Skeleton className="h-7 w-24" /> : <div className={`text-xl font-bold font-mono ${c.color}`}>Rs {fmt(c.value)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Export */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <FilterBar filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} />
            <ExportButtons
              onPrint={() => openPrintWindow(title, headers, buildRows(), globalDateFrom, globalDateTo)}
              onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Investments")}
              onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Receipt #</TableHead>
                <TableHead
                  className="font-semibold cursor-pointer select-none"
                  onClick={() => setFilters((f) => ({ ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {filters.sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Partner</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : data?.data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">No investments found.</TableCell></TableRow>
              ) : (
                (data?.data ?? []).map((r: Investment) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.receiptNumber || "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">{r.entryDate}</TableCell>
                    <TableCell className="text-xs">{r.description}</TableCell>
                    <TableCell><PartnerBadge name={r.partnerName} /></TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">Rs {fmt(r.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationBar filters={filters} setFilters={setFilters} total={data?.total ?? 0} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Direct Expense Report ─────────────────────────────────────────────────────

function DirectExpenseReport() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = usePeriod();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.partnerId ? { partnerId: Number(filters.partnerId) } : {}),
    ...(globalDateFrom ? { dateFrom: globalDateFrom } : {}),
    ...(globalDateTo ? { dateTo: globalDateTo } : {}),
    page: filters.page, pageSize: filters.pageSize, sortDir: filters.sortDir,
  };
  const { data, isLoading } = useListDirectExpenses(params);
  const summary = data?.summary;
  const headers = ["Receipt #", "Date", "Description", "Partner", "Amount"];
  const title = "Direct Expense Report";
  const buildRows = () => (data?.data ?? []).map((r) => [r.receiptNumber, r.entryDate, r.description, r.partnerName, r.amount] as (string|number)[]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Yasir Total", value: summary?.yasirTotal ?? 0, color: "text-blue-600" },
          { label: "Khurram Total", value: summary?.khurramTotal ?? 0, color: "text-indigo-600" },
          { label: "Combined Total", value: summary?.combinedTotal ?? 0, color: "text-foreground" },
        ].map((c) => (
          <Card key={c.label}><CardHeader className="pb-1 pt-3 px-4 space-y-0"><CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">{isLoading ? <Skeleton className="h-7 w-24" /> : <div className={`text-xl font-bold font-mono ${c.color}`}>Rs {fmt(c.value)}</div>}</CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} />
          <ExportButtons onPrint={() => openPrintWindow(title, headers, buildRows(), globalDateFrom, globalDateTo)} onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Direct Expenses")} onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())} />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            {["Receipt #", "Date ↕", "Description", "Partner", "Amount"].map((h, i) => (
              <TableHead key={h} className={`font-semibold ${i === 4 ? "text-right" : ""} ${i === 1 ? "cursor-pointer select-none" : ""}`}
                onClick={i === 1 ? () => setFilters((f) => ({ ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc", page: 1 })) : undefined}>
                {i === 1 ? <div className="flex items-center gap-1">Date {filters.sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</div> : h}
              </TableHead>
            ))}
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
              : data?.data.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">No direct expenses found.</TableCell></TableRow>
              : (data?.data ?? []).map((r: DirectExpense) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.receiptNumber || "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.entryDate}</TableCell>
                  <TableCell className="text-xs">{r.description}</TableCell>
                  <TableCell><PartnerBadge name={r.partnerName} /></TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">Rs {fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <PaginationBar filters={filters} setFilters={setFilters} total={data?.total ?? 0} />
      </CardContent></Card>
    </div>
  );
}

// ── Petty Cash Report ─────────────────────────────────────────────────────────

function PettyCashReport() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = usePeriod();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.partnerId ? { partnerId: Number(filters.partnerId) } : {}),
    ...(globalDateFrom ? { dateFrom: globalDateFrom } : {}),
    ...(globalDateTo ? { dateTo: globalDateTo } : {}),
    page: filters.page, pageSize: filters.pageSize, sortDir: filters.sortDir,
  };
  const { data, isLoading } = useListPettyCashGiven(params);
  const summary = data?.summary;
  const headers = ["Receipt #", "Date", "Description", "Partner", "Amount"];
  const title = "Petty Cash Given Report";
  const buildRows = () => (data?.data ?? []).map((r) => [r.receiptNumber, r.entryDate, r.description, r.partnerName, r.amount] as (string|number)[]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Yasir Total", value: summary?.yasirTotal ?? 0, color: "text-blue-600" },
          { label: "Khurram Total", value: summary?.khurramTotal ?? 0, color: "text-indigo-600" },
          { label: "Combined Total", value: summary?.combinedTotal ?? 0, color: "text-foreground" },
          { label: "Accountant Balance", value: summary?.accountantCashBalance ?? 0, color: "text-amber-600" },
        ].map((c) => (
          <Card key={c.label}><CardHeader className="pb-1 pt-3 px-4 space-y-0"><CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">{isLoading ? <Skeleton className="h-7 w-24" /> : <div className={`text-xl font-bold font-mono ${c.color}`}>Rs {fmt(c.value)}</div>}</CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar filters={filters} setFilters={setFilters} searchInput={searchInput} setSearchInput={setSearchInput} />
          <ExportButtons onPrint={() => openPrintWindow(title, headers, buildRows(), globalDateFrom, globalDateTo)} onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Petty Cash")} onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())} />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Receipt #</TableHead>
            <TableHead className="font-semibold cursor-pointer select-none" onClick={() => setFilters((f) => ({ ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc", page: 1 }))}>
              <div className="flex items-center gap-1">Date {filters.sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</div>
            </TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Partner</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
              : data?.data.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">No records found.</TableCell></TableRow>
              : (data?.data ?? []).map((r: PettyCashGivenRecord) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.receiptNumber || "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.entryDate}</TableCell>
                  <TableCell className="text-xs">{r.description}</TableCell>
                  <TableCell><PartnerBadge name={r.partnerName} /></TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">Rs {fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <PaginationBar filters={filters} setFilters={setFilters} total={data?.total ?? 0} />
      </CardContent></Card>
    </div>
  );
}

// ── Accountant Expense Report ─────────────────────────────────────────────────

function AccountantExpenseReport() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = usePeriod();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(globalDateFrom ? { dateFrom: globalDateFrom } : {}),
    ...(globalDateTo ? { dateTo: globalDateTo } : {}),
    page: filters.page, pageSize: filters.pageSize, sortDir: filters.sortDir,
  };
  const { data, isLoading } = useListAccountantExpenses(params);
  const summary = data?.summary;
  const headers = ["Receipt #", "Date", "Description", "Amount"];
  const title = "Accountant Expense Report";
  const buildRows = () => (data?.data ?? []).map((r) => [r.receiptNumber, r.entryDate, r.description ?? "", r.amount] as (string|number)[]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Expenses", value: summary?.totalExpenses ?? 0, color: "text-red-600" },
          { label: "Total Petty Cash Received", value: summary?.totalPettyCashReceived ?? 0, color: "text-amber-600" },
          { label: "Cash Balance", value: summary?.accountantCashBalance ?? 0, color: (summary?.accountantCashBalance ?? 0) >= 0 ? "text-emerald-600" : "text-red-600" },
        ].map((c) => (
          <Card key={c.label}><CardHeader className="pb-1 pt-3 px-4 space-y-0"><CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">{isLoading ? <Skeleton className="h-7 w-24" /> : <div className={`text-xl font-bold font-mono ${c.color}`}>Rs {fmt(c.value)}</div>}</CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar filters={filters} setFilters={setFilters} showPartner={false} searchInput={searchInput} setSearchInput={setSearchInput} />
          <ExportButtons onPrint={() => openPrintWindow(title, headers, buildRows(), globalDateFrom, globalDateTo)} onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Accountant Exp")} onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())} />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Receipt #</TableHead>
            <TableHead className="font-semibold cursor-pointer select-none" onClick={() => setFilters((f) => ({ ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc", page: 1 }))}>
              <div className="flex items-center gap-1">Date {filters.sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</div>
            </TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
              : data?.data.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">No expenses found.</TableCell></TableRow>
              : (data?.data ?? []).map((r: AccountantExpense) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.receiptNumber || "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.entryDate}</TableCell>
                  <TableCell className="text-xs">{r.description || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">Rs {fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <PaginationBar filters={filters} setFilters={setFilters} total={data?.total ?? 0} />
      </CardContent></Card>
    </div>
  );
}

// ── Joint Income Report ───────────────────────────────────────────────────────

function JointIncomeReport() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = usePeriod();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(globalDateFrom ? { dateFrom: globalDateFrom } : {}),
    ...(globalDateTo ? { dateTo: globalDateTo } : {}),
    page: filters.page, pageSize: filters.pageSize, sortDir: filters.sortDir,
  };
  const { data, isLoading } = useListJointIncomes(params);
  const summary = data?.summary;
  const headers = ["Receipt #", "Date", "Income Source", "Description", "Amount"];
  const title = "Joint Company Income Report";
  const buildRows = () => (data?.data ?? []).map((r) => [r.receiptNumber, r.entryDate, r.incomeSource, r.description ?? "", r.amount] as (string|number)[]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Combined Total", value: summary?.combinedTotal ?? 0 },
        ].map((c) => (
          <Card key={c.label}><CardHeader className="pb-1 pt-3 px-4 space-y-0"><CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">{isLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-xl font-bold font-mono text-foreground">Rs. {fmt(c.value)}</div>}</CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <FilterBar filters={filters} setFilters={setFilters} showPartner={false} searchInput={searchInput} setSearchInput={setSearchInput} />
          </div>
          <ExportButtons onPrint={() => openPrintWindow(title, headers, buildRows(), globalDateFrom, globalDateTo)} onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Joint Income")} onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())} />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Receipt #</TableHead>
            <TableHead className="font-semibold cursor-pointer select-none" onClick={() => setFilters((f) => ({ ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc", page: 1 }))}>
              <div className="flex items-center gap-1">Date {filters.sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</div>
            </TableHead>
            <TableHead className="font-semibold">Income Source</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
              : data?.data.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">No income records found.</TableCell></TableRow>
              : (data?.data ?? []).map((r: JointIncome) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.receiptNumber || "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.entryDate}</TableCell>
                  <TableCell className="text-xs">{r.incomeSource || "—"}</TableCell>
                  <TableCell className="text-xs">{r.description || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium text-emerald-600">Rs. {fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <PaginationBar filters={filters} setFilters={setFilters} total={data?.total ?? 0} />
      </CardContent></Card>
    </div>
  );
}

// ── Settlement Report ─────────────────────────────────────────────────────────

function SettlementReport() {
  const { dateFrom, dateTo } = usePeriod();
  const params = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data, isLoading } = useGetFinalSummary(Object.keys(params).length ? params : undefined);

  const rows: [string, string, string][] = data
    ? [
        ["Yasir Investment", `Rs ${fmt(data.yasirInvestment)}`, ""],
        ["Khurram Investment", `Rs ${fmt(data.khurramInvestment)}`, ""],
        ["Total Investment", `Rs ${fmt(data.totalInvestment)}`, "combined"],
        ["Yasir Direct Expenses", `Rs ${fmt(data.yasirDirectExpenses)}`, ""],
        ["Khurram Direct Expenses", `Rs ${fmt(data.khurramDirectExpenses)}`, ""],
        ["Total Direct Expenses", `Rs ${fmt(data.totalDirectExpenses)}`, "combined"],
        ["Total Accountant Expenses", `Rs ${fmt(data.totalAccountantExpenses)}`, "combined"],
        ["Total Company Expenses", `Rs ${fmt(data.totalExpenses)}`, "combined"],
        ["Total Joint Income", `Rs ${fmt(data.totalJointIncome)}`, "income"],
        ["Accountant Cash Balance", `Rs ${fmt(data.accountantCashBalance)}`, "balance"],
        ["Yasir Total Paid", `Rs ${fmt(data.yasirTotalPaid)}`, ""],
        ["Khurram Total Paid", `Rs ${fmt(data.khurramTotalPaid)}`, ""],
        ["Yasir Share (${data.yasirSharePercentage}%)", `Rs ${fmt(data.yasirExpectedShare)}`, ""],
        ["Khurram Share (${data.khurramSharePercentage}%)", `Rs ${fmt(data.khurramExpectedShare)}`, ""],
        ["Settlement", data.settlementText, "settlement"],
      ]
    : [];

  const title = "Final Settlement Report";
  const exportHeaders = ["Description", "Amount", "Note"];
  const exportRows = rows.map((r) => [r[0], r[1], r[2]]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-40 space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input type="date" className="h-8 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="w-40 space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input type="date" className="h-8 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                <X className="h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>
          <ExportButtons
            onPrint={() => openPrintWindow(title, exportHeaders, exportRows, dateFrom, dateTo)}
            onExcelExport={() => exportExcel(`${title}.xlsx`, exportHeaders, exportRows, "Settlement")}
            onCSVExport={() => exportCSV(`${title}.csv`, exportHeaders, exportRows)}
          />
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.hasData ? (
              <TableRow><TableCell colSpan={2} className="h-24 text-center text-sm text-muted-foreground">No financial data available.</TableCell></TableRow>
            ) : (
              <>
                {[
                  { section: "Investments", rows: [["Yasir Investment", data.yasirInvestment], ["Khurram Investment", data.khurramInvestment], ["Total Investment", data.totalInvestment, true]] },
                  { section: "Expenses", rows: [["Direct Expenses", data.totalDirectExpenses], ["Accountant Expenses", data.totalAccountantExpenses], ["Total Company Expenses", data.totalExpenses, true]] },
                  { section: "Income", rows: [["Joint Income", data.totalJointIncome], ["Accountant Cash Balance", data.accountantCashBalance, true]] },
                  { section: "Settlement", rows: [["Yasir Total Paid", data.yasirTotalPaid], ["Khurram Total Paid", data.khurramTotalPaid], [`Yasir Expected Share (${data.yasirSharePercentage}%)`, data.yasirExpectedShare], [`Khurram Expected Share (${data.khurramSharePercentage}%)`, data.khurramExpectedShare]] },
                ].map(({ section, rows: secRows }) => (
                  <>
                    <TableRow key={section} className="bg-muted/60"><TableCell colSpan={2} className="py-1.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section}</TableCell></TableRow>
                    {secRows.map(([label, value, bold]) => (
                      <TableRow key={String(label)}>
                        <TableCell className={`text-sm ${bold ? "font-semibold" : ""}`}>{String(label)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${bold ? "font-bold" : ""}`}>Rs {fmt(Number(value))}</TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
                <TableRow className={`${data.settlementDirection === "settled" ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <TableCell colSpan={2} className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{data.settlementText}</span>
                    </div>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

// ── Overall Financial Summary ──────────────────────────────────────────────────

function OverallSummaryReport({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const params = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data: monthly, isLoading } = useGetReportsMonthlyData(Object.keys(params).length ? params : undefined);
  const { data: dashboard } = useGetDashboardSummary();

  const totals = monthly?.months.reduce(
    (acc, m) => ({
      investments: acc.investments + m.investments,
      directExpenses: acc.directExpenses + m.directExpenses,
      pettyCashGiven: acc.pettyCashGiven + m.pettyCashGiven,
      accountantExpenses: acc.accountantExpenses + m.accountantExpenses,
      jointIncome: acc.jointIncome + m.jointIncome,
      totalExpenses: acc.totalExpenses + m.totalExpenses,
    }),
    { investments: 0, directExpenses: 0, pettyCashGiven: 0, accountantExpenses: 0, jointIncome: 0, totalExpenses: 0 }
  );

  const rows: [string, string][] = totals
    ? [
        ["Total Investments", `Rs ${fmt(totals.investments)}`],
        ["Total Direct Expenses", `Rs ${fmt(totals.directExpenses)}`],
        ["Total Petty Cash Given", `Rs ${fmt(totals.pettyCashGiven)}`],
        ["Total Accountant Expenses", `Rs ${fmt(totals.accountantExpenses)}`],
        ["Total Company Expenses", `Rs ${fmt(totals.totalExpenses)}`],
        ["Total Joint Income", `Rs ${fmt(totals.jointIncome)}`],
        ["Net Cash Flow", `Rs ${fmt(totals.jointIncome - totals.totalExpenses)}`],
      ]
    : [];

  const headers = ["Description", "Amount"];
  const title = "Overall Financial Summary";
  const buildRows = () => rows.map((r) => r as (string | number)[]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          onPrint={() => openPrintWindow(title, headers, buildRows(), dateFrom, dateTo)}
          onExcelExport={() => exportExcel(`${title}.xlsx`, headers, buildRows(), "Overall Summary")}
          onCSVExport={() => exportCSV(`${title}.csv`, headers, buildRows())}
        />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-4 w-48" /></TableCell><TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell></TableRow>)
            ) : rows.map(([label, value], i) => (
              <TableRow key={label} className={i === rows.length - 1 ? "border-t-2 font-bold" : ""}>
                <TableCell className={`text-sm ${i >= rows.length - 2 ? "font-semibold" : ""}`}>{label}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${i >= rows.length - 2 ? "font-bold" : ""} ${label === "Net Cash Flow" ? (totals && totals.jointIncome - totals.totalExpenses >= 0 ? "text-emerald-600" : "text-red-600") : ""}`}>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Monthly breakdown table */}
      {(monthly?.months.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-xs">Month</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Investments</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Direct Exp.</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Petty Cash</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Acct. Exp.</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Joint Income</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Total Expenses</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(monthly?.months ?? []).map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="text-xs font-medium">{fmtMonth(m.month)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-blue-600">Rs {fmt(m.investments)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-red-600">Rs {fmt(m.directExpenses)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600">Rs {fmt(m.pettyCashGiven)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-violet-600">Rs {fmt(m.accountantExpenses)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">Rs {fmt(m.jointIncome)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">Rs {fmt(m.totalExpenses)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Reports Page ─────────────────────────────────────────────────────────

export function Reports() {
  const { dateFrom: globalDateFrom, dateTo: globalDateTo, label: periodLabel } = usePeriod();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive financial reports, charts, and analytics for Crown King.
            <span className="ml-2 text-foreground font-medium">Period: {periodLabel}</span>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards dateFrom={globalDateFrom || undefined} dateTo={globalDateTo || undefined} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="investments" className="text-xs">Investments</TabsTrigger>
          <TabsTrigger value="direct-expenses" className="text-xs">Direct Expenses</TabsTrigger>
          <TabsTrigger value="petty-cash" className="text-xs">Petty Cash</TabsTrigger>
          <TabsTrigger value="accountant" className="text-xs">Accountant Exp.</TabsTrigger>
          <TabsTrigger value="income" className="text-xs">Joint Income</TabsTrigger>
          <TabsTrigger value="settlement" className="text-xs">Settlement</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Overall Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <AnalyticsDashboard dateFrom={globalDateFrom || undefined} dateTo={globalDateTo || undefined} />
          <Charts dateFrom={globalDateFrom || undefined} dateTo={globalDateTo || undefined} />
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <InvestmentReport />
        </TabsContent>

        <TabsContent value="direct-expenses" className="mt-4">
          <DirectExpenseReport />
        </TabsContent>

        <TabsContent value="petty-cash" className="mt-4">
          <PettyCashReport />
        </TabsContent>

        <TabsContent value="accountant" className="mt-4">
          <AccountantExpenseReport />
        </TabsContent>

        <TabsContent value="income" className="mt-4">
          <JointIncomeReport />
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <SettlementReport />
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <OverallSummaryReport dateFrom={globalDateFrom || undefined} dateTo={globalDateTo || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
