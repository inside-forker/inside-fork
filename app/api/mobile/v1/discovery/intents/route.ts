import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { listDiscoveryIntents } from "@/lib/discovery/intents";

export const dynamic = "force-dynamic";

type DiscoveryIntentDTO = {
  slug: string;
  label: string;
  subtitle: string;
  icon_name: string;
};

/**
 * GET /api/mobile/v1/discovery/intents
 *
 * The fixed, product-curated menu of discovery intents ("Date Night",
 * "Late Night", "Need Peace", ...) for an intent-picker screen - metadata
 * only, no listings. See GET /api/mobile/v1/discovery/intents/{slug} for a
 * given intent's ranked results.
 *
 * Static and DB-free (lib/discovery/intents.ts explains why intents live in
 * code rather than a table), so this endpoint has nothing to fail on.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const intents: DiscoveryIntentDTO[] = listDiscoveryIntents().map((intent) => ({
    slug: intent.slug,
    label: intent.label,
    subtitle: intent.subtitle,
    icon_name: intent.iconName,
  }));

  return ok(intents, undefined, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
});
