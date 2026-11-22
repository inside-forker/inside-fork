/**
 * The pure part of /discounts: match deals to saved cards, filter, fold
 * each brand into one item, split into the three sections and count the
 * filter menus. No database access (see ./catalog for that).
 *
 * Chains carry one deal per branch ("Pizza Max - Water Pump", "Pizza Max -
 * Shah Faisal" …) and often one per bank, at different discounts. Like the
 * app, the page shows each place once: the item leads with the brand's best
 * offer, and the deal sheet lists every offer and branch.
 */
import type { MobileDealPreviewDTO } from "@/lib/mobile/deals-feed";
import { brandStemFromListingName } from "@/lib/listings/borrowed-header-image";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  DISCOUNTS_PAGE_SIZE,
  DISCOUNTS_ROW_SIZE,
  DISCOUNT_CATEGORIES,
  shortBankName,
  type DiscountBank,
  type DiscountBranch,
  type DiscountDetail,
  type DiscountItem,
  type DiscountMenu,
  type DiscountOffer,
  type DiscountTab,
  type DiscountTier,
  type DiscountView,
  type DiscountsResult,
  type SavedCardSummary,
} from "@/lib/discounts/types";

/** Area names the address matcher spells two ways. */
const AREA_ALIASES: Record<string, string> = {
  Defence: "DHA",
  "Federal B": "FB Area",
};

export interface SavedCard {
  id: number;
  cardVariantId: number;
  bankId: number;
  cardName: string;
  bankName: string;
  nickname: string | null;
  image: string | null;
}

/** A catalog deal with everything the filters and grouping need, worked out once. */
export interface Prepared {
  deal: MobileDealPreviewDTO;
  /** The brand: every deal with the same key becomes one item. */
  key: string;
  /** The offer within the brand ("50", "upto-20", "special offer"). */
  offerKey: string;
  brand: string;
  branch: string | null;
  area: string | null;
  banks: number[];
  percent: number | null;
  upTo: boolean;
  text: string;
}

export function prepareDeal(deal: MobileDealPreviewDTO): Prepared {
  const merchant = deal.merchant.trim();
  const brand = brandStemFromListingName(merchant) ?? merchant;
  const dash = merchant.indexOf(" - ");
  const rawArea = deal.locationName;
  const area = rawArea ? (AREA_ALIASES[rawArea] ?? rawArea) : null;
  const branch = (dash >= 0 ? merchant.slice(dash + 3).trim() : "") || area;

  const banks: number[] = [];
  for (const id of [deal.bankId, ...deal.cardMatches.map((m) => m.bankId)]) {
    if (id != null && Number.isFinite(id) && id > 0 && !banks.includes(id)) banks.push(id);
  }

  const percent = deal.discountPercent;
  // "10–20%" and "Up to 30%" parse to their top figure; say so on the card.
  const upTo =
    percent != null &&
    /up\s*to|\d\s*[–-]\s*\d/i.test(deal.discountLabel.replace(/\s*off\b.*$/i, ""));
  const offerKey = percent != null ? `${upTo ? "upto-" : ""}${percent}` : deal.discountLabel.toLowerCase();

  return {
    deal,
    key: brand.toLowerCase(),
    offerKey,
    brand,
    branch,
    area,
    banks,
    percent,
    upTo,
    text: [merchant, deal.discountLabel, deal.blurb, deal.bankName ?? "", deal.category, area ?? ""]
      .join(" ")
      .toLowerCase(),
  };
}

/**
 * Which saved cards unlock a deal. Same rules as the app
 * (`matchingSavedCards`): an exact card product first, then any card from the
 * bank when the deal is bank-wide or names no product we know.
 */
function matchCards(deal: MobileDealPreviewDTO, cards: SavedCard[]): SavedCard[] {
  if (cards.length === 0) return [];
  const ids = new Set(deal.cardMatches.map((m) => m.cardVariantId).filter((id) => id > 0));
  const exact = cards.filter((c) => ids.has(c.cardVariantId));
  if (exact.length > 0) return exact;

  const placeholdersOnly =
    deal.cardMatches.length > 0 && deal.cardMatches.every((m) => !m.cardVariantId || m.cardVariantId <= 0);
  if (!deal.matchByBank && !placeholdersOnly) return [];
  const bankIds = new Set<number>();
  if (deal.bankId != null) bankIds.add(deal.bankId);
  for (const m of deal.cardMatches) if (Number.isFinite(m.bankId)) bankIds.add(m.bankId);
  return cards.filter((c) => bankIds.has(c.bankId));
}

