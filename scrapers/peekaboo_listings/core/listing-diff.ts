/**
 * Field-level diff for Peekaboo report mode.
 * Compares mapped Peekaboo data against an existing Inside listing row.
 * Does not include categories, status, prices, or guest capacity.
 */

import type { MappedDeal, MappedListing } from "@/types/peekaboo-scraper.types";

export type ListingDiffRow = {
  name: string | null;
  description: string | null;
  address: string | null;
  phone_number: string | null;
  website: string | null;
  email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  youtube_url: string | null;
};

const DIFF_FIELDS = [
  "name",
  "description",
  "address",
  "phone_number",
  "website",
  "email",
  "facebook_url",
  "instagram_url",
  "whatsapp_number",
  "youtube_url",
] as const;

function norm(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function diffMappedListing(
  existing: ListingDiffRow,
  mapped: MappedListing,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of DIFF_FIELDS) {
    const oldVal = norm(existing[field]);
    const newVal = norm(mapped[field]);
    if (oldVal !== newVal) {
      changes[field] = {
        old: existing[field] ?? null,
        new: mapped[field] ?? null,
      };
    }
  }

  return changes;
}

export type ExistingDealKey = {
  title: string;
  bank_id: number | null;
};

/**
 * Compare incoming Peekaboo deals to existing deal rows for a listing.
 * Match key mirrors syncDeals: title + bank_id.
 */
export function diffDeals(
  existing: ExistingDealKey[],
  incoming: MappedDeal[] | undefined,
  resolveBankId: (bankName: string) => number | null,
): { wouldCreate: number; wouldUpdate: number; dealCountChange: boolean } {
  const incomingList = incoming ?? [];
  const existingKeys = new Set(
    existing.map(
      (d) => `${norm(d.title).toLowerCase()}::${d.bank_id ?? "null"}`,
    ),
  );

  let wouldCreate = 0;
  let wouldUpdate = 0;

  for (const deal of incomingList) {
    const bankId = resolveBankId(deal.bankName);
    const key = `${norm(deal.title).toLowerCase()}::${bankId ?? "null"}`;
    if (existingKeys.has(key)) {
      wouldUpdate += 1;
    } else {
      wouldCreate += 1;
    }
  }

  const dealCountChange =
    incomingList.length !== existing.length || wouldCreate > 0;

  return { wouldCreate, wouldUpdate, dealCountChange };
}
