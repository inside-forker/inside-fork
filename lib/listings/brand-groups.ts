import { query } from "@/lib/db";
import { brandStemFromListingName } from "@/lib/listings/borrowed-header-image";

import {
  type SiblingLocation,
  slugifyBrandName,
} from "./brand-group-types";

export type { SiblingLocation };
export { slugifyBrandName };

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

export type BrandGroupListItem = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  published_member_count: number;
};

export async function listBrandGroups(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ groups: BrandGroupListItem[]; total: number }> {
  const search = options?.search?.trim() || "";
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const whereParams: unknown[] = [];
  let whereSql = "";

  if (search) {
    whereParams.push(`%${search}%`);
    whereSql = `WHERE (g.name ILIKE $1 OR g.slug ILIKE $1)`;
  }

  const countQuery = `SELECT COUNT(*)::int AS total FROM brand_groups g ${whereSql}`;
  const { rows: countRows } = await query<{ total: number }>(countQuery, whereParams);
  const total = countRows[0]?.total ?? 0;

  const dataParams = [...whereParams, limit, offset];
  const limitIdx = whereParams.length + 1;
  const offsetIdx = whereParams.length + 2;

  const dataQuery = `
    SELECT g.id, g.name, g.slug, g.created_at, g.updated_at,
           COUNT(m.listing_id)::int AS member_count,
           COUNT(CASE WHEN l.status = 'published' THEN 1 END)::int AS published_member_count
    FROM brand_groups g
    LEFT JOIN brand_group_members m ON m.group_id = g.id
    LEFT JOIN listings l ON l.id = m.listing_id
    ${whereSql}
    GROUP BY g.id, g.name, g.slug, g.created_at, g.updated_at
    ORDER BY g.updated_at DESC, g.name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await query<{
    id: number | string;
    name: string;
    slug: string;
    created_at: string | Date;
    updated_at: string | Date;
    member_count: number | string;
    published_member_count: number | string;
  }>(dataQuery, dataParams);

  return {
    total,
    groups: rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      slug: r.slug,
      created_at: typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
      updated_at: typeof r.updated_at === "string" ? r.updated_at : r.updated_at.toISOString(),
      member_count: Number(r.member_count),
      published_member_count: Number(r.published_member_count),
    })),
  };
}

export type BrandGroupMemberDetail = {
  listing_id: number;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  sort_order: number;
  source: string;
  created_at: string;
};

export type BrandGroupDetail = {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  members: BrandGroupMemberDetail[];
};

export async function getBrandGroupById(id: number): Promise<BrandGroupDetail | null> {
  const { rows: groupRows } = await query<{
    id: number | string;
    name: string;
    slug: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    `SELECT id, name, slug, created_at, updated_at
     FROM brand_groups
     WHERE id = $1`,
    [id],
  );

  const group = groupRows[0];
  if (!group) return null;

  const { rows: members } = await query<{
    listing_id: number | string;
    name: string;
    slug: string;
    status: string;
    address: string | null;
    sort_order: number | string;
    source: string;
    created_at: string | Date;
  }>(
    `SELECT m.listing_id, l.name, l.slug, l.status, l.address,
            m.sort_order, m.source, m.created_at
     FROM brand_group_members m
     JOIN listings l ON l.id = m.listing_id
     WHERE m.group_id = $1
     ORDER BY m.sort_order ASC, l.name ASC`,
    [id],
  );

  return {
    id: Number(group.id),
    name: group.name,
    slug: group.slug,
    created_at: typeof group.created_at === "string" ? group.created_at : group.created_at.toISOString(),
    updated_at: typeof group.updated_at === "string" ? group.updated_at : group.updated_at.toISOString(),
    members: members.map((m) => ({
      listing_id: Number(m.listing_id),
      name: m.name,
      slug: m.slug,
      status: m.status,
      address: m.address,
      sort_order: Number(m.sort_order),
      source: m.source,
      created_at: typeof m.created_at === "string" ? m.created_at : m.created_at.toISOString(),
    })),
  };
}

export async function createBrandGroup(
  name: string,
): Promise<{ id: number; name: string; slug: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Brand group name is required");
  const slug = slugifyBrandName(trimmed);
  if (!slug) throw new Error("Invalid brand group name");

  const { rows } = await query<{ id: number | string; name: string; slug: string }>(
    `INSERT INTO brand_groups (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           updated_at = now()
     RETURNING id, name, slug`,
    [trimmed, slug],
  );

  const created = rows[0];
  return {
    id: Number(created.id),
    name: created.name,
    slug: created.slug,
  };
}

export async function updateBrandGroupName(
  id: number,
  name: string,
): Promise<{ id: number; name: string; slug: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Brand group name is required");

  const newSlug = slugifyBrandName(trimmed);
  if (!newSlug) throw new Error("Invalid brand group name");

  const { rows: conflict } = await query<{ id: number | string }>(
    `SELECT id FROM brand_groups WHERE slug = $1 AND id != $2`,
    [newSlug, id],
  );
  if (conflict.length > 0) {
    throw new Error(`Another brand group with slug "${newSlug}" already exists`);
  }

  const { rows } = await query<{ id: number | string; name: string; slug: string }>(
    `UPDATE brand_groups
     SET name = $1, slug = $2, updated_at = now()
     WHERE id = $3
     RETURNING id, name, slug`,
    [trimmed, newSlug, id],
  );

  if (rows.length === 0) {
    throw new Error("Brand group not found");
  }

  return {
    id: Number(rows[0].id),
    name: rows[0].name,
    slug: rows[0].slug,
  };
}

export async function deleteBrandGroup(id: number): Promise<void> {
  const { rowCount } = await query(`DELETE FROM brand_groups WHERE id = $1`, [id]);
  if (!rowCount || rowCount === 0) {
    throw new Error("Brand group not found");
  }
}

export async function addListingToBrandGroupId(opts: {
  groupId: number;
  listingId: number;
  sortOrder?: number;
  source?: "manual" | "stem_import" | "split_from_branch";
}): Promise<void> {
  const { groupId, listingId } = opts;
  const sortOrder = opts.sortOrder ?? 0;
  const source = opts.source ?? "manual";

  const { rows: groupRows } = await query<{ id: number | string }>(
    `SELECT id FROM brand_groups WHERE id = $1`,
    [groupId],
  );
  if (groupRows.length === 0) {
    throw new Error("Brand group not found");
  }

  const { rows: listingRows } = await query<{ id: number | string }>(
    `SELECT id FROM listings WHERE id = $1`,
    [listingId],
  );
  if (listingRows.length === 0) {
    throw new Error("Listing not found");
  }

  await query(
    `INSERT INTO brand_group_members (group_id, listing_id, sort_order, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (listing_id) DO UPDATE
       SET group_id = EXCLUDED.group_id,
           sort_order = EXCLUDED.sort_order,
           source = EXCLUDED.source,
           created_at = now()`,
    [groupId, listingId, sortOrder, source],
  );

  await query(`UPDATE brand_groups SET updated_at = now() WHERE id = $1`, [
    groupId,
  ]);
}

export async function removeListingFromBrandGroupId(
  groupId: number,
  listingId: number,
): Promise<void> {
  await query(
    `DELETE FROM brand_group_members WHERE group_id = $1 AND listing_id = $2`,
    [groupId, listingId],
  );
  await query(`UPDATE brand_groups SET updated_at = now() WHERE id = $1`, [
    groupId,
  ]);
}

export type SearchListingResult = {
  id: number;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  current_group_id: number | null;
  current_group_name: string | null;
  current_group_slug: string | null;
};

export async function searchListingsForBrandGrouping(
  queryStr: string,
  limit = 20,
): Promise<SearchListingResult[]> {
  const trimmed = queryStr.trim();
  if (!trimmed) return [];

  const { rows } = await query<{
    id: number | string;
    name: string;
    slug: string;
    status: string;
    address: string | null;
    current_group_id: number | string | null;
    current_group_name: string | null;
    current_group_slug: string | null;
  }>(
    `SELECT l.id, l.name, l.slug, l.status, l.address,
            m.group_id AS current_group_id,
            bg.name AS current_group_name,
            bg.slug AS current_group_slug
     FROM listings l
     LEFT JOIN brand_group_members m ON m.listing_id = l.id
     LEFT JOIN brand_groups bg ON bg.id = m.group_id
     WHERE l.name ILIKE $1 OR l.address ILIKE $1
     ORDER BY
       CASE
         WHEN l.name ILIKE $2 THEN 0
         WHEN l.name ILIKE $1 THEN 1
         ELSE 2
       END,
       l.name ASC
     LIMIT $3`,
    [`%${trimmed}%`, `${trimmed}%`, limit],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    slug: r.slug,
    status: r.status,
    address: r.address,
    current_group_id: r.current_group_id !== null ? Number(r.current_group_id) : null,
    current_group_name: r.current_group_name,
    current_group_slug: r.current_group_slug,
  }));
}
