import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import {
  useBulkImport,
  useCheckImportDuplicates,
  useListPartners,
} from '@workspace/api-client-react';
import type { Partner, BulkImportResult } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleKey =
  | 'investments'
  | 'direct-expenses'
  | 'petty-cash-given'
  | 'accountant-expenses'
  | 'joint-incomes';

type DuplicateAction = 'skip' | 'replace';
type Phase = 'idle' | 'loading' | 'preview' | 'importing' | 'done';

interface ColumnSpec {
  field: string;
  header: string;
  aliases: string[];
  required: boolean;
  display: boolean; // show in preview table
}

interface SheetSpec {
  sheetName: string;
  module: ModuleKey;
  moduleLabel: string;
  columns: ColumnSpec[];
  requiresPartner: boolean;
  requiresIncomeType: boolean;
}

interface ParsedRow {
  rowNum: number;
  receiptNumber: string;
  entryDate: string;
  description: string;
  partnerId: number | null;
  partnerName: string;
  incomeType: string;
  amount: number;
  errors: string[];
  isValid: boolean;
  isDuplicate: boolean;
}

interface ModuleParsedData {
  spec: SheetSpec;
  rows: ParsedRow[];
}

interface ModuleImportResult {
  module: ModuleKey;
  label: string;
  result: BulkImportResult;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_TYPES = ['Rent', 'Office Sale', 'Flat Sale', 'Other'] as const;

const SHEET_SPECS: SheetSpec[] = [
  {
    sheetName: 'Partner Investments',
    module: 'investments',
    moduleLabel: 'Partner Investments',
    requiresPartner: true,
    requiresIncomeType: false,
    columns: [
      { field: 'receiptNumber', header: 'Receipt Number', aliases: ['receipt number', 'receipt no', 'receipt#', 'sr no', 'sl no', 'voucher no'], required: false, display: true },
      { field: 'entryDate',    header: 'Date',           aliases: ['date', 'entry date', 'transaction date'],                                    required: true,  display: true },
      { field: 'description',  header: 'Description',    aliases: ['description', 'desc', 'particulars', 'narration', 'details', 'remarks'],     required: false, display: true },
      { field: 'partner',      header: 'Partner',        aliases: ['partner', 'partner name', 'investor', 'person'],                             required: true,  display: true },
      { field: 'amount',       header: 'Amount',         aliases: ['amount', 'amt', 'rs', 'value', 'total'],                                     required: true,  display: true },
    ],
  },
  {
    sheetName: 'Partner Direct Expenses',
    module: 'direct-expenses',
    moduleLabel: 'Partner Direct Expenses',
    requiresPartner: true,
    requiresIncomeType: false,
    columns: [
      { field: 'receiptNumber', header: 'Receipt Number', aliases: ['receipt number', 'receipt no', 'receipt#', 'sr no', 'sl no', 'voucher no'], required: false, display: true },
      { field: 'entryDate',    header: 'Date',           aliases: ['date', 'entry date', 'transaction date'],                                    required: true,  display: true },
      { field: 'description',  header: 'Description',    aliases: ['description', 'desc', 'particulars', 'narration', 'details', 'remarks'],     required: false, display: true },
      { field: 'partner',      header: 'Partner',        aliases: ['partner', 'partner name', 'investor', 'person'],                             required: true,  display: true },
      { field: 'amount',       header: 'Amount',         aliases: ['amount', 'amt', 'rs', 'value', 'total'],                                     required: true,  display: true },
    ],
  },
  {
    sheetName: 'Petty Cash Given',
    module: 'petty-cash-given',
    moduleLabel: 'Petty Cash Given',
    requiresPartner: true,
    requiresIncomeType: false,
    columns: [
      { field: 'receiptNumber', header: 'Receipt Number', aliases: ['receipt number', 'receipt no', 'receipt#', 'sr no', 'sl no', 'voucher no'], required: false, display: true },
      { field: 'entryDate',    header: 'Date',           aliases: ['date', 'entry date', 'transaction date'],                                    required: true,  display: true },
      { field: 'partner',      header: 'Partner',        aliases: ['partner', 'partner name', 'investor', 'person'],                             required: true,  display: true },
      { field: 'amount',       header: 'Amount',         aliases: ['amount', 'amt', 'rs', 'value', 'total'],                                     required: true,  display: true },
    ],
  },
  {
    sheetName: 'Accountant Expenses',
    module: 'accountant-expenses',
    moduleLabel: 'Accountant Expenses',
    requiresPartner: false,
    requiresIncomeType: false,
    columns: [
      { field: 'receiptNumber', header: 'Receipt Number', aliases: ['receipt number', 'receipt no', 'receipt#', 'sr no', 'sl no', 'voucher no'], required: false, display: true },
      { field: 'entryDate',    header: 'Date',           aliases: ['date', 'entry date', 'transaction date'],                                    required: true,  display: true },
      { field: 'description',  header: 'Description',    aliases: ['description', 'desc', 'particulars', 'narration', 'details', 'remarks'],     required: false, display: true },
      { field: 'amount',       header: 'Amount',         aliases: ['amount', 'amt', 'rs', 'value', 'total'],                                     required: true,  display: true },
    ],
  },
  {
    sheetName: 'Joint Company Income',
    module: 'joint-incomes',
    moduleLabel: 'Joint Company Income',
    requiresPartner: false,
    requiresIncomeType: true,
    columns: [
      { field: 'receiptNumber', header: 'Receipt Number', aliases: ['receipt number', 'receipt no', 'receipt#', 'sr no', 'sl no', 'voucher no'], required: false, display: true },
      { field: 'entryDate',    header: 'Date',           aliases: ['date', 'entry date', 'transaction date'],                                    required: true,  display: true },
      { field: 'incomeType',   header: 'Source',         aliases: ['source', 'income type', 'type', 'category'],                                required: true,  display: true },
      { field: 'description',  header: 'Description',    aliases: ['description', 'desc', 'particulars', 'narration', 'details', 'remarks'],     required: false, display: true },
      { field: 'amount',       header: 'Amount',         aliases: ['amount', 'amt', 'rs', 'value', 'total'],                                     required: true,  display: true },
    ],
  },
];

// ─── Template Generation ──────────────────────────────────────────────────────

function downloadTemplate(partners: Partner[]): void {
  const wb = XLSX.utils.book_new();
  const p1 = partners[0]?.name ?? 'Yasir';
  const p2 = partners[1]?.name ?? 'Khurram';

  const sheets: { name: string; headers: string[]; examples: (string | number)[][] }[] = [
    {
      name: 'Partner Investments',
      headers: ['Receipt Number', 'Date', 'Description', 'Partner', 'Amount'],
      examples: [
        ['INV-001', '2026-01-15', 'Capital investment - Jan', p1, 50000],
        ['INV-002', '2026-01-20', 'Capital investment - Jan', p2, 75000],
      ],
    },
    {
      name: 'Partner Direct Expenses',
      headers: ['Receipt Number', 'Date', 'Description', 'Partner', 'Amount'],
      examples: [
        ['EXP-001', '2026-01-10', 'Office supplies', p1, 5000],
        ['EXP-002', '2026-01-18', 'Furniture purchase', p2, 12000],
      ],
    },
    {
      name: 'Petty Cash Given',
      headers: ['Receipt Number', 'Date', 'Partner', 'Amount'],
      examples: [
        ['PC-001', '2026-01-05', p1, 10000],
        ['PC-002', '2026-01-12', p2, 15000],
      ],
    },
    {
      name: 'Accountant Expenses',
      headers: ['Receipt Number', 'Date', 'Description', 'Amount'],
      examples: [
        ['ACE-001', '2026-01-08', 'Utility bills', 3000],
        ['ACE-002', '2026-01-22', 'Stationery & printing', 800],
      ],
    },
    {
      name: 'Joint Company Income',
      headers: ['Receipt Number', 'Date', 'Source', 'Description', 'Amount'],
      examples: [
        ['JI-001', '2026-01-01', 'Rent', 'Monthly office rent', 100000],
        ['JI-002', '2026-01-15', 'Flat Sale', 'Unit 4B sale proceeds', 2500000],
      ],
    },
  ];

  for (const { name, headers, examples } of sheets) {
    const aoa: (string | number)[][] = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(() => ({ wch: 24 }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  XLSX.writeFile(wb, 'crown-king-import-template.xlsx');
}

// ─── Parsing Utilities ────────────────────────────────────────────────────────

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  // Excel serial date number
  if (typeof val === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) {
        const m = String(d.m).padStart(2, '0');
        const day = String(d.d).padStart(2, '0');
        return `${d.y}-${m}-${day}`;
      }
    } catch {
      // fall through to string parsing
    }
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, a, b, yr] = slash;
    const year = yr.length === 2 ? `20${yr}` : yr;
    const day = parseInt(a, 10) > 12 ? a : b;
    const month = parseInt(a, 10) > 12 ? b : a;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // DD-MM-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, d, m, y] = dash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseAmount(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).replace(/[,\s₹Rs$£€]/gi, '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function findColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').trim().toLowerCase();
    if (aliases.includes(h)) return i;
  }
  return -1;
}

