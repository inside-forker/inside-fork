import { NextResponse } from "next/server";
import { getRecaptchaSiteKey } from "@/lib/utils/recaptcha";

export const runtime = "nodejs";

/**
 * Returns the public reCAPTCHA v3 site key at request time.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at build time. If the
 * key was added (or changed) in the host env after the last build, client code
 * still sees `undefined` — this endpoint fixes that without a redeploy rebuild.
 */
export async function GET() {
  const siteKey = getRecaptchaSiteKey() ?? null;
  return NextResponse.json(
    { siteKey },
    {
      headers: {
        // Short cache so deploys/env updates propagate quickly; still avoids
        // hammering the route on every form interaction in the same session.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
