/**
 * Deterministic, DB-free eval harness for lib/discovery/scoring.ts - same
 * shape as scripts/recs-fixture-eval.ts (that file's docstring explains why
 * this repo uses a plain tsx script here rather than jest/vitest: Playwright
 * is the only test runner in the repo and doesn't fit a pure-function
 * harness). Exercises every configured intent against a synthetic candidate
 * pool and writes a golden JSON so weight/category changes in
 * lib/discovery/intents.ts show up as a reviewable diff.
 *
 * Run: npx tsx scripts/discovery-fixture-eval.ts
 */
import fs from "node:fs";
import path from "node:path";
import { diversify, type CandidateInput } from "../lib/recommendations/scoring";
import {
  buildIntentCategoryFilter,
  passesIntentFilters,
  scoreDiscoveryCandidates,
  type DiscoveryCandidateInput,
} from "../lib/discovery/scoring";
import { DISCOVERY_INTENTS, type DiscoveryIntentConfig } from "../lib/discovery/intents";

// --- Synthetic taxonomy (mirrors live slugs/ids/parents verified against
// listing_categories on 2026-08-05; kept local so this harness never touches
// the DB) - a superset of every slug referenced by DISCOVERY_INTENTS. -----
const CAT = {
  restaurantsCafes: { id: 81, parent: 75, slug: "restaurants-cafes" },
  fastFoodStreetFood: { id: 82, parent: 75, slug: "fast-food-street-food" },
  pakistaniDesiCuisine: { id: 83, parent: 75, slug: "pakistani-desi-cuisine" },
  bakeriesDesserts: { id: 18, parent: 75, slug: "bakeries-desserts" },
  cafesCoworkingSpots: { id: 105, parent: 75, slug: "cafes-coworking-spots" },
  fineDiningBuffets: { id: 106, parent: 75, slug: "fine-dining-buffets" },
  juiceBarsBeverages: { id: 108, parent: 75, slug: "juice-bars-beverages" },
  groceriesFreshFood: { id: 84, parent: 75, slug: "groceries-fresh-food" },
  shoppingMallsOutlets: { id: 90, parent: 76, slug: "shopping-malls-outlets" },
  pharmaciesMedicalStores: { id: 92, parent: 77, slug: "pharmacies-medical-stores" },
  parksOutdoorSpaces: { id: 136, parent: 77, slug: "parks-outdoor-spaces" },
  salonsSpas: { id: 95, parent: 78, slug: "salons-spas" },
  entertainmentRecreation: { id: 99, parent: 79, slug: "entertainment-recreation" },
  travelTourism: { id: 97, parent: 79, slug: "travel-tourism" },
  cinemasAmusementParks: { id: 135, parent: 99, slug: "cinemas-amusement-parks" },
  liveMusicComedyVenues: { id: 137, parent: 79, slug: "live-music-comedy-venues" },
  gamingLoungesArcades: { id: 138, parent: 79, slug: "gaming-lounges-arcades" },
  // Off-taxonomy control group: real categories no intent references, used
  // below to prove the category filter actually excludes something.
  clinicsHospitals: { id: 93, parent: 77, slug: "clinics-hospitals" },
  gymsFitnessCenters: { id: 131, parent: 104, slug: "gyms-fitness-centers" },
} as const;

const SLUG_TO_ID = new Map<string, number>(Object.values(CAT).map((c) => [c.slug, c.id]));

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

const ALL_CATS = Object.values(CAT);

