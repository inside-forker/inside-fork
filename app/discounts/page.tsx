import type { Metadata } from "next";
import { getSessionFromCookies } from "@/lib/auth/session";
import { loadDiscountBanks, loadDiscounts } from "@/lib/discounts/catalog";
import { parseDiscountView } from "@/lib/discounts/types";
import { DiscountsBrowser } from "@/components/discounts/DiscountsBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discounts in Karachi - Inside Karachi",
  description:
    "Bank and wallet discounts at restaurants, shops and places across Karachi. Add your cards to see what they unlock.",
};

interface DiscountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /discounts: the card wallet in a black band, then three sections that each
 * look different (half off or more on black cards, 40% off on cream cards,
 * the rest as rows). Signed-in readers with saved cards land on For you.
 */
export default async function DiscountsPage({ searchParams }: DiscountsPageProps) {
  const [params, session] = await Promise.all([searchParams, getSessionFromCookies()]);
  const view = parseDiscountView(params);

  try {
    const [data, banks] = await Promise.all([
      loadDiscounts(view, { userId: session?.userId ?? null }),
      loadDiscountBanks(),
    ]);
    return (
      <div className="min-h-screen bg-background">
        <DiscountsBrowser
          initialData={data}
          initialView={view}
          banks={banks}
          openAddCard={params.add === "1"}
        />
      </div>
    );
  } catch (error) {
    console.error("[discounts] page load failed:", error instanceof Error ? error.message : error);
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-24 text-center lg:px-8">
        <h1 className="text-[22px] font-bold leading-7 tracking-[-0.02em]">Discounts didn&apos;t load</h1>
        <p className="mt-2 text-small text-muted-foreground">Refresh the page to try again.</p>
      </div>
    );
  }
}
