import { normalizeSearchText } from "@/lib/utils/places-search";

/** One stop role in an itinerary template. */
export type OutingSlot = {
  /** Role key used in AI prompts / fill logic (dinner, enjoy, sweet, …). */
  role: string;
  /** Short label for reasons / interpretation ("Dinner", "Something to do"). */
  label: string;
  /** Primary category slug to query. */
  categorySlug: string;
  /** Tried if primary returns nothing. */
  fallbackSlugs?: string[];
};

export type OutingTemplate = {
  vibeKey: string;
  /** Human title for interpretation, e.g. "Night out". */
  title: string;
  /** Arc summary shown in interpretation. */
  arcBlurb: string;
  /**
   * Phrases matched first (substring on normalized text). Longer / more specific
   * phrases should be listed before short tokens in the global match order.
   */
  phrases: string[];
  /** Ordered stop roles — plan prefers filling all of these (2–3). */
  slots: OutingSlot[];
};

/**
 * Vibe → ordered multi-stop itineraries.
 * Phrase match (longest first across templates) beats single-token noise.
 */
export const OUTING_TEMPLATES: OutingTemplate[] = [
  {
    vibeKey: "hangout",
    title: "Hangout",
    arcBlurb: "ranked hangout spots",
    phrases: [
      "hangout",
      "hang out",
      "chill with",
      "chill spot",
      "something fun",
      "fun place",
      "fun activity",
      "team outing",
      "khana nahi",
      "not a restaurant",
    ],
    slots: [
      {
        role: "place",
        label: "Hangout",
        categorySlug: "entertainment-recreation",
        fallbackSlugs: [
          "gaming-lounges-arcades",
          "live-music-comedy-venues",
          "parks-outdoor-spaces",
        ],
      },
    ],
  },
  {
    vibeKey: "date-night",
    title: "Date night",
    arcBlurb: "posh romantic picks",
    phrases: [
      "date night",
      "romantic",
      "anniversary",
      "first date",
      "girlfriend",
      "boyfriend",
      "for a couple",
    ],
    slots: [
      {
        role: "place",
        label: "Date spot",
        categorySlug: "fine-dining-buffets",
        fallbackSlugs: [
          "cafes-coworking-spots",
          "live-music-comedy-venues",
          "restaurants-cafes",
        ],
      },
    ],
  },
  {
    vibeKey: "bowling",
    title: "Bowling",
    arcBlurb: "bowling venues",
    phrases: ["bowling", "bowling alley"],
    slots: [
      {
        role: "place",
        label: "Bowling",
        categorySlug: "gaming-lounges-arcades",
        fallbackSlugs: ["entertainment-recreation"],
      },
    ],
  },
  {
    vibeKey: "night-out",
    title: "Night out",
    arcBlurb: "dinner, something to do, dessert",
    phrases: [
      "night out",
      "nightlife",
      "late night",
      "night life",
      "club",
      "party",
      "bar hop",
      "plan my night",
    ],
    slots: [
      {
        role: "dinner",
        label: "Dinner",
        categorySlug: "restaurants-cafes",
        fallbackSlugs: ["pakistani-desi-cuisine", "fine-dining-buffets"],
      },
      {
        role: "enjoy",
        label: "Something to do",
        categorySlug: "entertainment-recreation",
        fallbackSlugs: ["travel-tourism"],
      },
      {
        role: "sweet",
        label: "Dessert",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["juice-bars-beverages", "cafes-coworking-spots"],
      },
    ],
  },
  {
    vibeKey: "family-day",
    title: "Family day",
    arcBlurb: "activity, a meal, dessert",
    phrases: ["family day", "family", "kids", "children", "kid friendly"],
    slots: [
      {
        role: "do",
        label: "Activity",
        categorySlug: "entertainment-recreation",
        fallbackSlugs: ["venues-rentals"],
      },
      {
        role: "eat",
        label: "Meal",
        categorySlug: "restaurants-cafes",
        fallbackSlugs: ["fast-food-street-food", "pakistani-desi-cuisine"],
      },
      {
        role: "sweet",
        label: "Dessert",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["cafes-coworking-spots"],
      },
    ],
  },
  {
    vibeKey: "adventure",
    title: "Adventure",
    arcBlurb: "something active, then a bite, dessert",
    phrases: ["adventure", "outdoor", "outdoors", "park", "hike", "explore"],
    slots: [
      {
        role: "do",
        label: "Adventure",
        categorySlug: "entertainment-recreation",
        fallbackSlugs: ["travel-tourism"],
      },
      {
        role: "eat",
        label: "Bite to eat",
        categorySlug: "restaurants-cafes",
        fallbackSlugs: ["fast-food-street-food"],
      },
      {
        role: "sweet",
        label: "Dessert",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["juice-bars-beverages"],
      },
    ],
  },
  {
    vibeKey: "shopping",
    title: "Shopping run",
    arcBlurb: "shop, café break, a treat",
    phrases: ["shopping", "shop", "mall", "fashion", "clothes"],
    slots: [
      {
        role: "shop",
        label: "Shopping",
        categorySlug: "shopping-malls-outlets",
        fallbackSlugs: ["apparel-clothing"],
      },
      {
        role: "break",
        label: "Café break",
        categorySlug: "cafes-coworking-spots",
        fallbackSlugs: ["restaurants-cafes"],
      },
      {
        role: "sweet",
        label: "Treat",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["juice-bars-beverages"],
      },
    ],
  },
  {
    vibeKey: "self-care",
    title: "Self care",
    arcBlurb: "a treat for yourself, then a calm café, dessert",
    phrases: ["self care", "spa", "salon", "massage", "relax", "facial"],
    slots: [
      {
        role: "treat",
        label: "Self care",
        categorySlug: "salons-spas",
        fallbackSlugs: ["cosmetics-fragrances"],
      },
      {
        role: "cafe",
        label: "Calm café",
        categorySlug: "cafes-coworking-spots",
        fallbackSlugs: ["restaurants-cafes"],
      },
      {
        role: "sweet",
        label: "Dessert",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["juice-bars-beverages"],
      },
    ],
  },
  {
    vibeKey: "casual-food",
    title: "Casual food",
    arcBlurb: "a meal, another bite, dessert",
    phrases: [
      "coffee",
      "cafe",
      "cafes",
      "latte",
      "espresso",
      "cappuccino",
      "street food",
      "fast food",
      "burger",
      "pizza",
      "chaat",
      "desi",
      "pakistani",
      "biryani",
      "food",
      "eat",
      "eating",
      "bite",
      "lunch",
      "dinner",
      "breakfast",
      "hungry",
      "restaurant",
      "meal",
      "whtv",
      "whatever",
    ],
    slots: [
      {
        role: "eat",
        label: "Eat",
        categorySlug: "restaurants-cafes",
        fallbackSlugs: ["cafes-coworking-spots", "fast-food-street-food"],
      },
      {
        role: "second",
        label: "Another stop",
        categorySlug: "cafes-coworking-spots",
        fallbackSlugs: ["pakistani-desi-cuisine", "fast-food-street-food"],
      },
      {
        role: "sweet",
        label: "Dessert",
        categorySlug: "bakeries-desserts",
        fallbackSlugs: ["juice-bars-beverages"],
      },
    ],
  },
];

