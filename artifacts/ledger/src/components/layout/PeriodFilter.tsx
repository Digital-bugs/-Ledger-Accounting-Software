import { usePeriod, PERIOD_PRESETS, type PeriodPreset } from "@/context/PeriodContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarDays } from "lucide-react";

export function PeriodFilter() {
  const { preset, setPreset, customFrom, customTo, setCustomRange, label } =
    usePeriod();

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      <Select
        value={preset}
        onValueChange={(v) => setPreset(v as PeriodPreset)}
      >
        <SelectTrigger className="h-8 w-44 text-xs border-border bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value} className="text-xs">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" ? (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            className="h-8 w-32 text-xs"
            value={customFrom}
            onChange={(e) => setCustomRange(e.target.value, customTo)}
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            className="h-8 w-32 text-xs"
            value={customTo}
            onChange={(e) => setCustomRange(customFrom, e.target.value)}
            placeholder="To"
          />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}
