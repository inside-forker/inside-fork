import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bankId");

    if (!bankId) {
      return NextResponse.json(
        { error: "bankId parameter is required" },
        { status: 400 },
      );
    }

    const bankIdNum = parseInt(bankId, 10);
    const { rows: bankRows } = await query(
      !Number.isNaN(bankIdNum)
        ? `SELECT id, code FROM banks WHERE id = $1 LIMIT 1`
        : `SELECT id, code FROM banks WHERE code = $1 LIMIT 1`,
      [Number.isNaN(bankIdNum) ? bankId : bankIdNum],
    );

    const bank = bankRows[0];
    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 400 });
    }

    const bankCode = (bank.code as string | null) || `bank-${bank.id}`;

    const { rows: cards } = await query(
      `SELECT id, card_name, card_type, card_network, card_tier, image_filename
       FROM card_variants
       WHERE bank_id = $1 AND is_active = true
       ORDER BY card_tier ASC, card_name ASC`,
      [bank.id],
    );

    const cardData = cards.map((card) => ({
      value: String(card.id),
      label: card.card_name as string,
      id: card.id,
      card_name: card.card_name,
      card_type: card.card_type,
      card_network: card.card_network,
      card_tier: card.card_tier,
      image_filename: card.image_filename,
    }));

    return NextResponse.json({
      success: true,
      cards: cardData,
      count: cardData.length,
      bankCode,
    });
  } catch (error) {
    console.error("API error fetching cards:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
