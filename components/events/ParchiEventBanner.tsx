"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import {
  describeParchiOffer,
  PARCHI_BLUE,
  PARCHI_YELLOW,
  type ParchiOffer,
} from "@/lib/parchi/discount";
import { captureParchiArrivalFromUrl } from "@/lib/parchi/prefill";

/**
 * "Students: 20% off with Parchi" — only shown for Parchi-app arrivals.
 * Tapping it scrolls to the tickets; the Parchi ID + approval step happens at
 * checkout. Also captures `?ref=parchi_app` / `?parchiId=` for channel + prefill.
 */
export function ParchiEventBanner({ offer }: { offer: ParchiOffer }) {
  useEffect(() => {
    captureParchiArrivalFromUrl();
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
