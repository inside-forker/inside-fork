import {
  extractOutingIntent,
  type OutingIntent,
} from "@/lib/outing/intent";
import {
  familyForCategoryName,
  type CategoryFamily,
} from "@/lib/outing/category-families";
import type { GoldenPromptFixture } from "@/lib/outing/eval/golden-prompts";

export type IntentAssertFailure = {
  fixtureId: string;
  prompt: string;
  message: string;
};

function sameNumber(
  actual: number | null | undefined,
  expected: number | null | undefined,
): boolean {
  if (expected === undefined) return true;
  if (expected === null) return actual == null;
  return actual === expected;
}

/** Layer 1: prompt → OutingIntent matches golden expect. */
export function assertIntentMatchesFixture(
  fixture: GoldenPromptFixture,
  intent: OutingIntent = extractOutingIntent(fixture.prompt),
): IntentAssertFailure[] {
  const failures: IntentAssertFailure[] = [];
  const { expect } = fixture;
  const fail = (message: string) =>
    failures.push({ fixtureId: fixture.id, prompt: fixture.prompt, message });

  if (intent.mode !== expect.mode) {
    fail(`mode: expected ${expect.mode}, got ${intent.mode}`);
  }
  if (intent.primaryNeed !== expect.primaryNeed) {
    fail(
      `primaryNeed: expected ${expect.primaryNeed}, got ${intent.primaryNeed}`,
    );
  }
  if (intent.excludeFood !== expect.excludeFood) {
    fail(
      `excludeFood: expected ${expect.excludeFood}, got ${intent.excludeFood}`,
    );
  }
  if (!sameNumber(intent.partySize, expect.partySize)) {
    fail(
      `partySize: expected ${expect.partySize}, got ${intent.partySize}`,
    );
  }
  if (!sameNumber(intent.budgetMaxPkr, expect.budgetMaxPkr)) {
    fail(
      `budgetMaxPkr: expected ${expect.budgetMaxPkr}, got ${intent.budgetMaxPkr}`,
    );
  }
  if (expect.activityKeywordsIncludes?.length) {
    for (const kw of expect.activityKeywordsIncludes) {
      const hit = intent.activityKeywords.some(
        (k) => k.includes(kw) || kw.includes(k),
      );
      if (!hit) {
        fail(
          `activityKeywords missing "${kw}" (got ${JSON.stringify(intent.activityKeywords)})`,
        );
      }
    }
  }
  return failures;
}

export type PlanStopLike = {
  role?: string;
  listing: {
    status?: string | null;
    category_name?: string | null;
    name?: string | null;
    description?: string | null;
    min_price_per_person?: number | null;
    max_price_per_person?: number | null;
  };
};

