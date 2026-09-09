import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth/require-session";
import { query } from "@/lib/db";
import { ALL_SEGMENT_QUERIES } from "@/lib/segments/definitions";
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

export default async function AdminSegmentsPage() {
  const { profile } = await requireSessionUser();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  let rows: {
    segment_slug: string;
    member_count: number;
    last_confirmed_at: string | null;
  }[] = [];

  try {
    const { rows: dbRows } = await query(
      `SELECT segment_slug,
              COUNT(*)::int AS member_count,
              MAX(last_confirmed_at)::text AS last_confirmed_at
       FROM public.segment_membership
       GROUP BY segment_slug
       ORDER BY member_count DESC, segment_slug ASC`,
    );
    rows = dbRows.map((r) => ({
      segment_slug: String(r.segment_slug),
      member_count: Number(r.member_count ?? 0),
      last_confirmed_at: r.last_confirmed_at
        ? String(r.last_confirmed_at)
        : null,
    }));
  } catch (error) {
    console.error("admin segments load failed", error);
  }

  const bySlug = new Map(rows.map((r) => [r.segment_slug, r]));
  const defined = ALL_SEGMENT_QUERIES.map((q) => {
    const hit = bySlug.get(q.slug);
    return {
      slug: q.slug,
      memberCount: hit?.member_count ?? 0,
      lastConfirmedAt: hit?.last_confirmed_at ?? null,
    };
  });

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-muted-foreground">
            Membership counts from nightly refresh ({ALL_SEGMENT_QUERIES.length}{" "}
            defined).
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="text-sm text-primary hover:underline"
        >
          Back to Analytics
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Segment membership</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Last confirmed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defined.map((row) => (
                  <TableRow key={row.slug}>
                    <TableCell>
                      <code className="text-xs">{row.slug}</code>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.memberCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastConfirmedAt
                        ? new Date(row.lastConfirmedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
