"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  BarChart3,
  CheckCircle,
  Download,
  Eye,
  GraduationCap,
  List,
  Loader2,
  Mail,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import {
  AdminDataTable,
  AdminFilterBar,
  AdminPageShell,
  SegmentedControl,
  StatusBadge,
  type AdminColumn,
  type DateRangeValue,
  type SortState,
} from "@/components/admin/ui";

interface BookingItem {
  quantity: number;
  price_per_ticket: number;
  ticket_type_name: string;
}

interface BookingGuest {
  id?: number;
  name: string | null;
  cnic: string | null;
  ticket_type: string | null;
  code: string;
  status: string;
  checked_in_at: string | null;
  issued_at?: string | null;
  quantity_index?: number;
  ticket_type_id?: number | null;
  assigned_gate_index?: number | null;
  gate_label?: string | null;
}

interface Booking {
  id: number;
  booking_reference: string | null;
  payment_status: string | null;
  status: string;
  total_amount: number;
  discount_amount?: number;
  is_parchi?: boolean;
  parchi_id?: string | null;
  parchi_status?: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  cnic_last4: string | null;
  event: {
    id: number;
    name: string;
    slug: string;
    start_time?: string | null;
    location_name?: string | null;
  } | null;
  user: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  total_tickets: number;
  items: BookingItem[];
  guests: BookingGuest[];
}

interface EventOption {
  id: number;
  name: string;
  slug?: string;
  start_time?: string | null;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function AdminBookingsManagement() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [eventsList, setEventsList] = React.useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [eventFilter, setEventFilter] = React.useState<string>("all");
  const [channelFilter, setChannelFilter] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRangeValue>({});

  // View mode: detailed bookings table vs aggregate event breakdown matrix
  const [viewMode, setViewMode] = React.useState<"table" | "breakdown">("table");

  // Sorting & Pagination
  const [sort, setSort] = React.useState<SortState>({ id: "date", dir: "desc" });
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  // Detail Modal
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = React.useState(false);

  const { toast } = useToast();

