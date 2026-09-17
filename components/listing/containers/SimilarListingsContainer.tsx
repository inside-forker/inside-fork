import { query } from "@/lib/db";
import { listingCategoriesExistsClause } from "@/lib/listings/category-scope";
import { SimilarListingsCarousel } from "@/components/listing/SimilarListingsCarousel";
import { Badge } from "@/components/ui/badge";
import { PremiumHeading } from "@/components/brand/Typography";
import { MapPin } from "lucide-react";

// Category color schemes (copied from page.tsx to keep consistency)
const categoryColorSchemes: Record<
  string,
  {
    bg: string;
    border: string;
    glow: string;
    accent: string;
    icon: string;
  }
> = {
  "Eat & Drink": {
    bg: "bg-orange-100 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-500/20",
    glow: "hover:shadow-lg hover:shadow-orange-500/10",
    accent: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
  },
  "Where to Stay": {
    bg: "bg-blue-100 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    glow: "hover:shadow-lg hover:shadow-blue-500/10",
    accent: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  "Things to Do": {
    bg: "bg-green-100 dark:bg-green-500/10",
    border: "border-green-200 dark:border-green-500/20",
    glow: "hover:shadow-lg hover:shadow-green-500/10",
    accent: "bg-green-500",
    icon: "text-green-600 dark:text-green-400",
  },
  Shopping: {
    bg: "bg-purple-100 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    glow: "hover:shadow-lg hover:shadow-purple-500/10",
    accent: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
  },
};

interface SimilarListingsContainerProps {
  listingId: number;
  categoryIds: number[];
}

export async function SimilarListingsContainer({
  listingId,
  categoryIds,
}: SimilarListingsContainerProps) {
  // Resolve the parent(s) of the listing's own categories so we can match
  // siblings (e.g. all "Eat & Drink" subcategories), covering every category
  // the listing has - not just its legacy primary one.
  let relatedCategoryIds: number[] = [];

  const numericCategoryIds = (categoryIds || [])
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numericCategoryIds.length > 0) {
    const { rows: categoryRows } = await query(
      `SELECT id, parent_id FROM categories WHERE id = ANY($1::int[])`,
      [numericCategoryIds],
    );
    const parentIds = new Set<number>(
      categoryRows.map((c) => Number(c.parent_id ?? c.id)),
    );

    if (parentIds.size > 0) {
      // Get all categories under the same parent(s) (siblings + self)
      const { rows: siblingCategories } = await query(
        `SELECT id FROM categories WHERE parent_id = ANY($1::int[])`,
        [[...parentIds]],
      );

      relatedCategoryIds = [
        ...parentIds,
        ...siblingCategories.map((c) => Number(c.id)),
      ];
    }
  }

  const whereClauses: string[] = ["id != $1", "status = 'published'"];
  const queryParams: unknown[] = [listingId];

  if (relatedCategoryIds.length > 0) {
    queryParams.push(relatedCategoryIds);
    whereClauses.push(
      listingCategoriesExistsClause(
        "listings_with_details.id",
        queryParams.length,
      ),
    );
  }

  const { rows: similarListings } = await query(
    `SELECT * FROM listings_with_details
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY display_order DESC, created_at DESC
     LIMIT 4`,
    queryParams,
  );

  if (!similarListings || similarListings.length === 0) {
    return null;
  }

  // Need to fetch images for these listings to display correct thumbnails
  // Similar to how ListingsPage does it
  const similarIds = similarListings.map((l) => l.id as number);

  if (similarIds.length > 0) {
    const { rows: images } = await query(
      `SELECT * FROM listing_images WHERE listing_id = ANY($1) ORDER BY display_order ASC`,
      [similarIds],
    );

    // Attach images to listings
    similarListings.forEach((l) => {
      // Type assertion needed as listing type from view doesn't include images
      (l as typeof l & { images: typeof images }).images = images.filter(
        (img) => img.listing_id === l.id
      );
    });
  }

  return (
    <div className="space-y-6 md:space-y-8 mt-6 md:mt-8">
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Similar <span className="gradient-text-primary">Places</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                More amazing places
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs font-medium bg-primary/5"
          >
            {similarListings.length}
          </Badge>
        </div>
      </div>
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Similar <span className="gradient-text-primary">Places</span>
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              Discover more amazing places
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="px-4 py-2 font-semibold border-2 bg-primary/5"
        >
          {similarListings.length} Places
        </Badge>
      </div>

      <SimilarListingsCarousel
        similarListings={similarListings}
        categoryColorSchemes={categoryColorSchemes}
      />
    </div>
  );
}
