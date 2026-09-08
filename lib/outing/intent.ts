import { normalizeSearchText } from "@/lib/utils/places-search";
import { extractArea } from "@/lib/outing/templates";
import {
  DATE_CATEGORY_SLUGS,
  FRIENDS_CATEGORY_SLUGS,
  HANGOUT_CATEGORY_SLUGS,
  type CategoryFamily,
} from "@/lib/outing/category-families";

export type OutingPrimaryNeed =
  | "hangout"
  | "friends"
  | "date"
  | "activity"
  | "food"
  | "family"
  | "self_care"
  | "shopping"
  | "generic";

export type OutingOutputMode = "places" | "arc";

export type OutingIntent = {
  mode: OutingOutputMode;
  primaryNeed: OutingPrimaryNeed;
  activityKeywords: string[];
  vibeTags: string[];
  area: string | null;
  budgetMaxPkr: number | null;
  partySize: number | null;
  timePreference: "night" | "day" | "now" | null;
  excludeFood: boolean;
  categorySlugs: string[];
  /** Human interpretation line for the UI. */
  interpretation: string;
};

type ActivityLexeme = {
  keywords: string[];
  categorySlugs: string[];
  label: string;
};

const ACTIVITY_LEXICON: ActivityLexeme[] = [
  {
    keywords: ["bowling", "bowling alley"],
    categorySlugs: ["gaming-lounges-arcades", "entertainment-recreation"],
    label: "Bowling",
  },
  {
    keywords: ["arcade", "gaming lounge", "game zone"],
    categorySlugs: ["gaming-lounges-arcades", "entertainment-recreation"],
    label: "Arcade",
  },
  {
    keywords: ["cinema", "movie", "movies"],
    categorySlugs: ["cinemas-amusement-parks"],
    label: "Cinema",
  },
  {
    keywords: ["karaoke"],
    categorySlugs: ["entertainment-recreation", "live-music-comedy-venues"],
    label: "Karaoke",
  },
  {
    keywords: ["go kart", "gokart", "karting"],
    categorySlugs: ["entertainment-recreation", "cinemas-amusement-parks"],
    label: "Go-karting",
  },
  {
    keywords: ["paintball", "laser tag"],
    categorySlugs: ["entertainment-recreation"],
    label: "Paintball",
  },
  {
    keywords: ["escape room"],
    categorySlugs: ["entertainment-recreation"],
    label: "Escape room",
  },
  {
    keywords: ["snooker", "pool hall", "billiard"],
    categorySlugs: ["gaming-lounges-arcades", "entertainment-recreation"],
    label: "Snooker",
  },
  {
    keywords: ["padel"],
    categorySlugs: ["padel-cricket-futsal-clubs"],
    label: "Padel",
  },
  {
    keywords: ["cricket", "nets"],
    categorySlugs: ["padel-cricket-futsal-clubs"],
    label: "Cricket",
  },
  {
    keywords: ["futsal"],
    categorySlugs: ["padel-cricket-futsal-clubs"],
    label: "Futsal",
  },
  {
    keywords: ["trampoline"],
    categorySlugs: ["entertainment-recreation", "cinemas-amusement-parks"],
    label: "Trampoline",
  },
  {
    keywords: ["amusement park", "theme park"],
    categorySlugs: ["cinemas-amusement-parks"],
    label: "Amusement park",
  },
  {
    keywords: ["qawwali"],
    categorySlugs: ["live-music-comedy-venues", "entertainment-recreation"],
    label: "Qawwali",
  },
  {
    keywords: ["comedy"],
    categorySlugs: ["live-music-comedy-venues"],
    label: "Comedy",
  },
  {
    keywords: ["live music", "gig", "concert"],
    categorySlugs: ["live-music-comedy-venues"],
    label: "Live music",
  },
];

const HANGOUT_PHRASES = [
  "hangout",
  "hang out",
  "hang with",
  "chill with",
  "chill spot",
  "to chill",
  "sath chill",
  "chill",
  "vibe with",
  "kill time",
  "something fun",
  "fun place",
  "fun activity",
  "team outing",
  "office team",
  "group hang",
  "maza ka",
  "kuch maza",
  "interesting batao",
  "bore ho",
];

