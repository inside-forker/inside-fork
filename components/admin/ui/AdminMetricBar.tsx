import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Meter } from "./Meter";

export interface AdminMetric {
  label: string;
  value: string | number;
  /** Small suffix after the value, e.g. "%". */
  unit?: string;
  /** Change vs a previous period. `good` decides the colour, `direction` the arrow. */
  delta?: { value: string; direction: "up" | "down" | "flat"; good: boolean };
  /** Muted line under the value, e.g. "vs previous 30 days" or "8 this month". */
  caption?: string;
  meter?: { value: number; max: number; label: string };
  /** Makes the whole cell a link (e.g. to a queue). */
  href?: string;
  /** Pink value for counts that need action. */
  emphasis?: boolean;
}

const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

function Delta({ delta }: { delta: NonNullable<AdminMetric["delta"]> }) {
  const Arrow = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : null;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-semibold tabular-nums",
        delta.direction === "flat"
          ? "bg-muted text-muted-foreground"
          : delta.good
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-foreground",
      )}
    >
      {Arrow && <Arrow aria-hidden="true" className="size-3" />}
      {delta.value}
    </span>
  );
}

function MetricBody({ metric }: { metric: AdminMetric }) {
  return (
    <>
      <span className="text-data font-medium text-muted-foreground">{metric.label}</span>
      <span
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
          metric.emphasis && "text-primary",
        )}
      >
        {metric.value}
        {metric.unit && (
          <span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">
            {metric.unit}
          </span>
        )}
      </span>
      {metric.meter ? (
        <Meter className="mt-3" {...metric.meter} />
      ) : (
        (metric.delta || metric.caption) && (
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {metric.delta && <Delta delta={metric.delta} />}
            {metric.caption}
          </span>
        )
      )}
    </>
  );
}

/**
 * One row of metrics in a single panel, split by hairlines. No icons or
 * sparklines: label, number, and a text change or meter where it means something.
 */
export function AdminMetricBar({
  metrics,
  className,
}: {
  metrics: AdminMetric[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        // gap-px over a border-coloured fill draws hairlines between cells at every breakpoint
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border",
        COLS[Math.min(metrics.length, 5)],
        className,
      )}
    >
      {metrics.map((metric) => {
        const cell = "flex min-w-0 flex-col bg-background px-6 py-4";
        return (
          metric.href ? (
            <Link
              key={metric.label}
              href={metric.href}
              className={cn(cell, "transition-colors duration-150 hover:bg-muted")}
            >
              <MetricBody metric={metric} />
            </Link>
          ) : (
            <div key={metric.label} className={cell}>
              <MetricBody metric={metric} />
            </div>
          )
        );
      })}
    </div>
  );
}
