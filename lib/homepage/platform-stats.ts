import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

export type PlatformStats = {
  places: number | null;
  upcomingEvents: number | null;
  categories: number | null;
};

async function count(sql: string): Promise<number | null> {
  try {
    const { rows } = await query(sql);
    const value = Number(rows[0]?.count);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    console.error("Platform stat query failed:", error);
    return null;
  }
}

/**
 * Real, public-facing platform counts for the landing page.
 * A failed query yields null so the UI hides that stat instead of faking it.
 */
export const getPlatformStats = unstable_cache(
  async (): Promise<PlatformStats> => {
    const [places, upcomingEvents, categories] = await Promise.all([
      count(
        `SELECT COUNT(*)::integer AS count FROM listings WHERE status = 'published'`,
      ),
      count(
        `SELECT COUNT(*)::integer AS count FROM events_with_details
         WHERE event_status = 'published' AND start_time >= NOW()`,
      ),
      count(
        `SELECT COUNT(*)::integer AS count FROM categories
         WHERE is_enabled = true AND parent_id IS NULL`,
      ),
    ]);
    return { places, upcomingEvents, categories };
  },
  ["platform-stats"],
  { revalidate: 3600, tags: ["platform-stats"] },
);

/**
 * Formats a count without inflating it: exact below 100, otherwise rounded
 * down (to 10s below 1,000, to 100s above) with a "+" suffix.
 */
export function formatStat(value: number): string {
  if (value < 100) return value.toLocaleString("en-US");
  const step = value < 1000 ? 10 : 100;
  const floored = Math.floor(value / step) * step;
  return `${floored.toLocaleString("en-US")}+`;
}
