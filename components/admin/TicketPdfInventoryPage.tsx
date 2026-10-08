"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PARCHI_BLUE, PARCHI_YELLOW } from "@/lib/parchi/discount";

type InventoryTicket = {
  id: number;
  external_ticket_id: string;
  original_filename: string | null;
  ticket_type_id: number;
  ticket_type_name: string;
  event_id: number;
  event_name: string;
  event_slug: string;
  status: "sold" | "available";
  booking_id: number | null;
  booking_reference: string | null;
  payment_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  booking_total: number | null;
  is_parchi: boolean;
  parchi_id: string | null;
  assigned_at: string | null;
  created_at: string;
  view_url: string;
  download_url: string;
};

type TierSummary = {
  ticket_type_id: number;
  ticket_type_name: string;
  event_id: number;
  event_name: string;
  event_slug: string;
  price: number;
  total: number;
  sold: number;
  available: number;
};

type InventoryPayload = {
  generated_at: string;
  summary: { total: number; sold: number; available: number };
  tiers: TierSummary[];
  tickets: InventoryTicket[];
};

type StatusFilter = "all" | "sold" | "available" | "parchi";

const POLL_MS = 5000;

function ParchiBuyerBadge({ parchiId }: { parchiId?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: PARCHI_YELLOW, color: PARCHI_BLUE }}
      title={parchiId ? `Parchi ID: ${parchiId}` : "Verified via Parchi"}
    >
      Parchi
      {parchiId ? (
        <span className="font-mono normal-case tracking-normal opacity-80">
          · {parchiId}
        </span>
      ) : null}
    </span>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

export function TicketPdfInventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch("/api/admin/ticket-pdf-inventory", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (
          res.status === 403 &&
          (json.code === "passcode_required" ||
            json.code === "passcode_not_configured")
        ) {
          setData(null);
          router.refresh();
          return;
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load inventory");
        }
        setData(json.data as InventoryPayload);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load inventory",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  async function lockInventory() {
    if (locking) return;
    setLocking(true);
    try {
      await fetch("/api/admin/ticket-pdf-inventory/lock", { method: "POST" });
      setData(null);
      router.refresh();
    } finally {
      setLocking(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    return data.tickets.filter((ticket) => {
      if (statusFilter === "parchi") {
        if (!ticket.is_parchi) return false;
      } else if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }
      if (tierFilter !== "all" && ticket.ticket_type_id !== tierFilter) {
        return false;
      }
      return true;
    });
  }, [data, statusFilter, tierFilter]);

  const parchiSoldCount = useMemo(
    () => data?.tickets.filter((t) => t.is_parchi).length ?? 0,
    [data],
  );

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading PDF inventory…
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, sold: 0, available: 0 };
  const soldPct =
    summary.total > 0 ? Math.round((summary.sold / summary.total) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ticket PDF inventory
          </h1>
          <p className="text-muted-foreground">
            Live sold vs available for Ticketwala PDF tiers. Refreshes every{" "}
            {POLL_MS / 1000}s.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={autoRefresh ? "default" : "secondary"}>
            {autoRefresh ? "Live" : "Paused"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "Pause" : "Resume"} live
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void lockInventory()}
            disabled={locking}
          >
            {locking ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="mr-2 h-3.5 w-3.5" />
            )}
            Lock
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total PDFs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.sold}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{soldPct}% of pool</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Parchi buyers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-bold"
              style={{ color: PARCHI_BLUE }}
            >
              {parchiSoldCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              verified via Parchi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatWhen(data?.generated_at ?? null)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Asia/Karachi</p>
          </CardContent>
        </Card>
      </div>

      {(data?.tiers.length ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data!.tiers.map((tier) => {
            const pct =
              tier.total > 0 ? Math.round((tier.sold / tier.total) * 100) : 0;
            return (
              <Card key={tier.ticket_type_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    {tier.ticket_type_name}
                  </CardTitle>
                  <CardDescription>{tier.event_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold">
                        {tier.sold}
                        <span className="text-base font-medium text-muted-foreground">
                          /{tier.total}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tier.available} left · Rs{" "}
                        {Math.round(tier.price).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">{pct}% sold</Badge>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Inventory rows</CardTitle>
              <CardDescription>
                Open any PDF in a new tab, or download it. Sold rows show the
                buyer.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "sold", label: "Sold" },
                  { key: "available", label: "Available" },
                  {
                    key: "parchi",
                    label: parchiSoldCount > 0 ? `Parchi (${parchiSoldCount})` : "Parchi",
                  },
                ] as { key: StatusFilter; label: string }[]
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={statusFilter === key ? "default" : "outline"}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    key === "parchi" && statusFilter !== "parchi" && "border-[#0069DB]/40",
                  )}
                >
                  {label}
                </Button>
              ))}
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={tierFilter === "all" ? "all" : String(tierFilter)}
                onChange={(e) => {
                  const v = e.target.value;
                  setTierFilter(v === "all" ? "all" : Number(v));
                }}
              >
                <option value="all">All tiers</option>
                {(data?.tiers ?? []).map((tier) => (
                  <option key={tier.ticket_type_id} value={tier.ticket_type_id}>
                    {tier.ticket_type_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tickets match this filter.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">
                        {ticket.external_ticket_id}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {ticket.ticket_type_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ticket.event_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            ticket.status === "sold"
                              ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
                          )}
                          variant="outline"
                        >
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.status === "sold" ? (
                          <div className="space-y-1.5 min-w-[10rem]">
                            {ticket.is_parchi && (
                              <ParchiBuyerBadge parchiId={ticket.parchi_id} />
                            )}
                            <p className="text-sm font-medium">
                              {ticket.customer_name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ticket.customer_email || "—"}
                            </p>
                            {ticket.customer_phone && (
                              <p className="text-xs text-muted-foreground">
                                {ticket.customer_phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.booking_reference ? (
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs">
                              {ticket.booking_reference}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {ticket.payment_status || "—"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatWhen(ticket.assigned_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={ticket.view_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              View
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <a href={ticket.download_url} download>
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
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
