import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListJointIncomes,
  useCreateJointIncome,
  useUpdateJointIncome,
  useDeleteJointIncome,
  getListJointIncomesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import type { JointIncome, JointIncomeInput } from "@workspace/api-client-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];

// ── Types ─────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

interface Filters {
  search: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  sortDir: SortDir;
}

const INITIAL_FILTERS: Filters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortDir: "desc",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function filtersToParams(f: Filters) {
  return {
    ...(f.search ? { search: f.search } : {}),
    ...(f.dateFrom ? { dateFrom: f.dateFrom } : {}),
    ...(f.dateTo ? { dateTo: f.dateTo } : {}),
    page: f.page,
    pageSize: f.pageSize,
    sortDir: f.sortDir as "asc" | "desc",
  };
}

// ── Form Dialog ───────────────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  editing: JointIncome | null;
  onSaved: () => void;
}

function FormDialog({ open, onClose, editing, onSaved }: FormDialogProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<JointIncomeInput>({
    receiptNumber: "",
    entryDate: "",
    incomeSource: "",
    description: "",
    amount: 0,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof JointIncomeInput, string>>
  >({});

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          receiptNumber: editing.receiptNumber,
          entryDate: editing.entryDate,
          incomeSource: editing.incomeSource,
          description: editing.description,
          amount: editing.amount,
        });
      } else {
        setForm({
          receiptNumber: "",
          entryDate: "",
          incomeSource: "",
          description: "",
          amount: 0,
        });
      }
      setErrors({});
    }
  }, [open, editing]);

  // Auto-focus receipt number
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => receiptRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  const createMutation = useCreateJointIncome();
  const updateMutation = useUpdateJointIncome();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.receiptNumber?.trim()) e.receiptNumber = "Receipt number is required";
    if (!form.entryDate) e.entryDate = "Date is required";
    if (!form.incomeSource?.trim()) e.incomeSource = "Income source is required";
    if (!form.amount || form.amount <= 0)
      e.amount = "Amount must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body: JointIncomeInput = {
      ...form,
      receiptNumber: form.receiptNumber?.trim() ?? "",
      incomeSource: form.incomeSource?.trim() ?? "",
      description: form.description?.trim() ?? "",
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: body });
        toast({ title: "Income record updated" });
      } else {
        await createMutation.mutateAsync({ data: body });
        toast({ title: "Income record added" });
      }
      onSaved();
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to save income record",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Income Record" : "Add Income Record"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Receipt Number */}
          <div className="space-y-1.5">
            <Label htmlFor="receiptNumber">Receipt Number</Label>
            <Input
              id="receiptNumber"
              ref={receiptRef}
              value={form.receiptNumber ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, receiptNumber: e.target.value }))
              }
              placeholder="e.g. INC-001"
            />
            {errors.receiptNumber && (
              <p className="text-xs text-destructive">{errors.receiptNumber}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="entryDate">Date</Label>
            <Input
              id="entryDate"
              type="date"
              value={form.entryDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, entryDate: e.target.value }))
              }
              className="block"
            />
            {errors.entryDate && (
              <p className="text-xs text-destructive">{errors.entryDate}</p>
            )}
          </div>

          {/* Income Source */}
          <div className="space-y-1.5">
            <Label htmlFor="incomeSource">Income Source</Label>
            <Input
              id="incomeSource"
              value={form.incomeSource ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, incomeSource: e.target.value }))
              }
              placeholder="e.g. Shop No. 3 Rent"
            />
            {errors.incomeSource && (
              <p className="text-xs text-destructive">{errors.incomeSource}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. Monthly rent — July 2026"
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (Rs.)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount === 0 ? "" : form.amount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : editing
                ? "Save Changes"
                : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function JointCompanyIncome() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JointIncome | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = filtersToParams(filters);
  const { data, isLoading, isError } = useListJointIncomes(params);

  const deleteMutation = useDeleteJointIncome();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListJointIncomesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }, [queryClient]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(record: JointIncome) {
    setEditing(record);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast({ title: "Income record deleted" });
      invalidate();
      if (data?.data.length === 1 && filters.page > 1) {
        setFilters((f) => ({ ...f, page: f.page - 1 }));
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete income record",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setFilters(INITIAL_FILTERS);
  }

  const hasActiveFilters =
    filters.search || filters.dateFrom || filters.dateTo;

  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / filters.pageSize) : 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Joint Company Income
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all revenue for the joint company.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Joint Company Income
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">
                Rs. {fmt(summary?.combinedTotal ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Receipt # or description…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Date From */}
            <div className="w-40 space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateFrom: e.target.value,
                    page: 1,
                  }))
                }
              />
            </div>

            {/* Date To */}
            <div className="w-40 space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateTo: e.target.value,
                    page: 1,
                  }))
                }
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6 text-sm text-destructive bg-destructive/10 rounded-md m-4 border border-destructive/20">
              Failed to load income records. Please try again.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-36 font-semibold">
                      Receipt #
                    </TableHead>
                    <TableHead
                      className="w-36 font-semibold cursor-pointer select-none"
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          sortDir: f.sortDir === "asc" ? "desc" : "asc",
                          page: 1,
                        }))
                      }
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {filters.sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="w-44 font-semibold">
                      Income Source
                    </TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="w-36 font-semibold text-right">
                      Amount (Rs.)
                    </TableHead>
                    <TableHead className="w-20 font-semibold text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-12 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : data?.data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground text-sm"
                      >
                        {hasActiveFilters
                          ? "No records match the current filters."
                          : 'No income records yet. Click "Add Record" to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data.map((record) => (
                      <TableRow key={record.id} className="group">
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {record.receiptNumber || "—"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.entryDate}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.incomeSource || (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.description || (
                            <span className="text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          Rs. {fmt(record.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(record.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {!isLoading && (data?.total ?? 0) > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Showing{" "}
                      {Math.min(
                        (filters.page - 1) * filters.pageSize + 1,
                        data?.total ?? 0
                      )}{" "}
                      –{" "}
                      {Math.min(
                        filters.page * filters.pageSize,
                        data?.total ?? 0
                      )}{" "}
                      of {data?.total ?? 0}
                    </span>
                    <Select
                      value={String(filters.pageSize)}
                      onValueChange={(v) =>
                        setFilters((f) => ({
                          ...f,
                          pageSize: Number(v),
                          page: 1,
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={filters.page === 1}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: f.page - 1 }))
                      }
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {filters.page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={filters.page >= totalPages}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: f.page + 1 }))
                      }
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        onSaved={invalidate}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this income record? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
