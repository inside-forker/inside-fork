import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";
import {
  SISTER_BANK_MAP,
  normalizeCardName,
  parseDiscountValue,
  resolveCardMatches,
  type CardVariantLookup,
  type DealFeedRow,
} from "@/lib/mobile/deals-feed";
import { extractArea } from "@/lib/outing/templates";
import { normalizeSearchText } from "@/lib/utils/places-search";

export type SupportedBank = {
  id: number;
  name: string;
  logoUrl: string | null;
  /** Number of distinct places with a live deal on this bank. */
  places: number;
  /** Total number of live deals on this bank. */
  dealsCount: number;
  /** Backwards compatible alias */
  offers: number;
};

/**
 * Every bank the platform supports, with how many places currently have a
 * live deal on it (active and not ended, the same rule as the listings deals
 * filter). Busiest first, then A-Z, like the app's bank index.
 */
export const getSupportedBanks = unstable_cache(
  async (): Promise<SupportedBank[]> => {
    try {
      const [{ rows: banksRows }, { rows: allCards }, { rows: dealRows }] =
        await Promise.all([
          query(
            `SELECT id, name, logo_url, code FROM banks ORDER BY name ASC`,
          ),
          query(
            `SELECT id, bank_id, card_name FROM card_variants WHERE is_active = true`,
          ),
          query(`
            SELECT d.id, d.bank_id, d.listing_id, d.valid_card_variants, d.metadata
            FROM deals d
            INNER JOIN listings l ON l.id = d.listing_id
            WHERE d.is_active = true
              AND l.status = 'published'
              AND (d.start_date IS NULL OR d.start_date <= NOW())
              AND (d.end_date IS NULL OR d.end_date >= NOW())
          `),
        ]);

      const cardById = new Map<
        number,
        { id: number; bankId: number; label: string }
      >();
      const cardsByBankName = new Map<
        string,
        { id: number; bankId: number; label: string }
      >();

      for (const c of allCards) {
        const id = Number(c.id);
        const lookup = {
          id,
          bankId: Number(c.bank_id),
          label: String(c.card_name || "Card"),
        };
        cardById.set(id, lookup);
        cardsByBankName.set(
          `${lookup.bankId}::${normalizeCardName(lookup.label)}`,
          lookup,
        );
      }

      const placesByBank: Record<number, Set<number>> = {};
      const dealsByBank: Record<number, number> = {};

      for (const row of dealRows) {
        const bankId = row.bank_id != null ? Number(row.bank_id) : null;
        const variantIds = Array.isArray(row.valid_card_variants)
          ? row.valid_card_variants.map(Number)
          : [];
        const metadata = row.metadata as Record<string, unknown> | null;
        const associations = (
          Array.isArray(metadata?.card_associations)
            ? metadata.card_associations
            : []
        ).filter(Boolean) as Array<{ name?: string }>;
        const candidateBankIds = [
          bankId,
          ...(bankId ? SISTER_BANK_MAP[bankId] || [] : []),
        ].filter((id): id is number => id !== null && Number.isFinite(id));

        const matches: Array<{ id: number; bankId: number; label: string }> = [];
        const seen = new Set<number>();
        const push = (cv: { id: number; bankId: number; label: string }) => {
          if (seen.has(cv.id)) return;
          seen.add(cv.id);
          matches.push(cv);
        };

        for (const vid of variantIds) {
          const cv = cardById.get(vid);
          if (cv) push(cv);
        }

        for (const bid of candidateBankIds) {
          for (const assoc of associations) {
            if (!assoc?.name) continue;
            const norm = normalizeCardName(assoc.name);
            const cv = cardsByBankName.get(`${bid}::${norm}`);
            if (cv) push(cv);
          }
        }

        const matchedBankIds = new Set<number>();
        if (bankId) matchedBankIds.add(bankId);
        for (const m of matches) {
          matchedBankIds.add(m.bankId);
        }

        const lid = Number(row.listing_id);
        for (const bid of matchedBankIds) {
          dealsByBank[bid] = (dealsByBank[bid] || 0) + 1;
          if (!placesByBank[bid]) placesByBank[bid] = new Set<number>();
          if (lid) placesByBank[bid].add(lid);
        }
      }

      return banksRows
        .map((b) => {
          const id = Number(b.id);
          const dealsCount = dealsByBank[id] || 0;
          const places = placesByBank[id]?.size || 0;
          return {
            id,
            name: String(b.name),
            logoUrl: (b.logo_url as string | null) || null,
            places,
            dealsCount,
            offers: places,
          };
        })
        .sort(
          (a, b) =>
            b.dealsCount - a.dealsCount ||
            b.places - a.places ||
            a.name.localeCompare(b.name),
        );
    } catch (error) {
      console.error("Supported banks query failed:", error);
      return [];
    }
  },
  ["homepage-supported-banks-v3"],
  { revalidate: 300, tags: ["deals"] },
);

