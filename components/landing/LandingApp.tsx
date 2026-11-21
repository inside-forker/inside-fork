import Image from "next/image";
import { Bell, Star, Tag, Ticket, ChevronLeft, Search } from "lucide-react";
import { Container, Section } from "@/components/ds";
import type { EventListItem } from "@/lib/events/list";
import type { LandingCategory } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

const APP_STORE_URL = "https://apps.apple.com/app/id6809263698";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.inside.cityguide";

const FEATURES = [
  { icon: Ticket, text: "Tickets that work offline" },
  { icon: Tag, text: "Card offers wherever you are" },
  { icon: Star, text: "XP for every place you try" },
  { icon: Bell, text: "Reminders before your events" },
];

const TABS = ["nav-home", "nav-discounts-inactive", "nav-events-inactive", "nav-notifications-inactive", "nav-profile"];

// Device illustration sizes, not UI radii.
const FRAME = "absolute box-border bg-border p-2.5"; // the phone body
const HOME_FRAME = "h-[640px] w-[292px] rounded-[48px]"; // design-lint-disable-line
const HOME_SCREEN = "rounded-[38px]"; // design-lint-disable-line
const TICKET_FRAME = "h-[600px] w-[272px] rounded-[46px]"; // design-lint-disable-line
const TICKET_SCREEN = "rounded-[36px]"; // design-lint-disable-line

/** A decorative QR code (not scannable), as on the app's offline ticket. */
const QR_PATH =
  "M1 1h7v1h-7zM11 1h3v1h-3zM15 1h7v1h-7zM1 2h1v1h-1zM7 2h1v1h-1zM9 2h1v1h-1zM11 2h1v1h-1zM13 2h1v1h-1zM15 2h1v1h-1zM21 2h1v1h-1zM1 3h1v1h-1zM3 3h3v1h-3zM7 3h1v1h-1zM9 3h1v1h-1zM13 3h1v1h-1zM15 3h1v1h-1zM17 3h3v1h-3zM21 3h1v1h-1zM1 4h1v1h-1zM3 4h3v1h-3zM7 4h1v1h-1zM11 4h1v1h-1zM15 4h1v1h-1zM17 4h3v1h-3zM21 4h1v1h-1zM1 5h1v1h-1zM3 5h3v1h-3zM7 5h1v1h-1zM9 5h3v1h-3zM13 5h1v1h-1zM15 5h1v1h-1zM17 5h3v1h-3zM21 5h1v1h-1zM1 6h1v1h-1zM7 6h1v1h-1zM10 6h1v1h-1zM15 6h1v1h-1zM21 6h1v1h-1zM1 7h7v1h-7zM9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM15 7h7v1h-7zM9 8h1v1h-1zM12 8h1v1h-1zM1 9h1v1h-1zM3 9h2v1h-2zM6 9h2v1h-2zM9 9h2v1h-2zM16 9h1v1h-1zM18 9h1v1h-1zM21 9h1v1h-1zM2 10h1v1h-1zM6 10h1v1h-1zM12 10h1v1h-1zM16 10h1v1h-1zM19 10h3v1h-3zM6 11h3v1h-3zM10 11h1v1h-1zM12 11h1v1h-1zM14 11h3v1h-3zM18 11h1v1h-1zM20 11h2v1h-2zM3 12h2v1h-2zM10 12h1v1h-1zM14 12h3v1h-3zM18 12h1v1h-1zM20 12h2v1h-2zM2 13h1v1h-1zM4 13h4v1h-4zM10 13h1v1h-1zM12 13h1v1h-1zM17 13h2v1h-2zM21 13h1v1h-1zM10 14h2v1h-2zM13 14h1v1h-1zM15 14h1v1h-1zM17 14h5v1h-5zM1 15h7v1h-7zM9 15h1v1h-1zM11 15h1v1h-1zM16 15h2v1h-2zM19 15h2v1h-2zM1 16h1v1h-1zM7 16h1v1h-1zM12 16h1v1h-1zM14 16h2v1h-2zM20 16h2v1h-2zM1 17h1v1h-1zM3 17h3v1h-3zM7 17h1v1h-1zM9 17h2v1h-2zM16 17h1v1h-1zM18 17h2v1h-2zM1 18h1v1h-1zM3 18h3v1h-3zM7 18h1v1h-1zM9 18h2v1h-2zM12 18h1v1h-1zM14 18h1v1h-1zM16 18h6v1h-6zM1 19h1v1h-1zM3 19h3v1h-3zM7 19h1v1h-1zM16 19h1v1h-1zM19 19h1v1h-1zM21 19h1v1h-1zM1 20h1v1h-1zM7 20h1v1h-1zM11 20h1v1h-1zM13 20h1v1h-1zM15 20h7v1h-7zM1 21h7v1h-7zM9 21h1v1h-1zM14 21h1v1h-1zM18 21h1v1h-1z";

function StoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-12 items-center rounded-full bg-white px-[22px] text-[15px] font-semibold text-background transition-opacity duration-fast hover:opacity-90 lg:h-[52px] lg:px-6 lg:text-body"
    >
      {label}
    </a>
  );
}

/** The app's home screen: search, the next event, the category grid and the tab bar. */
function HomePhone({ event, categories }: { event: EventListItem | null; categories: LandingCategory[] }) {
  return (
    <div className={cn(FRAME, HOME_FRAME, "left-[6%] top-6 -rotate-[4deg]")}>
      <div className={cn("ds-tone-cream relative h-full w-full overflow-hidden bg-white text-foreground", HOME_SCREEN)}>
        <div className="px-3.5 pt-6">
          <div className="flex items-center justify-between">
            <Image src="/assets/logo-black.png" alt="" width={84} height={15} className="h-[15px] w-auto" />
            <span className="h-7 w-7 rounded-full bg-cream" />
          </div>
          <div className="mt-3 flex h-[34px] items-center gap-[7px] rounded-full bg-cream px-3 text-[10.5px] text-muted-foreground">
            <Search className="h-3 w-3 text-foreground" strokeWidth={2.4} />
            Search places, deals, events
          </div>
          {event && (
            <div className="relative mt-3 h-[204px] overflow-hidden rounded-media bg-ink">
              {event.banner && (
                <Image src={event.banner.url} alt="" fill sizes="272px" className="object-cover" />
              )}
              <div className="absolute inset-x-2 bottom-2 rounded-control bg-white p-2.5">
                <p className="text-[7.5px] font-semibold uppercase leading-[10px] tracking-[0.06em]">Event · {event.dateLabel}</p>
                <p className="mt-1 truncate text-[13px] font-bold leading-4 tracking-[-0.02em]">{event.name}</p>
                <p className="mt-0.5 truncate text-[8.5px] leading-3 text-muted-foreground">
                  {[event.venue, event.priceLabel].filter(Boolean).join(" · ")}
                </p>
                <span className="mt-2 flex h-[26px] items-center justify-center rounded-full bg-primary text-[9.5px] font-semibold text-primary-foreground">
                  Get tickets
                </span>
              </div>
            </div>
          )}
          <p className="mt-3.5 text-[12.5px] font-bold leading-4">Explore Categories</p>
          <div className="mt-2.5 grid grid-cols-4 gap-x-0.5 gap-y-2.5">
            {categories.slice(0, 8).map((c) => (
              <span key={c.id} className="flex flex-col items-center gap-1">
                <Image src={c.icon} alt="" width={34} height={34} className="h-[34px] w-[34px]" />
                <span className="max-w-full truncate text-[7.5px] font-bold leading-[10px]">{c.name}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-[60px] items-center justify-around border-t border-border bg-white pb-1.5">
          {TABS.map((t) => (
            <Image key={t} src={`/assets/icons/${t}.png`} alt="" width={22} height={22} className="h-[22px] w-[22px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The app's offline ticket for an event. */
function TicketPhone({ event }: { event: EventListItem | null }) {
  return (
    <div className={cn(FRAME, TICKET_FRAME, "left-[50%] top-[76px] rotate-[5deg]")}>
      <div className={cn("ds-tone-cream relative h-full w-full overflow-hidden bg-cream text-foreground", TICKET_SCREEN)}>
        <div className="px-3.5 pt-6">
          <div className="flex items-center gap-1.5">
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span className="text-[13px] font-bold leading-4">Your ticket</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-media bg-white">
            {event?.banner ? (
              <Image
                src={event.banner.url}
                alt=""
                width={event.banner.width}
                height={event.banner.height}
                sizes="252px"
                className="block aspect-video w-full object-cover"
              />
            ) : (
              <div className="aspect-video bg-muted" />
            )}
            {event && (
              <div className="p-3">
                <p className="text-[7.5px] font-semibold uppercase leading-[10px] tracking-[0.06em]">{event.whenLabel}</p>
                <p className="mt-1 truncate text-[12.5px] font-bold leading-[15px] tracking-[-0.02em]">{event.name}</p>
                {event.venue && <p className="mt-0.5 truncate text-[8.5px] leading-3 text-muted-foreground">{event.venue}</p>}
              </div>
            )}
            <div className="relative mx-3 border-t-[1.5px] border-dashed border-border">
              <span className="absolute -left-[21px] -top-2 h-4 w-4 rounded-full bg-cream" />
              <span className="absolute -right-[21px] -top-2 h-4 w-4 rounded-full bg-cream" />
            </div>
            <div className="flex flex-col items-center gap-2 px-3 pb-4 pt-3.5">
              <svg width="118" height="118" viewBox="0 0 23 23" className="text-foreground">
                <path fill="currentColor" d={QR_PATH} />
              </svg>
              <p className="text-[8.5px] leading-3 text-muted-foreground">Show this at the gate · 1 person</p>
              <span className="rounded-full bg-cream px-[9px] py-1 text-[8px] font-bold leading-[10px]">Works offline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Karachi, in your pocket", on ink: what the app adds, the store links, and two phones. */
export function LandingApp({ events, categories }: { events: EventListItem[]; categories: LandingCategory[] }) {
  return (
    <Section tone="ink" size="md" className="overflow-hidden pb-0 pt-10 md:pb-0" aria-labelledby="landing-app">
      <Container className="flex flex-col lg:flex-row lg:flex-wrap lg:gap-12">
        <div className="min-w-0 lg:flex-[5_1_420px] lg:pb-24">
          <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">The Inside app</p>
          <h2
            id="landing-app"
            className="mt-2.5 text-[32px] font-bold leading-9 tracking-[-0.035em] lg:mt-4 lg:text-[52px] lg:leading-[56px]"
          >
            Karachi, in your pocket
          </h2>
          <p className="mt-2.5 text-[15px] leading-[22px] text-muted-foreground lg:mt-5 lg:max-w-[460px] lg:text-body-lg">
            Everything on the site, plus a few things that work better on your phone.
          </p>
          <ul className="mt-5 grid gap-3 lg:mt-7 lg:gap-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] leading-5 lg:gap-3.5 lg:text-[17px] lg:leading-6">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-border lg:h-10 lg:w-10">
                  <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-[22px] flex flex-wrap gap-2.5 lg:mt-8 lg:gap-3">
            <StoreLink href={APP_STORE_URL} label="App Store" />
            <StoreLink href={PLAY_STORE_URL} label="Google Play" />
          </div>
        </div>

        <div aria-hidden="true" className="relative mt-8 h-[390px] min-w-0 lg:mt-0 lg:h-[620px] lg:flex-[6_1_520px]">
          <div className="absolute left-0 top-0 h-[680px] w-[600px] origin-top-left scale-[0.58] sm:scale-75 lg:scale-100">
            <TicketPhone event={events[1] ?? events[0] ?? null} />
            <HomePhone event={events[0] ?? null} categories={categories} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
