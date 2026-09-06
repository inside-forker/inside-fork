/**
 * Deal-first catalog helpers for GET /api/mobile/v1/deals.
 * Shapes rows to match the mobile `DealPreview` contract.
 *
 * Peekaboo stores its own `typeId`s in `valid_card_variants` — those often
 * do NOT equal our `card_variants.id`. Resolution order mirrors
 * `app/api/bank-cards`: id lookup, then name match via metadata.card_associations
 * within the deal's bank, then bank-name display fallback.
 */

import { mapListingToDealCategory } from "@/lib/mobile/deal-category";

export type DealCardMatchDTO = {
  cardVariantId: number;
  bankId: number;
  label: string;
};

export type MobileDealPreviewDTO = {
  id: string;
  merchant: string;
  category: string;
  subCategory?: string;
  discountLabel: string;
  discountWeight: number;
  discountPercent: number | null;
  cardMatches: DealCardMatchDTO[];
  /** Deal's bank when known — used for logos / bank-wide For You matching. */
  bankId: number | null;
  bankName: string | null;
  /**
   * True when we could not pin specific local card products — any saved card
   * from `bankId` should unlock this deal in For You.
   */
  matchByBank: boolean;
  blurb: string;
  latitude: number | null;
  longitude: number | null;
  expiryDaysLeft: number | null;
  terms: string;
  imageUrl?: string;
  listingSlug?: string;
};

export type CardAssociation = {
  typeId?: number;
  name?: string;
};

/** Parse `discount_value` like "20%" / "BOGO" into percent + sort weight. */
export function parseDiscountValue(raw: string | null | undefined): {
  label: string;
  percent: number | null;
  weight: number;
} {
  const full = (raw ?? "").trim() || "Special Offer";
  // Peekaboo often packs terms into discount_value ("30% OFF * Max cap…") —
  // show the leading offer figure, not the whole terms blob.
  const short = full.split(/\s*\*\s*/)[0]?.trim() || full;
  const label = short.length > 48 ? `${short.slice(0, 45)}…` : short;

  const match = full.match(/(\d+)\s*%/);
  if (match) {
    const percent = parseInt(match[1], 10);
    return { label, percent, weight: percent };
  }
  if (/bogo|buy\s*1/i.test(full)) {
    return { label, percent: null, weight: 60 };
  }
  const rs = full.match(/(?:rs\.?|pkr)\s*([\d,]+)/i);
  if (rs) {
    return { label, percent: null, weight: 40 };
  }
  return { label, percent: null, weight: 35 };
}

export function expiryDaysLeftFromEnd(
  endDate: Date | string | null | undefined,
  now = new Date(),
): number | null {
  if (!endDate) return null;
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export type DealFeedRow = {
  id: number | string;
  title: string;
  description: string | null;
  discount_value: string | null;
  bank_id: number | string | null;
  bank_name?: string | null;
  valid_card_variants: number[] | null;
  metadata?: unknown;
  end_date: Date | string | null;
  merchant: string | null;
  listing_slug: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  category_name: string | null;
  category_slug: string | null;
};

export type CardVariantLookup = {
  id: number;
  bankId: number;
  label: string;
};

export function normalizeCardName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function cardAssociationsFromMetadata(
  metadata: unknown,
): CardAssociation[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as Record<string, unknown>).card_associations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is CardAssociation => !!a && typeof a === "object",
  ) as CardAssociation[];
}

/**
 * Resolve Peekaboo / local card refs into `cardMatches` using our catalog.
 */
