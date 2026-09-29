import dynamicImport from "next/dynamic";
import { query } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/require-session";

const UnifiedScannerClient = dynamicImport(
  () =>
    import("@/components/events/UnifiedScannerClient").then(
      (mod) => mod.UnifiedScannerClient
    ),
  {
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted/40" />,
  }
);

export const dynamic = "force-dynamic";

export const metadata = {
  title: "QR Scanner | Inside Karachi",
  description:
    "Scan QR codes to verify tickets or earn XP at partner locations",
};

export default async function ScanPage() {
  const { user, profile } = await requireSessionUser({
    loginPath: "/login?redirect=/dashboard/scan",
  });

  // Respect role switching - use active_role if set
  const currentRole =
    (profile?.active_role as string | undefined) ||
    (profile?.role as string | undefined) ||
    "public_user";
  const isAdmin = currentRole === "admin" || currentRole === "super_admin";
  const isOrganizerRole = currentRole === "organizer";

  // Check if user organizes any events (even without organizer role)
  const { rows: organizerEvents } = await query(
    `SELECT id FROM public.events e
     WHERE e.organizer_id = $1 OR EXISTS (
       SELECT 1 FROM public.event_co_organizers eco
       WHERE eco.event_id = e.id AND eco.organizer_id = $1
     ) LIMIT 1`,
    [user.id],
  );

  const hasEvents = organizerEvents && organizerEvents.length > 0;
  const isOrganizer = isOrganizerRole || hasEvents || isAdmin;

  return (
    <UnifiedScannerClient
      isOrganizer={isOrganizer}
      isAdmin={isAdmin}
      userRole={currentRole}
    />
  );
}
