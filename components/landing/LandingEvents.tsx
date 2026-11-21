import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/ds";
import { EventBannerCard } from "@/components/events/EventBannerCard";
import { DEFAULT_BANNER_SIZE, type EventListItem } from "@/lib/events/list";
import { formatKarachiDay, type KarachiToday } from "@/lib/events/datetime";
import { cn } from "@/lib/utils";

const month = (dayIndex: number) => formatKarachiDay(dayIndex).split(" ").pop();

/** "From Rs 2,550" → ["From", "Rs 2,550"]; a single price gets "Tickets". */
function splitPrice(label: string): [string, string] {
  return label.startsWith("From ") ? ["From", label.slice(5)] : ["Tickets", label];
}

/** A note for organizers, with a link to get in touch. */
function HostingCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-media border border-border px-[18px] py-4 lg:gap-5 lg:rounded-container lg:px-7 lg:py-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold leading-snug lg:text-xl lg:tracking-[-0.02em]">Hosting something?</p>
        <p className="mt-0.5 text-data text-muted-foreground lg:mt-1.5 lg:text-[15px]">
          Sell tickets on Inside<span className="hidden lg:inline">, with QR entry at the gate</span>.
        </p>
      </div>
      <Link
        href="/contact"
        className="inline-flex h-11 shrink-0 items-center rounded-full bg-foreground px-4 text-small font-semibold text-background transition-opacity duration-fast hover:opacity-90 lg:px-[18px] lg:text-[15px]"
      >
        Talk to us
      </Link>
    </div>
  );
}

/**
 * "What's on", on ink: the next event large with its details and Get tickets,
 * the two after it as whole banners, and a note for organizers.
 */
export function LandingEvents({ events, today }: { events: EventListItem[]; today: KarachiToday }) {
  if (events.length === 0) return null;
  const [feature, ...rest] = events;
  const banner = feature.banner;
  const heading = events.every((e) => month(Math.max(e.firstDay, today.index)) === month(today.index))
    ? "Out this month"
    : "Coming up";
  const price = feature.priceLabel ? splitPrice(feature.priceLabel) : null;

  return (
    <Section tone="ink" size="md" className="py-9" aria-labelledby="landing-events">
      <Container>
        <div className="flex items-end gap-3 lg:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">What&rsquo;s on</p>
            <h2
              id="landing-events"
              className="mt-1.5 text-[30px] font-bold leading-[34px] tracking-[-0.03em] lg:mt-2 lg:text-5xl lg:leading-[52px]"
            >
              {heading}
            </h2>
          </div>
          <Link
            href="/events"
            className="inline-flex min-h-11 items-center gap-2 text-small font-semibold transition-opacity duration-fast hover:opacity-80 lg:text-body"
          >
            <span className="lg:hidden">All</span>
            <span className="hidden lg:inline">All events</span>
            <ArrowRight className="hidden h-[18px] w-[18px] lg:block" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-[18px] flex flex-col gap-[22px] lg:mt-9 lg:flex-row lg:flex-wrap lg:gap-8">
          <article className="min-w-0 lg:flex-[7_1_520px]">
            <Link href={`/events/${feature.slug}`} className="block overflow-hidden rounded-media bg-muted lg:rounded-container">
              <Image
                src={banner?.url ?? "/assets/karachi-bg.webp"}
                alt={`${feature.name} banner`}
                width={banner?.width ?? DEFAULT_BANNER_SIZE.width}
                height={banner?.height ?? DEFAULT_BANNER_SIZE.height}
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
                className="block h-auto w-full"
              />
            </Link>
            <div className="mt-3.5 lg:mt-5 lg:flex lg:flex-wrap lg:items-end lg:gap-5">
              <div className="min-w-0 lg:flex-[1_1_320px]">
                <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">{feature.whenLabel}</p>
                <h3 className="mt-1.5 text-[22px] font-bold leading-7 tracking-[-0.025em] lg:mt-2 lg:text-[34px] lg:leading-[38px]">
                  <Link href={`/events/${feature.slug}`} className="hover:underline">
                    {feature.name}
                  </Link>
                </h3>
                {feature.venue && (
                  <p className="mt-0.5 text-data text-muted-foreground lg:mt-2 lg:text-body">
                    {feature.venue}
                    {feature.organizer && <span className="hidden lg:inline"> · By {feature.organizer}</span>}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 lg:mt-0 lg:gap-5">
                {price && (
                  <p className="flex-1 text-label text-muted-foreground lg:flex-none lg:text-small">
                    {price[0]}
                    <strong className="block text-[17px] leading-[22px] text-foreground lg:text-xl lg:leading-6">{price[1]}</strong>
                  </p>
                )}
                <Link
                  href={`/events/${feature.slug}`}
                  className="ml-auto inline-flex h-12 items-center rounded-full bg-primary px-[22px] text-[15px] font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90 lg:ml-0 lg:h-[52px] lg:px-[26px] lg:text-body"
                >
                  {feature.priceLabel ? "Get tickets" : "View event"}
                </Link>
              </div>
            </div>
            {rest.length > 0 && <HostingCard className="mt-8 hidden lg:flex" />}
          </article>

          <div className="flex min-w-0 flex-col gap-3.5 lg:flex-[5_1_380px] lg:gap-7">
            {rest.slice(0, 2).map((e) => (
              <EventBannerCard
                key={e.id}
                href={`/events/${e.slug}`}
                name={e.name}
                dateLabel={e.dateLabel}
                priceLabel={e.priceLabel}
                banner={e.banner}
                sizes="(min-width: 1024px) 480px, 100vw"
              />
            ))}
            {/* With banners beside the feature, the note moves under it on desktop to even the columns. */}
            <HostingCard className={rest.length > 0 ? "mt-1.5 lg:hidden" : "mt-1.5 lg:mt-0 lg:flex-1"} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
