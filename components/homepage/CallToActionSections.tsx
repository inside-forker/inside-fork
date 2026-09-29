import Link from "next/link";
import { Button } from "@/components/ui/button";
import { containerClass, sectionClass } from "@/components/homepage/SectionHeading";

const memberPerks = ["Save your favorites", "Deals & card offers", "Earn XP & ranks"];

const businessPerks = [
  "Increase visibility and foot traffic",
  "Manage reviews and customer feedback",
  "Promote events and special offers",
  "Access detailed analytics and insights",
];

function PerkList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CallToActionSections() {
  return (
    <section className={sectionClass}>
      <div className={`${containerClass} grid gap-4 lg:grid-cols-2`}>
        {/* Join */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Join the community
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Start your Karachi adventure
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Create a free account to save favorites, book event tickets, unlock
            deals and earn XP as you explore the city.
          </p>
          <div className="mt-5">
            <PerkList items={memberPerks} />
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl font-semibold active:opacity-80">
              <Link href="/signup">Sign up free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl font-semibold active:opacity-80"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* List your business */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            For business owners
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            List your business
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Get discovered by food lovers, event-goers and local explorers
            looking for their next favorite spot in Karachi. Apply online in a
            few minutes.
          </p>
          <div className="mt-5">
            <PerkList items={businessPerks} />
          </div>
          <div className="mt-auto pt-6">
            <Button asChild size="lg" className="rounded-xl font-semibold active:opacity-80">
              <Link href="/get-listed">Get listed</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
