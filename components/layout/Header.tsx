import { query } from "@/lib/db";
import Link from "next/link";
import { ThemeAwareLogo } from "./ThemeAwareLogo";
import { UserNav } from "./UserNav";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";

export async function Header() {
  const { rows: parents } = await query(
    `SELECT id, name, slug FROM categories
     WHERE parent_id IS NULL AND show_in_nav = true AND is_enabled = true
     ORDER BY id`,
  );

  const parentIds = parents.map((p) => p.id);
  const subsByParent = new Map<number, { id: number; name: string; slug: string }[]>();
  if (parentIds.length > 0) {
    const { rows: subs } = await query(
      `SELECT id, name, slug, parent_id FROM categories WHERE parent_id = ANY($1) ORDER BY id`,
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

  const navItems = parents.map((p) => ({
    id: Number(p.id),
    name: p.name,
    slug: p.slug,
    categories: subsByParent.get(Number(p.id)) || [],
  }));

  const parentCategoriesWithSub =
    navItems?.filter((item) => item.categories.length > 0) || [];
  const simpleNavLinks =
    navItems?.filter((item) => item.categories.length === 0) || [];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container relative flex h-16 max-w-screen-2xl items-center">
          <div className="flex-1 flex justify-start md:hidden">
            {/* Placeholder for the mobile nav trigger, which is now the BottomNav */}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0">
            <Link href="/" className="flex items-center space-x-2">
              <ThemeAwareLogo />
            </Link>
          </div>
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium md:flex-1 md:justify-center">
            <MegaMenu />
            {simpleNavLinks.map((item) => (
              <Link
                key={item.id}
                href={
                  item.slug === "guides-reviews"
                    ? "/blog"
                    : `/listings/${item.slug}`
                }
                className="px-4 py-2 transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.name}
              </Link>
            ))}
          </nav>
          {/* Right aligned actions div */}
          <div className="hidden md:flex items-center space-x-2">
            <UserNav />
          </div>
        </div>
      </header>
      {/* Render Mobile Wrapper */}
      <MobileNav
        categoryNavItems={parentCategoriesWithSub}
        simpleNavLinks={simpleNavLinks}
      />
    </>
  );
}
