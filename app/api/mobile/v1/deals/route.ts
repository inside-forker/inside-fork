import { type NextRequest, NextResponse } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { collapseDealsByListing } from "@/lib/mobile/deals-feed";
import {
  getCompiledCatalog,
  getEndingSoonCatalog,
} from "@/lib/mobile/deals-catalog";
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
  const bankIdsRaw = searchParams.get("bankIds");
  const cardVariantIdRaw = searchParams.get("cardVariantId");
  const categoryRaw = searchParams.get("category");
  const endingSoonRaw = searchParams.get("endingSoonDays");
  const rawSearch = searchParams.get("search");
  const sanitizedSearch =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";

  // `bankId` is one bank; `bankIds` is a comma list for multi-bank browsing.
  // Both feed the same set, so either (or both) narrows to "any of these banks".
  const bankIdSet = new Set<number>();
  for (const raw of [bankIdRaw, ...(bankIdsRaw ? bankIdsRaw.split(",") : [])]) {
    const v = raw?.trim();
    if (v && /^\d+$/.test(v)) bankIdSet.add(parseInt(v, 10));
  }
  const bankFilter = bankIdSet.size > 0 ? bankIdSet : null;
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
  // Listing-centric lists (All Deals): collapse after filters. Catalog stream
  // omits this so card-matching still sees every deal row.
  const groupByListing = searchParams.get("groupBy") === "listing";

  // Pure ending-soon (Home rail): skip LIMIT 3000 catalog compile.
  const endingSoonOnly =
    endingSoonDays != null &&
    !sanitizedSearch &&
    bankFilter === null &&
    cardVariantId === null &&
    categoryFilter === null;

  const catalog = endingSoonOnly
    ? await getEndingSoonCatalog(endingSoonDays)
    : await getCompiledCatalog();

  // Fast-path: Unfiltered request with matching ETag -> 304 Not Modified.
  // Skip when groupBy=listing — same ETag as the deal-first catalog would
  // incorrectly 304 a client holding an ungrouped body.
  const ifNoneMatch = request.headers.get("if-none-match");
  const isUnfiltered =
    !sanitizedSearch &&
    bankFilter === null &&
    cardVariantId === null &&
    categoryFilter === null &&
    endingSoonDays === null &&
    !groupByListing &&
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

  if (bankFilter != null) {
    deals = deals.filter(
      (d) =>
        (d.bankId != null && bankFilter.has(d.bankId)) ||
        d.cardMatches.some((m) => bankFilter.has(m.bankId)),
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

  if (groupByListing) {
    deals = collapseDealsByListing(deals);
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
