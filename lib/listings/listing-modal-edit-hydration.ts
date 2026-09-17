import type { Database } from "@/types/database";
import type { BranchWithHours, ListingImage, OpeningHour } from "@/types/listing.types";

/** Menu graph returned by `/api/admin/listings/:id/menu` */
export type ListingModalMenuSection = {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  menu_items: Array<{
    id: number;
    name: string;
    description: string | null;
    price: number;
    is_available: boolean;
    is_featured: boolean;
    display_order: number;
    image_url: string | null;
    image_alt: string | null;
  }> | null;
};

type DealRow = Database["public"]["Tables"]["deals"]["Row"] & {
  banks?: {
    id: number;
    name: string;
    logo_url: string | null;
  } | null;
};

export type BankOption = {
  id: number;
  name: string;
  logo_url: string | null;
};

export type ListingEditModalHydrationPack = {
  menuSections: ListingModalMenuSection[];
  images: ListingImage[];
  openingHours: OpeningHour[];
  branchesWithHours: BranchWithHours[];
  deals: DealRow[];
  banks: BankOption[];
  categoryIds: number[];
};

const DEFAULT_OPENING_TEMPLATE: Omit<OpeningHour, "branch_id"> & {
  branch_id: null;
} = {
  dayOfWeek: 0,
  openTime: null,
  closeTime: null,
  isClosed: false,
  branch_id: null,
};

function defaultOpeningSevenDays(): OpeningHour[] {
  return Array.from({ length: 7 }, (_, dbDay) => ({
    ...DEFAULT_OPENING_TEMPLATE,
    dayOfWeek: dbDay,
  }));
}

type DBOpeningHour = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
  branch_id: number | null;
};

/** Maps listing-level opening_hours API rows into the modal's 7-day editor shape */
export function mapListingOpeningHoursFromApi(rows: unknown): OpeningHour[] {
  if (!Array.isArray(rows)) {
    return defaultOpeningSevenDays();
  }

  return Array.from({ length: 7 }, (_, dbDay) => {
    const dbRow = (rows as DBOpeningHour[]).find((row) => row.day_of_week === dbDay);
    return dbRow
      ? {
          dayOfWeek: dbRow.day_of_week,
          openTime: dbRow.open_time,
          closeTime: dbRow.close_time,
          isClosed: !!dbRow.is_closed,
          branch_id: dbRow.branch_id,
        }
      : {
          dayOfWeek: dbDay,
          openTime: null,
          closeTime: null,
          isClosed: false,
          branch_id: null,
        };
  });
}

