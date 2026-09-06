/**
 * Optional live DB eval for outing plan MUST NOT rules.
 * Requires DATABASE_URL. Run: npx tsx scripts/outing-intent-eval-live.ts
 */
import { buildAlgorithmOutingPlan } from "../lib/outing/algorithm-plan";
import { extractOutingIntent } from "../lib/outing/intent";
import { coreGoldenPrompts } from "../lib/outing/eval/golden-prompts";
import {
  assertIntentMatchesFixture,
  assertPlanMatchesFixture,
  formatFailures,
  type IntentAssertFailure,
} from "../lib/outing/eval/assert-intent";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required for live outing eval");
    process.exit(2);
  }

  let failures: IntentAssertFailure[] = [];

  for (const fixture of coreGoldenPrompts()) {
    const intent = extractOutingIntent(fixture.prompt);
    failures = failures.concat(assertIntentMatchesFixture(fixture, intent));

    try {
      const plan = await buildAlgorithmOutingPlan(fixture.prompt);
      failures = failures.concat(
        assertPlanMatchesFixture(fixture, intent, plan.stops, {
          budgetNote: plan.budgetNote,
        }),
      );
    } catch (err) {
      failures.push({
        fixtureId: fixture.id,
        prompt: fixture.prompt,
        message: `plan build threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (failures.length) {
    console.error("outing-intent-eval-live FAILED\n");
    console.error(formatFailures(failures));
    process.exit(1);
  }

  console.log("outing-intent-eval-live OK — core fixtures against DB");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
