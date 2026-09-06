/**
 * Row -> DTO mappers for the mobile API. These enforce the contract's redaction
 * rules in one place: no `select("*")` pass-through ever reaches the client, and
 * other users' auth UUIDs are never exposed (only `is_own` + display fields).
 */
import type { Database, Json } from "@/types/database";
import type {
  NotificationFeedItem,
  NotificationChannel,
  NotificationPriority,
} from "@/types/notifications.types";

export type ListingImageDTO = {
  id: number;
  url: string;
  alt_text: string | null;
  display_order: number | null;
  is_primary: boolean | null;
};

export type ListingCardDTO = {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  address: string | null;
  category_id: number | null;
  category_name: string | null;
  latitude: number | null;
  longitude: number | null;
  avg_rating: number | null;
  review_count: number | null;
  is_featured: boolean | null;
  status: string | null;
  menu_pdf_url: string | null;
  google_maps_url: string | null;
  images: ListingImageDTO[];
  /** Outing / capacity enrichment (optional; not on every card endpoint). */
  min_price_per_person?: number | null;
  max_price_per_person?: number | null;
  min_guest_capacity?: number | null;
  max_guest_capacity?: number | null;
};

/**
 * Row subset for a ListingCard, derived from the generated `listings_with_details`
 * view Row so the compiler validates every column name (a renamed/removed column
 * fails to compile rather than silently yielding nulls). Keep in sync with
 * {@link LISTING_CARD_COLUMNS}.
 */
