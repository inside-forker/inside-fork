import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { buildAppleAuthUrl } from "@/lib/auth/apple";
import {
  getAppleCallbackUrl,
  getRequestOrigin,
  getStateCookieDomain,
} from "@/lib/auth/url";

const STATE_COOKIE_NAME = "a_oauth_state";

function safeNextPath(rawNext: string | null): string {
  if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")) {
    return rawNext;
  }
  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const invite = requestUrl.searchParams.get("invite") || undefined;
  const nonce = randomBytes(16).toString("hex");

  let authUrl: string;
  try {
    const redirectUri = getAppleCallbackUrl(request);
    authUrl = buildAppleAuthUrl({ redirectUri, state: nonce });
  } catch (error) {
    console.error("APPLE OAUTH: Failed to build authorization URL:", error);
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("error", "Apple sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(authUrl);

  response.cookies.set(
    STATE_COOKIE_NAME,
    JSON.stringify({ nonce, next, invite }),
    {
      httpOnly: true,
      // Apple's callback arrives as a cross-site POST (response_mode=form_post),
      // so this cookie needs SameSite=None to survive that navigation in
      // Safari/Firefox, which (unlike Chrome) don't relax Lax for top-level POSTs.
      // SameSite=None requires Secure; Apple only allows HTTPS redirect URIs
      // anyway, so this is safe unconditionally.
      secure: true,
      sameSite: "none",
      domain: getStateCookieDomain(),
      path: "/api/auth/apple",
      maxAge: 600, // 10 minutes
    }
  );

  return response;
}