export type HomepageOffer = {
  id: number;
  merchant: string;
  listingSlug: string;
  /** Neighbourhood read off the address, when one is recognised. */
  area: string | null;
  imageUrl: string | null;
  /** "30% OFF", "BOGO": the leading offer figure. */
  discountLabel: string;
  bankName: string;
  bankLogoUrl: string | null;
  /** Which of the bank's cards: "Any card", "Visa Gold Debit Card", "14 eligible cards". */
  cardLabel: string;
  /** The clause that names the days, when the terms state one. */
  days: string | null;
  /** "Rs 2,500", when the terms state a cap. */
  cap: string | null;
  endDate: string | null;
};

// Same day words the app's deal sheet lifts out of terms.
const DAYS =
  /\b(?:every\s?day|daily|weekdays?|weekends?|(?:mon|tues|wednes|thurs|fri|satur|sun)days?|mon|tue|wed|thu|fri|sat|sun)\b/i;
const CAP_AFTER = /\bcap\w*\b[^0-9]{0,24}?(?:rs\.?|pkr)\s*([\d,]+)/i;
const CAP_BEFORE = /(?:rs\.?|pkr)\s*([\d,]+)\s*(?:max(?:imum)?\s*)?cap/i;

/** Terms are free text; Peekaboo packs clauses into `discount_value` with "*". */
function clauses(...texts: Array<string | null>): string[] {
  return texts
    .flatMap((t) => (t ?? "").split(/\n|\*|•|;/))
    .map((c) => c.replace(/^[\s\-–•]+/, "").trim())
    .filter(Boolean);
}

function readCap(all: string[]): string | null {
  for (const clause of all) {
    const match = clause.match(CAP_AFTER) ?? clause.match(CAP_BEFORE);
    if (match) return `Rs ${match[1].replace(/,+$/, "")}`;
  }
  return null;
}

function readDays(all: string[]): string | null {
  const clause = all.find((c) => c.length <= 40 && DAYS.test(c));
  if (!clause) return null;
  // Titles restate the figure ("60% off Everyday"); the card already shows it
  const tidy = clause
    .replace(/^(?:up\s*to\s*|flat\s*)?\d{1,3}\s*%\s*(?:off\s*)?(?:on\s*)?/i, "")
    .replace(/\.$/, "")
    .trim();
  return tidy ? tidy[0].toUpperCase() + tidy.slice(1) : null;
}

/** Up to `limit` items, one bank at a time, so no single bank fills the row. */
function spreadAcrossBanks<T extends { bank_id: unknown }>(rows: T[], limit: number): T[] {
  const byBank = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row.bank_id);
    const list = byBank.get(key) ?? [];
    list.push(row);
    byBank.set(key, list);
  }
  const queues = [...byBank.values()];
  const picked: T[] = [];
  while (picked.length < limit && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) picked.push(next);
      if (picked.length === limit) break;
    }
  }
  return picked;
}

/**
 * A handful of live card offers for the landing page: one per place, the
 * place's best offer, biggest discounts first and spread across banks. Live
 * means the deals feed's rule (active, started, not ended).
 */
