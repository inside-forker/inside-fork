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
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Ticket,
  Upload,
  X,
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
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs"
      style={{ backgroundColor: PARCHI_YELLOW, color: PARCHI_BLUE }}
      title={parchiId ? `Parchi ID: ${parchiId}` : "Verified via Parchi"}
    >
      <Sparkles className="h-2.5 w-2.5" />
      Parchi
      {parchiId ? (
        <span className="font-mono normal-case tracking-normal opacity-85">
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
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Quick Action States
  const [previewTicket, setPreviewTicket] = useState<InventoryTicket | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Creation & Upload
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([]);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<number | "">("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTargetTier, setUploadTargetTier] = useState<{ id: number; name: string } | null>(null);
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1500);
  };

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

  // Filtered & Searched Tickets
  const filteredTickets = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();

    return data.tickets.filter((ticket) => {
      // Status filter
      if (statusFilter === "parchi") {
        if (!ticket.is_parchi) return false;
      } else if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }

      // Tier filter
      if (tierFilter !== "all" && ticket.ticket_type_id !== tierFilter) {
        return false;
      }

      // Search query
      if (query) {
        const matchesId = ticket.external_ticket_id.toLowerCase().includes(query);
        const matchesCustomer =
          ticket.customer_name?.toLowerCase().includes(query) ||
          ticket.customer_email?.toLowerCase().includes(query) ||
          ticket.customer_phone?.toLowerCase().includes(query);
        const matchesBooking = ticket.booking_reference?.toLowerCase().includes(query);
        const matchesTier = ticket.ticket_type_name.toLowerCase().includes(query);
        const matchesFilename = ticket.original_filename?.toLowerCase().includes(query);
        const matchesParchi = ticket.parchi_id?.toLowerCase().includes(query);

        if (
          !matchesId &&
          !matchesCustomer &&
          !matchesBooking &&
          !matchesTier &&
          !matchesFilename &&
          !matchesParchi
        ) {
          return false;
        }
      }

      return true;
    });
  }, [data, statusFilter, tierFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tierFilter, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  const parchiSoldCount = useMemo(
    () => data?.tickets.filter((t) => t.is_parchi).length ?? 0,
    [data],
  );

  const handleOpenUploadForTier = (tier: TierSummary) => {
    setUploadTargetTier({ id: tier.ticket_type_id, name: tier.ticket_type_name });
    setUploadOpen(true);
  };

  const handleExportCsv = () => {
    if (!data || filteredTickets.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no tickets matching your current filter.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Ticket ID",
      "Tier Name",
      "Event Name",
      "Status",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Booking Reference",
      "Payment Status",
      "Booking Total (PKR)",
      "Is Parchi",
      "Parchi ID",
      "Assigned At",
      "Created At",
    ];

    const rows = filteredTickets.map((t) => [
      `"${t.external_ticket_id}"`,
      `"${t.ticket_type_name.replace(/"/g, '""')}"`,
      `"${t.event_name.replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${(t.customer_name || "").replace(/"/g, '""')}"`,
      `"${(t.customer_email || "").replace(/"/g, '""')}"`,
      `"${(t.customer_phone || "").replace(/"/g, '""')}"`,
      `"${(t.booking_reference || "").replace(/"/g, '""')}"`,
      `"${(t.payment_status || "").replace(/"/g, '""')}"`,
      t.booking_total ?? "",
      t.is_parchi ? "Yes" : "No",
      `"${t.parchi_id || ""}"`,
      `"${t.assigned_at || ""}"`,
      `"${t.created_at}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `ticket-pdf-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export downloaded",
      description: `Exported ${filteredTickets.length} ticket rows to CSV.`,
    });
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading ticket PDF inventory…</p>
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, sold: 0, available: 0 };
  const soldPct =
    summary.total > 0 ? Math.round((summary.sold / summary.total) * 100) : 0;
  const availPct = 100 - soldPct;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ticket PDF inventory
            </h1>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
                autoRefresh
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-muted text-muted-foreground border border-border",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground",
                )}
              />
              {autoRefresh ? "Live" : "Paused"}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time stock monitoring for Ticketwala PDF tiers. Syncs every {POLL_MS / 1000}s.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoRefresh ? "outline" : "secondary"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className="text-xs h-9"
          >
            {autoRefresh ? "Pause stream" : "Resume stream"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={refreshing}
            className="text-xs h-9"
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!data || filteredTickets.length === 0}
            className="text-xs h-9"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLockConfirmOpen(true)}
            disabled={locking}
            className="text-xs h-9 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:text-red-800 hover:border-red-300 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            {locking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="mr-1.5 h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            )}
            Lock view
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards with Click-to-Filter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {/* Total PDFs */}
        <div
          onClick={() => setStatusFilter("all")}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            statusFilter === "all"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border/70 bg-card hover:border-primary/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total PDFs
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Ticket className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold tracking-tight">{summary.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              All inventory files
            </p>
          </div>
        </div>

        {/* Sold */}
        <div
          onClick={() => setStatusFilter("sold")}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            statusFilter === "sold"
              ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
              : "border-border/70 bg-card hover:border-emerald-500/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sold
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {summary.sold}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                {soldPct}% of pool
              </span>
            </div>
          </div>
        </div>

        {/* Available */}
        <div
          onClick={() => setStatusFilter("available")}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            statusFilter === "available"
              ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20"
              : "border-border/70 bg-card hover:border-sky-500/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Available
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold tracking-tight text-sky-600 dark:text-sky-400">
              {summary.available}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {availPct}% ready to issue
            </p>
          </div>
        </div>

        {/* Parchi buyers */}
        <div
          onClick={() => setStatusFilter("parchi")}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            statusFilter === "parchi"
              ? "border-[#0069DB] bg-[#0069DB]/10 ring-2 ring-[#0069DB]/20"
              : "border-border/70 bg-card hover:border-[#0069DB]/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: PARCHI_BLUE }}
            >
              Parchi
            </span>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg shadow-xs"
              style={{ backgroundColor: PARCHI_YELLOW, color: PARCHI_BLUE }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: PARCHI_BLUE }}
            >
              {parchiSoldCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified via Parchi
            </p>
          </div>
        </div>

        {/* Last update */}
        <div
          onClick={() => void load()}
          title="Click to refresh now"
          className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm shadow-xs col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Last Sync
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-base font-bold truncate">
              {formatWhen(data?.generated_at ?? null)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Asia/Karachi · Click to sync
            </p>
          </div>
        </div>
      </div>

      {/* Upload & Management Card */}
      <Card className="border border-border/70 shadow-xs bg-linear-to-b from-card to-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Upload &amp; Manage Ticket PDFs
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select an event and category to upload Ticketwala PDFs in bulk or one-by-one.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
              <span>PDF naming:</span>
              <code className="font-mono text-[11px] font-semibold text-foreground">
                002_Prism_Fam_2586389.pdf
              </code>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Event Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-event" className="text-xs font-semibold">
                Event
              </Label>
              <div className="relative">
                <select
                  id="inv-event"
                  className="w-full appearance-none rounded-lg border border-border/80 bg-background px-3.5 py-2.5 pr-10 text-sm font-medium shadow-2xs transition-colors hover:border-primary/50 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 dark:bg-card"
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
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-tier" className="text-xs font-semibold">
                Category (Ticket Type)
              </Label>
              <div className="relative">
                <select
                  id="inv-tier"
                  className="w-full appearance-none rounded-lg border border-border/80 bg-background px-3.5 py-2.5 pr-10 text-sm font-medium shadow-2xs transition-colors hover:border-primary/50 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card"
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
                      {tt.name} {tt.price ? `(Rs ${Math.round(tt.price).toLocaleString()})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedEventId === ""}
                onClick={() => setCreateOpen(true)}
                className="text-xs h-9"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New category
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!selectedTicketType}
                onClick={() => {
                  if (selectedTicketType) {
                    setUploadTargetTier({
                      id: selectedTicketType.id,
                      name: selectedTicketType.name,
                    });
                    setUploadOpen(true);
                  }
                }}
                className="text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload PDFs {selectedTicketType ? `to "${selectedTicketType.name}"` : ""}
              </Button>
            </div>

            {selectedTicketType && (
              <span className="text-xs text-muted-foreground font-medium">
                Current category:{" "}
                <span className="font-semibold text-foreground">
                  {selectedTicketType.name}
                </span>{" "}
                · Stock: {selectedTicketType.quantity_available ?? 0}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier Summaries Grid */}
      {(data?.tiers.length ?? 0) > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tier Breakdown ({data!.tiers.length})
            </h2>
            {tierFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTierFilter("all")}
                className="text-xs h-7 text-primary hover:text-primary/80"
              >
                Clear tier filter (Show all)
              </Button>
            )}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {data!.tiers.map((tier) => {
              const pct =
                tier.total > 0 ? Math.round((tier.sold / tier.total) * 100) : 0;
              const isSelected = tierFilter === tier.ticket_type_id;

              return (
                <div
                  key={tier.ticket_type_id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-4 transition-all shadow-xs bg-card",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border/70 hover:border-border hover:shadow-sm",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Ticket className="h-3.5 w-3.5 text-primary shrink-0" />
                          <h3 className="text-sm font-bold truncate">
                            {tier.ticket_type_name}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {tier.event_name}
                        </p>
                      </div>

                      <Badge
                        variant="secondary"
                        className="text-[11px] font-semibold shrink-0"
                      >
                        Rs {Math.round(tier.price).toLocaleString()}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">{tier.sold}</span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            / {tier.total} sold
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                          <span className="font-bold text-foreground">
                            {tier.available}
                          </span>{" "}
                          available
                        </p>
                      </div>
                      <Badge
                        variant={pct >= 100 ? "destructive" : "outline"}
                        className="text-xs font-semibold"
                      >
                        {pct}% sold
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct >= 100
                            ? "bg-rose-500"
                            : pct > 75
                            ? "bg-amber-500"
                            : "bg-primary",
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions on Tier Card */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 gap-2">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setTierFilter((curr) =>
                          curr === tier.ticket_type_id ? "all" : tier.ticket_type_id,
                        )
                      }
                      className="text-xs h-8 flex-1"
                    >
                      {isSelected ? "Filtering" : "Filter table"}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenUploadForTier(tier)}
                      className="text-xs h-8 gap-1.5"
                      title={`Upload PDFs directly to ${tier.ticket_type_name}`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add PDFs
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Inventory Rows Card */}
      <Card className="border border-border/70 shadow-xs">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>Inventory Records</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {filteredTickets.length} of {data?.tickets.length ?? 0}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Inspect, preview, download, or trace buyer details and booking references.
              </CardDescription>
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "available", label: `Available (${summary.available})` },
                  { key: "sold", label: `Sold (${summary.sold})` },
                  {
                    key: "parchi",
                    label:
                      parchiSoldCount > 0
                        ? `Parchi (${parchiSoldCount})`
                        : "Parchi",
                  },
                ] as { key: StatusFilter; label: string }[]
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={statusFilter === key ? "default" : "outline"}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "text-xs h-8 rounded-lg",
                    key === "parchi" &&
                      statusFilter !== "parchi" &&
                      "border-[#0069DB]/40 text-[#0069DB] hover:bg-[#0069DB]/10",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Search Bar & Secondary Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-border/50">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket ID, buyer name, email, phone, booking ref…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Tier Select */}
            <div className="relative w-full sm:w-auto">
              <select
                className="h-9 w-full sm:w-48 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-xs font-medium shadow-2xs hover:border-primary/50 focus:border-primary focus:outline-hidden"
                value={tierFilter === "all" ? "all" : String(tierFilter)}
                onChange={(e) => {
                  const v = e.target.value;
                  setTierFilter(v === "all" ? "all" : Number(v));
                }}
              >
                <option value="all">All Tiers ({data?.tiers.length ?? 0})</option>
                {(data?.tiers ?? []).map((tier) => (
                  <option key={tier.ticket_type_id} value={tier.ticket_type_id}>
                    {tier.ticket_type_name} ({tier.sold}/{tier.total})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>

            {/* Clear All Filters Button */}
            {(searchQuery || statusFilter !== "all" || tierFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTierFilter("all");
                }}
                className="text-xs h-9 text-muted-foreground hover:text-foreground ml-auto sm:ml-0"
              >
                Reset filters
              </Button>
            )}

            {/* Page Size Selector */}
            <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Per page:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {filteredTickets.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold">No tickets found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  No records match your active search or filters. Try adjusting your search term or clearing the filters.
                </p>
              </div>
              {(searchQuery || statusFilter !== "all" || tierFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTierFilter("all");
                  }}
                  className="text-xs mt-2"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 overflow-x-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-32">Ticket ID</TableHead>
                      <TableHead>Tier &amp; Event</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Buyer Details</TableHead>
                      <TableHead>Booking Reference</TableHead>
                      <TableHead className="w-32">Assigned At</TableHead>
                      <TableHead className="text-right w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-muted/30">
                        {/* Ticket ID */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold px-2 py-1 bg-muted rounded-md border border-border/50">
                              {ticket.external_ticket_id}
                            </span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  ticket.external_ticket_id,
                                  `ticket-${ticket.id}`,
                                )
                              }
                              className="text-muted-foreground hover:text-foreground p-1 rounded-sm transition-colors"
                              title="Copy Ticket ID"
                            >
                              {copiedKey === `ticket-${ticket.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          {ticket.original_filename && (
                            <p
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px] mt-1"
                              title={ticket.original_filename}
                            >
                              {ticket.original_filename}
                            </p>
                          )}
                        </TableCell>

                        {/* Tier & Event */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold">
                              {ticket.ticket_type_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {ticket.event_name}
                            </p>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[11px] font-semibold uppercase tracking-wider",
                              ticket.status === "sold"
                                ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                                : "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
                            )}
                            variant="outline"
                          >
                            {ticket.status}
                          </Badge>
                        </TableCell>

                        {/* Buyer */}
                        <TableCell>
                          {ticket.status === "sold" ? (
                            <div className="space-y-1 min-w-[11rem]">
                              {ticket.is_parchi && (
                                <div>
                                  <ParchiBuyerBadge parchiId={ticket.parchi_id} />
                                </div>
                              )}
                              <p className="text-xs font-semibold">
                                {ticket.customer_name || "—"}
                              </p>
                              {ticket.customer_email && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <span className="truncate max-w-[180px]">
                                    {ticket.customer_email}
                                  </span>
                                </div>
                              )}
                              {ticket.customer_phone && (
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  {ticket.customer_phone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 italic">
                              Unassigned (In stock)
                            </span>
                          )}
                        </TableCell>

                        {/* Booking */}
                        <TableCell>
                          {ticket.booking_reference ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {ticket.booking_reference}
                                </span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      ticket.booking_reference!,
                                      `booking-${ticket.id}`,
                                    )
                                  }
                                  className="text-muted-foreground hover:text-foreground p-0.5 rounded-sm"
                                  title="Copy Booking Reference"
                                >
                                  {copiedKey === `booking-${ticket.id}` ? (
                                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] capitalize font-medium py-0 px-1.5"
                                >
                                  {ticket.payment_status || "—"}
                                </Badge>
                                {ticket.booking_total && (
                                  <span className="text-muted-foreground font-mono text-[10px]">
                                    Rs {Math.round(ticket.booking_total).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>

                        {/* Assigned At */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatWhen(ticket.assigned_at)}
                        </TableCell>

                        {/* PDF Actions */}
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewTicket(ticket)}
                              className="h-8 px-2.5 text-xs gap-1"
                              title="Preview PDF modal"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Preview</span>
                            </Button>

                            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="Download PDF">
                              <a href={ticket.download_url} download>
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>

                            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="Open PDF in new tab">
                              <a
                                href={ticket.view_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Table Footer with Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-border/40 mt-3">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(
                      (currentPage - 1) * pageSize + 1,
                      filteredTickets.length,
                    )}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(currentPage * pageSize, filteredTickets.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {filteredTickets.length}
                  </span>{" "}
                  tickets
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>

                  <span className="text-xs font-semibold px-2">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2 text-xs"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PDF Quick Preview Modal */}
      <Dialog
        open={previewTicket !== null}
        onOpenChange={(open) => !open && setPreviewTicket(null)}
      >
        <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Ticket #{previewTicket?.external_ticket_id}</span>
                <Badge
                  variant={previewTicket?.status === "sold" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {previewTicket?.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {previewTicket?.ticket_type_name} · {previewTicket?.event_name}
                {previewTicket?.customer_name ? ` · Issued to ${previewTicket.customer_name}` : ""}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 pr-6">
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <a href={previewTicket?.download_url} download>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <a
                  href={previewTicket?.view_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in Tab
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 w-full h-full bg-muted/20 relative">
            {previewTicket && (
              <iframe
                src={previewTicket.view_url}
                className="w-full h-full border-none"
                title={`Ticket ${previewTicket.external_ticket_id}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lock Confirmation Dialog */}
      <Dialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" />
              Lock inventory view?
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              This will clear your unlocked session cookie. You will need to enter the admin passcode again to re-access this inventory page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLockConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                setLockConfirmOpen(false);
                void lockInventory();
              }}
            >
              Lock now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      {uploadTargetTier && (
        <TicketPdfUploadDialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) setUploadTargetTier(null);
          }}
          ticketTypeId={uploadTargetTier.id}
          ticketTypeName={uploadTargetTier.name}
          uploadUrl="/api/admin/ticket-pdf-inventory/upload"
          onSuccess={() => {
            void load(true);
          }}
        />
      )}

      {/* New Category Modal */}
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
