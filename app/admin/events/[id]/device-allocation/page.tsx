import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { AccountCreationHub } from "@/components/admin/AccountCreationHub";

export const metadata = {
  title: "Event Device Allocation & Gate Settings | Inside Karachi Admin",
  description: "Configure multi-device verification architecture, assign gate operators, and allocate tickets.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDeviceAllocationPage({ params }: PageProps) {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Verify admin, super_admin, or staff/lister/organizer access
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
    redirect("/admin/accounts?tab=allocation");
  }

  return (
    <div className="space-y-6">
      <AccountCreationHub
        initialEventId={eventId}
        initialTab="allocation"
      />
    </div>
  );
}
