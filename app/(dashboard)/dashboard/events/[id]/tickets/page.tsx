import { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventPassesManagementView } from "@/components/dashboard/EventPassesManagementView";
import { requireSessionUser } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "Attendee Passes & Manifest | Inside Karachi",
  description: "Live attendee manifest, sold passes, and check-in management",
};

export const dynamic = "force-dynamic";

interface TicketsPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventTicketsPage({ params }: TicketsPageProps) {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/dashboard");
  }

  const currentRole =
    (profile.active_role as string | null | undefined) ||
    (profile.role as string | null | undefined) ||
    "";
  const allowedRoles = ["organizer", "lister", "admin", "super_admin", "scanner"];
  if (!allowedRoles.includes(currentRole)) {
    redirect("/dashboard");
  }

  const resolvedParams = await params;
  const eventId = parseInt(resolvedParams.id, 10);

  if (isNaN(eventId)) {
    redirect("/dashboard/events");
  }

  return (
    <div className="container py-6 max-w-7xl mx-auto">
      <EventPassesManagementView eventId={eventId} />
    </div>
  );
}
