import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { Pool } from "pg";

const EXCEL_PATH = path.resolve(
  __dirname,
  "../Salons - INSIDEkhi.xlsx"
);

interface SalonItem {
  area: string;
  placeId: string;
  membership: string;
  name: string;
  address: string;
  timings: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  phone: string;
  email: string;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string;
  description: string;
  website: string;
  features: string;
  keywords: string;
  galleryLink: string;
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

function parseSalonsExcel(): SalonItem[] {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found at: ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const salonsList: SalonItem[] = [];

  const ws = wb.Sheets["Salons - Karachi"];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  let currentArea = "Karachi";

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const nonEmpties = r.filter((c) => cleanStr(c) !== "");
    if (nonEmpties.length === 1 && typeof nonEmpties[0] === "string") {
      currentArea = cleanStr(nonEmpties[0]);
      continue;
    }
    if (r.length < 3) continue;

    const rawName = cleanStr(r[2]);
    if (!rawName) continue;

    const placeId = cleanStr(r[0]);
    const { lat, lng } = parseLatLng(r[10]);

    salonsList.push({
      area: currentArea,
      placeId,
      membership: cleanStr(r[1]),
      name: rawName,
      address: cleanStr(r[3]),
      timings: cleanStr(r[4]),
      facebook: cleanUrl(r[5]),
      instagram: cleanUrl(r[6]),
      whatsapp: cleanPhone(r[7]),
      phone: cleanPhone(r[8]),
      email: cleanStr(r[9]),
      lat,
      lng,
      googleMapsUrl: cleanUrl(r[11]),
      description: cleanStr(r[12]),
      website: cleanUrl(r[13]),
      features: cleanStr(r[14]),
      keywords: cleanStr(r[15]),
      galleryLink: cleanUrl(r[22]),
    });
  }

  return salonsList;
}

async function run() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log(`\n======================================================`);
  console.log(`  SALONS & SPAS SOURCE OF TRUTH SYNC`);
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
    const items = parseSalonsExcel();
    console.log(`✓ Parsed ${items.length} unique Salon entries from Excel.`);

    // 1. Fetch Categories for matching
    const { rows: dbCategories } = await client.query(
      `SELECT id, name, slug FROM public.categories`
    );
    const catMapByName = new Map<string, number>();
    for (const c of dbCategories) {
      catMapByName.set(c.name.toLowerCase().trim(), Number(c.id));
      catMapByName.set(c.slug.toLowerCase().trim(), Number(c.id));
    }

    const salonsCatId = catMapByName.get("salons-spas") || 95;
    const beautyCatId = catMapByName.get("beauty-personal-care") || 78;
    const barbersCatId = catMapByName.get("barbershops-mens-grooming") || 117;
    const nailsCatId = catMapByName.get("nail-studios") || 118;

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

      // Determine categories
      const assignedCatIds = new Set<number>([salonsCatId, beautyCatId]);
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes("barber") || nameLower.includes("men") || nameLower.includes("clipper")) {
        assignedCatIds.add(barbersCatId);
      }
      if (nameLower.includes("nail") || nameLower.includes("basecoat")) {
        assignedCatIds.add(nailsCatId);
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
          source: "excel_salons_2026",
          area: item.area,
        };

        if (item.timings) updatedAttrs.timings = item.timings;
        if (featureList.length > 0) updatedAttrs.features = featureList;
        if (item.keywords) updatedAttrs.review_keywords = item.keywords;
        if (item.galleryLink) updatedAttrs.excel_gallery_link = item.galleryLink;

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
        const showMember = item.membership.toLowerCase().includes("member") || matchedDb.show_member_badge || false;

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
                 description = $8,
                 show_member_badge = $9,
                 custom_attributes = $10,
                 updated_at = NOW()
                 ${locFragment}
             WHERE id = $11`,
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
            area: item.area,
            timings: item.timings,
          });
        }
      } else {
        // Unmatched -> INSERT as new salon listing
        let baseSlug = cleanSlug(`${item.name}-${item.area}`);
        if (!baseSlug) baseSlug = `salon-${Date.now()}`;
        let slug = baseSlug;
        let suffix = 1;
        while (existingSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix++}`;
        }
        existingSlugs.add(slug);

        const customAttrs = {
          source: "excel_salons_2026",
          area: item.area,
          timings: item.timings || undefined,
          features: featureList.length > 0 ? featureList : undefined,
          review_keywords: item.keywords || undefined,
          excel_gallery_link: item.galleryLink || undefined,
        };

        const showMember = item.membership.toLowerCase().includes("member");
        const primaryCatId = salonsCatId;

        if (isApply) {
          let insertRes: any;
          if (item.lat != null && item.lng != null) {
            insertRes = await client.query(
              `INSERT INTO public.listings (
                name, slug, description, address, latitude, longitude, location,
                phone_number, website, email, place_id, facebook_url, instagram_url,
                whatsapp_number, google_maps_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, extensions.ST_SetSRID(extensions.ST_MakePoint($6::double precision, $5::double precision), 4326)::extensions.geography,
                $7, $8, $9, $10, $11, $12,
                $13, $14,
                'published', false, $15, $16, $17,
                NOW(), NOW()
              ) RETURNING id`,
              [
                item.name,
                slug,
                item.description || `${item.name} in ${item.area}, Karachi.`,
                item.address || `${item.area}, Karachi, Pakistan`,
                item.lat,
                item.lng,
                item.phone || null,
                item.website || null,
                item.email || null,
                item.placeId || null,
                item.facebook || null,
                item.instagram || null,
                item.whatsapp || null,
                item.googleMapsUrl || null,
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
                whatsapp_number, google_maps_url,
                status, is_featured, show_member_badge, category_id, custom_attributes,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12,
                'published', false, $13, $14, $15,
                NOW(), NOW()
              ) RETURNING id`,
              [
                item.name,
                slug,
                item.description || `${item.name} in ${item.area}, Karachi.`,
                item.address || `${item.area}, Karachi, Pakistan`,
                item.phone || null,
                item.website || null,
                item.email || null,
                item.placeId || null,
                item.facebook || null,
                item.instagram || null,
                item.whatsapp || null,
                item.googleMapsUrl || null,
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
        if (diffSamples.length < 10) {
          diffSamples.push({
            type: "INSERT",
            name: item.name,
            area: item.area,
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
    console.log(`  SALONS SYNC SUMMARY`);
    console.log(`======================================================`);
    console.log(`• Total Salons Processed:        ${items.length}`);
    console.log(`• Matched Existing Listings:     ${matchedCount}`);
    console.log(`• Listings Enriched / Updated:   ${updatedCount}`);
    console.log(`• New Salon Listings Inserted:   ${insertedCount}`);
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
    console.error("Salons sync failed:", error);
    process.exit(1);
  }
}

run().catch(console.error);
