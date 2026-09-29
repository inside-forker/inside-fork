import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { query } from "@/lib/db";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import {
  Utensils,
  Building,
  Ticket,
  Newspaper,
  HeartPulse,
  GraduationCap,
  Popcorn,
  ShoppingCart,
  Compass,
} from "lucide-react";

// Map slugs to icons for visual flair
const iconMap: { [key: string]: React.ElementType } = {
  "eat-drink": Utensils,
  "where-to-stay": Building,
  events: Ticket,
  "guides-reviews": Newspaper,
  "fitness-healthcare": HeartPulse,
  education: GraduationCap,
  entertainment: Popcorn,
  shopping: ShoppingCart,
  "things-to-do": Compass,
};

type SubCategory = { id: number; name: string; slug: string };
type ParentCategory = {
  id: number;
  name: string;
  slug: string;
  categories: SubCategory[];
};

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { icon?: React.ElementType }
>(({ className, title, icon: Icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "flex items-center gap-3 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium leading-none">{title}</span>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export async function MegaMenu() {
  let parentCategories: ParentCategory[];
  try {
    const { rows: parents } = await query(
      `SELECT id, name, slug FROM categories
       WHERE parent_id IS NULL AND is_enabled = true
       ORDER BY name ASC`,
    );

    const parentIds = parents.map((p) => p.id);
    const subsByParent = new Map<number, SubCategory[]>();
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

    // Only keep parents that have at least one active sub-category with published listings.
    parentCategories = parents
      .map((p) => ({
        id: Number(p.id),
        name: p.name,
        slug: p.slug,
        categories: subsByParent.get(Number(p.id)) || [],
      }))
      .filter((p) => p.categories.length > 0);
  } catch (error) {
    console.error("[MegaMenu] Error fetching categories:", error);
    return null;
  }

  if (!parentCategories) return null;

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Categories</NavigationMenuTrigger>
          <NavigationMenuContent>
            {/* Grid with a featured section on the left */}
            <div className="grid grid-cols-[1fr_3fr] gap-x-4 p-4 w-[90vw] bg-card">
              {/* Featured Section (Left Side) */}
              <div className="flex flex-col justify-between h-full">
                <Link
                  href="/"
                  className="flex flex-col justify-end h-full rounded-lg bg-gradient-to-b from-primary/80 to-primary p-6 no-underline outline-none focus:shadow-md"
                >
                  <div className="w-24">
                    {/* We can use the logo here for branding */}
                    <Image
                      src="/assets/logo-white.png"
                      alt="Logo"
                      width={100}
                      height={40}
                    />
                  </div>
                  <div className="mt-4 text-lg font-medium text-primary-foreground">
                    Discover Karachi
                  </div>
                  <p className="text-sm leading-tight text-primary-foreground/90">
                    Your ultimate guide to the best spots in the city.
                  </p>
                </Link>
              </div>

              {/* Categories Grid (Right Side) */}
              <div className="grid grid-cols-4 gap-x-6 gap-y-4">
                {parentCategories.map((category: ParentCategory) => (
                  <div key={category.id} className="flex flex-col space-y-2">
                    <h3 className="font-bold text-foreground px-3 flex items-center gap-2">
                      {iconMap[category.slug] &&
                        React.createElement(iconMap[category.slug], {
                          className: "h-4 w-4",
                        })}
                      {category.name}
                    </h3>
                    <ul className="pl-3">
                      {category.categories
                        .slice(0, 3)
                        .map((subCategory: SubCategory) => (
                          <ListItem
                            key={subCategory.id}
                            href={`/listings/${subCategory.slug}`}
                            title={subCategory.name}
                          />
                        ))}
                      {category.categories.length > 0 && (
                        <ListItem
                          href={`/listings/${category.slug}`}
                          title={`View All`}
                          className="font-semibold text-primary"
                        />
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
