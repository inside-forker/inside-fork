import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const CARD_SELECT = `
  SELECT uc.id, uc.card_variant_id, uc.nickname, uc.is_primary, uc.created_at,
         cv.card_name, cv.card_type, cv.card_network, cv.card_tier, cv.image_filename,
         b.id AS bank_id, b.name AS bank_name, b.logo_url AS bank_logo_url
  FROM user_cards uc
  JOIN card_variants cv ON cv.id = uc.card_variant_id
  JOIN banks b ON b.id = cv.bank_id
`;

function toCard(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    cardVariantId: Number(row.card_variant_id),
    nickname: row.nickname as string | null,
    isPrimary: row.is_primary as boolean,
    createdAt: row.created_at,
    bankId: Number(row.bank_id),
    bankName: row.bank_name as string,
    bankLogoUrl: row.bank_logo_url as string | null,
    cardName: row.card_name as string,
    cardType: row.card_type as string | null,
    cardNetwork: row.card_network as string | null,
    cardTier: row.card_tier as string | null,
    imageFilename: row.image_filename as string | null,
  };
}

/**
 * GET /api/mobile/v1/user-cards
 *
 * The caller's saved cards for Deals & Discounts personalization ("My
 * Cards"), each enriched with its bank + card_variants details so the app
 * never has to join client-side.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const { rows } = await query(
    `${CARD_SELECT} WHERE uc.user_id = $1 ORDER BY uc.created_at ASC`,
    [user.id],
  );

  return ok(rows.map(toCard));
});

const addCardSchema = z.object({
  cardVariantId: z.number().int().positive(),
  nickname: z.string().trim().max(30).optional(),
});

/**
 * POST /api/mobile/v1/user-cards
 *
 * Save a card. The first card a user saves becomes primary automatically -
 * nothing would ever be primary otherwise unless they thought to set one.
 * Never accepts anything but a `card_variant_id` reference + a label:
 * no payment fields exist on this table to even send.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = addCardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A positive integer cardVariantId is required.",
      400,
      "cardVariantId",
    );
  }
  const { cardVariantId, nickname } = parsed.data;

  const { rows: cardRows } = await query(
    `SELECT id FROM card_variants WHERE id = $1 AND is_active = true LIMIT 1`,
    [cardVariantId],
  );
  if (!cardRows[0]) {
    throw new MobileApiError(
      "not_found",
      "Card not found.",
      404,
      "cardVariantId",
    );
  }

  const { rows: existing } = await query(
    `SELECT id FROM user_cards WHERE user_id = $1 AND card_variant_id = $2 LIMIT 1`,
    [user.id, cardVariantId],
  );
  if (existing[0]) {
    throw new MobileApiError(
      "conflict",
      "You've already saved this card.",
      409,
      "cardVariantId",
    );
  }

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS n FROM user_cards WHERE user_id = $1`,
    [user.id],
  );
  const isFirstCard = (countRows[0]?.n ?? 0) === 0;

  let insertedId: number;
  try {
    const { rows } = await query(
      `INSERT INTO user_cards (user_id, card_variant_id, nickname, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, cardVariantId, nickname?.trim() || null, isFirstCard],
    );
    insertedId = Number(rows[0].id);
  } catch (error) {
    console.error("[mobile-api] user_cards insert failed:", error);
    throw new MobileApiError("internal_error", "Failed to save card.", 500);
  }

  const { rows: full } = await query(`${CARD_SELECT} WHERE uc.id = $1`, [insertedId]);
  return ok(toCard(full[0]), undefined, { status: 201 });
});
