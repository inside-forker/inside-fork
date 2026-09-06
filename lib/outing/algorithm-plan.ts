import {
  byRatingDesc,
  fetchListingCards,
  type OutingListingCard,
} from "@/lib/outing/fetch-listings";
import {
  extractOutingIntent,
  type OutingIntent,
} from "@/lib/outing/intent";
import {
  DATE_DEMOTE_SLUGS,
  diversityBucketCap,
  diversityBucketForFamily,
  familyForCategoryName,
  familyForSlug,
  FOOD_FAMILIES,
  GYM_EXCLUDED_NEEDS,
  isGymLikeListing,
  TOURISM_EXCLUDED_NEEDS,
  type OutingDiversityBucket,
} from "@/lib/outing/category-families";
import {
  MAX_STOPS,
  MIN_STOPS,
  matchOutingTemplate,
  type OutingSlot,
} from "@/lib/outing/templates";
import type {
  MatchedPlanContext,
  OutingPlanResponse,
  OutingPlanStopDTO,
} from "@/lib/outing/types";

const PLACES_LIMIT = 5;

/** Resolve prompt into shared context for algorithm + AI. */
export function resolvePlanContext(prompt: string): MatchedPlanContext {
  const intent = extractOutingIntent(prompt);
  const matched = matchOutingTemplate(prompt);

  // Intent-first: hangout/date/activity override food-heavy night templates.
  const useIntentSlots =
    intent.mode === "places" ||
    intent.primaryNeed === "hangout" ||
    intent.primaryNeed === "friends" ||
    intent.primaryNeed === "date" ||
    intent.primaryNeed === "activity" ||
    intent.primaryNeed === "food";

  if (useIntentSlots && intent.mode === "places") {
    const slots: OutingSlot[] = intent.categorySlugs.slice(0, 3).map((slug, i) => ({
      role: i === 0 ? "place" : `place_${i}`,
      label:
        intent.primaryNeed === "date"
          ? "Date spot"
          : intent.primaryNeed === "friends"
            ? "Guest pick"
            : "Place",
      categorySlug: slug,
      fallbackSlugs: intent.categorySlugs.filter((s) => s !== slug).slice(0, 3),
    }));
    return {
      normalized: matched.normalized,
      area: intent.area,
      template: {
        vibeKey: intent.primaryNeed,
        title: intent.interpretation,
        arcBlurb: intent.interpretation,
        phrases: [],
        slots,
      },
      interpretation: intent.interpretation,
      slots,
      intent,
    };
  }

  return {
    normalized: matched.normalized,
    area: intent.area ?? matched.area,
    template: matched.template,
    interpretation: intent.interpretation || matched.interpretation,
    slots: matched.template.slots.slice(0, MAX_STOPS),
    intent,
  };
}

function passesBudget(
  listing: OutingListingCard,
  intent: OutingIntent,
): boolean {
  if (intent.budgetMaxPkr == null) return true;
  const party = intent.partySize ?? 2;
  const min = listing.min_price_per_person;
  if (min == null) return true; // soft: keep unpriced
  return min * party <= intent.budgetMaxPkr;
}

function passesCapacity(
  listing: OutingListingCard,
  intent: OutingIntent,
): boolean {
  if (intent.partySize == null) return true;
  const max = listing.max_guest_capacity;
  const min = listing.min_guest_capacity;
  if (max != null && intent.partySize > max) return false;
  if (min != null && intent.partySize < min) return false;
  return true;
}

function isFoodListing(listing: OutingListingCard): boolean {
  const fam =
    familyForSlug(listing.category_slug) !== "other"
      ? familyForSlug(listing.category_slug)
      : familyForCategoryName(listing.category_name);
  return FOOD_FAMILIES.includes(fam);
}

function matchesActivityKeyword(
  listing: OutingListingCard,
  keywords: string[],
): boolean {
  if (!keywords.length) return true;
  const blob = `${listing.name ?? ""} ${listing.description ?? ""} ${listing.category_name ?? ""}`.toLowerCase();
  return keywords.some((k) => blob.includes(k.toLowerCase()));
}

