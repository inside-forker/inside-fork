import type { OutingOutputMode, OutingPrimaryNeed } from "@/lib/outing/intent";
import type { CategoryFamily } from "@/lib/outing/category-families";

/**
 * Golden answer contracts for Activity / outing planner.
 * Core fixtures (isCore) are merge blockers; the rest grow coverage.
 */

export type GoldenPromptFixture = {
  id: string;
  prompt: string;
  /** Core contracts must pass before merge. */
  isCore?: boolean;
  expect: {
    mode: OutingOutputMode;
    primaryNeed: OutingPrimaryNeed;
    excludeFood: boolean;
    partySize?: number | null;
    budgetMaxPkr?: number | null;
    activityKeywordsIncludes?: string[];
    allowCategoryFamilies?: CategoryFamily[];
    forbidCategoryFamilies?: CategoryFamily[];
  };
  resultAssertions?: {
    allPublished?: boolean;
    noFoodPad?: boolean;
    /** When inventory has matching keyword listings, top results must signal them. */
    requireActivityKeyword?: string;
  };
};

export const GOLDEN_PROMPTS: GoldenPromptFixture[] = [
  // ---- Core contracts (merge blockers) ----
  {
    id: "hangout-night",
    prompt: "i wanna hangout at night",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: true,
      allowCategoryFamilies: [
        "entertainment",
        "gaming",
        "live_music",
        "parks",
        "cinema",
      ],
      forbidCategoryFamilies: [
        "restaurants",
        "fast_food",
        "bakeries",
        "cafes",
        "fine_dining",
      ],
    },
    resultAssertions: { allPublished: true, noFoodPad: true },
  },
  {
    id: "date-night",
    prompt: "i need a date night",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "date",
      excludeFood: false,
      partySize: 2,
      allowCategoryFamilies: ["fine_dining", "cafes", "live_music", "restaurants"],
      forbidCategoryFamilies: ["fast_food"],
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "bowling",
    prompt: "i wanna go bowling",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "activity",
      excludeFood: true,
      activityKeywordsIncludes: ["bowling"],
      allowCategoryFamilies: ["gaming", "entertainment"],
      forbidCategoryFamilies: ["restaurants", "fast_food", "bakeries"],
    },
    resultAssertions: {
      allPublished: true,
      noFoodPad: true,
      requireActivityKeyword: "bowling",
    },
  },
  {
    id: "date-budget-12k",
    prompt: "date night with a budget of 12k",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "date",
      excludeFood: false,
      partySize: 2,
      budgetMaxPkr: 12000,
      allowCategoryFamilies: ["fine_dining", "cafes", "live_music", "restaurants"],
      forbidCategoryFamilies: ["fast_food"],
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "hangout-no-food-urdu",
    prompt: "hangout chahiye khana nahi",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: true,
      forbidCategoryFamilies: [
        "restaurants",
        "fast_food",
        "bakeries",
        "cafes",
        "fine_dining",
      ],
    },
    resultAssertions: { allPublished: true, noFoodPad: true },
  },
  {
    id: "biryani-food",
    prompt: "craving biryani nearby",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "food",
      excludeFood: false,
      allowCategoryFamilies: [
        "restaurants",
        "cafes",
        "fast_food",
        "bakeries",
        "fine_dining",
      ],
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "plan-night-out-arc",
    prompt: "plan my night out",
    isCore: true,
    expect: {
      mode: "arc",
      primaryNeed: "generic",
      excludeFood: false,
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "friends-visiting",
    prompt:
      "friends visiting Karachi — food, fun hangouts, impress guests, no tours",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "friends",
      excludeFood: false,
      partySize: 4,
      allowCategoryFamilies: [
        "entertainment",
        "cinema",
        "live_music",
        "fine_dining",
        "restaurants",
        "cafes",
        "shopping",
      ],
      forbidCategoryFamilies: ["tourism"],
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "family-day-mood",
    prompt: "family day out with kids",
    isCore: true,
    expect: {
      mode: "arc",
      primaryNeed: "family",
      excludeFood: false,
      forbidCategoryFamilies: ["tourism"],
    },
    resultAssertions: { allPublished: true },
  },
  {
    id: "late-night-mood",
    prompt: "late night open when the city winds down",
    isCore: true,
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: false,
      forbidCategoryFamilies: ["tourism"],
    },
    resultAssertions: { allPublished: true },
  },

  // ---- Extended corpus ----
  {
    id: "chill-friends",
    prompt: "somewhere to chill with friends tonight",
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: true,
      forbidCategoryFamilies: ["restaurants", "fast_food", "bakeries"],
    },
  },
  {
    id: "fun-not-restaurant",
    prompt: "fun place to hang, not a restaurant",
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: true,
      forbidCategoryFamilies: ["restaurants", "cafes", "fast_food", "bakeries"],
    },
  },
  {
    id: "posh-date",
    prompt: "posh date night in Karachi",
    expect: {
      mode: "places",
      primaryNeed: "date",
      excludeFood: false,
      partySize: 2,
      forbidCategoryFamilies: ["fast_food"],
    },
  },
  {
    id: "romantic-8k",
    prompt: "romantic evening for 2, budget 8k",
    expect: {
      mode: "places",
      primaryNeed: "date",
      partySize: 2,
      budgetMaxPkr: 8000,
      excludeFood: false,
    },
  },
  {
    id: "arcade",
    prompt: "arcade night with friends",
    expect: {
      mode: "places",
      primaryNeed: "activity",
      excludeFood: true,
      activityKeywordsIncludes: ["arcade"],
    },
  },
  {
    id: "cinema-date",
    prompt: "cinema date tonight",
    expect: {
      mode: "places",
      primaryNeed: "activity",
      excludeFood: true,
      activityKeywordsIncludes: ["cinema"],
    },
  },
  {
    id: "family-day",
    prompt: "family day out with toddlers",
    expect: {
      mode: "arc",
      primaryNeed: "family",
      excludeFood: false,
    },
  },
  {
    id: "spa-day",
    prompt: "spa day for myself",
    expect: {
      mode: "places",
      primaryNeed: "self_care",
      excludeFood: false,
      activityKeywordsIncludes: ["spa"],
    },
  },
  {
    id: "shopping",
    prompt: "shopping day at a mall",
    expect: {
      mode: "arc",
      primaryNeed: "shopping",
      excludeFood: false,
    },
  },
  {
    id: "urdu-date-expensive",
    prompt: "date pe jana hai thora expensive",
    expect: {
      mode: "places",
      primaryNeed: "date",
      excludeFood: false,
      partySize: 2,
    },
  },
  {
    id: "urdu-bowling",
    prompt: "bowling chalna hai bhai",
    expect: {
      mode: "places",
      primaryNeed: "activity",
      excludeFood: true,
      activityKeywordsIncludes: ["bowling"],
    },
  },
  {
    id: "urdu-12-hazar-date",
    prompt: "12 hazar tak ki date night",
    expect: {
      mode: "places",
      primaryNeed: "date",
      budgetMaxPkr: 12000,
      partySize: 2,
      excludeFood: false,
    },
  },
  {
    id: "hangout-dha",
    prompt: "late night hangout spot in DHA",
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      excludeFood: true,
      forbidCategoryFamilies: ["restaurants", "fast_food", "bakeries"],
    },
  },
  {
    id: "group-bowling-6",
    prompt: "bowling for a group of 6",
    expect: {
      mode: "places",
      primaryNeed: "activity",
      excludeFood: true,
      partySize: 6,
      activityKeywordsIncludes: ["bowling"],
    },
  },
  {
    id: "fine-dining-menu",
    prompt: "fine dining tasting menu",
    expect: {
      mode: "places",
      primaryNeed: "food",
      excludeFood: false,
      allowCategoryFamilies: ["fine_dining", "restaurants", "cafes"],
    },
  },
  {
    id: "coffee-work",
    prompt: "best cafe to work from in Bahadurabad",
    expect: {
      mode: "places",
      primaryNeed: "food",
      excludeFood: false,
    },
  },
  {
    id: "surprise-gf-10k",
    prompt: "surprise plan for girlfriend under 10k",
    expect: {
      mode: "places",
      primaryNeed: "date",
      budgetMaxPkr: 10000,
      partySize: 2,
      excludeFood: false,
    },
  },
  {
    id: "team-outing-12",
    prompt: "office team outing for 12 people",
    expect: {
      mode: "places",
      primaryNeed: "hangout",
      partySize: 12,
      excludeFood: true,
    },
  },

  // ---- Extended corpus (coverage growth; still declares contracts) ----
  { id: "hang-1", prompt: "lets hangout", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true, forbidCategoryFamilies: ["restaurants", "fast_food", "bakeries"] } },
  { id: "hang-2", prompt: "hang out tonight with the boys", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-3", prompt: "kuch maza ka batao", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-4", prompt: "bore ho raha hun interesting batao", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-5", prompt: "group hang in Clifton", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-6", prompt: "maza ka plan without food", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-7", prompt: "kill time this evening", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-8", prompt: "fun activity near me not dinner", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-9", prompt: "chill spot open late", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "hang-10", prompt: "vibe with friends after work", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },

  { id: "date-1", prompt: "romantic dinner date", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2, forbidCategoryFamilies: ["fast_food"] } },
  { id: "date-2", prompt: "anniversary night out for two", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-3", prompt: "first date ideas Karachi", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-4", prompt: "propose dinner spot", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-5", prompt: "classy date pe jana hai", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-6", prompt: "upscale romantic cafe", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-7", prompt: "boyfriend ke sath date night", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-8", prompt: "quiet dressy date spot", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-9", prompt: "luxury anniversary dinner", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "date-10", prompt: "for a couple evening plan", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },

  { id: "act-1", prompt: "go karting this weekend", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["go kart"] } },
  { id: "act-2", prompt: "paintball with friends", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["paintball"] } },
  { id: "act-3", prompt: "escape room challenge", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["escape room"] } },
  { id: "act-4", prompt: "snooker night", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["snooker"] } },
  { id: "act-5", prompt: "padel courts near me", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["padel"] } },
  { id: "act-6", prompt: "futsal for 10", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, partySize: 10, activityKeywordsIncludes: ["futsal"] } },
  { id: "act-7", prompt: "karaoke night", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["karaoke"] } },
  { id: "act-8", prompt: "trampoline park", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["trampoline"] } },
  { id: "act-9", prompt: "comedy show tonight", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["comedy"] } },
  { id: "act-10", prompt: "live music venue", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["live music"] } },
  { id: "act-11", prompt: "qawwali night", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["qawwali"] } },
  { id: "act-12", prompt: "cricket nets booking", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["cricket"] } },
  { id: "act-13", prompt: "amusement park day", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["amusement park"] } },
  { id: "act-14", prompt: "laser tag birthday", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["laser tag"] } },
  { id: "act-15", prompt: "movie night cinema", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["cinema"] } },

  { id: "bud-1", prompt: "date night under 15k", expect: { mode: "places", primaryNeed: "date", budgetMaxPkr: 15000, partySize: 2, excludeFood: false } },
  { id: "bud-2", prompt: "hangout budget of 5000", expect: { mode: "places", primaryNeed: "hangout", budgetMaxPkr: 5000, excludeFood: true } },
  { id: "bud-3", prompt: "bowling under 3k", expect: { mode: "places", primaryNeed: "activity", budgetMaxPkr: 3000, excludeFood: true, activityKeywordsIncludes: ["bowling"] } },
  { id: "bud-4", prompt: "romantic evening budget 20,000", expect: { mode: "places", primaryNeed: "date", budgetMaxPkr: 20000, partySize: 2, excludeFood: false } },
  { id: "bud-5", prompt: "posh dinner max 9k", expect: { mode: "places", primaryNeed: "date", budgetMaxPkr: 9000, excludeFood: false } },
  { id: "bud-6", prompt: "5 hazar tak hangout", expect: { mode: "places", primaryNeed: "hangout", budgetMaxPkr: 5000, excludeFood: true } },
  { id: "bud-7", prompt: "couple spa under 8k", expect: { mode: "places", primaryNeed: "date", budgetMaxPkr: 8000, partySize: 2, excludeFood: false } },
  { id: "bud-8", prompt: "family of 5 budget 10k", expect: { mode: "arc", primaryNeed: "family", budgetMaxPkr: 10000, partySize: 5, excludeFood: false } },
  { id: "bud-9", prompt: "arcade around 2k", expect: { mode: "places", primaryNeed: "activity", budgetMaxPkr: 2000, excludeFood: true, activityKeywordsIncludes: ["arcade"] } },
  { id: "bud-10", prompt: "night out under PKR 7000", expect: { mode: "arc", primaryNeed: "generic", budgetMaxPkr: 7000, excludeFood: false } },

  { id: "food-1", prompt: "best biryani in town", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-2", prompt: "craving pizza nearby", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-3", prompt: "hungry for burgers", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-4", prompt: "street food chaat", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-5", prompt: "brunch spots Sunday", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-6", prompt: "dessert after dinner", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-7", prompt: "coffee and latte nearby", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-8", prompt: "buffet lunch", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-9", prompt: "where to eat dinner", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
  { id: "food-10", prompt: "meal for the team", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },

  { id: "nofood-1", prompt: "something fun, no food", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "nofood-2", prompt: "activity not a restaurant", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "nofood-3", prompt: "hangout without food please", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "nofood-4", prompt: "no dinner just entertainment", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "nofood-5", prompt: "khana nahi sirf maza", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },

  { id: "night-1", prompt: "nightlife plan", expect: { mode: "arc", primaryNeed: "generic", excludeFood: false } },
  { id: "night-2", prompt: "bar hop tonight", expect: { mode: "arc", primaryNeed: "generic", excludeFood: false } },
  { id: "night-3", prompt: "club hop weekend", expect: { mode: "arc", primaryNeed: "generic", excludeFood: false } },
  { id: "night-4", prompt: "plan a night out in DHA", expect: { mode: "arc", primaryNeed: "generic", excludeFood: false } },

  { id: "fam-1", prompt: "kids zoo day", expect: { mode: "arc", primaryNeed: "family", excludeFood: false } },
  { id: "fam-2", prompt: "family outing with children", expect: { mode: "arc", primaryNeed: "family", excludeFood: false } },
  { id: "fam-3", prompt: "toddler friendly day", expect: { mode: "arc", primaryNeed: "family", excludeFood: false } },

  { id: "shop-1", prompt: "retail therapy shopping", expect: { mode: "arc", primaryNeed: "shopping", excludeFood: false } },
  { id: "shop-2", prompt: "clothes shopping mall", expect: { mode: "arc", primaryNeed: "shopping", excludeFood: false } },

  { id: "care-1", prompt: "salon day for myself", expect: { mode: "places", primaryNeed: "self_care", excludeFood: false } },
  { id: "care-2", prompt: "massage appointment", expect: { mode: "places", primaryNeed: "self_care", excludeFood: false } },
  { id: "care-3", prompt: "facial and self care", expect: { mode: "places", primaryNeed: "self_care", excludeFood: false } },

  { id: "urdu-1", prompt: "raat ko hangout chahiye", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "urdu-2", prompt: "date pe fancy jagah", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "urdu-3", prompt: "friends ke sath chill", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "urdu-4", prompt: "bowling alley mil jayega", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["bowling"] } },
  { id: "urdu-5", prompt: "biryani khani hai craving", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },

  { id: "party-1", prompt: "hangout for a group of 8", expect: { mode: "places", primaryNeed: "hangout", partySize: 8, excludeFood: true } },
  { id: "party-2", prompt: "party of 4 arcade", expect: { mode: "places", primaryNeed: "activity", partySize: 4, excludeFood: true, activityKeywordsIncludes: ["arcade"] } },
  { id: "party-3", prompt: "solo spa day", expect: { mode: "places", primaryNeed: "self_care", partySize: 1, excludeFood: false } },
  { id: "party-4", prompt: "just me cinema", expect: { mode: "places", primaryNeed: "activity", partySize: 1, excludeFood: true, activityKeywordsIncludes: ["cinema"] } },

  { id: "area-1", prompt: "hangout in Bahadurabad", expect: { mode: "places", primaryNeed: "hangout", excludeFood: true } },
  { id: "area-2", prompt: "date night near Clifton", expect: { mode: "places", primaryNeed: "date", excludeFood: false, partySize: 2 } },
  { id: "area-3", prompt: "bowling in DHA", expect: { mode: "places", primaryNeed: "activity", excludeFood: true, activityKeywordsIncludes: ["bowling"] } },
  { id: "area-4", prompt: "cafe to work from PECHS", expect: { mode: "places", primaryNeed: "food", excludeFood: false } },
];

export function coreGoldenPrompts(): GoldenPromptFixture[] {
  return GOLDEN_PROMPTS.filter((f) => f.isCore);
}
