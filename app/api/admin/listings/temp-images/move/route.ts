import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import {
  copyFile,
  deleteFile,
  getPublicUrl,
  listListingImages,
  toListingImageObjectKey,
} from "@/lib/storage/spaces";

export async function POST(request: NextRequest) {
  let parsedBody = null;
  try {
    const rawBody = await request.text();
    parsedBody = JSON.parse(rawBody);
  } catch (_err) {
    return NextResponse.json(
      { error: "Malformed request body" },
      { status: 400 }
    );
  }
  const { tempSessionId, listingId } = parsedBody || {};
  if (!tempSessionId || !listingId) {
    return NextResponse.json(
      { error: "Missing tempSessionId or listingId" },
      { status: 400 }
    );
  }

  try {
    await assertListingRouteAccess({
      listingId: Number(listingId),
      allowBusinessOwner: true,
    });

    // List all files in temp folder on DigitalOcean Spaces
    const tempFolder = `temp/${tempSessionId}`;
    let files: string[];
    try {
      files = await listListingImages(tempFolder);
    } catch (listError) {
      return NextResponse.json(
        {
          error:
            listError instanceof Error
              ? listError.message
              : "Failed to list temp images",
        },
        { status: 500 },
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, moved: 0 });
    }

    // Move each file to listing folder and insert DB record
    let displayOrder = 1;
    const movedFiles = [];
    for (const fromPath of files) {
      const fileName = fromPath.split("/").pop();
      if (!fileName) {
        continue;
      }

      const toPath = toListingImageObjectKey(`${listingId}/${fileName}`);

      try {
        await copyFile(fromPath, toPath);
      } catch (copyError) {
        return NextResponse.json(
          {
            error:
              copyError instanceof Error
                ? copyError.message
                : "Failed to copy temp image",
          },
          { status: 500 },
        );
      }

      try {
        await deleteFile(fromPath);
      } catch (removeError) {
        return NextResponse.json(
          {
            error:
              removeError instanceof Error
                ? removeError.message
                : "Failed to remove temp image",
          },
          { status: 500 },
        );
      }

      const publicUrl = getPublicUrl(toPath);

      try {
        await query(
          `INSERT INTO listing_images
             (listing_id, url, alt_text, display_order, is_primary, availability, last_checked_at)
           VALUES ($1, $2, $3, $4, $5, 'ok', NOW())`,
          [
            Number(listingId),
            publicUrl,
            fileName,
            displayOrder,
            displayOrder === 1,
          ],
        );
      } catch (dbError) {
        return NextResponse.json(
          {
            error:
              dbError instanceof Error
                ? dbError.message
                : "Failed to save listing image",
          },
          { status: 500 },
        );
      }

      movedFiles.push(toPath);
      displayOrder++;
    }

    return NextResponse.json({ success: true, moved: movedFiles.length });
  } catch (_err) {
    if (_err instanceof Error && _err.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_err);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
