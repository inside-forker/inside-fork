/**
 * Deterministic, DB-free eval harness for lib/recommendations/scoring.ts.
 * ~60 synthetic listings across 8 personas, run via the repo's existing tsx
 * (no jest/vitest here - see CLAUDE.md / repo convention, Playwright is the
 * only test runner in this repo and doesn't fit a pure-function harness).
 *
 * Run: npx tsx scripts/recs-fixture-eval.ts
 *
 * Writes a golden JSON file so weight changes in constants.ts/time-intent.ts
 * show up as a reviewable diff instead of silently changing behaviour.
 */
import fs from "node:fs";
import path from "node:path";
import {
  scoreCandidates,
  diversify,
  type CandidateInput,
  type ScoringContext,
} from "../lib/recommendations/scoring";
import { getTimeIntentBoostsBySlug } from "../lib/recommendations/time-intent";

// --- Synthetic taxonomy (mirrors live slugs/ids verified 2026-07-29; kept
// local so this harness never touches the DB) ---------------------------
const CAT = {
  restaurantsCafes: { id: 81, parent: 75, slug: "restaurants-cafes" },
  fastFoodStreetFood: { id: 82, parent: 75, slug: "fast-food-street-food" },
  pakistaniDesiCuisine: { id: 83, parent: 75, slug: "pakistani-desi-cuisine" },
  bakeriesDesserts: { id: 18, parent: 75, slug: "bakeries-desserts" },
  cafesCoworkingSpots: { id: 105, parent: 75, slug: "cafes-coworking-spots" },
  fineDiningBuffets: { id: 106, parent: 75, slug: "fine-dining-buffets" },
  juiceBarsBeverages: { id: 108, parent: 75, slug: "juice-bars-beverages" },
  groceriesFreshFood: { id: 84, parent: 75, slug: "groceries-fresh-food" },
  gymsFitnessCenters: { id: 131, parent: 104, slug: "gyms-fitness-centers" },
  padelCricketFutsalClubs: { id: 132, parent: 104, slug: "padel-cricket-futsal-clubs" },
  clinicsHospitals: { id: 93, parent: 77, slug: "clinics-hospitals" },
  diagnosticLabsImaging: { id: 113, parent: 77, slug: "diagnostic-labs-imaging" },
  pharmaciesMedicalStores: { id: 92, parent: 77, slug: "pharmacies-medical-stores" },
  salonsSpas: { id: 95, parent: 78, slug: "salons-spas" },
  barbershopsMensGrooming: { id: 117, parent: 78, slug: "barbershops-mens-grooming" },
  cosmeticsFragrances: { id: 96, parent: 78, slug: "cosmetics-fragrances" },
  entertainmentRecreation: { id: 99, parent: 79, slug: "entertainment-recreation" },
  travelTourism: { id: 97, parent: 79, slug: "travel-tourism" },
  professionalBusinessServices: { id: 100, parent: 79, slug: "professional-business-services" },
  apparelClothing: { id: 85, parent: 76, slug: "apparel-clothing" },
  collegesUniversitiesInstitutes: { id: 103, parent: 80, slug: "colleges-universities-institutes" },
} as const;

const SLUG_TO_ID = new Map<string, number>(Object.values(CAT).map((c) => [c.slug, c.id]));

function timeIntentMap(now: Date): Map<number, number> {
  const bySlug = getTimeIntentBoostsBySlug(now);
  const byId = new Map<number, number>();
  for (const [slug, value] of Object.entries(bySlug)) {
    const id = SLUG_TO_ID.get(slug);
    if (id != null) byId.set(id, value);
  }
  return byId;
}

// --- Synthetic candidate generation --------------------------------------
// Mirrors the live inventory's food skew (~66%) so diversity actually gets
// exercised the way it would against real data.
const CATEGORY_WEIGHTS: Array<[keyof typeof CAT, number]> = [
  ["restaurantsCafes", 10],
  ["fastFoodStreetFood", 8],
  ["pakistaniDesiCuisine", 6],
  ["bakeriesDesserts", 5],
  ["cafesCoworkingSpots", 4],
  ["fineDiningBuffets", 2],
  ["juiceBarsBeverages", 3],
  ["groceriesFreshFood", 2],
  ["gymsFitnessCenters", 4],
  ["padelCricketFutsalClubs", 2],
  ["clinicsHospitals", 4],
  ["diagnosticLabsImaging", 2],
  ["pharmaciesMedicalStores", 2],
  ["salonsSpas", 4],
  ["barbershopsMensGrooming", 2],
  ["cosmeticsFragrances", 2],
  ["entertainmentRecreation", 3],
  ["travelTourism", 2],
  ["professionalBusinessServices", 2],
  ["apparelClothing", 2],
  ["collegesUniversitiesInstitutes", 1],
];

