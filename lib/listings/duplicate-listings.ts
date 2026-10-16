import { query } from "@/lib/db";
import { brandStemFromListingName } from "@/lib/listings/borrowed-header-image";
import {
  ensureListingInBrandGroup,
  addListingToBrandGroupId,
  getBrandGroupForListing,
} from "@/lib/listings/brand-groups";
import { syncListingCategories } from "@/lib/listings/sync-listing-categories";
import { logListingCreation } from "@/lib/audit";

export async function generateUniqueListingSlug(name: string): Promise<string> {
  const baseSlug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "listing";

  let candidate = baseSlug;
  let counter = 2;
  while (true) {
    const { rows } = await query<{ exists: boolean }>(
      `SELECT 1 FROM listings WHERE slug = $1 LIMIT 1`,
      [candidate],
    );
    if (rows.length === 0) return candidate;
    candidate = `${baseSlug}-${counter++}`.slice(0, 120);
  }
}

export type DuplicatorSearchListing = {
  id: number;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  phone_number: string | null;
  category_name: string | null;
  image_url: string | null;
  brand_group_id: number | null;
  brand_group_name: string | null;
};

export async function searchListingsForDuplication(
  queryStr: string,
  limit = 20,
): Promise<DuplicatorSearchListing[]> {
  const trimmed = queryStr.trim();
  if (!trimmed) return [];

  const isNumericId = /^\d+$/.test(trimmed);
  const whereParams: unknown[] = [`%${trimmed}%`, `${trimmed}%`, limit];
  let idClause = "";

  if (isNumericId) {
    whereParams.push(parseInt(trimmed, 10));
    idClause = `OR l.id = $4`;
  }

  const { rows } = await query<{
    id: number | string;
    name: string;
    slug: string;
    status: string;
    address: string | null;
    phone_number: string | null;
    category_name: string | null;
    image_url: string | null;
    brand_group_id: number | string | null;
    brand_group_name: string | null;
  }>(
    `SELECT l.id, l.name, l.slug, l.status, l.address, l.phone_number,
            c.name AS category_name,
            (SELECT li.url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS image_url,
            bg.id AS brand_group_id,
            bg.name AS brand_group_name
     FROM listings l
     LEFT JOIN categories c ON c.id = l.category_id
     LEFT JOIN brand_group_members bgm ON bgm.listing_id = l.id
     LEFT JOIN brand_groups bg ON bg.id = bgm.group_id
     WHERE l.name ILIKE $1 OR l.address ILIKE $1 OR l.slug ILIKE $1 ${idClause}
     ORDER BY
       CASE
         ${isNumericId ? `WHEN l.id = $4 THEN 0` : ""}
         WHEN l.name ILIKE $2 THEN 1
         WHEN l.name ILIKE $1 THEN 2
         ELSE 3
       END,
       l.name ASC
     LIMIT $3`,
    whereParams,
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    slug: r.slug,
    status: r.status,
    address: r.address,
    phone_number: r.phone_number,
    category_name: r.category_name,
    image_url: r.image_url,
    brand_group_id: r.brand_group_id !== null ? Number(r.brand_group_id) : null,
    brand_group_name: r.brand_group_name,
  }));
}

export type DuplicatorOpeningHour = {
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type DuplicatorSourceListing = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  website: string | null;
  status: string;
  is_featured: boolean;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  place_id: string | null;
  category_id: number | null;
  category_name: string | null;
  category_ids: number[];
  categories: Array<{ id: number; name: string }>;
  images: Array<{
    url: string;
    alt_text: string | null;
    display_order: number;
    is_primary: boolean;
  }>;
  opening_hours: DuplicatorOpeningHour[];
  brand_group: {
    id: number;
    name: string;
    slug: string;
    member_count: number;
    members: Array<{
      listing_id: number;
      name: string;
      slug: string;
      address: string | null;
    }>;
  } | null;
  suggested_brand_name: string;
};

