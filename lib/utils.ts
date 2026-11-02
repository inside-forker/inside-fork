import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom `text-data` size (tailwind.config.ts), or it
// treats it as a colour and drops the real text colour beside it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["data"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Security utility functions
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";

  return (
    input
      .trim()
      // Remove potentially dangerous characters
      .replace(/[<>'"&]/g, "")
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, "")
      // Limit length to prevent buffer overflow attacks
      .substring(0, 1000)
  );
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Password must be at least 8 characters long");
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include at least one uppercase letter");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include at least one lowercase letter");
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include at least one number");
  }

  // Special character check
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include at least one special character");
  }

  // Common password check
  const commonPasswords = ["password", "123456", "qwerty", "admin", "letmein"];
  if (
    commonPasswords.some((common) => password.toLowerCase().includes(common))
  ) {
    score = Math.max(0, score - 1);
    feedback.push("Avoid common password patterns");
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push("Avoid repeated characters");
  }

  return {
    isValid: score >= 4,
    score,
    feedback,
  };
}

export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function validateEmailFormat(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 320;
}
