/**
 * Organizer-defined checkout questions ("University name", "Student ID") and
 * group tickets (one ticket, several people). Client-safe: the checkout UI,
 * the ticket editors and the booking APIs all share these.
 *
 * Fields live on events.attendee_fields (every ticket of the event) and
 * ticket_types.attendee_fields (one tier). See
 * sql/migrations/20261021_group_tickets_attendee_fields.sql.
 */

export const ATTENDEE_FIELD_TYPES = [
  "text",
  "number",
  "email",
  "phone",
  "select",
] as const;
export type AttendeeFieldType = (typeof ATTENDEE_FIELD_TYPES)[number];

/** person = asked for every pass holder; order = asked once per booking. */
export type AttendeeFieldScope = "person" | "order";

export type AttendeeField = {
  id: string;
  label: string;
  type: AttendeeFieldType;
  options?: string[];
  required: boolean;
  scope: AttendeeFieldScope;
};

/** One answer, with the label snapshotted so exports survive field edits. */
export type AttendeeAnswer = { field_id: string; label: string; value: string };

export const MAX_PEOPLE_PER_TICKET = 10;
const MAX_FIELDS = 15;
const MAX_LABEL = 80;
const MAX_VALUE = 300;
const MAX_OPTIONS = 30;

export function newFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

/** Clamp anything into 1..MAX_PEOPLE_PER_TICKET; junk means 1. */
export function normalizePeoplePerTicket(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PEOPLE_PER_TICKET);
}

/**
 * People required per ticket. Missing/junk = `max` (a fixed-size ticket);
 * otherwise clamped into 1..max. People above it are optional.
 */
export function normalizeMinPeople(raw: unknown, max: number): number {
  if (raw === null || raw === undefined || raw === "") return max;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return max;
  return Math.min(Math.max(n, 1), max);
}

/**
 * Whatever came from a request body or a jsonb column, as a clean field list.
 * Drops entries without a label; select fields without options become text.
 */
export function sanitizeAttendeeFields(raw: unknown): AttendeeField[] {
  if (!Array.isArray(raw)) return [];
  const out: AttendeeField[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw.slice(0, MAX_FIELDS)) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const label = String(rec.label ?? "").trim().slice(0, MAX_LABEL);
    if (!label) continue;
    let id = String(rec.id ?? "").trim().slice(0, 40) || newFieldId();
    if (seenIds.has(id)) id = newFieldId();
    seenIds.add(id);
    let type = (ATTENDEE_FIELD_TYPES as readonly string[]).includes(
      String(rec.type),
    )
      ? (rec.type as AttendeeFieldType)
      : "text";
    const options =
      type === "select" && Array.isArray(rec.options)
        ? Array.from(
            new Set(
              rec.options
                .map((o) => String(o ?? "").trim().slice(0, MAX_LABEL))
                .filter(Boolean),
            ),
          ).slice(0, MAX_OPTIONS)
        : undefined;
    if (type === "select" && !options?.length) type = "text";
    out.push({
      id,
      label,
      type,
      ...(type === "select" ? { options } : {}),
      required: rec.required === true,
      scope: rec.scope === "order" ? "order" : "person",
    });
  }
  return out;
}

/**
 * The fields a ticket actually asks: the event's, then the tier's own. A tier
 * field with the same label as an event field is skipped, so nobody is asked
 * the same thing twice.
 */
export function mergeAttendeeFields(
  eventFields: unknown,
  ticketFields: unknown,
): AttendeeField[] {
  const fromEvent = sanitizeAttendeeFields(eventFields);
  const labels = new Set(fromEvent.map((f) => f.label.toLowerCase()));
  const ids = new Set(fromEvent.map((f) => f.id));
  const fromTicket = sanitizeAttendeeFields(ticketFields).filter(
    (f) => !labels.has(f.label.toLowerCase()) && !ids.has(f.id),
  );
  return [...fromEvent, ...fromTicket];
}

/** Order-level fields across a whole cart, each once (by label). */
export function collectOrderFields(fieldLists: AttendeeField[][]): AttendeeField[] {
  const seen = new Set<string>();
  const out: AttendeeField[] = [];
  for (const list of fieldLists) {
    for (const f of list) {
      if (f.scope !== "order") continue;
      const key = f.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

export function personFields(fields: AttendeeField[]): AttendeeField[] {
  return fields.filter((f) => f.scope === "person");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problem with one value, or null when it's fine. */
export function attendeeFieldError(
  field: AttendeeField,
  value: string | undefined,
): string | null {
  const v = (value ?? "").trim();
  if (!v) return field.required ? `${field.label} is required` : null;
  if (v.length > MAX_VALUE) return `${field.label} is too long`;
  switch (field.type) {
    case "number":
      return /^-?\d+(\.\d+)?$/.test(v) ? null : `${field.label} must be a number`;
    case "email":
      return EMAIL_PATTERN.test(v) ? null : `Enter a valid ${field.label.toLowerCase()}`;
    case "phone":
      return v.replace(/\D/g, "").length >= 10
        ? null
        : `Enter a valid ${field.label.toLowerCase()}`;
    case "select":
      return field.options?.includes(v) ? null : `Pick a ${field.label.toLowerCase()}`;
    default:
      return null;
  }
}

/**
 * Validates submitted answers ({ fieldId: value }) against the fields and
 * returns them as snapshotted answers. Unknown keys are ignored. Throws an
 * Error with a buyer-readable message on the first problem.
 */
export function collectAnswers(
  fields: AttendeeField[],
  submitted: unknown,
  who?: string,
): AttendeeAnswer[] {
  const values =
    submitted && typeof submitted === "object"
      ? (submitted as Record<string, unknown>)
      : {};
  const answers: AttendeeAnswer[] = [];
  for (const field of fields) {
    const raw = values[field.id];
    const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
    const problem = attendeeFieldError(field, value);
    if (problem) throw new Error(who ? `${who}: ${problem}` : problem);
    if (value) answers.push({ field_id: field.id, label: field.label, value });
  }
  return answers;
}

/** Holder saved on a booking until its passes are issued. */
export type StoredHolder = {
  name: string | null;
  cnic_last4: string | null;
  answers: AttendeeAnswer[];
};

/** bookings.attendee_details */
export type BookingAttendeeDetails = {
  order: AttendeeAnswer[];
  /** keyed by ticket_type_id; index = pass quantity_index. null = an
   *  optional person (above the ticket's minimum) left empty: no pass. */
  holders: Record<string, (StoredHolder | null)[]>;
};

/** "Ticket 2 · Person 3 of 3" style position of a pass in its group. */
export type PassGroupInfo = { ticket: number; person: number; size: number };

export function groupPosition(
  quantityIndex: number,
  peoplePerTicket: number,
): PassGroupInfo {
  const size = Math.max(1, peoplePerTicket);
  return {
    ticket: Math.floor(quantityIndex / size) + 1,
    person: (quantityIndex % size) + 1,
    size,
  };
}

/**
 * What a pass carries for rosters/exports: the holder's own answers, then the
 * booking's once-per-order answers, plus the pass's place in its group.
 */
export function passAttendeeInfo(
  metadata: unknown,
  bookingDetails: unknown,
): { answers: AttendeeAnswer[]; group: PassGroupInfo | null } {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as {
    answers?: AttendeeAnswer[];
    group?: PassGroupInfo;
  };
  const order = (
    bookingDetails && typeof bookingDetails === "object"
      ? (bookingDetails as BookingAttendeeDetails).order
      : []
  ) ?? [];
  return {
    answers: [...(Array.isArray(meta.answers) ? meta.answers : []), ...order],
    group: meta.group ?? null,
  };
}
