import { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  format,
} from "date-fns";

export type PeriodPreset =
  | "today"
  | "this-week"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "custom"
  | "all-time";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom", label: "Custom Date Range" },
  { value: "all-time", label: "All Time" },
];

const toIso = (d: Date) => format(d, "yyyy-MM-dd");

function computeDates(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now: Date
): { dateFrom: string; dateTo: string } {
  switch (preset) {
    case "today":
      return { dateFrom: toIso(now), dateTo: toIso(now) };
    case "this-week":
      return {
        dateFrom: toIso(startOfWeek(now, { weekStartsOn: 1 })),
        dateTo: toIso(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case "this-month":
      return {
        dateFrom: toIso(startOfMonth(now)),
        dateTo: toIso(endOfMonth(now)),
      };
    case "last-month": {
      const last = subMonths(now, 1);
      return {
        dateFrom: toIso(startOfMonth(last)),
        dateTo: toIso(endOfMonth(last)),
      };
    }
    case "this-year":
      return {
        dateFrom: toIso(startOfYear(now)),
        dateTo: toIso(endOfYear(now)),
      };
    case "last-year": {
      const lastY = subYears(now, 1);
      return {
        dateFrom: toIso(startOfYear(lastY)),
        dateTo: toIso(endOfYear(lastY)),
      };
    }
    case "custom":
      return { dateFrom: customFrom, dateTo: customTo };
    case "all-time":
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

function computeLabel(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now: Date
): string {
  switch (preset) {
    case "today":
      return format(now, "MMM d, yyyy");
    case "this-week":
      return `${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(now, { weekStartsOn: 1 }), "MMM d")}`;
    case "this-month":
      return format(now, "MMMM yyyy");
    case "last-month":
      return format(subMonths(now, 1), "MMMM yyyy");
    case "this-year":
      return String(now.getFullYear());
    case "last-year":
      return String(now.getFullYear() - 1);
    case "custom":
      return customFrom && customTo
        ? `${customFrom} – ${customTo}`
        : customFrom || customTo || "Custom Range";
    case "all-time":
    default:
      return "All Time";
  }
}

export interface PeriodContextValue {
  preset: PeriodPreset;
  dateFrom: string;
  dateTo: string;
  customFrom: string;
  customTo: string;
  setPreset: (preset: PeriodPreset) => void;
  setCustomRange: (from: string, to: string) => void;
  label: string;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const now = useMemo(() => new Date(), []);

  const [preset, setPresetState] = useState<PeriodPreset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const setPreset = useCallback((p: PeriodPreset) => {
    setPresetState(p);
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPresetState("custom");
  }, []);

  const { dateFrom, dateTo } = useMemo(
    () => computeDates(preset, customFrom, customTo, now),
    [preset, customFrom, customTo, now]
  );

  const label = useMemo(
    () => computeLabel(preset, customFrom, customTo, now),
    [preset, customFrom, customTo, now]
  );

  return (
    <PeriodContext.Provider
      value={{
        preset,
        dateFrom,
        dateTo,
        customFrom,
        customTo,
        setPreset,
        setCustomRange,
        label,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}