export function resolveCardMatches(
  row: DealFeedRow,
  cardById: Map<number, CardVariantLookup>,
  cardsByBankName: Map<string, CardVariantLookup>,
): { matches: DealCardMatchDTO[]; matchByBank: boolean } {
  const bankId =
    row.bank_id != null && row.bank_id !== ""
      ? Number(row.bank_id)
      : null;
  const bankName = (row.bank_name ?? "").trim() || null;

  const variantIds = Array.isArray(row.valid_card_variants)
    ? row.valid_card_variants.map(Number).filter((n) => Number.isFinite(n))
    : [];

  const associations = cardAssociationsFromMetadata(row.metadata);
  const matches: DealCardMatchDTO[] = [];
  const seen = new Set<number>();

  const push = (cv: CardVariantLookup) => {
    if (seen.has(cv.id)) return;
    seen.add(cv.id);
    matches.push({
      cardVariantId: cv.id,
      bankId: cv.bankId,
      label: cv.label,
    });
  };

  // 1) Direct id hit (works when valid_card_variants already stores local ids)
  for (const vid of variantIds) {
    const cv = cardById.get(vid);
    if (cv) push(cv);
  }

  // 2) Name match via Peekaboo associations within this bank
  if (bankId != null && Number.isFinite(bankId)) {
    for (const assoc of associations) {
      const name = typeof assoc.name === "string" ? assoc.name.trim() : "";
      if (!name) continue;
      const key = `${bankId}::${normalizeCardName(name)}`;
      const cv = cardsByBankName.get(key);
      if (cv) push(cv);
    }

    // 3) If ids missed but associations listed typeIds, try name-only across
    //    the bank when the association name is present (already done above).
  }

  // 4) Still empty — surface bank for display; For You matches any card at bank
  if (matches.length === 0 && bankId != null && Number.isFinite(bankId)) {
    matches.push({
      cardVariantId: 0,
      bankId,
      label: bankName || "Bank card",
    });
    return { matches, matchByBank: true };
  }

  // Resolved specific products — still treat as bank-wide if Peekaboo listed
  // zero specific cards (bank-level deal).
  const matchByBank =
    matches.length > 0 &&
    variantIds.length === 0 &&
    associations.length === 0;

  return { matches, matchByBank };
}

export function toMobileDealPreview(
  row: DealFeedRow,
  cardById: Map<number, CardVariantLookup>,
  cardsByBankName: Map<string, CardVariantLookup>,
  imageUrl: string | undefined,
  now = new Date(),
): MobileDealPreviewDTO | null {
  const merchant = (row.merchant ?? "").trim();
  if (!merchant) return null;

  const { label, percent, weight } = parseDiscountValue(row.discount_value);
  const { category, subCategory } = mapListingToDealCategory(
    row.category_slug,
    row.category_name,
  );

  const bankId =
    row.bank_id != null && row.bank_id !== ""
      ? Number(row.bank_id)
      : null;
  const bankName = (row.bank_name ?? "").trim() || null;

  const { matches: cardMatches, matchByBank } = resolveCardMatches(
    row,
    cardById,
    cardsByBankName,
  );

  const lat =
    row.latitude !== null && row.latitude !== undefined && row.latitude !== ""
      ? Number(row.latitude)
      : null;
  const lng =
    row.longitude !== null && row.longitude !== undefined && row.longitude !== ""
      ? Number(row.longitude)
      : null;

  const blurb =
    (row.description ?? "").trim() ||
    (row.title ?? "").trim() ||
    `${label} at ${merchant}`;
  const terms =
    (row.description ?? "").trim() ||
    (row.title ?? "").trim() ||
    "See merchant for terms and conditions.";

  const dto: MobileDealPreviewDTO = {
    id: String(row.id),
    merchant,
    category,
    discountLabel: label,
    discountWeight: weight,
    discountPercent: percent,
    cardMatches,
    bankId: bankId != null && Number.isFinite(bankId) ? bankId : null,
    bankName,
    matchByBank,
    blurb,
    latitude: lat !== null && Number.isFinite(lat) ? lat : null,
    longitude: lng !== null && Number.isFinite(lng) ? lng : null,
    expiryDaysLeft: expiryDaysLeftFromEnd(row.end_date, now),
    terms,
  };
  if (subCategory) dto.subCategory = subCategory;
  if (imageUrl) dto.imageUrl = imageUrl;
  if (row.listing_slug) dto.listingSlug = row.listing_slug;
  return dto;
}
