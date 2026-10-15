import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Public, read-only lookup of active card variants for a bank, optionally
// narrowed to a specific deal's associated cards. Backs the client-side
// BankCardShowcase component.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankIdParam = searchParams.get("bankId");
    const bankName = searchParams.get("bankName");
    const dealIdParam = searchParams.get("dealId");
    const maxCardsParam = searchParams.get("maxCards");
    const maxCards = Math.min(
      100,
      Math.max(1, parseInt(maxCardsParam || "50", 10) || 50),
    );

    let bankId: number | null = bankIdParam ? parseInt(bankIdParam, 10) : null;
    if (bankId !== null && Number.isNaN(bankId)) bankId = null;

    let targetCardIds: number[] = [];
    let targetCardNames: string[] = [];

    const dealId = dealIdParam ? parseInt(dealIdParam, 10) : null;
    if (dealId !== null && !Number.isNaN(dealId)) {
      const { rows: dealRows } = await query(
        `SELECT valid_card_variants, metadata, bank_id FROM deals WHERE id = $1 LIMIT 1`,
        [dealId],
      );
      const deal = dealRows[0];
      if (deal) {
        if (bankId === null && deal.bank_id) {
          bankId = Number(deal.bank_id);
        }

        if (
          Array.isArray(deal.valid_card_variants) &&
          deal.valid_card_variants.length > 0
        ) {
          targetCardIds = deal.valid_card_variants.map((id: unknown) =>
            Number(id),
          );
        }

        const metadata = deal.metadata as Record<string, unknown> | null;
        if (
          metadata &&
          Array.isArray(metadata.card_associations) &&
          metadata.card_associations.length > 0
        ) {
          targetCardNames = (
            metadata.card_associations as { name: string }[]
          )
            .map((c) => c.name)
            .filter((name) => typeof name === "string" && name.trim().length > 0);
        }
      }
    }

    // If no bankId provided, try to resolve it by name.
    if (bankId === null && bankName) {
      const { rows: bankRows } = await query(
        `SELECT id FROM banks WHERE name = $1 LIMIT 1`,
        [bankName],
      );
      if (bankRows[0]) bankId = Number(bankRows[0].id);
    }

    let finalRows: Array<Record<string, unknown>> = [];

    // Deal specific cards resolution:
    // Match by ID (for local IDs) OR by card_name (for deals imported with Peekaboo metadata)
    if (targetCardIds.length > 0 || targetCardNames.length > 0) {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (targetCardIds.length > 0) {
        params.push(targetCardIds);
        let idCond = `id = ANY($${params.length})`;
        if (bankId !== null) {
          params.push(bankId);
          idCond += ` AND bank_id = $${params.length}`;
        }
        conditions.push(`(${idCond})`);
      }

      if (targetCardNames.length > 0 && bankId !== null) {
        params.push(bankId);
        const bIdx = params.length;
        params.push(targetCardNames);
        const nIdx = params.length;
        conditions.push(`(bank_id = $${bIdx} AND card_name = ANY($${nIdx}))`);
      }

      if (conditions.length > 0) {
        params.push(maxCards);
        const sql = `
          SELECT *
          FROM card_variants
          WHERE is_active = true AND (${conditions.join(" OR ")})
          ORDER BY card_tier ASC, card_name ASC
          LIMIT $${params.length}
        `;
        const { rows } = await query(sql, params);
        if (rows.length > 0) finalRows = rows;
      }
    }

    // Fallback: If no cards matched a specific deal, but bank is known, load bank's active cards
    if (finalRows.length === 0 && bankId !== null && !dealId) {
      const { rows } = await query(
        `SELECT * FROM card_variants
         WHERE is_active = true AND bank_id = $1
         ORDER BY card_tier ASC, card_name ASC
         LIMIT $2`,
        [bankId, maxCards],
      );
      finalRows = rows;
    }

    const cards = finalRows.map((row) => ({
      ...row,
      id: Number(row.id),
      bank_id: row.bank_id !== null ? Number(row.bank_id) : null,
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Bank cards API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
