"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { QRCodeCanvas } from "qrcode.react";
import { downloadTicketsPdf } from "@/lib/ticketing/download-ticket-pdf";
import type { PublicPass } from "@/types/ticketing.types";
import {
  Search,
  Download,
  Ticket,
  Calendar,
  MapPin,
  RefreshCw,
  Eye,
  Layers,
  DollarSign,
  Building,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  PackageCheck,
  Boxes,
  Upload,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { TicketPdfUploadDialog } from "@/components/ticketing/TicketPdfUploadDialog";
import { cn } from "@/lib/utils";

export interface TierStockItem {
  id: number;
  name: string;
  price: number;
  sold: number;
  available: number | null;
  capacity: number | null;
  hasPdfPool?: boolean;
}

export interface InventoryItem {
  id: number;
  ticketTypeId: number;
  ticketTypeName: string;
  price: number;
  externalTicketId: string | null;
  filename: string | null;
  isBought: boolean;
  bookingId: number | null;
  bookingReference: string | null;
  assignedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  isParchi: boolean;
  parchiId: string | null;
}

export interface AttendeeTicketItem {
  id: number;
  code: string;
  status: string;
  guestName: string;
  buyerName: string;
  guestCnic: string | null;
  guestCnicFormatted: string | null;
  ticketType: string;
  price: number;
  assignedDeviceIndex: number | null;
  checkedInAt: string | null;
  issuedAt: string | null;
  bookingId?: number;
  bookingCode?: string | null;
  quantityIndex?: number;
  buyerEmail: string | null;
  buyerPhone: string | null;
  isParchi?: boolean;
  parchiId?: string | null;
}

export interface UnifiedStockRow {
  id: string;
  invId?: number | null;
  originalFilename?: string | null;
  ticketCode: string;
  tierName: string;
  price: number;
  isBought: boolean;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingReference: string | null;
  isParchi: boolean;
  parchiId: string | null;
  status: string;
  checkedInAt: string | null;
  issuedAt: string | null;
  cnic: string | null;
  attendeeRef: AttendeeTicketItem | null;
}

interface EventMetadata {
  id: number;
  name: string;
  slug?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string | null;
  address?: string | null;
  organizer_name?: string | null;
}

interface EventPassesManagementViewProps {
  eventId: number;
  initialEventName?: string;
}

export function EventPassesManagementView({
  eventId,
  initialEventName,
}: EventPassesManagementViewProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [attendees, setAttendees] = useState<AttendeeTicketItem[]>([]);
  const [tierStock, setTierStock] = useState<TierStockItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [eventDetails, setEventDetails] = useState<EventMetadata | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bought" | "available">("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [parchiFilter, setParchiFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Quick Action States
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedTicketForPreview, setSelectedTicketForPreview] =
    useState<AttendeeTicketItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<Record<string, boolean>>({});
  const [uploadTier, setUploadTier] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1500);
  };

  const fetchAttendees = useCallback(
    async (silent = false) => {
      if (!eventId) return;
      if (!silent) setRefreshing(true);
      try {
        const res = await fetch(`/api/organizer/attendees?eventId=${eventId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok) {
          setAttendees(data.attendees || []);
          setTierStock(Array.isArray(data.ticketTypes) ? data.ticketTypes : []);
          setInventoryItems(
            Array.isArray(data.inventoryItems) ? data.inventoryItems : [],
          );
          if (data.event) {
            setEventDetails(data.event);
          }
        } else if (!silent) {
          toast({
            title: "Error fetching tickets",
            description: data.error || "Could not load sold tickets",
            variant: "destructive",
          });
        }
      } catch {
        if (!silent) {
          toast({
            title: "Network error",
            description: "Failed to connect to server",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, toast],
  );

  useEffect(() => {
    void fetchAttendees();
  }, [fetchAttendees]);

  // Live Auto-Refresh (Silent every 10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      void fetchAttendees(true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, fetchAttendees]);

  // Unique ticket tiers
  const tiers = useMemo(() => {
    if (tierStock.length > 0) return tierStock.map((t) => t.name);
    return Array.from(
      new Set(attendees.map((a) => a.ticketType).filter(Boolean)),
    );
  }, [attendees, tierStock]);

  const stockTotals = useMemo(() => {
    const sold = tierStock.reduce((sum, t) => sum + (t.sold || 0), 0);
    const available = tierStock.reduce(
      (sum, t) => sum + (t.available != null ? t.available : 0),
      0,
    );
    const capacity = tierStock.reduce((sum, t) => {
      if (t.capacity != null) return sum + t.capacity;
      if (t.available != null) return sum + t.sold + t.available;
      return sum + t.sold;
    }, 0);
    return { sold, available, capacity };
  }, [tierStock]);

  // Unified stock list (merging inventoryItems or synthesizing from attendees + available tiers)
  const unifiedStockList = useMemo<UnifiedStockRow[]>(() => {
    if (inventoryItems.length > 0) {
      return inventoryItems.map((inv) => {
        // Link with attendee pass if exists
        const matchedAttendee = attendees.find(
          (a) =>
            (inv.bookingId && a.bookingId === inv.bookingId) ||
            (inv.externalTicketId && a.code === inv.externalTicketId),
        );

        return {
          id: `inv-${inv.id}`,
          invId: inv.id,
          originalFilename: inv.filename,
          ticketCode: inv.externalTicketId || matchedAttendee?.code || `Slot #${inv.id}`,
          tierName: inv.ticketTypeName,
          price: inv.price,
          isBought: inv.isBought,
          customerName:
            inv.customerName ||
            matchedAttendee?.guestName ||
            matchedAttendee?.buyerName ||
            null,
          customerEmail: inv.customerEmail || matchedAttendee?.buyerEmail || null,
          customerPhone: inv.customerPhone || matchedAttendee?.buyerPhone || null,
          bookingReference:
            inv.bookingReference || matchedAttendee?.bookingCode || null,
          isParchi: Boolean(inv.isParchi || matchedAttendee?.isParchi),
          parchiId: inv.parchiId || matchedAttendee?.parchiId || null,
          status:
            matchedAttendee?.status || (inv.isBought ? "issued" : "in_stock"),
          checkedInAt: matchedAttendee?.checkedInAt || null,
          issuedAt: inv.assignedAt || matchedAttendee?.issuedAt || null,
          cnic:
            matchedAttendee?.guestCnicFormatted ||
            matchedAttendee?.guestCnic ||
            null,
          attendeeRef: matchedAttendee || null,
        };
      });
    }

    // Fallback: If no PDF inventory rows, display all sold attendees + unsold tier slots
    const rows: UnifiedStockRow[] = attendees.map((a) => ({
      id: `att-${a.id}`,
      originalFilename: null,
      ticketCode: a.code,
      tierName: a.ticketType,
      price: a.price,
      isBought: true,
      customerName: a.guestName || a.buyerName || null,
      customerEmail: a.buyerEmail || null,
      customerPhone: a.buyerPhone || null,
      bookingReference:
        a.bookingCode || (a.bookingId ? String(a.bookingId) : null),
      isParchi: Boolean(a.isParchi),
      parchiId: a.parchiId || null,
      status: a.status,
      checkedInAt: a.checkedInAt || null,
      issuedAt: a.issuedAt || null,
      cnic: a.guestCnicFormatted || a.guestCnic || null,
      attendeeRef: a,
    }));

    // Add remaining available tier placeholder slots
    tierStock.forEach((tier) => {
      const avail = tier.available ?? 0;
      for (let i = 0; i < avail; i++) {
        rows.push({
          id: `avail-${tier.id}-${i}`,
          ticketCode: `AVAILABLE-${tier.name.replace(/\s+/g, "-").toUpperCase()}-${i + 1}`,
          tierName: tier.name,
          price: tier.price,
          isBought: false,
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          bookingReference: null,
          isParchi: false,
          parchiId: null,
          status: "in_stock",
          checkedInAt: null,
          issuedAt: null,
          cnic: null,
          attendeeRef: null,
        });
      }
    });

    return rows;
  }, [inventoryItems, attendees, tierStock]);

  // Filtered Stock Rows
  const filteredStock = useMemo(() => {
    return unifiedStockList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.customerName?.toLowerCase().includes(q) ||
        item.customerEmail?.toLowerCase().includes(q) ||
        item.customerPhone?.toLowerCase().includes(q) ||
        item.ticketCode?.toLowerCase().includes(q) ||
        item.bookingReference?.toLowerCase().includes(q) ||
        item.tierName?.toLowerCase().includes(q) ||
        item.parchiId?.toLowerCase().includes(q) ||
        item.originalFilename?.toLowerCase().includes(q);

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "bought" && item.isBought) ||
        (activeTab === "available" && !item.isBought);

      const matchesTier =
        tierFilter === "all" || item.tierName === tierFilter;

      const matchesParchi =
        parchiFilter === "all" ||
        (parchiFilter === "parchi" && item.isParchi) ||
        (parchiFilter === "standard" && item.isBought && !item.isParchi);

      return matchesSearch && matchesTab && matchesTier && matchesParchi;
    });
  }, [unifiedStockList, searchQuery, activeTab, tierFilter, parchiFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, tierFilter, parchiFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredStock.length / pageSize));
  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStock.slice(start, start + pageSize);
  }, [filteredStock, currentPage, pageSize]);

  // Stats summary
  const totalRevenue = useMemo(() => {
    return attendees.reduce((sum, a) => sum + (a.price || 0), 0);
  }, [attendees]);

  const parchiCount = useMemo(() => {
    return unifiedStockList.filter((i) => i.isBought && i.isParchi).length;
  }, [unifiedStockList]);

  const totalBoughtCount = useMemo(() => {
    return unifiedStockList.filter((i) => i.isBought).length;
  }, [unifiedStockList]);

  const totalAvailableCount = useMemo(() => {
    return unifiedStockList.filter((i) => !i.isBought).length;
  }, [unifiedStockList]);

  // PDF Download Handler
  const handleDownloadPdf = async (ticket: AttendeeTicketItem) => {
    try {
      setIsDownloadingPdf((prev) => ({ ...prev, [ticket.code]: true }));
      const eventName =
        eventDetails?.name || initialEventName || "Event Manifest";
      const toPass = (item: AttendeeTicketItem): PublicPass => ({
        id: item.id,
        booking_id: item.bookingId ?? 0,
        code: item.code,
        status: item.status as PublicPass["status"],
        quantity_index: item.quantityIndex ?? 0,
        issued_at: item.issuedAt ?? "",
        ticket_type_id: 0,
        guest_name: item.guestName || item.buyerName,
        cnic_last4: item.guestCnic?.replace(/\D/g, "").slice(-4) || null,
        ticket_type_name: item.ticketType,
        gate_label:
          item.assignedDeviceIndex !== null
            ? `Lane ${item.assignedDeviceIndex + 1}`
            : null,
      });
      const orderPasses = attendees
        .filter(
          (a) =>
            ticket.bookingId !== undefined && a.bookingId === ticket.bookingId,
        )
        .sort((a, b) => (a.quantityIndex ?? 0) - (b.quantityIndex ?? 0))
        .map(toPass);

      await downloadTicketsPdf({
        event: {
          name: eventName,
          startTime: eventDetails?.start_time ?? null,
          endTime: eventDetails?.end_time ?? null,
          venueName: eventDetails?.location_name ?? null,
          address: eventDetails?.address ?? null,
          organizer: eventDetails?.organizer_name ?? null,
          bookingReference: ticket.bookingCode ?? null,
        },
        passes: [toPass(ticket)],
        orderPasses: orderPasses.length ? orderPasses : [toPass(ticket)],
        filename: `pass-${eventName.replace(/[^a-zA-Z0-9]/g, "-")}-${
          ticket.code
        }.pdf`,
      });

      toast({
        title: "Ticket Downloaded",
        description: `Downloaded PDF pass for ${
          ticket.guestName || ticket.code
        }`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Download Failed",
        description: "Could not generate ticket PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf((prev) => ({ ...prev, [ticket.code]: false }));
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredStock.length === 0) {
      toast({
        title: "No Data",
        description: "No stock or attendees matching current filters to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Ticket Code / Slot",
      "Original File",
      "Tier",
      "Price (PKR)",
      "Stock Status",
      "Buyer Name",
      "Buyer Email",
      "Buyer Phone",
      "Parchi Student User",
      "Parchi ID",
      "Booking Reference",
      "Check-in Status",
      "Issued At",
    ];

    const rows = filteredStock.map((a) => [
      `"${a.ticketCode}"`,
      `"${a.originalFilename || ""}"`,
      `"${a.tierName}"`,
      a.price || 0,
      `"${a.isBought ? "Bought / Sold" : "Available in Stock"}"`,
      `"${(a.customerName || "").replace(/"/g, '""')}"`,
      `"${(a.customerEmail || "").replace(/"/g, '""')}"`,
      `"${(a.customerPhone || "").replace(/"/g, '""')}"`,
      `"${a.isParchi ? "YES (Parchi Student)" : "NO"}"`,
      `"${a.parchiId || ""}"`,
      `"${a.bookingReference || ""}"`,
      `"${a.status}"`,
      `"${a.issuedAt ? format(new Date(a.issuedAt), "yyyy-MM-dd HH:mm:ss") : ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeName = (
      eventDetails?.name ||
      initialEventName ||
      "stock_manifest"
    ).replace(/[^a-zA-Z0-9]/g, "_");
    link.setAttribute(
      "download",
      `${safeName}_stock_manifest_${format(new Date(), "yyyyMMdd_HHmm")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Completed",
      description: `Exported ${filteredStock.length} stock & attendee records to CSV.`,
    });
  };

  const displayName =
    eventDetails?.name || initialEventName || `Event #${eventId}`;

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1.5">
            <Link
              href="/dashboard"
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href="/dashboard/events"
              className="hover:text-foreground transition-colors"
            >
              My Events
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-md">
              {displayName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {displayName}
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold px-2.5 py-0.5 rounded-full"
            >
              <Ticket className="h-3 w-3 mr-1" />
              Stock Inventory &amp; Buyer Details
            </Badge>
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

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground mt-2">
            {eventDetails?.start_time && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                {format(
                  new Date(eventDetails.start_time),
                  "MMMM d, yyyy 'at' h:mm a",
                )}
              </span>
            )}
            {eventDetails?.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                {eventDetails.location_name}
              </span>
            )}
            {eventDetails?.organizer_name && (
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                {eventDetails.organizer_name}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
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
            onClick={() => void fetchAttendees()}
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
            disabled={filteredStock.length === 0}
            className="text-xs h-9 font-medium"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Export CSV ({filteredStock.length})
          </Button>
        </div>
      </div>

      {/* Interactive KPI Overview Cards with Click-to-Filter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {/* Total Stock Allocation */}
        <div
          onClick={() => {
            setActiveTab("all");
            setParchiFilter("all");
          }}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            activeTab === "all" && parchiFilter === "all"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border/70 bg-card hover:border-primary/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Stock
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {stockTotals.capacity || unifiedStockList.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {totalBoughtCount} sold · {totalAvailableCount} in stock
            </p>
          </div>
        </div>

        {/* Bought / Sold Units */}
        <div
          onClick={() => {
            setActiveTab("bought");
            setParchiFilter("all");
          }}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            activeTab === "bought" && parchiFilter === "all"
              ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
              : "border-border/70 bg-card hover:border-emerald-500/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sold Units
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {totalBoughtCount}
            </p>
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">
              {stockTotals.capacity
                ? `${Math.round((totalBoughtCount / stockTotals.capacity) * 100)}% of pool sold`
                : "Active sold tickets"}
            </p>
          </div>
        </div>

        {/* Available in Stock */}
        <div
          onClick={() => {
            setActiveTab("available");
            setParchiFilter("all");
          }}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            activeTab === "available"
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
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-sky-600 dark:text-sky-400">
              {totalAvailableCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ready for customers
            </p>
          </div>
        </div>

        {/* Parchi Student Buyers */}
        <div
          onClick={() => {
            setParchiFilter((curr) => (curr === "parchi" ? "all" : "parchi"));
          }}
          className={cn(
            "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer shadow-xs",
            parchiFilter === "parchi"
              ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20"
              : "border-border/70 bg-card hover:border-purple-500/40 hover:shadow-sm",
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Parchi
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400">
              {parchiCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified Parchi student app
            </p>
          </div>
        </div>

        {/* Gross Revenue */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Gross Volume
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              PKR {totalRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {totalBoughtCount > 0
                ? `Avg PKR ${Math.round(totalRevenue / totalBoughtCount).toLocaleString()} / pass`
                : "Total sales volume"}
            </p>
          </div>
        </div>
      </div>

      {/* Stock Health & Inventory by Tier Cards */}
      {tierStock.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Stock Health &amp; Inventory by Tier ({tierStock.length})
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                {stockTotals.sold} bought · {stockTotals.available} available ·{" "}
                {stockTotals.capacity} total
              </span>
              {tierFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTierFilter("all")}
                  className="text-xs h-7 text-primary hover:text-primary/80"
                >
                  Clear tier filter
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {tierStock.map((tier) => {
              const capacity =
                tier.capacity ??
                (tier.available != null ? tier.sold + tier.available : null);
              const pctSold = capacity
                ? Math.min(100, Math.round((tier.sold / capacity) * 100))
                : 0;
              const isSelected = tierFilter === tier.name;

              return (
                <div
                  key={tier.id}
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
                        <p className="font-bold text-sm text-foreground truncate">
                          {tier.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PKR {tier.price.toLocaleString()}
                          {tier.hasPdfPool && " · PDF pool"}
                        </p>
                      </div>
                      <Badge
                        variant={pctSold >= 100 ? "destructive" : "outline"}
                        className="text-xs font-semibold shrink-0"
                      >
                        {pctSold}% Sold
                      </Badge>
                    </div>

                    <div className="mt-3.5 flex items-baseline justify-between text-xs">
                      <span className="font-bold text-foreground">
                        {tier.sold}{" "}
                        <span className="font-normal text-muted-foreground">
                          / {capacity ?? "—"} bought
                        </span>
                      </span>
                      <span className="text-emerald-600 font-semibold">
                        {tier.available ?? 0} available
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pctSold >= 100
                            ? "bg-rose-500"
                            : pctSold >= 50
                            ? "bg-primary"
                            : "bg-emerald-500",
                        )}
                        style={{ width: `${pctSold}%` }}
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
                          curr === tier.name ? "all" : tier.name,
                        )
                      }
                      className="text-xs h-8 flex-1"
                    >
                      {isSelected ? "Filtering" : "Filter table"}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setUploadTier({ id: tier.id, name: tier.name })
                      }
                      className="text-xs h-8 gap-1.5"
                      title={`Upload PDFs directly to ${tier.name}`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload PDFs
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Stock & Buyer Manifest Table Card */}
      <Card className="border border-border/70 shadow-xs">
        <div className="border-b border-border/50 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>Stock &amp; Buyer Manifest</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {filteredStock.length} of {unifiedStockList.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Real-time stock status, buyer emails, tiers, and Parchi student verification details.
              </CardDescription>
            </div>

            {/* Quick Status Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-3 bg-muted/60 h-8">
                <TabsTrigger value="all" className="text-xs">
                  All ({unifiedStockList.length})
                </TabsTrigger>
                <TabsTrigger
                  value="bought"
                  className="text-xs text-emerald-600 dark:text-emerald-400"
                >
                  Bought ({totalBoughtCount})
                </TabsTrigger>
                <TabsTrigger
                  value="available"
                  className="text-xs text-sky-600 dark:text-sky-400"
                >
                  Available ({totalAvailableCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-border/40">
            {/* Search */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search buyer name, email, phone, ticket ID, booking ref…"
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
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-9 w-full sm:w-48 text-xs font-medium bg-background">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers ({tiers.length})</SelectItem>
                {tiers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Parchi Filter */}
            <Select value={parchiFilter} onValueChange={setParchiFilter}>
              <SelectTrigger className="h-9 w-full sm:w-48 text-xs font-medium bg-background">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels &amp; Users</SelectItem>
                <SelectItem value="parchi">
                  Parchi Student Only ({parchiCount})
                </SelectItem>
                <SelectItem value="standard">Standard Web Orders</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear All Filters */}
            {(searchQuery || activeTab !== "all" || tierFilter !== "all" || parchiFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                  setTierFilter("all");
                  setParchiFilter("all");
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
        </div>

        {/* Manifest Table */}
        <CardContent className="p-0 sm:p-5 sm:pt-0">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground font-medium">
                Loading stock inventory and buyer records…
              </p>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold">No stock records found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  No records match your active search or filters. Try adjusting your search term or clearing active filters.
                </p>
              </div>
              {(searchQuery || activeTab !== "all" || tierFilter !== "all" || parchiFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("all");
                    setTierFilter("all");
                    setParchiFilter("all");
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
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border/40">
                    <tr>
                      <th className="py-3 px-4">Stock Status &amp; Code</th>
                      <th className="py-3 px-4">Tier &amp; Price</th>
                      <th className="py-3 px-4">Buyer / Customer Info</th>
                      <th className="py-3 px-4">Email &amp; Phone</th>
                      <th className="py-3 px-4">Parchi User Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {paginatedStock.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(
                          "hover:bg-muted/30 transition-colors",
                          !item.isBought && "bg-muted/5 opacity-80",
                        )}
                      >
                        {/* Stock Status & Code */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {item.isBought ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold gap-1">
                                <PackageCheck className="h-3 w-3" />
                                Bought / Sold
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 text-[11px] font-medium gap-1"
                              >
                                <Boxes className="h-3 w-3" />
                                In Stock (Available)
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-muted rounded border border-border/50">
                              {item.ticketCode}
                            </span>
                            <button
                              onClick={() =>
                                copyToClipboard(item.ticketCode, `code-${item.id}`)
                              }
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                              title="Copy Ticket Code"
                            >
                              {copiedKey === `code-${item.id}` ? (
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            {item.bookingReference && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                · Ref: {item.bookingReference}
                              </span>
                            )}
                          </div>
                          {item.originalFilename && (
                            <p
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px] mt-0.5"
                              title={item.originalFilename}
                            >
                              {item.originalFilename}
                            </p>
                          )}
                        </td>

                        {/* Tier & Price */}
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className="font-medium text-xs bg-primary/10 text-primary border-primary/20"
                          >
                            {item.tierName}
                          </Badge>
                          <div className="text-xs font-semibold text-foreground mt-1">
                            PKR {item.price.toLocaleString()}
                          </div>
                        </td>

                        {/* Buyer Info */}
                        <td className="py-3 px-4">
                          {item.isBought ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[170px]">
                                  {item.customerName || "Purchased Customer"}
                                </span>
                              </div>
                              {item.cnic && (
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  CNIC: {item.cnic}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 italic">
                              Unallocated (Available)
                            </span>
                          )}
                        </td>

                        {/* Email & Phone */}
                        <td className="py-3 px-4">
                          {item.isBought ? (
                            <div className="space-y-1">
                              {item.customerEmail ? (
                                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate max-w-[180px]">
                                    {item.customerEmail}
                                  </span>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        item.customerEmail!,
                                        `mail-${item.id}`,
                                      )
                                    }
                                    className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                    title="Copy Email"
                                  >
                                    {copiedKey === `mail-${item.id}` ? (
                                      <Check className="h-2.5 w-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              {item.customerPhone && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                                  <Phone className="h-2.5 w-2.5 shrink-0" />
                                  <span>{item.customerPhone}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Parchi Status */}
                        <td className="py-3 px-4">
                          {item.isBought ? (
                            item.isParchi ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 text-[10px] font-semibold gap-1 shadow-2xs">
                                  <GraduationCap className="h-3 w-3" />
                                  Parchi Student
                                </Badge>
                                {item.parchiId && (
                                  <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                                    ID: {item.parchiId}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground font-normal border-border/60"
                              >
                                Standard Order
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {item.isBought && item.attendeeRef ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (item.attendeeRef)
                                    setSelectedTicketForPreview(item.attendeeRef);
                                }}
                                className="h-8 px-2 text-xs"
                                title="View QR Pass"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                QR Pass
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (item.attendeeRef)
                                    handleDownloadPdf(item.attendeeRef);
                                }}
                                disabled={isDownloadingPdf[item.attendeeRef.code]}
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                title="Download PDF Pass"
                              >
                                <Download
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    isDownloadingPdf[item.attendeeRef.code] &&
                                      "animate-bounce",
                                  )}
                                />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 font-mono">
                              Ready for Sale
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-border/40 mt-3">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(
                      (currentPage - 1) * pageSize + 1,
                      filteredStock.length,
                    )}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(currentPage * pageSize, filteredStock.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {filteredStock.length}
                  </span>{" "}
                  records
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

      {/* QR Code & Digital Pass Preview Modal */}
      <Dialog
        open={!!selectedTicketForPreview}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketForPreview(null);
        }}
      >
        <DialogContent className="max-w-md bg-card border-border/80 shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Digital Entry Pass
            </DialogTitle>
            <DialogDescription>
              {displayName} &bull; Security Verification QR
            </DialogDescription>
          </DialogHeader>

          {selectedTicketForPreview && (
            <div className="space-y-5 pt-2">
              {/* QR Canvas */}
              <div className="p-6 bg-white rounded-2xl flex flex-col items-center justify-center border shadow-inner">
                <QRCodeCanvas
                  value={selectedTicketForPreview.code}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
                <div className="flex items-center gap-1.5 mt-3">
                  <p className="font-mono text-xs font-bold text-black tracking-widest">
                    {selectedTicketForPreview.code}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        selectedTicketForPreview.code,
                        "preview-qr-code",
                      )
                    }
                    className="p-1 text-black/60 hover:text-black rounded"
                    title="Copy Code"
                  >
                    {copiedKey === "preview-qr-code" ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Pass Metadata */}
              <div className="space-y-2 bg-muted/40 p-4 rounded-xl text-xs border border-border/40">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attendee / Buyer:</span>
                  <span className="font-semibold text-foreground">
                    {selectedTicketForPreview.guestName}
                  </span>
                </div>
                {selectedTicketForPreview.buyerEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium text-foreground">
                      {selectedTicketForPreview.buyerEmail}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket Tier:</span>
                  <span className="font-semibold text-primary">
                    {selectedTicketForPreview.ticketType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parchi Student:</span>
                  <span className="font-semibold">
                    {selectedTicketForPreview.isParchi ? (
                      <span className="text-purple-600 font-bold">
                        Yes (Parchi Verified)
                      </span>
                    ) : (
                      "No (Standard)"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      selectedTicketForPreview.status === "checked_in"
                        ? "text-emerald-600"
                        : "text-amber-600",
                    )}
                  >
                    {selectedTicketForPreview.status === "checked_in"
                      ? "Checked In"
                      : "Pending Entry"}
                  </span>
                </div>
              </div>

              {/* Action */}
              <div className="flex gap-2">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 font-semibold"
                  onClick={() => {
                    handleDownloadPdf(selectedTicketForPreview);
                  }}
                  disabled={isDownloadingPdf[selectedTicketForPreview.code]}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF Pass
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Upload Dialog */}
      {uploadTier && (
        <TicketPdfUploadDialog
          open={!!uploadTier}
          onOpenChange={(open) => {
            if (!open) setUploadTier(null);
          }}
          ticketTypeId={uploadTier.id}
          ticketTypeName={uploadTier.name}
          uploadUrl={`/api/organizer/events/${eventId}/ticket-pdf-inventory/upload`}
          onSuccess={() => {
            void fetchAttendees(true);
          }}
        />
      )}
    </div>
  );
}
