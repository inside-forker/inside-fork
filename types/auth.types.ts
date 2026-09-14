import { Database } from "./supabase";

// Base user role type from Supabase
export type UserRole = Database["public"]["Enums"]["user_role"];

// Role switching types
export interface RoleSwitchRequest {
  newRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
}

export interface RoleSwitchResponse {
  success: boolean;
  from_role?: UserRole;
  to_role?: UserRole;
  message: string;
}

export interface UserWithRoles {
  id: string;
  email?: string;
  role: UserRole; // Permanent role (what they actually are)
  active_role: UserRole; // Current active role (what they're acting as)
  full_name?: string;
  avatar_url?: string;
  canSwitchRoles: boolean; // Can they switch? (staff only)
  availableRoles: UserRole[]; // Which roles can they switch to?
}

// Signup request interface
export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  full_name?: string;
  invite_code?: string;
}

// Signup response interface
export interface SignupResponse {
  message: string;
  redirectTo: string;
  requiresVerification?: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    full_name?: string;
  };
}

// Signup OTP verification request/response
export interface VerifySignupOtpRequest {
  email: string;
  code: string;
}

export interface VerifySignupOtpResponse {
  message: string;
  redirectTo: string;
}

export interface ResendSignupOtpRequest {
  email: string;
}

export interface ResendSignupOtpResponse {
  sent: boolean;
}

// Username availability check request
export interface UsernameCheckRequest {
  username: string;
}

// Username availability check response
export interface UsernameCheckResponse {
  available: boolean;
  message?: string;
}

// Profile creation data (used during signup)
export interface ProfileCreationData {
  id: string;
  username: string;
  full_name?: string;
  role?: UserRole;
  points?: number;
}

// Login request interface
export interface LoginRequest {
  email: string;
  password: string;
}

// Login response interface
export interface LoginResponse {
  message: string;
  redirectTo: string;
  user?: {
    id: string;
    email: string;
    username?: string;
    full_name?: string;
    role: UserRole;
  };
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset response
export interface PasswordResetResponse {
  message: string;
}

// Auth error interface
export interface AuthError {
  error: string;
  message: string;
  field?: string;
}

// Verification-related types
export interface VerificationStatus {
  isVerified: boolean;
  email: string;
  verifiedAt?: string;
  lastVerificationSentAt?: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message: string;
  canRetryAt?: string;
}

export interface VerificationCallbackData {
  type: "signup" | "email_change" | "recovery";
  email?: string;
  error?: string;
  error_description?: string;
}

// Validation rules
export const AUTH_VALIDATION = {
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
    patternDescription:
      "Username must contain only letters, numbers, and underscores",
  },
  password: {
    minLength: 8,
    maxLength: 128,
  },
  fullName: {
    maxLength: 100,
  },
  email: {
    maxLength: 320,
  },
} as const;

// User role constants
export const USER_ROLES = {
  USER: "public_user" as UserRole,
  BUSINESS_OWNER: "business_owner" as UserRole,
  WRITER: "writer" as UserRole,
  LISTER: "lister" as UserRole,
  DATA_ENTRY: "data_entry" as UserRole,
  ORGANIZER: "organizer" as UserRole,
  EO_GATE_PASS: "eo_gate_pass" as UserRole,
  ADMIN: "admin" as UserRole,
  SUPER_ADMIN: "super_admin" as UserRole,
} as const;
