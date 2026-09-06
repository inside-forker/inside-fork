import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/run-migration.ts <path-to-sql-file>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const rawSql = fs.readFileSync(resolvedPath, "utf-8");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in environment.");
    process.exit(1);
  }

  const cleanConnectionString = connectionString.split("?")[0];
  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 15_000,
  });

  console.log(`Connecting to database...`);
  const client = await pool.connect();

  try {
    console.log(`Running migration: ${filePath}`);
    console.log(`Executing SQL statements in a transaction...`);
    await client.query("BEGIN");
    await client.query(rawSql);
    await client.query("COMMIT");
    console.log(`\x1b[32m✔ Migration completed successfully!\x1b[0m`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`\x1b[31m✖ Migration failed:\x1b[0m`, err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