export async function getSourceListingForDuplication(
  listingId: number,
): Promise<DuplicatorSourceListing | null> {
  const { rows } = await query<any>(
    `SELECT l.*, c.name AS category_name
     FROM listings l
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.id = $1
     LIMIT 1`,
    [listingId],
  );

  const listing = rows[0];
  if (!listing) return null;

  // Fetch category assignments
  const { rows: categoryRows } = await query<{
    category_id: number | string;
    category_name: string;
    is_primary: boolean;
  }>(
    `SELECT lc.category_id, c.name AS category_name, lc.is_primary
     FROM listing_categories lc
     JOIN categories c ON c.id = lc.category_id
     WHERE lc.listing_id = $1
     ORDER BY lc.is_primary DESC, c.name ASC`,
    [listingId],
  );

  const category_ids = categoryRows.map((c) => Number(c.category_id));
  if (category_ids.length === 0 && listing.category_id) {
    category_ids.push(Number(listing.category_id));
  }

  const categories = categoryRows.map((c) => ({
    id: Number(c.category_id),
    name: c.category_name,
  }));
  if (categories.length === 0 && listing.category_id) {
    categories.push({
      id: Number(listing.category_id),
      name: listing.category_name || "Category",
    });
  }

  // Fetch images
  const { rows: imageRows } = await query<{
    url: string;
    alt_text: string | null;
    display_order: number | string | null;
    is_primary: boolean | null;
  }>(
    `SELECT url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = $1
     ORDER BY is_primary DESC, display_order ASC, id ASC`,
    [listingId],
  );

  const images = imageRows.map((img) => ({
    url: img.url,
    alt_text: img.alt_text,
    display_order: Number(img.display_order ?? 0),
    is_primary: Boolean(img.is_primary),
  }));

  // Fetch opening hours
  const { rows: hoursRows } = await query<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean | null;
  }>(
    `SELECT day_of_week, open_time, close_time, is_closed
     FROM opening_hours
     WHERE listing_id = $1 AND branch_id IS NULL
     ORDER BY day_of_week ASC`,
    [listingId],
  );

  // Normalize 7 days: dayOfWeek 0=Sunday, 1=Monday...
  const opening_hours: DuplicatorOpeningHour[] = Array.from({ length: 7 }, (_, dbDay) => {
    const existing = hoursRows.find((h) => Number(h.day_of_week) === dbDay);
    if (existing) {
      return {
        dayOfWeek: dbDay,
        openTime: existing.open_time,
        closeTime: existing.close_time,
        isClosed: Boolean(existing.is_closed),
      };
    }
    return {
      dayOfWeek: dbDay,
      openTime: "12:00",
      closeTime: "00:00",
      isClosed: false,
    };
  });

  // Check existing brand group
  const existingGroup = await getBrandGroupForListing(listingId);
  let brandGroup: DuplicatorSourceListing["brand_group"] = null;

  if (existingGroup) {
    const { rows: memberRows } = await query<{
      listing_id: number | string;
      name: string;
      slug: string;
      address: string | null;
    }>(
      `SELECT m.listing_id, l.name, l.slug, l.address
       FROM brand_group_members m
       JOIN listings l ON l.id = m.listing_id
       WHERE m.group_id = $1
       ORDER BY m.sort_order ASC, l.name ASC`,
      [existingGroup.id],
    );

    brandGroup = {
      id: existingGroup.id,
      name: existingGroup.name,
      slug: existingGroup.slug,
      member_count: memberRows.length,
      members: memberRows.map((m) => ({
        listing_id: Number(m.listing_id),
        name: m.name,
        slug: m.slug,
        address: m.address,
      })),
    };
  }

  const suggested_brand_name =
    brandGroup?.name ||
    brandStemFromListingName(listing.name) ||
    listing.name;

  return {
    id: Number(listing.id),
    name: listing.name,
    slug: listing.slug,
    description: listing.description,
    address: listing.address,
    phone_number: listing.phone_number,
    email: listing.email,
    website: listing.website,
    status: listing.status,
    is_featured: Boolean(listing.is_featured),
    latitude: listing.latitude !== null ? Number(listing.latitude) : null,
    longitude: listing.longitude !== null ? Number(listing.longitude) : null,
    google_maps_url: listing.google_maps_url,
    place_id: listing.place_id,
    category_id: listing.category_id ? Number(listing.category_id) : null,
    category_name: listing.category_name,
    category_ids,
    categories,
    images,
    opening_hours,
    brand_group: brandGroup,
    suggested_brand_name,
  };
}

export type DuplicateItemInput = {
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string | null;
  place_id?: string | null;
  phone_number?: string | null;
  status?: "draft" | "published" | "archived" | "pending_approval";
  opening_hours?: DuplicatorOpeningHour[];
};

