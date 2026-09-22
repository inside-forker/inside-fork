# Scraper Worker

Listing scraper HTTP service (Peekaboo sync). Runs separately from the Next.js app (e.g. Vercel); the admin UI calls it via `SCRAPER_WORKER_URL`.

Uses shared code under repo root (`lib/`, `scrapers/`, …) via the `@/*` alias. Dependencies are installed from the **monorepo root** (`package-lock.json` at repo root).

**Default sync mode is `report`**: compares Peekaboo vs Inside with no database writes. Use `create_missing` to add draft listings for venues you lack, `deals_only` for discounts, and `full` for metadata upserts. Interval automation defaults to `report`.

---

## Local run

From the repository root:

```bash
npm ci
npm run scraper:worker
```

Optional: copy env into `.env.local` at the **repo root** (the worker loads that path).

---

## Hostinger VPS (production)

The live worker runs on Hostinger under PM2 (hostname historically `srv1915006`). Confirm the current IP in Hostinger hPanel → VPS → SSH Access.

```bash
ssh root@<VPS_IP>
cd /opt/scraper-worker
pm2 status
curl -s http://localhost:8787/live
```

### Deploy code updates (required before running sync after scraper changes)

```bash
cd /opt/scraper-worker
git pull
npm ci
# only if Playwright deps changed:
# npx playwright install chromium
pm2 restart scraper-worker
pm2 logs scraper-worker --lines 50
```

Env lives at `/opt/scraper-worker/.env.local`. Vercel should set `SCRAPER_WORKER_URL=http://<VPS_IP>:8787` and the same `SCRAPER_WORKER_SECRET` as on the VPS.

**Do not start an admin sync until this box has pulled the latest code** — the Vercel UI alone cannot protect you if the worker is still on old sync logic.

---

## Render

Use a **Web Service** (long-lived HTTP process), not a Background Worker or Cron job.

### Root directory: use the **repository root** (empty field)

Per [Render monorepo docs](https://render.com/docs/monorepo-support), if you set **Root Directory** to a subfolder, **files outside that folder are not available at build or runtime**. This worker imports `lib/`, `scrapers/`, `types/` at the repo root, so the Root Directory field must stay **empty** (defaults to repo root). Do **not** set Root Directory to `apps/scraper-worker` — the deploy context would not include shared modules and the build would fail.

The dashboard may **show** a line like `apps/scraper-worker/ $` next to the command box when a root directory is set; that is Render indicating the **current working directory**, not text you type.

### Build & start (repository root as cwd)

| Setting | Value |
|--------|--------|
| **Root Directory** | *(leave empty)* |
| **Build Command** | `npm ci && npx playwright install chromium` |
| **Start Command** | `npm run scraper:worker` |
| **Health Check Path** | `/live` |
| **Pre-Deploy Command** | *(leave empty)* |

The npm script is **`scraper:worker`** (with a **colon**): `npm run scraper:worker`. **`npm run scraper-worker` is invalid.**

### Limit autodeploy noise (optional)

With Root Directory at repo root, every push can trigger a deploy. To redeploy the worker only when relevant paths change, use **Build Filters** (repo-root paths; see the same doc). Example **included** paths to cover this service (adjust if you add shared packages):

- `apps/scraper-worker/**`
- `lib/**`
- `scrapers/**`
- `types/**`
- `package.json`
- `package-lock.json`
- `tsconfig.json`

If you use **included** paths, only changes under those globs trigger deploys; tune the list as the repo grows.

### PORT

Do **not** set `PORT` in the Render dashboard unless you have a specific reason. Render injects `PORT`; the worker reads `process.env.PORT` (see `src/index.ts`). A manual `PORT` can conflict with routing.

### Instance size

Playwright and full syncs need RAM and a non-spinning tier. **Starter or higher** is safer than Free for production syncs.

---

## Required environment variables

Set these on the Render service (and mirror secrets on Vercel for the main app where noted).

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-side DB/storage) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |
| `SCRAPER_WORKER_SECRET` | Shared secret; sent as `x-worker-secret` from Next.js **and** required for `/health`, `/sync/*` when set |
| `PEEKABOO_AUTH_TOKEN` | Optional fallback; primary token is `system_config` in DB |

On **Vercel** (Next.js): `SCRAPER_WORKER_URL` = Render service URL (no trailing slash), `SCRAPER_WORKER_SECRET` = same value as on Render.

---

## Optional tuning

| Variable | Default | Purpose |
|----------|---------|---------|
| `SCRAPER_LOCK_LEASE_MS` | 600000 | Redis sync lock TTL (ms) |
| `SCRAPER_LOCK_HEARTBEAT_MS` | 30000 | Lock renewal interval (ms) |
| `SCRAPER_ALERT_WEBHOOK_URL` | — | POST JSON on sync failure / stale data |
| `SCRAPER_ALERT_COOLDOWN_SECONDS` | 3600 | Min seconds between similar alerts |
| `SCRAPER_STALE_HOURS_ALERT` | — | Alert if last completed sync older than N hours |
| `SCRAPER_EXIT_ON_UNHANDLED_REJECTION` | `false` | If `true`, process exits after Sentry flush on an unhandled promise rejection (default keeps the worker running for 24/7; errors are still logged to stdout and Sentry) |

---

## HTTP routes

| Method | Path | Auth |
|--------|------|------|
| GET | `/live` | None — use for Render health checks |
| GET | `/health` | `x-worker-secret` if `SCRAPER_WORKER_SECRET` is set |
| GET | `/sync/status` | Secret when configured |
| POST | `/sync/start` | Secret when configured |
| POST | `/sync/stop` | Secret when configured |
