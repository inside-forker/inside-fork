# Analytics Phase 3 — Intelligence (foundation + broader, Postgres)

**In scope:** demand-gap admin product, taste-graph rollup, propensity/cross-sell scores + segments, research panel opt-in, basic creator attribution codes.

**Out of scope:** warehouse / dbt / Metabase / reverse ETL, ad targeting & measurement platform, full influencer CRM.

## Nightly order (`vercel.json`)

1. `refresh-user-scores` (21:00)
2. `refresh-intelligence` (21:10) — taste graph + propensity
3. `refresh-segments` (21:15)
4. alerts / zero-results / marketplace health (later)

## Apply migration

`sql/migrations/20260906_analytics_phase3_intelligence.sql`

## Manual refresh

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/refresh-intelligence
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/refresh-segments
```

## Surfaces

| Path | Purpose |
|------|---------|
| `/admin/demand-gap` | Unmet search demand |
| `/admin/creator-codes` | Create codes; signup counts |
| `/admin/segments` | Includes Phase 3 slugs after refresh |
| Settings `consent.researchPanelOptIn` | Research panel flag |
| Signup `creatorCode` | Attribution on mobile signup |
