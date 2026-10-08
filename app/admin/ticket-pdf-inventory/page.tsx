import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { TicketPdfInventoryPage } from "@/components/admin/TicketPdfInventoryPage";
import { TicketPdfInventoryPasscodeGate } from "@/components/admin/TicketPdfInventoryPasscodeGate";
import {
  hasPdfInventoryUnlockFromCookies,
  isPdfInventoryEmailAllowed,
  isPdfInventoryPasscodeConfigured,
} from "@/lib/ticketing/pdf-inventory-gate";

export const dynamic = "force-dynamic";

export default async function AdminTicketPdfInventoryRoute() {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Account allowlist: for everyone else this URL does not exist.
  if (!isPdfInventoryEmailAllowed(user.email)) {
    notFound();
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    notFound();
  }

  const configured = isPdfInventoryPasscodeConfigured();
  const unlocked =
    configured && (await hasPdfInventoryUnlockFromCookies(String(user.id)));

  // Locked branch: do not mount the inventory client (no data fetch / no
  // preloaded rows that could be unhidden via inspect element).
  if (!unlocked) {
    return <TicketPdfInventoryPasscodeGate configured={configured} />;
  }

  return <TicketPdfInventoryPage />;
}