const DATE_PHRASES = [
  "date night",
  "date pe",
  "date spot",
  "date ideas",
  "romantic",
  "anniversary",
  "propose",
  "girlfriend",
  "boyfriend",
  "first date",
  "couple spa",
  "for two",
  "for a couple",
];

const POSH_PHRASES = [
  "posh",
  "classy",
  "upscale",
  "fancy",
  "luxury",
  "fine dining",
  "expensive",
  "dressier",
  "dressy",
  "thora expensive",
];

const EXPLICIT_NO_FOOD = [
  "not a restaurant",
  "no restaurant",
  "no dinner",
  "not dinner",
  "no food",
  "khana nahi",
  "without food",
  "not food",
  "no meal",
];

const FOOD_PHRASES = [
  "biryani",
  "burger",
  "pizza",
  "chaat",
  "hungry",
  "craving",
  "brunch",
  "breakfast",
  "lunch",
  "dinner",
  "dessert",
  "coffee",
  "cafe",
  "café",
  "street food",
  "fast food",
  "fine dining",
  "tasting menu",
  "buffet",
  "eat",
  "meal",
];

/** Strong food asks that beat posh/date vibe. */
const STRONG_FOOD_PHRASES = [
  "biryani",
  "burger",
  "pizza",
  "chaat",
  "hungry",
  "craving",
  "tasting menu",
  "street food",
  "fast food",
  "buffet",
];

const FAMILY_PHRASES = ["family", "kids", "children", "toddler", "zoo"];
const SHOPPING_PHRASES = ["shopping", "mall", "retail", "clothes", "fashion"];
const SELF_CARE_PHRASES = ["self care", "spa", "salon", "massage", "facial"];
const FRIENDS_PHRASES = [
  "friends visiting",
  "out of town",
  "out-of-town",
  "impress guests",
  "show them karachi",
  "guests in town",
  "visiting karachi",
  "no tours",
];
const PEACE_PHRASES = ["need peace", "quiet", "peaceful", "slow down"];
const QUICK_PHRASES = ["one hour", "quick nearby", "something quick", "hour free"];
const NEW_PHRASES = ["recently added", "something new", "new places"];
const ARC_NIGHT_PHRASES = [
  "plan my night",
  "night out",
  "nightlife",
  "bar hop",
  "club hop",
];
const LATE_NIGHT_MOOD_PHRASES = ["late night open", "open when the city"];

function includesAny(normalized: string, phrases: string[]): boolean {
  return phrases.some((p) => {
    const n = normalizeSearchText(p);
    if (!n) return false;
    if (n.includes(" ")) return normalized.includes(n);
    // Whole-token match only — avoid "chill" hitting "chilled".
    return normalized.split(" ").includes(n);
  });
}

/** Parse PKR budgets: 12k, 12,000, under 15k, 12 hazar, budget of 8000. */
export function parseBudgetMaxPkr(normalized: string): number | null {
  const hazar = normalized.match(/(\d+(?:\.\d+)?)\s*hazar/);
  if (hazar) return Math.round(parseFloat(hazar[1]) * 1000);

  const k = normalized.match(
    /(?:budget|under|max|upto|up to|around|of)?\s*(?:rs|pkr)?\s*(\d+(?:\.\d+)?)\s*k\b/,
  );
  if (k) return Math.round(parseFloat(k[1]) * 1000);

  // normalizeSearchText turns "20,000" into "20 000"
  const spacedThousands = normalized.match(
    /(?:budget|under|max|upto|up to|around)\s*(?:of\s*)?(?:rs|pkr)?\s*(\d{1,3})\s+(\d{3})\b/,
  );
  if (spacedThousands) {
    return parseInt(spacedThousands[1] + spacedThousands[2], 10);
  }

  const plain = normalized.match(
    /(?:budget|under|max|upto|up to|around)\s*(?:of\s*)?(?:rs|pkr)?\s*(\d{3,6})\b/,
  );
  if (plain) return parseInt(plain[1], 10);

  const comma = normalized.match(/(\d{1,3}),(\d{3})\b/);
  if (comma) return parseInt(comma[1] + comma[2], 10);

  const spacedLoose = normalized.match(/\b(\d{1,3})\s+(\d{3})\b/);
  if (spacedLoose && /budget|under|max|upto|around|pkr|rs/.test(normalized)) {
    return parseInt(spacedLoose[1] + spacedLoose[2], 10);
  }

  return null;
}

