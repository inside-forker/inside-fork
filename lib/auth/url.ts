const TRUSTED_SITE_URL_ENV_KEYS = [
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
] as const;

function normalizeSiteOrigin(rawUrl: string): string {
  const candidate = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
  const url = new URL(candidate);

  if (process.env.NODE_ENV === "production") {
    if (url.protocol !== "https:") {
      throw new Error("Auth redirect URL must use HTTPS in production");
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      throw new Error("Auth redirect URL cannot use localhost in production");
    }
  }

  return url.origin;
}

function getConfiguredSiteOrigin(): string | null {
  for (const key of TRUSTED_SITE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return normalizeSiteOrigin(value);
    }
  }

  return null;
}

interface RequestLike {
  url: string;
  headers: Pick<Headers, "get">;
}

function resolveSiteOrigin(request?: RequestLike): string {
  // Outside production, always use the request's own origin (localhost, a
  // LAN IP for testing on a phone, ...) when we have one. NEXT_PUBLIC_SITE_URL
  // in .env is the shared production value - preferring it here would
  // silently send the OAuth round-trip to production instead of the local
  // dev server, and the state cookie set on this origin would never come
  // back on that unrelated domain.
  //
  // We read the Host header directly rather than `request.url`: when the
  // dev server is started with `next dev -H 0.0.0.0` (to allow LAN/phone
  // testing), Next.js builds `request.url` from that bind address instead
  // of the incoming Host header, so it always reports 0.0.0.0 regardless of
  // what host the browser actually used.
  if (process.env.NODE_ENV !== "production" && request) {
    const host = request.headers.get("host");
    if (host) {
      const protocol = request.headers.get("x-forwarded-proto") ?? "http";
      return `${protocol}://${host}`;
    }
    return new URL(request.url).origin;
  }

  const configuredOrigin = getConfiguredSiteOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  throw new Error(
    "SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL must be configured for auth redirects"
  );
}

/**
 * Domain to scope the OAuth state cookie to, so it survives the round-trip
 * regardless of whether the user started on the apex domain or "www" -
 * Google/Apple always redirect back to the exact configured site origin
 * (e.g. www.insidekarachi.com), but a cookie set without an explicit domain
 * is host-only and won't be sent back if the user began on a different host
 * variant. Returns undefined outside production (host-only cookie is fine
 * for a single-host local/dev origin).
 */
export function getStateCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const origin = getConfiguredSiteOrigin();
  if (!origin) return undefined;

  const hostname = new URL(origin).hostname;
  const bareHostname = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  return `.${bareHostname}`;
}

/**
 * The origin to redirect the browser back to after login (e.g. "/dashboard",
 * "/login?error=..."). Same origin resolution as the OAuth redirect_uri, so
 * post-login navigation lands on the same host the user actually started on
 * rather than the dev server's `-H` bind address or a stray Vercel preview host.
 */
export function getRequestOrigin(request?: RequestLike): string {
  return resolveSiteOrigin(request);
}

export function getAuthCallbackUrl(request?: RequestLike): string {
  return new URL("/api/auth/callback", resolveSiteOrigin(request)).toString();
}

export function getGoogleCallbackUrl(request?: RequestLike): string {
  return new URL(
    "/api/auth/google/callback",
    resolveSiteOrigin(request)
  ).toString();
}

export function getAppleCallbackUrl(request?: RequestLike): string {
  return new URL(
    "/api/auth/apple/callback",
    resolveSiteOrigin(request)
  ).toString();
}
