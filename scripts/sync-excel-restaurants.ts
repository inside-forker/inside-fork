import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { Pool, PoolClient } from "pg";

const EXCEL_PATH = path.resolve(
  __dirname,
  "../Restaurants Data - INSIDEkhi-2.xlsx"
);

interface ExcelRestaurant {
  sheet: string;
  placeId: string;
  membership: string;
  name: string;
  description: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  timings: string;
  address: string;
  phone: string;
  email: string;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string;
  website: string;
  categories: string;
  features: string;
  keywords: string;
  menuPdf: string;
  galleryLink: string;
  youtube: string;
  pocName: string;
  pocDesignation: string;
  pocContact: string;
}

function cleanString(val: any): string {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (
    s.toLowerCase() === "n/a" ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "none" ||
    s === "-"
  ) {
    return "";
  }
  return s;
}

function cleanUrl(val: any): string {
  const s = cleanString(val);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s) && (s.includes(".") || s.includes("/"))) {
    return `https://${s}`;
  }
  return s;
}

function cleanPhone(val: any): string {
  const s = cleanString(val);
  if (!s) return "";
  // Remove non-digit chars except leading +
  return s.replace(/[\r\n\t]/g, " ").trim();
}

function cleanSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseLatLng(val: any): { lat: number | null; lng: number | null } {
  if (!val) return { lat: null, lng: null };
  const str = String(val).trim();
  const parts = str.split(/[,/]/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng) && lat > 20 && lat < 30 && lng > 60 && lng < 75) {
      return { lat, lng };
    }
  }
  return { lat: null, lng: null };
}

