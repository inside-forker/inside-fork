export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  notifications?: {
    email?: boolean;
    bookings?: boolean;
    reviews?: boolean;
    marketing?: boolean;
  };
  location?: {
    lat?: number;
    lng?: number;
    name?: string;
  };
  /** Phase 1 CORE consent channel flags (also mirrored into consent_ledger). */
  consent?: {
    termsVersion?: string;
    privacyVersion?: string;
    marketingPush?: boolean;
    marketingSms?: boolean;
    marketingWhatsapp?: boolean;
    marketingEmail?: boolean;
    locationPermission?: string;
    personalisationOptIn?: boolean;
  };
}

export interface UserSettingsProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  user_preferences?: UserPreferences;
}

// API Response types
export interface SettingsApiResponse {
  success: boolean;
  settings?: UserPreferences;
  message?: string;
}

export interface UpdateSettingsRequest {
  userPreferences: UserPreferences;
}

// Component prop types
export interface PremiumSettingsPageProps {
  profile: UserSettingsProfile | null;
}
