/**
 * Named constants for Workstream 2 (user engagement scoring, segmentation,
 * admin alerting). Every day-cutoff, score weight, and alert sensitivity
 * knob used by lib/scoring/*, lib/segments/*, and lib/alerts/* lives here so
 * it can be tuned without touching query logic. Values are interpolated
 * directly into hand-built SQL (they are developer-authored numeric/array
 * constants, never request input, so this is not an injection surface).
 */

// ---------------------------------------------------------------------------
// Role scoping
// ---------------------------------------------------------------------------

/**
 * Who counts as a "consumer" for user_engagement_scores. public_user is the
 * app's default/general-public role (see lib/navigation/role-navigation.tsx
 * "Public user (default consumer role)"). business_owner, writer, organizer,
 * and the staff roles (admin, super_admin, lister, data_entry - see
 * lib/listings/route-access.ts STAFF_ROLES) are producer/staff roles with
 * their own dashboards and are deliberately excluded here; the merchant
 * dashboard alert targets business_owner separately via MERCHANT_ROLES.
 */
export const CONSUMER_ROLES = ["public_user"] as const;

/** Roles whose "merchant dashboard" activity segment 4 / alert 1 track. */
export const MERCHANT_ROLES = ["business_owner"] as const;

/** Roles that receive admin-alert notifications. */
export const ADMIN_ALERT_RECIPIENT_ROLES = ["admin", "super_admin"] as const;

// ---------------------------------------------------------------------------
// Engagement score: lookback windows for the *_30d / *_90d frequency counts
// ---------------------------------------------------------------------------

export const LOGIN_LOOKBACK_DAYS = 30;
export const BOOKING_LOOKBACK_DAYS = 90;
export const ENGAGEMENT_LOOKBACK_DAYS = 30;

// ---------------------------------------------------------------------------
// Engagement score: sub-score normalization
// ---------------------------------------------------------------------------

/** A recency signal (days since last X) linearly decays to 0 at this many days. */
export const RECENCY_DECAY_WINDOW_DAYS = 60;

/** Frequency count that maxes out (100) each frequency sub-score. */
export const LOGIN_FREQUENCY_CAP_30D = 20;
export const BOOKING_FREQUENCY_CAP_90D = 5;
export const ENGAGEMENT_FREQUENCY_CAP_30D = 50;

/** Lifetime paid-booking spend (PKR) that maxes out the monetary sub-score. */
export const BOOKING_MONETARY_CAP_PKR = 50_000;

// ---------------------------------------------------------------------------
// Engagement score: composite weights (0-100, must sum to 100)
// ---------------------------------------------------------------------------

// Phase 2: redemption recency/frequency take 15pts; booking/engagement trimmed to keep sum=100.
export const SCORE_WEIGHT_LOGIN_RECENCY = 13;
export const SCORE_WEIGHT_LOGIN_FREQUENCY = 10;
export const SCORE_WEIGHT_BOOKING_RECENCY = 15;
export const SCORE_WEIGHT_BOOKING_FREQUENCY = 15;
export const SCORE_WEIGHT_BOOKING_MONETARY = 12;
export const SCORE_WEIGHT_ENGAGEMENT_RECENCY = 12;
export const SCORE_WEIGHT_ENGAGEMENT_FREQUENCY = 8;

// ---------------------------------------------------------------------------
// Lifecycle stage day-cutoffs (days since last_activity_at, unless noted)
// ---------------------------------------------------------------------------

/** "new": account created within this many days AND zero bookings yet. */
export const LIFECYCLE_NEW_ACCOUNT_MAX_AGE_DAYS = 14;
/** "active": last activity within this many days. */
export const LIFECYCLE_ACTIVE_MAX_DAYS = 7;
/** "at_risk": last activity within this many days (and beyond ACTIVE). */
export const LIFECYCLE_AT_RISK_MAX_DAYS = 21;
/** "dormant": last activity within this many days (and beyond AT_RISK). Beyond this -> "churned". */
export const LIFECYCLE_DORMANT_MAX_DAYS = 60;