// Simple deterministic PRNG (mulberry32) so the fixture is stable across runs.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCandidates(): CandidateInput[] {
  const rand = mulberry32(42);
  const pool: (keyof typeof CAT)[] = [];
  for (const [key, weight] of CATEGORY_WEIGHTS) {
    for (let i = 0; i < weight; i++) pool.push(key);
  }

  const candidates: CandidateInput[] = [];
  let id = 1;
  for (const key of pool) {
    const cat = CAT[key];
    const distanceMeters = Math.round(200 + rand() * 14_800);
    // Kept even though "For You" now hard-filters to open-only before
    // candidates reach this file (see candidates.ts's onlyOpen) - this
    // harness scores directly, and openState still needs to round-trip
    // correctly since it feeds the "Open now"/"Closed now" reason text.
    const openRoll = rand();
    const openState = openRoll < 0.4 ? "open" : openRoll < 0.75 ? "closed" : openRoll < 0.9 ? "unknown" : null;
    const ageDays = Math.round(1 + rand() * 400);
    // ~85% of listings have no rating and aren't pinned (matches the live
    // catalog: 0 of 4,484 published listings currently have avg_rating > 0),
    // a handful get a real rating, and a handful are top_rated_pinned with no
    // rating - exercising both quality-term branches.
    const qualityRoll = rand();
    const avgRating = qualityRoll < 0.1 ? Math.round((3 + rand() * 2) * 10) / 10 : null;
    const topRatedPinned = avgRating == null && qualityRoll < 0.15;
    candidates.push({
      id: id++,
      categoryIds: [cat.id],
      parentCategoryIds: [cat.parent],
      distanceMeters,
      openState,
      ageDays,
      avgRating,
      topRatedPinned,
    });
  }
  return candidates;
}

// --- Personas -------------------------------------------------------------
type Persona = {
  name: string;
  now: Date;
  hasCoords: boolean;
  learnedCategoryIds?: (keyof typeof CAT)[];
  eventCount?: number;
  actorKey: string;
};

// All times are wall-clock in Asia/Karachi, encoded as UTC (+05:00, no DST).
const PERSONAS: Persona[] = [
  { name: "new-user-no-gps-weekday-lunch", now: new Date("2026-07-27T08:00:00Z"), hasCoords: false, actorKey: "anon-1" }, // Mon 13:00 PKT
  { name: "new-user-clifton-weekday-lunch", now: new Date("2026-07-27T08:00:00Z"), hasCoords: true, actorKey: "anon-2" },
  {
    name: "foodie-friday-late-night",
    now: new Date("2026-07-31T19:00:00Z"), // Sat 00:00 PKT (Fri night carrying into Sat) -> lateNight bucket
    hasCoords: true,
    learnedCategoryIds: ["pakistaniDesiCuisine", "fastFoodStreetFood", "bakeriesDesserts"],
    eventCount: 40,
    actorKey: "user-foodie",
  },
  {
    name: "gym-goer-weekday-early-morning",
    now: new Date("2026-07-27T02:00:00Z"), // Mon 07:00 PKT
    hasCoords: true,
    learnedCategoryIds: ["gymsFitnessCenters"],
    eventCount: 15,
    actorKey: "user-gym",
  },
  { name: "professional-weekday-11am", now: new Date("2026-07-27T06:00:00Z"), hasCoords: true, actorKey: "anon-3" }, // Mon 11:00 PKT
  { name: "weekend-family-saturday-afternoon", now: new Date("2026-08-01T11:00:00Z"), hasCoords: true, actorKey: "anon-4" }, // Sat 16:00 PKT
  {
    name: "sunday-evening-beauty",
    now: new Date("2026-08-02T13:30:00Z"), // Sun 18:30 PKT
    hasCoords: true,
    learnedCategoryIds: ["salonsSpas", "cosmeticsFragrances"],
    eventCount: 25,
    actorKey: "user-beauty",
  },
  { name: "late-night-anon-0030", now: new Date("2026-07-27T19:30:00Z"), hasCoords: false, actorKey: "anon-5" }, // Tue 00:30 PKT
];

