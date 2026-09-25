import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  deleteFile,
  listListingImages,
  getListingImageKeyFromUrl,
} from "@/lib/storage/spaces";
import { uploadListingImageWithFeedVariants } from "@/lib/storage/feed-image-variants";

import { v4 as uuidv4 } from "uuid";

// POST: Upload image to temp folder
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tempSessionId = formData.get("tempSessionId") as string | null;
    if (!file || !tempSessionId) {
      return NextResponse.json(
        { error: "Missing file or tempSessionId" },
        { status: 400 }
      );
    }

    // Auth check (lister/admin/super_admin)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;
    const relativePath = `temp/${tempSessionId}/${filename}`;

    // Upload to DO Spaces under listing-images/temp/... + feed variants
    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await uploadListingImageWithFeedVariants(
      relativePath,
      Buffer.from(arrayBuffer),
      {
        contentType: file.type,
      }
    );

    // Return image info (simulate ListingImage)
    const newImage = {
      id: Date.now(), // temp UI id; deletion resolves via URL/path
      listing_id: null,
      url: uploadResult.publicUrl,
      path: uploadResult.path,
      alt_text: null,
      is_primary: false,
      display_order: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, data: newImage });
  } catch (_err) {
    console.error("Listing temp image upload failed:", _err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete image from temp folder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tempSessionId = searchParams.get("tempSessionId");
    const imageId = searchParams.get("imageId");
    const imageUrl = searchParams.get("url");

    if (!tempSessionId || (!imageId && !imageUrl)) {
      return NextResponse.json(
        { error: "Missing tempSessionId and image identifier" },
        { status: 400 }
      );
    }

    // Auth check
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prefer deleting by URL/path when provided (most reliable after UUID filenames)
    if (imageUrl) {
      const key = getListingImageKeyFromUrl(imageUrl);
      if (key) {
        await deleteFile(key);
        return NextResponse.json({ success: true });
      }
    }

    // List files in temp folder on Spaces
    const files = await listListingImages(`temp/${tempSessionId}`);

    // Match by full filename, filename stem, or path containing imageId
    const fileToDelete = files.find((f) => {
      if (!imageId) return false;
      const name = f.split("/").pop() || "";
      const stem = name.replace(/\.[^.]+$/, "");
      return (
        name === imageId ||
        stem === imageId ||
        name.startsWith(imageId) ||
        f.includes(imageId)
      );
    });

    if (!fileToDelete) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await deleteFile(fileToDelete);

    return NextResponse.json({ success: true });
  } catch (_err) {
    console.error("Listing temp image delete failed:", _err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
