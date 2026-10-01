import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { containerClass, sectionClass } from "@/components/shared/SectionHeading";
import { AccountPanel } from "@/components/homepage/AccountPanel";
import { AppComingSoonCard } from "@/components/homepage/AppComingSoonCard";

/**
 * The page's closing block, kept small so it doesn't compete with the
 * consumer sections above: the visitor's own shortcuts (or a sign-up nudge),
 * then the app and business links side by side.
 */
export function CallToActionSections() {
  return (
    <section className={sectionClass}>
      <div className={`${containerClass} space-y-3 sm:space-y-4`}>
        <AccountPanel />

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <AppComingSoonCard />

          <Link
            href="/get-listed"
            className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 active:opacity-80 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  List your business
                </h2>
                <p className="text-sm text-muted-foreground">
                  Get found by people planning their next outing in Karachi.
                </p>
              </div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Get listed
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