function scoreListing(listing: OutingListingCard, intent: OutingIntent): number {
  let score = (listing.avg_rating ?? 0) * 10;
  if (intent.activityKeywords.length) {
    if (matchesActivityKeyword(listing, intent.activityKeywords)) score += 50;
    else score -= 20;
  }
  if (intent.primaryNeed === "date") {
    const slug = listing.category_slug ?? "";
    if (slug === "fine-dining-buffets") score += 25;
    if (slug === "live-music-comedy-venues") score += 20;
    if (slug === "cafes-coworking-spots") score += 12;
    if (DATE_DEMOTE_SLUGS.has(slug)) score -= 30;
    if (familyForCategoryName(listing.category_name) === "fast_food") {
      score -= 40;
    }
    if (familyForCategoryName(listing.category_name) === "bakeries") {
      score -= 25;
    }
    const blob = `${listing.name ?? ""} ${listing.description ?? ""}`.toLowerCase();
    if (
      /kabab|kebab|biryani|burger|pizza|broast|karahi|nihari|shawarma|bbq|tikka/.test(
        blob,
      )
    ) {
      score -= 35;
    }
    if ((listing.avg_rating ?? 0) >= 4.2) score += 8;
  }
  if (intent.budgetMaxPkr != null && listing.min_price_per_person != null) {
    score += 15; // prefer priced-in-budget when present
  }
  if (
    intent.partySize != null &&
    listing.max_guest_capacity != null &&
    listing.max_guest_capacity >= intent.partySize
  ) {
    score += 5;
  }
  return score;
}

/** Published + excludeFood + budget/capacity hard filters. Exported for eval. */
export function filterCandidates(
  listings: OutingListingCard[],
  intent: OutingIntent,
): OutingListingCard[] {
  return listings.filter((l) => {
    if (l.status && l.status !== "published") return false;
    if (intent.excludeFood && isFoodListing(l)) return false;
    const fam =
      familyForSlug(l.category_slug) !== "other"
        ? familyForSlug(l.category_slug)
        : familyForCategoryName(l.category_name);
    if (intent.primaryNeed === "date" && (fam === "fast_food" || fam === "bakeries")) {
      return false;
    }
    if (TOURISM_EXCLUDED_NEEDS.has(intent.primaryNeed) && fam === "tourism") {
      return false;
    }
    if (intent.primaryNeed === "friends" && fam === "tourism") {
      return false;
    }
    // Always drop travel agencies for friends (explicit) even if family mis-tagged
    if (
      (intent.primaryNeed === "friends" || TOURISM_EXCLUDED_NEEDS.has(intent.primaryNeed)) &&
      (l.category_slug === "travel-tourism" ||
        /travel|tourism|tour/i.test(l.category_name ?? ""))
    ) {
      return false;
    }
    // Gyms are not hangouts — Fitnest etc. often sit under entertainment by mistake
    if (GYM_EXCLUDED_NEEDS.has(intent.primaryNeed) && isGymLikeListing(l)) {
      return false;
    }
    if (!passesBudget(l, intent)) return false;
    if (!passesCapacity(l, intent)) return false;
    return true;
  });
}

function buildReason(
  listing: OutingListingCard,
  intent: OutingIntent,
  roleLabel: string,
): string {
  const bits: string[] = [];
  if (intent.primaryNeed === "hangout") {
    bits.push("Good hangout vibe");
  } else if (intent.primaryNeed === "friends") {
    bits.push("Great for out-of-town guests");
  } else if (intent.primaryNeed === "date") {
    bits.push("Fits a dressier date");
  } else if (intent.activityKeywords.length) {
    bits.push(`Matches ${intent.activityKeywords[0]}`);
  } else {
    bits.push(`${roleLabel} · top-rated fit`);
  }
  if (intent.timePreference === "night") bits.push("night-friendly");
  const party = intent.partySize;
  if (party != null && listing.max_guest_capacity != null) {
    bits.push(`fits ~${party}`);
  }
  if (
    listing.min_price_per_person != null ||
    listing.max_price_per_person != null
  ) {
    const lo = listing.min_price_per_person;
    const hi = listing.max_price_per_person;
    if (lo != null && hi != null && lo !== hi) {
      bits.push(`~PKR ${lo}–${hi} pp`);
    } else if (lo != null) {
      bits.push(`from ~PKR ${lo} pp`);
    }
  }
  return bits.join(" · ");
}

function budgetNoteFor(
  intent: OutingIntent,
  stops: OutingListingCard[],
): string | null {
  if (intent.budgetMaxPkr == null) return null;
  const priced = stops.filter((s) => s.min_price_per_person != null);
  if (priced.length === 0) {
    return "Few places publish prices — showing best fits for your vibe.";
  }
  if (priced.length < stops.length) {
    return "Few places publish prices — prioritizing in-budget listings where known.";
  }
  return null;
}

