/**
 * The compiled, cached deal-first catalog behind GET /api/mobile/v1/deals and
 * the web /discounts page. One in-memory cache per server instance, rebuilt
 * every five minutes, so both surfaces share a single compile.
 */
import { createHash } from "crypto";
import { query } from "@/lib/db";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  normalizeCardName,
  toMobileDealPreview,
  type CardVariantLookup,
  type DealFeedRow,
  type MobileDealPreviewDTO,
} from "@/lib/mobile/deals-feed";
import { resolveListingCovers } from "@/lib/mobile/listing-covers";

type DealSqlRow = DealFeedRow & { listing_id: number | string };

export type CompiledCatalog = {
  deals: MobileDealPreviewDTO[];
  etag: string;
  compiledAt: number;
};

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** Cap for ending-soon SQL — Home asks for 8; 200 is plenty after merchant grouping. */
const ENDING_SOON_SQL_CAP = 200;
const DEAL_SELECT = `
         d.id,
         d.listing_id,
         d.title,
         d.description,
         d.discount_value,
         d.bank_id,
         d.valid_card_variants,
         d.metadata,
         d.end_date,
         b.name AS bank_name,
         l.name AS merchant,
         l.slug AS listing_slug,
         l.latitude,
         l.longitude,
         c.name AS category_name,
         l.address,
         c.slug AS category_slug`;

let compiledCache: CompiledCatalog | null = null;
let inflightCompilePromise: Promise<CompiledCatalog> | null = null;
const endingSoonCache = new Map<number, CompiledCatalog>();
const endingSoonInflight = new Map<number, Promise<CompiledCatalog>>();

async function enrichAndGroupDeals(
  dealRows: DealSqlRow[],
): Promise<MobileDealPreviewDTO[]> {
  const variantIdSet = new Set<number>();
  const bankIdSet = new Set<number>();
  const listingIds: number[] = [];

  for (const row of dealRows) {
    listingIds.push(Number(row.listing_id));
    if (row.bank_id != null) {
      const bid = Number(row.bank_id);
      if (Number.isFinite(bid)) bankIdSet.add(bid);
    }
    if (Array.isArray(row.valid_card_variants)) {
      for (const v of row.valid_card_variants) {
        const n = Number(v);
        if (Number.isFinite(n)) variantIdSet.add(n);
      }
    }
  }

  const uniqueListingIds = [...new Set(listingIds.filter(Number.isFinite))];
  const bankIds = [...bankIdSet];
  const cardById = new Map<number, CardVariantLookup>();
  const cardsByBankName = new Map<string, CardVariantLookup>();
  const imageByListingId = new Map<number, string>();

  const [cardsResult, covers] = await Promise.all([
    query(
      `SELECT id, bank_id, card_name
       FROM card_variants
       WHERE is_active = true`,
    ).catch((error) => {
      console.error(
        "[mobile-api] deals card_variants lookup failed:",
        error instanceof Error ? error.message : error,
      );
      return { rows: [] };
    }),
    uniqueListingIds.length > 0
      ? (async () => {
          const nameById = new Map<number, string | null>();
          for (const row of dealRows) {
            const id = Number(row.listing_id);
            if (!Number.isFinite(id) || nameById.has(id)) continue;
            nameById.set(
              id,
              typeof row.merchant === "string" ? row.merchant : null,
            );
          }
          try {
            return await resolveListingCovers(
              uniqueListingIds.map((id) => ({
                id,
                name: nameById.get(id) ?? null,
              })),
              { candidateCap: 1, skipBorrow: true },
            );
          } catch (error) {
            console.error(
              "[mobile-api] deals covers lookup failed:",
              error instanceof Error ? error.message : error,
            );
            return new Map();
          }
        })()
      : Promise.resolve(new Map()),
  ]);

  for (const c of cardsResult.rows) {
    const id = Number(c.id);
    const lookup: CardVariantLookup = {
      id,
      bankId: Number(c.bank_id),
      label: String(c.card_name ?? "Card"),
    };
    cardById.set(id, lookup);
    cardsByBankName.set(
      `${lookup.bankId}::${normalizeCardName(lookup.label)}`,
      lookup,
    );
  }

  for (const [listingId, cover] of covers) {
    if (cover.headerUrl) imageByListingId.set(listingId, cover.headerUrl);
  }

  const now = new Date();
  const mapped: MobileDealPreviewDTO[] = [];
  for (const row of dealRows) {
    const listingId = Number(row.listing_id);
    const imageUrl = Number.isFinite(listingId)
      ? imageByListingId.get(listingId)
      : undefined;
    const dto = toMobileDealPreview(
      row,
      cardById,
      cardsByBankName,
      imageUrl,
      now,
    );
    if (dto) mapped.push(dto);
  }

  // Preserve all deals across banks and card tiers so bank filters and card matching
  // work accurately for every card variant and bank.
  mapped.sort((a, b) => b.discountWeight - a.discountWeight);
  return mapped;
}

