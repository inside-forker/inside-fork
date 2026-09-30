import type { Metadata } from "next";
import { Suspense } from "react";
import { PremiumHomepageHero } from "@/components/homepage/PremiumHomepageHero";
import { CallToActionSections } from "@/components/homepage/CallToActionSections";
import { PlatformStatsStrip } from "@/components/homepage/PlatformStatsStrip";
import { FeaturesSection } from "@/components/homepage/FeaturesSection";
import { AppComingSoonSection } from "@/components/homepage/AppComingSoonSection";
import { BankOffersSection } from "@/components/homepage/BankOffersSection";

// Containers
import { CategoriesContainer } from "@/components/homepage/containers/CategoriesContainer";
import { FeaturedListingsContainer } from "@/components/homepage/containers/FeaturedListingsContainer";
import { TrendingEventsContainer } from "@/components/homepage/containers/TrendingEventsContainer";

// Skeletons
import {
  CategoriesSkeleton,
  FeaturedListingsSkeleton,
  EventsSkeleton,
} from "@/components/listing/skeletons";

export const metadata: Metadata = {
  title: "Inside Karachi - Places, Events & Deals in Karachi",
  description:
    "Find places to eat, shop and unwind, book tickets to events, and unlock deals across Karachi.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Homepage hero section - renders immediately */}
      <PremiumHomepageHero />

      {/* Real platform counts (hidden when there's nothing meaningful to show) */}
      <Suspense fallback={null}>
        <PlatformStatsStrip />
      </Suspense>

      {/* Trending Events Section */}
      <Suspense fallback={<EventsSkeleton />}>
        <TrendingEventsContainer />
      </Suspense>

      {/* Featured Categories Section */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContainer />
      </Suspense>

      {/* Everything the platform does */}
      <FeaturesSection />

      {/* Featured Listings Section */}
      <Suspense fallback={<FeaturedListingsSkeleton />}>
        <FeaturedListingsContainer />
      </Suspense>

      {/* Every supported bank, with live offer counts */}
      <Suspense fallback={null}>
        <BankOffersSection />
      </Suspense>

      {/* Mobile app teaser - store badges disabled until launch */}
      <AppComingSoonSection />

      {/* Call-to-Action Sections - Static Content */}
      <CallToActionSections />
    </main>
  );
}

// Enable ISR with 5 minute revalidation for homepage
export const revalidate = 300;
