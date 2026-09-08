import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { verifyAppleIdToken, type AppleIdTokenPayload } from "@/lib/auth/apple";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-account";
import { signToken } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { MOBILE_TOKEN_TTL_MS, type MobileAuthResponse } from "@/types/mobile-auth.types";

export const dynamic = "force-dynamic";

// Every iOS build variant's bundle id (app.config.ts's BUNDLE_IDENTIFIER +
// .dev/.preview suffixes) - a native Sign in with Apple token is audienced
// to whichever one built the app, not to the web APPLE_CLIENT_ID.
const IOS_BUNDLE_IDS = [
  "com.insidekarachi.app",
  "com.insidekarachi.app.dev",
  "com.insidekarachi.app.preview",
];

const bodySchema = z.object({
  identityToken: z.string().min(1),
  fullName: z.string().min(1).optional(),
});

/**
 * POST /api/mobile/v1/auth/apple  (unauthenticated)
 *
 * Verifies an Apple ID token obtained natively on-device
 * (expo-apple-authentication) and reuses the same findOrCreateOAuthUser as
 * the web Apple login. Mirrors `app/api/mobile/v1/auth/google`, except the
 * field names match what expo-apple-authentication actually returns
 * (identityToken, and fullName present only on the very first authorization).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "An Apple identity token is required.",
      400,
    );
  }

  let profile: AppleIdTokenPayload;
  try {
    profile = await verifyAppleIdToken(parsed.data.identityToken, IOS_BUNDLE_IDS);
  } catch {
    throw new MobileApiError(
      "invalid_apple_token",
      "Could not verify Apple sign-in. Please try again.",
      401,
    );
  }

  if (!profile.email_verified) {
    throw new MobileApiError(
      "email_not_verified",
      "Your Apple account email is not verified.",
      403,
    );
  }

  const user = await findOrCreateOAuthUser("apple", {
    ...profile,
    name: parsed.data.fullName,
  });

  const { rows } = await query(
    `SELECT username, full_name FROM public.profiles WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  const profileRow = rows[0];

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  try {
    const { logUserLogin } = await import("@/lib/audit");
    await logUserLogin(user.id);
  } catch (logError) {
    console.error("Failed to log Apple mobile login:", logError);
  }

  const response: MobileAuthResponse = {
    token,
    expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL_MS).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      username: profileRow?.username ?? null,
      full_name: profileRow?.full_name ?? null,
    },
  };
  return ok(response);
});
