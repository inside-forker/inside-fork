import { redirect } from "next/navigation";
import { PremiumDashboardLayout } from "@/components/dashboard/PremiumDashboardLayout";
import { AdminShell } from "@/components/admin/ui/AdminShell";
import { usesAdminShell } from "@/lib/navigation/role-navigation";
import { requireSessionUser } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const layoutUser = { id: user.id, email: user.email };

  if (usesAdminShell(profile)) {
    return (
      <AdminShell user={layoutUser} profile={profile}>
        {children}
      </AdminShell>
    );
  }

  return (
    <PremiumDashboardLayout
      user={layoutUser}
      // SessionProfile is a superset of the layout prop shape (includes active_role, etc.)
      profile={profile as React.ComponentProps<typeof PremiumDashboardLayout>["profile"]}
    >
      {children}
    </PremiumDashboardLayout>
  );
}
