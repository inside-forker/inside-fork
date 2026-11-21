import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";
import { getSupportedBanks } from "@/lib/homepage/bank-offers";
import { getAreaPlaceCounts } from "@/lib/homepage/area-counts";
import { HOMEPAGE_AREAS, areaHref } from "@/lib/homepage/areas";
import { formatStat } from "@/lib/homepage/platform-stats";
import { parseDiscountValue } from "@/lib/mobile/deals-feed";
import { extractArea } from "@/lib/outing/templates";
import { normalizeSearchText } from "@/lib/utils/places-search";

/* ------------------------------------------------------------------ categories */

/** The app's top-level categories and their icon art, in the app's order. */
const LANDING_CATEGORIES = [
  { id: 75, icon: "food-and-drink" },
  { id: 76, icon: "shopping" },
  { id: 148, icon: "things-to-do" },
  { id: 104, icon: "fitness" },
  { id: 150, icon: "salons" },
  { id: 151, icon: "hotels" },
  { id: 77, icon: "healthcare" },
  { id: 80, icon: "education" },
] as const;

export interface LandingCategory {
  id: number;
  name: string;
  href: string;
  /** "/assets/icons/food-and-drink.png" */
  icon: string;
  /** "2,783 places" */
  countLabel: string;
}

/**
 * The eight app categories with their published place counts (own count plus
 * direct subcategories, the same sum the category pages use). Categories with
 * no places are left out.
 */
const cachedCategories = unstable_cache(
  async (): Promise<LandingCategory[]> => {
    const { rows } = await query(
      `SELECT v.id, v.name, v.slug, v.parent_id, v.published_listing_count
           FROM categories_with_published_listing_count v
           JOIN categories c ON c.id = v.id
          WHERE c.is_enabled = true`,
    );
    const count = new Map<number, number>();
    for (const r of rows)
      count.set(Number(r.id), Number(r.published_listing_count) || 0);
    const totals = new Map<number, number>();
    for (const r of rows) {
      const parent = r.parent_id == null ? null : Number(r.parent_id);
      const own = count.get(Number(r.id)) ?? 0;
      if (parent == null)
        totals.set(Number(r.id), (totals.get(Number(r.id)) ?? 0) + own);
      else totals.set(parent, (totals.get(parent) ?? 0) + own);
    }
    const byId = new Map(rows.map((r) => [Number(r.id), r]));

    return LANDING_CATEGORIES.flatMap(({ id, icon }) => {
      const row = byId.get(id);
      const places = totals.get(id) ?? 0;
      if (!row || places === 0) return [];
      return [
        {
          id,
          name: String(row.name),
          href: `/listings/${row.slug}`,
          icon: `/assets/icons/${icon}.png`,
          countLabel: `${places.toLocaleString("en-US")} ${places === 1 ? "place" : "places"}`,
        },
      ];
    });
  },
  ["landing-categories-v2"],
  { revalidate: 3600, tags: ["listings"] },
);

export async function getLandingCategories(): Promise<LandingCategory[]> {
  try {
    return await cachedCategories();
  } catch (error) {
    console.error("Landing categories query failed:", error);
    return [];
  }
}

/* ------------------------------------------------------------------ banks */

export interface LandingDeal {
  id: number;
  merchant: string;
  href: string;
  /** "50% off" or the offer's own short label ("BOGO"). */
  offer: string;
  /** "Dining · Clifton" */
  meta: string | null;
  image: string | null;
}

export interface LandingBank {
  id: number;
  name: string;
  /** "Meezan" for "Meezan Bank". */
  short: string;
  logo: string | null;
  offers: number;
  places: number;
  href: string;
  deals: LandingDeal[];
}

export interface LandingBanks {
  banks: LandingBank[];
  totalOffers: number;
  totalBanks: number;
}

const BANKS_SHOWN = 6;

/**
 * The six banks with the most live offers, each with its three best places
 * (biggest discount first, places with a photo first), plus the totals for
 * the section's line. Live means active, started and not ended. Failures
 * aren't cached; the section just hides until the next request works.
 */
