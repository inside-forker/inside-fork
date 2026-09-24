import { query } from "@/lib/db";
import { getBorrowedHeaderImageUrls } from "@/lib/listings/borrowed-header-image";
import { LISTING_IMAGE_NOT_DEAD_SQL } from "@/lib/listings/image-health";
import { toListingImage, type ListingImageDTO } from "@/lib/mobile/mappers";

/** Browse thumbs: a few own shots + optional borrow/logo for client retry. */
export const LISTING_COVER_CANDIDATE_CAP = 4;

export type ListingCoverInput = {
  id: number;
  name: string | null;
  /** Peekaboo logo from custom_attributes when already loaded by the caller. */
  peekabooLogoUrl?: string | null;
};

export type ListingCoverResult = {
  /** Ordered cover candidates for browse cards (own + borrow + logo). */
  images: ListingImageDTO[];
  /** First usable cover URL (same order as images). */
  headerUrl: string | null;
};

/**
 * Resolve cover candidates for browse/list surfaces.
 *
 * Order: own non-menu non-dead images (primary first) → borrowed sibling →
 * peekaboo_logo_url. Does not HEAD Spaces at request time.
 */
export async function resolveListingCovers(
  listings: ListingCoverInput[],
  opts?: { candidateCap?: number },
): Promise<Map<number, ListingCoverResult>> {
  const out = new Map<number, ListingCoverResult>();
  if (listings.length === 0) return out;

  const cap = opts?.candidateCap ?? LISTING_COVER_CANDIDATE_CAP;
  const ids = listings.map((l) => l.id);

  for (const listing of listings) {
    out.set(listing.id, { images: [], headerUrl: null });
  }

  const { rows: images } = await query(
    `SELECT id, listing_id, url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = ANY($1::int[])
       AND url NOT LIKE '%/menu/%'
       AND ${LISTING_IMAGE_NOT_DEAD_SQL}
     ORDER BY listing_id,
       CASE WHEN is_primary THEN 0 ELSE 1 END,
       display_order ASC NULLS LAST,
       id ASC`,
    [ids],
  );

  for (const img of images) {
    const listingId = Number(img.listing_id);
    const entry = out.get(listingId);
    if (!entry) continue;
    if (entry.images.length >= cap) continue;
    entry.images.push(
      toListingImage({
        id: Number(img.id),
        url: String(img.url),
        alt_text: (img.alt_text as string | null) ?? null,
        display_order:
          img.display_order !== null && img.display_order !== undefined
            ? Number(img.display_order)
            : null,
        is_primary: Boolean(img.is_primary),
      }),
    );
  }

  const needingBorrow = listings.filter((l) => {
    const n = out.get(l.id)?.images.length ?? 0;
    return n < 2;
  });

  if (needingBorrow.length > 0) {
    const borrowed = await getBorrowedHeaderImageUrls(
      needingBorrow.map((l) => ({ id: l.id, name: l.name })),
    );
    for (const [id, url] of borrowed) {
      const entry = out.get(id);
      if (!entry) continue;
      if (entry.images.some((img) => img.url === url)) continue;
      if (entry.images.length >= cap) continue;
      entry.images.push({
        id: -id,
        url,
        alt_text: null,
        display_order: entry.images.length,
        is_primary: entry.images.length === 0,
      });
    }
  }

  const stillEmpty = listings.filter(
    (l) => (out.get(l.id)?.images.length ?? 0) === 0,
  );
  if (stillEmpty.length > 0) {
    const logoById = new Map<number, string>();
    for (const l of stillEmpty) {
      const given = l.peekabooLogoUrl?.trim();
      if (given) logoById.set(l.id, given);
    }
    const needLogoQuery = stillEmpty
      .filter((l) => !logoById.has(l.id))
      .map((l) => l.id);
    if (needLogoQuery.length > 0) {
      const { rows: logoRows } = await query(
        `SELECT id,
                NULLIF(TRIM(custom_attributes->>'peekaboo_logo_url'), '') AS logo
         FROM listings
         WHERE id = ANY($1::int[])`,
        [needLogoQuery],
      );
      for (const row of logoRows) {
        if (typeof row.logo === "string" && row.logo) {
          logoById.set(Number(row.id), row.logo);
        }
      }
    }
    for (const [id, url] of logoById) {
      const entry = out.get(id);
      if (!entry || entry.images.length > 0) continue;
      entry.images.push({
        id: -id - 1_000_000_000,
        url,
        alt_text: null,
        display_order: 0,
        is_primary: true,
      });
    }
  }

  for (const listing of listings) {
    const entry = out.get(listing.id);
    if (!entry) continue;
    entry.headerUrl = entry.images[0]?.url ?? null;
  }

  return out;
}

/**
 * Single-listing cover: first candidate from {@link resolveListingCovers}.
 */
export async function resolveListingHeaderImage(
  listing: ListingCoverInput,
): Promise<string | null> {
  const map = await resolveListingCovers([listing], { candidateCap: 1 });
  return map.get(listing.id)?.headerUrl ?? null;
}