function parseExcel(): ExcelRestaurant[] {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found at: ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const list: ExcelRestaurant[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (!rows || rows.length < 2) continue;

    const headers = (rows[0] || []).map((h) =>
      h != null ? String(h).trim() : ""
    );

    const getIdx = (candidates: string[]) => {
      return headers.findIndex(
        (h) =>
          h &&
          candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))
      );
    };

    const placeIdIdx = getIdx(["place id"]);
    const nameIdx = getIdx(["name"]);
    const descIdx = getIdx(["description"]);
    const fbIdx = getIdx(["facebook"]);
    const instaIdx = getIdx(["instagram"]);
    const waIdx = getIdx(["whatsapp"]);
    const timingsIdx = getIdx(["timing"]);
    const addrIdx = getIdx(["address"]);
    const phoneIdx = getIdx(["phone"]);
    const emailIdx = getIdx(["email"]);
    const latLngIdx = getIdx(["latitude", "lat/long"]);
    const gmapsIdx = getIdx(["google map"]);
    const webIdx = getIdx(["website"]);
    const catIdx = getIdx(["categories", "category"]);
    const featIdx = getIdx(["feature"]);
    const kwIdx = getIdx(["keyword"]);
    const menuPdfIdx = getIdx(["menu pdf"]);
    const galleryIdx = getIdx(["gallery"]);
    const ytIdx = getIdx(["youtube"]);
    const memberIdx = getIdx(["membership"]);
    const pocNameIdx = getIdx(["poc name"]);
    const pocDesigIdx = getIdx(["designation"]);
    const pocContactIdx = getIdx(["contact no"]);

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;

      const rawName = nameIdx >= 0 ? r[nameIdx] : null;
      if (!rawName || typeof rawName !== "string" || !rawName.trim()) continue;
      const name = rawName.trim();

      // Skip area section banner rows like "PECHS BLOCK 2" or "MALIR CANTONMENT"
      if (
        (name.toUpperCase().startsWith("PECHS") ||
          name.toUpperCase().startsWith("DHA PHASE") ||
          name.toUpperCase().startsWith("BLOCK ") ||
          name.toUpperCase().startsWith("MALIR ") ||
          name.toUpperCase().startsWith("HIGHWAY ") ||
          name.toUpperCase().startsWith("PORT GRAND") ||
          name.toUpperCase().startsWith("OTHERS")) &&
        r.filter((c) => cleanString(c) !== "").length <= 2
      ) {
        continue;
      }

      const { lat, lng } = latLngIdx >= 0 ? parseLatLng(r[latLngIdx]) : { lat: null, lng: null };

      list.push({
        sheet: sheetName,
        placeId: placeIdIdx >= 0 ? cleanString(r[placeIdIdx]) : "",
        membership: memberIdx >= 0 ? cleanString(r[memberIdx]) : "",
        name,
        description: descIdx >= 0 ? cleanString(r[descIdx]) : "",
        facebook: fbIdx >= 0 ? cleanUrl(r[fbIdx]) : "",
        instagram: instaIdx >= 0 ? cleanUrl(r[instaIdx]) : "",
        whatsapp: waIdx >= 0 ? cleanPhone(r[waIdx]) : "",
        timings: timingsIdx >= 0 ? cleanString(r[timingsIdx]) : "",
        address: addrIdx >= 0 ? cleanString(r[addrIdx]) : "",
        phone: phoneIdx >= 0 ? cleanPhone(r[phoneIdx]) : "",
        email: emailIdx >= 0 ? cleanString(r[emailIdx]) : "",
        lat,
        lng,
        googleMapsUrl: gmapsIdx >= 0 ? cleanUrl(r[gmapsIdx]) : "",
        website: webIdx >= 0 ? cleanUrl(r[webIdx]) : "",
        categories: catIdx >= 0 ? cleanString(r[catIdx]) : "",
        features: featIdx >= 0 ? cleanString(r[featIdx]) : "",
        keywords: kwIdx >= 0 ? cleanString(r[kwIdx]) : "",
        menuPdf: menuPdfIdx >= 0 ? cleanUrl(r[menuPdfIdx]) : "",
        galleryLink: galleryIdx >= 0 ? cleanUrl(r[galleryIdx]) : "",
        youtube: ytIdx >= 0 ? cleanUrl(r[ytIdx]) : "",
        pocName: pocNameIdx >= 0 ? cleanString(r[pocNameIdx]) : "",
        pocDesignation: pocDesigIdx >= 0 ? cleanString(r[pocDesigIdx]) : "",
        pocContact: pocContactIdx >= 0 ? cleanPhone(r[pocContactIdx]) : "",
      });
    }
  }

  return list;
}

