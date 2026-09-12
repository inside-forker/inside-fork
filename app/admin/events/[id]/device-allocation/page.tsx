import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { DeviceAllocationClient } from "@/components/admin/DeviceAllocationClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDeviceAllocationPage({ params }: PageProps) {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Verify admin, super_admin, or staff/lister access
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister" &&
    profile.role !== "organizer"
  ) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const eventId = parseInt(id, 10);

  if (isNaN(eventId)) {
    redirect("/admin/events");
  }

  return (
    <div className="space-y-6">
      <DeviceAllocationClient eventId={eventId} />
    </div>
  );
}
