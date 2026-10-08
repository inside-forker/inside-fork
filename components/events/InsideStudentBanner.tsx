"use client";

import { ChevronRight } from "lucide-react";
import {
  describeParchiOffer,
  type ParchiOffer,
} from "@/lib/parchi/discount";

/**
 * Inside Karachi student promo on Prismfest for logged-in visitors who did
 * NOT arrive from the Parchi app. Parchi-channel visitors see ParchiEventBanner
 * instead and never get this auto slash.
 */
export function InsideStudentBanner({ offer }: { offer: ParchiOffer }) {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })
      }
      className="flex w-full items-center gap-4 rounded-2xl border border-primary/25 bg-primary/10 px-5 py-4 text-left transition-opacity hover:opacity-95 active:opacity-90"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
        IK
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-foreground sm:text-lg">
          Students: {describeParchiOffer(offer)}
        </p>
        <p className="text-sm text-muted-foreground">
          Your Inside Karachi student price is already applied
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
