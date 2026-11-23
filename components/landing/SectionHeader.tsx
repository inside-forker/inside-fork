import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  /** The h2's id, for the section's aria-labelledby. */
  id: string;
  /** The section's name, e.g. "What's on". */
  eyebrow: string;
  title: string;
  subline?: string;
  /** A link, or a button when the action stays on the page. */
  action?: { href: string; label: string } | { onClick: () => void; label: string };
  className?: string;
};

const ACTION_CLASS =
  "-my-3 inline-flex items-center gap-1.5 py-3 text-small font-semibold transition-opacity duration-fast hover:opacity-80 lg:text-body";

/**
 * The one header every landing section uses: the section's name with an
 * optional "All …" link on one row, then the heading, then an optional
 * one-line subline. Colours come from the band's tone.
 */
export function SectionHeader({ id, eyebrow, title, subline, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 lg:mb-9", className)}>
      <div className="flex items-center gap-3">
        <p className="flex-1 text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">{eyebrow}</p>
        {action &&
          ("href" in action ? (
            <Link href={action.href} className={ACTION_CLASS}>
              {action.label}
              <ArrowRight className="h-4 w-4 lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                ACTION_CLASS,
                "rounded-control outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              {action.label}
              <ArrowRight className="h-4 w-4 lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
            </button>
          ))}
      </div>
      <h2
        id={id}
        className="mt-2 text-[28px] font-bold leading-8 tracking-[-0.03em] lg:mt-3 lg:text-5xl lg:leading-[52px]"
      >
        {title}
      </h2>
      {subline && (
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground lg:mt-3 lg:max-w-[640px] lg:text-body-lg">
          {subline}
        </p>
      )}
    </div>
  );
}
