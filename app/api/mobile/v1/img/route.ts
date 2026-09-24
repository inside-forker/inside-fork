import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Cacheable by CDN via Cache-Control / Vercel-CDN-Cache-Control on the response.
export const dynamic = "force-dynamic";

/** Cap decode work — feed cards ask for ~200–800 CSS px @2×. */
const MIN_W = 32;
const MAX_W = 1600;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

sharp.cache(false);
/** Modest parallelism so Home scroll storms don't all serialize into timeouts. */
sharp.concurrency(2);

/**
 * Hosts we will fetch and resize. Anything else is rejected to avoid SSRF
 * (open proxy). Production listing/event art lives on DigitalOcean Spaces.
 * Optional custom CDN hostname via DO_SPACES_CDN_ENDPOINT.
 */
function customCdnHost(): string | null {
  const endpoint = process.env.DO_SPACES_CDN_ENDPOINT;
  if (!endpoint) return null;
  try {
    return new URL(endpoint).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host.endsWith(".digitaloceanspaces.com") ||
    host === "digitaloceanspaces.com"
  ) {
    return true;
  }
  const custom = customCdnHost();
  return custom != null && host === custom;
}

/** Spaces uploads often use application/octet-stream — still valid image bytes. */
function isAcceptableUpstreamType(contentType: string): boolean {
  if (!contentType) return true;
  const base = contentType.split(";")[0].trim().toLowerCase();
  return (
    base.startsWith("image/") ||
    base === "application/octet-stream" ||
    base === "binary/octet-stream"
  );
}

async function readBodyCapped(
  res: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return null;

  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * GET /api/mobile/v1/img?url=&w=
 *
 * On-the-fly resize for Spaces originals. Mobile clients rewrite Spaces URLs
 * through this proxy so rails decode ~400–800px JPEGs instead of multi‑MB
 * originals — the dominant battery cost on scroll.
 */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const wRaw = request.nextUrl.searchParams.get("w");

  if (!urlParam) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Missing url." } },
      { status: 400 },
    );
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid url." } },
      { status: 400 },
    );
  }

  if (target.protocol !== "https:" || !isAllowedImageHost(target.hostname)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Host not allowed." } },
      { status: 403 },
    );
  }

  const width = Math.min(
    MAX_W,
    Math.max(MIN_W, Math.round(Number(wRaw) || 400)),
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { Accept: "image/*,*/*" },
      cache: "no-store",
      redirect: "manual",
    });

    // Do not follow redirects — a Spaces object that 302s off-allowlist
    // would otherwise become an open proxy (SSRF).
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json(
        { error: { code: "redirect_forbidden", message: "Redirects not allowed." } },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: { code: "upstream_error", message: "Image fetch failed." } },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!isAcceptableUpstreamType(contentType)) {
      return NextResponse.json(
        { error: { code: "invalid_type", message: "Not an image." } },
        { status: 415 },
      );
    }

    const buf = await readBodyCapped(upstream, MAX_INPUT_BYTES);
    if (!buf) {
      return NextResponse.json(
        { error: { code: "invalid_image", message: "Image too large." } },
        { status: 413 },
      );
    }
    if (buf.byteLength === 0) {
      return NextResponse.json(
        { error: { code: "invalid_image", message: "Empty image." } },
        { status: 422 },
      );
    }

    // sharp sniffs bytes — covers octet-stream Spaces objects that are JPEGs.
    const out = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // Browser + Vercel edge — url+w is immutable for a day.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "CDN-Cache-Control": "max-age=86400",
        "Vercel-CDN-Cache-Control": "max-age=86400",
      },
    });
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    console.error("[mobile-img]", aborted ? "timeout" : err);
    return NextResponse.json(
      {
        error: {
          code: aborted ? "timeout" : "internal_error",
          message: aborted ? "Image fetch timed out." : "Resize failed.",
        },
      },
      { status: aborted ? 504 : 500 },
    );
  } finally {
    clearTimeout(timer);
  }
}
