/**
 * Deterministic, DB-free eval harness for lib/recommendations/event-scoring.ts
 * (the "What's on" for-you scorer). Sibling to scripts/recs-fixture-eval.ts -
 * same reasoning: no jest/vitest here (see CLAUDE.md / repo convention,
 * Playwright is the only test runner and doesn't fit a pure-function harness).
 *
 * Run: npx tsx scripts/event-recs-fixture-eval.ts
 *
 * Writes a golden JSON file so weight changes in constants.ts show up as a
 * reviewable diff instead of silently changing behaviour.
 */
import fs from "node:fs";
import path from "node:path";
import {
  scoreEventCandidate,
  type EventCandidateInput,
  type EventScoringContext,
} from "../lib/recommendations/event-scoring";
import { getTimeIntentBoostsBySlug } from "../lib/recommendations/time-intent";

// Synthetic categories, local so this harness never touches the DB (mirrors
// recs-fixture-eval.ts's own SLUG_TO_ID approach instead of the DB-backed
// getTimeIntentBoostsByCategoryId).
const CAT = {
  entertainmentRecreation: { id: 99, slug: "entertainment-recreation" },
  professionalBusinessServices: { id: 100, slug: "professional-business-services" },
  pakistaniDesiCuisine: { id: 83, slug: "pakistani-desi-cuisine" },
} as const;

