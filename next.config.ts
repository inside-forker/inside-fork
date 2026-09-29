import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";
import { withSentryConfig } from "@sentry/nextjs";
import createBundleAnalyzer from "@next/bundle-analyzer";

// Keep these inlined — next.config may load before path aliases resolve.
export const PAYFAST_LIVE_HOST = "https://ipg1.apps.net.pk";
export const PAYFAST_SANDBOX_HOST = "https://ipguat.apps.net.pk";

// CSP hosts (connect-src / form-action) for the PayFast checkout endpoint.
export function derivePayfastHosts(transactionUrl?: string): string[] {
  const hosts = new Set<string>([PAYFAST_LIVE_HOST, PAYFAST_SANDBOX_HOST]);
  if (transactionUrl) {
    try {
      hosts.add(new URL(transactionUrl).origin);
    } catch {
      // Ignore malformed PayFast URL.
    }
  }
  return Array.from(hosts);
}

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = (() => {
  const remotePatterns: Array<{
    protocol: string;
    hostname: string;
    port?: string;
    pathname: string;
  }> = [
    {
      protocol: "https",
      hostname: "placehold.co",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "images.unsplash.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "v3.ticketwala.pk",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "maps.googleapis.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "maps.google.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "www.google.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "www.gstatic.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "d2liqplnt17rh6.cloudfront.net",
      port: "",
      pathname: "/**",
    },
    {
      // ** matches any number of subdomain segments (e.g.
      // listing-images.sgp1.digitaloceanspaces.com), unlike a single "*"
      // which only matches one segment.
      protocol: "https",
      hostname: "**.digitaloceanspaces.com",
      port: "",
      pathname: "/**",
    },
    {
      // TEMP: legacy Supabase-hosted images not yet migrated to DO Spaces.
      // Remove once all listing image URLs point to DO.
      protocol: "https",
      hostname: "yllihsklgwbktqyjcgwr.supabase.co",
      port: "",
      pathname: "/**",
    },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      if (!remotePatterns.find((r) => r.hostname === host)) {
        remotePatterns.push({
          protocol: "https",
          hostname: host,
          port: "",
          pathname: "/**",
        });
      }
    } catch {
      // Skip adding SUPABASE host if NEXT_PUBLIC_SUPABASE_URL is malformed
    }
  }

  // Build CSP connect-src with current Supabase URL
  const supabaseHost = supabaseUrl
    ? supabaseUrl.replace("https://", "").replace("http://", "")
    : "";
  const supabaseWss = supabaseHost ? `wss://${supabaseHost}` : "";
  const connectSrcSupabase =
    supabaseUrl && supabaseWss ? `${supabaseUrl} ${supabaseWss}` : "";
  const sentryConnectSrcHosts = new Set<string>([
    "https://*.ingest.sentry.io",
    "https://*.ingest.de.sentry.io",
  ]);

  for (const dsn of [
    process.env.SENTRY_DSN,
    process.env.NEXT_PUBLIC_SENTRY_DSN,
  ]) {
    if (!dsn) {
      continue;
    }

    try {
      const parsedDsn = new URL(dsn);
      sentryConnectSrcHosts.add(parsedDsn.origin);
    } catch {
      // Ignore malformed DSN and keep defaults.
    }
  }

  // CSP host for the PayFast checkout form (browser POSTs here). Token URL is server-only, excluded.
  // Always allow both live + UAT so a mis-set env does not CSP-block the redirect.
  const payfastHosts = derivePayfastHosts(process.env.PAYFAST_TRANSACTION_URL);
  const payfastConnectSrc = payfastHosts.join(" ");

  return {
    // Performance optimizations
    experimental: {
      optimizePackageImports: ["lucide-react", "@radix-ui/react-dropdown-menu"],
    },
    // Keep native/Node-only packages out of the webpack bundle graph
    serverExternalPackages: ["sharp", "pg"],
    // Pre-existing lint debt shouldn't block production builds; run `next lint` separately in CI/editor.
    eslint: {
      ignoreDuringBuilds: true,
    },
    // Compress output
    compress: true,
    // Better image optimization
    images: {
      dangerouslyAllowSVG: true,
      remotePatterns,
      formats: ["image/webp"],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      qualities: [25, 50, 75, 80, 90, 100],
      minimumCacheTTL: 60,
    },
    // Security headers
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "Referrer-Policy",
              value: "origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value: "camera=(self), microphone=(self), geolocation=(self)",
            },
            {
              key: "Content-Security-Policy",
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://maps.googleapis.com https://www.gstatic.com https://va.vercel-scripts.com https://*.crisp.chat blob:",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com https://*.crisp.chat",
                "font-src 'self' https://fonts.gstatic.com https://*.crisp.chat",
                "media-src 'self' https://*.crisp.chat",
                "img-src 'self' data: https: blob:",
                `connect-src 'self' https://maps.googleapis.com https://www.google.com https://*.crisp.chat wss://*.relay.crisp.chat wss://*.relay.rescue.crisp.chat ${connectSrcSupabase} ${payfastConnectSrc} ${Array.from(sentryConnectSrcHosts).join(" ")}`.trim(),
                "frame-src 'self' https://maps.google.com https://www.google.com https://*.crisp.chat https://*.crisp.help",
                "frame-ancestors 'self' https://www.google.com",
                "worker-src 'self' blob: https://*.crisp.chat",
                "child-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                `form-action 'self' ${payfastConnectSrc}`,
              ].join("; "),
            },
          ],
        },
        {
          source: "/api/(.*)",
          headers: [
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
          ],
        },
      ];
    },
    async redirects() {
      return [
        // Redirect legacy /admin landing to /dashboard
        {
          source: "/admin",
          destination: "/dashboard",
          permanent: true,
        },
        {
          source: "/category/:slug*",
          destination: "/listings/:slug*",
          permanent: true,
        },
        {
          source: "/blog",
          destination: "/",
          permanent: false,
        },
        {
          source: "/blog/:slug*",
          destination: "/",
          permanent: false,
        },
      ];
    },
  } as NextConfig;
})();

export default withSentryConfig(withBundleAnalyzer(withBotId(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
