import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";
import { SISTER_BANK_MAP, normalizeCardName } from "@/lib/mobile/deals-feed";

export type SupportedBank = {
  id: number;
  name: string;
  logoUrl: string | null;
  /** Number of distinct places with a live deal on this bank. */
  places: number;
  /** Total number of live deals on this bank. */
  dealsCount: number;
  /** Backwards compatible alias */
  offers: number;
};

/**
 * Every bank the platform supports, with how many places currently have a
 * live deal on it (active and not ended, the same rule as the listings deals
 * filter). Busiest first, then A-Z, like the app's bank index.
 */
export const getSupportedBanks = unstable_cache(
  async (): Promise<SupportedBank[]> => {
    try {
      const [{ rows: banksRows }, { rows: allCards }, { rows: dealRows }] =
        await Promise.all([
          query(
            `SELECT id, name, logo_url, code FROM banks ORDER BY name ASC`,
          ),
          query(
            `SELECT id, bank_id, card_name FROM card_variants WHERE is_active = true`,
          ),
          query(`
            SELECT d.id, d.bank_id, d.listing_id, d.valid_card_variants, d.metadata
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

      const placesByBank: Record<number, Set<number>> = {};
      const dealsByBank: Record<number, number> = {};

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

        const lid = Number(row.listing_id);
        for (const bid of matchedBankIds) {
          dealsByBank[bid] = (dealsByBank[bid] || 0) + 1;
          if (!placesByBank[bid]) placesByBank[bid] = new Set<number>();
          if (lid) placesByBank[bid].add(lid);
        }
      }

      return banksRows
        .map((b) => {
          const id = Number(b.id);
          const dealsCount = dealsByBank[id] || 0;
          const places = placesByBank[id]?.size || 0;
          return {
            id,
            name: String(b.name),
            logoUrl: (b.logo_url as string | null) || null,
            places,
            dealsCount,
            offers: places,
          };
        })
        .sort(
          (a, b) =>
            b.dealsCount - a.dealsCount ||
            b.places - a.places ||
            a.name.localeCompare(b.name),
        );
    } catch (error) {
      console.error("Supported banks query failed:", error);
      return [];
    }
  },
  ["homepage-supported-banks-v3"],
  { revalidate: 300, tags: ["deals"] },
);