  // Prevent layout shift when dialog opens
  React.useEffect(() => {
    if (selectedBooking) {
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      removeScrollLock();

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "data-scroll-locked" &&
            body.hasAttribute("data-scroll-locked")
          ) {
            removeScrollLock();
          }
        });
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [selectedBooking]);

  // Fetch bookings, events, and user role
  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/bookings");
      const result = await response.json();

      if (result.success) {
        const rawBookings: Booking[] = result.data || [];
        setBookings(rawBookings);
        setUserRole(result.userRole);

        if (result.events && Array.isArray(result.events)) {
          setEventsList(result.events);
        } else {
          const map = new Map<number, string>();
          rawBookings.forEach((b) => {
            if (b.event?.id && b.event?.name) {
              map.set(b.event.id, b.event.name);
            }
          });
          setEventsList(
            Array.from(map.entries()).map(([id, name]) => ({ id, name })),
          );
        }
      } else {
        throw new Error(result.error || "Failed to fetch bookings");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch bookings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate event-level performance breakdown
  const eventBreakdown = React.useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        name: string;
        totalBookings: number;
        paidBookings: number;
        paidTickets: number;
        paidRevenue: number;
        parchiBookings: number;
        parchiPaidTickets: number;
        parchiPaidRevenue: number;
      }
    >();

    for (const b of bookings) {
      const eventId = b.event?.id ?? 0;
      const eventName = b.event?.name ?? "No event";
      const existing = map.get(eventId) || {
        id: eventId,
        name: eventName,
        totalBookings: 0,
        paidBookings: 0,
        paidTickets: 0,
        paidRevenue: 0,
        parchiBookings: 0,
        parchiPaidTickets: 0,
        parchiPaidRevenue: 0,
      };

      existing.totalBookings += 1;
      if (b.is_parchi) existing.parchiBookings += 1;

      if (b.payment_status === "paid") {
        existing.paidBookings += 1;
        existing.paidTickets += b.total_tickets || 0;
        existing.paidRevenue += Number(b.total_amount) || 0;

        if (b.is_parchi) {
          existing.parchiPaidTickets += b.total_tickets || 0;
          existing.parchiPaidRevenue += Number(b.total_amount) || 0;
        }
      }

      map.set(eventId, existing);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.paidRevenue - a.paidRevenue,
    );
  }, [bookings]);

  // Contextual bookings for dynamic top KPI metrics (respects active event & channel filter)
  const contextBookings = React.useMemo(() => {
    let list = bookings;
    if (eventFilter !== "all") {
      list = list.filter((b) => String(b.event?.id) === eventFilter);
    }
    if (channelFilter === "parchi") {
      list = list.filter((b) => b.is_parchi);
    } else if (channelFilter === "inside") {
      list = list.filter((b) => !b.is_parchi);
    }
    return list;
  }, [bookings, eventFilter, channelFilter]);

  // Dynamic KPI Stats
  const stats = React.useMemo(() => {
    const total = contextBookings.length;
    const paidList = contextBookings.filter((b) => b.payment_status === "paid");
    const paid = paidList.length;
    const paidTickets = paidList.reduce(
      (sum, b) => sum + (b.total_tickets || 0),
      0,
    );
    const awaiting = contextBookings.filter(
      (b) => b.payment_status === "awaiting_payment",
    ).length;
    const failed = contextBookings.filter(
      (b) => b.payment_status === "failed",
    ).length;
    const revenue = paidList.reduce(
      (sum, b) => sum + (Number(b.total_amount) || 0),
      0,
    );

    // Parchi specific metrics
    const parchiTotal = contextBookings.filter((b) => b.is_parchi).length;
    const parchiPaidList = paidList.filter((b) => b.is_parchi);
    const parchiPaidCount = parchiPaidList.length;
    const parchiTickets = parchiPaidList.reduce(
      (sum, b) => sum + (b.total_tickets || 0),
      0,
    );
    const parchiRevenue = parchiPaidList.reduce(
      (sum, b) => sum + (Number(b.total_amount) || 0),
      0,
    );

    return {
      total,
      paid,
      paidTickets,
      awaiting,
      failed,
      revenue,
      parchiTotal,
      parchiPaidCount,
      parchiTickets,
      parchiRevenue,
    };
  }, [contextBookings]);

  // Filter bookings for table display
  const filteredBookings = React.useMemo(() => {
    let list = bookings;

    // Filter by Event
    if (eventFilter !== "all") {
      list = list.filter((b) => String(b.event?.id) === eventFilter);
    }

    // Filter by Channel (Parchi vs Inside Direct)
    if (channelFilter === "parchi") {
      list = list.filter((b) => b.is_parchi);
    } else if (channelFilter === "inside") {
      list = list.filter((b) => !b.is_parchi);
    }

    // Filter by Status
    if (statusFilter !== "all") {
      list = list.filter((b) => b.payment_status === statusFilter);
    }

    // Filter by Date Range
    if (dateRange.from) {
      const fromTime = new Date(`${dateRange.from}T00:00:00`).getTime();
      list = list.filter((b) => new Date(b.created_at).getTime() >= fromTime);
    }
    if (dateRange.to) {
      const toTime = new Date(`${dateRange.to}T23:59:59.999`).getTime();
      list = list.filter((b) => new Date(b.created_at).getTime() <= toTime);
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.booking_reference?.toLowerCase().includes(q) ||
          b.customer_name?.toLowerCase().includes(q) ||
          b.customer_email?.toLowerCase().includes(q) ||
          b.customer_phone?.toLowerCase().includes(q) ||
          b.event?.name.toLowerCase().includes(q) ||
          b.parchi_id?.toLowerCase().includes(q),
      );
    }

    // Sorting
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.id === "date") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sort.id === "amount") {
        cmp = Number(a.total_amount) - Number(b.total_amount);
      } else if (sort.id === "tickets") {
        cmp = (a.total_tickets || 0) - (b.total_tickets || 0);
      } else if (sort.id === "customer") {
        cmp = (a.customer_name || "").localeCompare(b.customer_name || "");
      } else if (sort.id === "event") {
        cmp = (a.event?.name || "").localeCompare(b.event?.name || "");
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [bookings, eventFilter, channelFilter, statusFilter, searchQuery, sort]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [eventFilter, channelFilter, statusFilter, searchQuery, dateRange]);

  const paginatedBookings = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBookings.slice(startIndex, startIndex + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  const hasFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    eventFilter !== "all" ||
    channelFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setEventFilter("all");
    setChannelFilter("all");
    setDateRange({});
  };

  const selectedEventName =
    eventFilter !== "all"
      ? eventsList.find((e) => String(e.id) === eventFilter)?.name || "Event"
      : null;

  // Export current filtered records to CSV
  const handleExportCsv = () => {
    if (filteredBookings.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no bookings matching the current filters.",
      });
      return;
    }

    const headers = [
      "Booking Reference",
      "Event Name",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Tickets Count",
      "Ticket Types",
      "Total Amount (PKR)",
      "Discount (PKR)",
      "Channel",
      "Parchi ID",
      "Payment Status",
      "Order Date",
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredBookings.map((b) => [
      escapeCsv(b.booking_reference || `#${b.id}`),
      escapeCsv(b.event?.name || "No event"),
      escapeCsv(b.customer_name || b.user?.full_name || ""),
      escapeCsv(b.customer_email || ""),
      escapeCsv(b.customer_phone || b.user?.phone || ""),
      escapeCsv(b.total_tickets || 0),
      escapeCsv(
        b.items?.map((i) => `${i.quantity}x ${i.ticket_type_name}`).join(", ") ||
          "",
      ),
      escapeCsv(b.total_amount || 0),
      escapeCsv(b.discount_amount || 0),
      escapeCsv(b.is_parchi ? "Parchi Student" : "Inside Direct"),
      escapeCsv(b.parchi_id || ""),
      escapeCsv(b.payment_status || "unknown"),
      escapeCsv(format(new Date(b.created_at), "yyyy-MM-dd HH:mm:ss")),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const activeEventSlug =
      eventFilter !== "all"
        ? (selectedEventName || "event").replace(/\s+/g, "_").toLowerCase()
        : "all_events";
    link.setAttribute(
      "download",
      `inside_karachi_bookings_${activeEventSlug}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export complete",
      description: `Exported ${filteredBookings.length} booking records.`,
    });
  };

  // Mark booking as paid (super admin action)
  const handleMarkAsPaid = async (bookingId: number) => {
    try {
      setIsMarkingPaid(true);
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/mark-paid`,
        { method: "POST" },
      );
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        setSelectedBooking(null);
        fetchData();
      } else {
        throw new Error(result.error || "Failed to mark as paid");
      }
    } catch (error) {
      console.error("Mark paid error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to mark as paid",
        variant: "destructive",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Table columns definition for AdminDataTable
  const columns: AdminColumn<Booking>[] = [
    {
      id: "booking",
      header: "Booking & Customer",
      priority: 1,
      hideable: false,
      className: "min-w-[210px]",
      cell: (b) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {b.booking_reference || `#${b.id}`}
            </span>
            {b.is_parchi && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded bg-[#0069DB]/10 px-2 text-xs font-semibold text-[#0069DB]">
                <GraduationCap className="size-3" />
                Parchi {b.parchi_id ? `#${b.parchi_id}` : ""}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-foreground font-medium">
            <span className="truncate">
              {b.customer_name || b.user?.full_name || "Guest"}
            </span>
            <span className="text-xs text-muted-foreground font-normal truncate">
              · {b.customer_email || "-"}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "event",
      header: "Event",
      priority: 1,
      sortable: true,
      className: "min-w-[170px]",
      cell: (b) => (
        <div className="min-w-0 max-w-[200px]">
          <div className="font-medium text-sm truncate">
            {b.event?.name || (
              <span className="text-muted-foreground text-xs italic">
                No event
              </span>
            )}
          </div>
          {b.event?.location_name && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{b.event.location_name}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "channel",
      header: "Channel",
      className: "min-w-[120px]",
      cell: (b) =>
        b.is_parchi ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#0069DB]/15 text-[#0069DB]">
            <GraduationCap className="size-3.5" />
            Parchi App
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted">
            Inside Direct
          </span>
        ),
    },
    {
      id: "tickets",
      header: "Tickets",
      align: "end",
      sortable: true,
      className: "min-w-[90px]",
      cell: (b) => (
        <div className="tabular-nums text-right">
          <span className="font-semibold text-sm">{b.total_tickets || 0}</span>
          <span className="text-xs text-muted-foreground block truncate max-w-[120px]">
            {b.items?.map((i) => i.ticket_type_name).join(", ") || "Standard"}
          </span>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      sortable: true,
      className: "min-w-[120px]",
      cell: (b) => (
        <div className="tabular-nums text-right">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
            PKR {Number(b.total_amount).toLocaleString()}
          </div>
          {Number(b.discount_amount) > 0 && (
            <div className="text-[11px] text-muted-foreground">
              -PKR {Number(b.discount_amount).toLocaleString()}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "min-w-[120px]",
      cell: (b) => (
        <StatusBadge status={b.payment_status || b.status || "unknown"} />
      ),
    },
    {
      id: "date",
      header: "Date",
      align: "end",
      sortable: true,
      className: "min-w-[130px]",
      cell: (b) => (
        <div className="whitespace-nowrap tabular-nums text-right">
          <div className="text-sm font-medium">
            {dayFmt.format(new Date(b.created_at))}
          </div>
          <div className="text-xs text-muted-foreground">
            {timeFmt.format(new Date(b.created_at))}
          </div>
        </div>
      ),
    },
  ];

  // Event facets options with ticket & order counts
  const eventFacetOptions = React.useMemo(() => {
    return eventsList.map((e) => {
      const bks = bookings.filter((b) => b.event?.id === e.id);
      return {
        value: String(e.id),
        label: e.name,
        count: bks.length,
      };
    });
  }, [eventsList, bookings]);

  // Modern filter bar matching EventsManagementPage
  const toolbar = (
    <AdminFilterBar
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: "Search bookings, buyer or Parchi ID",
      }}
      facets={[
        {
          id: "event",
          label: "Event",
          single: true,
          selected: eventFilter === "all" ? [] : [eventFilter],
          onChange: (values) => setEventFilter(values[0] ?? "all"),
          options: eventFacetOptions,
        },
        {
          id: "channel",
          label: "Channel",
          single: true,
          selected: channelFilter === "all" ? [] : [channelFilter],
          onChange: (values) => setChannelFilter(values[0] ?? "all"),
          options: [
            {
              value: "parchi",
              label: "Parchi Students",
              count: stats.parchiTotal,
            },
            {
              value: "inside",
              label: "Inside Direct",
              count: stats.total - stats.parchiTotal,
            },
          ],
        },
        {
          id: "status",
          label: "Status",
          single: true,
          selected: statusFilter === "all" ? [] : [statusFilter],
          onChange: (values) => setStatusFilter(values[0] ?? "all"),
          options: [
            { value: "paid", label: "Paid", count: stats.paid },
            {
              value: "awaiting_payment",
              label: "Awaiting",
              count: stats.awaiting,
            },
            { value: "failed", label: "Failed", count: stats.failed },
            { value: "refunded", label: "Refunded" },
            { value: "expired", label: "Expired" },
          ],
        },
      ]}
      dateRange={{
        from: dateRange.from,
        to: dateRange.to,
        onChange: setDateRange,
      }}
      onClearAll={hasFilters ? clearFilters : undefined}
      trailing={
        <SegmentedControl
          label="View"
          value={viewMode}
          onValueChange={setViewMode}
          options={[
            { value: "table", label: "All Bookings", icon: List },
            { value: "breakdown", label: "Event Breakdown", icon: BarChart3 },
          ]}
        />
      }
    />
  );

  return (
    <AdminPageShell
      eyebrow="Events & ticketing"
      title="Bookings"
      description={
        selectedEventName
          ? `Filtered to ${selectedEventName} · ${stats.total} bookings, ${stats.paid} paid.`
          : `${stats.total} total bookings across all events.`
      }
      live="live"
      actions={
        <>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredBookings.length === 0}
          >
            <Download />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchData()}
            loading={isLoading}
          >
            <RefreshCw />
            Refresh
          </Button>
        </>
      }
      metrics={[
        {
          label: "Paid Revenue",
          value: `PKR ${stats.revenue.toLocaleString()}`,
          caption: `Excludes ${stats.awaiting} awaiting`,
        },
        {
          label: "Tickets Sold",
          value: stats.paidTickets,
          caption: `From ${stats.paid} paid orders`,
        },
        {
          label: "Parchi Students",
          value: stats.parchiTickets,
          emphasis: stats.parchiPaidCount > 0,
          caption: `${stats.parchiPaidCount} orders · PKR ${stats.parchiRevenue.toLocaleString()}`,
        },
        {
          label: "Awaiting Payment",
          value: stats.awaiting,
          emphasis: stats.awaiting > 0,
          caption: stats.awaiting > 0 ? "Pending checkout holds" : "All cleared",
        },
      ]}
    >
      {viewMode === "table" ? (
        <AdminDataTable
          label="Bookings"
          rows={paginatedBookings}
          columns={columns}
          getRowId={(b) => String(b.id)}
          state={isLoading ? "loading" : "ready"}
          toolbar={toolbar}
          sort={sort}
          onSortChange={setSort}
          scrollable={true}
          onRowOpen={(b) => setSelectedBooking(b)}
          rowActions={(b) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedBooking(b)}
              className="gap-1.5 h-8 px-2.5 text-xs"
            >
              <Eye className="size-3.5" />
              View
            </Button>
          )}
          empty={{
            icon: Ticket,
            title: "No bookings recorded yet",
            description: "Event ticket sales and bookings will appear here.",
          }}
          filteredEmpty={{
            title: "No bookings match these filters",
            description: "Try clearing some filters or searching for another term.",
            onClear: clearFilters,
          }}
        />
      ) : (
        /* Event Breakdown Matrix View */
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-1">
            {toolbar}
          </div>

          <Card className="border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 text-xs">
                    <TableHead className="font-semibold">Event Name</TableHead>
                    <TableHead className="font-semibold text-center">
                      Total Orders
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      Paid Orders
                    </TableHead>
                    <TableHead className="font-semibold text-center text-primary">
                      Tickets Sold
                    </TableHead>
                    <TableHead className="font-semibold">Paid Revenue</TableHead>
                    <TableHead className="font-semibold text-center">
                      Parchi Tickets
                    </TableHead>
                    <TableHead className="font-semibold">
                      Parchi Revenue
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-12 text-muted-foreground text-sm"
                      >
                        No event sales data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eventBreakdown.map((ev) => {
                      const isSelected = String(ev.id) === eventFilter;
                      return (
                        <TableRow
                          key={ev.id}
                          className={`text-sm transition-colors ${
                            isSelected
                              ? "bg-primary/10 hover:bg-primary/15"
                              : "hover:bg-muted/20"
                          }`}
                        >
                          <TableCell className="font-medium max-w-[260px] truncate">
                            {ev.name}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {ev.totalBookings}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {ev.paidBookings}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-primary">
                            {ev.paidTickets}
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                            PKR {ev.paidRevenue.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            {ev.parchiPaidTickets > 0 ? (
                              <Badge className="bg-[#0069DB]/15 text-[#0069DB] border-[#0069DB]/30 font-mono">
                                {ev.parchiPaidTickets} tix
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ev.parchiPaidRevenue > 0 ? (
                              <span className="text-xs font-semibold text-[#0069DB]">
                                PKR {ev.parchiPaidRevenue.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                PKR 0
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={isSelected ? "secondary" : "outline"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEventFilter(isSelected ? "all" : String(ev.id));
                                setViewMode("table");
                              }}
                            >
                              {isSelected ? "Clear Filter" : "Filter Bookings"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* Booking Detail Modal */}
      <Dialog
        open={!!selectedBooking}
        onOpenChange={() => setSelectedBooking(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Booking Details
            </DialogTitle>
            <DialogDescription className="font-mono">
              {selectedBooking?.booking_reference || `#${selectedBooking?.id}`}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-5">
              {/* Parchi Student Banner */}
              {selectedBooking.is_parchi && (
                <div className="p-3.5 rounded-xl border border-[#0069DB]/30 bg-[#0069DB]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#0069DB] text-white">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0069DB] dark:text-blue-300">
                        Parchi Student Booking
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Student ID:{" "}
                        <span className="font-mono font-bold text-foreground">
                          {selectedBooking.parchi_id || "Verified"}
                        </span>
                        {selectedBooking.parchi_status && (
                          <span className="ml-2 capitalize">
                            ({selectedBooking.parchi_status})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {Number(selectedBooking.discount_amount) > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Student Discount
                      </div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        -PKR {Number(selectedBooking.discount_amount).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status and Amount Row */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">
                      Payment Status
                    </div>
                    <StatusBadge
                      status={
                        selectedBooking.payment_status ||
                        selectedBooking.status ||
                        "unknown"
                      }
                    />
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">
                      Total Paid Amount
                    </div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      PKR {Number(selectedBooking.total_amount).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Event Info */}
              {selectedBooking.event && (
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Event
                    </div>
                    <div className="font-bold text-base">
                      {selectedBooking.event.name}
                    </div>
                    {selectedBooking.event.location_name && (
                      <div className="text-xs text-muted-foreground">
                        📍 {selectedBooking.event.location_name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Customer Info */}
              <Card className="bg-muted/20 border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Customer Details
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Name
                      </span>
                      <span className="font-medium">
                        {selectedBooking.customer_name ||
                          selectedBooking.user?.full_name ||
                          "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Email
                      </span>
                      <span className="font-medium">
                        {selectedBooking.customer_email || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Phone
                      </span>
                      <span className="font-medium">
                        {selectedBooking.customer_phone ||
                          selectedBooking.user?.phone ||
                          "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        CNIC (Last 4)
                      </span>
                      <span className="font-mono font-medium">
                        {selectedBooking.cnic_last4 || "-"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tickets Purchased */}
              <Card className="bg-muted/20 border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tickets Purchased ({selectedBooking.total_tickets})
                  </div>
                  <div className="space-y-2">
                    {selectedBooking.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0"
                      >
                        <div className="font-medium">
                          {item.quantity}x {item.ticket_type_name}
                        </div>
                        <div className="font-mono text-muted-foreground">
                          PKR {Number(item.price_per_ticket).toLocaleString()} each
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Guest Passes & Check-ins */}
              {selectedBooking.guests && selectedBooking.guests.length > 0 && (
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Attendee Digital Passes ({selectedBooking.guests.length})
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedBooking.guests.map((guest, idx) => (
                        <div
                          key={guest.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 text-xs"
                        >
                          <div>
                            <span className="font-medium block">
                              {guest.name || `Guest ${idx + 1}`}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              Pass code: {guest.code}
                            </span>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={
                                guest.checked_in_at ? "default" : "outline"
                              }
                              className="text-[10px]"
                            >
                              {guest.checked_in_at
                                ? "Checked In"
                                : "Not Checked In"}
                            </Badge>
                            {guest.gate_label && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {guest.gate_label}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Super Admin Mark Paid */}
              {userRole === "super_admin" &&
                selectedBooking.payment_status !== "paid" && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={() => handleMarkAsPaid(selectedBooking.id)}
                      disabled={isMarkingPaid}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {isMarkingPaid ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Mark Booking as Paid
                    </Button>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