/** "Meezan Platinum Visa Debit Card" → "Meezan Platinum Visa". */
function cardCaption(card: SavedCard): string {
  if (card.nickname) return card.nickname;
  const bank = shortBankName(card.bankName);
  const name = card.cardName.replace(/\s+(?:(?:debit|credit|prepaid)\s+)?card$/i, "").trim() || card.cardName;
  return name.toLowerCase().startsWith(bank.toLowerCase()) ? name : `${bank} ${name}`;
}

function countKeys(list: Prepared[]): number {
  const keys = new Set<string>();
  for (const p of list) keys.add(p.key);
  return keys.size;
}

/** Items per option of one filter, plus the "any" total. */
function menuFor(
  list: Prepared[],
  valuesOf: (p: Prepared) => (string | null)[],
  label: (value: string) => string | null,
): DiscountMenu {
  const byValue = new Map<string, Set<string>>();
  for (const p of list) {
    for (const v of valuesOf(p)) {
      if (!v) continue;
      let keys = byValue.get(v);
      if (!keys) byValue.set(v, (keys = new Set()));
      keys.add(p.key);
    }
  }
  const options = [...byValue.entries()]
    .map(([value, keys]) => ({ value, label: label(value) ?? "", count: keys.size }))
    .filter((o) => o.label);
  return { anyCount: countKeys(list), options };
}

function minDays(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null && v >= 0);
  return known.length > 0 ? Math.min(...known) : null;
}

function tierOf(percent: number | null): DiscountTier {
  return percent != null && percent >= 50 ? "half" : percent != null && percent >= 40 ? "forty" : "rest";
}

function listingKey(p: Prepared): string {
  return String(p.deal.listingId ?? p.deal.listingSlug ?? p.deal.id);
}

interface BuildContext {
  matched: Map<string, SavedCard[]> | null;
  scopeCards: SavedCard[];
  bankById: Map<number, DiscountBank>;
}

/** The card: the brand's best offer, who it is for and where. */
function summarize(group: Prepared[], ctx: BuildContext): DiscountItem {
  // The best offer leads: the highest %, a flat % over "up to", then the one at more branches.
  const byOffer = new Map<string, Prepared[]>();
  for (const p of group) {
    const deals = byOffer.get(p.offerKey);
    if (deals) deals.push(p);
    else byOffer.set(p.offerKey, [p]);
  }
  const branchCount = (deals: Prepared[]) => new Set(deals.map(listingKey)).size;
  let best: Prepared[] | null = null;
  for (const deals of byOffer.values()) {
    const diff = best
      ? (deals[0].percent ?? -1) - (best[0].percent ?? -1) ||
        Number(best[0].upTo) - Number(deals[0].upTo) ||
        branchCount(deals) - branchCount(best)
      : 1;
    if (diff > 0) best = deals;
  }
  const top = best ?? group;
  const lead = top[0];

  // Who the best offer is for: the reader's matching cards, or the banks.
  let logos: number[];
  let who: string | null;
  if (ctx.matched) {
    const cards: SavedCard[] = [];
    for (const p of top) {
      for (const c of ctx.matched.get(p.deal.id) ?? []) if (!cards.includes(c)) cards.push(c);
    }
    logos = [...new Set(cards.map((c) => c.bankId))].slice(0, 3);
    const everyCard = ctx.scopeCards.length > 1 && ctx.scopeCards.every((c) => cards.includes(c));
    who = everyCard
      ? ctx.scopeCards.length === 2
        ? "Both cards"
        : "All your cards"
      : [...new Set(cards.map((c) => shortBankName(c.bankName)))].join(", ") || null;
  } else {
    const banks: number[] = [];
    for (const p of top) for (const id of p.banks) if (!banks.includes(id)) banks.push(id);
    logos = banks.slice(0, 3);
    const names = banks.map((id) => ctx.bankById.get(id)?.short).filter((n): n is string => !!n);
    who = names.length > 2 ? `${names.length} banks` : names.join(", ") || null;
  }
  const topBranches = branchCount(top);
  const where = topBranches > 1 ? `${topBranches} branches` : lead.branch;
  const allBranches = branchCount(group);

  return {
    key: lead.key,
    brand: lead.brand,
    percent: lead.percent,
    upTo: lead.upTo,
    label: lead.deal.discountLabel,
    image: (top.find((p) => p.deal.imageUrl) ?? group.find((p) => p.deal.imageUrl))?.deal.imageUrl ?? null,
    category: lead.deal.category,
    logos,
    meta: [who, where].filter(Boolean).join(" · "),
    branchCount: allBranches,
    slug: allBranches === 1 ? (lead.deal.listingSlug ?? null) : null,
    endsInDays: minDays(top.map((p) => p.deal.expiryDaysLeft)),
  };
}

