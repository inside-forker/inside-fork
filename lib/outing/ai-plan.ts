import { MobileApiError } from "@/lib/mobile/errors";
import {
  buildCandidatePool,
  filterCandidates,
  pickForSlot,
} from "@/lib/outing/algorithm-plan";
import {
  diversityBucketCap,
  diversityBucketForFamily,
  familyForCategoryName,
  familyForSlug,
  isGymLikeListing,
  type OutingDiversityBucket,
} from "@/lib/outing/category-families";
import { MAX_STOPS, MIN_STOPS } from "@/lib/outing/templates";
import type { OutingPlanResponse, OutingPlanStopDTO } from "@/lib/outing/types";
import type { OutingListingCard } from "@/lib/outing/fetch-listings";
import type { ListingCardDTO } from "@/lib/mobile/mappers";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/** Override with GROQ_MODEL if needed. */
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";
const PLACES_PICK_TARGET = 5;
/** Keep prompts small — huge candidate lists make Groq return empty JSON. */
const MAX_CANDIDATES_FOR_LLM = 20;

type GroqPick = { id: number; role?: string; reason: string };
type GroqPlanJson = {
  interpretation?: string;
  picks?: GroqPick[];
};

function compactCandidate(l: ListingCardDTO, roles: string[]) {
  return {
    id: l.id,
    name: l.name,
    category: l.category_name,
    address: l.address,
    avg_rating: l.avg_rating,
    suggested_roles: roles,
  };
}

function parseGroqContent(raw: string): GroqPlanJson {
  let text = raw.trim();
  // Qwen may emit <think>...</think> (or unclosed) before the answer
  text = text
    .replace(/<think\b[^>]*>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/<\/?think\b[^>]*>/gi, "")
    .trim();
  // Strip markdown fences and common thinking wrappers
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  // If model prepended prose, take the first {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text) as GroqPlanJson;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("not an object");
  }
  if (!Array.isArray(parsed.picks)) {
    parsed.picks = [];
  }
  return parsed;
}

function listingBucket(listing: OutingListingCard): OutingDiversityBucket {
  const fam =
    familyForSlug(listing.category_slug) !== "other"
      ? familyForSlug(listing.category_slug)
      : familyForCategoryName(listing.category_name);
  return diversityBucketForFamily(fam);
}

function requireApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new MobileApiError(
      "ai_unavailable",
      "AI is not configured (missing GROQ_API_KEY).",
      503,
    );
  }
  return apiKey;
}

/**
 * Call Groq for structured JSON. Retries once without response_format when
 * json_validate_failed returns empty generation (common on some models).
 */
async function callGroqJson(
  system: string,
  userPayload: unknown,
): Promise<GroqPlanJson> {
  const apiKey = requireApiKey();
  const user =
    typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload);

  const attempt = async (useJsonObject: boolean): Promise<GroqPlanJson> => {
    // reasoning_effort "none" is required for reliable JSON — "default" dumps
    // <think> into content and often exhausts tokens before any JSON.
    const body: Record<string, unknown> = {
      model: GROQ_MODEL,
      temperature: 0.6,
      max_completion_tokens: 2048,
      top_p: 0.95,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    if (useJsonObject) {
      // With JSON mode, Groq requires reasoning_format parsed|hidden (not raw).
      body.response_format = { type: "json_object" };
      body.reasoning_format = "hidden";
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawBody = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("[outing/ai] Groq error", res.status, rawBody.slice(0, 400));
      const isJsonValidate =
        res.status === 400 && /json_validate_failed|Failed to validate JSON/i.test(rawBody);
      if (isJsonValidate && useJsonObject) {
        return attempt(false);
      }
      throw new MobileApiError(
        "ai_unavailable",
        "AI provider failed. Try again in a moment.",
        502,
      );
    }

    let json: {
      choices?: Array<{
        message?: { content?: string; reasoning?: string };
      }>;
    };
    try {
      json = JSON.parse(rawBody) as typeof json;
    } catch {
      throw new MobileApiError(
        "ai_unavailable",
        "AI returned a malformed response.",
        502,
      );
    }

    const message = json.choices?.[0]?.message;
    const content = message?.content?.trim()
      ? message.content
      : message?.reasoning?.trim()
        ? message.reasoning
        : "";
    if (!content.trim()) {
      if (useJsonObject) return attempt(false);
      throw new MobileApiError(
        "ai_unavailable",
        "AI returned an empty response.",
        502,
      );
    }

    try {
      return parseGroqContent(content);
    } catch {
      console.error("[outing/ai] bad JSON from Groq:", content.slice(0, 400));
      if (useJsonObject) return attempt(false);
      throw new MobileApiError(
        "ai_unavailable",
        "AI returned invalid JSON. Try again.",
        502,
      );
    }
  };

  return attempt(true);
}

