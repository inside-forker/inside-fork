import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  Heart,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  PenLine,
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
        description: "Find places, events and guides from a single search bar.",
        href: "/search",
      },
      {
        icon: BookOpen,
        title: "Local guides",
        description: "Write-ups and roundups from people who know the city.",
        href: "/guides",
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
        icon: PenLine,
        title: "Write for Inside Karachi",
        description: "Apply to become a writer and publish your own guides.",
        href: "/dashboard/writer/apply",
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {feature.href && (
          <ArrowUpRight
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        )}
      </div>
      <h4 className="mt-4 font-semibold text-foreground">{feature.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
    </>
  );

  const className =
    "group block h-full rounded-2xl border border-border/60 bg-card p-5 transition-colors";

  return feature.href ? (
    <Link href={feature.href} className={`${className} hover:border-primary/40`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
            Everything you can do on{" "}
            <span className="gradient-text-primary">Inside Karachi</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            One place to find what&apos;s good, go to it, and get rewarded for
            it. And if you run a business or host events, the tools to be
            found.
          </p>
        </div>

        <div className="space-y-12 sm:space-y-14">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <h3 className="text-lg font-bold text-foreground sm:text-xl">
                  {group.title}
                </h3>
                <p className="text-sm text-muted-foreground">{group.blurb}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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