/** The sheet: the card plus every branch and every bank's offer, with its terms. */
function detailOf(group: Prepared[], ctx: BuildContext): DiscountDetail {
  const branches: DiscountBranch[] = [];
  const seenListings = new Set<string>();
  for (const p of group) {
    const id = listingKey(p);
    if (seenListings.has(id)) continue;
    seenListings.add(id);
    branches.push({ slug: p.deal.listingSlug ?? null, label: p.branch });
  }
  branches.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));

  const offersByKey = new Map<string, { offer: DiscountOffer; days: (number | null)[] }>();
  for (const p of group) {
    const bankId = p.deal.bankId ?? p.banks[0] ?? null;
    const k = `${bankId}|${p.offerKey}`;
    let entry = offersByKey.get(k);
    if (!entry) {
      entry = {
        offer: {
          bankId,
          percent: p.percent,
          upTo: p.upTo,
          label: p.deal.discountLabel,
          cards: [],
          terms: p.deal.terms.trim(),
          endsInDays: null,
        },
        days: [],
      };
      offersByKey.set(k, entry);
    }
    entry.days.push(p.deal.expiryDaysLeft);
    if (!p.deal.matchByBank) {
      for (const m of p.deal.cardMatches) {
        if (m.cardVariantId > 0 && !entry.offer.cards.includes(m.label)) entry.offer.cards.push(m.label);
      }
    }
  }
  const bankName = (id: number | null) => ctx.bankById.get(id ?? 0)?.name ?? "";
  const offers = [...offersByKey.values()]
    .map(({ offer, days }) => ({ ...offer, endsInDays: minDays(days) }))
    .sort(
      (a, b) =>
        (b.percent ?? -1) - (a.percent ?? -1) ||
        Number(a.upTo) - Number(b.upTo) ||
        bankName(a.bankId).localeCompare(bankName(b.bankId)),
    );

  return { ...summarize(group, ctx), branches, offers };
}

/**
 * Biggest discount first, then photos, then bigger chains. The black and
 * cream cards lead with a photo, so their sections put photos first.
 */
function compareItems(photoFirst: boolean) {
  return (a: DiscountItem, b: DiscountItem): number => {
    const photo = Number(Boolean(b.image)) - Number(Boolean(a.image));
    return (
      (photoFirst ? photo : 0) ||
      (b.percent ?? -1) - (a.percent ?? -1) ||
      photo ||
      b.branchCount - a.branchCount ||
      a.brand.localeCompare(b.brand)
    );
  };
}

export interface ComputeDiscountsInput {
  list: Prepared[];
  banks: DiscountBank[];
  savedCards: SavedCard[];
  signedIn: boolean;
  stats: { offers: number; banks: number };
  view: DiscountView;
  /** Page of the tier being paged (`view.tier`, or `pageTier`). */
  page?: number;
  /** Page this tier instead of `view.tier` (Show more on the three-section page). */
  pageTier?: DiscountTier | null;
}

/** The tab and deals in scope for a view, and its filters as predicates. */
function scopeFor({ list, banks, savedCards, view }: ComputeDiscountsInput) {
  const bankById = new Map(banks.map((b) => [b.id, b]));
  const tab: DiscountTab = savedCards.length > 0 && view.tab !== "all" ? "for-you" : "all";
  const card =
    tab === "for-you" && view.card != null && savedCards.some((c) => c.cardVariantId === view.card)
      ? view.card
      : null;
  const scopeCards = card != null ? savedCards.filter((c) => c.cardVariantId === card) : savedCards;

  // What the cards unlock on For you, everything on All.
  let scope = list;
  let matched: Map<string, SavedCard[]> | null = null;
  if (tab === "for-you") {
    matched = new Map();
    const kept: Prepared[] = [];
    for (const p of list) {
      const hits = matchCards(p.deal, scopeCards);
      if (hits.length === 0) continue;
      matched.set(p.deal.id, hits);
      kept.push(p);
    }
    scope = kept;
  }

  const q = sanitizeSearchTerm(view.filters.search).toLowerCase();
  const bank = tab === "all" && view.filters.bank ? Number(view.filters.bank) : null;
  const { category, area } = view.filters;
  const by = {
    search: (p: Prepared) => !q || p.text.includes(q),
    bank: (p: Prepared) => bank == null || p.banks.includes(bank),
    category: (p: Prepared) => !category || p.deal.category === category,
    area: (p: Prepared) => !area || p.area === area,
  };
  const matches = (p: Prepared) => by.search(p) && by.bank(p) && by.category(p) && by.area(p);

  return { bankById, tab, card, scope, ctx: { matched, scopeCards, bankById }, by, matches };
}

