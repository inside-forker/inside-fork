import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { AccountCreationHub } from "@/components/admin/AccountCreationHub";

export const metadata = {
  title: "Accounts & Gate Allocation Hub | Inside Karachi Admin",
  description: "Create and manage Event Organizers, Gate Pass operators, and device gate allocations.",
};

interface AdminAccountsPageProps {
  searchParams?: Promise<{ tab?: string; event_id?: string }>;
}

export default async function AdminAccountsPage({ searchParams }: AdminAccountsPageProps) {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check access (admin, super_admin, organizer, and lister allowed)
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "organizer" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const initialTab = typeof params.tab === "string" ? params.tab : undefined;
  const rawEventId = params.event_id ? parseInt(params.event_id, 10) : undefined;
  const initialEventId = rawEventId && !isNaN(rawEventId) ? rawEventId : undefined;

  return (
    <AccountCreationHub
      initialTab={initialTab}
      initialEventId={initialEventId}
    />
  );
}
