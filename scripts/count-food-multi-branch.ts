/** Print count of published food listings with 2+ nested branches. */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function main() {
  const url = loadDatabaseUrl();
  const c = new Client({
    connectionString: url.split("?")[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await c.connect();
  try {
    const { rows } = await c.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT l.id FROM listings l
         JOIN listing_branches lb ON lb.listing_id = l.id
         LEFT JOIN categories c ON c.id = l.category_id
         WHERE l.status = 'published'
           AND COALESCE(c.name, '') ~* '(Restaurant|Fast Food|Baker|Beverag|Dessert|Coffee|Icecream|Pakistani|Chinese|Pizza|Juice)'
         GROUP BY l.id
         HAVING COUNT(lb.id) > 1
       ) t`,
    );
    console.log(rows[0].n);
  } finally {
    await c.end().catch(() => {});
  }
}

main().catch(() => {
  console.log("?");
  process.exit(0);
});
