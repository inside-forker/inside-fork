import Link from "next/link";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/homepage/SectionHeading";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Heart,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  Share2,
  SlidersHorizontal,
  QrCode,
  ScanLine,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  Tag,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
};

type FeatureGroup = {
  title: string;
  blurb: string;
  features: Feature[];
};

const groups: FeatureGroup[] = [
  {
    title: "Discover the city",
    blurb: "Everything worth knowing about Karachi, in one place.",
    features: [
      {
        icon: LayoutGrid,
        title: "Places in every category",
        description:
          "Food, shopping, beauty, health, fitness, services and more, with branches, menus and opening hours.",
        href: "/listings",
      },
      {
        icon: MapPin,
        title: "Nearby & on the map",
        description: "See what's around you and filter by area.",
        href: "/listings",
      },
      {
        icon: Search,
        title: "One search for everything",
        description: "Find places and events from a single search bar.",
        href: "/search",
      },
      {
        icon: SlidersHorizontal,
        title: "Filter what matters",
        description: "Narrow results by area, category and rating.",
        href: "/listings",
      },
    ],
  },
  {
    title: "Events & tickets",
    blurb: "From discovery to the gate, without the WhatsApp chase.",
    features: [
      {
        icon: CalendarDays,
        title: "What's on in Karachi",
        description: "Concerts, pop-ups, workshops and more, all in one calendar.",
        href: "/events",
      },
      {
        icon: CreditCard,
        title: "Buy tickets online",
        description: "Secure checkout for ticketed events.",
        href: "/events",
      },
      {
        icon: QrCode,
        title: "QR ticket passes",
        description: "Every ticket gets its own signed QR pass, ready to scan at entry.",
      },
      {
        icon: Users,
        title: "Follow organizers",
        description: "Keep up with the people behind the events you love.",
      },
    ],
  },
  {
    title: "Save & earn",
    blurb: "Get more out of every outing.",
    features: [
      {
        icon: Tag,
        title: "Deals & coupons",
        description: "Offers from local businesses, plus deals tied to your bank cards.",
      },
      {
        icon: Trophy,
        title: "XP, ranks & challenges",
        description: "Earn XP as you explore, climb ranks and top the leaderboard.",
        href: "/leaderboard",
      },
      {
        icon: UserPlus,
        title: "Invite friends",
        description: "Bring friends along with referral invites.",
      },
      {
        icon: Sparkles,
        title: "Recommendations for you",
        description: "Picks based on your interests and what you save.",
      },
    ],
  },
  {
    title: "Community",
    blurb: "Built by the people who live here.",
    features: [
      {
        icon: MessageSquareText,
        title: "Reviews with photos",
        description: "Honest reviews from locals, with photos.",
      },
      {
        icon: Heart,
        title: "Favorites",
        description: "Save places and events to come back to.",
      },
      {
        icon: Bell,
        title: "Reminders & alerts",
        description: "Event reminders and updates you choose to get.",
      },
      {
        icon: Share2,
        title: "Share finds",
        description: "Send places and events to friends in a tap.",
      },
    ],
  },
  {
    title: "For businesses & organizers",
    blurb: "Tools to get found and fill the room.",
    features: [
      {
        icon: Building2,
        title: "Get listed",
        description: "Put your business in front of people looking for it, with membership plans for extra reach.",
        href: "/get-listed",
      },
      {
        icon: BarChart3,
        title: "Dashboard & analytics",
        description: "Track views, reviews and redemptions for your listings.",
      },
      {
        icon: Ticket,
        title: "Sell tickets",
        description: "Ticket types, bookings and attendee lists for your events.",
      },
      {
        icon: ScanLine,
        title: "Gate check-in",
        description: "Scan QR passes at the door, even when the signal drops.",
      },
    ],
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {feature.href && (
          <ArrowUpRight
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        )}
      </div>
      <h4 className="mt-3 text-sm font-semibold tracking-tight text-foreground sm:mt-4 sm:text-base">
        {feature.title}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {feature.description}
      </p>
    </>
  );

  const className =
    "group block h-full rounded-2xl border border-border bg-card p-4 transition-colors sm:p-5";

  return feature.href ? (
    <Link
      href={feature.href}
      className={`${className} hover:border-primary/40 active:opacity-80`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function FeaturesSection() {
  return (
    <section className={`${sectionClass} bg-muted`}>
      <div className={containerClass}>
        <SectionHeading
          title="Everything you can do"
          subtitle="Find what's good, go to it, and get rewarded for it. Plus the tools to be found if you run a business or host events."
        />

        <div className="space-y-8 sm:space-y-10">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                  {group.title}
                </h3>
                <p className="text-sm text-muted-foreground">{group.blurb}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {group.features.map((feature) => (
                  <FeatureCard key={feature.title} feature={feature} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
