import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import {
  useBulkImport,
  useListPartners,
  BulkImportInputModule,
} from '@workspace/api-client-react';
import type {
  BulkImportResult,
  BulkImportInput,
  ImportRow,
  Partner,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportModule =
  | 'investments'
  | 'direct-expenses'
  | 'petty-cash-given'
  | 'accountant-expenses'
  | 'joint-incomes';

interface ModuleOption {
  value: ImportModule;
  label: string;
  requiresPartner: boolean;
  requiresIncomeType: boolean;
}

const MODULE_OPTIONS: ModuleOption[] = [
  {
    value: 'investments',
    label: 'Partner Investments',
    requiresPartner: true,
    requiresIncomeType: false,
  },
  {
    value: 'direct-expenses',
    label: 'Partner Direct Expenses',
    requiresPartner: true,
    requiresIncomeType: false,
  },
  {
    value: 'petty-cash-given',
    label: 'Petty Cash Given',
    requiresPartner: true,
    requiresIncomeType: false,
  },
  {
    value: 'accountant-expenses',
    label: 'Accountant Expenses',
    requiresPartner: false,
    requiresIncomeType: false,
  },
  {
    value: 'joint-incomes',
    label: 'Joint Company Income',
    requiresPartner: false,
    requiresIncomeType: true,
  },
];

const INCOME_TYPES = ['Rent', 'Office Sale', 'Flat Sale', 'Other'];
const PAGE_SIZE = 50;

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

interface ValidatedRow {
  rowNum: number;
  cells: string[];
  receiptNumber: string;
  entryDate: string;
  description: string;
  partnerId: number | null;
  incomeType: string;
  amount: number;
  errors: string[];
  valid: boolean;
  empty: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseDate(val: string): string | null {
  if (!val?.trim()) return null;
  const v = val.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // MM/DD/YYYY or DD/MM/YYYY
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, a, b, yr] = slash;
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
  }
  // DD-MM-YYYY
  const dash = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, d, m, y] = dash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Fallback via Date parse
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function parseAmount(val: string): number | null {
  if (!val?.trim()) return null;
  const n = parseFloat(val.replace(/[,\s$£€₹]/g, '').trim());
  return isNaN(n) ? null : n;
}