export function parsePartySize(normalized: string): number | null {
  const groupOf = normalized.match(
    /(?:group of|for|party of|family of)\s*(\d{1,2})\b/,
  );
  if (groupOf) return parseInt(groupOf[1], 10);

  if (
    /\b(couple|for two|date night|romantic|girlfriend|boyfriend|first date)\b/.test(
      normalized,
    )
  ) {
    return 2;
  }
  if (/\b(solo|myself|just me)\b/.test(normalized)) return 1;
  return null;
}

function matchActivities(normalized: string): ActivityLexeme[] {
  const hits: ActivityLexeme[] = [];
  for (const lex of ACTIVITY_LEXICON) {
    if (lex.keywords.some((k) => normalized.includes(normalizeSearchText(k)))) {
      hits.push(lex);
    }
  }
  return hits;
}

function timePreference(
  normalized: string,
): OutingIntent["timePreference"] {
  if (/\b(now|right now|open now)\b/.test(normalized)) return "now";
  if (
    /\b(night|tonight|late|raat|midnight|1am|2am|after midnight)\b/.test(
      normalized,
    )
  ) {
    return "night";
  }
  if (/\b(morning|brunch|afternoon|daytime|sunday)\b/.test(normalized)) {
    return "day";
  }
  return null;
}

/**
 * Deterministic free-text → OutingIntent.
 * Longer / more specific intents win over generic "night" food arcs.
 */
