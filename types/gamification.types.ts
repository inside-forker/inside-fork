/**
 * Gamification System Types
 * Core types for XP, ranks, badges, challenges, and leaderboards
 */

import { Database } from "./supabase";

// ============================================================================
// DATABASE-DERIVED TYPES
// ============================================================================

export type Rank = Database["public"]["Tables"]["ranks"]["Row"];
export type UserRank = Database["public"]["Tables"]["user_ranks"]["Row"];
export type XPActivity = Database["public"]["Tables"]["xp_activities"]["Row"];
export type Challenge =
  Database["public"]["Tables"]["weekly_challenges"]["Row"];
export type UserChallengeProgress =
  Database["public"]["Tables"]["user_challenge_progress"]["Row"];
export type QRCode = Database["public"]["Tables"]["qr_codes"]["Row"];
export type QRScan = Database["public"]["Tables"]["qr_scans"]["Row"];
export type DailyLoginStreak =
  Database["public"]["Tables"]["daily_login_streaks"]["Row"];
export type LeaderboardCacheEntry =
  Database["public"]["Tables"]["leaderboard_cache"]["Row"];
export type Badge = Database["public"]["Tables"]["badges"]["Row"];
export type UserBadge = Database["public"]["Tables"]["user_badges"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// ============================================================================
// XP ACTIVITY TYPES
// ============================================================================

export type CooldownType =
  | "once"
  | "daily"
  | "weekly"
  | "per_target"
  | "unlimited";

/**
 * Activity identifier - unique slug for each XP activity
 * Examples: 'daily_login', 'leave_review', 'attend_event'
 */
export type ActivitySlug =
  | "daily_login"
  | "streak_7day"
  | "profile_complete"
  | "visit_location"
  | "attend_event"
  | "suggest_place"
  | "leave_review"
  | "react_review"
  | "comment_review"
  | "report_info"
  | "invite_friend"
  | "share_link"
  | "complete_challenge";

/**
 * XP award result with rank-up detection
 */
export interface XPAwardResult {
  success: boolean;
  xp_awarded: number;
  new_total: number;
  old_rank?: {
    id: number;
    name: string;
    slug: string;
  };
  new_rank?: {
    id: number;
    name: string;
    slug: string;
    color: string;
    benefits: string[];
  };
  rank_up: boolean;
  badge_unlocked?: {
    id: number;
    name: string;
    icon_url: string | null;
  };
}

/**
 * Request payload for awarding XP
 */
export interface XPAwardRequest {
  user_id: string;
  activity_slug: ActivitySlug;
  related_id?: number | string;
  metadata?: Record<string, unknown>;
}

/**
 * Response when checking if activity can be performed
 */
export interface ActivityCheckResponse {
  can_perform: boolean;
  reason?: string;
  next_available_at?: string;
  daily_count?: number;
  max_per_day?: number;
}

// ============================================================================
// RANK & PROGRESSION TYPES
// ============================================================================

/**
 * User's current rank info with progress
 */
export interface UserRankInfo {
  current_rank: Rank & {
    percentage_to_next: number;
  };
  next_rank?: Rank;
  user_total_xp: number;
  xp_to_next: number;
  rank_history: UserRank[];
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  position: number;
  user_id: string;
  xp_total: number;
  current_rank: Rank;
  profile: {
    full_name: string;
    avatar_url: string | null;
    username: string;
  };
  badge_count: number;
}

/**
 * Leaderboard period type
 */
export type LeaderboardPeriod = "all_time" | "weekly" | "monthly";

// ============================================================================
// CHALLENGE TYPES
// ============================================================================

/**
 * Active challenge for user
 */
export interface ActiveChallenge {
  id: number;
  title: string;
  description: string;
  challenge_type: string;
  xp_reward: number;
  target_count: number;
  start_date: string;
  end_date: string;
  current_progress: number;
  is_completed: boolean;
  days_remaining: number;
}

/**
 * Challenge completion result
 */
export interface ChallengeCompletionResult {
  success: boolean;
  challenge_id: number;
  xp_awarded: number;
  message: string;
}

// ============================================================================
// DAILY LOGIN TYPES
// ============================================================================

/**
 * Daily login status and streak info
 */
export interface DailyLoginStatus {
  has_logged_in_today: boolean;
  current_streak: number;
  longest_streak: number;
  total_logins: number;
  can_claim_xp: boolean;
  xp_earned_today: number;
  next_claim_at?: string;
}

/**
 * Daily login claim result
 */
export interface DailyLoginClaimResult {
  success: boolean;
  xp_awarded: number;
  new_streak: number;
  streak_bonus?: {
    earned: boolean;
    xp_bonus: number;
    days_in_streak: number;
  };
  message: string;
  rank_up: boolean;
  new_rank?: {
    id: number;
    name: string;
    slug: string;
    color: string;
    benefits: string[];
  };
}

// ============================================================================
// QR CODE TYPES
// ============================================================================

export interface QRCodeCreateRequest {
  location_id?: number;
  event_id?: number;
  xp_reward: number;
  scan_limit_type: "unlimited" | "once_per_user" | "limited";
  scan_limit?: number;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface QRCodeScanResult {
  success: boolean;
  xp_awarded: number;
  message: string;
  location_name?: string;
  event_name?: string;
}

// ============================================================================
// ADMIN/CONFIGURATION TYPES
// ============================================================================

/**
 * Request to create or update a rank
 */
export interface RankUpsertRequest {
  name: string;
  slug: string;
  min_xp_required: number;
  max_slots?: number;
  color?: string;
  benefits?: string[];
  display_order: number;
  is_active: boolean;
}

/**
 * Request to create or update an XP activity
 */
export interface XPActivityUpsertRequest {
  activity_slug: ActivitySlug;
  activity_name: string;
  description?: string;
  xp_value: number;
  cooldown_type: CooldownType;
  max_per_day?: number;
  is_active: boolean;
}

/**
 * Admin configuration summary
 */
export interface GamificationConfig {
  ranks: Rank[];
  xp_activities: XPActivity[];
  active_challenges: Challenge[];
  total_users: number;
  users_with_xp: number;
}