export type DuplicateListingsPayload = {
  source_listing_id: number;
  brand_name: string;
  duplicates: DuplicateItemInput[];
};

export type DuplicateListingsResult = {
  brand_group: {
    id: number;
    name: string;
    slug: string;
  };
  source_listing: {
    id: number;
    name: string;
    slug: string;
  };
  created_listings: Array<{
    id: number;
    name: string;
    slug: string;
    address: string | null;
    status: string;
  }>;
};

export async function executeListingDuplication(
  payload: DuplicateListingsPayload,
  adminUserId: string,
  requestIp = "unknown",
  userAgent?: string,
): Promise<DuplicateListingsResult> {
  const { source_listing_id, duplicates } = payload;
  const brandName = payload.brand_name?.trim();

  if (!source_listing_id || isNaN(source_listing_id)) {
    throw new Error("Valid source_listing_id is required");
  }
  if (!brandName) {
    throw new Error("Brand name is required for grouping the duplicates");
  }
  if (!Array.isArray(duplicates) || duplicates.length === 0) {
    throw new Error("At least one duplicate listing configuration is required");
  }

  // 1. Fetch complete source listing
  const { rows: sourceRows } = await query<any>(
    `SELECT * FROM listings WHERE id = $1 LIMIT 1`,
    [source_listing_id],
  );
  const source = sourceRows[0];
  if (!source) {
    throw new Error(`Source listing #${source_listing_id} not found`);
  }

  // 2. Ensure brand group exists and includes the source listing
  const { groupId: brandGroupId } = await ensureListingInBrandGroup({
    listingId: source_listing_id,
    brandName,
    source: "manual",
  });

  const { rows: groupInfoRows } = await query<{
    id: number | string;
    name: string;
    slug: string;
  }>(`SELECT id, name, slug FROM brand_groups WHERE id = $1`, [brandGroupId]);
  const brandGroup = {
    id: Number(groupInfoRows[0].id),
    name: groupInfoRows[0].name,
    slug: groupInfoRows[0].slug,
  };

  // 3. Fetch source category IDs
  const { rows: catRows } = await query<{ category_id: number | string }>(
    `SELECT category_id FROM listing_categories WHERE listing_id = $1 ORDER BY is_primary DESC`,
    [source_listing_id],
  );
  let categoryIds = catRows.map((r) => Number(r.category_id));
  if (categoryIds.length === 0 && source.category_id) {
    categoryIds = [Number(source.category_id)];
  }

  // 4. Fetch source opening hours to use as default if not overridden
  const { rows: defaultHoursRows } = await query<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean | null;
  }>(
    `SELECT day_of_week, open_time, close_time, is_closed
     FROM opening_hours
     WHERE listing_id = $1 AND branch_id IS NULL
     ORDER BY day_of_week ASC`,
    [source_listing_id],
  );

  const createdListings: Array<{
    id: number;
    name: string;
    slug: string;
    address: string | null;
    status: string;
  }> = [];

  // Helper to sanitize time input
  const sanitizeTime = (val: unknown): string | null => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
    return trimmed;
  };

  // 5. Process each duplicate sequentially
  for (let i = 0; i < duplicates.length; i++) {
    const item = duplicates[i];
    const name = item.name?.trim();
    if (!name) {
      throw new Error(`Duplicate #${i + 1} has an empty name`);
    }

    const uniqueSlug = await generateUniqueListingSlug(name);
    const address = item.address?.trim() || source.address || null;
    const phoneNumber =
      item.phone_number !== undefined
        ? item.phone_number?.trim() || null
        : source.phone_number;
    const lat =
      item.latitude !== undefined && item.latitude !== null && !isNaN(Number(item.latitude))
        ? Number(item.latitude)
        : source.latitude !== null
          ? Number(source.latitude)
          : null;
    const lng =
      item.longitude !== undefined && item.longitude !== null && !isNaN(Number(item.longitude))
        ? Number(item.longitude)
        : source.longitude !== null
          ? Number(source.longitude)
          : null;
    const googleMapsUrl =
      item.google_maps_url !== undefined
        ? item.google_maps_url?.trim() || null
        : source.google_maps_url;
    const placeId =
      item.place_id !== undefined
        ? item.place_id?.trim() || null
        : source.place_id;
    const status = item.status || source.status || "published";

    // Insert new listing row
    const { rows: insertedRows } = await query<any>(
      `INSERT INTO listings (
         name, slug, description, address, phone_number, email, website,
         category_id, latitude, longitude, is_featured, status, owner_id,
         created_by, facebook_url, instagram_url, whatsapp_number,
         youtube_url, google_maps_url, place_id, parking_information,
         parking_amenities, custom_attributes, min_price_per_person,
         max_price_per_person, min_guest_capacity, max_guest_capacity,
         menu_pdf_url, show_member_badge, location
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23, $24,
         $25, $26, $27,
         $28, $29,
         CASE WHEN $9::numeric IS NOT NULL AND $10::numeric IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint($10::numeric, $9::numeric), 4326)::geography
           ELSE NULL END
       ) RETURNING *`,
      [
        name,
        uniqueSlug,
        source.description,
        address,
        phoneNumber,
        source.email,
        source.website,
        source.category_id,
        lat,
        lng,
        Boolean(source.is_featured),
        status,
        source.owner_id,
        adminUserId,
        source.facebook_url,
        source.instagram_url,
        source.whatsapp_number,
        source.youtube_url,
        googleMapsUrl,
        placeId,
        source.parking_information,
        source.parking_amenities ? JSON.stringify(source.parking_amenities) : null,
        source.custom_attributes ? JSON.stringify(source.custom_attributes) : null,
        source.min_price_per_person,
        source.max_price_per_person,
        source.min_guest_capacity,
        source.max_guest_capacity,
        source.menu_pdf_url,
        Boolean(source.show_member_badge),
      ],
    );

    const newListing = insertedRows[0];
    const newListingId = Number(newListing.id);

    // Sync categories
    if (categoryIds.length > 0) {
      try {
        await syncListingCategories(newListingId, categoryIds, source.category_id);
      } catch (catErr) {
        console.error(`Failed to sync categories for duplicate #${newListingId}:`, catErr);
      }
    }

    // Clone images from source listing
    try {
      await query(
        `INSERT INTO listing_images (listing_id, url, alt_text, is_primary, display_order)
         SELECT $1, url, alt_text, is_primary, display_order
         FROM listing_images
         WHERE listing_id = $2
         ORDER BY is_primary DESC, display_order ASC, id ASC`,
        [newListingId, source_listing_id],
      );
    } catch (imgErr) {
      console.error(`Failed to copy images for duplicate #${newListingId}:`, imgErr);
    }

    // Clone or set opening hours
    try {
      if (item.opening_hours && Array.isArray(item.opening_hours) && item.opening_hours.length > 0) {
        for (const hour of item.opening_hours) {
          const isClosed = Boolean(hour.isClosed);
          const openTime = isClosed ? null : sanitizeTime(hour.openTime);
          const closeTime = isClosed ? null : sanitizeTime(hour.closeTime);
          await query(
            `INSERT INTO opening_hours (listing_id, day_of_week, open_time, close_time, is_closed)
             VALUES ($1, $2, $3, $4, $5)`,
            [newListingId, hour.dayOfWeek, openTime, closeTime, isClosed || (!openTime && !closeTime)],
          );
        }
      } else if (defaultHoursRows.length > 0) {
        for (const row of defaultHoursRows) {
          await query(
            `INSERT INTO opening_hours (listing_id, day_of_week, open_time, close_time, is_closed)
             VALUES ($1, $2, $3, $4, $5)`,
            [newListingId, row.day_of_week, row.open_time, row.close_time, Boolean(row.is_closed)],
          );
        }
      }
    } catch (hoursErr) {
      console.error(`Failed to save opening hours for duplicate #${newListingId}:`, hoursErr);
    }

    // Auto-link duplicate listing to Brand Group
    await addListingToBrandGroupId({
      groupId: brandGroupId,
      listingId: newListingId,
      source: "manual",
    });

    // Audit logging
    try {
      await logListingCreation(
        adminUserId,
        String(newListingId),
        newListing,
        requestIp,
        userAgent,
      );
    } catch (auditErr) {
      console.error(`Failed to log listing creation for #${newListingId}:`, auditErr);
    }

    createdListings.push({
      id: newListingId,
      name: newListing.name,
      slug: newListing.slug,
      address: newListing.address,
      status: newListing.status,
    });
  }

  return {
    brand_group: brandGroup,
    source_listing: {
      id: Number(source.id),
      name: source.name,
      slug: source.slug,
    },
    created_listings: createdListings,
  };
}
