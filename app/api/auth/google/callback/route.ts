import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { getGoogleCallbackUrl, getRequestOrigin } from "@/lib/auth/url";
import { setSession } from "@/lib/auth/session";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-account";

const STATE_COOKIE_NAME = "g_oauth_state";

function safeNextPath(rawNext: unknown): string {
  if (
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
  ) {
    return rawNext;
  }
  return "/dashboard";
}

function loginErrorRedirect(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) {
    return loginErrorRedirect(origin, "Google sign-in was cancelled.");
  }

  const stateCookie = request.cookies.get(STATE_COOKIE_NAME)?.value;
  let expectedState: { nonce?: string; next?: unknown; invite?: unknown } = {};
  try {
    expectedState = stateCookie ? JSON.parse(stateCookie) : {};
  } catch {
    expectedState = {};
  }

  if (!code || !state || !expectedState.nonce || state !== expectedState.nonce) {
    return loginErrorRedirect(
      origin,
      "Google sign-in session expired. Please try again."
    );
  }

  const next = safeNextPath(expectedState.next);
  const inviteCode =
    typeof expectedState.invite === "string" ? expectedState.invite : undefined;

  try {
    const redirectUri = getGoogleCallbackUrl(request);
    const profile = await exchangeGoogleCode(code, redirectUri);

    if (!profile.email_verified) {
      return loginErrorRedirect(
        origin,
        "Your Google account email is not verified."
      );
    }

    const user = await findOrCreateOAuthUser("google", profile, inviteCode);

    const response = NextResponse.redirect(new URL(next, origin));
    response.cookies.delete(STATE_COOKIE_NAME);
    await setSession(response, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    try {
      const { logUserLogin } = await import("@/lib/audit");
      await logUserLogin(user.id);
    } catch (logError) {
      console.error("Failed to log Google login:", logError);
    }

    return response;
  } catch (error) {
    console.error("GOOGLE CALLBACK: Authentication failed:", error);
    return loginErrorRedirect(
      origin,
      "An error occurred during Google sign-in. Please try again."
    );
  }
}
