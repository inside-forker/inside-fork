import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const region = process.env.DO_SPACES_REGION || "sgp1";
const endpoint = process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
const accessKeyId = process.env.DO_SPACES_KEY || "";
const secretAccessKey = process.env.DO_SPACES_SECRET || "";
const defaultBucket = process.env.DO_SPACES_BUCKET || "insidekhi";
const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || `https://${defaultBucket}.${region}.cdn.digitaloceanspaces.com/`;

/** Folder prefixes used inside the default Spaces bucket. */
export const LISTING_IMAGES_PREFIX = "listing-images";
export const GET_LISTED_IMAGES_PREFIX = "get-listed-images";
export const PROFILES_AVATAR_PREFIX = "profiles_avatar";
export const MENU_ITEM_IMAGES_PREFIX = "menu-item-images";
export const LISTING_PDFS_PREFIX = "listing-pdfs";
export const TICKET_PDF_INVENTORY_PREFIX = "ticket-pdf-inventory";
export const SHARE_SCREENSHOTS_PREFIX = "share-screenshots";
export const BANKS_PREFIX = "banks";
export const BLOG_IMAGES_PREFIX = "blog-images";

/** Known prefixes that were historically mistaken for Spaces bucket names. */
export const SPACES_ASSET_PREFIXES = [
  LISTING_IMAGES_PREFIX,
  GET_LISTED_IMAGES_PREFIX,
  PROFILES_AVATAR_PREFIX,
  MENU_ITEM_IMAGES_PREFIX,
  LISTING_PDFS_PREFIX,
  TICKET_PDF_INVENTORY_PREFIX,
  SHARE_SCREENSHOTS_PREFIX,
  BANKS_PREFIX,
  BLOG_IMAGES_PREFIX,
] as const;

export type SpacesAssetPrefix = (typeof SPACES_ASSET_PREFIXES)[number];

function fakeBucketHost(prefix: string): string {
  return `${prefix}.${region}.digitaloceanspaces.com`;
}

function defaultBucketStandardHost(): string {
  return `${defaultBucket}.${region}.digitaloceanspaces.com`;
}

function cdnBaseUrl(): string {
  return cdnEndpoint.endsWith("/") ? cdnEndpoint : `${cdnEndpoint}/`;
}

// Initialize S3 client for DigitalOcean Spaces
export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  // digitalocean spaces requires forcing path style in some configurations,
  // but standard endpoints are fine
  forcePathStyle: false,
});

export interface UploadOptions {
  bucket?: string;
  contentType?: string;
  isPublic?: boolean;
}

/**
 * Normalize a relative path to an object key under a prefix in the default bucket.
 */
export function toPrefixedObjectKey(prefix: string, relativePath: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const cleanPath = relativePath.startsWith("/")
    ? relativePath.substring(1)
    : relativePath;

  if (cleanPath.startsWith(`${cleanPrefix}/`)) {
    return cleanPath;
  }

  return `${cleanPrefix}/${cleanPath}`;
}

/**
 * Build the public CDN URL for an object under a default-bucket prefix.
 */
export function getPrefixedPublicUrl(prefix: string, relativePath: string): string {
  return getPublicUrl(toPrefixedObjectKey(prefix, relativePath));
}

/**
 * Upload into the default bucket under the given prefix.
 */
export async function uploadPrefixedFile(
  prefix: string,
  relativePath: string,
  body: Buffer | Uint8Array | Blob | string,
  opts?: Omit<UploadOptions, "bucket">
): Promise<{ path: string; publicUrl: string }> {
  return uploadFile(toPrefixedObjectKey(prefix, relativePath), body, {
    ...opts,
    bucket: defaultBucket,
  });
}

/**
 * Delete an object under a default-bucket prefix.
 */
export async function deletePrefixedFile(
  prefix: string,
  relativePath: string,
): Promise<void> {
  await deleteFile(toPrefixedObjectKey(prefix, relativePath));
}

/**
 * List objects under a default-bucket prefix + relative folder.
 */
export async function listPrefixedFiles(
  prefix: string,
  relativePrefix: string = "",
): Promise<string[]> {
  const cleanRelative = relativePrefix.replace(/^\/+/, "");
  const fullPrefix = cleanRelative
    ? toPrefixedObjectKey(prefix, cleanRelative)
    : `${prefix.replace(/^\/+|\/+$/g, "")}/`;
  return listFiles(fullPrefix);
}

