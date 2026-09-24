/**
 * Organizer update payloads are partial — the mobile/web forms do not send
 * admin-only fields (status, is_featured, …) and may re-serialize datetimes.
 * Merge with the current event so proposed_data only differs where the
 * organizer actually changed something.
 */

const ORGANIZER_EDITABLE_KEYS = [
  "name",
  "description",
  "start_time",
  "end_time",
  "location_name",
  "address",
  "latitude",
  "longitude",
  "category_id",
  "max_capacity",
] as const;

const PASSTHROUGH_KEYS = [
  "temp_images",
  "temp_session_id",
  "temp_tickets",
] as const;

function sameMinute(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  const ta = new Date(String(a)).getTime();
  const tb = new Date(String(b)).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return String(a) === String(b);
  // Form pickers only expose minute precision.
  return Math.floor(ta / 60_000) === Math.floor(tb / 60_000);
}

export function mergeEventUpdateProposed(
  original: Record<string, unknown>,
  eventData: Record<string, unknown>,
): Record<string, unknown> {
  const proposed: Record<string, unknown> = {
    name: original.name,
    description: original.description,
    start_time: original.start_time,
    end_time: original.end_time,
    location_name: original.location_name,
    address: original.address,
    latitude: original.latitude,
    longitude: original.longitude,
    category_id: original.category_id,
    max_capacity: original.max_capacity,
    // Preserve admin-managed fields so review UI doesn't show false "Not set".
    status: original.status,
    is_featured: original.is_featured,
    is_commission_based: original.is_commission_based,
    commission_rate: original.commission_rate,
    require_guest_details: original.require_guest_details,
  };

  for (const key of ORGANIZER_EDITABLE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(eventData, key)) continue;
    const next = eventData[key];
    // Mobile edit form used to omit category init and submit null — don't wipe
    // an existing category unless the organizer explicitly picked one.
    if (key === "category_id" && next == null && original.category_id != null) {
      continue;
    }
    proposed[key] = next;
  }

  for (const key of PASSTHROUGH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(eventData, key)) {
      proposed[key] = eventData[key];
    }
  }

  for (const key of ["start_time", "end_time"] as const) {
    if (sameMinute(proposed[key], original[key])) {
      proposed[key] = original[key];
    }
  }

  // Empty string → null for nullable text fields (matches DB).
  for (const key of ["description", "location_name", "address"] as const) {
    if (proposed[key] === "") proposed[key] = null;
  }

  return proposed;
}

/** True when two proposed/original field values should display as unchanged. */
export function eventFieldValuesEqual(
  key: string,
  oldVal: unknown,
  newVal: unknown,
): boolean {
  if (newVal === undefined) return true;
  if (oldVal === newVal) return true;
  if (oldVal == null && newVal == null) return true;
  if (key === "start_time" || key === "end_time") {
    return sameMinute(oldVal, newVal);
  }
  if (
    typeof oldVal === "number" ||
    typeof newVal === "number" ||
    (typeof oldVal === "string" && typeof newVal === "string" && /^-?\d+$/.test(oldVal) && /^-?\d+$/.test(newVal))
  ) {
    return Number(oldVal) === Number(newVal);
  }
  return false;
}
