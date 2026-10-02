import Link from "next/link";
import { ChevronRight } from "lucide-react";

type SectionHeadingProps = {
  title: string;
  /** Optional line under the title: context, not decoration. */
  subtitle?: string;
  href?: string;
  actionLabel?: string;
  /** "center" stacks title, subtitle and link centred from lg up, for
   * sections whose content is itself centred. */
  align?: "start" | "center";
};

/**
 * Section heading, mirroring the mobile app's `SectionHeading`:
 * a left-aligned bold title, an optional muted subtitle, and a pink
 * "View all" link on the right. One treatment for every section.
 */
export function SectionHeading({
  title,
  subtitle,
  href,
  actionLabel = "View all",
  align = "start",
}: SectionHeadingProps) {
  return (
    <div
      className={`mb-4 flex ${
        subtitle ? "flex-col sm:flex-row sm:items-end" : "items-end"
      } justify-between gap-2 sm:gap-3 ${
        align === "center" ? "lg:mb-6 lg:flex-col lg:items-center lg:gap-2 lg:text-center" : ""
      }`}
    >
      <div className="min-w-0">
        <h2 className="whitespace-nowrap text-lg font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary hover:opacity-80 self-start sm:self-auto"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

type CalloutHeadingProps = {
  /** The bold line. */
  title: string;
  /** The lighter line under it. */
  subtitle: string;
  href?: string;
  actionLabel?: string;
};

/**
 * The mobile app's callout: a thin bar on the left, a bold statement and a
 * lighter line under it. Used where a section opens with a sentence rather
 * than a label.
 */
export function CalloutHeading({
  title,
  subtitle,
  href,
  actionLabel = "View all",
}: CalloutHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0 border-l-4 border-border pl-4">
        <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        <p className="mt-0.5 text-base text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary hover:opacity-80"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** Shared section shell: one vertical rhythm and one gutter for every section. */
export const sectionClass = "py-8 sm:py-10";
export const containerClass = "mx-auto max-w-7xl px-6 lg:px-8";
