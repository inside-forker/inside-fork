import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { uploadFile } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bankId") || searchParams.get("bank_id");
    const search = searchParams.get("search") || searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (bankId) {
      conditions.push(`cv.bank_id = $${paramIndex++}`);
      values.push(parseInt(bankId, 10));
    }

    if (search && search.trim()) {
      conditions.push(`(cv.card_name ILIKE $${paramIndex} OR cv.card_network ILIKE $${paramIndex} OR cv.card_type ILIKE $${paramIndex} OR cv.card_tier ILIKE $${paramIndex})`);
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM card_variants cv ${whereClause}`,
      values,
    );
    const total = countResult.rows[0]?.total || 0;

    const cardsResult = await query(
      `SELECT 
         cv.id,
         cv.bank_id,
         cv.card_name,
         cv.card_type,
         cv.card_network,
         cv.card_tier,
         cv.image_filename,
         cv.is_active,
         cv.created_at,
         cv.updated_at,
         b.name as bank_name,
         b.code as bank_code,
         b.logo_url as bank_logo_url
       FROM card_variants cv
       LEFT JOIN banks b ON cv.bank_id = b.id
       ${whereClause}
       ORDER BY b.name ASC, cv.card_name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset],
    );

    return NextResponse.json({
      success: true,
      cards: cardsResult.rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminCards API] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request);

    let bankId: number;
    let cardName: string;
    let cardType: string;
    let cardNetwork: string;
    let cardTier: string | null = null;
    let imageUrl: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawBankId = formData.get("bank_id");
      const rawCardName = formData.get("card_name");
      const rawCardType = formData.get("card_type");
      const rawCardNetwork = formData.get("card_network");
      const rawCardTier = formData.get("card_tier");
      const rawImageUrl = formData.get("image_url");
      const file = formData.get("file") as File | null;

      if (!rawBankId || !rawCardName || !rawCardType || !rawCardNetwork) {
        return NextResponse.json(
          { success: false, error: "Bank, Card Name, Card Type, and Network are required" },
          { status: 400 },
        );
      }

      bankId = parseInt(String(rawBankId), 10);
      cardName = String(rawCardName).trim();
      cardType = String(rawCardType).trim();
      cardNetwork = String(rawCardNetwork).trim();
      if (rawCardTier && String(rawCardTier).trim()) {
        cardTier = String(rawCardTier).trim();
      }
      if (rawImageUrl && String(rawImageUrl).trim()) {
        imageUrl = String(rawImageUrl).trim();
      }

      // If an image file was uploaded
      if (file && file.size > 0) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json(
            { success: false, error: "Uploaded file must be an image" },
            { status: 400 },
          );
        }

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: "Image file size exceeds 10MB limit" },
            { status: 400 },
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const safeSlug = cardName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const objectKey = `card-images/${bankId}-${safeSlug}-${Date.now()}.${ext}`;

        const uploadResult = await uploadFile(objectKey, buffer, {
          contentType: file.type,
          isPublic: true,
        });

        imageUrl = uploadResult.publicUrl;
      }
    } else {
      const body = await request.json();
      if (!body.bank_id || !body.card_name || !body.card_type || !body.card_network) {
        return NextResponse.json(
          { success: false, error: "Bank, Card Name, Card Type, and Network are required" },
          { status: 400 },
        );
      }

      bankId = parseInt(String(body.bank_id), 10);
      cardName = String(body.card_name).trim();
      cardType = String(body.card_type).trim();
      cardNetwork = String(body.card_network).trim();
      cardTier = body.card_tier ? String(body.card_tier).trim() : null;
      imageUrl = body.image_url || body.image_filename || null;
    }

    if (Number.isNaN(bankId)) {
      return NextResponse.json(
        { success: false, error: "Invalid bank ID" },
        { status: 400 },
      );
    }

    // Verify bank exists
    const { rows: bankRows } = await query(
      `SELECT id, name, code, logo_url FROM banks WHERE id = $1 LIMIT 1`,
      [bankId],
    );
    const bank = bankRows[0];
    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Selected bank does not exist" },
        { status: 404 },
      );
    }

    // Insert card variant
    const insertResult = await query(
      `INSERT INTO card_variants (
         bank_id,
         card_name,
         card_type,
         card_network,
         card_tier,
         image_filename,
         is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, bank_id, card_name, card_type, card_network, card_tier, image_filename, is_active, created_at, updated_at`,
      [bankId, cardName, cardType, cardNetwork, cardTier, imageUrl],
    );

    const newCard = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      card: {
        ...newCard,
        bank_name: bank.name,
        bank_code: bank.code,
        bank_logo_url: bank.logo_url,
      },
      message: `Card "${cardName}" created successfully`,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminCards API] POST error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
