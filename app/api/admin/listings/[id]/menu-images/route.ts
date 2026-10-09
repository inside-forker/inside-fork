import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import {
  listListingImages,
  getListingImagePublicUrl,
  getListingImageKeyFromUrl,
  deleteFile,
} from "@/lib/storage/spaces";

/**
 * GET /api/admin/listings/[id]/menu-images
 * Fetches menu images from:
 * 1. Database listing_images table (matching menu URLs / tags)
 * 2. Storage: peekaboo/{peekaboo_id}/menu/ folder (for scraped listings)
 * 3. Storage: {listing_id}/menu/ folder (for manually created listings)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Fetch the listing to get peekaboo_id
    const { rows: listingRows } = await query(
      `SELECT peekaboo_id FROM listings WHERE id = $1`,
      [listingId],
    );
    const listing = listingRows[0];

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const allMenuImages: Array<{
      id: number;
      listing_id: number;
      url: string;
      alt_text: string;
      display_order: number;
      created_at: string;
      source: "storage" | "database";
    }> = [];

    const seenUrls = new Set<string>();
    let imageIndex = 0;

    // 1. Check Database listing_images table for menu images
    try {
      const { rows: dbImages } = await query(
        `SELECT id, listing_id, url, alt_text, display_order, to_json(created_at) #>> '{}' AS created_at
         FROM listing_images
         WHERE listing_id = $1
           AND (url ILIKE '%/menu/%' OR url ILIKE '%menu%' OR alt_text ILIKE '%menu%')
         ORDER BY display_order ASC`,
        [listingId],
      );

      for (const row of dbImages) {
        if (row.url && !seenUrls.has(row.url)) {
          seenUrls.add(row.url);
          allMenuImages.push({
            id: Number(row.id),
            listing_id: listingId,
            url: row.url,
            alt_text: row.alt_text || "Menu image",
            display_order: row.display_order !== null ? Number(row.display_order) : imageIndex++,
            created_at: row.created_at || new Date().toISOString(),
            source: "database",
          });
        }
      }
    } catch (dbErr) {
      console.warn("[MENU IMAGES] DB listing_images lookup notice:", dbErr);
    }

    // 2. Check Storage: peekaboo folder (for scraped listings)
    if (listing.peekaboo_id) {
      try {
        const peekabooPath = `peekaboo/${listing.peekaboo_id}/menu`;
        const peekabooFiles = await listListingImages(peekabooPath);

        const peekabooImages = peekabooFiles
          .map((key) => key.split("/").pop() ?? "")
          .filter((name) => name && !name.startsWith("."))
          .map((name) => {
            const url = getListingImagePublicUrl(`${peekabooPath}/${name}`);
            return {
              id: -1 * ++imageIndex,
              listing_id: listingId,
              url,
              alt_text: "Menu image",
              display_order: imageIndex - 1,
              created_at: new Date().toISOString(),
              source: "storage" as const,
            };
          })
          .filter((img) => !seenUrls.has(img.url));

        for (const img of peekabooImages) {
          seenUrls.add(img.url);
          allMenuImages.push(img);
        }
      } catch (spacesErr) {
        console.warn("[MENU IMAGES] Spaces peekaboo lookup notice:", spacesErr);
      }
    }

    // 3. Check Storage: manual upload folder
    try {
      const manualPath = `${listingId}/menu`;
      const manualFiles = await listListingImages(manualPath);

      const manualImages = manualFiles
        .map((key) => key.split("/").pop() ?? "")
        .filter((name) => name && !name.startsWith("."))
        .map((name) => {
          const url = getListingImagePublicUrl(`${manualPath}/${name}`);
          return {
            id: -1 * ++imageIndex,
            listing_id: listingId,
            url,
            alt_text: "Menu image",
            display_order: imageIndex - 1,
            created_at: new Date().toISOString(),
            source: "storage" as const,
          };
        })
        .filter((img) => !seenUrls.has(img.url));

      for (const img of manualImages) {
        seenUrls.add(img.url);
        allMenuImages.push(img);
      }
    } catch (manualErr) {
      console.warn("[MENU IMAGES] Spaces manual upload lookup notice:", manualErr);
    }

    return NextResponse.json({
      success: true,
      data: allMenuImages,
      count: allMenuImages.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[MENU IMAGES] Unexpected error:", error);
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
    });
  }
}

/**
 * DELETE /api/admin/listings/[id]/menu-images
 * Deletes a menu image from database and storage
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    // Delete from database if present
    try {
      await query(
        `DELETE FROM listing_images WHERE listing_id = $1 AND url = $2`,
        [listingId, imageUrl],
      );
    } catch (dbDelErr) {
      console.warn("[MENU IMAGES] Delete from DB notice:", dbDelErr);
    }

    // Delete from Spaces storage
    const storageKey = getListingImageKeyFromUrl(imageUrl);
    if (storageKey) {
      try {
        await deleteFile(storageKey);
      } catch (spacesDelErr) {
        console.warn("[MENU IMAGES] Delete from Spaces notice:", spacesDelErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Menu image deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[MENU IMAGES DELETE] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to delete menu image" },
      { status: 500 },
    );
  }
}
