"use client";

import * as React from "react";
import { CalendarDays, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AdminCheckbox } from "./AdminCheckbox";

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
}

export interface Facet {
  id: string;
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** One value at a time; picking closes the popover. */
  single?: boolean;
}

export interface DateRangeValue {
  /** yyyy-mm-dd, as native date inputs give it. */
  from?: string;
  to?: string;
}

export interface AdminFilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Default 250ms. */
    debounceMs?: number;
  };
  facets?: Facet[];
  dateRange?: DateRangeValue & { label?: string; onChange: (range: DateRangeValue) => void };
  /** Shown only while something is applied. */
  onClearAll?: () => void;
  /** Right side: view switch, column picker, export. */
  trailing?: React.ReactNode;
  className?: string;
}

function SearchField({ value, onChange, placeholder, debounceMs = 250 }: NonNullable<AdminFilterBarProps["search"]>) {
  const [draft, setDraft] = React.useState(value);
  const lastSent = React.useRef(value);

  // Follow outside changes (e.g. "Clear all") without echoing them back.
  React.useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setDraft(value);
    }
  }, [value]);

  React.useEffect(() => {
    if (draft === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = draft;
      onChange(draft);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [draft, debounceMs, onChange]);

  return (
    <label className="relative flex h-8 w-full items-center sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full rounded-md border border-input bg-background pl-9 pr-8 text-data placeholder:text-muted-foreground hover:border-foreground/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="absolute right-2 grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/** Applied value shown inside a chip: ink pill, at most two labels then "+N". */
function ValuePill({ labels }: { labels: string[] }) {
  const shown = labels.slice(0, 2).join(", ");
  const more = labels.length - 2;
  return (
    <span className="inline-flex h-5 max-w-48 items-center gap-1 rounded bg-foreground px-2 text-xs font-medium text-background">
      <span className="truncate">{shown}</span>
      {more > 0 && <span className="shrink-0 tabular-nums">+{more}</span>}
    </span>
  );
}

/** Chip frame: dashed when empty, solid with a value and a clear button when applied. */
function ChipFrame({
  label,
  icon: Icon = Plus,
  valueLabels,
  onClear,
  children,
}: {
  label: string;
  icon?: typeof Plus;
  valueLabels: string[];
  onClear: () => void;
  children: React.ReactNode;
}) {
  const applied = valueLabels.length > 0;
  return (
    <Popover>
      <span
        className={cn(
          "inline-flex h-8 items-center rounded-md border bg-background text-data",
          applied ? "border-border" : "border-dashed border-foreground/20",
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-full items-center gap-2 rounded-md px-3 transition-colors duration-150 hover:bg-muted",
              applied ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {!applied && <Icon aria-hidden="true" className="size-3.5" />}
            {label}
            {applied && <ValuePill labels={valueLabels} />}
          </button>
        </PopoverTrigger>
        {applied && (
          <button
            type="button"
            aria-label={`Clear ${label} filter`}
            onClick={onClear}
            className="mr-1 grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </span>
      <PopoverContent data-admin="" align="start" className="w-60 rounded-lg p-1">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function FacetChip({ facet }: { facet: Facet }) {
  const labels = facet.options.filter((o) => facet.selected.includes(o.value)).map((o) => o.label);
  const toggle = (value: string, on: boolean) => {
    if (facet.single) facet.onChange(on ? [value] : []);
    else facet.onChange(on ? [...facet.selected, value] : facet.selected.filter((v) => v !== value));
  };
  return (
    <ChipFrame label={facet.label} valueLabels={labels} onClear={() => facet.onChange([])}>
      <div role="group" aria-label={facet.label} className="flex max-h-72 flex-col overflow-y-auto">
        {facet.options.map((option) => {
          const checked = facet.selected.includes(option.value);
          const id = `${facet.id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex h-8 cursor-pointer items-center gap-3 rounded-md px-2 text-data hover:bg-muted"
            >
              <AdminCheckbox id={id} checked={checked} onCheckedChange={(v) => toggle(option.value, v === true)} />
              <span className="flex-1 truncate">{option.label}</span>
              {option.count !== undefined && (
                <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
              )}
            </label>
          );
        })}
      </div>
    </ChipFrame>
  );
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const fmtDay = (iso?: string) => (iso ? shortDate.format(new Date(`${iso}T00:00:00`)) : "");

function DateRangeChip({ range }: { range: NonNullable<AdminFilterBarProps["dateRange"]> }) {
  const { from, to, onChange, label = "Date" } = range;
  const value = from || to ? [from && to ? `${fmtDay(from)} – ${fmtDay(to)}` : from ? `From ${fmtDay(from)}` : `Until ${fmtDay(to)}`] : [];
  return (
    <ChipFrame label={label} icon={CalendarDays} valueLabels={value} onClear={() => onChange({})}>
      <div className="flex flex-col gap-3 p-2">
        {(["from", "to"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {key === "from" ? "From" : "To"}
            <input
              type="date"
              value={(key === "from" ? from : to) ?? ""}
              min={key === "to" ? from : undefined}
              max={key === "from" ? to : undefined}
              onChange={(e) => onChange({ from, to, [key]: e.target.value || undefined })}
              className="h-8 rounded-md border border-input bg-background px-2 text-data text-foreground tabular-nums"
            />
          </label>
        ))}
      </div>
    </ChipFrame>
  );
}

/** Search, facet chips, a date range and "Clear all" in one row above a table. */
export function AdminFilterBar({ search, facets = [], dateRange, onClearAll, trailing, className }: AdminFilterBarProps) {
  const anyApplied =
    Boolean(search?.value) ||
    facets.some((f) => f.selected.length > 0) ||
    Boolean(dateRange?.from || dateRange?.to);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b px-4 py-3", className)}>
      {search && <SearchField {...search} />}
      {facets.map((facet) => (
        <FacetChip key={facet.id} facet={facet} />
      ))}
      {dateRange && <DateRangeChip range={dateRange} />}
      {onClearAll && anyApplied && (
        <Button variant="ghost" size="xs" onClick={onClearAll}>
          Clear all
        </Button>
      )}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
