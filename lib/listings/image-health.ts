import {
  preferCdnSpacesUrl,
  spacesUrlAlternates,
} from "@/lib/storage/spaces-url-alternates";

export type ListingImageAvailability = "unknown" | "ok" | "dead";

export type ImageProbeStatus = "ok" | "ok_via_alternate" | "dead";

export type ImageProbeResult = {
  status: ImageProbeStatus;
  /** URL that responded successfully (CDN-preferred when rewritten). */
  workingUrl: string | null;
  httpStatus: number | null;
};

const HEAD_TIMEOUT_MS = 8_000;

async function headOk(url: string): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, status: res.status };
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe a listing image URL (and Spaces path/host alternates).
 * Uses HEAD only — no body download — for audit/cron scale.
 */
export async function probeListingImageUrl(
  url: string,
): Promise<ImageProbeResult> {
  const candidates = spacesUrlAlternates(url);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const { ok, status } = await headOk(candidate);
    if (ok) {
      const workingUrl = preferCdnSpacesUrl(candidate);
      if (i === 0 && workingUrl === url) {
        return { status: "ok", workingUrl: url, httpStatus: status };
      }
      // Same object, CDN rewrite only — still "ok" if path/host match intent.
      if (i === 0) {
        return { status: "ok", workingUrl, httpStatus: status };
      }
      return {
        status: "ok_via_alternate",
        workingUrl,
        httpStatus: status,
      };
    }
  }
  return { status: "dead", workingUrl: null, httpStatus: null };
}

/** SQL fragment: treat unknown/null as usable; exclude confirmed dead. */
export const LISTING_IMAGE_NOT_DEAD_SQL =
  `(availability IS NULL OR availability IS DISTINCT FROM 'dead')`;

export function mapProbeToAvailability(
  status: ImageProbeStatus,
): ListingImageAvailability {
  return status === "dead" ? "dead" : "ok";
}
