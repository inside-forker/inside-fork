import { redirect } from "next/navigation";
import { getMobileEventsOverview } from "@/lib/analytics/mobile-events";
import { requireSessionUser } from "@/lib/auth/require-session";
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminMobileEventsPage() {
  const { profile } = await requireSessionUser();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const { summary, zeroResultQueries, recentEvents } =
    await getMobileEventsOverview();

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Mobile Events</h1>
        <p className="text-muted-foreground">
          Screen views and search activity from the mobile app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Events (7d)" value={summary.totalLast7d} />
        <StatCard label="Screen views (7d)" value={summary.screenViewsLast7d} />
        <StatCard label="Searches (7d)" value={summary.searchesLast7d} />
        <StatCard
          label="Zero-result searches (7d)"
          value={summary.zeroResultLast7d}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Zero-result search terms (last 30 days, web + mobile)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {zeroResultQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No zero-result searches in the last 30 days.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-semibold">Query</TableHead>
                    <TableHead className="w-24 text-right font-semibold">
                      Count
                    </TableHead>
                    <TableHead className="w-24 text-right font-semibold">
                      Days
                    </TableHead>
                    <TableHead className="w-40 font-semibold">
                      Last day
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zeroResultQueries.map((row) => (
                    <TableRow
                      key={row.query}
                      className="border-b border-border/30 hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{row.query}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.daysActive ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lastSeen.includes("T")
                          ? formatDateTime(row.lastSeen)
                          : row.lastSeen}
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
          <CardTitle className="text-lg">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No events recorded yet.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-semibold">Time</TableHead>
                    <TableHead className="font-semibold">Event</TableHead>
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">Source</TableHead>
                    <TableHead className="font-semibold">Screen</TableHead>
                    <TableHead className="font-semibold">Platform</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((event) => {
                    const userLabel = event.isAuthenticated
                      ? event.actorName && event.actorUsername
                        ? `${event.actorName} (@${event.actorUsername})`
                        : event.actorName ||
                          (event.actorUsername
                            ? `@${event.actorUsername}`
                            : event.userId
                              ? `User ${event.userId.slice(0, 8)}…`
                              : "User")
                      : event.anonId
                        ? `Anon ${event.anonId.slice(0, 8)}…`
                        : "Anon";

                    return (
                      <TableRow
                        key={event.id}
                        className="border-b border-border/30 hover:bg-muted/50"
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(event.occurredAt)}
                        </TableCell>
                        <TableCell>
                          <code className="px-2 py-1 rounded-md bg-muted/50 text-xs font-mono border border-border/30">
                            {event.eventName}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{userLabel}</div>
                          <Badge
                            variant={event.isAuthenticated ? "secondary" : "outline"}
                            className="mt-1"
                          >
                            {event.isAuthenticated ? "Signed in" : "Anonymous"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.sourceContext}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.screen ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.platform ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
