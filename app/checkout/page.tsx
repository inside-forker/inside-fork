import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Checkout - Inside Karachi",
  description: "Complete your booking for tickets, events, and experiences securely.",
  robots: {
    index: false, // Don't index checkout pages
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
      </div>

      {/* One column, like the app's checkout. */}
      <div className="relative z-10 mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:px-6 md:pb-16">
        <CheckoutClient />
      </div>
    </div>
  );
}
