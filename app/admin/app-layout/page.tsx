import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { AppLayoutPage } from "@/components/admin/AppLayoutPage";

export const dynamic = "force-dynamic";

export default async function AdminAppLayoutRoute() {
  const { profile } = await requireSessionUser();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  return <AppLayoutPage />;
}
