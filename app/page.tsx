import { Suspense } from "react";
import { PremiumHomepageHero } from "@/components/homepage/PremiumHomepageHero";
import { CallToActionSections } from "@/components/homepage/CallToActionSections";

// Containers
import { CategoriesContainer } from "@/components/homepage/containers/CategoriesContainer";
import { FeaturedListingsContainer } from "@/components/homepage/containers/FeaturedListingsContainer";
import { RecentPostsContainer } from "@/components/homepage/containers/RecentPostsContainer";
import { TrendingEventsContainer } from "@/components/homepage/containers/TrendingEventsContainer";
import { StatsContainer } from "@/components/homepage/containers/StatsContainer";

// Skeletons
import {
  CategoriesSkeleton,
  FeaturedListingsSkeleton,
  PostsSkeleton,
  EventsSkeleton,
} from "@/components/listing/skeletons";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Homepage hero section - renders immediately */}
      <PremiumHomepageHero />

      {/* Featured Categories Section */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContainer />
      </Suspense>

      {/* Featured Listings Section */}
      <Suspense fallback={<FeaturedListingsSkeleton />}>
        <FeaturedListingsContainer />
      </Suspense>

      {/* Trending Events Section */}
      <Suspense fallback={<EventsSkeleton />}>
        <TrendingEventsContainer />
      </Suspense>

      {/* Recent Posts/Guides Section */}
      <Suspense fallback={<PostsSkeleton />}>
        <RecentPostsContainer />
      </Suspense>

      {/* Statistics & Social Proof Section */}
      <Suspense fallback={<div className="h-64" />}>
        <StatsContainer />
      </Suspense>

      {/* Call-to-Action Sections - Static Content */}
      <CallToActionSections />
    </main>
  );
}

// Enable ISR with 5 minute revalidation for homepage
export const revalidate = 300;
