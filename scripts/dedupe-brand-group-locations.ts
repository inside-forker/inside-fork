/**
 * Within each brand_group, find published members that are the same physical
 * outlet (near-identical coords and/or near-identical location labels) and
 * archive the weaker duplicate (fewer images/reviews, prefer keeping split
 * outlets over empty Excel shells).
 *
 * Usage:
 *   npx tsx scripts/dedupe-brand-group-locations.ts
 *   npx tsx scripts/dedupe-brand-group-locations.ts --slug=kfc
 *   npx tsx scripts/dedupe-brand-group-locations.ts --apply
 *   npx tsx scripts/dedupe-brand-group-locations.ts --slug=kfc --apply
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const slugArg = process.argv.find((a) => a.startsWith("--slug="));
const ONLY_SLUG = slugArg ? slugArg.slice("--slug=".length).trim() : null;
const GEO_M = 120;

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envPath = path.join(process.cwd(), ".env");
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
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

const STOP = new Set([
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
  "phase",
  "commercial",
  "kfc",
  "melbrew",
  "agha",
  "juice",
]);

function locTokens(name: string): Set<string> {
  const loc = name.includes(" - ")
    ? name.slice(name.indexOf(" - ") + 3)
    : name;
  return new Set(
    loc
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

function tokenJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  const union = a.size + b.size - hit;
  return union === 0 ? 0 : hit / union;
}

type Member = {
  id: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  images: number;
  reviews: number;
  source: string;
};

function richness(m: Member): number {
  // Prefer richer content; slight boost for split_from_branch over empty excel shells
  return m.images * 10 + m.reviews * 20 + (m.source === "split_from_branch" ? 3 : 0);
}

async function main() {
  const url = loadDatabaseUrl();
  const client = new Client({
    connectionString: url.split("?")[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  });
  await client.connect();

  try {
    const { rows: groups } = await client.query<{
      id: number;
      name: string;
      slug: string;
    }>(
      ONLY_SLUG
        ? `SELECT id, name, slug FROM brand_groups WHERE slug = $1`
        : `SELECT id, name, slug FROM brand_groups ORDER BY name`,
      ONLY_SLUG ? [ONLY_SLUG] : [],
    );

    console.log(
      `# dedupe-brand-group-locations (${APPLY ? "APPLY" : "dry-run"}) groups=${groups.length}`,
    );

    const allPairs: Array<{
      group: string;
      keep: Member;
      drop: Member;
      reason: string;
      meters: number | null;
    }> = [];

    for (const g of groups) {
      const { rows } = await client.query<{
        id: number | string;
        name: string;
        slug: string;
        latitude: number | string | null;
        longitude: number | string | null;
        images: number | string;
        reviews: number | string;
        source: string;
      }>(
        `SELECT l.id, l.name, l.slug, l.latitude, l.longitude, m.source,
                (SELECT COUNT(*)::int FROM listing_images li WHERE li.listing_id = l.id) AS images,
                (SELECT COUNT(*)::int FROM reviews r WHERE r.listing_id = l.id) AS reviews
         FROM brand_group_members m
         JOIN listings l ON l.id = m.listing_id
         WHERE m.group_id = $1 AND l.status = 'published'
         ORDER BY l.id`,
        [g.id],
      );

      const members: Member[] = rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        slug: r.slug,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        images: Number(r.images),
        reviews: Number(r.reviews),
        source: r.source,
      }));

      const dropped = new Set<number>();

      for (let i = 0; i < members.length; i++) {
        if (dropped.has(members[i].id)) continue;
        for (let j = i + 1; j < members.length; j++) {
          if (dropped.has(members[j].id)) continue;
          const a = members[i];
          const b = members[j];

          let meters: number | null = null;
          let geoHit = false;
          if (
            a.latitude != null &&
            a.longitude != null &&
            b.latitude != null &&
            b.longitude != null
          ) {
            meters = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
            geoHit = meters <= GEO_M;
          }

          const jac = tokenJaccard(locTokens(a.name), locTokens(b.name));
          const nameHit = jac >= 0.5;

          // Same place — never merge two rich, differently-named outlets
          // (Peekaboo sometimes reuses coords across distinct branches).
          const excelShell = a.images === 0 || b.images === 0;
          const same =
            (nameHit && geoHit) ||
            (nameHit && meters != null && meters <= 150) ||
            (nameHit && jac >= 0.85 && meters == null && excelShell) ||
            (excelShell && geoHit && meters != null && meters <= 20);

          if (!same) continue;

          const keep = richness(a) >= richness(b) ? a : b;
          const drop = keep.id === a.id ? b : a;
          const reason = geoHit
            ? `geo_${Math.round(meters ?? 0)}m`
            : `name_jac_${jac.toFixed(2)}`;

          allPairs.push({ group: g.slug, keep, drop, reason, meters });
          dropped.add(drop.id);
        }
      }
    }

    // Summarize by group
    const byGroup = new Map<string, typeof allPairs>();
    for (const p of allPairs) {
      const list = byGroup.get(p.group) ?? [];
      list.push(p);
      byGroup.set(p.group, list);
    }

    console.log(`# duplicate_pairs=${allPairs.length} groups_with_dupes=${byGroup.size}`);
    for (const [slug, pairs] of [...byGroup.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      console.log(`\n## ${slug} (${pairs.length} pairs)`);
      for (const p of pairs) {
        console.log(
          `  KEEP #${p.keep.id} ${p.keep.name} (img=${p.keep.images}) ← DROP #${p.drop.id} ${p.drop.name} (img=${p.drop.images}) [${p.reason}]`,
        );
      }
    }

    if (!APPLY) {
      console.error("\nDry-run only. Re-run with --apply to archive duplicates.");
      return;
    }

    await client.query("BEGIN");
    try {
      for (const p of allPairs) {
        // Move reviews/hours from drop → keep if drop has any
        const { rows: keepBranch } = await client.query<{ id: number }>(
          `SELECT id FROM listing_branches WHERE listing_id = $1 ORDER BY is_primary DESC, id ASC LIMIT 1`,
          [p.keep.id],
        );
        if (keepBranch[0]) {
          await client.query(
            `UPDATE reviews SET listing_id = $1, branch_id = $2
             WHERE listing_id = $3`,
            [p.keep.id, keepBranch[0].id, p.drop.id],
          );
          await client.query(
            `UPDATE opening_hours SET listing_id = $1, branch_id = $2
             WHERE listing_id = $3 AND branch_id IS NOT NULL`,
            [p.keep.id, keepBranch[0].id, p.drop.id],
          );
        }

        // Prefer keep images; if keep empty, copy from drop
        if (p.keep.images === 0 && p.drop.images > 0) {
          await client.query(
            `INSERT INTO listing_images (listing_id, url, alt_text, is_primary, display_order)
             SELECT $1, url, alt_text, is_primary, display_order
             FROM listing_images WHERE listing_id = $2`,
            [p.keep.id, p.drop.id],
          );
        }

        await client.query(
          `UPDATE listings SET status = 'archived', updated_at = now() WHERE id = $1`,
          [p.drop.id],
        );
        await client.query(
          `DELETE FROM brand_group_members WHERE listing_id = $1`,
          [p.drop.id],
        );
      }
      await client.query("COMMIT");
      console.error(`\nArchived ${allPairs.length} duplicate listings.`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
