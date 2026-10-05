import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getOptionalSessionUser } from "@/lib/auth/require-session";
import { PremiumListingHero } from "@/components/listing/PremiumListingHero";
import { PremiumGallery } from "@/components/listing/PremiumGallery";
import { ListingFeatures } from "@/components/listing/ListingFeatures";
import { ListingContact } from "@/components/listing/ListingContact";
import { ListingMap } from "@/components/listing/ListingMap";
import { ListingBranches } from "@/components/listing/ListingBranches";
import { ListingPageWrapper } from "@/components/listing/ListingPageWrapper";
import { MenuImagesViewer } from "@/components/listing/MenuImagesViewer";
import { getListingHeroImages } from "@/lib/utils/listing-images";
import { isRestaurantCategory } from "@/lib/utils/category-helpers";
import { getListingCategoryIds } from "@/lib/listings/sync-listing-categories";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PremiumHeading } from "@/components/brand/Typography";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { Suspense } from "react";

/** Public listing shell is cacheable; favorites live in client islands. */
export const revalidate = 300;

// Container Components
import { ReviewsContainer } from "@/components/listing/containers/ReviewsContainer";
import { SimilarListingsContainer } from "@/components/listing/containers/SimilarListingsContainer";
import { MenuContainer } from "@/components/listing/containers/MenuContainer";
import { DealsContainer } from "@/components/listing/containers/DealsContainer";
import { OpeningHoursContainer } from "@/components/listing/containers/OpeningHoursContainer";

