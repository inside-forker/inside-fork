"use client";

import { usePathname } from "next/navigation";
import { ReactNode, isValidElement, Children } from "react";
import { FavoritesProvider } from "@/components/layout/providers/FavoritesProvider";
import { CrispChat } from "@/components/layout/CrispChat";

interface ConditionalLayoutProps {
  children: React.ReactNode;
  header: ReactNode;
  footer: ReactNode;
}

export function ConditionalLayout({
  children,
  header,
  footer,
}: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Check if we're on an auth page
  const isAuthPage =
    pathname.includes("/login") ||
    pathname.includes("/signup") ||
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password");

  // Check if we're on a dashboard page
  const isDashboardPage = pathname.includes("/dashboard");

  // Check if we're on an admin page
  const isAdminPage = pathname.includes("/admin");

  // Check if we're on a checkout page (clean, distraction-free flow without floating chat bubble covering CTA)
  const isCheckoutPage = pathname.startsWith("/checkout");

  // Robust 404 detection: recursively scan children for the not-found marker
  type NotFoundProps = {
    "data-nextjs-not-found"?: unknown;
    children?: ReactNode;
  };
  function containsNotFoundMarker(node: ReactNode): boolean {
    if (!node) return false;
    // Flatten arrays/fragments
    const items = Children.toArray(node);
    for (const item of items) {
      if (
        isValidElement<NotFoundProps>(item) &&
        typeof item.props === "object" &&
        item.props !== null
      ) {
        if (
          "data-nextjs-not-found" in item.props &&
          item.props["data-nextjs-not-found"]
        ) {
          return true;
        }
        // Recurse into children
        if (
          item.props.children &&
          containsNotFoundMarker(item.props.children)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  const is404Page =
    containsNotFoundMarker(children) ||
    pathname === "/not-found" ||
    pathname === "/maintenance" ||
    pathname.endsWith("/not-found") ||
    pathname.endsWith("/maintenance");

  // Support chat only on regular user-facing pages
  const showChat =
    !isAuthPage &&
    !isDashboardPage &&
    !isAdminPage &&
    !is404Page &&
    !isCheckoutPage;

  return (
    <>
      {renderContent()}
      <CrispChat visible={showChat} />
    </>
  );

  function renderContent() {
    if (isAuthPage) {
      // Auth pages: no header/footer
      return <main className="min-h-screen">{children}</main>;
    }

    if (isDashboardPage || isAdminPage) {
      // Dashboard and Admin pages: use their own layout system
      return <main className="min-h-screen">{children}</main>;
    }

    if (is404Page) {
      // 404 pages: clean, minimal experience without header/footer
      return <main className="min-h-screen">{children}</main>;
    }

    // Regular pages: with header, footer, and favorites
    // Wrap with FavoritesProvider ONLY for user-facing pages

    return (
      <FavoritesProvider>
        <div className="relative flex min-h-screen flex-col">
          <div data-chrome="header">{header}</div>
          <main data-chrome="content" className="flex-1 pt-20">
            {children}
          </main>
          <div data-chrome="footer">{footer}</div>
        </div>
      </FavoritesProvider>
    );
  }
}
