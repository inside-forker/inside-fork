/**
 * Mobile page sections configuration types and defaults.
 *
 * Stored in `system_config` under `mobile.page_sections`.
 * Missing keys default to true so current behavior is unchanged until an admin turns something off.
 */

export const PAGE_SECTIONS_CONFIG_KEY = "mobile.page_sections";

export type HomePageSections = {
  opener: boolean;
  categories: boolean;
  spine: boolean;
  ending: boolean;
  budget: boolean;
  foryou: boolean;
  opennow: boolean;
  detour: boolean;
  feature: boolean;
  stat: boolean;
  wallet: boolean;
  neighbourhood: boolean;
};

export type ExplorePageSections = {
  browse: boolean;
  top: boolean;
  featured: boolean;
  justadded: boolean;
};

export type EventsPageSections = {
  featured: boolean;
  browse_type: boolean;
  venues: boolean;
  organisers: boolean;
};

export type DealsPageSections = {
  spotlight: boolean;
  my_cards: boolean;
  trending: boolean;
  banks: boolean;
};

export type PageSectionsConfig = {
  home: HomePageSections;
  explore: ExplorePageSections;
  events: EventsPageSections;
  deals: DealsPageSections;
};

export const DEFAULT_PAGE_SECTIONS_CONFIG: PageSectionsConfig = {
  home: {
    opener: true,
    categories: true,
    spine: true,
    ending: true,
    budget: true,
    foryou: true,
    opennow: true,
    detour: true,
    feature: true,
    stat: true,
    wallet: true,
    neighbourhood: true,
  },
  explore: {
    browse: true,
    top: true,
    featured: true,
    justadded: true,
  },
  events: {
    featured: true,
    browse_type: true,
    venues: true,
    organisers: true,
  },
  deals: {
    spotlight: true,
    my_cards: true,
    trending: true,
    banks: true,
  },
};

function parseBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true") return true;
  if (val === "false") return false;
  return fallback;
}

export function parsePageSectionsConfig(raw: unknown): PageSectionsConfig {
  if (raw == null) {
    return JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG));
  }

  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG));
    }
  }

  if (typeof value !== "object" || value === null) {
    return JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG));
  }

  const obj = value as Record<string, unknown>;
  const homeRaw = (typeof obj.home === "object" && obj.home !== null ? obj.home : {}) as Record<string, unknown>;
  const exploreRaw = (typeof obj.explore === "object" && obj.explore !== null ? obj.explore : {}) as Record<string, unknown>;
  const eventsRaw = (typeof obj.events === "object" && obj.events !== null ? obj.events : {}) as Record<string, unknown>;
  const dealsRaw = (typeof obj.deals === "object" && obj.deals !== null ? obj.deals : {}) as Record<string, unknown>;

  const def = DEFAULT_PAGE_SECTIONS_CONFIG;

  return {
    home: {
      opener: parseBoolean(homeRaw.opener, def.home.opener),
      categories: parseBoolean(homeRaw.categories, def.home.categories),
      spine: parseBoolean(homeRaw.spine, def.home.spine),
      ending: parseBoolean(homeRaw.ending, def.home.ending),
      budget: parseBoolean(homeRaw.budget, def.home.budget),
      foryou: parseBoolean(homeRaw.foryou, def.home.foryou),
      opennow: parseBoolean(homeRaw.opennow, def.home.opennow),
      detour: parseBoolean(homeRaw.detour, def.home.detour),
      feature: parseBoolean(homeRaw.feature, def.home.feature),
      stat: parseBoolean(homeRaw.stat, def.home.stat),
      wallet: parseBoolean(homeRaw.wallet, def.home.wallet),
      neighbourhood: parseBoolean(homeRaw.neighbourhood, def.home.neighbourhood),
    },
    explore: {
      browse: parseBoolean(exploreRaw.browse, def.explore.browse),
      top: parseBoolean(exploreRaw.top, def.explore.top),
      featured: parseBoolean(exploreRaw.featured, def.explore.featured),
      justadded: parseBoolean(exploreRaw.justadded, def.explore.justadded),
    },
    events: {
      featured: parseBoolean(eventsRaw.featured, def.events.featured),
      browse_type: parseBoolean(eventsRaw.browse_type, def.events.browse_type),
      venues: parseBoolean(eventsRaw.venues, def.events.venues),
      organisers: parseBoolean(eventsRaw.organisers, def.events.organisers),
    },
    deals: {
      spotlight: parseBoolean(dealsRaw.spotlight, def.deals.spotlight),
      my_cards: parseBoolean(dealsRaw.my_cards, def.deals.my_cards),
      trending: parseBoolean(dealsRaw.trending, def.deals.trending),
      banks: parseBoolean(dealsRaw.banks, def.deals.banks),
    },
  };
}

export function serializePageSectionsConfig(config: PageSectionsConfig): PageSectionsConfig {
  return parsePageSectionsConfig(config);
}
