import { query } from "@/lib/db";
import { brandStemFromListingName } from "@/lib/listings/borrowed-header-image";

export type SiblingLocation = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_current: boolean;
};

function slugifyBrandName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Published sibling locations in the same brand group as `listingId`.
 * Includes the current listing (is_current: true) so clients can render a
 * full Other-locations picker. Returns [] when ungrouped or alone.
 */
export async function getSiblingLocations(
  listingId: number,
): Promise<SiblingLocation[]> {
  const { rows } = await query<{
    id: number | string;
    name: string;
    slug: string;
    address: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    is_current: boolean;
  }>(
    `SELECT l.id, l.name, l.slug, l.address, l.latitude, l.longitude,
            (l.id = $1) AS is_current
     FROM brand_group_members self
     JOIN brand_group_members sib ON sib.group_id = self.group_id
     JOIN listings l ON l.id = sib.listing_id
     WHERE self.listing_id = $1
       AND l.status = 'published'
     ORDER BY sib.sort_order ASC, l.name ASC`,
    [listingId],
  );

  if (rows.length <= 1) return [];

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    slug: r.slug,
    address: r.address,
    latitude: r.latitude !== null ? Number(r.latitude) : null,
    longitude: r.longitude !== null ? Number(r.longitude) : null,
    is_current: Boolean(r.is_current),
  }));
}

export type BrandGroupSummary = {
  id: number;
  name: string;
  slug: string;
  members: Array<{
    listing_id: number;
    name: string;
    slug: string;
    status: string;
    sort_order: number;
    source: string;
  }>;
};

/** Brand group for a listing, if any (admin / tooling). */
export async function getBrandGroupForListing(
  listingId: number,
): Promise<BrandGroupSummary | null> {
  const { rows: groupRows } = await query<{
    id: number | string;
    name: string;
    slug: string;
  }>(
    `SELECT g.id, g.name, g.slug
     FROM brand_group_members m
     JOIN brand_groups g ON g.id = m.group_id
     WHERE m.listing_id = $1`,
    [listingId],
  );
  const group = groupRows[0];
  if (!group) return null;

  const { rows: members } = await query<{
    listing_id: number | string;
    name: string;
    slug: string;
    status: string;
    sort_order: number;
    source: string;
  }>(
    `SELECT m.listing_id, l.name, l.slug, l.status, m.sort_order, m.source
     FROM brand_group_members m
     JOIN listings l ON l.id = m.listing_id
     WHERE m.group_id = $1
     ORDER BY m.sort_order ASC, l.name ASC`,
    [group.id],
  );

  return {
    id: Number(group.id),
    name: group.name,
    slug: group.slug,
    members: members.map((m) => ({
      listing_id: Number(m.listing_id),
      name: m.name,
      slug: m.slug,
      status: m.status,
      sort_order: m.sort_order,
      source: m.source,
    })),
  };
}

/**
 * Ensure a brand group exists for `name` and attach `listingId`.
 * Moves the listing if it already belongs to another group.
 */
export async function ensureListingInBrandGroup(opts: {
  listingId: number;
  brandName: string;
  source?: "manual" | "stem_import" | "split_from_branch";
  sortOrder?: number;
}): Promise<{ groupId: number; created: boolean }> {
  const brandName = opts.brandName.trim();
  if (!brandName) throw new Error("brandName is required");
  const slug = slugifyBrandName(brandName);
  const source = opts.source ?? "manual";
  const sortOrder = opts.sortOrder ?? 0;

  const { rows: existing } = await query<{ id: number | string }>(
    `SELECT id FROM brand_groups WHERE slug = $1`,
    [slug],
  );

  let groupId: number;
  let created = false;
  if (existing[0]) {
    groupId = Number(existing[0].id);
  } else {
    const { rows: inserted } = await query<{ id: number | string }>(
      `INSERT INTO brand_groups (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [brandName, slug],
    );
    groupId = Number(inserted[0].id);
    created = true;
  }

  await query(`DELETE FROM brand_group_members WHERE listing_id = $1`, [
    opts.listingId,
  ]);
  await query(
    `INSERT INTO brand_group_members (group_id, listing_id, sort_order, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (listing_id) DO UPDATE
       SET group_id = EXCLUDED.group_id,
           sort_order = EXCLUDED.sort_order,
           source = EXCLUDED.source`,
    [groupId, opts.listingId, sortOrder, source],
  );

  return { groupId, created };
}

export async function removeListingFromBrandGroup(
  listingId: number,
): Promise<void> {
  await query(`DELETE FROM brand_group_members WHERE listing_id = $1`, [
    listingId,
  ]);
}

/** Suggest brand display name from a listing name. */
export function suggestBrandName(listingName: string | null | undefined): string | null {
  return brandStemFromListingName(listingName);
}
