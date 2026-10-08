import type { Metadata } from "next";
import { Suspense } from "react";
import { PremiumHomepageHero } from "@/components/homepage/PremiumHomepageHero";
import { CallToActionSections } from "@/components/homepage/CallToActionSections";
import { FeaturesSection } from "@/components/homepage/FeaturesSection";
import { AppShowcaseSection } from "@/components/homepage/AppShowcaseSection";
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
  title: "Inside Karachi - Places & Deals in Karachi",
  description:
    "Find places to eat, shop and unwind, and unlock discounts across Karachi.",
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

      {/* 1. Explore categories */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContainer />
      </Suspense>

      {/* 2. Bank discounts */}
      <Suspense fallback={null}>
        <BankOffersSection />
      </Suspense>

      {/* 3. Featured listings */}
      <Suspense fallback={<FeaturedListingsSkeleton />}>
        <FeaturedListingsContainer />
      </Suspense>

      {/* Neighbourhood shortcuts, with place counts */}
      <Suspense fallback={null}>
        <AreasSection />
      </Suspense>

      {/* Three short benefit blocks */}
      <FeaturesSection />

      {/* The app: phones, perks, notify me (store badges off until launch) */}
      <AppShowcaseSection />

      {/* Account shortcuts or sign-up, business link */}
      <CallToActionSections />
    </main>
  );
}

// Enable ISR with 5 minute revalidation for homepage
export const revalidate = 300;
