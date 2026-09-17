import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { Pool } from "pg";

const EXCEL_PATH = path.resolve(
  __dirname,
  "../things-to-do - INSIDEkhi.xlsx"
);

interface ThingItem {
  sheet: string;
  section: string;
  placeId: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  youtube: string;
  googleMapsUrl: string;
  timings: string;
  features: string;
  keywords: string;
  lat: number | null;
  lng: number | null;
}

function cleanStr(val: any): string {
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
  const s = cleanStr(val);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s) && (s.includes(".") || s.includes("/"))) {
    return `https://${s}`;
  }
  return s;
}

function cleanPhone(val: any): string {
  const s = cleanStr(val);
  if (!s) return "";
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

function parseThingsExcel(): ThingItem[] {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found at: ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const placesMap = new Map<string, ThingItem>();

  // 1. Process 'Copy of Sheet1'
  if (wb.Sheets["Copy of Sheet1"]) {
    const wsCopy = wb.Sheets["Copy of Sheet1"];
    const rowsCopy = XLSX.utils.sheet_to_json(wsCopy, { header: 1 }) as any[][];
    let currentSec = "Activities & Attractions";

    for (let i = 1; i < rowsCopy.length; i++) {
      const r = rowsCopy[i];
      if (!r || r.length === 0) continue;
      const nonEmpties = r.filter((c) => cleanStr(c) !== "");
      if (nonEmpties.length === 1 && typeof nonEmpties[0] === "string") {
        currentSec = cleanStr(nonEmpties[0]);
        continue;
      }
      if (r.length < 3) continue;

      const placeId = cleanStr(r[0]);
      const name = cleanStr(r[2]);
      if (!name) continue;

      const { lat, lng } = parseLatLng(r[11]);

      const key = placeId || name.toLowerCase().replace(/[^a-z0-9]/g, "");
      placesMap.set(key, {
        sheet: "Copy of Sheet1",
        section: currentSec,
        placeId,
        name,
        description: cleanStr(r[3]),
        facebook: cleanUrl(r[4]),
        instagram: cleanUrl(r[5]),
        whatsapp: cleanPhone(r[6]),
        googleMapsUrl: cleanUrl(r[7]),
        address: cleanStr(r[8]),
        phone: cleanPhone(r[9]),
        email: cleanStr(r[10]),
        lat,
        lng,
        website: cleanUrl(r[12]),
        timings: cleanStr(r[13]),
        features: cleanStr(r[14]),
        keywords: cleanStr(r[15]),
        youtube: cleanUrl(r[23]),
      });
    }
  }

  // 2. Process 'Sheet1'
  if (wb.Sheets["Sheet1"]) {
    const wsSheet1 = wb.Sheets["Sheet1"];
    const rowsSheet1 = XLSX.utils.sheet_to_json(wsSheet1, { header: 1 }) as any[][];

    for (let i = 1; i < rowsSheet1.length; i++) {
      const r = rowsSheet1[i];
      if (!r || r.length < 2) continue;
      const placeId = cleanStr(r[0]);
      const name = cleanStr(r[1]);
      if (!name) continue;

      const key = placeId || name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (placesMap.has(key)) {
        const existing = placesMap.get(key)!;
        if (!existing.description) existing.description = cleanStr(r[5]);
        if (!existing.address) existing.address = cleanStr(r[2]);
        if (!existing.phone) existing.phone = cleanPhone(r[3]);
        if (!existing.website) existing.website = cleanUrl(r[4]);
        if (!existing.keywords) existing.keywords = cleanStr(r[6]);
        if (!existing.googleMapsUrl) existing.googleMapsUrl = cleanUrl(r[7]);
      } else {
        placesMap.set(key, {
          sheet: "Sheet1",
          section: "Activities & Attractions",
          placeId,
          name,
          address: cleanStr(r[2]),
          phone: cleanPhone(r[3]),
          website: cleanUrl(r[4]),
          description: cleanStr(r[5]),
          keywords: cleanStr(r[6]),
          googleMapsUrl: cleanUrl(r[7]),
          facebook: "",
          instagram: "",
          whatsapp: "",
          youtube: "",
          timings: "",
          features: "",
          email: "",
          lat: null,
          lng: null,
        });
      }
    }
  }

  return Array.from(placesMap.values());
}

async function run() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log(`\n======================================================`);
  console.log(`  THINGS-TO-DO & ATTRACTIONS SOURCE OF TRUTH SYNC`);
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
    const items = parseThingsExcel();
    console.log(`✓ Parsed ${items.length} unique Things-To-Do attractions from Excel.`);

    // 1. Fetch Categories for matching
    const { rows: dbCategories } = await client.query(
      `SELECT id, name, slug FROM public.categories`
    );
    const catMapByName = new Map<string, number>();
    for (const c of dbCategories) {
      catMapByName.set(c.name.toLowerCase().trim(), Number(c.id));
      catMapByName.set(c.slug.toLowerCase().trim(), Number(c.id));
    }

    const entertainmentCatId = catMapByName.get("entertainment-recreation") || 99;
    const parksCatId = catMapByName.get("parks-outdoor-spaces") || 136;
    const cinemasCatId = catMapByName.get("cinemas") || 135;
    const tourismCatId = catMapByName.get("travel-tourism") || 97;
    const sportsCatId = catMapByName.get("fitness-sports") || 104;

    // 2. Fetch all existing listings
    const { rows: dbListings } = await client.query(
      `SELECT id, name, slug, address, phone_number, website, email, place_id,
              facebook_url, instagram_url, whatsapp_number, youtube_url, google_maps_url,
              latitude, longitude, status, description, custom_attributes
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

    let matchedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;
    let categoryLinksCount = 0;

    const diffSamples: any[] = [];

    if (isApply) {
      console.log("\n→ Starting database transaction...");
      await client.query("BEGIN");
    }

    for (const item of items) {
      // 1. By Place ID
      let matchedDb = item.placeId ? dbByPlaceId.get(item.placeId) : null;

      // 2. By Normalized Exact Name
      if (!matchedDb) {
        const norm = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const candidates = dbByNameNorm.get(norm);
        if (candidates && candidates.length > 0) {
          matchedDb = candidates[0];
        }
      }

      // 3. By Base Name
      if (!matchedDb) {
        const baseName = item.name.split(/[-–—]/)[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (baseName.length > 3) {
          const candidates = dbByNameNorm.get(baseName);
          if (candidates && candidates.length > 0) {
            matchedDb = candidates[0];
          }
        }
      }

      // Determine category IDs based on section name
      const assignedCatIds = new Set<number>();
      const secUpper = item.section.toUpperCase();
      if (secUpper.includes("CINEMA")) {
        assignedCatIds.add(cinemasCatId);
      } else if (secUpper.includes("PARK") || secUpper.includes("BEACH") || secUpper.includes("AMUSEMENT")) {
        assignedCatIds.add(parksCatId);
        assignedCatIds.add(entertainmentCatId);
      } else if (secUpper.includes("MUSEUM") || secUpper.includes("HISTORICAL")) {
        assignedCatIds.add(tourismCatId);
        assignedCatIds.add(entertainmentCatId);
      } else if (secUpper.includes("SPORTS") || secUpper.includes("FITNESS") || secUpper.includes("ARENA")) {
        assignedCatIds.add(sportsCatId);
        assignedCatIds.add(entertainmentCatId);
      } else {
        assignedCatIds.add(entertainmentCatId);
      }

      const featureList = item.features
        ? item.features
            .split(/[,|]/)
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : [];

      if (matchedDb) {
        matchedCount++;

        const existingAttrs = (matchedDb.custom_attributes || {}) as Record<string, any>;
        const updatedAttrs: Record<string, any> = {
          ...existingAttrs,
          source: "excel_things_to_do_2026",
          section: item.section,
        };

        if (item.timings) updatedAttrs.timings = item.timings;
        if (featureList.length > 0) updatedAttrs.features = featureList;
        if (item.keywords) updatedAttrs.review_keywords = item.keywords;

        const phone = item.phone || matchedDb.phone_number;
        const placeId = item.placeId || matchedDb.place_id;
        const facebook = item.facebook || matchedDb.facebook_url;
        const instagram = item.instagram || matchedDb.instagram_url;
        const whatsapp = item.whatsapp || matchedDb.whatsapp_number;
        const website = item.website || matchedDb.website;
        const gmaps = item.googleMapsUrl || matchedDb.google_maps_url;
        const desc = (item.description && item.description.length > (matchedDb.description?.length || 0))
          ? item.description
          : (matchedDb.description || item.description);
        const lat = item.lat ?? matchedDb.latitude;
        const lng = item.lng ?? matchedDb.longitude;

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
            desc,
            JSON.stringify(updatedAttrs),
            matchedDb.id,
          ];

          if (lat != null && lng != null) {
            locFragment = `, latitude = $11, longitude = $12, location = extensions.ST_SetSRID(extensions.ST_MakePoint($12::double precision, $11::double precision), 4326)::extensions.geography`;
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
                 description = $8,
                 custom_attributes = $9,
                 updated_at = NOW()
                 ${locFragment}
             WHERE id = $10`,
            queryParams
          );

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
            section: item.section,
          });
        }
      } else {
        // Unmatched -> INSERT as new landmark attraction listing
        let baseSlug = cleanSlug(item.name);
        if (!baseSlug) baseSlug = `attraction-${Date.now()}`;
        let slug = baseSlug;
        let suffix = 1;
        while (existingSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix++}`;
        }
        existingSlugs.add(slug);

        const customAttrs = {
          source: "excel_things_to_do_2026",
          section: item.section,
          timings: item.timings || undefined,
          features: featureList.length > 0 ? featureList : undefined,
          review_keywords: item.keywords || undefined,
        };

        const primaryCatId = Array.from(assignedCatIds)[0] || entertainmentCatId;

        if (isApply) {
          let insertRes: any;
          if (item.lat != null && item.lng != null) {
            insertRes = await client.query(
              `INSERT INTO public.listings (
                name, slug, description, address, latitude, longitude, location,
                phone_number, website, email, place_id, facebook_url, instagram_url,
                whatsapp_number, youtube_url, google_maps_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, extensions.ST_SetSRID(extensions.ST_MakePoint($6::double precision, $5::double precision), 4326)::extensions.geography,
                $7, $8, $9, $10, $11, $12,
                $13, $14, $15,
                'published', false, false, $16, $17,
                NOW(), NOW()
              ) RETURNING id`,
              [
                item.name,
                slug,
                item.description || `${item.name} in Karachi.`,
                item.address || "Karachi, Pakistan",
                item.lat,
                item.lng,
                item.phone || null,
                item.website || null,
                item.email || null,
                item.placeId || null,
                item.facebook || null,
                item.instagram || null,
                item.whatsapp || null,
                item.youtube || null,
                item.googleMapsUrl || null,
                primaryCatId,
                JSON.stringify(customAttrs),
              ]
            );
          } else {
            insertRes = await client.query(
              `INSERT INTO public.listings (
                name, slug, description, address,
                phone_number, website, email, place_id, facebook_url, instagram_url,
                whatsapp_number, youtube_url, google_maps_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12, $13,
                'published', false, false, $14, $15,
                NOW(), NOW()
              ) RETURNING id`,
              [
                item.name,
                slug,
                item.description || `${item.name} in Karachi.`,
                item.address || "Karachi, Pakistan",
                item.phone || null,
                item.website || null,
                item.email || null,
                item.placeId || null,
                item.facebook || null,
                item.instagram || null,
                item.whatsapp || null,
                item.youtube || null,
                item.googleMapsUrl || null,
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
        if (diffSamples.length < 10) {
          diffSamples.push({
            type: "INSERT",
            name: item.name,
            section: item.section,
            slug,
            address: item.address,
            phone: item.phone,
            placeId: item.placeId,
          });
        }
      }
    }

    if (isApply) {
      await client.query("COMMIT");
      console.log("\n✓ Transaction committed successfully to database.");
    }

    console.log(`\n======================================================`);
    console.log(`  THINGS-TO-DO SYNC SUMMARY`);
    console.log(`======================================================`);
    console.log(`• Total Attractions Processed:   ${items.length}`);
    console.log(`• Matched Existing Listings:     ${matchedCount}`);
    console.log(`• Listings Enriched / Updated:   ${updatedCount}`);
    console.log(`• New Landmark Listings Inserted:${insertedCount}`);
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
    console.error("Things-to-do sync failed:", error);
    process.exit(1);
  }
}

run().catch(console.error);
