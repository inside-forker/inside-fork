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
  channel: string | null;
  bill_value: string | number | null;
  discount_value: string | number | null;
  void_reason: string | null;
  listing_name: string;
  guest_name: string | null;
  guest_username: string | null;
  guest_id: string;
  staff_name: string | null;
  staff_username: string | null;
  owner_name: string | null;
  owner_username: string | null;
  created_at: string;
  validated_at: string | null;
  voided_at: string | null;
};

function personLabel(
  name: string | null,
  username: string | null,
  fallback = "—",
): string {
  const n = name?.trim();
  const u = username?.trim();
  if (n && u) return `${n} (@${u})`;
  if (n) return n;
  if (u) return `@${u}`;
  return fallback;
}

export default async function AdminRedemptionsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  let recent: RecentRow[] = [];
  let topMerchants: {
    owner_id: string;
    owner_name: string | null;
    owner_username: string | null;
    bill_gmv: number;
    redemption_count: number;
  }[] = [];
  let summary = {
    validated30d: 0,
    billGmv30d: 0,
    discountGmv30d: 0,
    pending: 0,
  };

  try {
    const [recentResult, summaryResult, topMerchantsResult] = await Promise.all([
      query(
        `SELECT r.id, r.status, r.code, r.channel, r.bill_value, r.discount_value,
                r.void_reason, r.created_at, r.validated_at, r.voided_at,
                r.user_id AS guest_id,
                l.name AS listing_name,
                guest.full_name AS guest_name,
                guest.username AS guest_username,
                staff.full_name AS staff_name,
                staff.username AS staff_username,
                owner.full_name AS owner_name,
                owner.username AS owner_username
         FROM public.redemptions r
         INNER JOIN listings l ON l.id = r.listing_id
         LEFT JOIN profiles guest ON guest.id = r.user_id
         LEFT JOIN profiles staff ON staff.id = r.staff_id
         LEFT JOIN profiles owner ON owner.id = COALESCE(r.owner_id, l.owner_id)
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
      query(
        `SELECT
           COALESCE(r.owner_id, l.owner_id)::text AS owner_id,
           p.full_name AS owner_name,
           p.username AS owner_username,
           COALESCE(SUM(r.bill_value), 0)::float AS bill_gmv,
           COUNT(*)::int AS redemption_count
         FROM public.redemptions r
         INNER JOIN listings l ON l.id = r.listing_id
         LEFT JOIN profiles p ON p.id = COALESCE(r.owner_id, l.owner_id)
         WHERE r.status = 'validated'
           AND r.validated_at >= now() - interval '30 days'
         GROUP BY 1, 2, 3
         ORDER BY bill_gmv DESC
         LIMIT 10`,
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
    topMerchants = topMerchantsResult.rows.map((r) => ({
      owner_id: String(r.owner_id),
      owner_name: r.owner_name as string | null,
      owner_username: r.owner_username as string | null,
      bill_gmv: Number(r.bill_gmv ?? 0),
      redemption_count: Number(r.redemption_count ?? 0),
    }));
  } catch (error) {
    console.error("admin redemptions load failed", error);
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offer redemptions</h1>
          <p className="text-muted-foreground">
            Who redeemed, who validated, and platform bill GMV.
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
          <CardTitle className="text-lg">Top merchants by bill GMV (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {topMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No validated redemptions in the last 30 days.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Redemptions</TableHead>
                    <TableHead className="text-right">Bill GMV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMerchants.map((row, i) => (
                    <TableRow key={row.owner_id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        {personLabel(row.owner_name, row.owner_username, row.owner_id)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.redemption_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs {Math.round(row.bill_gmv).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="rounded-xl border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Validated by</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {row.validated_at ? (
                          <span className="block text-xs">
                            ok{" "}
                            {new Date(row.validated_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {personLabel(row.guest_name, row.guest_username, "Unknown guest")}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                          {row.guest_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.status === "validated" || row.staff_name || row.staff_username
                          ? personLabel(row.staff_name, row.staff_username, "—")
                          : "—"}
                        {row.channel ? (
                          <span className="block text-xs text-muted-foreground">
                            via {row.channel}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {personLabel(row.owner_name, row.owner_username)}
                      </TableCell>
                      <TableCell>{row.listing_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.code}
                      </TableCell>
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
                        {row.void_reason ? (
                          <span className="block text-xs text-muted-foreground mt-1 max-w-[160px]">
                            {row.void_reason}
                          </span>
                        ) : null}
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
