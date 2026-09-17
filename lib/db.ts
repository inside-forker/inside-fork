import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL environment variable is missing.");
}

// Clean the query parameters (e.g. sslmode=require) from connectionString to prevent pg driver
// from overriding the custom SSL configuration object below.
const cleanConnectionString = connectionString
  ? connectionString.split("?")[0]
  : undefined;

// Cache the pool on globalThis so Turbopack/webpack Fast Refresh (and warm
// serverless isolates) don't spin up a new Pool per import.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

/** True while `next build` / export is prerendering pages. */
function isProductionBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export"
  );
}

/**
 * Vercel / serverless: each concurrent function instance gets its own Pool.
 * With DO Postgres ~25 slots (a few reserved for superuser), even max:3–5
 * per instance exhausts the DB under load. Use max:1 unless overridden.
 *
 * Prefer DigitalOcean's *connection pool* URL (port 25061) over the direct
 * DB URL (25060) in Vercel env vars.
 */
function resolvePoolMax(): number {
  const fromEnv = Number(process.env.PG_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }
  if (isProductionBuildPhase()) return 1;
  // Serverless production: one connection per isolate.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return 1;
  // Default to 2 in local dev to avoid exhausting PostgreSQL max_connections (DO Postgres limit ~22).
  return 2;
}

function createPool() {
  const building = isProductionBuildPhase();
  const isProd = process.env.NODE_ENV === "production";
  const max = resolvePoolMax();

  const p = new Pool({
    connectionString: cleanConnectionString,
    ssl: connectionString?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,

    max,
    min: 0,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,

    // Release idle connections quickly so slots aren't held by warm lambdas or fast-refresh processes.
    idleTimeoutMillis: 5_000,

    // How long (ms) to wait when acquiring a connection from the pool.
    connectionTimeoutMillis: building ? 10_000 : 10_000,

    // Recycle connections after 7500 uses to prevent long-lived connection
    // memory leaks on the DO managed Postgres side.
    maxUses: 7_500,

    // Allow the process to exit even if idle clients linger (serverless).
    allowExitOnIdle: true,
  });

  p.on("error", (err) => {
    console.warn("Unexpected error on idle pg pool client:", err.message);
  });

  return p;
}

export const pool = global.__pgPool ?? createPool();
global.__pgPool = pool;

// Connection-level failures (never reached the server, so the query never
// ran) that are safe to retry once - as opposed to errors from a query that
// executed and failed, which must not be retried blindly.
const RETRYABLE_ERROR_PATTERNS = [
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
  "Connection terminated unexpectedly",
  "Connection terminated",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "socket hang up",
  "connection to server was lost",
  "Client has encountered a connection error and is not queryable",
  "remaining connection slots are reserved",
  "sorry, too many clients already",
];

const RETRYABLE_ERROR_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);

function isRetryableConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function isConnectionSaturationError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "53300") return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("too many clients") ||
    message.includes("remaining connection slots are reserved")
  );
}

export async function query<R = any>(
  text: string,
  params?: unknown[]
): Promise<import("pg").QueryResult<R extends import("pg").QueryResultRow ? R : any>> {
  try {
    const res = await pool.query(text, params);
    return res as unknown as import("pg").QueryResult<R extends import("pg").QueryResultRow ? R : any>;
  } catch (error) {
    if (isRetryableConnectionError(error)) {
      // Saturation needs a longer backoff so other lambdas can release slots.
      const delayMs = isConnectionSaturationError(error) ? 1200 : 300;
      console.warn("query connection error, retrying once", {
        text,
        delayMs,
        error,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        const res = await pool.query(text, params);
        return res as unknown as import("pg").QueryResult<R extends import("pg").QueryResultRow ? R : any>;
      } catch (retryError) {
        console.error("query error (after retry)", { text, error: retryError });
        throw retryError;
      }
    }
    console.error("query error", { text, error });
    throw error;
  }
}

