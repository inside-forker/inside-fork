"use client";

import * as React from "react";
import { useAdminDashboard } from "../../hooks/useAdminDashboard";
import { SuperAdminDashboard } from "./SuperAdminDashboard";
import { SuperAdminDashboardProps } from "../../types/dashboard.types";
import { ErrorState } from "@/components/admin/ui";

interface SuperAdminDashboardWrapperProps {
  user: SuperAdminDashboardProps["user"];
  profile: SuperAdminDashboardProps["profile"];
}

export function SuperAdminDashboardWrapper({
  user,
  profile,
}: SuperAdminDashboardWrapperProps) {
  const { data, isLoading, error, refetch } = useAdminDashboard();

  // Loading state: flat skeleton in the shape of the overview
  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading overview" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="h-3 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-72 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 bg-background px-6 py-4">
              <div className="h-3 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-7 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          {[2, 3].map((span) => (
            <div key={span} className={span === 2 ? "lg:col-span-2" : "lg:col-span-3"}>
              <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState
          title="Couldn’t load the overview"
          description={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  // Success state - render the actual dashboard
  if (data) {
    return (
      <SuperAdminDashboard
        user={user}
        profile={profile}
        dashboardData={{
          statistics: data.statistics,
          recentActivity: data.recentActivity,
        }}
      />
    );
  }

  // Fallback
  return null;
}
