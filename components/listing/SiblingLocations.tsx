"use client";

import Link from "next/link";
import { MapPin, Check } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import type { SiblingLocation } from "@/lib/listings/brand-groups";

interface SiblingLocationsProps {
  siblings: SiblingLocation[];
  brandLabel?: string;
}

/**
 * Other outlets in the same brand group. Selecting one navigates to that
 * listing (unlike nested listing_branches, which stay on one page).
 */
export function SiblingLocations({
  siblings,
  brandLabel,
}: SiblingLocationsProps) {
  if (siblings.length <= 1) return null;

  return (
    <section className="space-y-4">
      <PremiumHeading level={2} dense className="text-xl md:text-2xl">
        {brandLabel ? `Other ${brandLabel} locations` : "Other locations"}
      </PremiumHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {siblings.map((sib) => {
          const content = (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                sib.is_current
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{sib.name}</p>
                {sib.address ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {sib.address}
                  </p>
                ) : null}
              </div>
              {sib.is_current ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </div>
          );

          if (sib.is_current) {
            return <li key={sib.id}>{content}</li>;
          }

          return (
            <li key={sib.id}>
              <Link href={`/listing/${sib.slug}`} className="block">
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
