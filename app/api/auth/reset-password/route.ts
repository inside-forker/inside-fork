import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { sendPasswordResetEmail } from "@/lib/emails/send-password-reset";
import { getPublicSiteOrigin } from "@/lib/auth/url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body || {};

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required",
          field: "email",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "Please enter a valid email address",
          field: "email",
        },
        { status: 400 }
      );
    }

    // Verify email exists in DB
    const { rows: users } = await query(
      "SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    let emailSent = false;
    if (users.length > 0) {
      const user = users[0];
      const recoveryToken = uuidv4();
      const now = new Date();
      const tokenSentAt = now.toISOString();

      // Store recovery token inside auth.users table
      await query(
        `UPDATE auth.users
         SET recovery_token = $1, recovery_sent_at = $2
         WHERE id = $3`,
        [recoveryToken, tokenSentAt, user.id]
      );

      // Always the public site (never localhost), even when testing from local.
      const resetLink = `${getPublicSiteOrigin()}/reset-password?code=${recoveryToken}`;

      // Get user profile for full name
      const { rows: profiles } = await query(
        "SELECT full_name FROM public.profiles WHERE id = $1 LIMIT 1",
        [user.id]
      );
      const fullName = profiles[0]?.full_name || undefined;

      // Send password reset email
      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        fullName,
        resetLink,
        expiryHours: 24,
      });

      if (emailResult.success) {
        console.log(`[PASSWORD RESET EMAIL SENT]: ${user.email}`, {
          messageId: emailResult.messageId,
        });
        emailSent = true;
      } else {
        console.error(`[PASSWORD RESET EMAIL FAILED]: ${user.email}`, {
          error: emailResult.error,
        });
        // Still log the reset token link for debugging in case email fails
        console.log(
          `[PASSWORD RESET LINK (BACKUP)]: ${resetLink}`
        );
      }
    }

    // Log successful password reset request
    try {
      const { logPasswordResetRequest } = await import("@/lib/audit");
      await logPasswordResetRequest(
        email,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined
      );
    } catch (logError) {
      console.error("Failed to log password reset request:", logError);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? "Password reset instructions have been sent to your email address."
        : "Password reset request processed. Please check your email for further instructions.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        field: "server",
      },
      { status: 500 }
    );
  }
}
