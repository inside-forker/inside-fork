import Link from "next/link";
import { ChevronRight } from "lucide-react";

type SectionHeadingProps = {
  title: string;
  /** Optional line under the title: context, not decoration. */
  subtitle?: string;
  href?: string;
  actionLabel?: string;
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
}: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
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
export const containerClass = "container mx-auto px-5 sm:px-6 lg:px-8";
