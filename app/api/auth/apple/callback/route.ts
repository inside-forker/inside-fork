import { NextResponse, type NextRequest } from "next/server";
import { exchangeAppleCode } from "@/lib/auth/apple";
import { getAppleCallbackUrl, getRequestOrigin } from "@/lib/auth/url";
import { setSession } from "@/lib/auth/session";
import { findOrCreateOAuthUser } from "@/lib/auth/oauth-account";

const STATE_COOKIE_NAME = "a_oauth_state";

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

/**
 * Apple only sends the user's name once, as a JSON string in the "user" form
 * field on the very first authorization — never in the ID token, and never
 * again on subsequent logins.
 */
function extractAppleName(rawUser: FormDataEntryValue | null): string | undefined {
  if (typeof rawUser !== "string") return undefined;
  try {
    const parsed = JSON.parse(rawUser) as {
      name?: { firstName?: string; lastName?: string };
    };
    const full = [parsed.name?.firstName, parsed.name?.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ");
    return full || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const formData = await request.formData();
  const code = formData.get("code");
  const state = formData.get("state");
  const oauthError = formData.get("error");

  if (oauthError) {
    return loginErrorRedirect(origin, "Apple sign-in was cancelled.");
  }

  const stateCookie = request.cookies.get(STATE_COOKIE_NAME)?.value;
  let expectedState: { nonce?: string; next?: unknown; invite?: unknown } = {};
  try {
    expectedState = stateCookie ? JSON.parse(stateCookie) : {};
  } catch {
    expectedState = {};
  }

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !expectedState.nonce ||
    state !== expectedState.nonce
  ) {
    return loginErrorRedirect(
      origin,
      "Apple sign-in session expired. Please try again."
    );
  }

  const next = safeNextPath(expectedState.next);
  const inviteCode =
    typeof expectedState.invite === "string" ? expectedState.invite : undefined;

  try {
    const redirectUri = getAppleCallbackUrl(request);
    const profile = await exchangeAppleCode(code, redirectUri);

    if (!profile.email_verified) {
      return loginErrorRedirect(
        origin,
        "Your Apple account email is not verified."
      );
    }

    const name = extractAppleName(formData.get("user"));

    const user = await findOrCreateOAuthUser(
      "apple",
      { sub: profile.sub, email: profile.email, name },
      inviteCode
    );

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
      console.error("Failed to log Apple login:", logError);
    }

    return response;
  } catch (error) {
    console.error("APPLE CALLBACK: Authentication failed:", error);
    return loginErrorRedirect(
      origin,
      "An error occurred during Apple sign-in. Please try again."
    );
  }
}
