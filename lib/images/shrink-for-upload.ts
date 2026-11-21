/**
 * Browser-only. Vercel rejects request bodies over 4.5 MB with an HTML 413
 * page, so large photos are downscaled and re-encoded before upload.
 * Files already under the target are returned untouched.
 */

const TARGET_BYTES = 4 * 1024 * 1024; // headroom under Vercel's 4.5 MB cap
const MAX_EDGE = 2560;

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function shrinkImageForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  try {
    let edge = Math.min(MAX_EDGE, Math.max(bitmap.width, bitmap.height));

    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = edge / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // WebP keeps PNG transparency; browsers that can't encode it return PNG,
      // in which case fall back to JPEG.
      let blob = await encode(canvas, "image/webp", 0.85);
      if (!blob || blob.type !== "image/webp") {
        blob = await encode(canvas, "image/jpeg", 0.85);
      }

      if (blob && blob.size <= TARGET_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const base = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], `${base}.${ext}`, { type: blob.type });
      }
      edge = Math.round(edge * 0.75);
    }
  } finally {
    bitmap.close();
  }

  return file; // couldn't shrink enough; let the size check report it
}