async function fetchBranchesWithOpeningHours(
  listingId: number,
  signal: AbortSignal | undefined,
): Promise<BranchWithHours[]> {
  const response = await fetch(
    `/api/admin/listings/${listingId}/branches`,
    signal ? { signal } : {},
  );
  const data = (await response.json()) as {
    branches?: BranchWithHours[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch branches");
  }

  const rawBranches = data.branches || [];

  return Promise.all(
    rawBranches.map(async (branch): Promise<BranchWithHours> => {
      try {
        const hoursRes = await fetch(
          `/api/admin/listings/${listingId}/opening-hours?branch_id=${branch.id}`,
          signal ? { signal } : {},
        );
        if (hoursRes.ok) {
          const hoursData = (await hoursRes.json()) as {
            success?: boolean;
            data?: unknown;
          };
          return {
            ...branch,
            opening_hours: mapListingOpeningHoursFromApi(hoursData.data),
          };
        }
      } catch {
        /* fall through */
      }
      return { ...branch, opening_hours: [] };
    }),
  );
}

/** Align address / coords / hours with the primary branch (same semantics as ListingModal sync effect). */
export function mergePrimaryBranchIntoEditor(params: {
  baseFormLatitude: string;
  baseFormLongitude: string;
  baseFormAddress: string;
  openingHoursFromListingApi: OpeningHour[];
  branchesWithHours: BranchWithHours[];
}): {
  nextAddress: string;
  nextLatitude: string;
  nextLongitude: string;
  openingHours: OpeningHour[];
} {
  const primary = params.branchesWithHours.find((b) => b.is_primary);
  if (!primary) {
    return {
      nextAddress: params.baseFormAddress,
      nextLatitude: params.baseFormLatitude,
      nextLongitude: params.baseFormLongitude,
      openingHours: params.openingHoursFromListingApi,
    };
  }

  const openingHours =
    primary.opening_hours && primary.opening_hours.length > 0
      ? primary.opening_hours
      : params.openingHoursFromListingApi;

  return {
    nextAddress: primary.address,
    nextLatitude: String(primary.latitude),
    nextLongitude: String(primary.longitude),
    openingHours,
  };
}

async function safeFetchJson<T = Record<string, unknown>>(
  url: string,
  opts?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Loads edit-mode dependencies in parallel and returns a single hydrated pack.
 * All network calls respect `AbortSignal` for cancellation during listing switches or modal close.
 */
export async function loadListingEditModalHydration(
  listingId: number,
  options?: { signal?: AbortSignal },
): Promise<ListingEditModalHydrationPack> {
  const signal = options?.signal;
  const fetchOpts = signal ? { signal } : {};

  const [
    menuJson,
    imagesJson,
    hoursJson,
    branchesWithHours,
    dealsRaw,
    banksRaw,
    listingJson,
  ] = await Promise.all([
    safeFetchJson<Record<string, unknown>>(
      `/api/admin/listings/${listingId}/menu`,
      fetchOpts,
    ),
    safeFetchJson<Record<string, unknown>>(
      `/api/admin/listings/${listingId}/images`,
      fetchOpts,
    ),
    safeFetchJson<Record<string, unknown>>(
      `/api/admin/listings/${listingId}/opening-hours`,
      fetchOpts,
    ),
    fetchBranchesWithOpeningHours(listingId, signal).catch(() => []),
    safeFetchJson<{ deals?: DealRow[]; error?: string }>(
      `/api/admin/listings/${listingId}/deals`,
      fetchOpts,
    ),
    safeFetchJson<Record<string, unknown>>("/api/banks", fetchOpts),
    safeFetchJson<Record<string, unknown>>(
      `/api/admin/listings/${listingId}`,
      fetchOpts,
    ),
  ]);

  let menuSections: ListingModalMenuSection[] = [];
  if (menuJson && menuJson.success === true && Array.isArray(menuJson.data)) {
    menuSections = menuJson.data as ListingModalMenuSection[];
  }

  let images: ListingImage[] = [];
  if (imagesJson && imagesJson.success === true && Array.isArray(imagesJson.data)) {
    images = imagesJson.data as ListingImage[];
  }

  let openingHours = defaultOpeningSevenDays();
  if (hoursJson && hoursJson.success === true && Array.isArray(hoursJson.data)) {
    openingHours = mapListingOpeningHoursFromApi(hoursJson.data);
  }

  const deals: DealRow[] =
    dealsRaw && Array.isArray(dealsRaw.deals) ? dealsRaw.deals : [];

  let banks: BankOption[] = [];
  if (
    banksRaw &&
    banksRaw.success === true &&
    Array.isArray((banksRaw as { banks?: unknown[] }).banks)
  ) {
    banks = (
      banksRaw as {
        banks: Array<{
          value: string;
          label: string;
          logoUrl: string | null;
        }>;
      }
    ).banks.map((bank) => ({
      id: parseInt(bank.value, 10),
      name: bank.label,
      logo_url: bank.logoUrl,
    }));
  }

  let categoryIds: number[] = [];
  if (
    listingJson &&
    listingJson.success === true &&
    listingJson.data &&
    typeof listingJson.data === "object" &&
    "listing" in (listingJson.data as object)
  ) {
    const listing = (listingJson.data as { listing?: { category_ids?: unknown; category_id?: unknown } })
      .listing;
    if (Array.isArray(listing?.category_ids)) {
      categoryIds = listing.category_ids
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (listing?.category_id != null) {
      const n = Number(listing.category_id);
      if (Number.isFinite(n) && n > 0) categoryIds = [n];
    }
  }

  return {
    menuSections,
    images,
    openingHours,
    branchesWithHours,
    deals,
    banks,
    categoryIds,
  };
}