export type ListingRowLike = Pick<
  Database["public"]["Views"]["listings_with_details"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "description"
  | "address"
  | "category_id"
  | "category_name"
  | "latitude"
  | "longitude"
  | "avg_rating"
  | "review_count"
  | "is_featured"
  | "status"
  | "menu_pdf_url"
  | "google_maps_url"
>;

/** Explicit column list for `listings_with_details` - never use `*`. */
export const LISTING_CARD_COLUMNS =
  "id, name, slug, description, address, category_id, category_name, latitude, longitude, avg_rating, review_count, is_featured, status, menu_pdf_url, google_maps_url";

export function toListingImage(row: {
  id: number;
  url: string;
  alt_text: string | null;
  display_order: number | null;
  is_primary: boolean | null;
}): ListingImageDTO {
  return {
    id: row.id,
    url: row.url,
    alt_text: row.alt_text,
    display_order: row.display_order,
    is_primary: row.is_primary,
  };
}

/**
 * `id`/`category_id`/`review_count`/`avg_rating` come back as strings from pg
 * for bigint/numeric columns - a bare `as` cast doesn't convert them, it just
 * asserts the (wrong) type. A past bug round-tripped a stringified `id` into
 * POST /reviews' `listing_id` (which expects a number) after the client
 * echoed it back - always run a raw card row through this before mapping it.
 */
export function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

export function toListingCard(
  row: ListingRowLike,
  images: ListingImageDTO[],
): ListingCardDTO {
  return {
    id: row.id as number,
    name: row.name,
    slug: row.slug,
    description: row.description,
    address: row.address,
    category_id: row.category_id,
    category_name: row.category_name,
    latitude: row.latitude,
    longitude: row.longitude,
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    is_featured: row.is_featured,
    status: row.status,
    menu_pdf_url: row.menu_pdf_url,
    google_maps_url: row.google_maps_url,
    images,
  };
}

export type ReviewDTO = {
  id: number;
  listing_id: number | null;
  branch_id: number | null;
  is_own: boolean;
  rating: number | null;
  comment: string | null;
  status: string | null;
  helpful_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  author: { username: string | null; avatar_url: string | null };
};

type ReviewProfileJoin =
  | { username: string | null; avatar_url: string | null }
  | { username: string | null; avatar_url: string | null }[]
  | null;

// Base columns derived from the generated `reviews` Row so the compiler
// validates every column name; the embedded `profiles` join is appended
// structurally (same approach as CommentRowLike).
export type ReviewRowLike = Pick<
  Database["public"]["Tables"]["reviews"]["Row"],
  | "id"
  | "listing_id"
  | "branch_id"
  | "user_id"
  | "rating"
  | "comment"
  | "status"
  | "helpful_count"
  | "created_at"
  | "updated_at"
> & { profiles: ReviewProfileJoin };

/** Columns for a review - note `user_id` is read for `is_own` but never emitted. */
export const REVIEW_COLUMNS =
  "id, listing_id, branch_id, user_id, rating, comment, status, helpful_count, created_at, updated_at, profiles:profiles!user_id(username, avatar_url)";

/** Default number of approved reviews embedded in a detail response preview. */
export const REVIEW_PREVIEW_LIMIT = 5;

/**
 * Maps a review row to the public DTO. The reviewer's `user_id` (auth UUID) is
 * intentionally dropped; identity is exposed only as username + avatar (handle,
 * not real name - section 1.1.3), plus a server-computed `is_own` for the caller.
 */
export function toReview(
  row: ReviewRowLike,
  currentUserId: string | null,
): ReviewDTO {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    listing_id: row.listing_id,
    branch_id: row.branch_id,
    is_own: currentUserId != null && row.user_id === currentUserId,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    helpful_count: row.helpful_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: {
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
  };
}

/**
 * EventCard - the public projection of `events_with_details`. Events are
 * self-contained: location is the event's own `location_name`/`address`/
 * coordinates (events are no longer linked to listings or venues). `organizer_id`
 * (a user auth UUID) is deliberately excluded per section 1.1.3; organizers appear as
 * `organizer_name` + `organizer_avatar` only.
 */
export type AttendeePreviewDTO = { username: string | null; avatar_url: string | null };

export type EventCardDTO = {
  event_id: number | null;
  event_name: string | null;
  event_slug: string | null;
  event_description: string | null;
  event_status: Database["public"]["Enums"]["post_status"] | null;
  start_time: string | null;
  end_time: string | null;
  is_featured: boolean | null;
  organizer_name: string | null;
  organizer_avatar: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url?: string | null;
  /** "N people going" preview, based on paid ticket bookings. Omitted (not
   * just empty) when the caller doesn't pass one in, e.g. the detail route. */
  attendees_preview?: AttendeePreviewDTO[];
  attendees_count?: number;
};

/**
 * Row subset for an EventCard, derived from the generated view Row so the
 * compiler validates every column name (a phantom column fails to compile).
 */
export type EventCardRow = Pick<
  Database["public"]["Views"]["events_with_details"]["Row"],
  | "event_id"
  | "event_name"
  | "event_slug"
  | "event_description"
  | "event_status"
  | "start_time"
  | "end_time"
  | "is_featured"
  | "organizer_name"
  | "organizer_avatar"
  | "location_name"
  | "address"
  | "latitude"
  | "longitude"
>;

/** Explicit column list for `events_with_details` - never use `*`. */
export const EVENT_CARD_COLUMNS =
  "event_id, event_name, event_slug, event_description, event_status, start_time, end_time, is_featured, organizer_name, organizer_avatar, location_name, address, latitude, longitude";

export function toEventCard(
  row: EventCardRow,
  attendeesPreview?: { users: AttendeePreviewDTO[]; total_count: number },
  imageUrl?: string | null,
): EventCardDTO {
  return {
    event_id: row.event_id,
    event_name: row.event_name,
    event_slug: row.event_slug,
    event_description: row.event_description,
    event_status: row.event_status,
    start_time: row.start_time,
    end_time: row.end_time,
    is_featured: row.is_featured,
    organizer_name: row.organizer_name,
    organizer_avatar: row.organizer_avatar,
    location_name: row.location_name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
    ...(attendeesPreview
      ? {
          attendees_preview: attendeesPreview.users,
          attendees_count: attendeesPreview.total_count,
        }
      : {}),
  };
}

export type EventImageDTO = {
  id: number;
  url: string;
  alt_text: string | null;
  display_order: number | null;
};

export type EventImageRow = Pick<
  Database["public"]["Tables"]["event_images"]["Row"],
  "id" | "url" | "alt_text" | "display_order"
>;

export const EVENT_IMAGE_COLUMNS = "id, url, alt_text, display_order";

export function toEventImage(row: EventImageRow): EventImageDTO {
  return {
    id: row.id,
    url: row.url,
    alt_text: row.alt_text,
    display_order: row.display_order,
  };
}

/**
 * TicketType for the event detail screen - drives checkout. `currency` is a
 * synthesized constant: the `ticket_types` table has no currency column and the
 * platform is PKR-only (see contract section 1, Money).
 */
export type TicketTypeDTO = {
  id: number;
  name: string;
  price: number;
  currency: "PKR";
  quantity_available: number | null;
  sale_starts_at: string;
  sale_ends_at: string;
};

export type TicketTypeRow = Pick<
  Database["public"]["Tables"]["ticket_types"]["Row"],
  | "id"
  | "name"
  | "price"
  | "quantity_available"
  | "sale_starts_at"
  | "sale_ends_at"
>;

export const TICKET_TYPE_COLUMNS =
  "id, name, price, quantity_available, sale_starts_at, sale_ends_at";

export function toTicketType(row: TicketTypeRow): TicketTypeDTO {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    currency: "PKR",
    quantity_available: row.quantity_available,
    sale_starts_at: row.sale_starts_at,
    sale_ends_at: row.sale_ends_at,
  };
}

