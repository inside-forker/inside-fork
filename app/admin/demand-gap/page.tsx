import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth/require-session";
import { getDemandGapOverview } from "@/lib/analytics/demand-gap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminDemandGapPage() {
  const { profile } = await requireSessionUser();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const overview = await getDemandGapOverview(30, 75);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demand gap</h1>
          <p className="text-muted-foreground">
            Unmet search demand — zero-result queries the city asked for and we
            could not serve. Route listings / editorial here.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="text-sm text-primary hover:underline"
        >
          Back to Analytics
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zero-result events (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overview.totalZeroEvents30d.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique queries (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overview.uniqueQueries30d.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top list size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview.topQueries.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Top unmet queries (30d, web + mobile)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.topQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No zero-result rollup data yet. Run refresh-search-zero-results
              cron after searches land.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Zero hits</TableHead>
                    <TableHead className="text-right">Days active</TableHead>
                    <TableHead className="text-right">Last 7d</TableHead>
                    <TableHead className="text-right">Prior 7d</TableHead>
                    <TableHead>Last day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.topQueries.map((row) => (
                    <TableRow key={row.query}>
                      <TableCell className="font-medium">{row.query}</TableCell>
                      <TableCell className="text-right">
                        {row.zeroCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.daysActive}</TableCell>
                      <TableCell className="text-right">{row.trend7d}</TableCell>
                      <TableCell className="text-right">{row.prior7d}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lastDay}
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
