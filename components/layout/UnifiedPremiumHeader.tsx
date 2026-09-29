import { query } from "@/lib/db";
import { PremiumHeader } from "@/components/dashboard/PremiumHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { getOptionalSessionUser } from "@/lib/auth/require-session";
import type { User } from "@supabase/supabase-js";

interface UnifiedPremiumHeaderProps {
  context?: "public" | "dashboard";
  showDiscoveryPanel?: boolean;
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export async function UnifiedPremiumHeader({
  context = "public",
  showDiscoveryPanel = true,
  onMenuClick,
  sidebarOpen = false,
}: UnifiedPremiumHeaderProps) {
  // Resolve JWT session for public header (login sets insidekhi_session, not Supabase cookies).
  let user: User | null = null;
  let profile: {
    id: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    role?: string;
    active_role?: string;
  } | null = null;

  try {
    const sessionData = await getOptionalSessionUser();
    if (sessionData) {
      user = {
        id: sessionData.user.id,
        email: sessionData.user.email,
      } as User;
      if (sessionData.profile) {
        profile = {
          id: sessionData.profile.id,
          full_name: sessionData.profile.full_name,
          username: sessionData.profile.username as string | null | undefined,
          avatar_url: sessionData.profile.avatar_url,
          role: sessionData.profile.role,
          active_role: sessionData.profile.active_role ?? undefined,
        };
      }
    }
  } catch (error) {
    // During static rendering, cookies() will throw - this is expected
    if (
      error instanceof Error &&
      error.message?.includes("Dynamic server usage")
    ) {
      // Expected during build - silently continue with null user
    } else {
      console.error("Auth error in header:", error);

      // The profile lookup may be temporarily unavailable even though the
      // signed session cookie is valid. Fall back to the JWT-only lookup so
      // the header does not visually sign the user out on a database blip.
      try {
        const sessionOnly = await getOptionalSessionUser({
          withProfile: false,
        });
        if (sessionOnly) {
          user = {
            id: sessionOnly.user.id,
            email: sessionOnly.user.email,
          } as User;
        }
      } catch (sessionError) {
        console.error("JWT-only header auth fallback failed:", sessionError);
      }
    }
  }

  // Fetch navigation data only for mobile nav when needed
  let parentCategories: Array<{
    id: number;
    name: string;
    slug: string;
    categories: Array<{ id: number; name: string; slug: string }>;
  }> = [];
  let simpleNavLinks: Array<{ id: number; name: string; slug: string }> = [];

  if (context === "public") {
    try {
      const [parentsResult, navLinksResult] = await Promise.all([
        query(
          `SELECT id, name, slug FROM categories
           WHERE parent_id IS NULL AND is_enabled = true
           ORDER BY name ASC`,
        ),
        query(
          `SELECT id, name, slug FROM categories
           WHERE is_enabled = true AND slug = ANY($1)`,
          [
            [
              "events",
              "things-to-do",
              "eat-drink",
              "where-to-stay",
              "guides-reviews",
            ],
          ],
        ),
      ]);

      const parentIds = parentsResult.rows.map((p) => p.id);
      const subsByParent = new Map<
        number,
        { id: number; name: string; slug: string }[]
      >();
      if (parentIds.length > 0) {
        const { rows: subs } = await query(
          `SELECT c.id, c.name, c.slug, c.parent_id
           FROM categories c
           WHERE c.parent_id = ANY($1)
             AND c.is_enabled = true
             AND (
               EXISTS (
                 SELECT 1 FROM listings l
                 WHERE (l.category_id = c.id OR EXISTS (
                   SELECT 1 FROM listing_categories lc WHERE lc.listing_id = l.id AND lc.category_id = c.id
                 ))
                 AND l.status = 'published'
               )
               OR EXISTS (
                 SELECT 1 FROM events e
                 WHERE e.category_id = c.id AND e.status = 'published' AND e.end_time >= NOW()
               )
             )
           ORDER BY c.name ASC`,
          [parentIds],
        );
        for (const sub of subs) {
          const parentId = Number(sub.parent_id);
          if (!subsByParent.has(parentId)) subsByParent.set(parentId, []);
          subsByParent.get(parentId)!.push({
            id: Number(sub.id),
            name: sub.name,
            slug: sub.slug,
          });
        }
      }

      // Mirrors the old `categories!inner(...)` embed: only keep parents
      // that have at least one sub-category.
      parentCategories = parentsResult.rows
        .map((p) => ({
          id: Number(p.id),
          name: p.name,
          slug: p.slug,
          categories: subsByParent.get(Number(p.id)) || [],
        }))
        .filter((p) => p.categories.length > 0);

      simpleNavLinks = navLinksResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        slug: row.slug,
      }));
    } catch (error) {
      // During static rendering, this may fail - continue with empty nav
      if (
        !(
          error instanceof Error &&
          error.message?.includes("Dynamic server usage")
        )
      ) {
        console.error("Navigation data fetch error:", error);
      }
    }
  }

  return (
    <>
      <PremiumHeader
        user={user}
        profile={profile}
        context={context}
        showDiscoveryPanel={showDiscoveryPanel}
        onMenuClick={onMenuClick}
        sidebarOpen={sidebarOpen}
      />

      {/* Mobile Navigation - Only show on public pages */}
      {context === "public" && (
        <MobileNav
          categoryNavItems={parentCategories || []}
          simpleNavLinks={simpleNavLinks || []}
          user={user}
          profile={profile}
        />
      )}
    </>
  );
}
