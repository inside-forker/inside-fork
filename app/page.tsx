import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingCategories } from "@/components/landing/LandingCategories";
import { LandingEvents } from "@/components/landing/LandingEvents";
import { LandingBanks } from "@/components/landing/LandingBanks";
import { LandingAreas } from "@/components/landing/LandingAreas";
import { LandingApp } from "@/components/landing/LandingApp";
import { LandingGetListed } from "@/components/landing/LandingGetListed";
import { getLandingAreas, getLandingBanks, getLandingCategories } from "@/lib/homepage/landing";
import { loadEventsList } from "@/lib/events/list";

export const metadata: Metadata = {
  title: "Inside Karachi - Places & Deals in Karachi",
  description:
    "Find places to eat, shop and unwind, and unlock discounts across Karachi.",
};

// Rebuilt every 5 minutes; every section reads cached data.
export const revalidate = 300;

/**
 * The landing page: hero and search, categories, what's on (ink), the bank
 * picker (cream), the area map, the app (ink) and a strip for businesses.
 */
export default async function Home() {
  const [categories, events, banks, areas] = await Promise.all([
    getLandingCategories(),
    loadEventsList().catch((error) => {
      console.error("Landing events failed:", error);
      return null;
    }),
    getLandingBanks(),
    getLandingAreas(),
  ]);
  const upcoming = events?.items.slice(0, 3) ?? [];

  return (
    <div className="bg-background">
      <LandingHero />
      <LandingCategories categories={categories} />
      {events && <LandingEvents events={upcoming} today={events.today} />}
      <LandingBanks data={banks} />
      <LandingAreas areas={areas} />
      <LandingApp events={upcoming} categories={categories} />
      <LandingGetListed />
    </div>
  );
}
