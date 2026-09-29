import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { CategoriesManagementPage } from "@/components/admin/CategoriesManagementPage";

export const metadata: Metadata = {
  title: "Categories Management | Admin | Inside Karachi",
  description: "Manage categories and subcategories taxonomy",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/admin");
  }

  const allowedRoles = ["lister", "admin", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "")) {
    redirect("/admin");
  }

  return (
    <div className="p-6">
      <CategoriesManagementPage />
    </div>
  );
}
