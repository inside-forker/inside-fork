import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Cached across invocations so we don't refetch Google's signing keys per request.
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is not configured");
  }
  return clientId;
}

/**
 * Every client id whose ID tokens this server will accept.
 *
 * The web flow's tokens are always minted for `GOOGLE_CLIENT_ID` (the web
 * client). Native mobile sign-in is the wrinkle: on Android the SDK is handed
 * `webClientId` and its ID tokens carry that same audience, but the iOS Google
 * Sign-In SDK mints ID tokens for the *iOS* client id once one is configured.
 * A single-audience check therefore passes on web and Android and rejects iOS
 * with `invalid_google_token`, which looks exactly like a broken sign-in.
 *
 * `GOOGLE_IOS_CLIENT_ID` is optional - when unset this behaves exactly as
 * before. It is an audience allow-list, not a trust downgrade: tokens must
 * still be signed by Google and issued by a Google issuer, and every entry
 * here is a client id this project owns.
 */
function getAcceptedGoogleAudiences(): string[] {
  const audiences = [getGoogleClientId()];
  const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    audiences.push(iosClientId);
  }
  return audiences;
}

function getGoogleClientSecret(): string {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET environment variable is not configured"
    );
  }
  return clientSecret;
}

/**
 * Builds the URL that starts the Google OAuth consent flow.
 */
export function buildGoogleAuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

/**
 * Verifies a Google-issued ID token (from either the web authorization-code
 * exchange below, or one handed directly to the mobile app by the native
 * Google Sign-In SDK) and returns its profile claims. Accepts any audience in
 * `getAcceptedGoogleAudiences()` - see there for why iOS needs its own.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdTokenPayload> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: GOOGLE_ISSUERS,
    audience: getAcceptedGoogleAudiences(),
  });

  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Google ID token is missing required claims");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/**
 * Exchanges an authorization code for tokens and returns the verified ID token payload.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleIdTokenPayload> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${body}`);
  }

  const { id_token: idToken } = (await response.json()) as {
    id_token?: string;
  };

  if (!idToken) {
    throw new Error("Google token response did not include an id_token");
  }

  return verifyGoogleIdToken(idToken);
}
