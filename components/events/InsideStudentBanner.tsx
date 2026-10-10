"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import {
  describeParchiOffer,
  type ParchiOffer,
} from "@/lib/parchi/discount";

const scrollToTickets = () =>
  document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" });

/** The big stub number: "20%" / "Rs 500". */
function headlineAmount(offer: ParchiOffer): string {
  return offer.discount_type === "percentage"
    ? `${offer.discount_value}%`
    : `Rs ${offer.discount_value.toLocaleString()}`;
}

/**
 * Inside Karachi's own discount on Prismfest (plain "20% off", not a student
 * offer - only Parchi is branded as the student discount) for visitors who did
 * NOT arrive from the Parchi app. Parchi-channel visitors see ParchiEventBanner
 * instead and never get this auto slash.
 *
 * Drawn as a ticket: the amount on the stub, a dashed perforation, then the
 * Inside Karachi side. Tapping scrolls smoothly to tickets.
 */
export function InsideStudentBanner({
  offer,
  signedIn,
}: {
  offer: ParchiOffer;
  signedIn?: boolean;
  eventSlug?: string;
}) {
  const amount = headlineAmount(offer);
  const cap =
    offer.discount_type === "percentage" && offer.max_discount_amount != null
      ? `Up to Rs ${offer.max_discount_amount.toLocaleString()} off`
      : null;

  return (
    <motion.button
      type="button"
      onClick={scrollToTickets}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      aria-label={`${describeParchiOffer(offer)} on Inside Karachi`}
      className="group relative flex w-full items-stretch overflow-hidden rounded-2xl bg-cream text-left shadow-lg shadow-ink/10 ring-1 ring-ink/10"
    >
      {/* Shine sweep */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        initial={{ x: "0%" }}
        animate={{ x: "450%" }}
        transition={{
          duration: 1.4,
          ease: "easeInOut",
          delay: 0.6,
          repeat: Infinity,
          repeatDelay: 4,
        }}
      />

      {/* Stub: the amount */}
      <div className="relative flex shrink-0 flex-col items-center justify-center px-5 py-5 sm:px-7">
        <span className="text-4xl font-black leading-none tracking-tight text-primary sm:text-5xl">
          {amount}
        </span>
        <span className="mt-1 text-xs font-black uppercase tracking-[0.35em] text-ink sm:text-sm">
          Off
        </span>
      </div>

      {/* Perforation */}
      <div className="relative w-px shrink-0">
        <div className="absolute inset-y-3 left-0 border-l-2 border-dashed border-ink/20" />
      </div>

      {/* Inside Karachi side */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-2 py-4 pl-5 pr-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pl-6 sm:pr-5">
        <div className="min-w-0 space-y-1.5">
          <Image
            src="/assets/logo-black.png"
            alt="Inside Karachi"
            width={104}
            height={28}
            className="h-auto w-[88px] sm:w-[104px]"
          />
          <p className="text-sm font-semibold leading-snug text-ink sm:text-base">
            {signedIn
              ? `Inside Karachi got you ${amount} off`
              : "Free with an Inside Karachi account"}
          </p>
          {cap ? <p className="text-xs text-ink/60">{cap}</p> : null}
        </div>

        {signedIn ? (
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white sm:text-sm">
            <Check className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
            Applied
          </span>
        ) : null}
      </div>
    </motion.button>
  );
}
