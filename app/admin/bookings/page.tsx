import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { AdminBookingsManagement } from "@/components/admin/BookingsManagement";

export const metadata = {
  title: "Bookings | Admin | Inside Karachi",
  description: "View and manage event bookings, revenue, and ticket passes",
};

export default async function AdminBookingsPage() {
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

  return <AdminBookingsManagement />;
}
