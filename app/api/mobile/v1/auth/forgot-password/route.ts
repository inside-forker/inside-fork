import { type NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/emails/send-password-reset";
import { getPublicSiteOrigin } from "@/lib/auth/url";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().email() });

/**
 * POST /api/mobile/v1/auth/forgot-password  (unauthenticated)
 *
 * Requests a password-reset link. Enumeration-safe: identical `{ sent: true }`
 * response regardless of whether the address exists. Mirrors
 * `app/api/auth/reset-password` (the web "request" route — mobile just uses a
 * clearer route name since it also has a distinct `/reset-password` route for
 * the "confirm" step, unlike the web's nested `/reset-password/confirm`).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  }
  const email = parsed.data.email.trim().toLowerCase();

  try {
    const { rows: users } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email],
    );

    if (users.length > 0) {
      const user = users[0];
      const recoveryToken = uuidv4();
      const now = new Date().toISOString();

      await query(
        `UPDATE auth.users
         SET recovery_token = $1, recovery_sent_at = $2
         WHERE id = $3`,
        [recoveryToken, now, user.id],
      );

      const resetLink = `${getPublicSiteOrigin()}/reset-password?code=${recoveryToken}`;
      const { rows: profiles } = await query(
        "SELECT full_name FROM public.profiles WHERE id = $1 LIMIT 1",
        [user.id],
      );
      const fullName = profiles[0]?.full_name || undefined;

      const emailResult = await sendPasswordResetEmail({
        email,
        fullName,
        resetLink,
        expiryHours: 24,
      });

      if (emailResult.success) {
        console.log(`[MOBILE PASSWORD RESET EMAIL SENT]: ${email}`, {
          messageId: emailResult.messageId,
        });
      } else {
        console.error(`[MOBILE PASSWORD RESET EMAIL FAILED]: ${email}`, {
          error: emailResult.error,
        });
        console.log(`[MOBILE PASSWORD RESET LINK (BACKUP)]: ${resetLink}`);
      }
    }

    try {
      const { logPasswordResetRequest } = await import("@/lib/audit");
      await logPasswordResetRequest(
        email,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log password reset request:", logError);
    }
  } catch (error) {
    console.error(
      "[mobile-api] forgot-password failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return ok({ sent: true });
});
