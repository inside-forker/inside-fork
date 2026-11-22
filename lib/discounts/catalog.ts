/**
 * Data for the web /discounts page and GET /api/discounts.
 *
 * Reads the same compiled deals catalog as the app's Discounts tab
 * (lib/mobile/deals-catalog) plus the banks and the reader's saved cards,
 * then hands them to computeDiscounts (./compute) for matching, grouping and
 * the three sections.
 */
import { query } from "@/lib/db";
import { getCompiledCatalog } from "@/lib/mobile/deals-catalog";
import {
  computeDiscountDetail,
  computeDiscounts,
  prepareDeal,
  type ComputeDiscountsInput,
  type Prepared,
  type SavedCard,
} from "@/lib/discounts/compute";
import {
  shortBankName,
  type DiscountBank,
  type DiscountDetail,
  type DiscountTier,
  type DiscountView,
  type DiscountsResult,
} from "@/lib/discounts/types";

const CACHE_TTL_MS = 5 * 60 * 1000;

let preparedCache: { compiledAt: number; list: Prepared[]; offers: number; banks: number } | null =
  null;
let banksCache: { at: number; banks: DiscountBank[] } | null = null;

async function getPrepared() {
  const catalog = await getCompiledCatalog();
  if (preparedCache && preparedCache.compiledAt === catalog.compiledAt) return preparedCache;
  const list = catalog.deals.map(prepareDeal);
  const bankIds = new Set<number>();
  for (const p of list) for (const id of p.banks) bankIds.add(id);
  preparedCache = { compiledAt: catalog.compiledAt, list, offers: list.length, banks: bankIds.size };
  return preparedCache;
}

async function getBanks(): Promise<DiscountBank[]> {
  if (banksCache && Date.now() - banksCache.at < CACHE_TTL_MS) return banksCache.banks;
  const { rows } = await query(`SELECT id, name, logo_url FROM banks ORDER BY name ASC`);
  const banks = rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    short: shortBankName(String(r.name)),
    logo: (r.logo_url as string | null) || null,
  }));
  banksCache = { at: Date.now(), banks };
  return banks;
}

async function getSavedCards(userId: string): Promise<SavedCard[]> {
  const { rows } = await query(
    `SELECT uc.id, uc.card_variant_id, uc.nickname, cv.card_name, cv.image_filename,
            b.id AS bank_id, b.name AS bank_name
     FROM user_cards uc
     JOIN card_variants cv ON cv.id = uc.card_variant_id
     JOIN banks b ON b.id = cv.bank_id
     WHERE uc.user_id = $1
     ORDER BY uc.is_primary DESC, uc.created_at ASC`,
    [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    cardVariantId: Number(r.card_variant_id),
    bankId: Number(r.bank_id),
    cardName: String(r.card_name ?? "Card"),
    bankName: String(r.bank_name ?? ""),
    nickname: (r.nickname as string | null) || null,
    image: (r.image_filename as string | null) || null,
  }));
}

export interface LoadDiscountsOptions {
  userId: string | null;
  /** Page of the tier being paged (`view.tier`, or `pageTier`). */
  page?: number;
  /** Page this tier instead of `view.tier` (Show more on the three-section page). */
  pageTier?: DiscountTier | null;
}

async function computeInput(
  view: DiscountView,
  { userId, page = 1, pageTier = null }: LoadDiscountsOptions,
): Promise<ComputeDiscountsInput> {
  const [prepared, banks, savedCards] = await Promise.all([
    getPrepared(),
    getBanks(),
    userId ? getSavedCards(userId) : Promise.resolve([] as SavedCard[]),
  ]);
  return {
    list: prepared.list,
    banks,
    savedCards,
    signedIn: Boolean(userId),
    stats: { offers: prepared.offers, banks: prepared.banks },
    view,
    page,
    pageTier,
  };
}

export async function loadDiscounts(
  view: DiscountView,
  options: LoadDiscountsOptions,
): Promise<DiscountsResult> {
  return computeDiscounts(await computeInput(view, options));
}

/** One place's offers and branches for the deal sheet, scoped like the page. */
export async function loadDiscountDetail(
  view: DiscountView,
  key: string,
  options: LoadDiscountsOptions,
): Promise<DiscountDetail | null> {
  return computeDiscountDetail(await computeInput(view, options), key);
}

/** Every bank with its logo, for the page's logos and the add-card picker. */
export async function loadDiscountBanks(): Promise<DiscountBank[]> {
  const [prepared, banks] = await Promise.all([getPrepared(), getBanks()]);
  const withDeals = new Set<number>();
  for (const p of prepared.list) for (const id of p.banks) withDeals.add(id);
  return banks.filter((b) => withDeals.has(b.id));
}
