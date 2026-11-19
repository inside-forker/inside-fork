import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { uploadFile, BANKS_PREFIX } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || searchParams.get("q");

    let sql = `
      SELECT id, name, code, logo_url, is_active, display_order, created_at
      FROM banks
    `;
    const params: unknown[] = [];

    if (search && search.trim()) {
      sql += ` WHERE name ILIKE $1 OR code ILIKE $1`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY name ASC`;

    const { rows: banks } = await query(sql, params);

    return NextResponse.json({
      success: true,
      banks: banks.map((b) => ({
        id: Number(b.id),
        name: b.name as string,
        code: b.code as string | null,
        logo_url: b.logo_url as string | null,
        is_active: Boolean(b.is_active),
        display_order: Number(b.display_order || 0),
        created_at: b.created_at,
      })),
      count: banks.length,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminBanks API] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request);

    let name = "";
    let code: string | null = null;
    let logoUrl: string | null = null;
    let isActive = true;
    let displayOrder = 0;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawName = formData.get("name");
      const rawCode = formData.get("code");
      const rawLogoUrl = formData.get("logo_url");
      const rawIsActive = formData.get("is_active");
      const rawDisplayOrder = formData.get("display_order");
      const file = formData.get("logo") as File | null;

      if (!rawName || !String(rawName).trim()) {
        return NextResponse.json(
          { success: false, error: "Bank / Wallet name is required" },
          { status: 400 },
        );
      }

      name = String(rawName).trim();
      if (rawCode && String(rawCode).trim()) {
        code = String(rawCode).trim().toUpperCase();
      }
      if (rawLogoUrl && String(rawLogoUrl).trim()) {
        logoUrl = String(rawLogoUrl).trim();
      }
      if (rawIsActive !== null && rawIsActive !== undefined) {
        isActive = String(rawIsActive) !== "false";
      }
      if (rawDisplayOrder) {
        displayOrder = parseInt(String(rawDisplayOrder), 10) || 0;
      }

      // Handle logo image file upload if provided
      if (file && file.size > 0) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json(
            { success: false, error: "Uploaded file must be an image" },
            { status: 400 },
          );
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: "Image file size exceeds 5MB limit" },
            { status: 400 },
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const safeSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const objectKey = `${BANKS_PREFIX}/${safeSlug}-${Date.now()}.${ext}`;

        const uploadResult = await uploadFile(objectKey, buffer, {
          contentType: file.type,
          isPublic: true,
        });

        logoUrl = uploadResult.publicUrl;
      }
    } else {
      const body = await request.json();
      if (!body.name || !String(body.name).trim()) {
        return NextResponse.json(
          { success: false, error: "Bank / Wallet name is required" },
          { status: 400 },
        );
      }

      name = String(body.name).trim();
      if (body.code && String(body.code).trim()) {
        code = String(body.code).trim().toUpperCase();
      }
      if (body.logo_url && String(body.logo_url).trim()) {
        logoUrl = String(body.logo_url).trim();
      }
      if (body.is_active !== undefined) {
        isActive = Boolean(body.is_active);
      }
      if (body.display_order !== undefined) {
        displayOrder = Number(body.display_order) || 0;
      }
    }

    // Auto-generate code if empty
    if (!code) {
      code = name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 10);
      if (!code) {
        code = name.toUpperCase().slice(0, 6);
      }
    }

    // Check for duplicate name
    const existing = await query(
      `SELECT id, name FROM banks WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name],
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `A bank or wallet named "${existing.rows[0].name}" already exists.`,
          bank: existing.rows[0],
        },
        { status: 409 },
      );
    }

    // Safeguard: Ensure sequence is at max(id)
    await query(`
      SELECT setval('public.banks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM banks))
    `);

    // Insert new bank
    const insertResult = await query(
      `INSERT INTO banks (name, code, logo_url, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, code, logo_url, is_active, display_order, created_at`,
      [name, code, logoUrl, isActive, displayOrder],
    );

    const newBank = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      bank: {
        id: Number(newBank.id),
        name: newBank.name,
        code: newBank.code,
        logo_url: newBank.logo_url,
        is_active: Boolean(newBank.is_active),
        display_order: Number(newBank.display_order || 0),
        created_at: newBank.created_at,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[AdminBanks API] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

