import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { resolveHomeOpenerSlides } from "@/lib/home-opener/resolve";
import { HOME_OPENER_MAX_SLIDES } from "@/lib/home-opener/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/home/opener
 *
 * Ordered slides for the Home hero. Uses admin-curated picks when configured,
 * otherwise (or to fill remaining slots) the auto featured-event + trending
 * listings algorithm.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  try {
    const { source, slides, config } = await resolveHomeOpenerSlides();
    return ok({
      source,
      fill_remaining: config.fill_remaining,
      max_slides: HOME_OPENER_MAX_SLIDES,
      slides: slides.map((s) =>
        s.kind === "event"
          ? { kind: "event" as const, event: s.event }
          : { kind: "listing" as const, listing: s.listing },
      ),
    });
  } catch (error) {
    console.error(
      "[mobile-api] home/opener failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load home opener.",
      500,
    );
  }
});