async function fetchPoolForIntent(
  intent: OutingIntent,
  perSlug = 12,
): Promise<OutingListingCard[]> {
  const byId = new Map<number, OutingListingCard>();
  const searchTerms = [
    intent.area,
    ...intent.activityKeywords.slice(0, 2),
  ].filter(Boolean) as string[];

  for (const slug of intent.categorySlugs) {
    // Category-only
    const byCat = await fetchListingCards({
      categorySlug: slug,
      search: intent.area,
      limit: perSlug,
    });
    for (const l of byCat) {
      if (!byId.has(l.id)) byId.set(l.id, l);
    }
    // Keyword search within category (bowling etc.)
    for (const term of intent.activityKeywords.slice(0, 2)) {
      const byKw = await fetchListingCards({
        categorySlug: slug,
        search: term,
        limit: perSlug,
      });
      for (const l of byKw) {
        if (!byId.has(l.id)) byId.set(l.id, l);
      }
    }
  }

  // City-wide keyword hunt when activity-specific
  if (intent.activityKeywords.length) {
    for (const term of intent.activityKeywords.slice(0, 2)) {
      const broad = await fetchListingCards({
        search: term,
        limit: 15,
      });
      for (const l of broad) {
        if (!byId.has(l.id)) byId.set(l.id, l);
      }
    }
  }

  // Area-only fallback if still empty
  if (byId.size === 0 && searchTerms.length) {
    const loose = await fetchListingCards({
      search: searchTerms[0],
      limit: 15,
    });
    for (const l of loose) {
      if (!byId.has(l.id)) byId.set(l.id, l);
    }
  }

  return [...byId.values()];
}

/**
 * Fetch the best unused listing for a slot (primary category, then fallbacks).
 */
export async function pickForSlot(
  slot: OutingSlot,
  area: string | null,
  used: Set<number>,
  intent?: OutingIntent,
): Promise<OutingListingCard | null> {
  const slugs = [slot.categorySlug, ...(slot.fallbackSlugs ?? [])];
  for (const slug of slugs) {
    const listings = await fetchListingCards({
      categorySlug: slug,
      search: area,
      limit: 12,
    });
    let pool = [...listings].sort(byRatingDesc);
    if (intent) {
      pool = filterCandidates(pool, intent).sort(
        (a, b) => scoreListing(b, intent) - scoreListing(a, intent),
      );
    }
    const pick = pool.find((l) => !used.has(l.id));
    if (pick) return pick;
  }
  return null;
}

function listingFamily(listing: OutingListingCard) {
  return familyForSlug(listing.category_slug) !== "other"
    ? familyForSlug(listing.category_slug)
    : familyForCategoryName(listing.category_name);
}

function listingBucket(listing: OutingListingCard): OutingDiversityBucket {
  return diversityBucketForFamily(listingFamily(listing));
}

/** Track how many stops we've taken per diversity bucket. */
function canAddBucket(
  counts: Record<OutingDiversityBucket, number>,
  bucket: OutingDiversityBucket,
): boolean {
  return counts[bucket] < diversityBucketCap(bucket);
}

function bumpBucket(
  counts: Record<OutingDiversityBucket, number>,
  bucket: OutingDiversityBucket,
) {
  counts[bucket] += 1;
}

function emptyBucketCounts(): Record<OutingDiversityBucket, number> {
  return { meal: 0, cafe: 0, sweet: 0, hangout: 0, other: 0 };
}

function selectPlaces(
  filtered: OutingListingCard[],
  intent: OutingIntent,
): OutingListingCard[] {
  // Explicit food asks ("burger places", biryani, …) may return many restaurants.
  if (intent.primaryNeed === "food") {
    return filtered.slice(0, PLACES_LIMIT);
  }

  // Mixed vibes: aim for 1 meal + 1 cafe + hangout (not a restaurant stack).
  const picks: OutingListingCard[] = [];
  const pickedIds = new Set<number>();
  const counts = emptyBucketCounts();

  const tryAdd = (listing: OutingListingCard) => {
    if (picks.length >= PLACES_LIMIT || pickedIds.has(listing.id)) return;
    const bucket = listingBucket(listing);
    if (!canAddBucket(counts, bucket)) return;
    bumpBucket(counts, bucket);
    pickedIds.add(listing.id);
    picks.push(listing);
  };

  // Pass 1 — seed one of each useful bucket (best-ranked already in `filtered`)
  const seedOrder: OutingDiversityBucket[] = [
    "meal",
    "cafe",
    "hangout",
    "sweet",
    "other",
  ];
  for (const bucket of seedOrder) {
    const hit = filtered.find((l) => listingBucket(l) === bucket);
    if (hit) tryAdd(hit);
  }

  // Pass 2 — fill remaining slots by score, still respecting caps
  for (const listing of filtered) {
    tryAdd(listing);
  }
  return picks;
}