// ---------------------------------------------------------------------------
// Segment thresholds
// ---------------------------------------------------------------------------

export const SEGMENT_SIGNUP_NO_BOOKING_MIN_DAYS = 7;
export const SEGMENT_SILENT_AFTER_ACTIVE_MIN_DAYS = 21;

/**
 * Lifetime paid-booking spend (PKR) above which a consumer is a "high
 * spender". There is no real usage/spend distribution to calibrate this
 * against yet (product is pre-launch on this metric) - revisit once the
 * scoring pipeline has run for a while and real numbers exist.
 */
export const SEGMENT_HIGH_SPENDER_CUTOFF_PKR = 50_000;

/** Same 21-day window as the admin alert of the same name (alert reuses this segment directly). */
export const SEGMENT_MERCHANT_DASHBOARD_INACTIVE_MIN_DAYS = 21;

/** Phase 2 — bill GMV (validated redemptions) over 90d for "high bill redeemers". */
export const SEGMENT_HIGH_BILL_REDEEM_CUTOFF_PKR = 25_000;

/** Phase 2 — merchant GMV decline: last N days vs prior N days. */
export const SEGMENT_MERCHANT_GMV_COMPARE_DAYS = 14;
/** Require at least this many validated redemptions in the prior window before flagging decline. */
export const SEGMENT_MERCHANT_GMV_DECLINE_MIN_PRIOR_REDEMPTIONS = 3;

// ---------------------------------------------------------------------------
// Engagement score: redemption signal (Phase 2) — weights must still sum to 100
// ---------------------------------------------------------------------------

export const REDEMPTION_LOOKBACK_DAYS = 90;
export const REDEMPTION_FREQUENCY_CAP_90D = 8;
export const SCORE_WEIGHT_REDEMPTION_RECENCY = 8;
export const SCORE_WEIGHT_REDEMPTION_FREQUENCY = 7;

// ---------------------------------------------------------------------------
// Admin alert thresholds
// ---------------------------------------------------------------------------

/** Trailing window (days) used to compute the "normal" daily failed-payment baseline. */
export const ALERT_PAYMENT_FAILURE_BASELINE_DAYS = 7;
/** Trailing-24h failures must be at least this many times the baseline daily average to flag. */
export const ALERT_PAYMENT_FAILURE_SPIKE_MULTIPLIER = 2.0;
/** Absolute floor - trailing-24h failures below this count never trigger, regardless of multiplier (avoids noise on small numbers, e.g. 1 failure vs a 0 baseline). */
export const ALERT_PAYMENT_FAILURE_MIN_COUNT = 5;

/** Trailing windows compared for the venue rating-drop alert. */
export const ALERT_RATING_TRAILING_SHORT_DAYS = 7;
export const ALERT_RATING_TRAILING_LONG_DAYS = 30;
/** Minimum number of reviews in the trailing-short window before a drop is trusted. */
export const ALERT_RATING_DROP_MIN_REVIEWS = 5;
/** Minimum point drop (out of 5) between the short-window and long-window average to flag. */
export const ALERT_RATING_DROP_MIN_DELTA = 0.5;

/** Phase 2 — zero-result rate must rise by this relative factor WoW to alert. */
export const ALERT_ZERO_RESULT_SPIKE_MULTIPLIER = 1.5;
/** Absolute floor on current-week zero-result events before alerting. */
export const ALERT_ZERO_RESULT_MIN_COUNT = 20;

/** Phase 2 — platform redemptions WoW drop threshold. */
export const ALERT_REDEMPTIONS_DROP_RATIO = 0.5;
/** Min prior-week validated redemptions before WoW drop alerts. */
export const ALERT_REDEMPTIONS_DROP_MIN_PRIOR = 10;
