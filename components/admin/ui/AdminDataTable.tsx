"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns2, SearchX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AdminCheckbox } from "./AdminCheckbox";
import { EmptyState, ErrorState } from "./EmptyState";
import { Pagination, type PaginationProps } from "./Pagination";

export interface AdminColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Right-align numbers, money and counts (they also get tabular figures). */
  align?: "start" | "end";
  sortable?: boolean;
  /** Can be hidden from the column picker. Default true. */
  hideable?: boolean;
  /**
   * Phone layout (below md): 1 = title line, 2 = meta line, 3 = hidden. Default 2.
   * Desktop always shows every visible column.
   */
  priority?: 1 | 2 | 3;
  /** Width/visibility classes for the column, e.g. "w-40" or "hidden lg:table-cell". */
  className?: string;
}

export type SortState = { id: string; dir: "asc" | "desc" };

export interface AdminDataTableProps<T> {
  /** Accessible name, e.g. "Events". */
  label: string;
  rows: T[];
  columns: AdminColumn<T>[];
  getRowId: (row: T) => string;
  /** loading = first load (skeleton). refreshing = refetch with rows kept (2px bar). */
  state?: "loading" | "ready" | "refreshing" | "error";
  error?: { title?: string; description?: string; onRetry: () => void };
  /** Nothing exists yet. */
  empty?: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  /** Filters exclude everything. Shown instead of `empty` when set. */
  filteredEmpty?: { title?: string; description?: string; onClear: () => void };
  /** Filter bar above the table. */
  toolbar?: React.ReactNode;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selection?: {
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
    /** Buttons for the ink bar, built with <BulkAction>. Receives the selected ids. */
    actions: (ids: string[]) => React.ReactNode;
    /** Plural noun for "3 events selected". */
    noun?: string;
  };
  /** Opens a row (Enter, or a click on the row outside its controls). */
  onRowOpen?: (row: T) => void;
  /** Per-row controls, revealed on hover or focus (always visible on touch). */
  rowActions?: (row: T) => React.ReactNode;
  /** Column ids hidden by the column picker. */
  hiddenColumns?: string[];
  pagination?: PaginationProps;
  density?: "default" | "compact";
  /** Rows to sketch while loading. Default 6. */
  skeletonRows?: number;
  className?: string;
}

const SKELETON_WIDTHS = ["w-3/5", "w-2/5", "w-3/4", "w-1/2", "w-2/3"];

/** A button sized and coloured for the ink bulk-action bar. */
export function BulkAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="xs"
      className={cn(
        "border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background",
        className,
      )}
      {...props}
    />
  );
}