function autoDetectColumns(headers: string[]): Record<string, number | null> {
  const map: Record<string, number | null> = {
    receiptNumber: null,
    entryDate: null,
    description: null,
    partner: null,
    incomeType: null,
    amount: null,
  };
  headers.forEach((h, i) => {
    const n = (h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      ['receipt', 'receiptno', 'receiptnum', 'srno', 'slno', 'voucher', 'voucherno'].some(
        (k) => n.includes(k)
      )
    )
      map.receiptNumber ??= i;
    else if (
      ['date', 'entrydate', 'transdate', 'dt'].some((k) => n.includes(k))
    )
      map.entryDate ??= i;
    else if (
      ['desc', 'description', 'narration', 'particulars', 'details', 'remarks'].some(
        (k) => n.includes(k)
      )
    )
      map.description ??= i;
    else if (
      ['partner', 'partnername', 'investor', 'person'].some((k) => n.includes(k))
    )
      map.partner ??= i;
    else if (
      ['incometype', 'type', 'category', 'source'].some((k) => n.includes(k))
    )
      map.incomeType ??= i;
    else if (
      ['amount', 'amt', 'value', 'rs', 'total', 'credit', 'debit'].some(
        (k) => n.includes(k)
      )
    )
      map.amount ??= i;
  });
  return map;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExcelImport() {
  const queryClient = useQueryClient();
  const { data: partnerList = [] } = useListPartners();
  const partners = partnerList as Partner[];
  const bulkImportMutation = useBulkImport();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedModule, setSelectedModule] =
    useState<ImportModule>('investments');
  const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState<Record<string, number | null>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const moduleConfig = MODULE_OPTIONS.find((m) => m.value === selectedModule)!;

  // ── Derived ────────────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    if (!rawData.length) return [];
    const maxCols = Math.max(...rawData.slice(0, 10).map((r) => r.length), 0);
    return Array.from({ length: maxCols }, (_, i) => ({
      index: i,
      label:
        hasHeader && rawData[0]?.[i]?.trim()
          ? rawData[0][i].trim()
          : `Col ${colLetter(i)}`,
    }));
  }, [rawData, hasHeader]);

  const relevantFields = useMemo((): FieldDef[] => {
    return [
      { key: 'receiptNumber', label: 'Receipt Number', required: false },
      { key: 'entryDate', label: 'Date', required: true },
      { key: 'description', label: 'Description', required: false },
      ...(moduleConfig.requiresPartner
        ? [{ key: 'partner', label: 'Partner', required: true }]
        : []),
      ...(moduleConfig.requiresIncomeType
        ? [{ key: 'incomeType', label: 'Income Type', required: true }]
        : []),
      { key: 'amount', label: 'Amount', required: true },
    ];
  }, [moduleConfig]);

  const validRows = useMemo(
    () => validatedRows.filter((r) => !r.empty && r.valid),
    [validatedRows]
  );
  const invalidRows = useMemo(
    () => validatedRows.filter((r) => !r.empty && !r.valid),
    [validatedRows]
  );
  const emptyCount = useMemo(
    () => validatedRows.filter((r) => r.empty).length,
    [validatedRows]
  );

  const displaySource = showOnlyErrors
    ? invalidRows
    : validatedRows.filter((r) => !r.empty);
  const displayRows = displaySource.slice(
    previewPage * PAGE_SIZE,
    (previewPage + 1) * PAGE_SIZE
  );
  const totalDisplayPages = Math.ceil(displaySource.length / PAGE_SIZE);

  const hasData = rawData.length > 0;
  const hasMapped = Object.values(colMap).some((v) => v !== null);
  const hasValidated = validatedRows.length > 0;

  // ── Validate rows ──────────────────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    const dataRows = hasHeader ? rawData.slice(1) : rawData;
    const results: ValidatedRow[] = dataRows.map((cells, idx) => {
      const rowNum = idx + (hasHeader ? 2 : 1);
      const empty = cells.every((c) => !c?.trim());
      if (empty) {
        return {
          rowNum,
          cells,
          receiptNumber: '',
          entryDate: '',
          description: '',
          partnerId: null,
          incomeType: '',
          amount: 0,
          errors: [],
          valid: false,
          empty: true,
        };
      }

      const get = (field: string) => {
        const col = colMap[field];
        return col !== null && col !== undefined
          ? (cells[col] ?? '').trim()
          : '';
      };

      const errors: string[] = [];
      const receiptNumber = get('receiptNumber');
      const rawDateVal = get('entryDate');
      const description = get('description');
      const partnerName = get('partner');
      const incomeType = get('incomeType');
      const rawAmountVal = get('amount');

      // Validate date
      const entryDate = parseDate(rawDateVal);
      if (!entryDate) errors.push(`Invalid date "${rawDateVal}"`);

      // Validate amount
      const amount = parseAmount(rawAmountVal);
      if (amount === null) errors.push(`Invalid amount "${rawAmountVal}"`);
      else if (amount < 0) errors.push('Amount must be non-negative');

      // Validate partner
      let partnerId: number | null = null;
      if (moduleConfig.requiresPartner) {
        if (!partnerName) {
          errors.push('Partner is required');
        } else {
          const p = partners.find(
            (x) => x.name.toLowerCase() === partnerName.toLowerCase()
          );
          if (!p) {
            errors.push(
              `Unknown partner "${partnerName}" — valid: ${partners.map((x) => x.name).join(', ')}`
            );
          } else {
            partnerId = p.id;
          }
        }
      }

      // Validate income type
      if (moduleConfig.requiresIncomeType) {
        if (!incomeType) {
          errors.push('Income Type is required');
        } else if (!INCOME_TYPES.includes(incomeType)) {
          errors.push(
            `Invalid income type "${incomeType}" — valid: ${INCOME_TYPES.join(', ')}`
          );
        }
      }

      return {
        rowNum,
        cells,
        receiptNumber,
        entryDate: entryDate ?? rawDateVal,
        description,
        partnerId,
        incomeType,
        amount: amount ?? 0,
        errors,
        valid: errors.length === 0,
        empty: false,
      };
    });
    setValidatedRows(results);
    setPreviewPage(0);
    setShowOnlyErrors(false);
  }, [rawData, hasHeader, colMap, moduleConfig, partners]);

  // Auto-validate when mapping changes
  useEffect(() => {
    if (rawData.length > 0 && hasMapped) {
      handleValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colMap, hasHeader]);

  // ── Parse file ─────────────────────────────────────────────────────────────
  const parseFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setImportResult(null);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {
        type: 'array',
        raw: false,
        dateNF: 'YYYY-MM-DD',
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false,
        dateNF: 'YYYY-MM-DD',
        defval: '',
      }) as string[][];
      const normalised = data.map((row) =>
        row.map((c) => String(c ?? '').trim())
      );
      setRawData(normalised);
      setValidatedRows([]);
      if (normalised.length > 0 && hasHeader) {
        setColMap(autoDetectColumns(normalised[0]));
      } else {
        setColMap({});
      }
    },
    [hasHeader]
  );

  // ── Parse paste ────────────────────────────────────────────────────────────
  const parsePaste = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const rows = text
        .trim()
        .split('\n')
        .map((l) => l.split('\t').map((c) => c.trim()));
      setRawData(rows);
      setValidatedRows([]);
      setImportResult(null);
      if (rows.length > 0 && hasHeader) {
        setColMap(autoDetectColumns(rows[0]));
      } else {
        setColMap({});
      }
    },
    [hasHeader]
  );

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!validRows.length) return;
    setIsImporting(true);
    setImportProgress(10);

    const progressInterval = setInterval(() => {
      setImportProgress((prev) => (prev < 85 ? prev + 7 : prev));
    }, 250);

    const rows: ImportRow[] = validRows.map((r) => ({
      receiptNumber: r.receiptNumber || null,
      entryDate: r.entryDate,
      description: r.description || null,
      partnerId: r.partnerId,
      incomeType: r.incomeType || null,
      amount: r.amount,
    }));

    bulkImportMutation.mutate(
      {
        data: {
          module: selectedModule as BulkImportInput['module'],
          rows,
        } satisfies BulkImportInput,
      },
      {
        onSuccess: (result) => {
          clearInterval(progressInterval);
          setImportProgress(100);
          setImportResult(result);
          // Invalidate all queries so dashboard and every module page refreshes
          queryClient.invalidateQueries();
          setTimeout(() => setIsImporting(false), 300);
        },
        onError: (err: unknown) => {
          clearInterval(progressInterval);
          setIsImporting(false);
          setImportProgress(0);
          console.error('Import failed', err);
        },
      }
    );
  }, [validRows, selectedModule, bulkImportMutation, queryClient]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRawData([]);
    setColMap({});
    setValidatedRows([]);
    setImportResult(null);
    setImportProgress(0);
    setFileName('');
    setPasteText('');
    setPreviewPage(0);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Excel Data Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk-import records from Excel (.xlsx), CSV, or by pasting directly
            from Microsoft Excel.
          </p>
        </div>
        {hasData && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
        )}
      </div>

      {/* Import result banner */}
      {importResult && (
        <Alert className="border-green-300 bg-green-50 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <span className="font-semibold text-green-700">
              Import complete.
            </span>{' '}
            <span className="text-green-700">
              {importResult.imported.toLocaleString()} records imported,{' '}
              {importResult.skipped} skipped (duplicates or empty).
            </span>
            {importResult.errors.length > 0 && (
              <span className="text-amber-600 ml-1">
                {importResult.errors.length} rows had validation errors and
                were skipped.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Step 1: Module & Data Source ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Step 1 — Select Module &amp; Data Source
          </CardTitle>
          <CardDescription>
            Choose which ledger module to import into, then upload a file or
            paste rows from Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Module selector */}
          <div className="space-y-1.5">
            <Label htmlFor="module-select">Import Into</Label>
            <Select
              value={selectedModule}
              onValueChange={(v) => {
                setSelectedModule(v as ImportModule);
                handleReset();
              }}
            >
              <SelectTrigger id="module-select" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input method */}
          <Tabs
            value={inputMethod}
            onValueChange={(v) => {
              setInputMethod(v as 'file' | 'paste');
              handleReset();
            }}
          >
            <TabsList>
              <TabsTrigger value="file">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="paste">
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Paste from Excel
              </TabsTrigger>
            </TabsList>

            {/* File upload */}
            <TabsContent value="file" className="mt-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors select-none',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) parseFile(file);
                }}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    fileRef.current?.click();
                }}
              >
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Drag &amp; drop an Excel or CSV file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx, .xls, and .csv — up to tens of thousands of
                  rows
                </p>
                {fileName && (
                  <Badge variant="secondary" className="mt-3 text-xs">
                    {fileName}
                  </Badge>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parseFile(f);
                  }}
                />
              </div>
            </TabsContent>

            {/* Paste */}
            <TabsContent value="paste" className="mt-4 space-y-2">
              <Label className="text-sm text-muted-foreground">
                Select cells in Excel (including headers), copy with Ctrl+C,
                then paste below.
              </Label>
              <Textarea
                placeholder="Paste Excel data here (Ctrl+V)…"
                className="min-h-36 font-mono text-xs resize-y"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  // Let textarea update first, then parse
                  setTimeout(() => parsePaste(text), 0);
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!pasteText.trim()}
                onClick={() => parsePaste(pasteText)}
              >
                Parse Pasted Data
              </Button>
            </TabsContent>
          </Tabs>

          {/* Data summary row */}
          {hasData && (
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {rawData.length.toLocaleString()} total rows detected
              </Badge>
              <Badge variant="outline" className="text-xs">
                {columns.length} columns
              </Badge>
              <div className="flex items-center gap-2 ml-auto">
                <Switch
                  id="has-header"
                  checked={hasHeader}
                  onCheckedChange={(v) => {
                    setHasHeader(v);
                    setColMap({});
                    setValidatedRows([]);
                  }}
                />
                <Label htmlFor="has-header" className="text-sm cursor-pointer">
                  First row is header
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Column Mapping ──────────────────────────────────────── */}
      {hasData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Step 2 — Map Columns
            </CardTitle>
            <CardDescription>
              Assign each required field to the matching Excel column. Common
              headers are auto-detected.
              {moduleConfig.requiresPartner && (
                <span className="text-amber-600 block mt-0.5">
                  Partner must match exactly:{' '}
                  {partners.map((p) => p.name).join(', ')}.
                </span>
              )}
              {moduleConfig.requiresIncomeType && (
                <span className="text-amber-600 block mt-0.5">
                  Income Type must be one of: {INCOME_TYPES.join(', ')}.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {relevantFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-sm">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Select
                    value={
                      colMap[field.key] !== null &&
                      colMap[field.key] !== undefined
                        ? String(colMap[field.key])
                        : '__none__'
                    }
                    onValueChange={(v) =>
                      setColMap((prev) => ({
                        ...prev,
                        [field.key]: v === '__none__' ? null : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="— Not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not mapped —</SelectItem>
                      {columns.map((col) => (
                        <SelectItem
                          key={col.index}
                          value={String(col.index)}
                        >
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleValidate}
              disabled={!hasMapped}
            >
              Validate {hasHeader ? rawData.length - 1 : rawData.length} Rows
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Preview & Validate ─────────────────────────────────── */}
      {hasValidated && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  Step 3 — Preview &amp; Validate
                </CardTitle>
                <CardDescription className="mt-1">
                  Review mapped rows before importing. Fix errors in the
                  source file and re-upload if needed.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-sm shrink-0">
                <span className="flex items-center gap-1.5 font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {validRows.length.toLocaleString()} valid
                </span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 font-medium text-destructive">
                    <XCircle className="h-4 w-4" />
                    {invalidRows.length} errors
                  </span>
                )}
                {emptyCount > 0 && (
                  <span className="text-muted-foreground">
                    {emptyCount} empty
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {invalidRows.length > 0 && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-errors"
                  checked={showOnlyErrors}
                  onCheckedChange={(v) => {
                    setShowOnlyErrors(v);
                    setPreviewPage(0);
                  }}
                />
                <Label
                  htmlFor="show-errors"
                  className="text-sm cursor-pointer"
                >
                  Show only rows with errors
                </Label>
              </div>
            )}

            {/* Preview table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">Row</TableHead>
                    <TableHead className="w-8" />
                    {relevantFields.map((f) => (
                      <TableHead key={f.key} className="whitespace-nowrap">
                        {f.label}
                      </TableHead>
                    ))}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={relevantFields.length + 3}
                        className="text-center py-8 text-muted-foreground text-sm"
                      >
                        No rows to display
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayRows.map((row) => {
                      const get = (field: string) => {
                        const col = colMap[field];
                        return col !== null && col !== undefined
                          ? (row.cells[col] ?? '')
                          : '';
                      };
                      return (
                        <TableRow
                          key={row.rowNum}
                          className={cn(
                            !row.valid && 'bg-destructive/5 hover:bg-destructive/10'
                          )}
                        >
                          <TableCell className="text-center text-muted-foreground text-xs">
                            {row.rowNum}
                          </TableCell>
                          <TableCell>
                            {row.valid ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </TableCell>
                          {relevantFields.map((f) => (
                            <TableCell
                              key={f.key}
                              className="text-xs max-w-36 truncate"
                            >
                              {get(f.key)}
                            </TableCell>
                          ))}
                          <TableCell className="text-xs text-destructive max-w-56 truncate">
                            {row.errors.join(' · ')}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalDisplayPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  Page {previewPage + 1} of {totalDisplayPages} (
                  {displaySource.length.toLocaleString()} rows)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={previewPage === 0}
                    onClick={() => setPreviewPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={previewPage >= totalDisplayPages - 1}
                    onClick={() => setPreviewPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No valid rows warning */}
      {hasValidated && validRows.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid rows found. Fix the errors above and re-validate, or
            adjust the column mapping.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Step 4: Import ─────────────────────────────────────────────── */}
      {hasValidated && validRows.length > 0 && !importResult && (
        <Card>
          <CardContent className="pt-6">
            {isImporting ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Importing{' '}
                  {validRows.length.toLocaleString()} records into{' '}
                  {
                    MODULE_OPTIONS.find((m) => m.value === selectedModule)
                      ?.label
                  }
                  …
                </div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {importProgress}% — please wait
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Ready to import{' '}
                    <span className="text-primary font-semibold">
                      {validRows.length.toLocaleString()} valid records
                    </span>{' '}
                    into{' '}
                    {
                      MODULE_OPTIONS.find((m) => m.value === selectedModule)
                        ?.label
                    }
                    .
                  </p>
                  {invalidRows.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {invalidRows.length} invalid rows will be skipped.
                      Dashboard totals update automatically after import.
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  size="lg"
                >
                  Import {validRows.length.toLocaleString()} Records
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