export type ReviewImageDTO = {
  id: number;
  image_url: string;
};

/** Row subset for a review image, derived from the generated Row so the
 * compiler validates every column name. `review_images` has only
 * `image_url` (no alt/order columns). */
export type ReviewImageRow = Pick<
  Database["public"]["Tables"]["review_images"]["Row"],
  "id" | "image_url"
>;

export const REVIEW_IMAGE_COLUMNS = "id, image_url";

export function toReviewImage(row: ReviewImageRow): ReviewImageDTO {
  return { id: row.id, image_url: row.image_url };
}

export type CommentDTO = {
  id: number;
  review_id: number;
  parent_id: number | null;
  is_own: boolean;
  content: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  author: { username: string | null; avatar_url: string | null };
  reply_count: number;
};

type CommentProfileJoin =
  | { username: string | null; avatar_url: string | null }
  | { username: string | null; avatar_url: string | null }[]
  | null;

// Base columns derived from the generated Row so the compiler validates every
// column name (a typo in COMMENT_COLUMNS fails to compile); the embedded
// `profiles` join is appended structurally.
export type CommentRowLike = Pick<
  Database["public"]["Tables"]["review_comments"]["Row"],
  | "id"
  | "review_id"
  | "user_id"
  | "parent_id"
  | "content"
  | "status"
  | "created_at"
  | "updated_at"
> & { profiles: CommentProfileJoin };

/** Columns for a comment - `user_id` is read for `is_own` but never emitted. */
export const COMMENT_COLUMNS =
  "id, review_id, user_id, parent_id, content, status, created_at, updated_at, profiles:profiles!review_comments_user_id_fkey(username, avatar_url)";

/**
 * Maps a review-comment row to the public DTO. Like {@link toReview}, the
 * author's auth UUID is dropped - identity is `username` + `avatar_url` plus a
 * server-computed `is_own`. `reply_count` is supplied by the caller.
 */
export function toComment(
  row: CommentRowLike,
  currentUserId: string | null,
  replyCount = 0,
): CommentDTO {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    review_id: row.review_id,
    parent_id: row.parent_id,
    is_own: currentUserId != null && row.user_id === currentUserId,
    content: row.content,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: {
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    reply_count: replyCount,
  };
}

export type NotificationDTO = {
  id: string;
  title: string;
  body: string;
  category_slug: string;
  metadata: Json;
  channel: NotificationChannel;
  priority: NotificationPriority;
  is_read: boolean;
  is_archived: boolean;
  cta_label: string | null;
  cta_url: string | null;
  created_at: string;
  read_at: string | null;
};

/**
 * Allow-listed notification `metadata` keys. `metadata` is a free-form blob that
 * server-side producers populate with other users' data (e.g. `owner_id`,
 * `actorName`, contact-form `email`/`phone`, internal `reason`), so it is
 * filtered to a fail-closed set of non-PII deep-link/display keys before it
 * reaches the client. Unknown keys are dropped - add here as needed (additive).
 */
const SAFE_METADATA_KEYS = new Set<string>([
  "review_id",
  "comment_id",
  "listing_id",
  "listing_slug",
  "listing_name",
  "event_id",
  "event_slug",
  "event_name",
  "booking_id",
  "booking_reference",
  "order_id",
  "rating",
  "amount",
  "currency",
  "status",
  "challenge_id",
  "rank_name",
  "xp",
]);

function pickSafeMetadata(metadata: Json): Json {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return {};
  }
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SAFE_METADATA_KEYS.has(key) && value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Maps a {@link NotificationFeedItem} to the public DTO. Drops internal/PII
 * fields - `actor_id` (another user's UUID), `recipient_id`, category, and the
 * per-channel delivery internals (status/error/attempts); `metadata` is
 * allow-listed (see {@link SAFE_METADATA_KEYS}). `is_read`/`is_archived` are
 * computed from the timestamp columns; `channel` collapses the row's channels to
 * a single value (the requested filter when set, else `bell`).
 */
export function toNotification(
  item: NotificationFeedItem,
  requestedChannel?: NotificationChannel,
): NotificationDTO {
  const channels = item.channels.map((c) => c.channel);
  const channel: NotificationChannel =
    requestedChannel && channels.includes(requestedChannel)
      ? requestedChannel
      : channels.includes("bell")
        ? "bell"
        : (channels[0] ?? "bell");
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    category_slug: item.categorySlug,
    metadata: pickSafeMetadata(item.metadata),
    channel,
    priority: item.priority,
    is_read: item.readAt != null,
    is_archived: item.archivedAt != null,
    cta_label: item.ctaLabel,
    cta_url: item.ctaUrl,
    created_at: item.triggeredAt,
    read_at: item.readAt,
  };
}