// Skeletons
import {
  ReviewsSkeleton,
  SimilarListingsSkeleton,
  MenuSkeleton,
  DealsSkeleton,
  OpeningHoursSkeleton,
} from "@/components/listing/skeletons";

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const { rows: listingRows } = await query(
    `SELECT * FROM listings_with_details WHERE slug = $1 OR slug = $2 LIMIT 1`,
    [slug, decodedSlug],
  );
  const listing = listingRows[0];

  if (!listing || !listing.id) {
    console.error("[listing-page] Failed to fetch listing:", { slug });
    notFound();
  }

  // node-pg returns bigint/numeric columns as strings; normalize here so every
  // downstream consumer (props, API request bodies, zod validation) gets a
  // real number rather than a string that merely satisfies TS's `as number`.
  listing.id = Number(listing.id);
  listing.avg_rating =
    listing.avg_rating !== null && listing.avg_rating !== undefined
      ? Number(listing.avg_rating)
      : null;
  listing.review_count =
    listing.review_count !== null && listing.review_count !== undefined
      ? Number(listing.review_count)
      : 0;

  if (listing.status !== "published") {
    const sessionResult = await getOptionalSessionUser();
    const role = sessionResult?.profile?.role;
    const canPreviewUnpublished = role === "admin" || role === "super_admin";

    if (!canPreviewUnpublished) {
      console.error("[listing-page] Listing not published:", { slug });
      notFound();
    }
  }

  const listingId = listing.id as number;
  const nowIso = new Date().toISOString();

  const [
    imagesResult,
    menuCountResult,
    dealsCountResult,
    hoursCountResult,
    branchesResult,
    _openingHoursResult,
    featuresResult,
    listingCategoryIds,
  ] = await Promise.all([
    query(
      `SELECT * FROM listing_images
       WHERE listing_id = $1
       ORDER BY display_order ASC`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] images query error:", err);
      return { rows: [] };
    }),
    query(
      `SELECT COUNT(*)::integer AS count FROM menu_sections WHERE listing_id = $1`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] menuCount query error:", err);
      return { rows: [{ count: 0 }] };
    }),
    query(
      `SELECT COUNT(*)::integer AS count FROM deals
       WHERE listing_id = $1
         AND is_active = true
         AND (end_date IS NULL OR end_date >= $2)`,
      [listingId, nowIso],
    ).catch((err) => {
      console.error("[listing-page] dealsCount query error:", err);
      return { rows: [{ count: 0 }] };
    }),
    query(
      `SELECT COUNT(*)::integer AS count FROM opening_hours WHERE listing_id = $1`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] hoursCount query error:", err);
      return { rows: [{ count: 0 }] };
    }),
    query(
      `SELECT * FROM listing_branches
       WHERE listing_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] branches query error:", err);
      return { rows: [] };
    }),
    query(
      `SELECT * FROM opening_hours
       WHERE listing_id = $1
       ORDER BY day_of_week ASC`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] openingHours query error:", err);
      return { rows: [] };
    }),
    query(
      `SELECT m.name, m.description, m.icon_emoji
       FROM listing_features lf
       JOIN listing_features_master m ON m.id = lf.feature_id
       WHERE lf.listing_id = $1 AND m.is_active = true`,
      [listingId],
    ).catch((err) => {
      console.error("[listing-page] features query error:", err);
      return { rows: [] };
    }),
    getListingCategoryIds(listingId).catch((err) => {
      console.error("[listing-page] categoryIds query error:", err);
      return [];
    }),
  ]);

  const images = imagesResult?.rows || [];
  const menuCount = Number(menuCountResult?.rows?.[0]?.count ?? 0);
  const dealsCount = Number(dealsCountResult?.rows?.[0]?.count ?? 0);
  const hoursCount = Number(hoursCountResult?.rows?.[0]?.count ?? 0);
  const branches = branchesResult?.rows || [];
  const _openingHours = _openingHoursResult?.rows || [];
  const dbFeatures = (featuresResult?.rows || []).map((f) => ({
    name: String(f.name || ""),
    icon: String(f.icon_emoji || "✨"),
    description: String(f.description || ""),
  }));

  // Filter out menu images from gallery (they have /menu/ in the URL path)
  const galleryImages = (images || []).filter(
    (img) => !String(img.url || "").includes("/menu/"),
  );

  const menuImages = (images || [])
    .filter((img) => String(img.url || "").includes("/menu/"))
    .map((img, index) => ({
      id: img.id as number,
      url: String(img.url || ""),
      alt_text: (img.alt_text as string | null) || "Menu image",
      display_order: index,
    }));

  // Add gallery-only images to listing object
  const listingWithImages = {
    ...listing,
    images: galleryImages,
  };

  const isRestaurant = await isRestaurantCategory(
    listingCategoryIds.length > 0
      ? listingCategoryIds
      : [listing.category_id as number | null],
  );

  // Calculate section availability flags based on actual data
  const hasMenu = isRestaurant && (menuCount ?? 0) > 0;
  const hasDeals = (dealsCount ?? 0) > 0;
  const hasOpeningHours = (hoursCount ?? 0) > 0;
  // Reviews require at least one branch (ReviewsContainer returns null without branches)
  const hasReviews = (branches?.length ?? 0) > 0;

  // Get real images from listing data
  const heroImages = getListingHeroImages(listingWithImages);
  // Pass full image objects to gallery, not just URLs
  const galleryImageObjects = listingWithImages.images || [];

  // Check if menu images exist (for MenuImagesViewer section)
  const hasMenuImages = menuImages.length > 0;

  return (
    <ListingPageWrapper>
      <div className="min-h-screen bg-background">
        {/* Hero section */}
        <PremiumListingHero
          listing={listing}
          images={heroImages}
          withTopMargin={false}
        />

        {/* MainContent */}
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16 lg:gap-20">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-12 md:space-y-16 lg:space-y-20">
              {/* Gallery Section */}
              <PremiumGallery images={galleryImageObjects} title="Photos" />

              {/* Digital Menu Images - Only for Restaurants with actual menu images */}
              {isRestaurant && hasMenuImages && (
                <MenuImagesViewer
                  listingId={listing.id}
                  restaurantName={listing.name || "Restaurant"}
                  initialImages={menuImages}
                />
              )}

              {/* Features & Amenities */}
              <ListingFeatures listing={listing} initialFeatures={dbFeatures} />

              {/* Menu Section - Only for Restaurants */}
              {isRestaurant && (
                <Suspense fallback={<MenuSkeleton />}>
                  <MenuContainer
                    listingId={listing.id}
                    restaurantName={listing.name || "Restaurant"}
                    menuPdfUrl={listing.menu_pdf_url}
                  />
                </Suspense>
              )}

              {/* Branches/Locations Section - Only for MULTIPLE branches */}
              {branches && branches.length > 1 && (
                <ListingBranches
                  branches={branches}
                  listingName={listing.name || "This Listing"}
                />
              )}

              {/* Map & Location - Show when NO branches OR single branch */}
              {(!branches || branches.length <= 1) && (
                <ListingMap listing={listing} />
              )}

              {/* Opening Hours Section */}
              <Suspense fallback={<OpeningHoursSkeleton />}>
                <OpeningHoursContainer listingId={listing.id} />
              </Suspense>

              {/* Deals & Discounts Section */}
              <Suspense fallback={<DealsSkeleton count={2} />}>
                <DealsContainer
                  listingId={listing.id}
                  businessName={listing.name || "Business"}
                />
              </Suspense>

              {/* Reviews Section */}
              <Suspense fallback={<ReviewsSkeleton count={3} />}>
                <ReviewsContainer
                  listingId={listing.id}
                  listingName={listing.name || "this place"}
                />
              </Suspense>

              {/* Similar Listings */}
              <Suspense fallback={<SimilarListingsSkeleton count={4} />}>
                <SimilarListingsContainer
                  listingId={listing.id}
                  categoryIds={
                    listingCategoryIds.length > 0
                      ? listingCategoryIds
                      : listing.category_id
                        ? [listing.category_id as number]
                        : []
                  }
                />
              </Suspense>
            </div>

            {/* Right Column - Sticky Sidebar */}
            <div className="lg:sticky lg:top-20 lg:self-start space-y-8 md:space-y-10 lg:space-y-12">
              {/* Contact Section */}
              <ListingContact listing={listing} branches={branches} />

              {/* Report Incorrect Information */}
              <div className="text-center">
                <ReportIssueButton
                  reportType="listing"
                  itemId={listing.id}
                  itemName={listing.name || ""}
                  itemSlug={listing.slug || ""}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ListingPageWrapper>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ListingPageProps) {
  const { slug } = await params;

  try {
    const { rows } = await query(
      `SELECT name, description FROM listings_with_details
       WHERE slug = $1
       LIMIT 1`,
      [slug],
    );
    const listing = rows[0];

    if (!listing) {
      return { title: "Listing Not Found" };
    }

    return {
      title: `${listing.name} - Inside Karachi`,
      description:
        (listing.description as string | null)?.substring(0, 160) ||
        `Discover ${listing.name} on Inside Karachi`,
    };
  } catch {
    return { title: "Inside Karachi" };
  }
}

// Favorites / session are client-side. Unpublished preview still calls
// getOptionalSessionUser() (cookies) for that request only — published pages
// stay on the revalidate window above.
