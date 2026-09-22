import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { HomeHeroPage } from "@/components/admin/HomeHeroPage";

export const dynamic = "force-dynamic";

export default async function AdminHomeHeroRoute() {
  const { profile } = await requireSessionUser();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  return <HomeHeroPage />;
}
