/**
 * Shapes and URL helpers shared by the /discounts page, its client browser
 * and GET /api/discounts. No server imports, so client components can use it.
 */

/** "For you" is what the reader's saved cards unlock; "All" is everything. */
export type DiscountTab = "for-you" | "all";

/** The three sections: half off or more, 40–49% off, and everything else. */
export type DiscountTier = "half" | "forty" | "rest";

export interface DiscountFilters {
  search: string;
  /** Bank id. Only applies on the All tab; on For you the cards decide. */
  bank: string | null;
  category: string | null;
  area: string | null;
}

export interface DiscountView {
  /** Null means "the default": For you when the reader has saved cards. */
  tab: DiscountTab | null;
  /** One saved card's `cardVariantId`, or null for all of the reader's cards. */
  card: number | null;
  /** A section opened with "See all", or null for the three-section page. */
  tier: DiscountTier | null;
  filters: DiscountFilters;
}

export const NO_DISCOUNT_FILTERS: DiscountFilters = {
  search: "",
  bank: null,
  category: null,
  area: null,
};

export interface DiscountBank {
  id: number;
  name: string;
  /** "Meezan Bank" → "Meezan". */
  short: string;
  logo: string | null;
}

export interface DiscountBranch {
  slug: string | null;
  /** "Water Pump" from "Pizza Max - Water Pump", else the area. */
  label: string | null;
}

/** One bank's offer at the place, for the deal sheet. */
export interface DiscountOffer {
  bankId: number | null;
  percent: number | null;
  upTo: boolean;
  /** The raw offer text, shown when there is no percentage. */
  label: string;
  /** Card products named in the offer. Empty means any card from the bank. */
  cards: string[];
  terms: string;
  endsInDays: number | null;
}

/**
 * One card on the page: a place (a chain counts once) led by its best offer.
 * The sheet loads its branches and every bank's offer as a DiscountDetail.
 */
export interface DiscountItem {
  key: string;
  brand: string;
  percent: number | null;
  /** The offer is a range or "up to" (10–20%), so it reads "Up to 20%". */
  upTo: boolean;
  /** The raw offer text, shown when there is no percentage. */
  label: string;
  image: string | null;
  category: string;
  /** Bank ids whose logos sit on the card (at most three). */
  logos: number[];
  /** "Meezan · 24 branches", "Both cards · DHA". */
  meta: string;
  /** Branches with any offer in scope. */
  branchCount: number;
  /** The place's page when there is a single branch. */
  slug: string | null;
  endsInDays: number | null;
}

/** The deal sheet's data: the card plus its branches and every bank's offer. */
export interface DiscountDetail extends DiscountItem {
  branches: DiscountBranch[];
  offers: DiscountOffer[];
}

export interface SavedCardSummary {
  id: number;
  cardVariantId: number;
  bankId: number;
  /** "Meezan Platinum Visa". */
  name: string;
  image: string | null;
  /** Items this card unlocks, before filters. */
  count: number;
}

export interface DiscountMenuOption {
  value: string;
  label: string;
  count: number;
}

export interface DiscountMenu {
  anyCount: number;
  options: DiscountMenuOption[];
}

export interface DiscountSection {
  count: number;
  items: DiscountItem[];
}

export interface DiscountsResult {
  /** The tab actually shown (For you falls back to All without cards). */
  tab: DiscountTab;
  /** The saved card in scope, or null for all of them. */
  card: number | null;
  signedIn: boolean;
  cards: SavedCardSummary[];
  /** Items all saved cards unlock, before filters. */
  allCardsCount: number;
  half: DiscountSection;
  forty: DiscountSection;
  rest: DiscountSection;
  menus: {
    bank: DiscountMenu;
    category: DiscountMenu;
    area: DiscountMenu;
  };
  stats: { offers: number; banks: number };
}

/** Items per page in "See all" and "Show more". */
export const DISCOUNTS_PAGE_SIZE = 24;
/** Items each carousel loads on the three-section page. */
export const DISCOUNTS_ROW_SIZE = 12;

export const DISCOUNT_CATEGORIES: { value: string; label: string }[] = [
  { value: "dining", label: "Dining" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "beauty", label: "Beauty" },
  { value: "hotels", label: "Hotels" },
  { value: "travel", label: "Travel" },
];

const TABS: DiscountTab[] = ["for-you", "all"];
const TIERS: DiscountTier[] = ["half", "forty", "rest"];

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
}

/** Reads the page or API query (`tab`, `card`, `tier`, `q`, `bank`, `category`, `area`). */
export function parseDiscountView(params: RawParams): DiscountView {
  const tab = first(params.tab);
  const card = first(params.card);
  const tier = first(params.tier);
  const bank = first(params.bank);
  const category = first(params.category);
  return {
    tab: tab && (TABS as string[]).includes(tab) ? (tab as DiscountTab) : null,
    card: card && /^\d+$/.test(card) ? Number(card) : null,
    tier: tier && (TIERS as string[]).includes(tier) ? (tier as DiscountTier) : null,
    filters: {
      search: (first(params.q) ?? "").slice(0, 80),
      bank: bank && /^\d+$/.test(bank) ? bank : null,
      category:
        category && DISCOUNT_CATEGORIES.some((c) => c.value === category) ? category : null,
      area: first(params.area)?.slice(0, 40) ?? null,
    },
  };
}

/** The query string for a view, empty values left out. Leads with "?" when not empty. */
export function discountViewToQuery(view: DiscountView, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (view.tab) params.set("tab", view.tab);
  if (view.card != null) params.set("card", String(view.card));
  if (view.tier) params.set("tier", view.tier);
  if (view.filters.search.trim()) params.set("q", view.filters.search.trim());
  if (view.filters.bank) params.set("bank", view.filters.bank);
  if (view.filters.category) params.set("category", view.filters.category);
  if (view.filters.area) params.set("area", view.filters.area);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** "Meezan Bank" → "Meezan", "UBL Bank" → "UBL". Names that don't end in "Bank" stay. */
export function shortBankName(name: string): string {
  return name.replace(/\s+Bank$/i, "").trim() || name;
}
