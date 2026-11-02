import { cn } from "@/lib/utils";

export interface MeterProps {
  value: number;
  max?: number;
  /** Fraction of max at which the fill turns pink to flag it. Default 0.9. */
  hotAt?: number;
  /** Accessible name, e.g. "Tickets sold". */
  label: string;
  className?: string;
}

/** Thin progress bar for sell-through, capacity and quota. Ink fill, pink when hot. */
export function Meter({ value, max = 100, hotAt = 0.9, label, className }: MeterProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const hot = ratio >= hotAt;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full", hot ? "bg-primary" : "bg-foreground")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