const LIMIT = 6;

function learnedAffinityFor(persona: Persona): Map<number, number> | undefined {
  if (!persona.learnedCategoryIds) return undefined;
  const map = new Map<number, number>();
  for (const key of persona.learnedCategoryIds) map.set(CAT[key].id, 1.0);
  return map;
}

function subcategoryOf(candidate: CandidateInput): number {
  return candidate.categoryIds[0];
}

function runPersona(candidates: CandidateInput[], persona: Persona) {
  const ctx: ScoringContext = {
    timeIntentByCategoryId: timeIntentMap(persona.now),
    learnedAffinityByCategoryId: learnedAffinityFor(persona),
    eventCount: persona.eventCount ?? 0,
    now: persona.now,
    actorKey: persona.actorKey,
  };

  const withGeo = candidates.map((c) => ({
    ...c,
    distanceMeters: persona.hasCoords ? c.distanceMeters : null,
  }));

  const scored = scoreCandidates(withGeo, ctx);
  const ranked = diversify(scored, LIMIT);

  return { ctx, ranked };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function main() {
  const candidates = buildCandidates();
  console.log(`Synthetic candidate pool: ${candidates.length} listings across ${CATEGORY_WEIGHTS.length} categories.`);

  const golden: Record<string, unknown> = {};

  for (const persona of PERSONAS) {
    const { ranked } = runPersona(candidates, persona);

    assert(ranked.length === LIMIT, `${persona.name}: expected ${LIMIT} results, got ${ranked.length}`);

    const subCounts = new Map<number, number>();
    for (const c of ranked) {
      const sub = subcategoryOf(c);
      subCounts.set(sub, (subCounts.get(sub) ?? 0) + 1);
    }
    for (const [sub, count] of subCounts) {
      assert(count <= 2, `${persona.name}: subcategory ${sub} appears ${count}x in top ${LIMIT} (max 2)`);
    }

    golden[persona.name] = ranked.map((c) => ({
      id: c.id,
      categoryId: c.categoryIds[0],
      distanceMeters: c.distanceMeters,
      openState: c.openState,
      avgRating: c.avgRating,
      topRatedPinned: c.topRatedPinned ?? false,
      score: Number(c.score.toFixed(4)),
      breakdown: {
        affinity: Number(c.breakdown.affinity.toFixed(4)),
        proximity: Number(c.breakdown.proximity.toFixed(4)),
        quality: Number(c.breakdown.quality.toFixed(4)),
        freshness: Number(c.breakdown.freshness.toFixed(4)),
      },
    }));

    console.log(
      `\n${persona.name}: top ${LIMIT} = [${ranked.map((c) => `#${c.id}(cat ${c.categoryIds[0]}, score ${c.score.toFixed(3)})`).join(", ")}]`,
    );
  }

  // Monotonic-in-distance check: same category/open/age, jitter disabled, only distance varies.
  {
    const base: CandidateInput[] = [0, 500, 1500, 3000, 6000, 12000].map((d, i) => ({
      id: 9000 + i,
      categoryIds: [CAT.restaurantsCafes.id],
      parentCategoryIds: [CAT.restaurantsCafes.parent],
      distanceMeters: d,
      openState: "open",
      ageDays: 10,
      avgRating: null,
    }));
    const ctx: ScoringContext = {
      timeIntentByCategoryId: new Map(),
      now: new Date("2026-07-27T08:00:00Z"),
      actorKey: "monotonic-check",
      disableJitter: true,
    };
    const scored = scoreCandidates(base, ctx);
    for (let i = 1; i < scored.length; i++) {
      assert(
        scored[i].score < scored[i - 1].score,
        `monotonic-in-distance: score did not strictly decrease at distance=${scored[i].distanceMeters} (${scored[i].score} >= ${scored[i - 1].score})`,
      );
    }
    console.log(
      `\nmonotonic-in-distance: ${scored.map((c) => `${c.distanceMeters}m=${c.score.toFixed(4)}`).join(" > ")}`,
    );
  }

  // Monotonic-in-rating check: same category/distance/age, jitter disabled,
  // only avgRating varies - confirms the quality term (previously a hardcoded
  // 0 placeholder) actually differentiates listings now.
  {
    const base: CandidateInput[] = [null, 2.5, 3.5, 4.0, 4.5, 5.0].map((r, i) => ({
      id: 9100 + i,
      categoryIds: [CAT.restaurantsCafes.id],
      parentCategoryIds: [CAT.restaurantsCafes.parent],
      distanceMeters: 1000,
      openState: "open",
      ageDays: 10,
      avgRating: r,
    }));
    const ctx: ScoringContext = {
      timeIntentByCategoryId: new Map(),
      now: new Date("2026-07-27T08:00:00Z"),
      actorKey: "monotonic-rating-check",
      disableJitter: true,
    };
    const scored = scoreCandidates(base, ctx);
    for (let i = 1; i < scored.length; i++) {
      assert(
        scored[i].score > scored[i - 1].score,
        `monotonic-in-rating: score did not strictly increase at avgRating=${scored[i].avgRating} (${scored[i].score} <= ${scored[i - 1].score})`,
      );
    }
    console.log(
      `\nmonotonic-in-rating: ${scored.map((c) => `${c.avgRating ?? "none"}★=${c.score.toFixed(4)}`).join(" < ")}`,
    );
  }

  // top_rated_pinned fallback: no rating, but pinned, should score between
  // "no signal at all" and a genuine high organic rating - never above 5.0.
  {
    const unrated: CandidateInput = {
      id: 9200,
      categoryIds: [CAT.restaurantsCafes.id],
      parentCategoryIds: [CAT.restaurantsCafes.parent],
      distanceMeters: 1000,
      openState: "open",
      ageDays: 10,
      avgRating: null,
    };
    const pinned: CandidateInput = { ...unrated, id: 9201, topRatedPinned: true };
    const fiveStars: CandidateInput = { ...unrated, id: 9202, avgRating: 5.0 };
    const ctx: ScoringContext = {
      timeIntentByCategoryId: new Map(),
      now: new Date("2026-07-27T08:00:00Z"),
      actorKey: "pin-fallback-check",
      disableJitter: true,
    };
    const [scoredUnrated, scoredPinned, scoredFiveStars] = scoreCandidates(
      [unrated, pinned, fiveStars],
      ctx,
    );
    assert(
      scoredPinned.score > scoredUnrated.score,
      `top-rated-pinned-fallback: a pinned listing with no rating (${scoredPinned.score}) should outrank an unrated, unpinned one (${scoredUnrated.score})`,
    );
    assert(
      scoredFiveStars.score > scoredPinned.score,
      `top-rated-pinned-fallback: a genuine 5-star rating (${scoredFiveStars.score}) should still outrank a manual pin (${scoredPinned.score})`,
    );
    console.log(
      `\ntop-rated-pinned-fallback: unrated=${scoredUnrated.score.toFixed(4)} < pinned=${scoredPinned.score.toFixed(4)} < five-stars=${scoredFiveStars.score.toFixed(4)}`,
    );
  }

  // Removing the affinity signal reorders but never empties.
  {
    const persona = PERSONAS.find((p) => p.name === "foodie-friday-late-night")!;
    const withAffinity = runPersona(candidates, persona).ranked;
    const without = runPersona(candidates, { ...persona, learnedCategoryIds: undefined, eventCount: 0 }).ranked;

    assert(without.length === LIMIT, "removing affinity signal must not empty the result");
    const sameOrder =
      withAffinity.length === without.length && withAffinity.every((c, i) => c.id === without[i].id);
    assert(!sameOrder, "removing affinity signal should change the ranking for a persona with a strong learned signal");
    console.log(
      `\naffinity-removal: with=[${withAffinity.map((c) => c.id).join(",")}] without=[${without.map((c) => c.id).join(",")}]`,
    );
  }

  const goldenPath = path.join(__dirname, "__fixtures__", "recs-fixture-eval.golden.json");
  fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
  fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2) + "\n");
  console.log(`\nGolden file written: ${path.relative(process.cwd(), goldenPath)}`);

  if (process.exitCode === 1) {
    console.error("\nOne or more invariants failed.");
  } else {
    console.log("\nAll invariants passed.");
  }
}

main();