async function callGroqPlaces(
  prompt: string,
  interpretationHint: string,
  primaryNeed: string,
  candidates: ListingCardDTO[],
): Promise<GroqPlanJson> {
  const capped = candidates.slice(0, MAX_CANDIDATES_FOR_LLM);
  const ids = capped.map((c) => c.id).join(", ");
  const pickCount = Math.min(PLACES_PICK_TARGET, capped.length);

  const system = `You are Inside Karachi's place recommender.
Return ONLY a valid JSON object. No markdown. No commentary. No thinking tags.
Schema:
{"interpretation":"string max 12 words","picks":[{"id":number,"reason":"string max 20 words"}]}

Rules:
- picks must have exactly ${pickCount} items
- every picks[].id must be one of: [${ids}]
- never invent ids
- mix categories: at most 1 restaurant/meal, optional 1 cafe, rest hangout/fun
- never pick gyms, fitness, travel agencies, tours, pharmacies
- reasons must be specific
- user mood: ${primaryNeed}
- hint: ${interpretationHint}`;

  return callGroqJson(system, {
    prompt,
    candidates: capped.map((c) => compactCandidate(c, ["place"])),
  });
}

async function callGroqArc(
  prompt: string,
  interpretationHint: string,
  roles: Array<{ role: string; label: string }>,
  candidates: ListingCardDTO[],
  roleByListingId: Map<number, string[]>,
): Promise<GroqPlanJson> {
  const capped = candidates.slice(0, MAX_CANDIDATES_FOR_LLM);
  const ids = capped.map((c) => c.id).join(", ");
  const roleList = roles.map((r) => `${r.role} (${r.label})`).join(" → ");
  const targetCount = Math.min(MAX_STOPS, Math.max(MIN_STOPS, roles.length));

  const system = `You are Inside Karachi's outing planner.
Return ONLY a valid JSON object. No markdown. No commentary. No thinking tags.
Schema:
{"interpretation":"string max 12 words","picks":[{"id":number,"role":"string","reason":"string max 20 words"}]}

Rules:
- picks must have exactly ${targetCount} items
- arc roles in order: ${roleList}
- every picks[].id must be one of: [${ids}]
- never invent ids
- never pick gyms, fitness, travel/tour agencies
- at most one meal restaurant
- hint: ${interpretationHint}`;

  return callGroqJson(system, {
    prompt,
    roles,
    candidates: capped.map((c) =>
      compactCandidate(c, roleByListingId.get(c.id) ?? []),
    ),
  });
}

function applyDiversityCap(
  picks: OutingPlanStopDTO[],
  allowManyFood: boolean,
): OutingPlanStopDTO[] {
  if (allowManyFood) return picks.slice(0, PLACES_PICK_TARGET);
  const counts: Record<OutingDiversityBucket, number> = {
    meal: 0,
    cafe: 0,
    sweet: 0,
    hangout: 0,
    other: 0,
  };
  const out: OutingPlanStopDTO[] = [];
  for (const stop of picks) {
    const listing = stop.listing as OutingListingCard;
    if (isGymLikeListing(listing)) continue;
    const bucket = listingBucket(listing);
    if (counts[bucket] >= diversityBucketCap(bucket)) continue;
    counts[bucket] += 1;
    out.push(stop);
    if (out.length >= PLACES_PICK_TARGET) break;
  }
  return out;
}

