import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ds";
import type { LandingCategory } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

/** Each tile's icon sits at its own small angle, like a sticker. */
/** Phone names that fit one line in the 4-up grid; desktop keeps the full name. */
const PHONE_NAMES: Record<number, string> = { 75: "Food" };

const TILTS = ["-rotate-6", "rotate-[5deg]", "-rotate-[4deg]", "rotate-6", "-rotate-[5deg]", "rotate-[4deg]", "-rotate-6", "rotate-[5deg]"];

/**
 * "Or browse by category": cream tiles with the app's icon art and live place
 * counts. Phones get a 4-up icon grid (icon over name, no heading) so it reads
 * like the app, not a list.
 */
export function LandingCategories({ categories }: { categories: LandingCategory[] }) {
  if (categories.length === 0) return null;

  return (
    // Same bottom spacing as a Section size="md" band, and the same label row as SectionHeader.
    <section aria-labelledby="landing-categories" className="pb-16 md:pb-24">
      <Container>
        <div className="flex items-center gap-3 lg:mb-5">
          <h2
            id="landing-categories"
            className="sr-only flex-1 text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground lg:not-sr-only"
          >
            Or browse by category
          </h2>
          <Link
            href="/listings"
            className="-my-3 hidden items-center gap-1.5 py-3 text-small font-semibold transition-opacity duration-fast hover:opacity-80 lg:inline-flex lg:text-body"
          >
            All categories
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid grid-cols-4 gap-2 lg:gap-4">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link
                href={c.href}
                className="group flex h-full flex-col items-center gap-1.5 rounded-media bg-cream px-0.5 pb-2.5 pt-3 text-center lg:items-start lg:gap-5 lg:rounded-container lg:p-6 lg:text-left"
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
                  {/* One line on every phone: 12px at 390px and up, easing to 11px by 360px. */}
                  <span className="block truncate text-[length:clamp(11px,3.08vw,12px)] font-semibold leading-tight tracking-[-0.01em] lg:text-xl lg:font-bold lg:leading-normal lg:tracking-[-0.02em]">
                    <span className="lg:hidden">{PHONE_NAMES[c.id] ?? c.name}</span>
                    <span className="hidden lg:inline">{c.name}</span>
                  </span>
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
