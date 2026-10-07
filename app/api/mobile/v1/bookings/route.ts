import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";
import {
  BOOKING_COLUMN_KEYS,
  toBooking,
  type BookingRow,
} from "@/lib/mobile/commerce";

import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";

export const dynamic = "force-dynamic";

const BOOKING_SELECT = BOOKING_COLUMN_KEYS.map((c) => `b.${c}`).join(", ");

/**
 * GET /api/mobile/v1/bookings
 *
 * The caller's own bookings, newest first (explicit user_id filter - no RLS
 * on direct Postgres). Redacted DTO - never cnic_hash / verification_seed /
 * email / phone / user_id. Adds `event_name` (joined from `events`) and
 * `ticket_count` (from `ticket_passes`) on top of the shared BookingDTO, so
 * the app doesn't need a second round-trip per booking to show what was
 * booked. Mirrors `app/api/tickets` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows } = await query(
    `SELECT ${BOOKING_SELECT}, e.name AS event_name, e.start_time AS event_start_time,
            e.location_name AS event_location_name,
            e.address AS event_address,
            (
              SELECT COUNT(*)::int
              FROM ticket_passes tp
              WHERE tp.booking_id = b.id
            ) AS ticket_count
     FROM bookings b
     LEFT JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [user.id],
  );

  const eventIds = rows
    .map((r) => Number((r as { event_id?: unknown }).event_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const imagesByEventId = await fetchPrimaryImagesByEventId(eventIds);

  const bookings = (rows as unknown as (BookingRow & {
    event_name: string | null;
    event_start_time: string | null;
    event_location_name: string | null;
    event_address: string | null;
    ticket_count: string;
  })[]).map((row) => ({
    ...toBooking(row),
    event_name: row.event_name,
    event_start_time: row.event_start_time,
    event_location_name: row.event_location_name,
    event_address: row.event_address,
    event_image_url: imagesByEventId.get(Number(row.event_id)) || null,
    ticket_count: parseInt(row.ticket_count, 10) || 0,
  }));

  return ok(bookings);
});
