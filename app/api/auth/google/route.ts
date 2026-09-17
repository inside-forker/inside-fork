import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { buildGoogleAuthUrl } from "@/lib/auth/google";
import {
  getGoogleCallbackUrl,
  getRequestOrigin,
  getStateCookieDomain,
} from "@/lib/auth/url";

const STATE_COOKIE_NAME = "g_oauth_state";

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
    const redirectUri = getGoogleCallbackUrl(request);
    authUrl = buildGoogleAuthUrl({ redirectUri, state: nonce });
  } catch (error) {
    console.error("GOOGLE OAUTH: Failed to build authorization URL:", error);
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("error", "Google sign-in is not configured.");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(authUrl);

  response.cookies.set(
    STATE_COOKIE_NAME,
    JSON.stringify({ nonce, next, invite }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: getStateCookieDomain(),
      path: "/api/auth/google",
      maxAge: 600, // 10 minutes
    }
  );

  return response;
}
