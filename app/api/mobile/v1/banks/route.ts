import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { SISTER_BANK_MAP, normalizeCardName } from "@/lib/mobile/deals-feed";

export const dynamic = "force-dynamic";

let cachedBanks: Array<{
  value: string;
  label: string;
  code: string | null;
  logoUrl: string | null;
  dealCount: number;
}> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/mobile/v1/banks
 *
 * Bank reference data with live deal counts for deal/bank pickers.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  if (cachedBanks && Date.now() - cachedAt < CACHE_TTL_MS) {
    return ok(cachedBanks, undefined, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  try {
    const [{ rows: banksRows }, { rows: allCards }, { rows: dealRows }] =
      await Promise.all([
        query(`SELECT id, name, logo_url, code FROM banks ORDER BY name ASC`),
        query(
          `SELECT id, bank_id, card_name FROM card_variants WHERE is_active = true`,
        ),
        query(`
          SELECT d.id, d.bank_id, d.valid_card_variants, d.metadata
          FROM deals d
          INNER JOIN listings l ON l.id = d.listing_id
          WHERE d.is_active = true
            AND l.status = 'published'
            AND (d.start_date IS NULL OR d.start_date <= NOW())
            AND (d.end_date IS NULL OR d.end_date >= NOW())
        `),
      ]);

    const cardById = new Map<
      number,
      { id: number; bankId: number; label: string }
    >();
    const cardsByBankName = new Map<
      string,
      { id: number; bankId: number; label: string }
    >();

    for (const c of allCards) {
      const id = Number(c.id);
      const lookup = {
        id,
        bankId: Number(c.bank_id),
        label: String(c.card_name || "Card"),
      };
      cardById.set(id, lookup);
      cardsByBankName.set(
        `${lookup.bankId}::${normalizeCardName(lookup.label)}`,
        lookup,
      );
    }

    const countsByBank: Record<number, number> = {};

    for (const row of dealRows) {
      const bankId = row.bank_id != null ? Number(row.bank_id) : null;
      const variantIds = Array.isArray(row.valid_card_variants)
        ? row.valid_card_variants.map(Number)
        : [];
      const metadata = row.metadata as Record<string, unknown> | null;
      const associations = (
        Array.isArray(metadata?.card_associations)
          ? metadata.card_associations
          : []
      ).filter(Boolean) as Array<{ name?: string }>;
      const candidateBankIds = [
        bankId,
        ...(bankId ? SISTER_BANK_MAP[bankId] || [] : []),
      ].filter((id): id is number => id !== null && Number.isFinite(id));

      const matches: Array<{ id: number; bankId: number; label: string }> = [];
      const seen = new Set<number>();
      const push = (cv: { id: number; bankId: number; label: string }) => {
        if (seen.has(cv.id)) return;
        seen.add(cv.id);
        matches.push(cv);
      };

      for (const vid of variantIds) {
        const cv = cardById.get(vid);
        if (cv) push(cv);
      }

      for (const bid of candidateBankIds) {
        for (const assoc of associations) {
          if (!assoc?.name) continue;
          const norm = normalizeCardName(assoc.name);
          const cv = cardsByBankName.get(`${bid}::${norm}`);
          if (cv) push(cv);
        }
      }

      const matchedBankIds = new Set<number>();
      if (bankId) matchedBankIds.add(bankId);
      for (const m of matches) {
        matchedBankIds.add(m.bankId);
      }

      for (const bid of matchedBankIds) {
        countsByBank[bid] = (countsByBank[bid] || 0) + 1;
      }
    }

    const banks = banksRows.map((b) => ({
      value: String(b.id),
      label: b.name,
      code: b.code,
      logoUrl: b.logo_url,
      dealCount: countsByBank[Number(b.id)] || 0,
    }));

    cachedBanks = banks;
    cachedAt = Date.now();

    return ok(banks, undefined, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error(
      "[mobile-api] banks query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load banks.", 500);
  }
});