export function extractOutingIntent(prompt: string): OutingIntent {
  const normalized = normalizeSearchText(prompt);
  const area = extractArea(normalized);
  const budgetMaxPkr = parseBudgetMaxPkr(normalized);
  let partySize = parsePartySize(normalized);
  const vibeTags: string[] = [];
  const time = timePreference(normalized);

  if (includesAny(normalized, POSH_PHRASES)) vibeTags.push("posh");
  if (includesAny(normalized, DATE_PHRASES)) vibeTags.push("romantic");
  if (time === "night") vibeTags.push("late");

  const activities = matchActivities(normalized);
  const hangout = includesAny(normalized, HANGOUT_PHRASES);
  const friends = includesAny(normalized, FRIENDS_PHRASES);
  const date = includesAny(normalized, DATE_PHRASES);
  const posh = includesAny(normalized, POSH_PHRASES);
  const strongFood = includesAny(normalized, STRONG_FOOD_PHRASES);
  const foodFirst =
    includesAny(normalized, FOOD_PHRASES) &&
    !hangout &&
    !friends &&
    activities.length === 0 &&
    !date &&
    !(posh && !strongFood);
  const family = includesAny(normalized, FAMILY_PHRASES);
  const shopping = includesAny(normalized, SHOPPING_PHRASES);
  const selfCare = includesAny(normalized, SELF_CARE_PHRASES);
  const peace = includesAny(normalized, PEACE_PHRASES);
  const quick = includesAny(normalized, QUICK_PHRASES);
  const somethingNew = includesAny(normalized, NEW_PHRASES);
  const lateNightMood = includesAny(normalized, LATE_NIGHT_MOOD_PHRASES);
  const broadNightOut =
    includesAny(normalized, ARC_NIGHT_PHRASES) &&
    !hangout &&
    !friends &&
    !date &&
    activities.length === 0;

  // --- Friends visiting / impress guests (food + fun, no tours) ---
  if (friends && !date) {
    if (partySize == null) partySize = 4;
    return {
      mode: "places",
      primaryNeed: "friends",
      activityKeywords: [],
      vibeTags: [...vibeTags, "guests"],
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: [...FRIENDS_CATEGORY_SLUGS],
      interpretation: area
        ? `Guest-worthy picks near ${area}`
        : "Impress out-of-town guests",
    };
  }

  // --- Self-care before generic activity lexicon (spa is not a "hangout") ---
  if (selfCare && !date) {
    return {
      mode: "places",
      primaryNeed: "self_care",
      activityKeywords: ["spa", "salon", "massage"],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: ["salons-spas"],
      interpretation: "Self-care picks",
    };
  }

  // --- Quiet / need peace ---
  if (peace && !hangout && !date) {
    return {
      mode: "places",
      primaryNeed: "hangout",
      activityKeywords: [],
      vibeTags: [...vibeTags, "quiet"],
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: [
        "parks-outdoor-spaces",
        "cafes-coworking-spots",
        "salons-spas",
      ],
      interpretation: "Quiet spots to slow down",
    };
  }

  // --- One hour free / quick ---
  if (quick && !hangout && !date && activities.length === 0) {
    return {
      mode: "places",
      primaryNeed: "hangout",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time ?? "now",
      excludeFood: false,
      categorySlugs: [
        "cafes-coworking-spots",
        "bakeries-desserts",
        "juice-bars-beverages",
        "fast-food-street-food",
      ],
      interpretation: "Quick things nearby",
    };
  }

  // --- Late night mood (food + hang allowed) ---
  if (lateNightMood) {
    return {
      mode: "places",
      primaryNeed: "hangout",
      activityKeywords: [],
      vibeTags: [...vibeTags, "late"],
      area,
      budgetMaxPkr,
      partySize,
      timePreference: "night",
      excludeFood: false,
      categorySlugs: [
        "entertainment-recreation",
        "restaurants-cafes",
        "pakistani-desi-cuisine",
        "bakeries-desserts",
        "live-music-comedy-venues",
      ],
      interpretation: "Late-night picks still open",
    };
  }

  // --- Something new ---
  if (somethingNew) {
    return {
      mode: "places",
      primaryNeed: "generic",
      activityKeywords: [],
      vibeTags: [...vibeTags, "new"],
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: [
        "restaurants-cafes",
        "entertainment-recreation",
        "cafes-coworking-spots",
        "cinemas-amusement-parks",
      ],
      interpretation: "Recently added spots",
    };
  }

  // --- Activity-specific (bowling, etc.) ---
  if (activities.length > 0 && !foodFirst) {
    const primary = activities[0];
    const keywords = activities.flatMap((a) => a.keywords);
    const categorySlugs = [
      ...new Set(activities.flatMap((a) => a.categorySlugs)),
    ];
    if (partySize == null && /group|friends|boys/.test(normalized)) {
      partySize = 4;
    }
    return {
      mode: "places",
      primaryNeed: "activity",
      activityKeywords: keywords,
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: true,
      categorySlugs,
      interpretation: area
        ? `${primary.label} near ${area}`
        : `${primary.label} picks`,
    };
  }

  // --- Hangout / chill (no food) ---
  if (hangout || includesAny(normalized, EXPLICIT_NO_FOOD)) {
    return {
      mode: "places",
      primaryNeed: "hangout",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time ?? "night",
      excludeFood: true,
      categorySlugs: [...HANGOUT_CATEGORY_SLUGS],
      interpretation: area
        ? `Hangout spots near ${area}`
        : time === "night"
          ? "Late hangout spots"
          : "Hangout spots",
    };
  }

  // --- Date night / romantic / posh date ---
  if (date || (posh && !strongFood)) {
    // "posh dinner" → date; "fine dining tasting menu" → strongFood → food path
    if (partySize == null) partySize = 2;
    return {
      mode: "places",
      primaryNeed: "date",
      activityKeywords: [],
      vibeTags: [...new Set([...vibeTags, "romantic", "posh"])],
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time ?? "night",
      excludeFood: false,
      categorySlugs: [...DATE_CATEGORY_SLUGS],
      interpretation: budgetMaxPkr
        ? `Date-night picks under ~PKR ${budgetMaxPkr.toLocaleString("en-PK")}`
        : area
          ? `Date-night picks near ${area}`
          : "Posh date-night picks",
    };
  }

  // --- Food-first ---
  if (foodFirst) {
    const coffee = /\b(coffee|cafe|latte|espresso)\b/.test(normalized);
    const fine = /\b(fine dining|tasting menu)\b/.test(normalized);
    return {
      mode: "places",
      primaryNeed: "food",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: coffee
        ? ["cafes-coworking-spots", "bakeries-desserts", "restaurants-cafes"]
        : fine
          ? ["fine-dining-buffets", "restaurants-cafes"]
          : [
              "restaurants-cafes",
              "pakistani-desi-cuisine",
              "fast-food-street-food",
              "fine-dining-buffets",
              "bakeries-desserts",
            ],
      interpretation: area ? `Food picks near ${area}` : "Food picks",
    };
  }

  if (shopping) {
    return {
      mode: "arc",
      primaryNeed: "shopping",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: time,
      excludeFood: false,
      categorySlugs: ["shopping-malls-outlets", "apparel-clothing"],
      interpretation: "Shopping outing",
    };
  }

  if (family) {
    return {
      mode: "arc",
      primaryNeed: "family",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize: partySize ?? 4,
      timePreference: time,
      excludeFood: false,
      categorySlugs: [
        "entertainment-recreation",
        "parks-outdoor-spaces",
        "cinemas-amusement-parks",
        "restaurants-cafes",
      ],
      interpretation: "Family day plan",
    };
  }

  if (broadNightOut) {
    return {
      mode: "arc",
      primaryNeed: "generic",
      activityKeywords: [],
      vibeTags,
      area,
      budgetMaxPkr,
      partySize,
      timePreference: "night",
      excludeFood: false,
      categorySlugs: [
        "restaurants-cafes",
        "entertainment-recreation",
        "bakeries-desserts",
      ],
      interpretation: area
        ? `Night out near ${area}: dinner, something to do, dessert`
        : "Night out: dinner, something to do, dessert",
    };
  }

  // Default: places from entertainment + food, but prefer places mode with mixed cats
  return {
    mode: "arc",
    primaryNeed: "generic",
    activityKeywords: [],
    vibeTags,
    area,
    budgetMaxPkr,
    partySize,
    timePreference: time,
    excludeFood: false,
    categorySlugs: [
      "restaurants-cafes",
      "entertainment-recreation",
      "bakeries-desserts",
    ],
    interpretation: area ? `Outing near ${area}` : "Outing plan",
  };
}

