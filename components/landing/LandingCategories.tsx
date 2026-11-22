import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ds";
import type { LandingCategory } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

/** Each tile's icon sits at its own small angle, like a sticker. */
const TILTS = ["-rotate-6", "rotate-[5deg]", "-rotate-[4deg]", "rotate-6", "-rotate-[5deg]", "rotate-[4deg]", "-rotate-6", "rotate-[5deg]"];

/**
 * "Or browse by category": cream tiles with the app's icon art and live place
 * counts. Phones get a 4-up icon grid (icon over name, no heading) so it reads
 * like the app, not a list.
 */
export function LandingCategories({ categories }: { categories: LandingCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="landing-categories" className="pb-10 lg:pb-24">
      <Container>
        <div className="flex items-center gap-3 lg:mb-3 lg:gap-4">
          <h2
            id="landing-categories"
            className="sr-only flex-1 text-label font-semibold uppercase lg:not-sr-only tracking-[0.06em] text-muted-foreground"
          >
            Or browse by category
          </h2>
          <Link
            href="/listings"
            className="hidden min-h-11 items-center gap-2 text-small font-semibold transition-colors lg:inline-flex duration-fast hover:text-primary lg:text-[15px]"
          >
            <span className="lg:hidden">All</span>
            <span className="hidden lg:inline">All categories</span>
            <ArrowRight className="hidden h-[18px] w-[18px] lg:block" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid grid-cols-4 gap-2 lg:gap-4">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link
                href={c.href}
                className="group flex h-full flex-col items-center gap-1.5 rounded-media bg-cream px-1 pb-2.5 pt-3 text-center lg:items-start lg:gap-5 lg:rounded-container lg:p-6 lg:text-left"
              >
                <Image
                  src={c.icon}
                  alt=""
                  width={80}
                  height={80}
                  className={cn(
                    "h-11 w-11 shrink-0 transition-transform duration-base ease-standard group-hover:scale-105 motion-reduce:transition-none lg:h-20 lg:w-20",
                    TILTS[i % TILTS.length],
                  )}
                />
                <span className="w-full min-w-0">
                  <span className="block text-label font-semibold leading-tight lg:truncate lg:text-xl lg:font-bold lg:leading-normal lg:tracking-[-0.02em]">{c.name}</span>
                  <span className="hidden text-label text-muted-foreground lg:mt-0.5 lg:block lg:text-small">{c.countLabel}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
