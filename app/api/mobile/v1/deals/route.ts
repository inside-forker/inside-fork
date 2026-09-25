import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  normalizeCardName,
  toMobileDealPreview,
  type CardVariantLookup,
  type DealFeedRow,
  type MobileDealPreviewDTO,
} from "@/lib/mobile/deals-feed";
import type { MobileDealCategory } from "@/lib/mobile/deal-category";
import { resolveListingCovers } from "@/lib/mobile/listing-covers";

export const dynamic = "force-dynamic";

const DEAL_CATEGORIES = new Set<MobileDealCategory>([
  "dining",
  "shopping",
  "beauty",
  "hotels",
  "entertainment",
  "travel",
]);

type DealSqlRow = DealFeedRow & { listing_id: number | string };

type CompiledCatalog = {
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
         l.category_name,
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
    bankIds.length > 0 || variantIdSet.size > 0
      ? query(
          `SELECT id, bank_id, card_name
           FROM card_variants
           WHERE is_active = true
             AND (
               bank_id = ANY($1::bigint[])
               OR id = ANY($2::bigint[])
             )`,
          [bankIds.length ? bankIds : [0], [...variantIdSet].length ? [...variantIdSet] : [0]],
        ).catch((error) => {
          console.error(
            "[mobile-api] deals card_variants lookup failed:",
            error instanceof Error ? error.message : error,
          );
          return { rows: [] };
        })
      : Promise.resolve({ rows: [] }),
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
              { candidateCap: 1 },
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

  const dealsByListing = new Map<string, MobileDealPreviewDTO[]>();
  for (const dto of mapped) {
    const key =
      dto.listingId != null ? `listing:${dto.listingId}` : `merchant:${dto.merchant}`;
    const group = dealsByListing.get(key);
    if (group) {
      group.push(dto);
    } else {
      dealsByListing.set(key, [dto]);
    }
  }

  const groupedDeals: MobileDealPreviewDTO[] = [];
  for (const list of dealsByListing.values()) {
    list.sort((a, b) => b.discountWeight - a.discountWeight);
    const primary = { ...list[0] };
    if (list.length > 1) {
      const siblings = list.slice(1);
      primary.otherDealsCount = siblings.length;
      primary.otherDeals = siblings.map((d) => ({
        id: d.id,
        merchant: d.merchant,
      }));
    }
    groupedDeals.push(primary);
  }

  return groupedDeals;
}

function etagForDeals(groupedDeals: MobileDealPreviewDTO[], prefix: string): string {
  // Bump when the serialized shape changes, not just the data: the hash below
  // only covers ids/labels, so without this a client holding a body from an
  // older shape would revalidate into a 304 and keep it.
  const PAYLOAD_SHAPE_VERSION = "v3-location-name";

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
       INNER JOIN listings_with_details l ON l.id = d.listing_id
       LEFT JOIN banks b ON b.id = d.bank_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY d.created_at DESC
       LIMIT 3000`,
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
       INNER JOIN listings_with_details l ON l.id = d.listing_id
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

async function getCompiledCatalog(): Promise<CompiledCatalog> {
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

async function getEndingSoonCatalog(days: number): Promise<CompiledCatalog> {
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

/**
 * GET /api/mobile/v1/deals
 *
 * Pre-compiled, cached deal-first catalog for the mobile Discounts tab.
 * Supports single-request downloads (up to 2000 items), ETag / 304 Not Modified,
 * and 5-minute background compilation.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 100,
    maxLimit: 100,
  });

  const bankIdRaw = searchParams.get("bankId");
  const cardVariantIdRaw = searchParams.get("cardVariantId");
  const categoryRaw = searchParams.get("category");
  const endingSoonRaw = searchParams.get("endingSoonDays");
  const rawSearch = searchParams.get("search");
  const sanitizedSearch =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";

  const bankId =
    bankIdRaw && /^\d+$/.test(bankIdRaw) ? parseInt(bankIdRaw, 10) : null;
  const cardVariantId =
    cardVariantIdRaw && /^\d+$/.test(cardVariantIdRaw)
      ? parseInt(cardVariantIdRaw, 10)
      : null;
  const categoryFilter =
    categoryRaw && DEAL_CATEGORIES.has(categoryRaw as MobileDealCategory)
      ? (categoryRaw as MobileDealCategory)
      : null;
  const endingSoonDays =
    endingSoonRaw && /^\d+$/.test(endingSoonRaw)
      ? Math.min(parseInt(endingSoonRaw, 10), 90)
      : null;

  // Pure ending-soon (Home rail): skip LIMIT 3000 catalog compile.
  const endingSoonOnly =
    endingSoonDays != null &&
    !sanitizedSearch &&
    bankId === null &&
    cardVariantId === null &&
    categoryFilter === null;

  const catalog = endingSoonOnly
    ? await getEndingSoonCatalog(endingSoonDays)
    : await getCompiledCatalog();

  // Fast-path: Unfiltered request with matching ETag -> 304 Not Modified
  const ifNoneMatch = request.headers.get("if-none-match");
  const isUnfiltered =
    !sanitizedSearch &&
    bankId === null &&
    cardVariantId === null &&
    categoryFilter === null &&
    endingSoonDays === null &&
    page === 1;

  if (isUnfiltered && ifNoneMatch && ifNoneMatch === catalog.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: catalog.etag,
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  }

  let deals = catalog.deals;

  if (sanitizedSearch) {
    const q = sanitizedSearch.toLowerCase();
    deals = deals.filter(
      (d) =>
        d.merchant.toLowerCase().includes(q) ||
        d.discountLabel.toLowerCase().includes(q) ||
        d.blurb.toLowerCase().includes(q) ||
        (d.bankName && d.bankName.toLowerCase().includes(q)) ||
        d.category.toLowerCase().includes(q),
    );
  }

  if (categoryFilter) {
    deals = deals.filter((d) => d.category === categoryFilter);
  }

  if (cardVariantId != null) {
    deals = deals.filter((d) =>
      d.cardMatches.some((m) => m.cardVariantId === cardVariantId),
    );
  }

  if (bankId != null) {
    deals = deals.filter(
      (d) =>
        d.bankId === bankId || d.cardMatches.some((m) => m.bankId === bankId),
    );
  }

  // endingSoonOnly already filtered + sorted in SQL; skip re-filter.
  if (endingSoonDays != null && !endingSoonOnly) {
    deals = deals
      .filter(
        (d) =>
          d.expiryDaysLeft !== null &&
          d.expiryDaysLeft >= 0 &&
          d.expiryDaysLeft <= endingSoonDays,
      )
      .sort(
        (a, b) => (a.expiryDaysLeft ?? 0) - (b.expiryDaysLeft ?? 0),
      );
  }

  const totalItems = deals.length;
  const pageSlice = deals.slice(offset, offset + limit);

  return ok(
    pageSlice,
    {
      pagination: buildPaginationMeta(page, limit, totalItems),
    },
    {
      headers: {
        ETag: catalog.etag,
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    },
  );
});
