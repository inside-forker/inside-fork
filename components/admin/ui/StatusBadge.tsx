import { cn } from "@/lib/utils";

export type StatusTone = "positive" | "attention" | "negative" | "neutral" | "ended";

/** Default status → tone map. Pass `tone` to override for a one-off status. */
const STATUS_TONES: Record<string, StatusTone> = {
  active: "positive",
  approved: "positive",
  checked_in: "positive",
  completed: "positive",
  live: "positive",
  paid: "positive",
  published: "positive",
  verified: "positive",
  expiring: "attention",
  in_review: "attention",
  pending: "attention",
  unpaid: "attention",
  banned: "negative",
  failed: "negative",
  flagged: "negative",
  refunded: "negative",
  rejected: "negative",
  suspended: "negative",
  draft: "neutral",
  inactive: "neutral",
  scheduled: "neutral",
  archived: "ended",
  cancelled: "ended",
  ended: "ended",
  expired: "ended",
};

const TONE_CLASSES: Record<StatusTone, { tag: string; text: string; dot: string }> = {
  positive: { tag: "bg-success/10", text: "text-success", dot: "bg-success" },
  attention: { tag: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  // Red text fails AA on white today (--destructive is 3.76:1), so the label stays ink.
  negative: { tag: "bg-destructive/10", text: "text-foreground", dot: "bg-destructive" },
  neutral: { tag: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  ended: {
    tag: "ring-1 ring-inset ring-border",
    text: "text-muted-foreground",
    dot: "ring-1 ring-inset ring-muted-foreground",
  },
};

function humanize(status: string) {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status.toLowerCase()] ?? "neutral";
}

export interface StatusBadgeProps {
  status: string;
  /** Overrides the default map. */
  tone?: StatusTone;
  /** Overrides the humanized status text. */
  label?: string;
  /** `tag` (tinted, default) for tables and headers; `inline` for dense text runs. */
  variant?: "tag" | "inline";
  className?: string;
}

/** Status as a dot plus a label, so it never relies on colour alone. */
export function StatusBadge({
  status,
  tone,
  label,
  variant = "tag",
  className,
}: StatusBadgeProps) {
  const classes = TONE_CLASSES[tone ?? statusTone(status)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold",
        variant === "tag" && cn("h-6 rounded-md px-2", classes.tag),
        classes.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", classes.dot)} />
      {label ?? humanize(status)}
    </span>
  );
}