/** Column picker for a toolbar's trailing slot. */
export function ColumnPicker<T>({
  columns,
  hidden,
  onChange,
}: {
  columns: AdminColumn<T>[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const hideable = columns.filter((c) => c.hideable !== false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-xs" aria-label="Choose columns">
          <Columns2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent data-admin="" align="end" className="w-56 rounded-lg p-1">
        <p className="px-2 py-2 text-xs font-medium text-muted-foreground">Columns</p>
        {hideable.map((c) => {
          const id = `col-${c.id}`;
          const shown = !hidden.includes(c.id);
          return (
            <label key={c.id} htmlFor={id} className="flex h-8 cursor-pointer items-center gap-3 rounded-md px-2 text-data hover:bg-muted">
              <AdminCheckbox
                id={id}
                checked={shown}
                onCheckedChange={(v) => onChange(v === true ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
              />
              {c.header}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label, [role=checkbox], [role=menuitem]"));
}

/**
 * Presentational admin table. The caller owns fetching, sorting, filtering and
 * paging; this renders them: sticky header, tabular numbers, selection with an ink
 * bulk bar, hover actions, skeleton/refetch/empty/error states, stacked rows on phones.
 */
export function AdminDataTable<T>({
  label,
  rows,
  columns,
  getRowId,
  state = "ready",
  error,
  empty,
  filteredEmpty,
  toolbar,
  sort,
  onSortChange,
  selection,
  onRowOpen,
  rowActions,
  hiddenColumns = [],
  pagination,
  density = "default",
  skeletonRows = 6,
  className,
}: AdminDataTableProps<T>) {
  const visible = columns.filter((c) => !hiddenColumns.includes(c.id));
  const rowRefs = React.useRef<(HTMLTableRowElement | null)[]>([]);
  const [activeRow, setActiveRow] = React.useState(0);

  const pageIds = rows.map(getRowId);
  const selectedCount = selection?.selected.size ?? 0;
  const pageSelected = selection ? pageIds.filter((id) => selection.selected.has(id)).length : 0;
  const headerChecked: boolean | "indeterminate" =
    pageSelected === 0 ? false : pageSelected === pageIds.length ? true : "indeterminate";

  const setSelected = (ids: string[], on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    selection.onChange(next);
  };

  const toggleSort = (col: AdminColumn<T>) => {
    if (!onSortChange) return;
    const dir = sort?.id === col.id && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ id: col.id, dir });
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    if (event.target !== event.currentTarget) return;
    const move = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (move) {
      event.preventDefault();
      const next = Math.min(Math.max(index + move, 0), rows.length - 1);
      setActiveRow(next);
      rowRefs.current[next]?.focus();
    } else if (event.key === " " && selection) {
      event.preventDefault();
      const id = getRowId(row);
      setSelected([id], !selection.selected.has(id));
    } else if (event.key === "Enter" && onRowOpen) {
      event.preventDefault();
      onRowOpen(row);
    }
  };

  const cellPad = density === "compact" ? "px-4 py-2" : "px-4 py-3";
  const showRows = state === "ready" || state === "refreshing";
  const isEmpty = showRows && rows.length === 0;
  const colCount = visible.length + (selection ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className={cn("min-w-0 overflow-clip rounded-lg border bg-card", className)}>
      {toolbar}

      {selection && selectedCount > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 bg-foreground px-4 py-3 text-background duration-150 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:slide-in-from-bottom-0"
        >
          <AdminCheckbox
            aria-label="Select all on this page"
            checked={headerChecked}
            onCheckedChange={() => setSelected(pageIds, headerChecked !== true)}
          />
          <span aria-live="polite" className="mr-2 text-data font-semibold tabular-nums">
            {selectedCount} {selection.noun ?? "items"} selected
          </span>
          {selection.actions([...selection.selected])}
          <BulkAction className="ml-auto" onClick={() => selection.onChange(new Set())}>
            Clear
          </BulkAction>
        </div>
      )}

      {state === "refreshing" && (
        <div role="progressbar" aria-label={`Refreshing ${label.toLowerCase()}`} className="relative h-0.5 overflow-hidden bg-muted">
          <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate bg-primary motion-reduce:animate-none" />
        </div>
      )}

      {state === "error" && error ? (
        <ErrorState title={error.title} description={error.description} onRetry={error.onRetry} />
      ) : isEmpty && filteredEmpty ? (
        <EmptyState
          icon={SearchX}
          title={filteredEmpty.title ?? `No ${label.toLowerCase()} match your filters`}
          description={filteredEmpty.description}
          action={<Button variant="outline" onClick={filteredEmpty.onClear}>Clear filters</Button>}
        />
      ) : isEmpty && empty ? (
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} />
      ) : (
        <>
          {/* Desktop and tablet: a real table. Sticky header needs no scroll container, so wide tables scroll only below lg. */}
          <div className="hidden max-lg:overflow-x-auto md:block">
            <table aria-label={label} aria-busy={state !== "ready"} className="w-full border-collapse text-data">
              <thead>
                <tr>
                  {selection && (
                    <th scope="col" className="sticky top-[var(--admin-sticky-top,0px)] z-10 w-12 border-b bg-muted px-4">
                      <AdminCheckbox
                        aria-label="Select all on this page"
                        checked={headerChecked}
                        disabled={!showRows || rows.length === 0}
                        onCheckedChange={() => setSelected(pageIds, headerChecked !== true)}
                      />
                    </th>
                  )}
                  {visible.map((col) => {
                    const sorted = sort?.id === col.id ? sort.dir : undefined;
                    const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
                    return (
                      <th
                        key={col.id}
                        scope="col"
                        aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                        className={cn(
                          "sticky top-[var(--admin-sticky-top,0px)] z-10 h-10 whitespace-nowrap border-b bg-muted px-4 text-xs font-medium text-muted-foreground",
                          col.align === "end" ? "text-right" : "text-left",
                          col.className,
                        )}
                      >
                        {col.sortable && onSortChange ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className={cn(
                              "group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground",
                              sorted && "text-foreground",
                              col.align === "end" && "flex-row-reverse",
                            )}
                          >
                            {col.header}
                            <SortIcon
                              aria-hidden="true"
                              className={cn("size-3.5", !sorted && "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")}
                            />
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                  {rowActions && (
                    <th scope="col" className="sticky top-[var(--admin-sticky-top,0px)] z-10 border-b bg-muted px-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {state === "loading"
                  ? Array.from({ length: skeletonRows }, (_, r) => (
                      <tr key={r} className="border-b last:border-b-0">
                        {Array.from({ length: colCount }, (_, c) => {
                          const col = visible[c - (selection ? 1 : 0)];
                          return (
                            <td key={c} className={cellPad}>
                              <div
                                className={cn(
                                  "h-3 animate-pulse rounded bg-muted motion-reduce:animate-none",
                                  selection && c === 0 ? "size-4" : SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length],
                                  col?.align === "end" && "ml-auto",
                                )}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  : rows.map((row, index) => {
                      const id = getRowId(row);
                      const isSelected = selection?.selected.has(id) ?? false;
                      return (
                        <tr
                          key={id}
                          ref={(el) => {
                            rowRefs.current[index] = el;
                          }}
                          tabIndex={index === activeRow ? 0 : -1}
                          aria-selected={selection ? isSelected : undefined}
                          onFocus={() => setActiveRow(index)}
                          onKeyDown={(e) => onRowKeyDown(e, index, row)}
                          onClick={(e) => onRowOpen && !isInteractive(e.target) && onRowOpen(row)}
                          className={cn(
                            "group border-b outline-none transition-colors duration-150 last:border-b-0 hover:bg-muted/50",
                            "focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                            onRowOpen && "cursor-pointer",
                            isSelected && "bg-primary/5 hover:bg-primary/5",
                          )}
                        >
                          {selection && (
                            <td className={cn(cellPad, "w-12", isSelected && "shadow-[inset_3px_0_0_hsl(var(--primary))]")}>
                              <AdminCheckbox
                                aria-label="Select row"
                                checked={isSelected}
                                onCheckedChange={(v) => setSelected([id], v === true)}
                              />
                            </td>
                          )}
                          {visible.map((col) => (
                            <td
                              key={col.id}
                              className={cn(
                                cellPad,
                                "align-middle",
                                col.align === "end" && "whitespace-nowrap text-right tabular-nums",
                                col.className,
                              )}
                            >
                              {col.cell(row)}
                            </td>
                          ))}
                          {rowActions && (
                            <td className={cn(cellPad, "w-px whitespace-nowrap text-right")}>
                              <div className="inline-flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
                                {rowActions(row)}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Phones: stacked rows. Priority 1 columns form the title line, 2 the meta line. */}
          <ul aria-label={label} aria-busy={state !== "ready"} className="divide-y md:hidden">
            {state === "loading"
              ? Array.from({ length: skeletonRows }, (_, r) => (
                  <li key={r} className="flex flex-col gap-2 px-4 py-4">
                    <div className="h-3 w-3/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                  </li>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  const isSelected = selection?.selected.has(id) ?? false;
                  const title = visible.filter((c) => c.priority === 1);
                  const meta = visible.filter((c) => (c.priority ?? 2) === 2);
                  return (
                    <li key={id} className={cn("flex items-start gap-3 px-4 py-4", isSelected && "bg-primary/5")}>
                      {selection && (
                        <AdminCheckbox
                          aria-label="Select row"
                          className="mt-1"
                          checked={isSelected}
                          onCheckedChange={(v) => setSelected([id], v === true)}
                        />
                      )}
                      <div
                        className={cn("flex min-w-0 flex-1 flex-col gap-2", onRowOpen && "cursor-pointer")}
                        onClick={(e) => onRowOpen && !isInteractive(e.target) && onRowOpen(row)}
                      >
                        {title.map((c) => (
                          <div key={c.id} className="min-w-0 text-sm">
                            {c.cell(row)}
                          </div>
                        ))}
                        {meta.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-data text-muted-foreground">
                            {meta.map((c) => (
                              <span key={c.id} className={cn(c.align === "end" && "tabular-nums")}>
                                {c.cell(row)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {rowActions && <div className="flex shrink-0 items-center gap-1">{rowActions(row)}</div>}
                    </li>
                  );
                })}
          </ul>
        </>
      )}

      {pagination && showRows && rows.length > 0 && <Pagination {...pagination} />}
    </div>
  );
}