function timeIntentMap(now: Date): Map<number, number> {
  const bySlug = getTimeIntentBoostsBySlug(now);
  const byId = new Map<number, number>();
  for (const cat of Object.values(CAT)) {
    if (bySlug[cat.slug] != null) byId.set(cat.id, bySlug[cat.slug]);
  }
  return byId;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function main() {
  const golden: Record<string, unknown> = {};

  // 1. Monotonic-in-soonness: same category (so categoryScore is identical
  // for every candidate), jitter disabled, only hours-until-start varies.
  {
    const now = new Date("2026-09-13T10:00:00Z");
    const hours = [0, 6, 24, 48, 96, 200];
    const candidates: EventCandidateInput[] = hours.map((h, i) => ({
      id: 1000 + i,
      categoryId: CAT.pakistaniDesiCuisine.id,
      startTime: new Date(now.getTime() + h * 3_600_000),
      distanceMeters: null,
    }));
    const ctx: EventScoringContext = {
      timeIntentByCategoryId: timeIntentMap(now),
      now,
      actorKey: "monotonic-check",
      disableJitter: true,
    };
    const scored = candidates.map((c) => scoreEventCandidate(c, ctx));
    for (let i = 1; i < scored.length; i++) {
      assert(
        scored[i].score < scored[i - 1].score,
        `monotonic-in-soonness: score did not strictly decrease at +${hours[i]}h (${scored[i].score} >= ${scored[i - 1].score})`,
      );
    }
    golden["monotonic-in-soonness"] = scored.map((c, i) => ({
      hoursUntilStart: hours[i],
      score: Number(c.score.toFixed(4)),
    }));
    console.log(
      `\nmonotonic-in-soonness: ${scored.map((c, i) => `+${hours[i]}h=${c.score.toFixed(4)}`).join(" > ")}`,
    );
  }

  // 2. Cold start uses the time-of-day prior, never raw chronological/zero:
  // a brand-new actor (eventCount=0, no learned affinity) at Friday late
  // night, comparing a category the time-intent rules boost heavily
  // (entertainment-recreation) against one they leave at the floor
  // (professional-business-services) - same start time, so soonness is a
  // non-factor and only categoryScore (= pure timeIntent here) differs.
  {
    const now = new Date("2026-09-11T19:00:00Z"); // Sat 00:00 PKT (Fri night) -> lateNight bucket
    const startTime = new Date(now.getTime() + 20 * 3_600_000); // same for both
    const boosted: EventCandidateInput = {
      id: 2001,
      categoryId: CAT.entertainmentRecreation.id,
      startTime,
      distanceMeters: null,
    };
    const floor: EventCandidateInput = {
      id: 2002,
      categoryId: CAT.professionalBusinessServices.id,
      startTime,
      distanceMeters: null,
    };
    const ctx: EventScoringContext = {
      timeIntentByCategoryId: timeIntentMap(now),
      learnedAffinityByCategoryId: new Map(),
      eventCount: 0,
      now,
      actorKey: "new-actor",
      disableJitter: true,
    };
    const scoredBoosted = scoreEventCandidate(boosted, ctx);
    const scoredFloor = scoreEventCandidate(floor, ctx);
    assert(
      scoredBoosted.score > scoredFloor.score,
      `cold-start-time-intent-prior: expected time-boosted category to outrank floor category even with zero history (${scoredBoosted.score} <= ${scoredFloor.score})`,
    );
    assert(
      scoredBoosted.breakdown.category > 0.25,
      "cold-start-time-intent-prior: a brand-new actor's categoryScore must reflect the time-of-day prior, not a hard 0",
    );
    golden["cold-start-time-intent-prior"] = {
      boosted: Number(scoredBoosted.score.toFixed(4)),
      floor: Number(scoredFloor.score.toFixed(4)),
    };
    console.log(
      `\ncold-start-time-intent-prior: entertainment=${scoredBoosted.score.toFixed(4)} professional=${scoredFloor.score.toFixed(4)}`,
    );
  }

  // 3. Strong learned affinity flips a ranking the time-of-day prior would
  // otherwise decide - same two candidates as above, but now the actor has a
  // strong (1.0) learned affinity for the category the prior disfavors.
  {
    const now = new Date("2026-09-11T19:00:00Z");
    const startTime = new Date(now.getTime() + 20 * 3_600_000);
    const entertainment: EventCandidateInput = {
      id: 3001,
      categoryId: CAT.entertainmentRecreation.id,
      startTime,
      distanceMeters: null,
    };
    const professional: EventCandidateInput = {
      id: 3002,
      categoryId: CAT.professionalBusinessServices.id,
      startTime,
      distanceMeters: null,
    };
    const withAffinity: EventScoringContext = {
      timeIntentByCategoryId: timeIntentMap(now),
      learnedAffinityByCategoryId: new Map([[CAT.professionalBusinessServices.id, 1.0]]),
      eventCount: 40,
      now,
      actorKey: "loyal-actor",
      disableJitter: true,
    };
    const withoutAffinity: EventScoringContext = { ...withAffinity, learnedAffinityByCategoryId: new Map(), eventCount: 0 };

    const rankWith = [entertainment, professional]
      .map((c) => scoreEventCandidate(c, withAffinity))
      .sort((a, b) => b.score - a.score);
    const rankWithout = [entertainment, professional]
      .map((c) => scoreEventCandidate(c, withoutAffinity))
      .sort((a, b) => b.score - a.score);

    assert(
      rankWithout[0].id === entertainment.id,
      "sanity: without a learned signal the time-of-day prior should favor entertainment-recreation",
    );
    assert(
      rankWith[0].id === professional.id,
      `strong-affinity-flips-ranking: a strong learned affinity for professional-business-services should outrank the prior's favorite (top was #${rankWith[0].id})`,
    );
    golden["strong-affinity-flips-ranking"] = {
      without: rankWithout.map((c) => c.id),
      with: rankWith.map((c) => c.id),
    };
    console.log(
      `\nstrong-affinity-flips-ranking: without=[${rankWithout.map((c) => c.id).join(",")}] with=[${rankWith.map((c) => c.id).join(",")}]`,
    );
  }

  // 4. Proximity is null-gated, not required - a candidate with no
  // distanceMeters must still score sanely (no NaN), and adding proximity
  // must never crash the renormalisation.
  {
    const now = new Date("2026-09-13T10:00:00Z");
    const candidate: EventCandidateInput = {
      id: 4001,
      categoryId: null,
      startTime: new Date(now.getTime() + 5 * 3_600_000),
      distanceMeters: null,
    };
    const ctx: EventScoringContext = {
      timeIntentByCategoryId: new Map(),
      now,
      actorKey: "no-location",
      disableJitter: true,
    };
    const scored = scoreEventCandidate(candidate, ctx);
    assert(Number.isFinite(scored.score), `null-category-and-distance: score must be finite, got ${scored.score}`);
    golden["null-category-and-distance"] = { score: Number(scored.score.toFixed(4)) };
    console.log(`\nnull-category-and-distance: score=${scored.score.toFixed(4)}`);
  }

  const goldenPath = path.join(__dirname, "__fixtures__", "event-recs-fixture-eval.golden.json");
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
