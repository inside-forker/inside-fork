/**
 * Split nested listing_branches on multi-branch parents into separate
 * location listings, attach them to a brand group, optionally archive parent.
 *
 * Usage:
 *   npx tsx scripts/split-multi-branch-listings.ts --pilot
 *   npx tsx scripts/split-multi-branch-listings.ts --pilot --apply
 *   npx tsx scripts/split-multi-branch-listings.ts --ids=10495,8766 --apply
 *   npx tsx scripts/split-multi-branch-listings.ts --food --limit=15 --apply
 *
 * Pilot brands: Xander's, KFC, Agha Juice, Melbrew Coffee
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { brandStemFromListingName } from "../lib/listings/borrowed-header-image";

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envPath = path.join(process.cwd(), ".env");
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const PILOT = process.argv.includes("--pilot");
const FOOD = process.argv.includes("--food");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const EXPLICIT_IDS = idsArg
  ? idsArg
      .slice("--ids=".length)
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n))
  : [];
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const offsetArg = process.argv.find((a) => a.startsWith("--offset="));
const LIMIT = limitArg ? parseInt(limitArg.slice("--limit=".length), 10) : 0;
const OFFSET = offsetArg ? parseInt(offsetArg.slice("--offset=".length), 10) : 0;

const FOOD_CATEGORY_RE =
  "(Restaurant|Fast Food|Baker|Beverag|Dessert|Coffee|Icecream|Pakistani|Chinese|Pizza|Juice)";

const MATCH_RADIUS_M = 150;

const PILOT_NAMES = [
  "Xander's",
  "KFC",
  "Agha Juice",
  "Melbrew Coffee",
];

function cleanDbUrl(raw: string): string {
  return raw.split("?")[0];
}

function slugify(parts: string[]): string {
  const base = parts
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return base || "location";
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const STOP_TOKENS = new Set([
  "karachi",
  "branch",
  "pakistan",
  "mall",
  "road",
  "rd",
  "area",
  "block",
  "town",
  "the",
  "and",
  "of",
  "ave",
  "phase",
  "commercial",
  "north",
  "south",
  "east",
  "west",
]);

function normalizeLocLabel(s: string): string {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const filtered = tokens.filter((t) => t.length > 1 && !STOP_TOKENS.has(t));
  // Keep distinctive short labels (e.g. "e street") when filtering wiped everything
  const kept =
    filtered.length > 0
      ? filtered
      : tokens.filter((t) => !["karachi", "branch", "pakistan"].includes(t));
  return kept.join(" ").trim();
}

/** True when one location label is the same place as the other. */
function labelsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Phrase containment only when the shorter side has 2+ tokens
  // ("dolmen clifton" in "dolmen mall clifton"), never single-token
  // substrings ("nazimabad" inside "block h north nazimabad").
  const [shorterStr, longerStr] = a.length <= b.length ? [a, b] : [b, a];
  if (
    shorterStr.split(/\s+/).filter(Boolean).length >= 2 &&
    longerStr.includes(shorterStr)
  ) {
    return true;
  }
  const ta = a.split(/\s+/).filter(Boolean);
  const tb = b.split(/\s+/).filter(Boolean);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (shorter.length < 2) return false;
  const longSet = new Set(longer);
  return shorter.every((t) => longSet.has(t));
}

type Parent = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category_id: number | null;
  owner_id: string | null;
  phone_number: string | null;
  email: string | null;
  website: string | null;
  custom_attributes: unknown;
  peekaboo_id: number | null;
};

type Branch = {
  id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  is_primary: boolean | null;
  peekaboo_branch_id: number | null;
  timings: string | null;
};

