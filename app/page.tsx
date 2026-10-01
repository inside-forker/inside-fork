import type { Metadata } from "next";
import { Suspense } from "react";
import { PremiumHomepageHero } from "@/components/homepage/PremiumHomepageHero";
import { CallToActionSections } from "@/components/homepage/CallToActionSections";
import { FeaturesSection } from "@/components/homepage/FeaturesSection";
import { BankOffersSection } from "@/components/homepage/BankOffersSection";
import { AreasSection } from "@/components/homepage/AreasSection";

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
      {/* Hero, search and browsing shortcuts - renders immediately */}
      <PremiumHomepageHero />

      {/* Upcoming events (a single event gets the featured layout) */}
      <Suspense fallback={<EventsSkeleton />}>
        <TrendingEventsContainer />
      </Suspense>

      {/* Curated places worth exploring */}
      <Suspense fallback={<FeaturedListingsSkeleton />}>
        <FeaturedListingsContainer />
      </Suspense>

      {/* Bank discounts: every supported bank */}
      <Suspense fallback={null}>
        <BankOffersSection />
      </Suspense>

      {/* Categories */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContainer />
      </Suspense>

      {/* Neighbourhood shortcuts, with place counts */}
      <Suspense fallback={null}>
        <AreasSection />
      </Suspense>

      {/* Three short benefit blocks */}
      <FeaturesSection />

      {/* Account shortcuts or sign-up, app notification, business link */}
      <CallToActionSections />
    </main>
  );
}

// Enable ISR with 5 minute revalidation for homepage
export const revalidate = 300;
