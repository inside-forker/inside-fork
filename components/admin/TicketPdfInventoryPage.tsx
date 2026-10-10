"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Ticket,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { TicketPdfUploadDialog } from "@/components/ticketing/TicketPdfUploadDialog";
import { useToast } from "@/hooks/use-toast";

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

type EventOption = {
  event_id: number;
  event_name: string;
  event_slug: string;
};

type TicketTypeOption = {
  id: number;
  name: string;
  price: number | null;
  quantity_available: number | null;
};

export function TicketPdfInventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([]);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<
    number | ""
  >("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    price: "",
    quantity_available: "0",
    max_per_person: "10",
    sale_starts_at: "",
    sale_ends_at: "",
  });

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/events?limit=100&page=1", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || cancelled) return;
        const list = (json.data?.events ?? []) as EventOption[];
        setEvents(list);
      } catch {
        // non-blocking for inventory view
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTicketTypes = useCallback(async (eventId: number) => {
    setTicketTypes([]);
    setSelectedTicketTypeId("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load ticket types");
      }
      const list = (json.data?.ticket_types ?? []) as TicketTypeOption[];
      setTicketTypes(list);
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to load ticket types",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (selectedEventId === "") return;
    void loadTicketTypes(selectedEventId);
  }, [selectedEventId, loadTicketTypes]);

  const selectedTicketType = useMemo(
    () =>
      ticketTypes.find((t) => t.id === selectedTicketTypeId) ?? null,
    [ticketTypes, selectedTicketTypeId],
  );

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (selectedEventId === "") {
      toast({
        title: "Select an event",
        description: "Pick an event before creating a category.",
        variant: "destructive",
      });
      return;
    }
    if (
      !createForm.name.trim() ||
      !createForm.price ||
      !createForm.sale_starts_at ||
      !createForm.sale_ends_at
    ) {
      toast({
        title: "Validation Error",
        description: "Name, price, and sale dates are required.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(
        `/api/admin/events/${selectedEventId}/tickets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createForm.name.trim(),
            description: createForm.description.trim() || null,
            price: parseFloat(createForm.price),
            quantity_available: createForm.quantity_available
              ? parseInt(createForm.quantity_available, 10)
              : 0,
            sale_starts_at: createForm.sale_starts_at,
            sale_ends_at: createForm.sale_ends_at,
            max_per_person: createForm.max_per_person
              ? parseInt(createForm.max_per_person, 10)
              : 10,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create ticket type");
      }
      toast({
        title: "Category created",
        description: `"${createForm.name.trim()}" is ready for PDF uploads.`,
      });
      setCreateOpen(false);
      setCreateForm({
        name: "",
        description: "",
        price: "",
        quantity_available: "0",
        max_per_person: "10",
        sale_starts_at: "",
        sale_ends_at: "",
      });
      await loadTicketTypes(selectedEventId);
      const createdId = Number(json.data?.id);
      if (Number.isInteger(createdId) && createdId > 0) {
        setSelectedTicketTypeId(createdId);
      }
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload &amp; categories</CardTitle>
          <CardDescription>
            Create a ticket category, then upload Ticketwala PDFs one-by-one or
            in bulk. Filename must end with the ticket number (e.g.{" "}
            <code className="text-xs">002_Prism_Fam_2586389.pdf</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-event">Event</Label>
              <select
                id="inv-event"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedEventId === "" ? "" : String(selectedEventId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedEventId(v ? Number(v) : "");
                }}
              >
                <option value="">Select event…</option>
                {events.map((ev) => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-tier">Category (ticket type)</Label>
              <select
                id="inv-tier"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={
                  selectedTicketTypeId === ""
                    ? ""
                    : String(selectedTicketTypeId)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedTicketTypeId(v ? Number(v) : "");
                }}
                disabled={selectedEventId === ""}
              >
                <option value="">
                  {selectedEventId === ""
                    ? "Select an event first"
                    : "Select category…"}
                </option>
                {ticketTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedEventId === ""}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              New category
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedTicketType}
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              Upload PDFs
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {selectedTicketType && (
        <TicketPdfUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          ticketTypeId={selectedTicketType.id}
          ticketTypeName={selectedTicketType.name}
          uploadUrl="/api/admin/ticket-pdf-inventory/upload"
          onSuccess={() => {
            void load();
          }}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New ticket category</DialogTitle>
            <DialogDescription>
              Creates a ticket type for the selected event. You can upload PDFs
              into it afterward.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateCategory(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Prism Fam"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cat-price">
                  Price (PKR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cat-price"
                  type="number"
                  min="0"
                  step="1"
                  value={createForm.price}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-qty">Initial quantity</Label>
                <Input
                  id="cat-qty"
                  type="number"
                  min="0"
                  value={createForm.quantity_available}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      quantity_available: e.target.value,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Overwritten when you upload PDFs.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-max">Max per person</Label>
              <Input
                id="cat-max"
                type="number"
                min="1"
                value={createForm.max_per_person}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    max_per_person: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-start">
                Sale starts <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-start"
                type="datetime-local"
                value={createForm.sale_starts_at}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sale_starts_at: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-end">
                Sale ends <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-end"
                type="datetime-local"
                value={createForm.sale_ends_at}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sale_ends_at: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
