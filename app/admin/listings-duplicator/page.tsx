import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ListingsDuplicatorPage } from "@/components/admin/ListingsDuplicatorPage";
import { Copy, Store, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminListingsDuplicatorPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check admin / staff access (admin, super_admin, lister, data_entry)
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister" &&
    profile.role !== "data_entry"
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Copy className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Listings Duplicator
              </h1>
            </div>
            <p className="text-muted-foreground text-base max-w-3xl">
              Look up any existing listing to rapidly generate multiple branch outlets (10, 19, 20, 25+)
              sharing the same images, categories, and attributes. Customize branch locations, timings, and header names.
              All duplicates are automatically linked together under the same Brand Group.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/brand-groups">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Link2 className="h-4 w-4" /> Brand Groups
              </Button>
            </Link>
            <Link href="/admin/listings">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Store className="h-4 w-4" /> Listings Management
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Interactive Duplicator View */}
      <ListingsDuplicatorPage />
    </div>
  );
}
