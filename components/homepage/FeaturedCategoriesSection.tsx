"use client";

import React from "react";
import Link from "next/link";
import { getCategoryIcon } from "@/components/admin/CategoryIconSelect";
import type { GradientStyle } from "@/lib/utils/gradientStyles";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

interface Category {
  id: number;
  name: string;
  slug: string;
  published_listing_count: number;
  icon_name: string | null;
  gradient_style: GradientStyle | null;
  category_type: string;
}

interface FeaturedCategoriesSectionProps {
  categories: Category[];
}

export function FeaturedCategoriesSection({
  categories,
}: FeaturedCategoriesSectionProps) {
  if (categories.length === 0) return null;

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading title="Explore categories" href="/listings" />

        {/* Circle index, same shape as the app's category grid. On desktop the
            columns stretch to fill the row, so a short list isn't left-heavy. */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]">
          {categories.map((category) => {
            const IconComponent = getCategoryIcon(category.icon_name);
            const count = category.published_listing_count ?? 0;
            const isEvent =
              category.category_type === "event" || category.slug === "events";
            const href = isEvent ? "/events" : `/listings/${category.slug}`;
            const noun = isEvent ? "event" : "place";

            return (
              <Link
                key={category.id}
                href={href}
                className="group flex flex-col items-center gap-2 text-center active:opacity-80"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/15 sm:h-20 sm:w-20">
                  <IconComponent className="h-7 w-7 text-primary sm:h-8 sm:w-8" aria-hidden />
                </span>
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                  {category.name}
                </span>
                {count > 0 ? (
                  <span className="-mt-1 text-xs text-muted-foreground">
                    {count} {noun}
                    {count === 1 ? "" : "s"}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
