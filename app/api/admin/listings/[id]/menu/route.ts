import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Get menu sections with items
    let menuSections;
    try {
      const { rows: sections } = await query(
        `SELECT * FROM menu_sections WHERE listing_id = $1 ORDER BY display_order ASC`,
        [listingId],
      );

      const sectionIds = sections.map((s) => s.id);
      const { rows: items } =
        sectionIds.length > 0
          ? await query(
              `SELECT id, section_id, name, description, price, is_available, is_featured, display_order, image_url, image_alt
               FROM menu_items WHERE section_id = ANY($1::int[]) ORDER BY display_order ASC`,
              [sectionIds],
            )
          : { rows: [] };

      const itemsBySectionId = new Map<number, typeof items>();
      for (const item of items) {
        const existing = itemsBySectionId.get(item.section_id) || [];
        existing.push(item);
        itemsBySectionId.set(item.section_id, existing);
      }

      menuSections = sections.map((section) => ({
        ...section,
        menu_items: itemsBySectionId.get(section.id) || [],
      }));
    } catch (error) {
      console.error("Error fetching menu:", error);
      return NextResponse.json(
        { error: "Failed to fetch menu" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menuSections || [],
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();
    const { name, description, display_order = 0 } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Section name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate section name in the same listing
    let existingSection;
    try {
      const { rows } = await query(
        `SELECT id FROM menu_sections WHERE listing_id = $1 AND name = $2`,
        [listingId, name.trim()],
      );
      existingSection = rows[0];
    } catch (checkError) {
      console.error("Error checking for duplicate section:", checkError);
      return NextResponse.json(
        { error: "Failed to validate section" },
        { status: 500 }
      );
    }

    if (existingSection) {
      return NextResponse.json(
        { error: "A section with this name already exists in this menu" },
        { status: 409 }
      );
    }

    // Create menu section
    let section;
    try {
      const { rows } = await query(
        `INSERT INTO menu_sections (listing_id, name, description, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [listingId, name.trim(), description?.trim() || null, display_order],
      );
      section = rows[0];
    } catch (error) {
      console.error("Error creating menu section:", error);
      return NextResponse.json(
        { error: "Failed to create menu section" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: section,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in admin menu POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
