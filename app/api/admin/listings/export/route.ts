import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Parser } from "json2csv";
import { getListingCategoryIdsMap } from "@/lib/listings/sync-listing-categories";
import { resolveCategoryIdScope } from "@/lib/listings/category-scope";
import type { Database } from "@/types/database";

type ExportListingRow = Database["public"]["Tables"]["listings"]["Row"] & {
  categories?: SupabaseCategory[];
  listing_features?: SupabaseFeature[];
  opening_hours?: SupabaseOpeningHour[];
  deals?: SupabaseDeal[];
  menu_sections?: SupabaseMenuSection[];
  listing_images?: SupabaseImage[];
  listing_branches?: SupabaseBranch[];
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      filters = {},
      includeRelated = true,
      includeTechnical = false,
    } = body as {
      filters?: {
        status?: string;
        categoryId?: string;
        isFeatured?: string;
        search?: string;
      };
      includeRelated?: boolean;
      includeTechnical?: boolean;
    };

    // Build WHERE clause for listing filters
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    if (filters.status && filters.status !== "all") {
      whereParams.push(filters.status);
      whereClauses.push(`status = $${whereParams.length}`);
    }

    if (filters.categoryId && filters.categoryId !== "all") {
      const categoryIdNum = Number(filters.categoryId);
      if (Number.isFinite(categoryIdNum)) {
        const categoryIds = await resolveCategoryIdScope(categoryIdNum);
        if (categoryIds.length > 0) {
          whereParams.push(categoryIds);
          whereClauses.push(
            `(
               EXISTS (
                 SELECT 1 FROM listing_categories lc
                 WHERE lc.listing_id = listings.id AND lc.category_id = ANY($${whereParams.length}::int[])
               )
               OR listings.category_id = ANY($${whereParams.length}::int[])
             )`,
          );
        } else {
          whereClauses.push("1 = 0");
        }
      }
    }

    if (filters.isFeatured && filters.isFeatured !== "all") {
      whereParams.push(filters.isFeatured === "true");
      whereClauses.push(`is_featured = $${whereParams.length}`);
    }

    if (filters.search) {
      whereParams.push(`%${filters.search}%`);
      whereClauses.push(
        `(name ILIKE $${whereParams.length} OR description ILIKE $${whereParams.length})`,
      );
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Fetch all rows in deterministic pages to avoid API limits truncating exports.
    const pageSize = 1000;
    let offset = 0;
    const listings: ExportListingRow[] = [];

    try {
      while (true) {
        const pageParams = [...whereParams, pageSize, offset];
        const { rows } = await query(
          `SELECT * FROM listings ${whereSql}
           ORDER BY id ASC
           LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
          pageParams,
        );

        if (!rows || rows.length === 0) {
          break;
        }

        listings.push(...(rows as unknown as ExportListingRow[]));

        if (rows.length < pageSize) {
          break;
        }

        offset += pageSize;
      }
    } catch (error) {
      console.error("Error fetching listings for export:", error);
      return NextResponse.json(
        { error: "Failed to fetch listings" },
        { status: 500 }
      );
    }

    if (includeRelated && listings.length > 0) {
      const listingIds = listings.map((l) => l.id);
      const categoryIdsByListing = await getListingCategoryIdsMap(listingIds);
      const categoryIds = [
        ...new Set(
          [
            ...listings
              .map((l) => l.category_id)
              .filter((id): id is number => id != null),
            ...[...categoryIdsByListing.values()].flat(),
          ],
        ),
      ];

      const [
        categoriesResult,
        listingFeaturesResult,
        openingHoursResult,
        dealsResult,
        menuSectionsResult,
        listingImagesResult,
        listingBranchesResult,
      ] = await Promise.all([
        categoryIds.length > 0
          ? query(
              `SELECT id, name, slug, parent_id FROM categories WHERE id = ANY($1::int[])`,
              [categoryIds],
            )
          : { rows: [] },
        query(
          `SELECT lf.listing_id, lf.feature_id, lfm.name, lfm.icon_emoji, lfm.category
           FROM listing_features lf
           JOIN listing_features_master lfm ON lfm.id = lf.feature_id
           WHERE lf.listing_id = ANY($1::int[])`,
          [listingIds],
        ),
        query(
          `SELECT listing_id, branch_id, day_of_week, open_time, close_time, is_closed
           FROM opening_hours WHERE listing_id = ANY($1::int[])`,
          [listingIds],
        ),
        query(
          `SELECT d.id, d.title, d.description, d.deal_type, d.discount_value, d.is_active,
                  d.bank_id, d.start_date, d.end_date, d.valid_card_variants, d.metadata,
                  d.listing_id, b.id AS bank_id_full, b.name AS bank_name, b.code AS bank_code
           FROM deals d
           LEFT JOIN banks b ON b.id = d.bank_id
           WHERE d.listing_id = ANY($1::int[])`,
          [listingIds],
        ),
        query(
          `SELECT id, listing_id, name, description, display_order
           FROM menu_sections WHERE listing_id = ANY($1::int[])`,
          [listingIds],
        ),
        query(
          `SELECT listing_id, url, alt_text, display_order, is_primary
           FROM listing_images WHERE listing_id = ANY($1::int[])`,
          [listingIds],
        ),
        query(
          `SELECT id, listing_id, name, address, city, country, latitude, longitude,
                  phone_number, timings, is_open_now, is_primary, is_verified,
                  distance_from_center, custom_attributes, peekaboo_branch_id
           FROM listing_branches WHERE listing_id = ANY($1::int[])`,
          [listingIds],
        ),
      ]);

      // Parent categories (for the "Parent > Child" category display) and
      // menu items are independent of each other - fetch both in parallel.
      const parentIds = [
        ...new Set(
          categoriesResult.rows.map((c) => c.parent_id).filter((id): id is number => id != null),
        ),
      ];
      const sectionIds = menuSectionsResult.rows.map((s) => s.id);

      const [parentCategoriesResult, menuItemsResult] = await Promise.all([
        parentIds.length > 0
          ? query(`SELECT id, name, slug FROM categories WHERE id = ANY($1::int[])`, [
              parentIds,
            ])
          : { rows: [] },
        sectionIds.length > 0
          ? query(
              `SELECT id, section_id, name, description, price, is_available, image_url,
                      image_alt, display_order, is_featured
               FROM menu_items WHERE section_id = ANY($1::int[])`,
              [sectionIds],
            )
          : { rows: [] },
      ]);
      const parentCategoryById = new Map(
        parentCategoriesResult.rows.map((c) => [c.id, c]),
      );
      const categoryById = new Map(
        categoriesResult.rows.map((c) => [
          c.id,
          {
            name: c.name,
            slug: c.slug,
            parent: c.parent_id ? parentCategoryById.get(c.parent_id) || null : null,
          },
        ]),
      );

      const featuresByListingId = new Map<number, SupabaseFeature[]>();
      for (const row of listingFeaturesResult.rows) {
        const existing = featuresByListingId.get(row.listing_id) || [];
        existing.push({
          listing_features_master: {
            name: row.name,
          },
        });
        featuresByListingId.set(row.listing_id, existing);
      }

      const hoursByListingId = new Map<number, SupabaseOpeningHour[]>();
      const hoursByBranchId = new Map<number, SupabaseBranchOpeningHour[]>();
      for (const row of openingHoursResult.rows) {
        const listingHours = hoursByListingId.get(row.listing_id) || [];
        listingHours.push({
          day_of_week: row.day_of_week,
          open_time: row.open_time,
          close_time: row.close_time,
          is_closed: row.is_closed,
        });
        hoursByListingId.set(row.listing_id, listingHours);

        if (row.branch_id != null) {
          const branchHours = hoursByBranchId.get(row.branch_id) || [];
          branchHours.push({
            day_of_week: row.day_of_week,
            open_time: row.open_time,
            close_time: row.close_time,
            is_closed: row.is_closed,
            branch_id: row.branch_id,
          });
          hoursByBranchId.set(row.branch_id, branchHours);
        }
      }

      const dealsByListingId = new Map<number, SupabaseDeal[]>();
      for (const row of dealsResult.rows) {
        const existing = dealsByListingId.get(row.listing_id) || [];
        existing.push({
          id: row.id,
          title: row.title,
          discount_value: row.discount_value,
          is_active: row.is_active,
          deal_type: row.deal_type,
          description: row.description,
          bank_id: row.bank_id,
          start_date: row.start_date,
          end_date: row.end_date,
          valid_card_variants: row.valid_card_variants,
          metadata: row.metadata,
          banks: row.bank_id_full
            ? { id: row.bank_id_full, name: row.bank_name, code: row.bank_code }
            : null,
        });
        dealsByListingId.set(row.listing_id, existing);
      }

      const menuItemsBySectionId = new Map<number, SupabaseMenuItem[]>();
      for (const item of menuItemsResult.rows) {
        const existing = menuItemsBySectionId.get(item.section_id) || [];
        existing.push(item);
        menuItemsBySectionId.set(item.section_id, existing);
      }

      const menuSectionsByListingId = new Map<number, SupabaseMenuSection[]>();
      for (const section of menuSectionsResult.rows) {
        const existing = menuSectionsByListingId.get(section.listing_id) || [];
        existing.push({
          name: section.name,
          display_order: section.display_order,
          menu_items: menuItemsBySectionId.get(section.id) || [],
        });
        menuSectionsByListingId.set(section.listing_id, existing);
      }

      const imagesByListingId = new Map<number, SupabaseImage[]>();
      for (const row of listingImagesResult.rows) {
        const existing = imagesByListingId.get(row.listing_id) || [];
        existing.push(row);
        imagesByListingId.set(row.listing_id, existing);
      }

      const branchesByListingId = new Map<number, SupabaseBranch[]>();
      for (const row of listingBranchesResult.rows) {
        const existing = branchesByListingId.get(row.listing_id) || [];
        existing.push({
          ...row,
          opening_hours: hoursByBranchId.get(row.id) || [],
        });
        branchesByListingId.set(row.listing_id, existing);
      }

      for (const listing of listings) {
        const ids =
          categoryIdsByListing.get(listing.id) ??
          (listing.category_id != null ? [listing.category_id] : []);
        listing.categories = ids
          .map((id) => categoryById.get(id))
          .filter((c): c is NonNullable<typeof c> => !!c);
        listing.listing_features = featuresByListingId.get(listing.id) || [];
        listing.opening_hours = hoursByListingId.get(listing.id) || [];
        listing.deals = dealsByListingId.get(listing.id) || [];
        listing.menu_sections = menuSectionsByListingId.get(listing.id) || [];
        listing.listing_images = imagesByListingId.get(listing.id) || [];
        listing.listing_branches = branchesByListingId.get(listing.id) || [];
      }
    }

    // Transform data to CSV format
    const csvData =
      listings?.map((listing) => {
        const baseRow: Record<string, string | number> = {
          Membership: listing.show_member_badge ? "Member" : "Non-Member",
          Name: normalizeExportText(listing.name),
          Address: normalizeExportText(listing.address),
          Phone: normalizeExportText(listing.phone_number),
          Email: normalizeExportText(listing.email),
          "Latitude/Longitude":
            listing.latitude && listing.longitude
              ? `${listing.latitude}, ${listing.longitude}`
              : "",
          "Google map Link": normalizeExportText(listing.google_maps_url),
          Description: normalizeExportText(listing.description),
          Website: normalizeExportText(listing.website),
          Timings: formatOpeningHours(listing.opening_hours || []),
          Categories: formatCategories(listing.categories ?? null),
          Features: formatFeatures(listing.listing_features || []),
          Status: normalizeExportText(listing.status),
          Featured: listing.is_featured ? "TRUE" : "FALSE",
          "Created Date": normalizeExportTimestamp(listing.created_at),
          "Display Order": listing.display_order || "",
          "Owner ID": listing.owner_id || "",
          "Place ID": normalizeExportText(listing.place_id),
          "Gallery Images": formatGalleryImages(listing.listing_images || []),
          "Menu Sections": formatMenuSections(listing.menu_sections || []),
          "Menu PDF": normalizeExportText(listing.menu_pdf_url),
          "Deal & Discounts":
            listing.deals && listing.deals.length > 0 ? "TRUE" : "FALSE",
          "D&D Notes": formatDeals(listing.deals || []),
          "Bank Promotions": formatBankPromotions(listing.deals || []),
          Branches: formatBranches(listing.listing_branches || []),
          "Branch Opening Hours": formatBranchOpeningHours(
            listing.listing_branches || []
          ),
          Facebook: normalizeExportText(listing.facebook_url),
          Whatsapp: normalizeExportText(listing.whatsapp_number),
          Instagram: normalizeExportText(listing.instagram_url),
          Youtube: normalizeExportText(listing.youtube_url),
          "Last Update": normalizeExportTimestamp(listing.updated_at),
        };

        if (includeTechnical) {
          baseRow["Peekaboo ID"] = listing.peekaboo_id || "";
          baseRow["Parking Information"] = normalizeExportText(
            listing.parking_information,
          );
          baseRow["Parking Amenities"] = formatJsonArray(
            listing.parking_amenities,
          );
          baseRow["Custom Attributes"] = formatJsonValue(
            listing.custom_attributes,
          );
          baseRow["Deals JSON"] = formatDealsJson(listing.deals || []);
        }

        return baseRow;
      }) || [];

    // Convert to CSV
    const fields = [
      "Membership",
      "Name",
      "Address",
      "Phone",
      "Email",
      "Latitude/Longitude",
      "Google map Link",
      "Description",
      "Website",
      "Timings",
      "Categories",
      "Features",
      "Status",
      "Featured",
      "Created Date",
      "Display Order",
      "Owner ID",
      "Place ID",
      "Gallery Images",
      "Menu Sections",
      "Menu PDF",
      "Deal & Discounts",
      "D&D Notes",
      "Bank Promotions",
      "Branches",
      "Branch Opening Hours",
      "Facebook",
      "Whatsapp",
      "Instagram",
      "Youtube",
      "Last Update",
      ...(includeTechnical
        ? [
            "Peekaboo ID",
            "Parking Information",
            "Parking Amenities",
            "Custom Attributes",
            "Deals JSON",
          ]
        : []),
    ];

    const json2csvParser = new Parser({ fields });

    const csv = json2csvParser.parse(csvData);

    // Return CSV file
    const filename = `listings_export_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

// Helper functions
type SupabaseOpeningHour = {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};
function formatOpeningHours(openingHours: SupabaseOpeningHour[]): string {
  if (!openingHours || openingHours.length === 0) return "";
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const formatted = openingHours
    .filter((oh) => !oh.is_closed)
    .map((oh) => {
      const dayName = dayNames[oh.day_of_week] || `Day ${oh.day_of_week}`;
      const openTime = oh.open_time ? oh.open_time.slice(0, 5) : "";
      const closeTime = oh.close_time ? oh.close_time.slice(0, 5) : "";
      return `${dayName}: ${openTime}-${closeTime}`;
    })
    .join(" | ");
  return formatted;
}

// node-postgres returns timestamp columns as JS Date objects, not the ISO
// strings PostgREST/Supabase used to hand back - normalize here so the CSV
// output format doesn't silently change.
function normalizeExportTimestamp(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// `date` columns come back as Date objects too - format as YYYY-MM-DD to
// match the date-only string PostgREST/Supabase used to return.
function formatExportDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value);
}

function normalizeExportText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SupabaseFeature = {
  listing_features_master?: { name?: string };
};
function formatFeatures(features: SupabaseFeature[]): string {
  if (!features || features.length === 0) return "";
  return features
    .map((f) => normalizeExportText(f.listing_features_master?.name))
    .filter(Boolean)
    .join(", ");
}

type SupabaseCategory = { name?: string; parent?: { name?: string } };
function formatCategories(categories: SupabaseCategory[] | null): string {
  if (!categories || categories.length === 0) return "";
  return categories
    .map((category) =>
      category.parent
        ? `${normalizeExportText(category.parent.name)} > ${normalizeExportText(category.name)}`
        : normalizeExportText(category.name),
    )
    .join(", ");
}

type SupabaseImage = { url?: string; display_order?: number | null };
function formatGalleryImages(images: SupabaseImage[]): string {
  if (!images || images.length === 0) return "";
  return images
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((img) => img.url)
    .filter(Boolean)
    .join(" | ");
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize JSON value:", error);
    return "";
  }
}

function formatJsonArray(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize JSON array:", error);
    return "";
  }
}

type SupabaseMenuItem = {
  name?: string;
  description?: string | null;
  price?: number | string | null;
  is_available?: boolean;
  image_url?: string | null;
  display_order?: number | null;
  is_featured?: boolean;
};
type SupabaseMenuSection = {
  name?: string;
  display_order?: number | null;
  menu_items?: SupabaseMenuItem[];
};
function formatMenuSections(sections: SupabaseMenuSection[]): string {
  if (!sections || sections.length === 0) return "";
  return sections
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((section) => {
      const sectionName = section.name || "";
      const items = section.menu_items || [];
      const formattedItems = items
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(
          (item) => {
            const name = normalizeExportText(item.name);
            // menu_items.price is a numeric column - node-postgres returns it
            // as a string, not a JS number, so check/convert explicitly.
            const priceValue =
              item.price != null && item.price !== "" ? Number(item.price) : NaN;
            const price = !isNaN(priceValue) ? `Rs ${priceValue}` : "";
            return [name, price].filter(Boolean).join(" - ");
          },
        )
        .join("; ");
      return `${normalizeExportText(sectionName)}: ${formattedItems}`;
    })
    .join(" || ");
}

type SupabaseDeal = {
  id?: number;
  title?: string;
  discount_value?: string | null;
  is_active?: boolean;
  deal_type?: Database["public"]["Enums"]["deal_type"];
  description?: string | null;
  bank_id?: number | string | null;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  valid_card_variants?: number[] | null;
  metadata?: unknown;
  banks?: { id?: number; name?: string | null; code?: string | null } | null;
};
function formatDeals(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";
  return deals
    .filter((d) => d.is_active)
    .map((d) =>
      `${normalizeExportText(d.title)}: ${normalizeExportText(d.discount_value) || "Special offer"}`,
    )
    .join(" | ");
}

function formatDealsJson(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";
  try {
    return JSON.stringify(
      deals.map((deal) => ({
        id: deal.id || null,
        title: deal.title || null,
        description: deal.description || null,
        deal_type: deal.deal_type || null,
        bank_id:
          deal.bank_id != null && !isNaN(Number(deal.bank_id))
            ? Number(deal.bank_id)
            : null,
        bank_name: deal.banks?.name || null,
        bank_code: deal.banks?.code || null,
        discount_value: deal.discount_value || null,
        is_active: deal.is_active ?? true,
        // start_date/end_date are `date` columns - node-postgres returns
        // these as Date objects, which JSON.stringify would otherwise
        // expand to a full ISO timestamp instead of a plain date string.
        start_date: formatExportDateOnly(deal.start_date),
        end_date: formatExportDateOnly(deal.end_date),
        valid_card_variants: deal.valid_card_variants || null,
        metadata: deal.metadata || null,
      }))
    );
  } catch (error) {
    console.warn("Failed to serialize deals JSON for export:", error);
    return "";
  }
}

type SupabaseBranchOpeningHour = {
  day_of_week?: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
  branch_id?: number | null;
};

type SupabaseBranch = {
  id?: number;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone_number?: string | null;
  timings?: string | null;
  is_open_now?: boolean;
  is_primary?: boolean;
  is_verified?: boolean;
  distance_from_center?: string | null;
  custom_attributes?: unknown;
  peekaboo_branch_id?: number | null;
  opening_hours?: SupabaseBranchOpeningHour[];
};

function formatBranches(branches: SupabaseBranch[]): string {
  if (!branches || branches.length === 0) return "";
  return branches
    .map((branch) => {
      const name = normalizeExportText(branch.name);
      const address = normalizeExportText(branch.address);
      const city = normalizeExportText(branch.city);
      const phone = normalizeExportText(branch.phone_number ?? undefined);
      const timings = normalizeExportText(branch.timings ?? undefined);
      const location = [address, city].filter(Boolean).join(", ");

      return [
        name,
        location,
        phone ? `Phone: ${phone}` : "",
        timings ? `Timings: ${timings}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join(" || ");
}

function formatBranchOpeningHours(branches: SupabaseBranch[]): string {
  if (!branches || branches.length === 0) return "";
  return branches
    .filter((branch) => Array.isArray(branch.opening_hours) && branch.opening_hours.length > 0)
    .map((branch) => {
      const name = normalizeExportText(branch.name);
      const hours = formatOpeningHours(
        (branch.opening_hours || []).map((hour) => ({
          day_of_week: hour.day_of_week ?? 0,
          open_time: hour.open_time ?? null,
          close_time: hour.close_time ?? null,
          is_closed: hour.is_closed ?? false,
        })),
      );
      return `${name}: ${hours}`;
    })
    .filter(Boolean)
    .join(" || ");
}

function formatBankPromotions(deals: SupabaseDeal[]): string {
  if (!deals || deals.length === 0) return "";

  const bankDeals = deals
    .filter((deal) => deal.is_active && deal.deal_type === "bank_discount")
    .map((deal) => ({
      title: deal.title || deal.banks?.name || "Bank Promotion",
      discount_value: deal.discount_value || null,
      bank: deal.banks?.name || null,
      description: deal.description || null,
      is_active: true,
    }));

  if (bankDeals.length === 0) return "";

  return bankDeals
    .map((deal) => {
      const title = normalizeExportText(deal.title);
      const discount = normalizeExportText(deal.discount_value);
      const bank = normalizeExportText(deal.bank);
      return [title, bank ? `(${bank})` : "", discount].filter(Boolean).join(" ");
    })
    .join(" | ");
}
