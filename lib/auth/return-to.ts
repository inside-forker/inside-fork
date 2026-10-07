import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Pages where "come back here after signing in" makes no sense (or loops).
const AUTH_PAGES = [
  "/login",
  "/signup",
  "/verify-otp",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

/** A same-site path to return to, or null. Never `//host` or an absolute URL. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  return raw;
}

/**
 * `/login` and `/signup` links that bring the visitor back to the page they
 * are on (via `?next=`), e.g. a student arriving on an event from the Parchi
 * app. Client components only. The query string is read after mount so pages
 * stay statically renderable.
 */
export function useAuthLinks(): { loginHref: string; signupHref: string } {
  const pathname = usePathname() || "/";
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(window.location.search);
  }, [pathname]);

  const isAuthPage = AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
  if (pathname === "/" || isAuthPage) {
    return { loginHref: "/login", signupHref: "/signup" };
  }
  const next = encodeURIComponent(pathname + search);
  return { loginHref: `/login?next=${next}`, signupHref: `/signup?next=${next}` };
}
