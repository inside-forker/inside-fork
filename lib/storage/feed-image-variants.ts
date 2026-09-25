import sharp from "sharp";
import {
  uploadListingImage,
  uploadFile,
  getPublicUrl,
  getListingImagePublicUrl,
  toListingImageObjectKey,
} from "@/lib/storage/spaces";

/** Widths written beside each original for feed cards (battery-safe). */
export const FEED_VARIANT_WIDTHS = [400, 800] as const;

const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Derive a sibling object key / relative path: `foo.jpg` → `foo_w400.jpg`.
 * Idempotent if the path already ends with `_w{n}` before the extension.
 */
export function feedVariantPath(originalPath: string, width: number): string {
  const cleaned = originalPath.replace(
    /_w(400|800|1200)(?=\.[^./]+$)/,
    "",
  );
  if (/\.[^./]+$/.test(cleaned)) {
    return cleaned.replace(/(\.[^./]+)$/, `_w${width}$1`);
  }
  return `${cleaned}_w${width}.jpg`;
}

export function feedVariantPublicUrl(
  originalPublicUrl: string,
  width: number,
): string | null {
  try {
    const u = new URL(originalPublicUrl);
    u.pathname = feedVariantPath(u.pathname, width);
    return u.toString();
  } catch {
    return null;
  }
}

async function encodeFeedVariant(
  buffer: Buffer,
  width: number,
): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

export type FeedVariantUpload = {
  width: number;
  path: string;
  publicUrl: string;
};

/**
 * Upload listing-image feed variants under the `listing-images/` prefix.
 * Failures on individual widths are logged and skipped (original still wins).
 */
export async function uploadListingFeedVariants(
  relativePath: string,
  buffer: Buffer,
): Promise<FeedVariantUpload[]> {
  const uploaded: FeedVariantUpload[] = [];
  for (const width of FEED_VARIANT_WIDTHS) {
    try {
      const data = await encodeFeedVariant(buffer, width);
      const variantRel = feedVariantPath(relativePath, width);
      const result = await uploadListingImage(variantRel, data, {
        contentType: "image/jpeg",
      });
      uploaded.push({
        width,
        path: result.path,
        publicUrl: result.publicUrl,
      });
    } catch (err) {
      console.error(
        `[feed-variants] listing w${width} failed for ${relativePath}`,
        err,
      );
    }
  }
  return uploaded;
}

/**
 * Upload feed variants next to an arbitrary Spaces object key (events, etc.).
 */
export async function uploadObjectFeedVariants(
  objectKey: string,
  buffer: Buffer,
  opts?: { bucket?: string },
): Promise<FeedVariantUpload[]> {
  const uploaded: FeedVariantUpload[] = [];
  for (const width of FEED_VARIANT_WIDTHS) {
    try {
      const data = await encodeFeedVariant(buffer, width);
      const variantKey = feedVariantPath(objectKey, width);
      const result = await uploadFile(variantKey, data, {
        contentType: "image/jpeg",
        bucket: opts?.bucket,
      });
      uploaded.push({
        width,
        path: result.path,
        publicUrl: result.publicUrl,
      });
    } catch (err) {
      console.error(
        `[feed-variants] object w${width} failed for ${objectKey}`,
        err,
      );
    }
  }
  return uploaded;
}

/**
 * Upload original listing image + feed variants. Returns the original path/URL
 * (DB continues to store the original; clients derive `_w*` siblings).
 */
export async function uploadListingImageWithFeedVariants(
  relativePath: string,
  body: Buffer | Uint8Array,
  opts?: { contentType?: string },
): Promise<{ path: string; publicUrl: string; variants: FeedVariantUpload[] }> {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const original = await uploadListingImage(relativePath, buffer, opts);
  const variants = await uploadListingFeedVariants(relativePath, buffer);
  return { ...original, variants };
}

/** Helpers for scripts / debugging. */
export function listingVariantPublicUrlFromRelative(
  relativePath: string,
  width: number,
): string {
  return getListingImagePublicUrl(feedVariantPath(relativePath, width));
}

export function objectVariantPublicUrl(
  objectKey: string,
  width: number,
  bucket?: string,
): string {
  return getPublicUrl(feedVariantPath(objectKey, width), bucket);
}

export function listingObjectKey(relativePath: string): string {
  return toListingImageObjectKey(relativePath);
}