function buildCandidates(): DiscoveryCandidateInput[] {
  const rand = mulberry32(7);
  const candidates: DiscoveryCandidateInput[] = [];
  let id = 1;

  // ~6 candidates per category so per-intent category filtering and the
  // MMR diversity caps both get meaningfully exercised.
  for (const cat of ALL_CATS) {
    for (let i = 0; i < 6; i++) {
      const distanceMeters = Math.round(150 + rand() * 9_850);
      const openRoll = rand();
      const openState = openRoll < 0.45 ? "open" : openRoll < 0.8 ? "closed" : openRoll < 0.93 ? "unknown" : null;
      const ageDays = Math.round(1 + rand() * 400);
      const avgRating = Math.round((3 + rand() * 2) * 10) / 10;
      const closesLate = rand() < 0.3;
      const minPricePerPerson = rand() < 0.35 ? Math.round(200 + rand() * 3000) : null;

      candidates.push({
        id: id++,
        categoryIds: [cat.id],
        parentCategoryIds: [cat.parent],
        distanceMeters,
        openState,
        ageDays,
        avgRating,
        closesLate,
        minPricePerPerson,
      });
    }
  }
  return candidates;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function checkWeightsSumToOne(config: DiscoveryIntentConfig): void {
  const sum = Object.values(config.weights).reduce((a: number, b: number) => a + b, 0);
  assert(Math.abs(sum - 1) < 0.001, `${config.slug}: weights sum to ${sum.toFixed(4)}, expected 1`);
}

const LIMIT = 8;
const NOW = new Date("2026-08-05T10:00:00Z"); // Tue 15:00 PKT

function main() {
  const candidates = buildCandidates();
  console.log(
    `Synthetic candidate pool: ${candidates.length} listings across ${ALL_CATS.length} categories (incl. 2 off-taxonomy controls).`,
  );

  const golden: Record<string, unknown> = {};

  for (const config of DISCOVERY_INTENTS) {
    checkWeightsSumToOne(config);

    const filter = buildIntentCategoryFilter(config, SLUG_TO_ID);
    const eligible = candidates.filter((c) => passesIntentFilters(c, config, filter));

    assert(eligible.length > 0, `${config.slug}: zero eligible candidates from a ${candidates.length}-candidate pool`);

    if (filter.allowedCategoryIds !== null) {
      const offTopic = eligible.filter(
        (c) => !c.categoryIds.some((id) => filter.allowedCategoryIds!.has(id)),
      );
      assert(offTopic.length === 0, `${config.slug}: ${offTopic.length} eligible candidates fall outside categorySlugs`);
    }

    if (config.requireOpenNow) {
      const stillClosed = eligible.filter((c) => c.openState === "closed");
      assert(stillClosed.length === 0, `${config.slug}: requireOpenNow left ${stillClosed.length} known-closed candidates in`);
    }
    if (config.requireClosesLate) {
      const notLate = eligible.filter((c) => c.closesLate !== true);
      assert(notLate.length === 0, `${config.slug}: requireClosesLate left ${notLate.length} non-late candidates in`);
    }
    if (config.maxDistanceMeters != null) {
      const tooFar = eligible.filter(
        (c) => c.distanceMeters != null && c.distanceMeters > config.maxDistanceMeters!,
      );
      assert(tooFar.length === 0, `${config.slug}: maxDistanceMeters left ${tooFar.length} out-of-range candidates in`);
    }

    if (config.excludeCategorySlugs?.length) {
      const leaked = eligible.filter((c) =>
        c.categoryIds.some((id) => filter.excludedCategoryIds.has(id)),
      );
      assert(
        leaked.length === 0,
        `${config.slug}: excludeCategorySlugs left ${leaked.length} forbidden-category candidates in`,
      );
    }

    const scored = scoreDiscoveryCandidates(eligible, config, filter, {
      now: NOW,
      actorKey: `fixture-${config.slug}`,
    });
    const ranked = diversify(scored, LIMIT);

    assert(
      ranked.length === Math.min(LIMIT, eligible.length),
      `${config.slug}: expected ${Math.min(LIMIT, eligible.length)} ranked results, got ${ranked.length}`,
    );

    // Not asserting the MMR per-subcategory cap here: diversify() only
    // guarantees it while the greedy phase has room, and deliberately
    // relaxes it during backfill so the result count still hits `limit`
    // when an intent's filtered pool is thin and clustered in 1-2
    // categories (several of these synthetic pools are, by construction).
    // The cap itself is already covered by recs-fixture-eval.ts's dense,
    // 72-candidate pool where backfill isn't needed.

    golden[config.slug] = ranked.map((c) => ({
      id: c.id,
      categoryId: c.categoryIds[0],
      distanceMeters: c.distanceMeters,
      openState: c.openState,
      closesLate: c.closesLate,
      minPricePerPerson: c.minPricePerPerson,
      score: Number(c.score.toFixed(4)),
      breakdown: {
        categoryFit: Number(c.breakdown.categoryFit.toFixed(4)),
        proximity: Number(c.breakdown.proximity.toFixed(4)),
        openNow: Number(c.breakdown.openNow.toFixed(4)),
        freshness: Number(c.breakdown.freshness.toFixed(4)),
        rating: Number(c.breakdown.rating.toFixed(4)),
        price: Number(c.breakdown.price.toFixed(4)),
      },
    }));

    console.log(
      `\n${config.slug}: ${eligible.length} eligible -> top ${ranked.length} = [${ranked
        .map((c) => `#${c.id}(cat ${c.categoryIds[0]}, score ${c.score.toFixed(3)})`)
        .join(", ")}]`,
    );
  }

  // "Something New" has no category restriction - every real category
  // (including the off-taxonomy controls) must be eligible to appear.
  {
    const config = DISCOVERY_INTENTS.find((i) => i.slug === "something-new")!;
    const filter = buildIntentCategoryFilter(config, SLUG_TO_ID);
    assert(filter.allowedCategoryIds === null, "something-new: expected no category restriction");
  }

  // Removing coordinates (proximity gates off) must reorder, not empty, a
  // proximity-heavy intent's results.
  {
    const config = DISCOVERY_INTENTS.find((i) => i.slug === "one-hour-free")!;
    const filter = buildIntentCategoryFilter(config, SLUG_TO_ID);
    const eligible = candidates.filter((c) => passesIntentFilters(c, config, filter));
    const withGeo = diversify(
      scoreDiscoveryCandidates(eligible, config, filter, { now: NOW, actorKey: "geo-check", disableJitter: true }),
      LIMIT,
    );
    const noGeo: CandidateInput[] = eligible.map((c) => ({ ...c, distanceMeters: null }));
    const withoutGeo = diversify(
      scoreDiscoveryCandidates(noGeo, config, filter, { now: NOW, actorKey: "geo-check", disableJitter: true }),
      LIMIT,
    );
    assert(withoutGeo.length === withGeo.length, "one-hour-free: dropping coords must not change result count");
    const sameOrder = withGeo.every((c, i) => c.id === withoutGeo[i]?.id);
    assert(!sameOrder, "one-hour-free: dropping coords (proximity gate-off) should change the ranking");
    console.log(
      `\ngeo-gate-off: with-coords=[${withGeo.map((c) => c.id).join(",")}] without-coords=[${withoutGeo.map((c) => c.id).join(",")}]`,
    );
  }

  const goldenPath = path.join(__dirname, "__fixtures__", "discovery-fixture-eval.golden.json");
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