async function buildPlacesPlan(
  intent: OutingIntent,
  planMode: "algorithm" | "ai",
): Promise<OutingPlanResponse> {
  const raw = await fetchPoolForIntent(intent);
  let filtered = filterCandidates(raw, intent);

  // Prefer keyword hits first for activities — never pad with unrelated places
  if (intent.activityKeywords.length) {
    filtered = filtered.filter((l) =>
      matchesActivityKeyword(l, intent.activityKeywords),
    );
  }

  filtered.sort(
    (a, b) => scoreListing(b, intent) - scoreListing(a, intent),
  );

  const picks = selectPlaces(filtered, intent);
  const stops: OutingPlanStopDTO[] = picks.map((listing) => ({
    listing,
    role: "place",
    reason: buildReason(listing, intent, "Place"),
  }));

  let interpretation = intent.interpretation;
  if (intent.activityKeywords.length && picks.length === 0) {
    interpretation = `No published ${intent.activityKeywords[0]} venues found yet`;
  }

  return {
    mode: planMode,
    interpretation,
    stops,
    budgetNote: budgetNoteFor(intent, picks),
    intent: {
      mode: intent.mode,
      primaryNeed: intent.primaryNeed,
      excludeFood: intent.excludeFood,
      budgetMaxPkr: intent.budgetMaxPkr,
      partySize: intent.partySize,
    },
  };
}

async function buildArcPlan(
  intent: OutingIntent,
  ctx: MatchedPlanContext,
  planMode: "algorithm" | "ai",
): Promise<OutingPlanResponse> {
  const stops: OutingPlanStopDTO[] = [];
  const used = new Set<number>();
  const allowManyFood = intent.primaryNeed === "food";
  const counts = emptyBucketCounts();

  for (const slot of ctx.slots) {
    if (stops.length >= MAX_STOPS) break;
    if (intent.excludeFood && FOOD_FAMILIES.includes(familyForSlug(slot.categorySlug))) {
      continue;
    }
    const slotBucket = diversityBucketForFamily(familyForSlug(slot.categorySlug));
    if (!allowManyFood && !canAddBucket(counts, slotBucket)) {
      continue;
    }
    const listing = await pickForSlot(slot, ctx.area, used, intent);
    if (!listing) continue;
    const bucket = listingBucket(listing);
    if (!allowManyFood && !canAddBucket(counts, bucket)) {
      continue;
    }
    used.add(listing.id);
    bumpBucket(counts, bucket);
    stops.push({
      listing,
      role: slot.role,
      reason: buildReason(listing, intent, slot.label),
    });
  }

  // Pad with non-meal diversity when short (never a second restaurant)
  if (stops.length < MIN_STOPS && !intent.excludeFood) {
    const canPadMeal = allowManyFood || canAddBucket(counts, "meal");
    if (canPadMeal) {
      const extra = await fetchListingCards({
        categorySlug: "restaurants-cafes",
        search: ctx.area,
        limit: 12,
      });
      for (const listing of filterCandidates([...extra].sort(byRatingDesc), intent)) {
        if (used.has(listing.id)) continue;
        const bucket = listingBucket(listing);
        if (!allowManyFood && !canAddBucket(counts, bucket)) continue;
        used.add(listing.id);
        bumpBucket(counts, bucket);
        stops.push({
          listing,
          role: "extra",
          reason: "Extra stop · top-rated restaurant",
        });
        break;
      }
    }
  } else if (stops.length < MIN_STOPS && intent.excludeFood) {
    const extra = await fetchPoolForIntent({
      ...intent,
      categorySlugs: intent.categorySlugs.length
        ? intent.categorySlugs
        : [
            "entertainment-recreation",
            "gaming-lounges-arcades",
            "parks-outdoor-spaces",
          ],
    });
    for (const listing of filterCandidates(extra, intent).sort(
      (a, b) => scoreListing(b, intent) - scoreListing(a, intent),
    )) {
      if (used.has(listing.id)) continue;
      if (isFoodListing(listing)) continue;
      const bucket = listingBucket(listing);
      if (!canAddBucket(counts, bucket)) continue;
      used.add(listing.id);
      bumpBucket(counts, bucket);
      stops.push({
        listing,
        role: "place",
        reason: buildReason(listing, intent, "Place"),
      });
      if (stops.length >= MIN_STOPS) break;
    }
  }

  const listingStops = stops.map((s) => s.listing as OutingListingCard);

  return {
    mode: planMode,
    interpretation: ctx.interpretation,
    stops: stops.slice(0, MAX_STOPS),
    budgetNote: budgetNoteFor(intent, listingStops),
    intent: {
      mode: intent.mode,
      primaryNeed: intent.primaryNeed,
      excludeFood: intent.excludeFood,
      budgetMaxPkr: intent.budgetMaxPkr,
      partySize: intent.partySize,
    },
  };
}