/** Layer 2–3: plan shape + MUST NOT category / food-pad rules. */
export function assertPlanMatchesFixture(
  fixture: GoldenPromptFixture,
  intent: OutingIntent,
  stops: PlanStopLike[],
  opts?: { budgetNote?: string | null },
): IntentAssertFailure[] {
  const failures: IntentAssertFailure[] = [];
  const fail = (message: string) =>
    failures.push({ fixtureId: fixture.id, prompt: fixture.prompt, message });

  const { expect, resultAssertions } = fixture;

  if (intent.mode === "places" && expect.mode === "places") {
    const foodRoles = new Set(["dinner", "eat", "sweet", "meal", "cafe"]);
    const looksLikeFoodArc =
      stops.length >= 3 &&
      stops.filter((s) => s.role && foodRoles.has(s.role)).length >= 2;
    if (intent.excludeFood && looksLikeFoodArc) {
      fail("places+excludeFood must not return a multi-stop food arc");
    }
  }

  if (resultAssertions?.allPublished) {
    for (const s of stops) {
      if (s.listing.status && s.listing.status !== "published") {
        fail(`unpublished listing in results: ${s.listing.name}`);
      }
    }
  }

  const forbid = expect.forbidCategoryFamilies ?? [];
  if (forbid.length) {
    for (const s of stops) {
      const fam = familyForCategoryName(s.listing.category_name);
      if (forbid.includes(fam)) {
        fail(
          `forbidden category family "${fam}" for "${s.listing.name}" (${s.listing.category_name})`,
        );
      }
    }
  }

  if (resultAssertions?.noFoodPad || intent.excludeFood) {
    const foodFamilies: CategoryFamily[] = [
      "restaurants",
      "cafes",
      "fast_food",
      "bakeries",
      "fine_dining",
    ];
    for (const s of stops) {
      const fam = familyForCategoryName(s.listing.category_name);
      if (foodFamilies.includes(fam)) {
        fail(
          `food pad / food stop when excludeFood: "${s.listing.name}" (${fam})`,
        );
      }
    }
  }

  if (resultAssertions?.requireActivityKeyword && stops.length > 0) {
    const kw = resultAssertions.requireActivityKeyword.toLowerCase();
    const top = stops.slice(0, Math.min(3, stops.length));
    const anyHit = top.some((s) => {
      const blob = `${s.listing.name ?? ""} ${s.listing.description ?? ""}`.toLowerCase();
      return blob.includes(kw);
    });
    if (!anyHit) {
      fail(
        `top results lack activity keyword "${kw}" (names: ${top.map((s) => s.listing.name).join(", ")})`,
      );
    }
  }
  // Empty results for a required activity keyword are allowed when inventory
  // has no matching published listings (honest empty > random pad).


  if (expect.budgetMaxPkr != null && stops.length > 0) {
    const party = intent.partySize ?? 2;
    const ceiling = expect.budgetMaxPkr;
    for (const s of stops) {
      const min = s.listing.min_price_per_person;
      if (min != null && min * party > ceiling) {
        fail(
          `over-budget priced listing "${s.listing.name}": ${min}×${party} > ${ceiling}`,
        );
      }
    }
  }

  // Tourism agencies must never pad social moods
  if (
    (intent.primaryNeed === "friends" ||
      intent.primaryNeed === "hangout" ||
      intent.primaryNeed === "family" ||
      intent.primaryNeed === "date" ||
      intent.primaryNeed === "activity") &&
    stops.length > 0
  ) {
    for (const s of stops) {
      const fam = familyForCategoryName(s.listing.category_name);
      const slugBlob = `${s.listing.name ?? ""} ${s.listing.category_name ?? ""}`.toLowerCase();
      if (fam === "tourism" || /tour agency|travel & tourism|tourism/.test(slugBlob)) {
        fail(
          `tourism pad in results: "${s.listing.name}" (${s.listing.category_name})`,
        );
      }
    }
  }

  // Gyms are not hangouts / date / friends picks
  if (
    (intent.primaryNeed === "friends" ||
      intent.primaryNeed === "hangout" ||
      intent.primaryNeed === "family" ||
      intent.primaryNeed === "date") &&
    stops.length > 0
  ) {
    for (const s of stops) {
      const blob = `${s.listing.name ?? ""} ${s.listing.description ?? ""} ${s.listing.category_name ?? ""}`.toLowerCase();
      if (/\b(gym|fitness|fitnest|workout|crossfit|dumbbell)\b/.test(blob)) {
        fail(`gym pad in results: "${s.listing.name}"`);
      }
    }
  }

  // Non-food-first plans: at most one *meal* restaurant (cafe + hangout OK)
  if (intent.primaryNeed !== "food" && stops.length > 1) {
    const mealFamilies: CategoryFamily[] = [
      "restaurants",
      "fine_dining",
      "fast_food",
    ];
    const mealStops = stops.filter((s) =>
      mealFamilies.includes(familyForCategoryName(s.listing.category_name)),
    );
    if (mealStops.length > 1) {
      fail(
        `expected at most 1 meal restaurant for primaryNeed=${intent.primaryNeed}, got ${mealStops.length}: ${mealStops.map((s) => s.listing.name).join(", ")}`,
      );
    }
  }

  // Soft signal: when budget stated and we fell back, note should be honest
  if (
    expect.budgetMaxPkr != null &&
    opts?.budgetNote === undefined &&
    false
  ) {
    // reserved for live eval wiring
  }

  return failures;
}

export function formatFailures(failures: IntentAssertFailure[]): string {
  if (!failures.length) return "";
  return failures
    .map((f) => `[${f.fixtureId}] "${f.prompt}": ${f.message}`)
    .join("\n");
}
