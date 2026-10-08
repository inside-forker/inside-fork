"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT } from "@/lib/auth/client-events";

interface User {
  id: string;
  email: string;
  role: string;
  active_role: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface Session {
  access_token: string;
}

interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  error: Error | null;
}

const buildError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("Unknown authentication error");
  }
};

export function useSupabaseUser(): SupabaseAuthState {
  const [authState, setAuthState] = useState<SupabaseAuthState>({
    user: null,
    session: null,
    userId: null,
    isLoading: true,
    error: null,
  });

  const resolveSession = useCallback(async () => {
    try {
      const response = await fetch("/api/user/me", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch user session");
      }
      const data = await response.json();

      if (data.user) {
        setAuthState({
          user: data.user,
          session: { access_token: "dummy" },
          userId: data.user.id,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState({
          user: null,
          session: null,
          userId: null,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      // A network or profile-service failure is not proof that the JWT
      // session disappeared. Preserve a previously verified user instead of
      // converting a transient 5xx into a client-side logout/redirect.
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: buildError(error),
      }));
    }
  }, []);

  useEffect(() => {
    void resolveSession();

    const onAuthChanged = () => {
      void resolveSession();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [resolveSession]);

  return authState;
}