/**
 * AI outing plan: Groq picks from a filtered DB candidate pool (never invents ids).
 * No algorithm fallback — failures surface as ai_unavailable.
 */
export async function buildAiOutingPlan(
  prompt: string,
): Promise<OutingPlanResponse> {
  const { ctx, candidates, byRole } = await buildCandidatePool(prompt);
  const intent = ctx.intent;

  if (candidates.length === 0) {
    return {
      mode: "ai",
      interpretation: "No places found for that prompt",
      stops: [],
      intent: {
        mode: intent.mode,
        primaryNeed: intent.primaryNeed,
        excludeFood: intent.excludeFood,
        budgetMaxPkr: intent.budgetMaxPkr,
        partySize: intent.partySize,
      },
    };
  }

  // --- Places mode ---
  if (intent.mode === "places") {
    const safePool = filterCandidates(candidates, intent).filter(
      (l) => !isGymLikeListing(l),
    );
    if (safePool.length === 0) {
      return {
        mode: "ai",
        interpretation: "No matching places found for that vibe",
        stops: [],
        intent: {
          mode: intent.mode,
          primaryNeed: intent.primaryNeed,
          excludeFood: intent.excludeFood,
          budgetMaxPkr: intent.budgetMaxPkr,
          partySize: intent.partySize,
        },
      };
    }

    const groq = await callGroqPlaces(
      prompt,
      intent.interpretation,
      intent.primaryNeed,
      safePool,
    );
    const byId = new Map(safePool.map((c) => [c.id, c]));
    const rawStops: OutingPlanStopDTO[] = [];
    const used = new Set<number>();

    for (const pick of groq.picks ?? []) {
      const id = Number(pick.id);
      if (!Number.isFinite(id) || used.has(id)) continue;
      const listing = byId.get(id);
      if (!listing || isGymLikeListing(listing)) continue;
      used.add(id);
      const reason =
        typeof pick.reason === "string" && pick.reason.trim()
          ? pick.reason.trim().slice(0, 160)
          : "AI pick for your vibe";
      rawStops.push({ listing, role: "place", reason });
      if (rawStops.length >= PLACES_PICK_TARGET) break;
    }

    // Soft pad only from the same AI candidate pool if under-picked
    if (rawStops.length < Math.min(MIN_STOPS, safePool.length)) {
      for (const listing of safePool.slice(0, MAX_CANDIDATES_FOR_LLM)) {
        if (used.has(listing.id)) continue;
        used.add(listing.id);
        rawStops.push({
          listing,
          role: "place",
          reason: "Strong match from your mood",
        });
        if (rawStops.length >= PLACES_PICK_TARGET) break;
      }
    }

    if (rawStops.length === 0) {
      throw new MobileApiError(
        "ai_unavailable",
        "AI did not return usable place picks. Try again.",
        502,
      );
    }

    const stops = applyDiversityCap(
      rawStops,
      intent.primaryNeed === "food",
    );

    const interpretation =
      (typeof groq.interpretation === "string" && groq.interpretation.trim()
        ? groq.interpretation.trim().slice(0, 120)
        : null) ?? intent.interpretation;

    return {
      mode: "ai",
      interpretation,
      stops,
      intent: {
        mode: intent.mode,
        primaryNeed: intent.primaryNeed,
        excludeFood: intent.excludeFood,
        budgetMaxPkr: intent.budgetMaxPkr,
        partySize: intent.partySize,
      },
    };
  }

  // --- Arc mode ---
  const roles = ctx.slots.map((s) => ({ role: s.role, label: s.label }));
  const roleByListingId = new Map<number, string[]>();
  for (const [role, list] of byRole) {
    for (const l of list) {
      const prev = roleByListingId.get(l.id) ?? [];
      if (!prev.includes(role)) prev.push(role);
      roleByListingId.set(l.id, prev);
    }
  }

  const arcCandidates = candidates.filter((l) => !isGymLikeListing(l));
  if (arcCandidates.length === 0) {
    return {
      mode: "ai",
      interpretation: "No matching places found for that vibe",
      stops: [],
      intent: {
        mode: intent.mode,
        primaryNeed: intent.primaryNeed,
        excludeFood: intent.excludeFood,
        budgetMaxPkr: intent.budgetMaxPkr,
        partySize: intent.partySize,
      },
    };
  }

  const groq = await callGroqArc(
    prompt,
    ctx.interpretation,
    roles,
    arcCandidates,
    roleByListingId,
  );
  const byId = new Map(arcCandidates.map((c) => [c.id, c]));

  const stops: OutingPlanStopDTO[] = [];
  const used = new Set<number>();
  const filledRoles = new Set<string>();

  for (const pick of groq.picks ?? []) {
    const id = Number(pick.id);
    if (!Number.isFinite(id) || used.has(id)) continue;
    const listing = byId.get(id);
    if (!listing || isGymLikeListing(listing)) continue;
    const role =
      typeof pick.role === "string" && pick.role
        ? pick.role
        : roles.find((r) => !filledRoles.has(r.role))?.role;
    if (role && filledRoles.has(role)) continue;
    used.add(id);
    if (role) filledRoles.add(role);
    const reason =
      typeof pick.reason === "string" && pick.reason.trim()
        ? pick.reason.trim().slice(0, 160)
        : role
          ? `${role} stop · picked for your mood`
          : "Picked by AI for your mood";
    stops.push({ listing, role, reason });
    if (stops.length >= MAX_STOPS) break;
  }

  // Fill missing roles from the same filtered candidate pool (still AI path pool)
  for (const slot of ctx.slots) {
    if (stops.length >= MAX_STOPS) break;
    if (filledRoles.has(slot.role)) continue;
    if (intent.excludeFood && /dinner|eat|sweet|meal|cafe/.test(slot.role)) {
      continue;
    }
    const listing = await pickForSlot(slot, ctx.area, used, intent);
    if (!listing || isGymLikeListing(listing)) {
      const fromPool = (byRole.get(slot.role) ?? []).find(
        (l) => !used.has(l.id) && !isGymLikeListing(l),
      );
      if (!fromPool) continue;
      used.add(fromPool.id);
      filledRoles.add(slot.role);
      stops.push({
        listing: fromPool,
        role: slot.role,
        reason: `${slot.label} · AI candidate pool`,
      });
      continue;
    }
    used.add(listing.id);
    filledRoles.add(slot.role);
    stops.push({
      listing,
      role: slot.role,
      reason: `${slot.label} · AI candidate pool`,
    });
  }

  if (stops.length === 0) {
    throw new MobileApiError(
      "ai_unavailable",
      "AI did not return usable place picks. Try again.",
      502,
    );
  }

  const roleOrder = new Map(ctx.slots.map((s, i) => [s.role, i]));
  stops.sort((a, b) => {
    const ai = a.role != null ? (roleOrder.get(a.role) ?? 99) : 99;
    const bi = b.role != null ? (roleOrder.get(b.role) ?? 99) : 99;
    return ai - bi;
  });

  const interpretation =
    (typeof groq.interpretation === "string" && groq.interpretation.trim()
      ? groq.interpretation.trim().slice(0, 120)
      : null) ?? ctx.interpretation;

  return {
    mode: "ai",
    interpretation,
    stops: applyDiversityCap(stops.slice(0, MAX_STOPS), false),
    intent: {
      mode: intent.mode,
      primaryNeed: intent.primaryNeed,
      excludeFood: intent.excludeFood,
      budgetMaxPkr: intent.budgetMaxPkr,
      partySize: intent.partySize,
    },
  };
}
