import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { toListingImage } from "@/lib/mobile/mappers";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  normalizeCardName,
  toMobileDealPreview,
  type CardVariantLookup,
  type DealFeedRow,
  type MobileDealPreviewDTO,
} from "@/lib/mobile/deals-feed";
import type { MobileDealCategory } from "@/lib/mobile/deal-category";

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

/**
 * GET /api/mobile/v1/deals
 *
 * Deal-first catalog for the mobile Discounts tab. Active deals on published
 * listings, shaped as `DealPreview` (merchant, cardMatches, coords, image).
 *
 * Query params:
 * - `search` — ILIKE across merchant, deal title/description/discount, bank, category
 * - `bankId`, `cardVariantId`, `category` — optional filters
 * - `page` / `limit` — pagination
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 100,
    maxLimit: 200,
  });

  const bankIdRaw = searchParams.get("bankId");
  const cardVariantIdRaw = searchParams.get("cardVariantId");
  const categoryRaw = searchParams.get("category");
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

  const where: string[] = [
    "d.is_active = true",
    "l.status = 'published'",
    "(d.start_date IS NULL OR d.start_date <= NOW())",
    "(d.end_date IS NULL OR d.end_date >= NOW())",
  ];
  const params: unknown[] = [];

  if (sanitizedSearch) {
    params.push(`%${sanitizedSearch}%`);
    const i = params.length;
    where.push(`(
      l.name ILIKE $${i}
      OR COALESCE(d.title, '') ILIKE $${i}
      OR COALESCE(d.description, '') ILIKE $${i}
      OR COALESCE(d.discount_value, '') ILIKE $${i}
      OR COALESCE(b.name, '') ILIKE $${i}
      OR COALESCE(l.category_name, '') ILIKE $${i}
      OR COALESCE(c.name, '') ILIKE $${i}
      OR COALESCE(l.address, '') ILIKE $${i}
    )`);
  }

  let dealRows: DealSqlRow[];
  try {
    const { rows } = await query(
      `SELECT
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
         c.slug AS category_slug
       FROM deals d
       INNER JOIN listings_with_details l ON l.id = d.listing_id
       LEFT JOIN banks b ON b.id = d.bank_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY d.created_at DESC
       LIMIT 2000`,
      params,
    );
    dealRows = rows as DealSqlRow[];
  } catch (error) {
    console.error(
      "[mobile-api] deals feed query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load deals.", 500);
  }

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

  const cardById = new Map<number, CardVariantLookup>();
  const cardsByBankName = new Map<string, CardVariantLookup>();

  // Load every active card for banks in this feed so we can name-match
  // Peekaboo associations (typeIds rarely equal our card_variants.id).
  const bankIds = [...bankIdSet];
  if (bankIds.length > 0 || variantIdSet.size > 0) {
    try {
      const { rows: cardRows } = await query(
        `SELECT id, bank_id, card_name
         FROM card_variants
         WHERE is_active = true
           AND (
             bank_id = ANY($1::bigint[])
             OR id = ANY($2::bigint[])
           )`,
        [bankIds.length ? bankIds : [0], [...variantIdSet].length ? [...variantIdSet] : [0]],
      );
      for (const c of cardRows) {
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
    } catch (error) {
      console.error(
        "[mobile-api] deals card_variants lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const imageByListingId = new Map<number, string>();
  if (uniqueListingIds.length > 0) {
    try {
      const { rows: imgRows } = await query(
        `SELECT DISTINCT ON (listing_id)
           listing_id, id, url, alt_text, display_order, is_primary
         FROM listing_images
         WHERE listing_id = ANY($1::bigint[])
           AND url NOT LIKE '%/menu/%'
         ORDER BY listing_id,
           CASE WHEN is_primary THEN 0 ELSE 1 END,
           display_order ASC NULLS LAST,
           id ASC`,
        [uniqueListingIds],
      );
      for (const img of imgRows) {
        const dto = toListingImage({
          id: Number(img.id),
          url: String(img.url),
          alt_text: (img.alt_text as string | null) ?? null,
          display_order:
            img.display_order !== null ? Number(img.display_order) : null,
          is_primary: Boolean(img.is_primary),
        });
        imageByListingId.set(Number(img.listing_id), dto.url);
      }
    } catch (error) {
      console.error(
        "[mobile-api] deals images lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
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
    if (!dto) continue;

    if (categoryFilter && dto.category !== categoryFilter) continue;

    if (cardVariantId != null) {
      const okVariant =
        dto.cardMatches.some((m) => m.cardVariantId === cardVariantId) ||
        (dto.matchByBank &&
          dto.bankId != null &&
          cardById.get(cardVariantId)?.bankId === dto.bankId);
      if (!okVariant) continue;
    }

    if (bankId != null) {
      const bankMatch =
        dto.bankId === bankId ||
        dto.cardMatches.some((m) => m.bankId === bankId);
      if (!bankMatch) continue;
    }

    mapped.push(dto);
  }

  const totalItems = mapped.length;
  const pageSlice = mapped.slice(offset, offset + limit);

  return ok(pageSlice, {
    pagination: buildPaginationMeta(page, limit, totalItems),
  });
});
