/**
 * Curated Home opener (hero) slides.
 *
 * Stored in `system_config` under `mobile.home_opener.slides`. Empty config
 * means the mobile client / resolver falls back to the auto algorithm
 * (featured event + trending listings).
 */

export const HOME_OPENER_CONFIG_KEY = "mobile.home_opener.slides";
export const HOME_OPENER_MAX_SLIDES = 4;

export type HomeOpenerSlideKind = "event" | "listing";

export type HomeOpenerSlideRef = {
  kind: HomeOpenerSlideKind;
  id: number;
};

export type HomeOpenerConfig = {
  slides: HomeOpenerSlideRef[];
  /** When true (default), fill remaining slots with the auto algorithm. */
  fill_remaining: boolean;
};

export const EMPTY_HOME_OPENER_CONFIG: HomeOpenerConfig = {
  slides: [],
  fill_remaining: true,
};

export function parseHomeOpenerConfig(raw: unknown): HomeOpenerConfig {
  if (raw == null) return { ...EMPTY_HOME_OPENER_CONFIG };

  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { ...EMPTY_HOME_OPENER_CONFIG };
    }
  }

  if (typeof value !== "object" || value === null) {
    return { ...EMPTY_HOME_OPENER_CONFIG };
  }

  const obj = value as Record<string, unknown>;
  const slidesRaw = Array.isArray(obj.slides) ? obj.slides : [];
  const slides: HomeOpenerSlideRef[] = [];
  const seen = new Set<string>();

  for (const item of slidesRaw) {
    if (slides.length >= HOME_OPENER_MAX_SLIDES) break;
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === "event" || row.kind === "listing" ? row.kind : null;
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!kind || !Number.isFinite(id) || id <= 0) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slides.push({ kind, id: Math.trunc(id) });
  }

  const fillRemaining =
    obj.fill_remaining === undefined ? true : Boolean(obj.fill_remaining);

  return { slides, fill_remaining: fillRemaining };
}

export function serializeHomeOpenerConfig(config: HomeOpenerConfig): HomeOpenerConfig {
  return parseHomeOpenerConfig(config);
}
