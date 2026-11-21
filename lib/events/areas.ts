/**
 * Karachi areas for the /events Area filter, matched against an event's
 * venue name and address. Aliases are lower case; the first area that
 * matches wins, so more specific names come first.
 */
export interface EventArea {
  key: string;
  label: string;
  aliases: readonly string[];
}

export const EVENT_AREAS: readonly EventArea[] = [
  { key: "dha", label: "DHA", aliases: ["dha", "defence", "defense", "zamzama", "khayaban"] },
  { key: "clifton", label: "Clifton", aliases: ["clifton", "sea view", "seaview", "boat basin", "do talwar", "teen talwar"] },
  { key: "korangi", label: "Korangi", aliases: ["korangi"] },
  { key: "pechs", label: "PECHS", aliases: ["pechs", "tariq road", "bahadurabad"] },
  { key: "gulshan", label: "Gulshan", aliases: ["gulshan"] },
  { key: "johar", label: "Gulistan-e-Johar", aliases: ["johar", "jauhar"] },
  { key: "north-nazimabad", label: "North Nazimabad", aliases: ["north nazimabad"] },
  { key: "nazimabad", label: "Nazimabad", aliases: ["nazimabad"] },
  { key: "fb-area", label: "FB Area", aliases: ["fb area", "f.b. area", "federal b"] },
  { key: "saddar", label: "Saddar", aliases: ["saddar"] },
  { key: "karsaz", label: "Karsaz", aliases: ["karsaz"] },
  { key: "shahrah-e-faisal", label: "Shahrah-e-Faisal", aliases: ["shahrah-e-faisal", "shahrah e faisal", "sharea faisal"] },
  { key: "malir", label: "Malir", aliases: ["malir"] },
  { key: "bahria-town", label: "Bahria Town", aliases: ["bahria"] },
];

/** The area key for a venue, or null when none matches. */
export function eventAreaKey(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  return EVENT_AREAS.find((a) => a.aliases.some((alias) => text.includes(alias)))?.key ?? null;
}

export function eventAreaLabel(key: string): string {
  return EVENT_AREAS.find((a) => a.key === key)?.label ?? key;
}

/** "District19, Korangi": the venue name with its area when the name doesn't say it. */
export function eventVenueLabel(locationName: string | null | undefined, address: string | null | undefined): string | null {
  const name = locationName?.trim();
  if (!name) return address?.trim() || null;
  const area = eventAreaKey(locationName, address);
  const label = area ? eventAreaLabel(area) : null;
  return label && !name.toLowerCase().includes(label.toLowerCase()) ? `${name}, ${label}` : name;
}
