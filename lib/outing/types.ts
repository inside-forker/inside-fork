import type { ListingCardDTO } from "@/lib/mobile/mappers";
import type { OutingSlot, OutingTemplate } from "@/lib/outing/templates";
import type { OutingIntent } from "@/lib/outing/intent";

export type OutingPlanMode = "algorithm" | "ai";

export type OutingPlanStopDTO = {
  listing: ListingCardDTO;
  reason: string;
  /** Template role this stop filled (dinner, enjoy, place, …). */
  role?: string;
};

export type OutingPlanResponse = {
  mode: OutingPlanMode;
  /** What the engine understood from the prompt (shown in the demo UI). */
  interpretation: string;
  stops: OutingPlanStopDTO[];
  /**
   * When a budget was requested but few/no listings publish prices —
   * honest UI copy so we never pretend budget was hard-applied everywhere.
   */
  budgetNote?: string | null;
  /** Echo of structured intent for clients / eval. */
  intent?: {
    mode: OutingIntent["mode"];
    primaryNeed: OutingIntent["primaryNeed"];
    excludeFood: boolean;
    budgetMaxPkr: number | null;
    partySize: number | null;
  };
};

/** Resolved vibe + slots after template / intent matching. */
export type MatchedPlanContext = {
  normalized: string;
  area: string | null;
  template: OutingTemplate;
  interpretation: string;
  slots: OutingSlot[];
  intent: OutingIntent;
};
