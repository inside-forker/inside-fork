"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Bell,
  MapPin,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  UserPreferences,
  PremiumSettingsPageProps,
} from "@/types/settings.types";

type NotificationChannel = "bell" | "email" | "push";

interface NotificationCategoryPref {
  categorySlug: string;
  label: string;
  description: string | null;
  isMandatory: boolean;
  channels: Record<NotificationChannel, boolean>;
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  bell: "In-app",
  email: "Email",
  push: "Push",
};

export function PremiumSettingsPage({ profile }: PremiumSettingsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    notifications: {
      email: true,
      bookings: true,
      reviews: true,
      marketing: false,
    },
    location: {
      lat: 24.8607, // Karachi coordinates
      lng: 67.0011,
      name: "Karachi, Pakistan",
    },
  });

  const [categoryPrefs, setCategoryPrefs] = useState<NotificationCategoryPref[]>([]);
  const [categoryPrefsLoading, setCategoryPrefsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  // Load per-category notification preferences (the ones that actually
  // control sending) from the real engine, separate from the legacy
  // theme/location blob below.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/notifications/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled && data?.categories) {
          setCategoryPrefs(data.categories);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "Couldn't load notification preferences",
            description: "Please refresh the page to try again.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setCategoryPrefsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCategoryChannel = async (
    categorySlug: string,
    channel: NotificationChannel,
    enabled: boolean
  ) => {
    const key = `${categorySlug}:${channel}`;
    const previous = categoryPrefs;

    setCategoryPrefs((prev) =>
      prev.map((cat) =>
        cat.categorySlug === categorySlug
          ? { ...cat, channels: { ...cat.channels, [channel]: enabled } }
          : cat
      )
    );
    setSavingKey(key);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: [{ categorySlug, channel, enabled }],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save");
      }
    } catch (error) {
      // Roll back on failure so the toggle reflects what's actually saved.
      setCategoryPrefs(previous);
      toast({
        title: "Couldn't save preference",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  // Load user preferences on mount
  useEffect(() => {
    if (profile?.user_preferences) {
      // Handle Json type from Supabase
      const prefs = profile.user_preferences as UserPreferences;
      setPreferences((prev) => ({
        ...prev,
        ...prefs,
      }));
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (savedTheme) {
      setPreferences((prev) => ({ ...prev, theme: savedTheme }));
    }
  }, [profile]);

  // Theme management
  const updateTheme = (theme: "light" | "dark" | "system") => {
    setPreferences((prev) => ({ ...prev, theme }));

    // Apply theme immediately
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    }

    // Save to localStorage
    localStorage.setItem("theme", theme);
  };

  // Save preferences to database
  const savePreferences = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPreferences: preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Back Navigation */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
      </div>

      {/* Settings Sections - Matching Profile Page Card Design */}
      <div className="space-y-6">
        {/* Theme Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sun className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Theme <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Choose your preferred theme for the application
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "light", icon: Sun, label: "Light", desc: "Bright theme" },
              { key: "dark", icon: Moon, label: "Dark", desc: "Easy on eyes" },
              {
                key: "system",
                icon: Monitor,
                label: "System",
                desc: "Auto detect",
              },
            ].map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                onClick={() => updateTheme(key as "light" | "dark" | "system")}
                className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                  preferences.theme === key
                    ? "border-primary bg-primary/5 text-primary shadow-lg"
                    : "border-border/40 hover:border-border/60 bg-card/50"
                }`}
              >
                <Icon className="w-8 h-8 mx-auto mb-3" />
                <span className="text-sm font-semibold block">{label}</span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Notification Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Notification{" "}
                <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Control how and when you receive notifications
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {categoryPrefsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span className="text-sm">Loading preferences...</span>
              </div>
            ) : (
              categoryPrefs.map((cat) => (
                <div
                  key={cat.categorySlug}
                  className="p-4 rounded-lg border border-border/30 bg-card/30"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{cat.label}</h4>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {cat.description}
                        </p>
                      )}
                      {cat.isMandatory && (
                        <p className="text-xs text-primary/80 mt-1">
                          At least one channel required
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map(
                      (channel) => {
                        const toggleKey = `${cat.categorySlug}:${channel}`;
                        return (
                          <label
                            key={channel}
                            className="relative inline-flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={cat.channels[channel]}
                              disabled={savingKey === toggleKey}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateCategoryChannel(
                                  cat.categorySlug,
                                  channel,
                                  e.target.checked
                                )
                              }
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                            <span className="text-xs text-muted-foreground">
                              {CHANNEL_LABELS[channel]}
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Location Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden glass-card border border-border rounded-2xl p-6 md:p-8 mb-6 md:mb-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-sm"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-40 dark:from-primary/10 dark:to-primary/5 pointer-events-none"
            aria-hidden
          />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                Location{" "}
                <span className="gradient-text-primary">Preferences</span>
              </h2>
              <p className="text-muted-foreground text-sm">
                Set your default location for personalized recommendations
              </p>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-border/30 bg-card/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {preferences.location?.name || "Karachi, Pakistan"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preferences.location?.lat?.toFixed(4)},{" "}
                  {preferences.location?.lng?.toFixed(4)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Location picker will be implemented in the next phase for enhanced
              personalization.
            </p>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-end pt-6"
        >
          <Button
            onClick={savePreferences}
            disabled={isLoading}
            className="px-8 py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </>
  );
}