function parseSheet(ws: XLSX.WorkSheet, spec: SheetSpec, partners: Partner[]): ParsedRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    cellDates: true,
    defval: '',
  } as Parameters<typeof XLSX.utils.sheet_to_json>[1]);

  if (raw.length < 2) return [];

  const headerRow = (raw[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
  const colIdx: Record<string, number> = {};
  for (const col of spec.columns) {
    colIdx[col.field] = findColumn(headerRow, col.aliases);
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    const rowNum = i + 1; // row 1 is header; data starts at row 2

    const isEmpty = cells.every((c) => c == null || String(c).trim() === '');
    if (isEmpty) continue;

    const get = (field: string): unknown => {
      const idx = colIdx[field];
      return idx >= 0 ? cells[idx] : '';
    };

    const errors: string[] = [];

    // Receipt Number (optional)
    const receiptNumber = String(get('receiptNumber') ?? '').trim();

    // Date (required)
    const rawDate = get('entryDate');
    const entryDate = parseExcelDate(rawDate);
    if (!entryDate) {
      errors.push(`Invalid date "${rawDate}" — use YYYY-MM-DD (e.g. 2026-01-15)`);
    }

    // Description (optional)
    const description = String(get('description') ?? '').trim();

    // Partner (required for partner modules)
    let partnerId: number | null = null;
    let partnerName = '';
    if (spec.requiresPartner) {
      partnerName = String(get('partner') ?? '').trim();
      if (!partnerName) {
        errors.push('Partner is required');
      } else {
        const found = partners.find(
          (p) => p.name.toLowerCase() === partnerName.toLowerCase()
        );
        if (!found) {
          errors.push(
            `Unknown partner "${partnerName}" — valid names: ${partners.map((p) => p.name).join(', ')}`
          );
        } else {
          partnerId = found.id;
          partnerName = found.name;
        }
      }
    }

    // Source / Income Type (required for joint-incomes)
    let incomeType = '';
    if (spec.requiresIncomeType) {
      const rawType = String(get('incomeType') ?? '').trim();
      if (!rawType) {
        errors.push('Source is required');
      } else {
        const matched = (INCOME_TYPES as readonly string[]).find(
          (t) => t.toLowerCase() === rawType.toLowerCase()
        );
        if (!matched) {
          errors.push(
            `Invalid source "${rawType}" — must be one of: ${INCOME_TYPES.join(', ')}`
          );
        } else {
          incomeType = matched;
        }
      }
    }

    // Amount (required)
    const rawAmount = get('amount');
    const amount = parseAmount(rawAmount);
    if (amount === null) {
      errors.push(`Invalid amount "${rawAmount}" — must be a number`);
    } else if (amount < 0) {
      errors.push('Amount must be non-negative');
    }

    rows.push({
      rowNum,
      receiptNumber,
      entryDate: entryDate ?? String(rawDate ?? ''),
      description,
      partnerId,
      partnerName,
      incomeType,
      amount: amount ?? 0,
      errors,
      isValid: errors.length === 0,
      isDuplicate: false,
    });
  }

  return rows;
}

function parseWorkbook(wb: XLSX.WorkBook, partners: Partner[]): ModuleParsedData[] {
  const result: ModuleParsedData[] = [];
  for (const spec of SHEET_SPECS) {
    const sheetName =
      wb.SheetNames.find((n) => n.trim() === spec.sheetName) ??
      wb.SheetNames.find((n) =>
        n.trim().toLowerCase().includes(spec.sheetName.split(' ')[0].toLowerCase())
      );
    if (!sheetName) continue;
    const rows = parseSheet(wb.Sheets[sheetName], spec, partners);
    if (rows.length > 0) result.push({ spec, rows });
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowStatusIcon({ row }: { row: ParsedRow }) {
  if (!row.isValid) return <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />;
  if (row.isDuplicate) return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
}

function ModuleTab({ data, duplicateAction }: { data: ModuleParsedData; duplicateAction: DuplicateAction }) {
  const valid = data.rows.filter((r) => r.isValid && !r.isDuplicate).length;
  const invalid = data.rows.filter((r) => !r.isValid).length;
  const dupes = data.rows.filter((r) => r.isValid && r.isDuplicate).length;
  const cols = data.spec.columns.filter((c) => c.display);

  return (
    <div className="space-y-3">
      {/* Module stats row */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted font-medium text-muted-foreground">
          {data.rows.length} rows
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          {valid} valid
        </span>
        {invalid > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive font-medium">
            <XCircle className="h-3 w-3" />
            {invalid} invalid
          </span>
        )}
        {dupes > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">
            <AlertTriangle className="h-3 w-3" />
            {dupes} {duplicateAction === 'replace' ? 'will replace' : 'will skip'} (duplicate)
          </span>
        )}
      </div>

      {/* Row table */}
      <div className="rounded-md border overflow-x-auto max-h-72 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-12 text-center text-xs">Row</TableHead>
              <TableHead className="w-7" />
              {cols.map((c) => (
                <TableHead key={c.field} className="text-xs whitespace-nowrap">
                  {c.header}
                </TableHead>
              ))}
              <TableHead className="text-xs">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow
                key={row.rowNum}
                className={cn(
                  !row.isValid && 'bg-destructive/5 hover:bg-destructive/8',
                  row.isValid && row.isDuplicate && 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                )}
              >
                <TableCell className="text-center text-xs text-muted-foreground">{row.rowNum}</TableCell>
                <TableCell>
                  <RowStatusIcon row={row} />
                </TableCell>
                {cols.map((c) => {
                  let val = '';
                  if (c.field === 'receiptNumber') val = row.receiptNumber;
                  else if (c.field === 'entryDate') val = row.entryDate;
                  else if (c.field === 'description') val = row.description;
                  else if (c.field === 'partner') val = row.partnerName;
                  else if (c.field === 'incomeType') val = row.incomeType;
                  else if (c.field === 'amount') val = row.amount ? row.amount.toLocaleString() : '';
                  return (
                    <TableCell key={c.field} className="text-xs max-w-40 truncate">
                      {val || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-xs text-destructive max-w-64">
                  {row.errors.map((e, i) => (
                    <div key={i} className="truncate">{e}</div>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExcelImport() {
  const queryClient = useQueryClient();
  const { data: partnerList = [] } = useListPartners();
  const partners = partnerList as Partner[];
  const bulkImportMutation = useBulkImport();
  const checkDupsMutation = useCheckImportDuplicates();

  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedModules, setParsedModules] = useState<ModuleParsedData[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');
  const [activeTab, setActiveTab] = useState('');
  const [importResults, setImportResults] = useState<ModuleImportResult[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalRows = parsedModules.reduce((s, m) => s + m.rows.length, 0);
  const validRows = parsedModules.reduce(
    (s, m) => s + m.rows.filter((r) => r.isValid && !r.isDuplicate).length, 0
  );
  const invalidRows = parsedModules.reduce(
    (s, m) => s + m.rows.filter((r) => !r.isValid).length, 0
  );
  const duplicateRows = parsedModules.reduce(
    (s, m) => s + m.rows.filter((r) => r.isValid && r.isDuplicate).length, 0
  );
  const importableCount = duplicateAction === 'replace'
    ? validRows + duplicateRows
    : validRows;

  // ── Load file ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        alert('Please upload an .xlsx, .xls, or .csv file.');
        return;
      }
      setPhase('loading');
      setFileName(file.name);
      setImportError(null);

      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const modules = parseWorkbook(wb, partners);

        if (modules.length === 0) {
          setImportError(
            'No matching sheets found. Make sure you are using the downloaded template ' +
            `with sheets named: ${SHEET_SPECS.map((s) => s.sheetName).join(', ')}.`
          );
          setPhase('idle');
          return;
        }

        // Check for duplicates
        const checks = modules
          .map((m) => ({
            module: m.spec.module,
            receiptNumbers: m.rows
              .filter((r) => r.isValid && r.receiptNumber)
              .map((r) => r.receiptNumber),
          }))
          .filter((c) => c.receiptNumbers.length > 0);

        let existingByModule: Record<string, Set<string>> = {};

        if (checks.length > 0) {
          const dupResult = await checkDupsMutation.mutateAsync({
            data: { checks },
          });
          for (const item of dupResult.results) {
            existingByModule[item.module] = new Set(
              item.existingReceiptNumbers.map((r) => r.toLowerCase().trim())
            );
          }
        }

        // Apply duplicate flags
        const markedModules: ModuleParsedData[] = modules.map((m) => {
          const existing = existingByModule[m.spec.module] ?? new Set<string>();
          return {
            ...m,
            rows: m.rows.map((row) => ({
              ...row,
              isDuplicate:
                row.isValid &&
                !!row.receiptNumber &&
                existing.has(row.receiptNumber.toLowerCase().trim()),
            })),
          };
        });

        setParsedModules(markedModules);
        setActiveTab(markedModules[0]?.spec.module ?? '');
        setPhase('preview');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setImportError(`Failed to process file: ${msg}`);
        setPhase('idle');
      }
    },
    [partners, checkDupsMutation]
  );

  // ── Confirm Import ────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setPhase('importing');
    setImportError(null);
    const results: ModuleImportResult[] = [];

    try {
      for (const m of parsedModules) {
        const rowsToSend = m.rows
          .filter((r) => r.isValid)
          .map((r) => ({
            receiptNumber: r.receiptNumber || null,
            entryDate: r.entryDate,
            description: r.description || null,
            partnerId: r.partnerId,
            incomeType: r.incomeType || null,
            amount: r.amount,
          }));

        if (rowsToSend.length === 0) continue;

        const result = await bulkImportMutation.mutateAsync({
          data: {
            module: m.spec.module,
            rows: rowsToSend,
            duplicateAction,
          },
        });

        results.push({ module: m.spec.module, label: m.spec.moduleLabel, result });
      }

      setImportResults(results);
      // Invalidate all cached queries so every page re-fetches fresh data
      queryClient.invalidateQueries();
      setPhase('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Import failed: ${msg}`);
      setPhase('preview');
    }
  }, [parsedModules, duplicateAction, bulkImportMutation, queryClient]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPhase('idle');
    setFileName('');
    setParsedModules([]);
    setDuplicateAction('skip');
    setActiveTab('');
    setImportResults([]);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Excel Data Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import records from Excel directly into the database. All imported records behave
            exactly like manually entered ones.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          {(phase === 'preview' || phase === 'done') && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(partners)}
            disabled={partners.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </div>

      {/* Global error */}
      {importError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      {/* ── Template Info Card (idle only) ───────────────────────────────── */}
      {phase === 'idle' && (
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-2">How to import data:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click <span className="font-medium text-foreground">Download Template</span> to get the Excel file</li>
                  <li>Fill in your data across the 5 sheets (one per module)</li>
                  <li>Upload the filled file below</li>
                  <li>Review the preview and confirm the import</li>
                </ol>
              </div>
              <div className="sm:text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground mb-1.5">Template includes:</p>
                <div className="flex flex-wrap sm:flex-col gap-1">
                  {SHEET_SPECS.map((s) => (
                    <Badge key={s.module} variant="secondary" className="text-xs">
                      {s.sheetName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Upload Zone ──────────────────────────────────────────────────── */}
      {(phase === 'idle' || phase === 'loading') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Upload Filled Template</CardTitle>
            <CardDescription>Supports .xlsx and .xls files exported from Microsoft Excel.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors select-none',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30',
                phase === 'loading' && 'pointer-events-none opacity-60'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => phase === 'idle' && fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
            >
              {phase === 'loading' ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Parsing {fileName} and checking for duplicates…
                  </p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    Drag &amp; drop your filled template here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse — .xlsx and .xls supported
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Import Preview ────────────────────────────────────────────────── */}
      {(phase === 'preview' || phase === 'importing') && parsedModules.length > 0 && (
        <>
          {/* File info + stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Import Preview</CardTitle>
                  <CardDescription className="mt-0.5 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {fileName}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {parsedModules.length} module{parsedModules.length > 1 ? 's' : ''} detected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold font-mono text-foreground">{totalRows}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Rows</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold font-mono text-green-600">{validRows}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Valid Rows</div>
                </div>
                <div className={cn(
                  "rounded-lg border bg-card p-3 text-center",
                  invalidRows > 0 && "border-destructive/40 bg-destructive/5"
                )}>
                  <div className={cn("text-2xl font-bold font-mono", invalidRows > 0 ? "text-destructive" : "text-muted-foreground")}>
                    {invalidRows}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Invalid Rows</div>
                </div>
                <div className={cn(
                  "rounded-lg border bg-card p-3 text-center",
                  duplicateRows > 0 && "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20"
                )}>
                  <div className={cn("text-2xl font-bold font-mono", duplicateRows > 0 ? "text-amber-600" : "text-muted-foreground")}>
                    {duplicateRows}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Duplicate Rows</div>
                </div>
              </div>

              {/* Duplicate action */}
              {duplicateRows > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3">
                    <AlertTriangle className="inline h-4 w-4 mr-1.5 align-text-top" />
                    {duplicateRows} row{duplicateRows > 1 ? 's' : ''} already exist in the database
                    (matched by Receipt Number). What should happen?
                  </p>
                  <RadioGroup
                    value={duplicateAction}
                    onValueChange={(v) => setDuplicateAction(v as DuplicateAction)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="skip" id="dup-skip" />
                      <Label htmlFor="dup-skip" className="cursor-pointer font-medium">
                        Skip — keep existing records, do not re-import
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="replace" id="dup-replace" />
                      <Label htmlFor="dup-replace" className="cursor-pointer font-medium">
                        Replace — delete existing and re-import with new values
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Invalid rows notice */}
              {invalidRows > 0 && (
                <Alert variant="destructive" className="py-2">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {invalidRows} invalid row{invalidRows > 1 ? 's' : ''} will be skipped.
                    Fix errors in your file and re-upload to include them.
                    See the module tabs below for exact row numbers and reasons.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Module tabs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Row Details by Module</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Valid</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Duplicate</span>
                  <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Invalid (will be skipped)</span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 flex-wrap h-auto gap-1">
                  {parsedModules.map((m) => {
                    const errCount = m.rows.filter((r) => !r.isValid).length;
                    const dupCount = m.rows.filter((r) => r.isValid && r.isDuplicate).length;
                    return (
                      <TabsTrigger key={m.spec.module} value={m.spec.module} className="gap-1.5">
                        {m.spec.moduleLabel}
                        {errCount > 0 && (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">{errCount}</Badge>
                        )}
                        {dupCount > 0 && errCount === 0 && (
                          <Badge className="h-4 px-1 text-[10px] bg-amber-500 hover:bg-amber-500">{dupCount}</Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {parsedModules.map((m) => (
                  <TabsContent key={m.spec.module} value={m.spec.module}>
                    <ModuleTab data={m} duplicateAction={duplicateAction} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Confirm Import */}
          <Card>
            <CardContent className="pt-5">
              {phase === 'importing' ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                  <span>Saving records to database — please do not close this page…</span>
                </div>
              ) : importableCount === 0 ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    No importable rows. All rows are either invalid or will be skipped as duplicates.
                    Fix errors in your file and re-upload.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Ready to import{' '}
                      <span className="text-primary font-bold">
                        {importableCount.toLocaleString()} record{importableCount > 1 ? 's' : ''}
                      </span>{' '}
                      across{' '}
                      {parsedModules.filter((m) =>
                        m.rows.some((r) => r.isValid && (duplicateAction === 'replace' || !r.isDuplicate))
                      ).length}{' '}
                      module{parsedModules.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Records save directly to the database — dashboard and all modules update instantly.
                      {invalidRows > 0 && ` ${invalidRows} invalid rows will be skipped.`}
                    </p>
                  </div>
                  <Button size="lg" onClick={handleImport} className="flex-shrink-0">
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Confirm Import
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Import Results ────────────────────────────────────────────────── */}
      {phase === 'done' && importResults.length > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
            <CardDescription>
              All records have been saved to the database. The dashboard, reports, and all modules
              have been refreshed automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importResults.map(({ label, result }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 text-sm"
                >
                  <span className="font-medium text-foreground">{label}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {result.imported > 0 && (
                      <span className="text-green-600 font-medium">
                        +{result.imported} imported
                      </span>
                    )}
                    {result.replaced > 0 && (
                      <span className="text-blue-600 font-medium">
                        {result.replaced} replaced
                      </span>
                    )}
                    {result.skipped > 0 && (
                      <span>{result.skipped} skipped</span>
                    )}
                    {result.errors.length > 0 && (
                      <span className="text-destructive">{result.errors.length} errors</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-module errors from API (if any) */}
            {importResults.some((r) => r.result.errors.length > 0) && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-destructive">API validation errors:</p>
                {importResults.flatMap(({ label, result }) =>
                  result.errors.map((e, i) => (
                    <div key={`${label}-${i}`} className="text-xs text-destructive bg-destructive/5 px-3 py-1 rounded">
                      <span className="font-medium">{label}</span> — Row {e.row}: {e.message}
                    </div>
                  ))
                )}
              </div>
            )}

            <Button variant="outline" size="sm" className="mt-4" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
