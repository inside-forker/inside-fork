import { redirect } from "next/navigation";
import { getMobileEventsFullOverview } from "@/lib/analytics/mobile-events";
import { requireSessionUser } from "@/lib/auth/require-session";
import { MobileEventsDashboard } from "@/components/admin/mobile-events/MobileEventsDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mobile Intelligence | Admin",
  description:
    "Per-user screen time, navigation journeys, deal engagement, and search behavior from the mobile app.",
};

export default async function AdminMobileEventsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const defaultRange = "7d" as const;
  const data = await getMobileEventsFullOverview(defaultRange);

  return (
    <div className="p-6">
      <MobileEventsDashboard initialData={data} initialRange={defaultRange} />
    </div>
  );
}
