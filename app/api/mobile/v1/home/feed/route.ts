import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { resolveHomeFeed } from "@/lib/home-feed/resolve";
import { HOME_OPENER_MAX_SLIDES } from "@/lib/home-opener/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/home/feed
 *
 * One payload for Home's cold-mount rails: opener, event spine, open-now,
 * for-you listings, and upcoming events (this-week / free-cheap).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  try {
    const feed = await resolveHomeFeed();
    return ok(
      {
        opener: {
          source: feed.opener.source,
          fill_remaining: feed.opener.config.fill_remaining,
          max_slides: HOME_OPENER_MAX_SLIDES,
          slides: feed.opener.slides.map((s) =>
            s.kind === "event"
              ? { kind: "event" as const, event: s.event }
              : { kind: "listing" as const, listing: s.listing },
          ),
        },
        spine: feed.spine,
        open_now: feed.openNow,
        for_you: feed.forYou,
        upcoming_events: feed.upcomingEvents,
      },
      undefined,
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error(
      "[mobile-api] home/feed failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load home feed.",
      500,
    );
  }
});
