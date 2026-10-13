/**
 * Propose / apply brand groups from published "Brand - Location" listings
 * and multi-branch parents that already have Parent - % siblings.
 *
 * Usage:
 *   npx tsx scripts/brand-groups-stem-import.ts            # dry-run CSV to stdout
 *   npx tsx scripts/brand-groups-stem-import.ts --apply    # write brand_groups
 *
 * Skips short/ambiguous stems (< 3 chars) and stems on a denylist.
 */
import "dotenv/config";
import { Pool } from "pg";
import { brandStemFromListingName } from "../lib/listings/borrowed-header-image";

const APPLY = process.argv.includes("--apply");

/** Stems that collide across unrelated businesses when matched naively. */
const STEM_DENYLIST = new Set(
  [
    "od",
    "tao",
    "pita",
    "froth",
    "happy",
    "sakura",
    "function",
    "agha",
  ].map((s) => s.toLowerCase()),
);

function cleanDbUrl(raw: string): string {
  return raw.split("?")[0];
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type ListingRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cleanDbUrl(connectionString),
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const client = await pool.connect();
  try {
    const { rows: published } = await client.query<ListingRow>(
      `SELECT id, name, slug, status
       FROM listings
       WHERE status = 'published' AND name IS NOT NULL AND trim(name) <> ''`,
    );

    // Group by stem; only keep groups with 2+ members where at least one
    // name uses " - " (location-style) OR the exact stem is a multi-branch parent.
    const byStem = new Map<string, { label: string; members: ListingRow[] }>();
    for (const row of published) {
      const stem = brandStemFromListingName(row.name);
      if (!stem) continue;
      const key = stem.toLowerCase();
      const entry = byStem.get(key);
      if (entry) entry.members.push(row);
      else byStem.set(key, { label: stem, members: [row] });
    }

    const { rows: multiParents } = await client.query<{
      id: number;
      name: string;
      branch_count: number;
    }>(
      `SELECT l.id, l.name, COUNT(lb.id)::int AS branch_count
       FROM listings l
       JOIN listing_branches lb ON lb.listing_id = l.id
       WHERE l.status = 'published'
       GROUP BY l.id
       HAVING COUNT(lb.id) > 1`,
    );
    const multiByName = new Map(
      multiParents.map((m) => [m.name.trim().toLowerCase(), m]),
    );

    type Proposal = {
      stem: string;
      slug: string;
      listing_ids: number[];
      names: string[];
      skip_reason: string | null;
    };

    const proposals: Proposal[] = [];

    for (const [key, { label, members }] of byStem) {
      if (members.length < 2) continue;

      const hasDashSibling = members.some((m) => m.name.includes(" - "));
      const isMultiParent = multiByName.has(key);
      if (!hasDashSibling && !isMultiParent) continue;

      let skip: string | null = null;
      if (label.trim().length < 3) skip = "stem_too_short";
      else if (STEM_DENYLIST.has(key)) skip = "denylist";

      proposals.push({
        stem: label,
        slug: slugify(label),
        listing_ids: members.map((m) => m.id),
        names: members.map((m) => m.name),
        skip_reason: skip,
      });
    }

    proposals.sort((a, b) => b.listing_ids.length - a.listing_ids.length);

    const accepted = proposals.filter((p) => !p.skip_reason);
    const skipped = proposals.filter((p) => p.skip_reason);

    console.log(
      `# brand-groups stem import (${APPLY ? "APPLY" : "dry-run"})`,
    );
    console.log(
      `# accepted=${accepted.length} skipped=${skipped.length} listings_touched=${accepted.reduce((n, p) => n + p.listing_ids.length, 0)}`,
    );
    console.log("stem,slug,member_count,names,skip_reason");
    for (const p of proposals) {
      const names = p.names.map((n) => n.replace(/,/g, ";")).join(" | ");
      console.log(
        `${JSON.stringify(p.stem)},${p.slug},${p.listing_ids.length},${JSON.stringify(names)},${p.skip_reason ?? ""}`,
      );
    }

    if (!APPLY) {
      console.error("\nDry-run only. Re-run with --apply to write groups.");
      return;
    }

    let groupsCreated = 0;
    let membersUpserted = 0;

    await client.query("BEGIN");
    try {
      for (const p of accepted) {
        const { rows: gRows } = await client.query<{ id: number }>(
          `INSERT INTO brand_groups (name, slug)
           VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE
             SET name = EXCLUDED.name, updated_at = now()
           RETURNING id`,
          [p.stem, p.slug],
        );
        const groupId = Number(gRows[0].id);
        groupsCreated += 1;

        let sort = 0;
        for (const listingId of p.listing_ids) {
          await client.query(
            `DELETE FROM brand_group_members WHERE listing_id = $1`,
            [listingId],
          );
          await client.query(
            `INSERT INTO brand_group_members (group_id, listing_id, sort_order, source)
             VALUES ($1, $2, $3, 'stem_import')`,
            [groupId, listingId, sort++],
          );
          membersUpserted += 1;
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    console.error(
      `\nApplied: groups=${groupsCreated} members=${membersUpserted}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
