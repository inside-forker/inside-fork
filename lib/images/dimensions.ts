import { unstable_cache } from "next/cache";

export interface ImageSize {
  width: number;
  height: number;
}

const PROBE_BYTES = 65_536;
const PROBE_TIMEOUT_MS = 3_000;

function u16be(b: Uint8Array, i: number) {
  return (b[i] << 8) | b[i + 1];
}
function u16le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8);
}
function u24le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
}
function ascii(b: Uint8Array, i: number, n: number) {
  return String.fromCharCode(...b.subarray(i, i + n));
}

/** Width and height from the first bytes of a PNG, JPEG, GIF or WebP file. */
export function readImageSize(b: Uint8Array): ImageSize | null {
  // PNG: IHDR is the first chunk.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") {
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }
  // GIF
  if (b.length >= 10 && ascii(b, 0, 4) === "GIF8") {
    return { width: u16le(b, 6), height: u16le(b, 8) };
  }
  // WebP
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    const chunk = ascii(b, 12, 4);
    if (chunk === "VP8X") return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
    if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    if (chunk === "VP8L") {
      const b1 = b[21], b2 = b[22], b3 = b[23], b4 = b[24];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
      i += 2 + u16be(b, i + 2);
    }
  }
  return null;
}

async function probe(url: string): Promise<ImageSize> {
  const res = await fetch(url, {
    headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
    cache: "no-store",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) throw new Error(`Image probe failed: HTTP ${res.status}`);

  // Read only the head of the file, even if the server ignores Range.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < PROBE_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }

  const size = readImageSize(bytes);
  if (!size || size.width <= 0 || size.height <= 0) throw new Error("Image probe: unknown format");
  return size;
}

// Uploaded images never change at a URL (the file name carries a timestamp),
// so a size is cached for a month. Failures throw, so they aren't cached.
const cachedProbe = unstable_cache(probe, ["image-size-v1"], { revalidate: 60 * 60 * 24 * 30 });

/** An image's pixel size, or null when it can't be read (callers fall back to 16:9). */
export async function getImageSize(url: string | null | undefined): Promise<ImageSize | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    return await cachedProbe(url);
  } catch (error) {
    console.error("[image size]", url, error);
    return null;
  }
}
