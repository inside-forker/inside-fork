# Tracking Plan — Phase 1 CORE

Owner: platform. Spec must exist before a new client event ships.

## Envelope (every event)

| Property | Required | Notes |
|---|---|---|
| `event_name` | yes | `object_action`, past tense, snake_case |
| `occurred_at` / `timestamp` | yes | UTC; local time derived at query time |
| `user_id` or `anon_id` | yes | One actor present |
| `session_id` | yes | 30-minute inactivity rotation |
| `device_id` | yes (new) | Stable install id; not advertising ID |
| `platform` | yes | `ios` / `android` / `web` |
| `app_version` | should | Forced-upgrade decisions |
| `os_version` | should | Bug isolation |
| `screen` / `surface` | should | Funnel work |
| `source_context` | yes | How they got here: search, browse, map, notification, ad, deep_link, editorial, navigation, deals, redeem |
| `area_id` | nice | Coarse geo in `context` |

## Pipelines

| Pipeline | Table | Client |
|---|---|---|
| Mobile product | `mobile_events` | `track()` |
| Web product | `analytics_events` | `recordAnalyticsEvent()` |
| Listing affinity | `user_listing_events` | `trackEvent(listingId, …)` |

## Canonical Phase 1 events

| Event | Pipeline | Key context |
|---|---|---|
| `screen_viewed` | mobile | `screen`, `source_context` |
| `search_performed` | mobile + web | `query`, `resultCount`/`result_count`, `hasResults`/`has_results`, filters |
| `filters_applied` | mobile | filter payload, `hasResults` |
| `listing_viewed` | listing (`view`) + web `listing_view` | listing id |
| `offer_viewed` | mobile | `dealId`, `listingId` |
| `offer_redeem_started` | mobile | `redemptionId`, `dealId`, `listingId` |
| `offer_redeemed` | mobile | `redemptionId`, `billValue`, `discountValue` |
| `offer_redeem_voided` | mobile | `redemptionId`, `voidReason` |
| `ad_impression` / `ad_clicked` | mobile | placement |

## CNIC policy (Phase 1)

Do **not** add new CNIC collection. Ticket checkout may keep hash + last4 only. Raw CNIC never enters analytics tables or merchant exports.

## Consent

Consent changes append to `consent_ledger` (never update-in-place). Marketing channels are separate booleans: push / sms / whatsapp / email.