/**
 * Recover a default-bucket object key for a public URL under a known prefix.
 * Handles CDN URLs, default-bucket standard URLs, and fake-bucket hostnames.
 */
export function getPrefixedKeyFromUrl(url: string, prefix: string): string | null {
  if (!url) {
    return null;
  }

  const defaultKey = getKeyFromPublicUrl(url);
  if (defaultKey) {
    return defaultKey.startsWith(`${prefix}/`)
      ? defaultKey
      : toPrefixedObjectKey(prefix, defaultKey);
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname === fakeBucketHost(prefix)) {
      const key = parsed.pathname.replace(/^\//, "");
      return key ? toPrefixedObjectKey(prefix, key) : null;
    }

    const supabaseMarker = `/storage/v1/object/public/${prefix}/`;
    const markerIndex = parsed.pathname.indexOf(supabaseMarker);
    if (markerIndex !== -1) {
      const key = parsed.pathname.substring(markerIndex + supabaseMarker.length);
      return key ? toPrefixedObjectKey(prefix, key) : null;
    }
  } catch {
    return null;
  }

  const pathMarker = `/${prefix}/`;
  const pathIndex = url.indexOf(pathMarker);
  if (pathIndex !== -1) {
    const key = url.substring(pathIndex + pathMarker.length).split("?")[0];
    return key ? toPrefixedObjectKey(prefix, key) : null;
  }

  return null;
}

/**
 * Rewrite a fake-bucket hostname URL
 * (`https://{prefix}.{region}.digitaloceanspaces.com/<key>`) to the correct
 * default-bucket CDN URL. Returns null when the URL is not in that form.
 */
export function rewriteFakeBucketHostUrl(
  url: string,
  prefix: string,
): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== fakeBucketHost(prefix)) {
      return null;
    }

    const key = parsed.pathname.replace(/^\//, "");
    if (!key) {
      return null;
    }

    return getPrefixedPublicUrl(prefix, key);
  } catch {
    return null;
  }
}

/**
 * Normalize a URL that already points at the default bucket (standard host)
 * onto the CDN host. Returns null when the URL is not a default-bucket
 * standard Spaces URL.
 */
export function rewriteDefaultBucketStandardUrlToCdn(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== defaultBucketStandardHost()) {
      return null;
    }

    const key = parsed.pathname.replace(/^\//, "");
    if (!key) {
      return null;
    }

    return `${cdnBaseUrl()}${key}`;
  } catch {
    return null;
  }
}

/**
 * Normalize a relative listing-image path to the object key used in the
 * default Spaces bucket (`listing-images/...`).
 */
export function toListingImageObjectKey(relativePath: string): string {
  return toPrefixedObjectKey(LISTING_IMAGES_PREFIX, relativePath);
}

/**
 * Build the public URL for a listing image stored under the default bucket.
 */
export function getListingImagePublicUrl(relativePath: string): string {
  return getPrefixedPublicUrl(LISTING_IMAGES_PREFIX, relativePath);
}

/**
 * Upload a listing image into the default Spaces bucket under the
 * `listing-images/` prefix. Prefer this over `uploadFile(..., { bucket: "listing-images" })`.
 */
export async function uploadListingImage(
  relativePath: string,
  body: Buffer | Uint8Array | Blob | string,
  opts?: Omit<UploadOptions, "bucket">
): Promise<{ path: string; publicUrl: string }> {
  return uploadPrefixedFile(LISTING_IMAGES_PREFIX, relativePath, body, opts);
}

/**
 * Delete a listing image object from the default Spaces bucket.
 */
export async function deleteListingImage(relativePath: string): Promise<void> {
  await deletePrefixedFile(LISTING_IMAGES_PREFIX, relativePath);
}

/**
 * List listing-image objects under a relative prefix (e.g. `temp/session-id`).
 */
export async function listListingImages(relativePrefix: string): Promise<string[]> {
  return listPrefixedFiles(LISTING_IMAGES_PREFIX, relativePrefix);
}

/**
 * Recover the Spaces object key for a listing image public URL.
 */
export function getListingImageKeyFromUrl(url: string): string | null {
  return getPrefixedKeyFromUrl(url, LISTING_IMAGES_PREFIX);
}

/**
 * Rewrite a wrongly-migrated listing-images hostname URL to the correct
 * default-bucket CDN URL. Returns null when the URL is not in the legacy form.
 */
export function rewriteLegacyListingImageUrl(url: string): string | null {
  return rewriteFakeBucketHostUrl(url, LISTING_IMAGES_PREFIX);
}

