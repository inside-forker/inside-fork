# Segment library (Phase 2–3)

Nightly refresh via `POST /api/cron/refresh-segments` → `segment_membership`.
Phase 3 scores refresh first via `POST /api/cron/refresh-intelligence`.

| Slug | Who |
|------|-----|
| `signed_up_no_booking_7d` | Consumer signed up 7+ days, no booking |
| `was_active_now_silent_21d` | Had activity signal, silent 21+ days |
| `high_spenders` | Booking spend ≥ high-spender cutoff |
| `merchant_dashboard_inactive_21d` | Business owner no login 21+ days |
| `lifecycle_at_risk` | `user_engagement_scores.lifecycle_stage = at_risk` |
| `lifecycle_churned` | `lifecycle_stage = churned` |
| `redeemed_once_30d` | Exactly one validated redemption in 30d |
| `redeemed_repeat_90d` | ≥2 validated redemptions in 90d |
| `high_bill_redeemers` | Sum bill_value ≥ cutoff in 90d |
| `deal_browsers_no_redeem_14d` | Saw deals / offer_viewed, never redeemed |
| `core_profile_incomplete` | Missing home area, age band, or interests |
| `merchant_no_redemptions_30d` | Published listing + active deal, zero validated GMV in 30d |
| `merchant_gmv_declining` | Bill GMV last 14d &lt; 50% of prior 14d (min prior volume) |
| `unmet_demand_cohort` | 2+ zero-result searches in 14d |
| `event_first` | Paid booking, never redeemed a venue offer |
| `venue_first` | Validated redemption, never bought a ticket |
| `cross_sell_to_tickets` | High `cross_sell_to_ticket` propensity |
| `cross_sell_to_venues` | High `cross_sell_to_venue` propensity |
| `research_panel_opted_in` | Research panel consent on |
| `creator_attributed` | Signed up with a creator code |

Thresholds live in `lib/scoring/thresholds.ts`. Admin browse: `/admin/segments`.
Demand gap: `/admin/demand-gap`. Creator codes: `/admin/creator-codes`.