export const getHomepageOffers = unstable_cache(
  async (limit = 6): Promise<HomepageOffer[]> => {
    try {
      const { rows } = await query(
        `WITH best AS (
           SELECT DISTINCT ON (l.id)
                  d.id, d.title, d.description, d.discount_value,
                  to_json(d.end_date) #>> '{}' AS end_date,
                  d.bank_id, d.valid_card_variants, d.metadata,
                  b.name AS bank_name, b.logo_url AS bank_logo_url,
                  l.id AS listing_id, l.name AS merchant, l.slug AS listing_slug,
                  l.address,
                  (regexp_match(d.discount_value, '(\\d{1,3})\\s*%'))[1]::integer AS pct
             FROM deals d
             JOIN listings l ON l.id = d.listing_id AND l.status = 'published'
             JOIN banks b ON b.id = d.bank_id
            WHERE d.is_active = true
              AND (d.start_date IS NULL OR d.start_date <= NOW())
              AND (d.end_date IS NULL OR d.end_date >= NOW())
            ORDER BY l.id, pct DESC NULLS LAST, d.end_date ASC NULLS LAST
         )
         SELECT best.*, img.url AS image_url
           FROM best
           LEFT JOIN LATERAL (
             SELECT li.url FROM listing_images li
              WHERE li.listing_id = best.listing_id
              ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
              LIMIT 1
           ) img ON true
          ORDER BY (img.url IS NULL), pct DESC NULLS LAST, best.end_date ASC NULLS LAST
          LIMIT 60`,
      );

      const picked = spreadAcrossBanks(rows, limit);
      if (picked.length === 0) return [];

      // Sister banks too (HBL / HBL Islamic...), which card matching also checks
      const bankIds = [
        ...new Set(
          picked.flatMap((r) => [
            Number(r.bank_id),
            ...(SISTER_BANK_MAP[Number(r.bank_id)] || []),
          ]),
        ),
      ];
      const variantIds = [
        ...new Set(
          picked.flatMap((r) =>
            Array.isArray(r.valid_card_variants)
              ? r.valid_card_variants.map(Number).filter(Number.isFinite)
              : [],
          ),
        ),
      ];
      const { rows: cards } = await query(
        `SELECT id, bank_id, card_name FROM card_variants
          WHERE is_active = true
            AND (bank_id = ANY($1::bigint[]) OR id = ANY($2::bigint[]))`,
        [bankIds, variantIds.length ? variantIds : [0]],
      );
      const cardById = new Map<number, CardVariantLookup>();
      const cardsByBankName = new Map<string, CardVariantLookup>();
      for (const c of cards) {
        const lookup: CardVariantLookup = {
          id: Number(c.id),
          bankId: Number(c.bank_id),
          label: String(c.card_name ?? "Card"),
        };
        cardById.set(lookup.id, lookup);
        cardsByBankName.set(
          `${lookup.bankId}::${normalizeCardName(lookup.label)}`,
          lookup,
        );
      }

      return picked.map((row) => {
        const bankName = String(row.bank_name);
        const { matches, matchByBank } = resolveCardMatches(
          row as DealFeedRow,
          cardById,
          cardsByBankName,
        );
        const named = matches.filter((m) => m.cardVariantId !== 0);
        const cardLabel =
          matchByBank || named.length === 0
            ? "Any card"
            : named.length === 1
              ? named[0].label
              : `${named.length} eligible cards`;
        const { label } = parseDiscountValue(row.discount_value);
        const terms = clauses(row.discount_value, row.title, row.description);

        return {
          id: Number(row.id),
          merchant: String(row.merchant),
          listingSlug: String(row.listing_slug),
          area: row.address
            ? extractArea(normalizeSearchText(String(row.address)))
            : null,
          imageUrl: (row.image_url as string | null) || null,
          // A bare figure ("60%") reads as a stat; say what it is
          discountLabel: /^\d{1,3}\s*%$/.test(label) ? `${label} off` : label,
          bankName,
          bankLogoUrl: (row.bank_logo_url as string | null) || null,
          cardLabel,
          days: readDays(terms),
          cap: readCap(terms),
          endDate: (row.end_date as string | null) || null,
        };
      });
    } catch (error) {
      console.error("Homepage offers query failed:", error);
      return [];
    }
  },
  ["homepage-offers-v2"],
  { revalidate: 300, tags: ["deals"] },
);
