/**
 * Activity / outing answer contracts.
 *
 * Spec: hangout / date / bowling / budget / friends-visiting prompts must never
 * collapse into a dinner → dessert night-out arc or surface travel agencies.
 * Golden fixtures in `lib/outing/eval/golden-prompts.ts` (~100 prompts; core
 * merge blockers) + `npm run outing:eval` (CI: `.github/workflows/outing-eval.yml`)
 * enforce this.
 *
 * ## Modes
 *
 * - **places** — AI picks ranked matching listings from a filtered DB pool
 * - **arc** — AI builds optional 2–3 stop itinerary for broad “plan my night out”
 * - Explore mood tiles + free-text both call `mode=ai` (no algorithm fallback)
 * - Non-food asks: **at most one meal restaurant**, but a cafe + hangout
 *   (and optional dessert) can sit alongside it. Food-first prompts
 *   (“burger places”, biryani, …) may return several restaurants.
 * - Gyms and travel agencies are hard-excluded from social moods
 *
 * ## Data backfill (ops)
 *
 * Budget filters only bite when `listings.min_price_per_person` /
 * `max_price_per_person` and guest capacity columns are filled. Prioritize
 * admin capacity entry for:
 * 1. fine-dining-buffets + romantic cafes (date night)
 * 2. entertainment-recreation + gaming-lounges-arcades (hangout / bowling)
 *
 * The Admin → Listing capacity page has shortcuts for those incomplete rows.
 * Until coverage improves, the planner soft-prefers priced in-budget rows and
 * surfaces `budgetNote` when most results lack prices.
 */

export { extractOutingIntent } from "@/lib/outing/intent";
export { GOLDEN_PROMPTS, coreGoldenPrompts } from "@/lib/outing/eval/golden-prompts";
