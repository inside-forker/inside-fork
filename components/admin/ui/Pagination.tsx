"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Plural noun for the summary, e.g. "events". */
  itemLabel?: string;
  className?: string;
}

/** Page numbers to show: always first and last, a window around the current page, gaps as null. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const fmt = new Intl.NumberFormat("en-PK");

/** "Showing 1–25 of 312 events" plus previous/next and page numbers. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = "results",
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-data text-muted-foreground tabular-nums",
        className,
      )}
    >
      <span>
        Showing {fmt.format(from)}–{fmt.format(to)} of {fmt.format(total)} {itemLabel}
      </span>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "solid" : "ghost"}
                size="xs"
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className="min-w-7 px-2"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