async function uniqueSlug(client: Client, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const { rows } = await client.query(
      `SELECT 1 FROM listings WHERE slug = $1 LIMIT 1`,
      [candidate],
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${n++}`.slice(0, 120);
  }
}

async function findExistingSibling(
  client: Client,
  brandName: string,
  branch: Branch,
  excludeListingId: number,
): Promise<{ id: number; name: string; slug: string } | null> {
  const stem = brandStemFromListingName(brandName) ?? brandName;
  const stems = [stem];
  // "Melbrew Coffee" → also try "Melbrew"; "Domino's Pizza Pakistan" → "Domino's Pizza"
  const parts = stem.split(/\s+/);
  if (parts.length > 1) {
    stems.push(parts.slice(0, -1).join(" "));
    if (parts.length > 2) stems.push(parts.slice(0, -2).join(" "));
  }

  const { rows } = await client.query<{
    id: number;
    name: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
  }>(
    `SELECT id, name, slug, latitude, longitude
     FROM listings
     WHERE status = 'published'
       AND id <> $2
       AND (
         name ILIKE ANY (
           SELECT stem || ' - %' FROM unnest($1::text[]) AS stem
         )
         OR lower(trim(name)) = ANY (
           SELECT lower(trim(stem)) FROM unnest($1::text[]) AS stem
         )
       )`,
    [stems, excludeListingId],
  );

  const branchLabel = normalizeLocLabel(branch.name);
  const stemKeys = new Set(stems.map((s) => s.trim().toLowerCase()));
  let best: { id: number; name: string; slug: string; score: number } | null =
    null;

  for (const row of rows) {
    if (stemKeys.has(row.name.trim().toLowerCase())) continue;
    const rowLabel = normalizeLocLabel(
      row.name.includes(" - ")
        ? row.name.slice(row.name.indexOf(" - ") + 3)
        : row.name,
    );
    if (!labelsMatch(rowLabel, branchLabel)) continue;

    let score = 50;
    if (
      row.latitude != null &&
      row.longitude != null &&
      Number.isFinite(Number(row.latitude)) &&
      Number.isFinite(Number(row.longitude))
    ) {
      const d = haversineM(
        Number(branch.latitude),
        Number(branch.longitude),
        Number(row.latitude),
        Number(row.longitude),
      );
      if (d <= MATCH_RADIUS_M) score += 100 - d / 2;
    }
    if (!best || score > best.score) {
      best = { id: Number(row.id), name: row.name, slug: row.slug, score };
    }
  }

  return best ? { id: best.id, name: best.name, slug: best.slug } : null;
}

async function ensureBrandGroup(
  client: Client,
  brandName: string,
): Promise<number> {
  const stem = brandStemFromListingName(brandName) ?? brandName;
  const slugCandidates = [slugify([stem])];
  const parts = stem.split(/\s+/);
  if (parts.length > 1) {
    slugCandidates.push(slugify([parts.slice(0, -1).join(" ")]));
  }

  for (const slug of slugCandidates) {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM brand_groups WHERE slug = $1`,
      [slug],
    );
    if (rows[0]) return Number(rows[0].id);
  }

  const displayName = parts.length > 1 ? parts.slice(0, -1).join(" ") : stem;
  const slug = slugify([displayName]);
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO brand_groups (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [displayName, slug],
  );
  return Number(rows[0].id);
}

async function attachMember(
  client: Client,
  groupId: number,
  listingId: number,
  sortOrder: number,
) {
  await client.query(`DELETE FROM brand_group_members WHERE listing_id = $1`, [
    listingId,
  ]);
  await client.query(
    `INSERT INTO brand_group_members (group_id, listing_id, sort_order, source)
     VALUES ($1, $2, $3, 'split_from_branch')`,
    [groupId, listingId, sortOrder],
  );
}

async function copyCategories(
  client: Client,
  fromListingId: number,
  toListingId: number,
) {
  await client.query(
    `INSERT INTO listing_categories (listing_id, category_id, is_primary, relevance_score)
     SELECT $2, category_id, is_primary, relevance_score
     FROM listing_categories
     WHERE listing_id = $1
     ON CONFLICT (listing_id, category_id) DO NOTHING`,
    [fromListingId, toListingId],
  );
}

async function remapBranchOwned(
  client: Client,
  oldBranchId: number,
  newListingId: number,
  newBranchId: number,
) {
  await client.query(
    `UPDATE reviews SET listing_id = $1, branch_id = $2 WHERE branch_id = $3`,
    [newListingId, newBranchId, oldBranchId],
  );
  await client.query(
    `UPDATE opening_hours SET listing_id = $1, branch_id = $2 WHERE branch_id = $3`,
    [newListingId, newBranchId, oldBranchId],
  );
}