/**
 * Uploads a file buffer to DigitalOcean Spaces
 */
export async function uploadFile(
  path: string,
  body: Buffer | Uint8Array | Blob | string,
  opts?: UploadOptions
): Promise<{ path: string; publicUrl: string }> {
  const bucket = opts?.bucket || defaultBucket;
  const contentType = opts?.contentType || "application/octet-stream";
  const acl = opts?.isPublic !== false ? "public-read" : "private";

  // Ensure body is correct format
  const uploadBody: Buffer | Uint8Array | string = typeof body === "string" || body instanceof Buffer || body instanceof Uint8Array ? body : Buffer.from(await (body as Blob).arrayBuffer());



  // Remove leading slash in file paths if present
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cleanPath,
      Body: uploadBody,
      ContentType: contentType,
      ACL: acl,
    })
  );

  return {
    path: cleanPath,
    publicUrl: getPublicUrl(cleanPath, bucket),
  };
}

/**
 * Deletes a file or files from DigitalOcean Spaces
 */
export async function deleteFile(path: string, bucket?: string): Promise<void> {
  const targetBucket = bucket || defaultBucket;
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: cleanPath,
    })
  );
}

/**
 * Download an object body as a Buffer (for private ticket PDFs, etc.).
 */
export async function getObjectBuffer(
  path: string,
  bucket?: string,
): Promise<{ body: Buffer; contentType: string | undefined }> {
  const targetBucket = bucket || defaultBucket;
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: targetBucket,
      Key: cleanPath,
    }),
  );

  if (!result.Body) {
    throw new Error(`Empty object body for key: ${cleanPath}`);
  }

  const bytes = await result.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: result.ContentType,
  };
}

/**
 * Constructs the CDN or standard public URL for a file
 */
export function getPublicUrl(path: string, bucket?: string): string {
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  const targetBucket = bucket || defaultBucket;

  // Use Custom CDN Endpoint if available and using the default bucket
  if (targetBucket === defaultBucket && cdnEndpoint) {
    const baseCdn = cdnEndpoint.endsWith("/") ? cdnEndpoint : `${cdnEndpoint}/`;
    return `${baseCdn}${cleanPath}`;
  }

  // Otherwise construct standard spaces URL
  return `https://${targetBucket}.${region}.digitaloceanspaces.com/${cleanPath}`;
}

/**
 * Copies a file within the same bucket to a new key (server-side, no data
 * transfer through this process). There is no native "move" in the S3 API -
 * callers wanting move semantics should call this then deleteFile() on the
 * source path.
 */
export async function copyFile(
  fromPath: string,
  toPath: string,
  bucket?: string
): Promise<void> {
  const targetBucket = bucket || defaultBucket;
  const cleanFrom = fromPath.startsWith("/") ? fromPath.substring(1) : fromPath;
  const cleanTo = toPath.startsWith("/") ? toPath.substring(1) : toPath;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: targetBucket,
      CopySource: `/${targetBucket}/${cleanFrom.split("/").map(encodeURIComponent).join("/")}`,
      Key: cleanTo,
      ACL: "public-read",
    })
  );
}

/**
 * Recovers the object key from a public URL previously produced by
 * getPublicUrl(). Returns null if the URL doesn't match this bucket's CDN or
 * standard endpoint (e.g. a legacy URL from a different storage provider) -
 * callers should treat that as "nothing to delete" rather than an error.
 */
export function getKeyFromPublicUrl(url: string, bucket?: string): string | null {
  const targetBucket = bucket || defaultBucket;

  if (targetBucket === defaultBucket && cdnEndpoint) {
    const baseCdn = cdnEndpoint.endsWith("/") ? cdnEndpoint : `${cdnEndpoint}/`;
    if (url.startsWith(baseCdn)) {
      return url.substring(baseCdn.length);
    }
  }

  const standardBase = `https://${targetBucket}.${region}.digitaloceanspaces.com/`;
  if (url.startsWith(standardBase)) {
    return url.substring(standardBase.length);
  }

  return null;
}

/**
 * List files under a specific folder prefix
 */
export async function listFiles(prefix: string, bucket?: string): Promise<string[]> {
  const targetBucket = bucket || defaultBucket;
  const cleanPrefix = prefix.startsWith("/") ? prefix.substring(1) : prefix;

  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: targetBucket,
      Prefix: cleanPrefix,
    })
  );

  return (response.Contents || [])
    .map((item) => item.Key)
    .filter((key): key is string => !!key);
}
