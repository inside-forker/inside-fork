"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PremiumSidebar } from "./PremiumSidebar";
import { PremiumHeader } from "./PremiumHeader";
import { BottomNav } from "@/components/layout/BottomNav";

interface ProfileShape {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

interface DashboardLayoutUser {
  id: string;
  email?: string;
}

interface PremiumDashboardLayoutProps {
  children: React.ReactNode;
  user: DashboardLayoutUser;
  profile: ProfileShape | null;
}

export function PremiumDashboardLayout({
  children,
  user,
  profile,
}: PremiumDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [stats, setStats] = React.useState<{ [key: string]: number }>({});
  const [loadingStats, setLoadingStats] = React.useState(true);

  React.useEffect(() => {
    // Try to load from cache immediately
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("sidebar_stats");
      if (cached) {
        try {
          setStats(JSON.parse(cached));
          setLoadingStats(false);
        } catch (e) {
          console.error("Error parsing cached stats", e);
        }
      }
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/dashboard/sidebar-stats");
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStats(data.stats);
            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                "sidebar_stats",
                JSON.stringify(data.stats),
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch sidebar stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/20 relative overflow-x-clip">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Brand Color Geometric Shapes */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb),0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Header */}
      <PremiumHeader
        user={user}
        profile={profile}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      {/* Sidebar */}
      <PremiumSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        profile={profile}
        stats={stats}
        loadingStats={loadingStats}
      />

      {/* Main Content Area */}
      <main
        className={cn(
          "relative z-10 transition-all duration-500 ease-out",
          "pt-20 pb-24 lg:pb-8 min-h-screen",
          sidebarOpen ? "lg:mr-80" : "lg:mr-0",
        )}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div>{children}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        onMenuOpen={() => setSidebarOpen(true)}
        user={user}
        profile={profile}
      />

      {/* Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
