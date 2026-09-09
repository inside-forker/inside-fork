import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/cards?bankId=
 *
 * Active card products for one bank - the second step of Add Card (bank,
 * then card). Mirrors `app/api/cards`; `card_variants` is anon-readable by
 * RLS (public reference data, same as `banks`).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { searchParams } = new URL(request.url);
  const bankId = parsePathId(searchParams.get("bankId") ?? undefined, "bankId");

  let rows;
  try {
    const result = await query(
      `SELECT
         b.name AS bank_name,
         c.id,
         c.card_name,
         c.card_type,
         c.card_network,
         c.card_tier,
         c.image_filename
       FROM banks b
       LEFT JOIN card_variants c ON c.bank_id = b.id AND c.is_active = true
       WHERE b.id = $1
       ORDER BY c.card_tier ASC, c.card_name ASC`,
      [bankId],
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] cards query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load cards.", 500);
  }

  if (rows.length === 0) {
    throw new MobileApiError("not_found", "Bank not found.", 404, "bankId");
  }

  const bankName = rows[0].bank_name as string;
  const cards = rows
    .filter((r) => r.id !== null)
    .map((c) => ({
      id: Number(c.id),
      bankId,
      bankName,
      cardName: c.card_name,
      cardType: c.card_type,
      cardNetwork: c.card_network,
      cardTier: c.card_tier,
      imageFilename: c.image_filename,
    }));

  return ok(cards, undefined, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
});