/** Default when nothing matches — still a proper 3-stop outing. */
export const DEFAULT_TEMPLATE: OutingTemplate = {
  vibeKey: "casual-food",
  title: "Outing",
  arcBlurb: "a meal, something nearby, dessert",
  phrases: [],
  slots: [
    {
      role: "eat",
      label: "Meal",
      categorySlug: "restaurants-cafes",
      fallbackSlugs: ["cafes-coworking-spots"],
    },
    {
      role: "do",
      label: "Something to do",
      categorySlug: "entertainment-recreation",
      fallbackSlugs: ["shopping-malls-outlets"],
    },
    {
      role: "sweet",
      label: "Dessert",
      categorySlug: "bakeries-desserts",
      fallbackSlugs: ["cafes-coworking-spots"],
    },
  ],
};

/** Karachi neighbourhood tokens — substring match on normalized prompt. */
export const AREA_TOKENS = [
  "clifton",
  "dha",
  "defence",
  "saddar",
  "gulshan",
  "pechs",
  "bahadurabad",
  "tariq road",
  "sea view",
  "seaview",
  "north nazimabad",
  "nazimabad",
  "korangi",
  "malir",
  "bahria",
  "askari",
  "gulberg",
  "johars",
  "johar",
  "scheme 33",
  "fb area",
  "federal b",
  "i i chundrigar",
  "burns road",
  "boat basin",
  "zamzama",
  "do talwar",
  "khayaban",
] as const;

