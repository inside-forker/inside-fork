import { type NextRequest } from "next/server";
import { z } from "zod";
import disposableDomains from "disposable-email-domains";
import { v4 as uuidv4 } from "uuid";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createAndSendSignupOtp } from "@/lib/auth/otp";
import type { MobileSignupResponse } from "@/types/mobile-auth.types";
import {
  sanitizeInput,
  validatePasswordStrength,
  validateEmailFormat,
} from "@/lib/utils";
import { AUTH_VALIDATION } from "@/types/auth.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  username: z.string(),
  full_name: z.string().nullable().optional(),
});

function validateUsername(username: string): boolean {
  const { minLength, maxLength, pattern } = AUTH_VALIDATION.username;
  return (
    username.length >= minLength &&
    username.length <= maxLength &&
    pattern.test(username)
  );
}

/**
 * POST /api/mobile/v1/auth/signup  (unauthenticated)
 *
 * Creates a user + profile and returns a JWT access token in the response
 * body (mobile has no cookie jar, unlike `app/api/auth/signup`). Mirrors that
 * route's validation/DB-insert logic; skips recaptcha/honeypot (no browser
 * bot surface on a mobile client) and invite-code redemption (fast-follow).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Email, password, confirmPassword, and username are required.",
      400,
    );
  }
  const { email, password, confirmPassword, username, full_name } =
    parsed.data;

  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const sanitizedEmail = sanitizeInput(email);
  const sanitizedUsername = sanitizeInput(username);
  const sanitizedFullName = full_name ? sanitizeInput(full_name) : null;

  if (!sanitizedEmail || !password || !confirmPassword || !sanitizedUsername) {
    const missingField = !sanitizedEmail
      ? "email"
      : !password
        ? "password"
        : !confirmPassword
          ? "confirmPassword"
          : "username";
    throw new MobileApiError(
      "validation_error",
      `${missingField.charAt(0).toUpperCase() + missingField.slice(1).replace(/([A-Z])/g, " $1")} is required.`,
      400,
      missingField,
    );
  }

  if (password !== confirmPassword) {
    throw new MobileApiError(
      "validation_error",
      "Passwords do not match.",
      400,
      "confirmPassword",
    );
  }

  if (!validateEmailFormat(sanitizedEmail)) {
    throw new MobileApiError(
      "validation_error",
      "Please enter a valid email address.",
      400,
      "email",
    );
  }

  const domain = sanitizedEmail.split("@")[1];
  if (domain && disposableDomains.includes(domain)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed. Please use a permanent email address.",
      400,
      "email",
    );
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    throw new MobileApiError(
      "validation_error",
      `Password is too weak. ${passwordValidation.feedback.join(". ")}.`,
      400,
      "password",
    );
  }

  const trimmedUsername = sanitizedUsername.trim().toLowerCase();
  if (!validateUsername(trimmedUsername)) {
    throw new MobileApiError(
      "validation_error",
      AUTH_VALIDATION.username.patternDescription,
      400,
      "username",
    );
  }

  if (
    sanitizedFullName &&
    sanitizedFullName.length > AUTH_VALIDATION.fullName.maxLength
  ) {
    throw new MobileApiError(
      "validation_error",
      `Full name must be less than ${AUTH_VALIDATION.fullName.maxLength} characters.`,
      400,
      "full_name",
    );
  }

  const { rows: existingUsernames } = await query(
    "SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1",
    [trimmedUsername],
  );
  if (existingUsernames.length > 0) {
    throw new MobileApiError(
      "validation_error",
      "Username is already taken. Please choose a different username.",
      400,
      "username",
    );
  }

  const { rows: existingEmails } = await query(
    "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [sanitizedEmail],
  );
  if (existingEmails.length > 0) {
    throw new MobileApiError(
      "validation_error",
      "An account with this email address already exists.",
      400,
      "email",
    );
  }

  const encryptedPassword = await hashPassword(password);
  const newUserId = uuidv4();
  const now = new Date().toISOString();

  // email_confirmed_at stays NULL until the signup OTP is verified.
  await query(
    `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
     VALUES ($1, $2, $3, NULL, $4, $5, 'authenticated', 'authenticated')`,
    [newUserId, sanitizedEmail, encryptedPassword, now, now],
  );

  try {
    await query(`SELECT public.create_user_profile($1, $2, $3)`, [
      newUserId,
      trimmedUsername,
      sanitizedFullName,
    ]);
  } catch (profileCreateError) {
    console.error("[mobile-api] signup profile creation exception:", {
      error: profileCreateError,
      userId: newUserId,
      username: trimmedUsername,
    });
    await query(
      `INSERT INTO public.profiles (id, username, full_name, role, points, active_role)
       VALUES ($1, $2, $3, 'public_user', 0, 'public_user')`,
      [newUserId, trimmedUsername, sanitizedFullName],
    );
  }

  try {
    const { logUserSignup } = await import("@/lib/audit");
    await logUserSignup(
      newUserId,
      sanitizedEmail,
      ip,
      request.headers.get("user-agent") || undefined,
    );
  } catch (logError) {
    console.error("Failed to log user signup:", logError);
  }

  try {
    const { appendConsentLedger } = await import("@/lib/consent/ledger");
    await appendConsentLedger({
      userId: newUserId,
      source: "signup",
      termsVersion: "current",
      privacyVersion: "current",
      marketingEmail: false,
      marketingPush: false,
      marketingSms: false,
      marketingWhatsapp: false,
      personalisationOptIn: true,
      meta: { channel: "mobile" },
    });
  } catch (consentError) {
    console.error("[mobile-api] signup consent ledger failed:", consentError);
  }

  await createAndSendSignupOtp({
    userId: newUserId,
    email: sanitizedEmail,
    fullName: sanitizedFullName,
  });

  const response: MobileSignupResponse = {
    requiresVerification: true,
    email: sanitizedEmail,
  };
  return ok(response);
});
