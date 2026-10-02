
import { query } from "@/lib/db";
import { FeaturedListingsSection } from "@/components/homepage/FeaturedListingsSection";
import { getFavoritedListingIdsForUser } from "@/lib/utils/favorites-server";
import { Database } from "@/types/database";
import { extractArea } from "@/lib/outing/templates";
import { normalizeSearchText } from "@/lib/utils/places-search";
import { formatStat, getPlatformStats } from "@/lib/homepage/platform-stats";

export async function FeaturedListingsContainer() {
  try {
    // Strictly featured — no random outing fill. Admins flag listings via is_featured.
    const statsPromise = getPlatformStats();
    const { rows: featuredListings } = await query(
      `SELECT lwd.*,
              img.url AS primary_image_url,
              offers.live_deals,
              offers.best_percent
         FROM listings_with_details lwd
         LEFT JOIN LATERAL (
           SELECT li.url FROM listing_images li
            WHERE li.listing_id = lwd.id
            ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
            LIMIT 1
         ) img ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::integer AS live_deals,
                  MAX((regexp_match(d.discount_value, '(\\d{1,3})\\s*%'))[1]::integer) AS best_percent
             FROM deals d
            WHERE d.listing_id = lwd.id
              AND d.is_active = true
              AND (d.start_date IS NULL OR d.start_date <= NOW())
              AND (d.end_date IS NULL OR d.end_date >= NOW())
         ) offers ON true
        WHERE lwd.status = 'published'
          AND lwd.is_featured = true
        ORDER BY lwd.display_order DESC NULLS LAST, lwd.created_at DESC, lwd.id DESC
        LIMIT 6`,
    );

    type ListingRow = Database["public"]["Views"]["listings_with_details"]["Row"] & {
      category_group?: string | null;
      area?: string | null;
      live_deals?: number;
      best_percent?: number | null;
    };
    type HydratedListing = ListingRow & { favorited?: boolean };
    // node-pg returns bigint columns (id) as strings; normalize to number to
    // match the shape callers/components expect.
    // `images` is what getListingImageUrl reads; without it the card falls back
    // to a stock photo.
    const listings = featuredListings.map(({ primary_image_url, ...row }) => ({
      ...row,
      id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
      // No area column; the neighbourhood is read off the street address
      area: row.address ? extractArea(normalizeSearchText(String(row.address))) : null,
      live_deals: Number(row.live_deals) || 0,
      best_percent: row.best_percent != null ? Number(row.best_percent) : null,
      images: primary_image_url
        ? [{ url: primary_image_url, is_primary: true, display_order: 0 }]
        : undefined,
    })) as unknown as ListingRow[];
    const hydratedListings: HydratedListing[] = listings.map((l) => ({ ...l }));

    const ids = listings.map((l) => l.id).filter(Boolean) as number[];
    if (ids.length > 0) {
      try {
        const favSet = await getFavoritedListingIdsForUser(null, ids);
        for (const l of hydratedListings) {
          (l as HydratedListing).favorited = favSet.has(l.id as number);
        }
      } catch (err) {
        console.error("Failed to hydrate favorites for homepage", err);
      }
    }

    const { places } = await statsPromise;

    return (
      <FeaturedListingsSection
        listings={hydratedListings || []}
        totalPlaces={places ? formatStat(places) : null}
      />
    );
  } catch (error) {
    // Don't fail `next build` / ISR when Postgres is temporarily saturated.
    console.error("Featured listings fetch failed:", error);
    return <FeaturedListingsSection listings={[]} />;
  }
}
