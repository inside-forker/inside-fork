import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { BusinessRedemptionsPage } from "@/components/business-owner/BusinessRedemptionsPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type RecentRow = {
  id: string;
  status: string;
  code: string;
  bill_value: string | number | null;
  discount_value: string | number | null;
  listing_name: string;
  created_at: string;
  validated_at: string | null;
};

export default async function AdminRedemptionsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  let recent: RecentRow[] = [];
  let summary = {
    validated30d: 0,
    billGmv30d: 0,
    discountGmv30d: 0,
    pending: 0,
  };

  try {
    const [recentResult, summaryResult] = await Promise.all([
      query(
        `SELECT r.id, r.status, r.code, r.bill_value, r.discount_value,
                r.created_at, r.validated_at, l.name AS listing_name
         FROM public.redemptions r
         INNER JOIN listings l ON l.id = r.listing_id
         ORDER BY r.created_at DESC
         LIMIT 50`,
      ),
      query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'validated' AND validated_at >= now() - interval '30 days'
           )::int AS validated_30d,
           COALESCE(SUM(bill_value) FILTER (
             WHERE status = 'validated' AND validated_at >= now() - interval '30 days'
           ), 0)::float AS bill_gmv_30d,
           COALESCE(SUM(discount_value) FILTER (
             WHERE status = 'validated' AND validated_at >= now() - interval '30 days'
           ), 0)::float AS discount_gmv_30d,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
         FROM public.redemptions`,
      ),
    ]);
    recent = recentResult.rows as RecentRow[];
    const s = summaryResult.rows[0];
    summary = {
      validated30d: Number(s?.validated_30d ?? 0),
      billGmv30d: Number(s?.bill_gmv_30d ?? 0),
      discountGmv30d: Number(s?.discount_gmv_30d ?? 0),
      pending: Number(s?.pending ?? 0),
    };
  } catch (error) {
    console.error("admin redemptions load failed", error);
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offer redemptions</h1>
          <p className="text-muted-foreground">
            Platform-wide redemption GMV and staff validation for any listing.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="text-sm text-primary hover:underline"
        >
          Back to Analytics
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Validated (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary.validated30d.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bill GMV (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              Rs {Math.round(summary.billGmv30d).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Discount (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              Rs {Math.round(summary.discountGmv30d).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary.pending.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <BusinessRedemptionsPage compact />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No redemptions yet (or migration not applied).
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.code}
                      </TableCell>
                      <TableCell>{row.listing_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "validated"
                              ? "secondary"
                              : row.status === "pending"
                                ? "outline"
                                : "destructive"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.bill_value != null
                          ? Number(row.bill_value).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.discount_value != null
                          ? Number(row.discount_value).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
