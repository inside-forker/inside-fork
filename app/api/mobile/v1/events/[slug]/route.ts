import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  toEventCard,
  toEventImage,
  toTicketType,
  type EventCardRow,
  type EventImageRow,
  type TicketTypeRow,
} from "@/lib/mobile/mappers";
import { getAttendeesPreviewByEvent } from "@/lib/mobile/attendees";
import { formatDiscount } from "@/lib/mobile/deal-format";

export const dynamic = "force-dynamic";

const MAX_EVENT_IMAGES = 20;

const EVENT_CARD_SQL_COLUMNS =
  "events_with_details.event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_id, organizer_name, organizer_avatar, location_name, address, latitude, longitude, " +
  "events_with_details.category_id, c.name AS category_name, c.slug AS category_slug, c.icon_name AS category_icon_name, " +
  "e.venue_id, v.name AS venue_name, v.rating AS venue_rating";

/** `venue_id` isn't on the (untracked) view, so it's reached by joining back
 * to `events` by id rather than editing the view - same approach as the
 * events list route. */
const EVENTS_FROM_SQL =
  "events_with_details " +
  "LEFT JOIN categories c ON c.id = events_with_details.category_id " +
  "LEFT JOIN events e ON e.id = events_with_details.event_id " +
  "LEFT JOIN venues v ON v.id = e.venue_id";

const EVENT_IMAGE_SQL_COLUMNS = "id, url, alt_text, display_order";

const TICKET_TYPE_SQL_COLUMNS =
  "id, name, price, quantity_available, " +
  "to_json(sale_starts_at) #>> '{}' AS sale_starts_at, " +
  "to_json(sale_ends_at) #>> '{}' AS sale_ends_at";

/**
 * GET /api/mobile/v1/events/{slug}
 *
 * Aggregated event detail for the mobile detail screen - mirrors what the
 * website's server component (`app/events/[slug]/page.tsx`) assembles, in one
 * round trip. Published-only; unpublished or unknown slug -> 404. `ticket_types`
 * drives checkout. Events are self-contained (own `location_name`/`address`);
 * they are not linked to listings, so there are no event reviews.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);

  const { slug } = await params;

  const { rows: eventRows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS} FROM ${EVENTS_FROM_SQL}
     WHERE event_slug = $1 AND event_status = 'published'`,
    [slug],
  );
  const eventRow = eventRows[0];

  if (!eventRow || eventRow.event_id == null) {
    throw new MobileApiError("not_found", "Event not found.", 404);
  }

  const eventId = Number(eventRow.event_id);

  const [imagesRes, ticketsRes, organizerRes, dealsRes] = await Promise.all([
    query(
      `SELECT ${EVENT_IMAGE_SQL_COLUMNS} FROM event_images
       WHERE event_id = $1 ORDER BY display_order ASC LIMIT $2`,
      [eventId, MAX_EVENT_IMAGES],
    ),
    query(
      `SELECT ${TICKET_TYPE_SQL_COLUMNS} FROM ticket_types
       WHERE event_id = $1 ORDER BY price ASC, id ASC`,
      [eventId],
    ),
    eventRow.organizer_id
      ? query(
          `SELECT username, is_verified_organizer FROM profiles WHERE id = $1`,
          [eventRow.organizer_id],
        )
      : Promise.resolve({ rows: [] as { username: string | null; is_verified_organizer: boolean | null }[] }),
    // Mirrors the listing detail route's embedded `deals` query, but for
    // event_deals - see that file for the same LEFT JOIN banks shape.
    query(
      `SELECT d.id, d.title, d.description, d.discount_value, d.deal_type, d.end_date,
              b.name AS bank_name, b.logo_url AS bank_logo_url
       FROM event_deals d
       LEFT JOIN banks b ON b.id = d.bank_id
       WHERE d.event_id = $1 AND d.is_active = true
         AND (d.end_date IS NULL OR d.end_date >= NOW())
       ORDER BY d.created_at DESC LIMIT 20`,
      [eventId],
    ),
  ]);

  const images = imagesRes.rows.map(
    (row) => ({ ...row, id: Number(row.id) }) as unknown as EventImageRow,
  );

  // TEMP PREVIEW ONLY - revert before commit
  if (eventId === 85 && images.length === 0) {
    images.push({
      id: -1,
      url: "http://localhost:3000/tmp-preview-farmhouse.jpg",
      alt_text: "Paaltu FarmHouse preview",
      display_order: 1,
    } as unknown as EventImageRow);
  }
  const tickets = ticketsRes.rows.map(
    (row) =>
      ({
        ...row,
        id: Number(row.id),
        price: row.price !== null ? Number(row.price) : null,
      }) as unknown as TicketTypeRow,
  );

  const organizerProfile = organizerRes.rows[0];

  // "Best" = highest formatDiscount() weight (e.g. a bigger % beats a smaller
  // one), most recent as the tiebreak - same weighting `lib/mobile/deal-format.ts`
  // already uses to rank the listings deal feed.
  const dealRows = dealsRes.rows as Array<{
    id: string | number;
    title: string;
    description: string | null;
    discount_value: string | null;
    deal_type: string;
    end_date: string | Date | null;
    bank_name: string | null;
    bank_logo_url: string | null;
  }>;
  const bestDealRow = dealRows
    .map((row) => ({ row, weight: formatDiscount(row.discount_value).weight }))
    .sort((a, b) => b.weight - a.weight)[0]?.row;
  const bestOffer = bestDealRow
    ? {
        id: Number(bestDealRow.id),
        title: bestDealRow.title,
        description: bestDealRow.description,
        discount_value: bestDealRow.discount_value,
        deal_type: bestDealRow.deal_type,
        end_date:
          bestDealRow.end_date instanceof Date
            ? bestDealRow.end_date.toISOString()
            : bestDealRow.end_date,
        bank: bestDealRow.bank_name
          ? { name: bestDealRow.bank_name, logo_url: bestDealRow.bank_logo_url }
          : null,
      }
    : null;

  // "N people going" for the detail screen's attendee strip. Fail-soft and
  // sequential (not folded into the Promise.all above): the production pool is
  // capped at one connection per instance, so a slow "who's going" lookup must
  // never contend for it or 500 the whole screen — same stance the events list
  // route takes. A timeout here just drops the strip.
  let attendeesPreview: Awaited<ReturnType<typeof getAttendeesPreviewByEvent>> =
    new Map();
  try {
    attendeesPreview = await getAttendeesPreviewByEvent([eventId]);
  } catch (error) {
    console.error("[mobile-api] event detail attendees query failed:", error);
  }

  return ok({
    event: {
      ...toEventCard(
        {
          ...eventRow,
          event_id: eventId,
          // category_id/venue_id are `bigint`, venue_rating is `numeric(2,1)` -
          // pg returns all three as strings, not numbers.
          category_id: eventRow.category_id != null ? Number(eventRow.category_id) : null,
          venue_id: eventRow.venue_id != null ? Number(eventRow.venue_id) : null,
          venue_rating: eventRow.venue_rating != null ? Number(eventRow.venue_rating) : null,
        } as unknown as EventCardRow,
        attendeesPreview.get(eventId),
      ),
      organizer_username: organizerProfile?.username ?? null,
      organizer_is_verified: organizerProfile?.is_verified_organizer ?? false,
      best_offer: bestOffer,
    },
    images: images.map(toEventImage),
    ticket_types: tickets.map(toTicketType),
  });
});
