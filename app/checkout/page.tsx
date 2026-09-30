import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
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

      <div className="container max-w-7xl pt-12 pb-20 relative z-10">
        {/* Header Section */}
        <CheckoutHeader />

        {/* Main Content */}
        <CheckoutClient />
      </div>
    </div>
  );
}