async function run() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log(`\n======================================================`);
  console.log(`  EXCEL RESTAURANT SOURCE OF TRUTH SYNC`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (Safe, no DB writes)" : "APPLY (Live DB sync)"}`);
  console.log(`======================================================\n`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL missing in environment");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.split("?")[0],
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  const client = await pool.connect();

  try {
    const excelItems = parseExcel();
    console.log(`✓ Parsed ${excelItems.length} restaurant entries from Excel source of truth.`);

    // 1. Fetch Categories for matching
    const { rows: dbCategories } = await client.query(
      `SELECT id, name, slug FROM public.categories`
    );
    const catMapByName = new Map<string, number>();
    for (const c of dbCategories) {
      catMapByName.set(c.name.toLowerCase().trim(), Number(c.id));
      catMapByName.set(c.slug.toLowerCase().trim(), Number(c.id));
    }

    // Default food category fallback
    const defaultFoodCatId =
      catMapByName.get("restaurants-cafes") ||
      catMapByName.get("food-dining") ||
      Number(dbCategories[0]?.id || 81);

    // 2. Fetch all existing listings for comparison
    const { rows: dbListings } = await client.query(
      `SELECT id, name, slug, address, phone_number, website, email, place_id,
              facebook_url, instagram_url, whatsapp_number, youtube_url, google_maps_url,
              latitude, longitude, status, description, custom_attributes, menu_pdf_url
       FROM public.listings`
    );

    const dbByPlaceId = new Map<string, any>();
    const dbByNameNorm = new Map<string, any[]>();
    const existingSlugs = new Set<string>();

    for (const l of dbListings) {
      if (l.place_id && l.place_id.trim()) {
        dbByPlaceId.set(l.place_id.trim(), l);
      }
      const norm = l.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!dbByNameNorm.has(norm)) dbByNameNorm.set(norm, []);
      dbByNameNorm.get(norm)!.push(l);

      if (l.slug) existingSlugs.add(l.slug.toLowerCase());
    }

    console.log(`✓ Loaded ${dbListings.length} existing database listings.`);

    // Tracking stats
    let matchedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;
    let categoryLinksCount = 0;

    const diffSamples: any[] = [];

    if (isApply) {
      console.log("\n→ Starting database transaction & snapshot backup...");
      await client.query("BEGIN");

      // Create backup table if applying
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.listings_backup_excel_sync_20260915 AS
        SELECT * FROM public.listings;
      `);
      console.log("✓ Safety backup snapshot table verified: public.listings_backup_excel_sync_20260915");
    }

    for (const excel of excelItems) {
      // Check match:
      // 1. By Place ID
      let matchedDb = excel.placeId ? dbByPlaceId.get(excel.placeId) : null;

      // 2. By Normalized Exact Name
      if (!matchedDb) {
        const normName = excel.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const candidates = dbByNameNorm.get(normName);
        if (candidates && candidates.length > 0) {
          matchedDb = candidates[0];
        }
      }

      // 3. By Brand Base Name (e.g. "McDonald's - Korangi Road" -> "McDonald's")
      if (!matchedDb) {
        const baseName = excel.name.split(/[-–—]/)[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (baseName.length > 3) {
          const candidates = dbByNameNorm.get(baseName);
          if (candidates && candidates.length > 0) {
            matchedDb = candidates[0];
          }
        }
      }

      // Parse feature list
      const featureList = excel.features
        ? excel.features
            .split(/[,|]/)
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : [];

      // Parse categories from Excel to map to category IDs
      const assignedCatIds = new Set<number>();
      if (excel.categories) {
        const catTokens = excel.categories.split(/[,|]/).map((c) => c.trim().toLowerCase());
        for (const tok of catTokens) {
          if (tok.includes("fast food") && catMapByName.has("fast-food-street-food")) {
            assignedCatIds.add(catMapByName.get("fast-food-street-food")!);
          } else if (tok.includes("cafe") && catMapByName.has("cafes-coworking-spots")) {
            assignedCatIds.add(catMapByName.get("cafes-coworking-spots")!);
          } else if (tok.includes("bakery") && catMapByName.has("bakeries-desserts")) {
            assignedCatIds.add(catMapByName.get("bakeries-desserts")!);
          } else if ((tok.includes("pakistani") || tok.includes("desi") || tok.includes("bbq")) && catMapByName.has("pakistani-desi-cuisine")) {
            assignedCatIds.add(catMapByName.get("pakistani-desi-cuisine")!);
          } else if (tok.includes("fine dining") && catMapByName.has("fine-dining-buffets")) {
            assignedCatIds.add(catMapByName.get("fine-dining-buffets")!);
          } else if (tok.includes("beverage") || tok.includes("juice")) {
            if (catMapByName.has("juice-bars-beverages")) assignedCatIds.add(catMapByName.get("juice-bars-beverages")!);
          }
        }
      }
      if (assignedCatIds.size === 0) {
        assignedCatIds.add(defaultFoodCatId);
      }

      if (matchedDb) {
        matchedCount++;

        // Prepare updated custom_attributes
        const existingAttrs = (matchedDb.custom_attributes || {}) as Record<string, any>;
        const updatedAttrs: Record<string, any> = {
          ...existingAttrs,
          source: "excel_master_2026",
          area_sheet: excel.sheet,
        };

        if (excel.timings) updatedAttrs.timings = excel.timings;
        if (featureList.length > 0) updatedAttrs.features = featureList;
        if (excel.keywords) updatedAttrs.keywords = excel.keywords;
        if (excel.galleryLink) updatedAttrs.excel_gallery_link = excel.galleryLink;
        if (excel.pocName || excel.pocContact) {
          updatedAttrs.poc = {
            name: excel.pocName,
            designation: excel.pocDesignation,
            contact: excel.pocContact,
          };
        }

        // Build field updates prioritizing Excel source of truth
        const phone = excel.phone || matchedDb.phone_number;
        const placeId = excel.placeId || matchedDb.place_id;
        const facebook = excel.facebook || matchedDb.facebook_url;
        const instagram = excel.instagram || matchedDb.instagram_url;
        const whatsapp = excel.whatsapp || matchedDb.whatsapp_number;
        const website = excel.website || matchedDb.website;
        const gmaps = excel.googleMapsUrl || matchedDb.google_maps_url;
        const menuPdf = excel.menuPdf || matchedDb.menu_pdf_url;
        const showMember = excel.membership.toLowerCase().includes("member") || matchedDb.show_member_badge || false;
        const lat = excel.lat ?? matchedDb.latitude;
        const lng = excel.lng ?? matchedDb.longitude;

        if (isApply) {
          let locFragment = "";
          const queryParams: any[] = [
            phone,
            placeId,
            facebook,
            instagram,
            whatsapp,
            website,
            gmaps,
            menuPdf,
            showMember,
            JSON.stringify(updatedAttrs),
            matchedDb.id,
          ];

          if (lat != null && lng != null) {
            locFragment = `, latitude = $12, longitude = $13, location = extensions.ST_SetSRID(extensions.ST_MakePoint($13::double precision, $12::double precision), 4326)::extensions.geography`;
            queryParams.push(lat, lng);
          }

          await client.query(
            `UPDATE public.listings
             SET phone_number = $1,
                 place_id = $2,
                 facebook_url = $3,
                 instagram_url = $4,
                 whatsapp_number = $5,
                 website = $6,
                 google_maps_url = $7,
                 menu_pdf_url = $8,
                 show_member_badge = $9,
                 custom_attributes = $10,
                 updated_at = NOW()
                 ${locFragment}
             WHERE id = $11`,
            queryParams
          );

          // Update category relationships
          for (const catId of assignedCatIds) {
            await client.query(
              `INSERT INTO public.listing_categories (listing_id, category_id, is_primary)
               VALUES ($1, $2, false)
               ON CONFLICT (listing_id, category_id) DO NOTHING`,
              [matchedDb.id, catId]
            );
            categoryLinksCount++;
          }
        }

        updatedCount++;
        if (diffSamples.length < 5) {
          diffSamples.push({
            type: "UPDATE",
            id: matchedDb.id,
            name: matchedDb.name,
            phone,
            placeId,
            timings: excel.timings,
            features: featureList,
            facebook,
            instagram,
          });
        }
      } else {
        // Unmatched -> INSERT as new listing
        let baseSlug = cleanSlug(`${excel.name}-${excel.sheet}`);
        if (!baseSlug) baseSlug = `restaurant-${Date.now()}`;
        let slug = baseSlug;
        let suffix = 1;
        while (existingSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix++}`;
        }
        existingSlugs.add(slug);

        const customAttrs = {
          source: "excel_master_2026",
          area_sheet: excel.sheet,
          timings: excel.timings || undefined,
          features: featureList.length > 0 ? featureList : undefined,
          keywords: excel.keywords || undefined,
          excel_gallery_link: excel.galleryLink || undefined,
          poc: (excel.pocName || excel.pocContact) ? {
            name: excel.pocName,
            designation: excel.pocDesignation,
            contact: excel.pocContact,
          } : undefined,
        };

        const showMember = excel.membership.toLowerCase().includes("member");
        const primaryCatId = Array.from(assignedCatIds)[0] || defaultFoodCatId;

        if (isApply) {
          let insertRes: any;
          if (excel.lat != null && excel.lng != null) {
            insertRes = await client.query(
              `INSERT INTO public.listings (
                name, slug, description, address, latitude, longitude, location,
                phone_number, website, email, place_id, facebook_url, instagram_url,
                whatsapp_number, youtube_url, google_maps_url, menu_pdf_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, extensions.ST_SetSRID(extensions.ST_MakePoint($6::double precision, $5::double precision), 4326)::extensions.geography,
                $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16,
                'published', false, $17, $18, $19,
                NOW(), NOW()
              ) RETURNING id`,
              [
                excel.name,
                slug,
                excel.description || `${excel.name} in ${excel.sheet}, Karachi.`,
                excel.address || `${excel.sheet}, Karachi`,
                excel.lat,
                excel.lng,
                excel.phone || null,
                excel.website || null,
                excel.email || null,
                excel.placeId || null,
                excel.facebook || null,
                excel.instagram || null,
                excel.whatsapp || null,
                excel.youtube || null,
                excel.googleMapsUrl || null,
                excel.menuPdf || null,
                showMember,
                primaryCatId,
                JSON.stringify(customAttrs),
              ]
            );
          } else {
            insertRes = await client.query(
              `INSERT INTO public.listings (
                name, slug, description, address,
                phone_number, website, email, place_id, facebook_url, instagram_url,
                whatsapp_number, youtube_url, google_maps_url, menu_pdf_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14,
                'published', false, $15, $16, $17,
                NOW(), NOW()
              ) RETURNING id`,
              [
                excel.name,
                slug,
                excel.description || `${excel.name} in ${excel.sheet}, Karachi.`,
                excel.address || `${excel.sheet}, Karachi`,
                excel.phone || null,
                excel.website || null,
                excel.email || null,
                excel.placeId || null,
                excel.facebook || null,
                excel.instagram || null,
                excel.whatsapp || null,
                excel.youtube || null,
                excel.googleMapsUrl || null,
                excel.menuPdf || null,
                showMember,
                primaryCatId,
                JSON.stringify(customAttrs),
              ]
            );
          }

          const newId = insertRes.rows[0]?.id;
          if (newId) {
            for (const catId of assignedCatIds) {
              await client.query(
                `INSERT INTO public.listing_categories (listing_id, category_id, is_primary)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (listing_id, category_id) DO NOTHING`,
                [newId, catId, catId === primaryCatId]
              );
              categoryLinksCount++;
            }
          }
        }

        insertedCount++;
        if (diffSamples.length < 8) {
          diffSamples.push({
            type: "INSERT",
            name: excel.name,
            sheet: excel.sheet,
            slug,
            address: excel.address,
            phone: excel.phone,
            placeId: excel.placeId,
            timings: excel.timings,
          });
        }
      }
    }

    if (isApply) {
      await client.query("COMMIT");
      console.log("\n✓ Transaction committed successfully to database.");
    }

    console.log(`\n======================================================`);
    console.log(`  SYNC EXECUTION SUMMARY`);
    console.log(`======================================================`);
    console.log(`• Total Excel Records Processed: ${excelItems.length}`);
    console.log(`• Matched Existing Listings:     ${matchedCount}`);
    console.log(`• Listings Enriched / Updated:   ${updatedCount}`);
    console.log(`• New Listings Inserted:         ${insertedCount}`);
    if (isApply) {
      console.log(`• Category Links Created:        ${categoryLinksCount}`);
    }
    console.log(`======================================================\n`);

    console.log("Sample Actions:");
    console.dir(diffSamples, { depth: null });

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    if (isApply) {
      console.error("\n❌ Error encountered. Rolling back transaction...");
      await client.query("ROLLBACK");
    }
    client.release();
    await pool.end();
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

run().catch(console.error);
