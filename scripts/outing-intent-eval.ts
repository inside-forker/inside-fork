/**
 * Layer 1–2 outing intent eval (no DB required).
 * Run: npx tsx scripts/outing-intent-eval.ts
 * Exit 1 on any golden contract failure.
 */
import { extractOutingIntent } from "../lib/outing/intent";
import {
  GOLDEN_PROMPTS,
  coreGoldenPrompts,
} from "../lib/outing/eval/golden-prompts";
import {
  assertIntentMatchesFixture,
  formatFailures,
  type IntentAssertFailure,
} from "../lib/outing/eval/assert-intent";
import { runPlanShapeAssertions } from "../lib/outing/eval/plan-shape-fixtures";

const coreOnly = process.argv.includes("--core");
const fixtures = coreOnly ? coreGoldenPrompts() : GOLDEN_PROMPTS;

let failures: IntentAssertFailure[] = [];

for (const fixture of fixtures) {
  const intent = extractOutingIntent(fixture.prompt);
  failures = failures.concat(assertIntentMatchesFixture(fixture, intent));
}

failures = failures.concat(runPlanShapeAssertions());

if (failures.length) {
  console.error("outing-intent-eval FAILED\n");
  console.error(formatFailures(failures));
  console.error(`\n${failures.length} assertion(s) across ${fixtures.length} fixtures`);
  process.exit(1);
}

console.log(
  `outing-intent-eval OK — ${fixtures.length} fixtures (intent + plan shape)`,
);
