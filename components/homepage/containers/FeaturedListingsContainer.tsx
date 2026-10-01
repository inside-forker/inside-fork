
import { query } from "@/lib/db";
import { FeaturedListingsSection } from "@/components/homepage/FeaturedListingsSection";
import { getFavoritedListingIdsForUser } from "@/lib/utils/favorites-server";
import { Database } from "@/types/database";
import { extractArea } from "@/lib/outing/templates";
import { normalizeSearchText } from "@/lib/utils/places-search";
import { formatStat, getPlatformStats } from "@/lib/homepage/platform-stats";

/**
 * Going-out categories the fill draws from, besides food. Errand-type places
 * (clinics, labs, repairs, printing...) don't belong under "Worth stepping out for".
 */
const OUTING_CATEGORY_SLUGS = [
  "cinemas",
  "gaming",
  "comedy",
  "concerts",
  "theatres",
  "live-performances",
  "nightlife",
  "entertainment-recreation",
  "padel-cricket-futsal-clubs",
  "swimming-pools-clubs",
  "salons-spas",
  "parks-outdoor-spaces",
  "shopping-malls-outlets",
];

export async function FeaturedListingsContainer() {
  try {
    // Featured listings first; when there aren't six, fill with places that have
    // a real photo, so the section never goes empty. The fill is a mix: one pick
    // per category (all of food counts as one) before any category repeats,
    // best-reviewed then newest within each.
    const statsPromise = getPlatformStats();
    const { rows: featuredListings } = await query(
      `WITH candidates AS (
         SELECT lwd.*, COALESCE(parent.name, cat.name) AS category_group,
                img.url AS primary_image_url, offers.live_deals, offers.best_percent,
                ROW_NUMBER() OVER (
                  PARTITION BY CASE WHEN parent.slug = 'food-dining' THEN 'food' ELSE cat.slug END
                  ORDER BY lwd.review_count DESC NULLS LAST, lwd.avg_rating DESC NULLS LAST,
                           lwd.created_at DESC
                ) AS kind_rank
           FROM listings_with_details lwd
           LEFT JOIN categories cat ON lwd.category_id = cat.id
           LEFT JOIN categories parent ON cat.parent_id = parent.id
           LEFT JOIN LATERAL (
             SELECT li.url FROM listing_images li
              WHERE li.listing_id = lwd.id
              ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
              LIMIT 1
           ) img ON true
           -- Live card offers, by the deals feed's rule, for the card's offer line
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
            AND (lwd.is_featured = true
                 OR (img.url IS NOT NULL
                     AND (parent.slug = 'food-dining' OR cat.slug = ANY($1::text[]))))
       )
       SELECT * FROM candidates
        ORDER BY is_featured DESC, display_order DESC NULLS LAST, kind_rank ASC,
                 review_count DESC NULLS LAST, avg_rating DESC NULLS LAST, created_at DESC
        LIMIT 6`,
      [OUTING_CATEGORY_SLUGS],
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
    const listings = featuredListings.map(({ primary_image_url, kind_rank: _kindRank, ...row }) => ({
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
