"use client";

import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      execute: (
        siteKey: string,
        options?: { action?: string },
      ) => Promise<string>;
      ready: (callback: () => void) => void;
    };
    __recaptchaLoadPromise?: Promise<void>;
    __recaptchaSiteKeyPromise?: Promise<string | null>;
    __recaptchaSiteKey?: string | null;
  }
}

async function resolveSiteKey(explicit?: string): Promise<string | null> {
  const fromProp = explicit?.trim();
  if (fromProp) return fromProp;

  if (typeof window === "undefined") return null;

  if (window.__recaptchaSiteKey !== undefined) {
    return window.__recaptchaSiteKey;
  }

  if (window.__recaptchaSiteKeyPromise) {
    return window.__recaptchaSiteKeyPromise;
  }

  window.__recaptchaSiteKeyPromise = fetch("/api/recaptcha/site-key")
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { siteKey?: string | null };
      const key = data.siteKey?.trim() || null;
      window.__recaptchaSiteKey = key;
      return key;
    })
    .catch((err) => {
      console.warn("Failed to fetch reCAPTCHA site key", err);
      window.__recaptchaSiteKey = null;
      window.__recaptchaSiteKeyPromise = undefined;
      return null;
    });

  return window.__recaptchaSiteKeyPromise;
}

/**
 * Lazy-loading reCAPTCHA hook.
 * The script is NOT loaded on mount - call loadRecaptcha() when user interacts with a form.
 * This saves ~362KB initial download and ~400ms main thread time on pages with forms.
 *
 * Site key resolution order: explicit arg → runtime `/api/recaptcha/site-key`
 * (so keys set after the last client build still work).
 */
export function useRecaptcha(siteKey?: string) {
  const [isReady, setIsReady] = useState(false);
  const siteKeyRef = useRef(siteKey?.trim() || undefined);
  siteKeyRef.current = siteKey?.trim() || undefined;

  /**
   * Load the reCAPTCHA script on demand.
   * Safe to call multiple times - will only load once.
   * Returns a promise that resolves when reCAPTCHA is ready.
   */
  const loadRecaptcha = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;

    // Already loaded and ready
    if (window.grecaptcha?.execute) {
      setIsReady(true);
      return;
    }

    // Return existing promise if already loading/loaded
    if (window.__recaptchaLoadPromise) {
      await window.__recaptchaLoadPromise;
      return;
    }

    const resolvedKey = await resolveSiteKey(siteKeyRef.current);
    if (!resolvedKey) {
      return;
    }

    // Another caller may have started loading while we resolved the key
    if (window.grecaptcha?.execute) {
      setIsReady(true);
      return;
    }
    if (window.__recaptchaLoadPromise) {
      await window.__recaptchaLoadPromise;
      return;
    }

    window.__recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${resolvedKey}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(() => {
            setIsReady(true);
            resolve();
          });
        } else {
          // Fallback: poll for grecaptcha
          const checkReady = setInterval(() => {
            if (window.grecaptcha?.execute) {
              clearInterval(checkReady);
              setIsReady(true);
              resolve();
            }
          }, 100);
          // Timeout after 10 seconds - reject and reset so callers can retry
          setTimeout(() => {
            if (!window.grecaptcha?.execute) {
              clearInterval(checkReady);
              window.__recaptchaLoadPromise = undefined;
              reject(new Error("reCAPTCHA load timeout"));
            }
          }, 10000);
        }
      };

      script.onerror = () => {
        console.warn("Failed to load reCAPTCHA script");
        window.__recaptchaLoadPromise = undefined;
        reject(new Error("Failed to load reCAPTCHA script"));
      };

      document.head.appendChild(script);
    });

    await window.__recaptchaLoadPromise;
  }, []);

  /**
   * Execute reCAPTCHA and get a token.
   * Will auto-load the script if not already loaded.
   */
  const executeRecaptcha = useCallback(
    async (action?: string): Promise<string | null> => {
      const resolvedKey = await resolveSiteKey(siteKeyRef.current);
      if (!resolvedKey) {
        console.warn("reCAPTCHA site key not provided");
        return null;
      }

      try {
        await loadRecaptcha();
      } catch (error) {
        console.warn("reCAPTCHA load failed:", error);
        return null;
      }

      if (!window.grecaptcha?.execute) {
        console.warn("reCAPTCHA not available after loading");
        return null;
      }

      try {
        const token = await window.grecaptcha.execute(resolvedKey, {
          action: action || "submit",
        });
        return token;
      } catch (error) {
        console.warn("reCAPTCHA execution failed:", error);
        return null;
      }
    },
    [loadRecaptcha],
  );

  return {
    executeRecaptcha,
    loadRecaptcha,
    isReady,
  };
}
