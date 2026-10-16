import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ListingsManagementPage } from "@/components/admin/ListingsManagementPage";
import { Copy, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminListingsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  // Check admin access
  if (
    profile.role !== "admin" &&
    profile.role !== "super_admin" &&
    profile.role !== "lister"
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      {/* Header - consistent with events management */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Listings Management
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Manage business listings, moderate content, and oversee listing
              performance across the platform.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/listings-duplicator">
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Copy className="h-4 w-4" />
                Listings Duplicator
              </Button>
            </Link>
            <Link href="/admin/brand-groups">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Link2 className="h-4 w-4" />
                Brand Groups
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Listings Management Component */}
      <ListingsManagementPage />
    </div>
  );
}
