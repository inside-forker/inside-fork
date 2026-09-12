import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { AccountCreationHub } from "@/components/admin/AccountCreationHub";

export const metadata = {
  title: "Account Creation Hub | Inside Karachi Admin",
  description: "Create and manage Event Organizers and Gate Pass operators.",
};

export default async function AdminAccountsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check admin access (admin and super_admin allowed)
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  return <AccountCreationHub />;
}
