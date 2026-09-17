import type { Listing, ListingFormData, CustomAttributes } from "@/types/listing.types";

/**
 * Canonical mapping from persisted listing fields to ListingModal controlled form state.
 */
/** Default form for "Create listing" before the user types anything. */
export function createEmptyListingFormData(): ListingFormData {
  return {
    name: "",
    description: "",
    address: "",
    phone_number: "",
    email: "",
    website: "",
    latitude: "",
    longitude: "",
    category_id: "",
    category_ids: [],
    custom_category: "",
    is_featured: false,
    status: "draft",
    show_member_badge: false,
    display_order: "",
    custom_attributes: null,
    owner_id: "",
    menu_pdf_url: null,
    parking_information: null,
    parking_amenities: null,
    facebook_url: "",
    instagram_url: "",
    whatsapp_number: "",
    youtube_url: "",
    google_maps_url: "",
  };
}

export function parseParkingAmenities(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const list = value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    return list.length > 0 ? list : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const list = parsed
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());
          return list.length > 0 ? list : null;
        }
      } catch {
        // ignore JSON parse error
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const list = trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
      return list.length > 0 ? list : null;
    }
    if (trimmed.includes(",")) {
      const list = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      return list.length > 0 ? list : null;
    }
    return [trimmed];
  }
  return null;
}

export function listingRowToListingFormData(listing: Listing): ListingFormData {
  return {
    name: listing.name || "",
    description: listing.description || "",
    address: listing.address || "",
    phone_number: listing.phone_number || "",
    email: listing.email || "",
    website: listing.website || "",
    latitude: listing.latitude?.toString() || "",
    longitude: listing.longitude?.toString() || "",
    category_id: listing.category_id?.toString() || "",
    category_ids:
      listing.category_ids && listing.category_ids.length > 0
        ? listing.category_ids.map(String)
        : listing.category_id != null
          ? [String(listing.category_id)]
          : [],
    custom_category:
      (listing.custom_attributes as CustomAttributes)?.custom_category || "",
    is_featured: listing.is_featured || false,
    status: listing.status || "draft",
    show_member_badge: listing.show_member_badge || false,
    display_order: listing.display_order?.toString() || "",
    custom_attributes: listing.custom_attributes
      ? ({
          ...(listing.custom_attributes as CustomAttributes),
          custom_category: undefined,
        } as CustomAttributes)
      : null,
    owner_id: listing.owner_id || "",
    menu_pdf_url: listing.menu_pdf_url || null,
    parking_information:
      (
        listing as unknown as {
          parking_information?: string | null;
        }
      ).parking_information ?? null,
    parking_amenities: parseParkingAmenities(
      (
        listing as unknown as {
          parking_amenities?: unknown;
        }
      ).parking_amenities
    ),
    facebook_url: listing.facebook_url || "",
    instagram_url: listing.instagram_url || "",
    whatsapp_number: listing.whatsapp_number || "",
    youtube_url: listing.youtube_url || "",
    google_maps_url: listing.google_maps_url || "",
  };
}
