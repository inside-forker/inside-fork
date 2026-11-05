// ============================================================================
// INVITE & SHARE SYSTEM TYPES
// Matches database schema from invite_share_system_migration.sql
// ============================================================================

import { Database } from "./supabase";

// ============================================================================
// DATABASE TYPES (FROM SUPABASE)
// ============================================================================

export type InvitationStatus = Database["public"]["Enums"]["invitation_status"];
export type ShareContentType =
  Database["public"]["Enums"]["share_content_type"];
export type SocialPlatform = Database["public"]["Enums"]["social_platform"];
export type ShareVerificationMethod =
  Database["public"]["Enums"]["share_verification_method"];
export type ShareVerificationStatus =
  Database["public"]["Enums"]["share_verification_status"];

export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export type SocialShare = Database["public"]["Tables"]["social_shares"]["Row"];
export type ShareXPSettings =
  Database["public"]["Tables"]["share_xp_settings"]["Row"];

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateInvitationRequest {
  invitee_email: string;
}

export interface CreateInvitationResponse {
  success: boolean;
  error?: string;
  data?: {
    invite_code: string;
    invite_url: string;
    expires_at: string;
  };
}

export interface AcceptInvitationRequest {
  invite_token: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface CreateShareRequest {
  content_type: ShareContentType;
  content_id: number;
  content_title: string;
  content_url: string;
  platform: SocialPlatform;
  verification_method: ShareVerificationMethod;
}

export interface CreateShareResponse {
  success: boolean;
  error?: string;
  data?: {
    share_id: number;
    tracking_url?: string;
    xp_amount: number;
    requires_verification: boolean;
  };
}

export interface UploadScreenshotRequest {
  share_id: number;
  screenshot_url: string;
}

export interface UploadScreenshotResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface VerifyShareRequest {
  share_id: number;
  status: ShareVerificationStatus;
  notes?: string;
}

export interface VerifyShareResponse {
  success: boolean;
  error?: string;
  xp_awarded?: number;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: (data: CreateInvitationResponse["data"]) => void;
}

export interface ShareButtonProps {
  contentType: ShareContentType;
  contentId: number;
  contentTitle: string;
  contentUrl: string;
  variant?: "default" | "compact" | "pill" | "floating";
  className?: string;
}

export interface PendingInvitation extends Invitation {
  invitee_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PendingShare extends SocialShare {
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  // Legacy alias for backward compatibility
  user_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

// ============================================================================
// DASHBOARD STATS TYPES
// ============================================================================

export interface InviteShareStats {
  total_invitations_sent: number;
  total_invitations_accepted: number;
  total_xp_from_invites: number;
  total_shares_created: number;
  total_shares_verified: number;
  total_shares_rejected: number;
  total_xp_from_shares: number;
  pending_invitations: number;
  pending_shares: number;
}

export interface AdminInviteShareStats extends InviteShareStats {
  blocked_invitations: number;
  failed_shares: number;
  avg_acceptance_rate: number;
  avg_verification_time_hours: number;
  top_sharers: Array<{
    user_id: string;
    full_name: string | null;
    total_shares: number;
    total_xp: number;
  }>;
  platform_breakdown: Array<{
    platform: SocialPlatform;
    share_count: number;
    verification_rate: number;
  }>;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseInviteShareReturn {
  // State
  isLoading: boolean;
  error: string | null;
  stats: InviteShareStats | null;

  // Invite actions
  createInvitation: (email: string) => Promise<CreateInvitationResponse>;
  getPendingInvitations: () => Promise<PendingInvitation[]>;

  // Share actions
  createShare: (data: CreateShareRequest) => Promise<CreateShareResponse>;
  uploadScreenshot: (
    shareId: number,
    file: File,
  ) => Promise<UploadScreenshotResponse>;
  getPendingShares: () => Promise<PendingShare[]>;

  // Stats
  refreshStats: () => Promise<void>;
}

// ============================================================================
// FORM VALIDATION TYPES
// ============================================================================

export interface InviteFormData {
  email: string;
}

export interface ShareFormData {
  platform: SocialPlatform;
  screenshot?: File;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type PlatformConfig = {
  name: string;
  icon: string;
  color: string;
  requiresScreenshot: boolean;
  xpAmount: number;
  maxPerDay: number;
};

export type PlatformConfigs = Record<SocialPlatform, PlatformConfig>;