export function extractArea(normalized: string): string | null {
  for (const token of AREA_TOKENS) {
    if (normalized.includes(token)) {
      if (token === "dha") return "DHA";
      if (token === "pechs") return "PECHS";
      if (token === "fb area") return "FB Area";
      return token
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return null;
}

function phraseMatches(normalized: string, phrase: string): boolean {
  const p = normalizeSearchText(phrase);
  if (!p) return false;
  if (p.includes(" ")) return normalized.includes(p);
  return normalized.split(" ").includes(p);
}

/**
 * All (template, phrase) pairs sorted by phrase length desc so
 * "night out" beats "night".
 */
const PHRASE_INDEX: Array<{ template: OutingTemplate; phrase: string }> = (() => {
  const entries: Array<{ template: OutingTemplate; phrase: string }> = [];
  for (const template of OUTING_TEMPLATES) {
    for (const phrase of template.phrases) {
      entries.push({ template, phrase });
    }
  }
  entries.sort(
    (a, b) =>
      normalizeSearchText(b.phrase).length - normalizeSearchText(a.phrase).length,
  );
  return entries;
})();

export type MatchedOuting = {
  normalized: string;
  area: string | null;
  template: OutingTemplate;
  interpretation: string;
};

/** Resolve prompt → vibe template + area + interpretation copy. */
export function matchOutingTemplate(prompt: string): MatchedOuting {
  const normalized = normalizeSearchText(prompt);
  const area = extractArea(normalized);

  let template = DEFAULT_TEMPLATE;
  for (const { template: t, phrase } of PHRASE_INDEX) {
    if (phraseMatches(normalized, phrase)) {
      template = t;
      break;
    }
  }

  // Coffee-specific: prefer café as first slot when coffee/cafe dominates.
  if (
    template.vibeKey === "casual-food" &&
    (phraseMatches(normalized, "coffee") ||
      phraseMatches(normalized, "cafe") ||
      phraseMatches(normalized, "latte") ||
      phraseMatches(normalized, "espresso"))
  ) {
    template = {
      ...template,
      title: "Coffee run",
      arcBlurb: "a café, another stop, dessert",
      slots: [
        {
          role: "cafe",
          label: "Café",
          categorySlug: "cafes-coworking-spots",
          fallbackSlugs: ["restaurants-cafes", "bakeries-desserts"],
        },
        {
          role: "eat",
          label: "Bite to eat",
          categorySlug: "restaurants-cafes",
          fallbackSlugs: ["fast-food-street-food"],
        },
        {
          role: "sweet",
          label: "Dessert",
          categorySlug: "bakeries-desserts",
          fallbackSlugs: ["juice-bars-beverages"],
        },
      ],
    };
  }

  const interpretation = area
    ? `${template.title}: ${template.arcBlurb} near ${area}`
    : `${template.title}: ${template.arcBlurb}`;

  return { normalized, area, template, interpretation };
}

/** Prefer 3, never more than 3. */
export const TARGET_STOPS = 3;
export const MIN_STOPS = 2;
export const MAX_STOPS = 3;
