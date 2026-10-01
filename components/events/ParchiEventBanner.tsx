"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { describeParchiOffer, type ParchiOffer } from "@/lib/parchi/discount";
import { rememberParchiId } from "@/lib/parchi/prefill";

// Parchi's own brand colours (sampled from their artwork), so the strip reads
// as a Parchi offer at a glance.
const PARCHI_BLUE = "#0069DB";
const PARCHI_YELLOW = "#FDF12A";

/**
 * "Students: 20% off with Parchi" on an event that has a Parchi discount.
 * Tapping it scrolls to the tickets; the Parchi ID + approval step happens at
 * checkout. Also remembers `?parchiId=` from the Parchi app's link so checkout
 * can pre-fill it.
 */
export function ParchiEventBanner({ offer }: { offer: ParchiOffer }) {
  useEffect(() => {
    rememberParchiId(new URLSearchParams(window.location.search).get("parchiId"));
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })
      }
      className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-opacity hover:opacity-95 active:opacity-90"
      style={{ backgroundColor: PARCHI_BLUE }}
    >
      <Image
        src="/partners/parchi-wordmark.png"
        alt="Parchi"
        width={88}
        height={23}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-base font-bold sm:text-lg"
          style={{ color: PARCHI_YELLOW }}
        >
          Students: {describeParchiOffer(offer)}
        </p>
        <p className="text-sm text-white/85">Verify your Parchi ID at checkout</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/80" />
    </button>
  );
}
