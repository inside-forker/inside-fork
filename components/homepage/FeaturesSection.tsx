import type { ReactNode } from "react";
import Link from "next/link";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";
import { ArrowRight, QrCode, Search, Ticket } from "lucide-react";

type Benefit = {
  title: string;
  description: string;
  href: string;
  action: string;
  /** A small picture of the feature, shown rather than described. */
  preview: ReactNode;
};

const chip =
  "rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground";

/** A search in progress, with the filters places can be narrowed by. */
function SearchPreview() {
  return (
    <div className="w-full max-w-[240px] space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">cafés</span>
        <span className="-ml-1 h-3.5 w-px bg-primary motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          Open now
        </span>
        <span className={chip}>Card offers</span>
        <span className={chip}>Top rated</span>
      </div>
    </div>
  );
}

/** A ticket stub with its QR pass, as issued at checkout. */
function TicketPreview() {
  return (
    <div className="flex w-full max-w-[240px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex w-14 shrink-0 items-center justify-center bg-primary text-primary-foreground">
        <Ticket className="h-6 w-6" />
      </div>
      {/* The tear line; its notches hang off it so they always sit on it */}
      <div className="relative flex flex-1 items-center justify-between gap-2 border-l border-dashed border-border px-3 py-3">
        <span className="absolute -top-2 left-0 h-4 w-4 -translate-x-1/2 rounded-full border border-border bg-cream" />
        <span className="absolute -bottom-2 left-0 h-4 w-4 -translate-x-1/2 rounded-full border border-border bg-cream" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Your ticket</p>
          <p className="text-[11px] text-muted-foreground">Scan at the gate</p>
        </div>
        <QrCode className="h-8 w-8 shrink-0 text-foreground" />
      </div>
    </div>
  );
}

/** Progress toward the next rank (Explorer → Local at 250 XP) and what earns it. */
function XpPreview() {
  return (
    <div className="w-full max-w-[240px] rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Explorer</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">180 / 250 XP</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[72%] rounded-full bg-primary" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          +10 review
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          +30 event
        </span>
      </div>
    </div>
  );
}

// Three short promises, each with a picture of the thing itself. Feature
// detail (QR passes, recommendations, analytics) lives where it's used.
const benefits: Benefit[] = [
  {
    title: "Find your next spot",
    description: "Places, menus, hours and card discounts, all in one search.",
    href: "/listings",
    action: "Browse places",
    preview: <SearchPreview />,
  },
  {
    title: "Make your next plan",
    description: "Book event tickets online and get a QR pass for the gate.",
    href: "/events",
    action: "See what's on",
    preview: <TicketPreview />,
  },
  {
    title: "Make every visit count",
    description: "Review places, save favourites and earn XP as you go.",
    href: "/leaderboard",
    action: "See the leaderboard",
    preview: <XpPreview />,
  },
];

function BenefitCard({ benefit }: { benefit: Benefit }) {
  return (
    <Link
      href={benefit.href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40 active:opacity-80"
    >
      <div
        aria-hidden
        className="flex h-32 items-center justify-center border-b border-border bg-cream px-5 sm:h-36"
      >
        {benefit.preview}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {benefit.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {benefit.description}
        </p>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-primary">
          {benefit.action}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

export function FeaturesSection() {
  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading title="Make the most of Inside" />
        {/* Swipeable row on phones so three cards don't stack into a wall;
            a plain three-up grid from tablet up */}
        <ul className="scrollbar-hide -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
          {benefits.map((benefit) => (
            <li key={benefit.title} className="w-[82%] shrink-0 snap-start sm:w-auto">
              <BenefitCard benefit={benefit} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
