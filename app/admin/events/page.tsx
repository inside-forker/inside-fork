import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { EventsManagementPage } from "@/components/admin/EventsManagementPage";

export default async function AdminEventsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check admin access
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  return <EventsManagementPage />;
}
