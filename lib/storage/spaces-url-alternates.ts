/**
 * Legacy Peekaboo imports sometimes landed under `listing-images/peekaboo/…`
 * while the live object is only at `peekaboo/…` (or the reverse). CDN vs
 * origin host also drifts. Shared by `/img` and the listing-image health audit.
 */

function isDigitalOceanSpacesHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".digitaloceanspaces.com") || host === "digitaloceanspaces.com"
  );
}

/**
 * Ordered candidate URLs to try when fetching a Spaces listing image.
 * First entry is always the original. Only Spaces-shaped hosts are expanded.
 */
export function spacesUrlAlternates(primaryUrl: string | URL): string[] {
  let primary: URL;
  try {
    primary = typeof primaryUrl === "string" ? new URL(primaryUrl) : primaryUrl;
  } catch {
    return typeof primaryUrl === "string" ? [primaryUrl] : [primaryUrl.toString()];
  }

  if (primary.protocol !== "https:" || !isDigitalOceanSpacesHost(primary.hostname)) {
    return [primary.toString()];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: URL) => {
    const s = u.toString();
    if (seen.has(s)) return;
    if (!isDigitalOceanSpacesHost(u.hostname)) return;
    seen.add(s);
    out.push(s);
  };

  push(primary);

  const withHost = (host: string) => {
    const u = new URL(primary.toString());
    u.hostname = host;
    push(u);
  };

  const host = primary.hostname.toLowerCase();
  if (host.includes(".cdn.")) {
    withHost(host.replace(".cdn.", "."));
  } else {
    withHost(
      host.replace(".digitaloceanspaces.com", ".cdn.digitaloceanspaces.com"),
    );
  }

  const pathAlts: string[] = [];
  if (primary.pathname.includes("/listing-images/peekaboo/")) {
    pathAlts.push(
      primary.pathname.replace("/listing-images/peekaboo/", "/peekaboo/"),
    );
  } else if (primary.pathname.includes("/peekaboo/")) {
    pathAlts.push(
      primary.pathname.replace("/peekaboo/", "/listing-images/peekaboo/"),
    );
  }

  for (const pathname of pathAlts) {
    const u = new URL(primary.toString());
    u.pathname = pathname;
    push(u);
    const h = u.hostname.toLowerCase();
    if (h.includes(".cdn.")) {
      const o = new URL(u.toString());
      o.hostname = h.replace(".cdn.", ".");
      push(o);
    } else {
      const c = new URL(u.toString());
      c.hostname = h.replace(
        ".digitaloceanspaces.com",
        ".cdn.digitaloceanspaces.com",
      );
      push(c);
    }
  }

  return out;
}

/**
 * Prefer the CDN host for a working Spaces URL so clients hit the edge.
 * Path is left as-is (caller already chose the working key).
 */
export function preferCdnSpacesUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      isDigitalOceanSpacesHost(host) &&
      !host.includes(".cdn.")
    ) {
      u.hostname = host.replace(
        ".digitaloceanspaces.com",
        ".cdn.digitaloceanspaces.com",
      );
    }
    return u.toString();
  } catch {
    return url;
  }
}