/**
 * Deterministic outing plan: intent → places list or on-intent arc.
 */
export async function buildAlgorithmOutingPlan(
  prompt: string,
): Promise<OutingPlanResponse> {
  const ctx = resolvePlanContext(prompt);
  const { intent } = ctx;

  if (intent.mode === "places") {
    return buildPlacesPlan(intent, "algorithm");
  }
  return buildArcPlan(intent, ctx, "algorithm");
}

/**
 * Balanced candidate pool for AI: intent-filtered published listings.
 */
export async function buildCandidatePool(
  prompt: string,
  perSlot = 9,
): Promise<{
  ctx: MatchedPlanContext;
  candidates: OutingListingCard[];
  byRole: Map<string, OutingListingCard[]>;
}> {
  const ctx = resolvePlanContext(prompt);
  const { intent } = ctx;
  const byId = new Map<number, OutingListingCard>();
  const byRole = new Map<string, OutingListingCard[]>();

  if (intent.mode === "places") {
    const pool = filterCandidates(await fetchPoolForIntent(intent, perSlot), intent);
    pool.sort((a, b) => scoreListing(b, intent) - scoreListing(a, intent));
    for (const l of pool) byId.set(l.id, l);
    byRole.set("place", pool.slice(0, perSlot * 2));
  } else {
    for (const slot of ctx.slots) {
      if (
        intent.excludeFood &&
        FOOD_FAMILIES.includes(familyForSlug(slot.categorySlug))
      ) {
        byRole.set(slot.role, []);
        continue;
      }
      const roleList: OutingListingCard[] = [];
      const slugs = [slot.categorySlug, ...(slot.fallbackSlugs ?? [])];
      for (const slug of slugs) {
        if (roleList.length >= perSlot) break;
        const listings = await fetchListingCards({
          categorySlug: slug,
          search: ctx.area,
          limit: perSlot,
        });
        for (const l of filterCandidates(
          [...listings].sort(byRatingDesc),
          intent,
        )) {
          if (roleList.length >= perSlot) break;
          if (!byId.has(l.id)) byId.set(l.id, l);
          if (!roleList.some((x) => x.id === l.id)) roleList.push(l);
        }
      }
      byRole.set(slot.role, roleList);
    }

    // Soft floor only when food allowed
    if (byId.size < 8 && !intent.excludeFood) {
      const extra = await fetchListingCards({
        categorySlug: "restaurants-cafes",
        search: ctx.area,
        limit: 12,
      });
      for (const l of filterCandidates(extra, intent)) {
        if (!byId.has(l.id)) byId.set(l.id, l);
      }
    }
  }

  const candidates = [...byId.values()].sort(
    (a, b) => scoreListing(b, intent) - scoreListing(a, intent),
  );
  return { ctx, candidates, byRole };
}

/** @deprecated — use resolvePlanContext / extractOutingIntent. */
export function extractPromptSignals(prompt: string) {
  const ctx = resolvePlanContext(prompt);
  return {
    normalized: ctx.normalized,
    area: ctx.area,
    categorySlugs: ctx.slots.map((s) => s.categorySlug),
    matchedLabels: ctx.slots.map((s) => s.label),
  };
}