/** Families that must not appear when excludeFood is true. */
export function forbidFamiliesForIntent(
  intent: OutingIntent,
): CategoryFamily[] {
  if (intent.excludeFood) {
    return ["restaurants", "cafes", "fast_food", "bakeries", "fine_dining"];
  }
  if (intent.primaryNeed === "date") {
    return ["fast_food", "tourism"];
  }
  if (
    intent.primaryNeed === "friends" ||
    intent.primaryNeed === "hangout" ||
    intent.primaryNeed === "family" ||
    intent.primaryNeed === "activity"
  ) {
    return ["tourism"];
  }
  return [];
}

export function allowFamiliesForIntent(
  intent: OutingIntent,
): CategoryFamily[] {
  switch (intent.primaryNeed) {
    case "hangout":
      return ["entertainment", "gaming", "live_music", "parks", "cinema", "sports"];
    case "friends":
      return [
        "entertainment",
        "cinema",
        "live_music",
        "fine_dining",
        "restaurants",
        "cafes",
        "shopping",
      ];
    case "date":
      return ["fine_dining", "cafes", "live_music", "restaurants"];
    case "activity":
      return ["gaming", "entertainment", "cinema", "live_music", "parks", "sports"];
    case "food":
      return ["restaurants", "cafes", "fast_food", "bakeries", "fine_dining"];
    case "self_care":
      return ["self_care", "cafes"];
    case "shopping":
      return ["shopping", "cafes"];
    case "family":
      return ["entertainment", "parks", "cinema", "restaurants", "cafes"];
    default:
      return [];
  }
}
