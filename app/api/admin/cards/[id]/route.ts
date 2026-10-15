import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { uploadFile } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff(request);
    const { id } = await params;
    const cardId = parseInt(id, 10);

    if (Number.isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: "Invalid card ID" },
        { status: 400 },
      );
    }

    const { rows } = await query(
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
       WHERE cv.id = $1 LIMIT 1`,
      [cardId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      card: rows[0],
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminCards [id] API] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff(request);
    const { id } = await params;
    const cardId = parseInt(id, 10);

    if (Number.isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: "Invalid card ID" },
        { status: 400 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let updateFields: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.has("card_name")) updateFields.card_name = String(formData.get("card_name")).trim();
      if (formData.has("card_type")) updateFields.card_type = String(formData.get("card_type")).trim();
      if (formData.has("card_network")) updateFields.card_network = String(formData.get("card_network")).trim();
      if (formData.has("card_tier")) updateFields.card_tier = String(formData.get("card_tier")).trim() || null;
      if (formData.has("bank_id")) updateFields.bank_id = parseInt(String(formData.get("bank_id")), 10);
      if (formData.has("is_active")) updateFields.is_active = formData.get("is_active") === "true";
      if (formData.has("image_url")) updateFields.image_filename = String(formData.get("image_url")).trim();

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json(
            { success: false, error: "Uploaded file must be an image" },
            { status: 400 },
          );
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const namePart = (updateFields.card_name as string) || "card";
        const safeSlug = namePart
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const objectKey = `card-images/${cardId}-${safeSlug}-${Date.now()}.${ext}`;

        const uploadResult = await uploadFile(objectKey, buffer, {
          contentType: file.type,
          isPublic: true,
        });
        updateFields.image_filename = uploadResult.publicUrl;
      }
    } else {
      updateFields = await request.json();
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let pIdx = 1;

    const allowedCols = ["card_name", "card_type", "card_network", "card_tier", "bank_id", "is_active", "image_filename"];
    for (const col of allowedCols) {
      if (col in updateFields) {
        updates.push(`${col} = $${pIdx++}`);
        values.push(updateFields[col]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 },
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(cardId);

    const { rows } = await query(
      `UPDATE card_variants
       SET ${updates.join(", ")}
       WHERE id = $${pIdx}
       RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      card: rows[0],
      message: "Card updated successfully",
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminCards [id] API] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff(request);
    const { id } = await params;
    const cardId = parseInt(id, 10);

    if (Number.isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: "Invalid card ID" },
        { status: 400 },
      );
    }

    // Soft-deactivate by default so existing deals with this card still preserve history
    const { rows } = await query(
      `UPDATE card_variants SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [cardId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Card deactivated successfully",
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminCards [id] API] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