const cachedBanks = unstable_cache(
  async (): Promise<LandingBanks> => {
    const all = (await getSupportedBanks()).filter((b) => b.dealsCount > 0);
    const top = all.slice(0, BANKS_SHOWN);
    // getSupportedBanks returns [] when its query fails; don't cache that.
    if (top.length === 0) throw new Error("No banks with live offers");

    const [{ rows: dealRows }, { rows: totalRows }] = await Promise.all([
      query(
        `WITH best AS (
             SELECT DISTINCT ON (d.bank_id, l.id)
                    d.bank_id, l.id AS listing_id, l.name AS merchant, l.slug AS listing_slug,
                    l.address, l.category_id, d.discount_value,
                    (regexp_match(d.discount_value, '(\\d{1,3})\\s*%'))[1]::integer AS pct
               FROM deals d
               JOIN listings l ON l.id = d.listing_id AND l.status = 'published'
              WHERE d.is_active = true
                AND (d.start_date IS NULL OR d.start_date <= NOW())
                AND (d.end_date IS NULL OR d.end_date >= NOW())
                AND d.bank_id = ANY($1::bigint[])
              ORDER BY d.bank_id, l.id, pct DESC NULLS LAST
           ), ranked AS (
             SELECT best.*, img.url AS image_url, c.name AS category_name,
                    ROW_NUMBER() OVER (
                      PARTITION BY best.bank_id
                      ORDER BY (img.url IS NULL), best.pct DESC NULLS LAST, best.listing_id
                    ) AS rn
               FROM best
               LEFT JOIN LATERAL (
                 SELECT li.url FROM listing_images li
                  WHERE li.listing_id = best.listing_id
                  ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
                  LIMIT 1
               ) img ON true
               LEFT JOIN categories c ON c.id = best.category_id
           )
           SELECT bank_id, listing_id, merchant, listing_slug, address, discount_value, pct, image_url, category_name
             FROM ranked WHERE rn <= 3
            ORDER BY bank_id, rn`,
        [top.map((b) => b.id)],
      ),
      query(
        `SELECT COUNT(*)::integer AS n
             FROM deals d
             JOIN listings l ON l.id = d.listing_id AND l.status = 'published'
            WHERE d.is_active = true
              AND (d.start_date IS NULL OR d.start_date <= NOW())
              AND (d.end_date IS NULL OR d.end_date >= NOW())`,
      ),
    ]);

    const dealsByBank = new Map<number, LandingDeal[]>();
    for (const r of dealRows) {
      const bankId = Number(r.bank_id);
      const area = r.address
        ? extractArea(normalizeSearchText(String(r.address)))
        : null;
      const offer =
        r.pct != null
          ? `${r.pct}% off`
          : parseDiscountValue(r.discount_value as string | null).label;
      const list = dealsByBank.get(bankId) ?? [];
      list.push({
        id: Number(r.listing_id),
        merchant: String(r.merchant),
        href: `/listing/${r.listing_slug}`,
        offer,
        meta: [r.category_name, area].filter(Boolean).join(" · ") || null,
        image: (r.image_url as string | null) ?? null,
      });
      dealsByBank.set(bankId, list);
    }

    return {
      banks: top.map((b) => ({
        id: b.id,
        name: b.name,
        short: b.name.replace(/\s+bank$/i, ""),
        logo: b.logoUrl,
        offers: b.dealsCount,
        places: b.places,
        href: `/listings?deals=true&bank=${b.id}`,
        deals: dealsByBank.get(b.id) ?? [],
      })),
      totalOffers: Number(totalRows[0]?.n) || 0,
      totalBanks: all.length,
    };
  },
  ["landing-banks-v2"],
  { revalidate: 300, tags: ["deals"] },
);

export async function getLandingBanks(): Promise<LandingBanks> {
  try {
    return await cachedBanks();
  } catch (error) {
    console.error("Landing banks query failed:", error);
    return { banks: [], totalOffers: 0, totalBanks: 0 };
  }
}

/* ------------------------------------------------------------------ areas */

/** Food & Drinks, the app's first category. */
const FOOD_CATEGORY_ID = 75;

export interface LandingPlace {
  id: number;
  name: string;
  href: string;
  category: string | null;
  image: string | null;
}

export interface LandingArea {
  name: string;
  /** "450+" */
  countLabel: string | null;
  href: string;
  places: LandingPlace[];
}

/**
 * The homepage areas with their place counts (the area-link rule) and three
 * places each, all with a photo: food first (what most people look for),
 * then featured, then the most reviewed.
 */
const AREA_LABELS = HOMEPAGE_AREAS.map((a) => a.label);

const cachedAreas = unstable_cache(
  async (): Promise<LandingArea[]> => {
    const labels = AREA_LABELS;
    const [counts, { rows }] = await Promise.all([
      getAreaPlaceCounts(labels),
      query(
        `SELECT a.area, p.id, p.name, p.slug, p.category_name, p.image_url
             FROM unnest($1::text[]) AS a(area)
             CROSS JOIN LATERAL (
               SELECT l.id, l.name, l.slug, l.category_name, img.url AS image_url
                 FROM listings_with_details l
                 JOIN LATERAL (
                   SELECT li.url FROM listing_images li
                    WHERE li.listing_id = l.id
                    ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
                    LIMIT 1
                 ) img ON true
                 LEFT JOIN categories c ON c.id = l.category_id
                WHERE l.status = 'published'
                  AND l.address ILIKE '%' || a.area || '%'
                ORDER BY (c.id = $2 OR c.parent_id = $2) DESC NULLS LAST,
                         l.is_featured DESC NULLS LAST, l.review_count DESC NULLS LAST,
                         l.avg_rating DESC NULLS LAST, l.id ASC
                LIMIT 3
             ) p`,
        [labels, FOOD_CATEGORY_ID],
      ),
    ]);

    return labels.map((label) => ({
      name: label,
      countLabel: counts[label] ? formatStat(counts[label]) : null,
      href: areaHref(label),
      places: rows
        .filter((r) => r.area === label)
        .map((r) => ({
          id: Number(r.id),
          name: String(r.name),
          href: `/listing/${r.slug}`,
          category: (r.category_name as string | null) ?? null,
          image: (r.image_url as string | null) ?? null,
        })),
    }));
  },
  ["landing-areas-v2"],
  { revalidate: 3600, tags: ["listings"] },
);

export async function getLandingAreas(): Promise<LandingArea[]> {
  try {
    return await cachedAreas();
  } catch (error) {
    console.error("Landing areas query failed:", error);
    return AREA_LABELS.map((label) => ({
      name: label,
      countLabel: null,
      href: areaHref(label),
      places: [],
    }));
  }
}