function etagForDeals(groupedDeals: MobileDealPreviewDTO[], prefix: string): string {
  // Bump when the serialized shape changes, not just the data: the hash below
  // only covers ids/labels, so without this a client holding a body from an
  // older shape would revalidate into a 304 and keep it.
  const PAYLOAD_SHAPE_VERSION = "v4-full-active-deals";

  const hashContent =
    `${PAYLOAD_SHAPE_VERSION}|${prefix}|` +
    groupedDeals
      .slice(0, 50)
      .map((d) => `${d.id}:${d.discountLabel}`)
      .join("|") +
    `:${groupedDeals.length}`;
  return `W/"deals-${createHash("md5").update(hashContent).digest("hex")}"`;
}

async function compileFullCatalog(): Promise<CompiledCatalog> {
  const where: string[] = [
    "d.is_active = true",
    "l.status = 'published'",
    "(d.start_date IS NULL OR d.start_date <= NOW())",
    "(d.end_date IS NULL OR d.end_date >= NOW())",
  ];

  let dealRows: DealSqlRow[];
  try {
    const { rows } = await query(
      `SELECT ${DEAL_SELECT}
       FROM deals d
       INNER JOIN listings l ON l.id = d.listing_id
       LEFT JOIN banks b ON b.id = d.bank_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY d.created_at DESC
       LIMIT 10000`,
      [],
    );
    dealRows = rows as DealSqlRow[];
  } catch (error) {
    console.error(
      "[mobile-api] deals feed compilation query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load deals.", 500);
  }

  const groupedDeals = await enrichAndGroupDeals(dealRows);
  const result: CompiledCatalog = {
    deals: groupedDeals,
    etag: etagForDeals(groupedDeals, "full"),
    compiledAt: Date.now(),
  };

  compiledCache = result;
  return result;
}

/**
 * Home "Ending soon" rail only needs ~8 rows. Compiling the full LIMIT 3000
 * catalog just to filter by expiry is the dominant deals-API cost on Home.
 */
async function compileEndingSoonCatalog(days: number): Promise<CompiledCatalog> {
  let dealRows: DealSqlRow[];
  try {
    const { rows } = await query(
      `SELECT ${DEAL_SELECT}
       FROM deals d
       INNER JOIN listings l ON l.id = d.listing_id
       LEFT JOIN banks b ON b.id = d.bank_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE d.is_active = true
         AND l.status = 'published'
         AND (d.start_date IS NULL OR d.start_date <= NOW())
         AND d.end_date IS NOT NULL
         AND d.end_date >= NOW()
         AND d.end_date <= NOW() + make_interval(days => $1::int)
       ORDER BY d.end_date ASC
       LIMIT $2`,
      [days, ENDING_SOON_SQL_CAP],
    );
    dealRows = rows as DealSqlRow[];
  } catch (error) {
    console.error(
      "[mobile-api] ending-soon deals query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load deals.", 500);
  }

  const groupedDeals = await enrichAndGroupDeals(dealRows);
  // Keep SQL order (soonest first) after merchant grouping.
  const byIdOrder = new Map(
    dealRows.map((r, i) => [String(r.id), i]),
  );
  groupedDeals.sort((a, b) => {
    const daysA = a.expiryDaysLeft ?? Number.POSITIVE_INFINITY;
    const daysB = b.expiryDaysLeft ?? Number.POSITIVE_INFINITY;
    if (daysA !== daysB) return daysA - daysB;
    return (byIdOrder.get(a.id) ?? 0) - (byIdOrder.get(b.id) ?? 0);
  });

  return {
    deals: groupedDeals,
    etag: etagForDeals(groupedDeals, `ending-${days}`),
    compiledAt: Date.now(),
  };
}

export async function getCompiledCatalog(): Promise<CompiledCatalog> {
  if (
    compiledCache &&
    Date.now() - compiledCache.compiledAt < CATALOG_CACHE_TTL_MS
  ) {
    return compiledCache;
  }

  if (!inflightCompilePromise) {
    inflightCompilePromise = compileFullCatalog().finally(() => {
      inflightCompilePromise = null;
    });
  }

  return inflightCompilePromise;
}

export async function getEndingSoonCatalog(days: number): Promise<CompiledCatalog> {
  const cached = endingSoonCache.get(days);
  if (cached && Date.now() - cached.compiledAt < CATALOG_CACHE_TTL_MS) {
    return cached;
  }

  let inflight = endingSoonInflight.get(days);
  if (!inflight) {
    inflight = compileEndingSoonCatalog(days)
      .then((result) => {
        endingSoonCache.set(days, result);
        return result;
      })
      .finally(() => {
        endingSoonInflight.delete(days);
      });
    endingSoonInflight.set(days, inflight);
  }

  return inflight;
}
