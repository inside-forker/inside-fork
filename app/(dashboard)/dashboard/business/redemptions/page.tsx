import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { BusinessRedemptionsPage } from "@/components/business-owner/BusinessRedemptionsPage";

export const dynamic = "force-dynamic";

export default async function BusinessRedemptionsRoute() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  const canAccessBusiness =
    profile.role === "business_owner" ||
    profile.active_role === "business_owner" ||
    profile.role === "admin" ||
    profile.role === "super_admin";

  if (!canAccessBusiness) {
    redirect("/dashboard");
  }

  return <BusinessRedemptionsPage />;
}
