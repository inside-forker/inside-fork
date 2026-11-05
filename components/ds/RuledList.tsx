import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./Label";

/** Full-width rows separated by hairlines. Replaces most grids of cards. */
export function RuledList({ className, ...props }: ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      className={cn("divide-y divide-border border-y border-border", className)}
      {...props}
    />
  );
}

type RuledListItemProps = {
  title: ReactNode;
  /** Short mono metadata on the right (a date, an area, a count). */
  meta?: ReactNode;
  description?: ReactNode;
  /** When set, the whole row is the link. */
  href?: string;
  className?: string;
};

export function RuledListItem({
  title,
  meta,
  description,
  href,
  className,
}: RuledListItemProps) {
  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <span
          className={cn(
            "font-display text-title",
            href &&
              "transition duration-base ease-standard group-hover:translate-x-1 group-hover:text-primary motion-reduce:transform-none",
          )}
        >
          {title}
        </span>
        {meta ? <Label className="shrink-0">{meta}</Label> : null}
      </div>
      {description ? (
        <p className="mt-2 max-w-prose font-ui text-body text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );

  return (
    <li className={className}>
      {href ? (
        <Link
          href={href}
          className="group flex min-h-11 items-start gap-6 rounded-control py-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:py-8"
        >
          {body}
          <ArrowRight
            aria-hidden="true"
            className="mt-1.5 size-5 shrink-0 text-muted-foreground transition duration-fast ease-standard group-hover:translate-x-1 group-hover:text-primary motion-reduce:transform-none"
          />
        </Link>
      ) : (
        <div className="flex items-start gap-6 py-6 md:py-8">{body}</div>
      )}
    </li>
  );
}