async function main() {
  const connectionString = loadDatabaseUrl();
  const client = new Client({
    connectionString: cleanDbUrl(connectionString),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  });
  await client.connect();
  // PostGIS lives in the `extensions` schema on this DO Postgres.
  await client.query(`SET search_path TO public, extensions`);

  try {
    let parents: Parent[];

    if (EXPLICIT_IDS.length > 0) {
      const { rows } = await client.query<Parent>(
        `SELECT id, name, slug, description, category_id, owner_id,
                phone_number, email, website, custom_attributes, peekaboo_id
         FROM listings WHERE id = ANY($1::bigint[])`,
        [EXPLICIT_IDS],
      );
      parents = rows;
    } else if (PILOT) {
      const { rows } = await client.query<Parent>(
        `SELECT id, name, slug, description, category_id, owner_id,
                phone_number, email, website, custom_attributes, peekaboo_id
         FROM listings
         WHERE status = 'published' AND name = ANY($1::text[])`,
        [PILOT_NAMES],
      );
      parents = rows;
    } else if (FOOD) {
      const { rows } = await client.query<Parent>(
        `SELECT l.id, l.name, l.slug, l.description, l.category_id, l.owner_id,
                l.phone_number, l.email, l.website, l.custom_attributes, l.peekaboo_id
         FROM listings l
         JOIN listing_branches lb ON lb.listing_id = l.id
         LEFT JOIN categories c ON c.id = l.category_id
         WHERE l.status = 'published'
           AND COALESCE(c.name, '') ~* $1
         GROUP BY l.id
         HAVING COUNT(lb.id) > 1
         ORDER BY COUNT(lb.id) DESC, l.name
         LIMIT $2 OFFSET $3`,
        [FOOD_CATEGORY_RE, LIMIT > 0 ? LIMIT : 10_000, OFFSET],
      );
      parents = rows;
    } else {
      console.error("Pass --pilot, --food, or --ids=1,2,3");
      process.exit(1);
    }

    console.log(
      `# split-multi-branch (${APPLY ? "APPLY" : "dry-run"}) parents=${parents.length}`,
    );

    for (const parent of parents) {
      const { rows: branches } = await client.query<Branch>(
        `SELECT id, name, address, city, country, latitude, longitude,
                phone_number, is_primary, peekaboo_branch_id, timings
         FROM listing_branches
         WHERE listing_id = $1
         ORDER BY is_primary DESC, id ASC`,
        [parent.id],
      );

      if (branches.length <= 1) {
        console.log(`skip ${parent.name} (#${parent.id}): <=1 branch`);
        continue;
      }

      const brandName =
        brandStemFromListingName(parent.name) ?? parent.name.trim();
      console.log(
        `\n## ${parent.name} (#${parent.id}) branches=${branches.length} brand=${brandName}`,
      );

      if (!APPLY) {
        for (const b of branches) {
          const match = await findExistingSibling(
            client,
            parent.name,
            {
              ...b,
              latitude: Number(b.latitude),
              longitude: Number(b.longitude),
            },
            parent.id,
          );
          console.log(
            `  - ${b.name} → ${match ? `MATCH #${match.id} ${match.name}` : `CREATE "${brandName} - ${b.name}"`}`,
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        const groupId = await ensureBrandGroup(client, brandName);
        let sort = 0;

        for (const raw of branches) {
          const branch = {
            ...raw,
            id: Number(raw.id),
            latitude: Number(raw.latitude),
            longitude: Number(raw.longitude),
          };

          const match = await findExistingSibling(
            client,
            parent.name,
            branch,
            parent.id,
          );
          let outletId: number;

          if (match) {
            outletId = match.id;
            await client.query(
              `UPDATE listings SET
                 address = COALESCE(NULLIF(address, ''), $2),
                 latitude = COALESCE(latitude, $3),
                 longitude = COALESCE(longitude, $4),
                 phone_number = COALESCE(phone_number, $5),
                 updated_at = now()
               WHERE id = $1`,
              [
                outletId,
                branch.address,
                branch.latitude,
                branch.longitude,
                branch.phone_number ?? parent.phone_number,
              ],
            );

            const { rows: existingBranches } = await client.query<{
              id: number;
            }>(
              `SELECT id FROM listing_branches WHERE listing_id = $1 ORDER BY is_primary DESC, id ASC LIMIT 1`,
              [outletId],
            );

            if (branch.peekaboo_branch_id != null) {
              await client.query(
                `UPDATE listing_branches SET peekaboo_branch_id = NULL WHERE id = $1`,
                [branch.id],
              );
            }

            let newBranchId: number;
            if (existingBranches[0]) {
              newBranchId = Number(existingBranches[0].id);
              await client.query(
                `UPDATE listing_branches SET
                   name = $2, address = $3, city = $4, country = $5,
                   latitude = $6, longitude = $7,
                   phone_number = COALESCE($8, phone_number),
                   peekaboo_branch_id = COALESCE($9, peekaboo_branch_id),
                   timings = COALESCE($10, timings),
                   is_primary = true,
                   updated_at = now()
                 WHERE id = $1`,
                [
                  newBranchId,
                  branch.name,
                  branch.address,
                  branch.city || "Karachi",
                  branch.country || "Pakistan",
                  branch.latitude,
                  branch.longitude,
                  branch.phone_number,
                  branch.peekaboo_branch_id,
                  branch.timings,
                ],
              );
            } else {
              const { rows: inserted } = await client.query<{ id: number }>(
                `INSERT INTO listing_branches
                   (listing_id, name, address, city, country, latitude, longitude,
                    phone_number, is_primary, peekaboo_branch_id, timings, location)
                 VALUES
                   ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10,
                    ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography)
                 RETURNING id`,
                [
                  outletId,
                  branch.name,
                  branch.address,
                  branch.city || "Karachi",
                  branch.country || "Pakistan",
                  branch.latitude,
                  branch.longitude,
                  branch.phone_number,
                  branch.peekaboo_branch_id,
                  branch.timings,
                ],
              );
              newBranchId = Number(inserted[0].id);
            }

            await remapBranchOwned(client, branch.id, outletId, newBranchId);
            console.log(`  matched ${branch.name} → #${outletId} ${match.name}`);
          } else {
            const locationLabel = branch.name
              .replace(/\s*Karachi\s*Branch\s*$/i, "")
              .replace(/\s+Branch\s*$/i, "")
              .trim();
            // Melbrew Coffee → Melbrew (matches existing Excel "Melbrew - …" names)
            const displayBrand = brandName.replace(/\s+Coffee\s*$/i, "").trim() || brandName;
            const displayName = `${displayBrand} - ${locationLabel}`.trim();
            const slug = await uniqueSlug(
              client,
              slugify([displayBrand, locationLabel]),
            );

            const { rows: created } = await client.query<{ id: number }>(
              `INSERT INTO listings (
                 name, slug, description, address, latitude, longitude,
                 category_id, owner_id, phone_number, email, website,
                 status, custom_attributes, location
               ) VALUES (
                 $1, $2, $3, $4, $5, $6,
                 $7, $8, $9, $10, $11,
                 'published', $12,
                 ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography
               ) RETURNING id`,
              [
                displayName,
                slug,
                parent.description,
                branch.address,
                branch.latitude,
                branch.longitude,
                parent.category_id,
                parent.owner_id,
                branch.phone_number ?? parent.phone_number,
                parent.email,
                parent.website,
                parent.custom_attributes,
              ],
            );
            outletId = Number(created[0].id);

            // peekaboo_branch_id is globally unique — free it on the parent branch first
            if (branch.peekaboo_branch_id != null) {
              await client.query(
                `UPDATE listing_branches SET peekaboo_branch_id = NULL WHERE id = $1`,
                [branch.id],
              );
            }

            const { rows: newBranchRows } = await client.query<{ id: number }>(
              `INSERT INTO listing_branches
                 (listing_id, name, address, city, country, latitude, longitude,
                  phone_number, is_primary, peekaboo_branch_id, timings, location)
               VALUES
                 ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10,
                  ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography)
               RETURNING id`,
              [
                outletId,
                branch.name,
                branch.address,
                branch.city || "Karachi",
                branch.country || "Pakistan",
                branch.latitude,
                branch.longitude,
                branch.phone_number,
                branch.peekaboo_branch_id,
                branch.timings,
              ],
            );
            const newBranchId = Number(newBranchRows[0].id);

            await copyCategories(client, parent.id, outletId);
            await remapBranchOwned(client, branch.id, outletId, newBranchId);

            // Copy primary image if any
            await client.query(
              `INSERT INTO listing_images (listing_id, url, alt_text, is_primary, display_order)
               SELECT $2, url, alt_text, is_primary, display_order
               FROM listing_images
               WHERE listing_id = $1
                 AND url NOT LIKE '%/menu/%'
               ORDER BY is_primary DESC, display_order ASC
               LIMIT 3`,
              [parent.id, outletId],
            );

            console.log(`  created ${displayName} (#${outletId}) slug=${slug}`);
          }

          await attachMember(client, groupId, outletId, sort++);
        }

        await client.query(
          `UPDATE listings SET status = 'archived', updated_at = now() WHERE id = $1`,
          [parent.id],
        );
        console.log(`  archived parent #${parent.id}`);

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  FAILED ${parent.name}:`, err);
        throw err;
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
