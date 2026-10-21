import { query } from "@/lib/db";
import {
  collectAnswers,
  collectOrderFields,
  groupPosition,
  mergeAttendeeFields,
  normalizeMinPeople,
  normalizePeoplePerTicket,
  personFields,
  type AttendeeField,
  type BookingAttendeeDetails,
  type StoredHolder,
} from "@/lib/ticketing/attendee-fields";

/**
 * Server side of group tickets + attendee fields: what each ticket type asks,
 * turning a checkout submission into bookings.attendee_details, and turning a
 * paid booking into one pass per person.
 */

export type TicketAttendeeConfig = {
  /** Max people one ticket admits (slots per ticket). */
  peoplePerTicket: number;
  /** People required per ticket; the rest up to the max are optional. */
  minPeople: number;
  /** Event fields + the tier's own, merged. */
  fields: AttendeeField[];
};

export async function loadTicketAttendeeConfig(
  ticketTypeIds: number[],
): Promise<Map<number, TicketAttendeeConfig>> {
  const map = new Map<number, TicketAttendeeConfig>();
  if (ticketTypeIds.length === 0) return map;
  const { rows } = await query(
    `SELECT tt.id, tt.people_per_ticket, tt.min_people_per_ticket,
            tt.attendee_fields AS ticket_fields,
            e.attendee_fields AS event_fields
     FROM ticket_types tt JOIN events e ON e.id = tt.event_id
     WHERE tt.id = ANY($1::int[])`,
    [ticketTypeIds],
  );
  for (const row of rows) {
    const max = normalizePeoplePerTicket(row.people_per_ticket);
    map.set(Number(row.id), {
      peoplePerTicket: max,
      minPeople: normalizeMinPeople(row.min_people_per_ticket, max),
      fields: mergeAttendeeFields(row.event_fields, row.ticket_fields),
    });
  }
  return map;
}

/** One submitted pass holder: name, raw CNIC (only last 4 kept), answers. */
export type SubmittedHolder = {
  name?: unknown;
  cnic?: unknown;
  answers?: unknown;
};

function isEmptyHolder(h: SubmittedHolder): boolean {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const answers =
    h.answers && typeof h.answers === "object"
      ? Object.values(h.answers as Record<string, unknown>)
      : [];
  return !text(h.name) && !text(h.cnic) && answers.every((a) => !text(a));
}

/**
 * Validates the custom-field answers for every person of every ticket and the
 * order-level answers, and returns what to store on the booking. Throws an
 * Error with a buyer-readable message when a required answer is missing or
 * invalid. Optional people (above the ticket's minimum) left empty are stored
 * as null and get no pass.
 *
 * `holdersFor(ticketTypeId, index)` returns what was entered for the pass at
 * that quantity_index (ticket i, person p => i * peoplePerTicket + p).
 */
export function buildAttendeeDetails(
  items: { ticket_type_id: number; quantity: number }[],
  config: Map<number, TicketAttendeeConfig>,
  holdersFor: (ticketTypeId: number, index: number) => SubmittedHolder | undefined,
  orderAnswers: unknown,
): BookingAttendeeDetails | null {
  const orderFields = collectOrderFields(
    items.map((i) => config.get(i.ticket_type_id)?.fields ?? []),
  );
  const order = collectAnswers(orderFields, orderAnswers);

  const holders: Record<string, (StoredHolder | null)[]> = {};
  let anyHolderData = false;
  for (const item of items) {
    const cfg = config.get(item.ticket_type_id);
    const size = cfg?.peoplePerTicket ?? 1;
    const min = cfg?.minPeople ?? size;
    const fields = personFields(cfg?.fields ?? []);
    const list: (StoredHolder | null)[] = [];
    for (let i = 0; i < item.quantity * size; i++) {
      const submitted = holdersFor(item.ticket_type_id, i) ?? {};
      const pos = groupPosition(i, size);
      if (pos.person > min && isEmptyHolder(submitted)) {
        list.push(null);
        continue;
      }
      const who =
        size > 1
          ? `Ticket ${pos.ticket}, person ${pos.person}`
          : `Ticket ${pos.ticket}`;
      const answers = collectAnswers(fields, submitted.answers, who);
      const name =
        typeof submitted.name === "string" ? submitted.name.trim() || null : null;
      const cnicDigits =
        typeof submitted.cnic === "string" ? submitted.cnic.replace(/\D/g, "") : "";
      const holder: StoredHolder = {
        name,
        cnic_last4: cnicDigits.length >= 4 ? cnicDigits.slice(-4) : null,
        answers,
      };
      if (holder.name || holder.cnic_last4 || answers.length) anyHolderData = true;
      list.push(holder);
    }
    holders[String(item.ticket_type_id)] = list;
  }

  if (!anyHolderData && order.length === 0) return null;
  return { order, holders };
}

export type PlannedPass = {
  ticket_type_id: number;
  quantity_index: number;
  /** Holder's name, else `fallbackName`, else null (caller decides). */
  guest_name: string | null;
  cnic_last4: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * The passes a paid booking should have: per ticket, one per required person
 * plus one per optional person who was entered (skipping `skipTypeIds`, e.g.
 * PDF-inventory tiers), each carrying the holder's name, CNIC last 4 and
 * answers saved at checkout. quantity_index keeps the slot (ticket * max +
 * person), so a skipped optional person leaves a gap.
 */
export async function planBookingPasses(
  bookingId: number,
  items: { ticket_type_id: number | string; quantity: number | string }[],
  skipTypeIds: Set<number>,
  fallbackName: string | null,
): Promise<PlannedPass[]> {
  const typeIds = items.map((i) => Number(i.ticket_type_id));
  const [config, { rows: bookingRows }] = await Promise.all([
    loadTicketAttendeeConfig(typeIds),
    query(`SELECT attendee_details FROM bookings WHERE id = $1`, [bookingId]),
  ]);
  const details = (bookingRows[0]?.attendee_details ??
    null) as BookingAttendeeDetails | null;

  const planned: PlannedPass[] = [];
  for (const item of items) {
    const typeId = Number(item.ticket_type_id);
    if (skipTypeIds.has(typeId)) continue;
    const size = config.get(typeId)?.peoplePerTicket ?? 1;
    const min = config.get(typeId)?.minPeople ?? size;
    const stored = details?.holders?.[String(typeId)] ?? [];
    for (let t = 0; t < Number(item.quantity); t++) {
      // Who is actually on this ticket: the required people, plus optional
      // ones only when they were entered.
      const slots: number[] = [];
      for (let p = 0; p < size; p++) {
        const i = t * size + p;
        if (p < min || stored[i]) slots.push(i);
      }
      slots.forEach((i, position) => {
        const holder = stored[i];
        const metadata: Record<string, unknown> = {};
        if (size > 1) {
          metadata.group = { ticket: t + 1, person: position + 1, size: slots.length };
        }
        if (holder?.answers?.length) metadata.answers = holder.answers;
        planned.push({
          ticket_type_id: typeId,
          quantity_index: i,
          guest_name: holder?.name || fallbackName || null,
          cnic_last4: holder?.cnic_last4 ?? null,
          metadata: Object.keys(metadata).length ? metadata : null,
        });
      });
    }
  }
  return planned;
}