export function computeDiscounts(input: ComputeDiscountsInput): DiscountsResult {
  const { list, savedCards, signedIn, stats, view, page = 1, pageTier = null } = input;
  const { bankById, tab, card, scope, ctx, by, matches } = scopeFor(input);

  // Wallet counts, before filters.
  const perCard = new Map<number, Set<string>>(savedCards.map((c) => [c.id, new Set<string>()]));
  const allCards = new Set<string>();
  if (savedCards.length > 0) {
    for (const p of list) {
      const hits = matchCards(p.deal, savedCards);
      if (hits.length === 0) continue;
      allCards.add(p.key);
      for (const c of hits) perCard.get(c.id)?.add(p.key);
    }
  }

  // One item per brand, then the three sections.
  const groups = new Map<string, Prepared[]>();
  for (const p of scope) {
    if (!matches(p)) continue;
    const g = groups.get(p.key);
    if (g) g.push(p);
    else groups.set(p.key, [p]);
  }
  const tiers: Record<DiscountTier, DiscountItem[]> = { half: [], forty: [], rest: [] };
  for (const group of groups.values()) {
    const item = summarize(group, ctx);
    tiers[tierOf(item.percent)].push(item);
  }
  tiers.half.sort(compareItems(true));
  tiers.forty.sort(compareItems(true));
  tiers.rest.sort(compareItems(false));

  const paged = pageTier ?? view.tier;
  const start = (Math.max(1, page) - 1) * DISCOUNTS_PAGE_SIZE;
  const section = (t: DiscountTier) => {
    const all = tiers[t];
    let items: DiscountItem[];
    if (paged) items = paged === t ? all.slice(start, start + DISCOUNTS_PAGE_SIZE) : [];
    else items = all.slice(0, t === "rest" ? DISCOUNTS_PAGE_SIZE : DISCOUNTS_ROW_SIZE);
    return { count: all.length, items };
  };

  const menus = {
    bank:
      tab === "all"
        ? menuFor(
            scope.filter((p) => by.search(p) && by.category(p) && by.area(p)),
            (p) => p.banks.map(String),
            (v) => bankById.get(Number(v))?.name ?? null,
          )
        : { anyCount: 0, options: [] },
    category: menuFor(
      scope.filter((p) => by.search(p) && by.bank(p) && by.area(p)),
      (p) => [p.deal.category],
      (v) => DISCOUNT_CATEGORIES.find((c) => c.value === v)?.label ?? null,
    ),
    area: menuFor(
      scope.filter((p) => by.search(p) && by.bank(p) && by.category(p)),
      (p) => [p.area],
      (v) => v,
    ),
  };
  menus.bank.options.sort((a, b) => a.label.localeCompare(b.label));
  menus.category.options.sort(
    (a, b) =>
      DISCOUNT_CATEGORIES.findIndex((c) => c.value === a.value) -
      DISCOUNT_CATEGORIES.findIndex((c) => c.value === b.value),
  );
  menus.area.options.sort((a, b) => a.label.localeCompare(b.label));

  const cards: SavedCardSummary[] = savedCards.map((c) => ({
    id: c.id,
    cardVariantId: c.cardVariantId,
    bankId: c.bankId,
    name: cardCaption(c),
    image: c.image,
    count: perCard.get(c.id)?.size ?? 0,
  }));

  return {
    tab,
    card,
    signedIn,
    cards,
    allCardsCount: allCards.size,
    half: section("half"),
    forty: section("forty"),
    rest: section("rest"),
    menus,
    stats,
  };
}

/** One place's sheet, scoped like the page (same tab, card and filters). */
export function computeDiscountDetail(input: ComputeDiscountsInput, key: string): DiscountDetail | null {
  const { scope, ctx, matches } = scopeFor(input);
  const group = scope.filter((p) => p.key === key && matches(p));
  return group.length > 0 ? detailOf(group, ctx) : null;
}
