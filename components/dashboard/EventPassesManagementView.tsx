"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  RefreshCw,
  Eye,
  Layers,
  FileText,
  DollarSign,
  Building,
  Sparkles,
  ChevronRight,
  GraduationCap,
  PackageCheck,
  PackageX,
  Boxes,
  HelpCircle,
  Upload,
} from "lucide-react";
import { TicketPdfUploadDialog } from "@/components/ticketing/TicketPdfUploadDialog";

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
  const [attendees, setAttendees] = useState<AttendeeTicketItem[]>([]);
  const [tierStock, setTierStock] = useState<TierStockItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [eventDetails, setEventDetails] = useState<EventMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bought" | "available">("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [parchiFilter, setParchiFilter] = useState<string>("all");
  const [selectedTicketForPreview, setSelectedTicketForPreview] =
    useState<AttendeeTicketItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<
    Record<string, boolean>
  >({});
  const [uploadTier, setUploadTier] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/attendees?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok) {
        setAttendees(data.attendees || []);
        setTierStock(Array.isArray(data.ticketTypes) ? data.ticketTypes : []);
        setInventoryItems(Array.isArray(data.inventoryItems) ? data.inventoryItems : []);
        if (data.event) {
          setEventDetails(data.event);
        }
      } else {
        toast({
          title: "Error fetching tickets",
          description: data.error || "Could not load sold tickets",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Unique ticket tiers
  const tiers = useMemo(() => {
    if (tierStock.length > 0) return tierStock.map((t) => t.name);
    return Array.from(
      new Set(attendees.map((a) => a.ticketType).filter(Boolean))
    );
  }, [attendees, tierStock]);

  const stockTotals = useMemo(() => {
    const sold = tierStock.reduce((sum, t) => sum + (t.sold || 0), 0);
    const available = tierStock.reduce(
      (sum, t) => sum + (t.available != null ? t.available : 0),
      0
    );
    const capacity = tierStock.reduce((sum, t) => {
      if (t.capacity != null) return sum + t.capacity;
      if (t.available != null) return sum + t.sold + t.available;
      return sum + t.sold;
    }, 0);
    return { sold, available, capacity };
  }, [tierStock]);

  // Unified unified stock list (merging inventoryItems or synthesizing from attendees + available tiers)
  const unifiedStockList = useMemo<UnifiedStockRow[]>(() => {
    if (inventoryItems.length > 0) {
      return inventoryItems.map((inv) => {
        // Link with attendee pass if exists
        const matchedAttendee = attendees.find(
          (a) =>
            (inv.bookingId && a.bookingId === inv.bookingId) ||
            (inv.externalTicketId && a.code === inv.externalTicketId)
        );

        return {
          id: `inv-${inv.id}`,
          ticketCode: inv.externalTicketId || matchedAttendee?.code || `Slot #${inv.id}`,
          tierName: inv.ticketTypeName,
          price: inv.price,
          isBought: inv.isBought,
          customerName: inv.customerName || matchedAttendee?.guestName || matchedAttendee?.buyerName || null,
          customerEmail: inv.customerEmail || matchedAttendee?.buyerEmail || null,
          customerPhone: inv.customerPhone || matchedAttendee?.buyerPhone || null,
          bookingReference: inv.bookingReference || matchedAttendee?.bookingCode || null,
          isParchi: Boolean(inv.isParchi || matchedAttendee?.isParchi),
          parchiId: inv.parchiId || matchedAttendee?.parchiId || null,
          status: matchedAttendee?.status || (inv.isBought ? "issued" : "in_stock"),
          checkedInAt: matchedAttendee?.checkedInAt || null,
          issuedAt: inv.assignedAt || matchedAttendee?.issuedAt || null,
          cnic: matchedAttendee?.guestCnicFormatted || matchedAttendee?.guestCnic || null,
          attendeeRef: matchedAttendee || null,
        };
      });
    }

    // Fallback: If no PDF inventory rows, display all sold attendees + unsold tier slots
    const rows: UnifiedStockRow[] = attendees.map((a) => ({
      id: `att-${a.id}`,
      ticketCode: a.code,
      tierName: a.ticketType,
      price: a.price,
      isBought: true,
      customerName: a.guestName || a.buyerName || null,
      customerEmail: a.buyerEmail || null,
      customerPhone: a.buyerPhone || null,
      bookingReference: a.bookingCode || (a.bookingId ? String(a.bookingId) : null),
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
        item.parchiId?.toLowerCase().includes(q);

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

  // Stats summary
  const totalRevenue = useMemo(() => {
    return attendees.reduce((sum, a) => sum + (a.price || 0), 0);
  }, [attendees]);

  const totalCheckedIn = useMemo(() => {
    return attendees.filter((a) => a.status === "checked_in").length;
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
            ticket.bookingId !== undefined && a.bookingId === ticket.bookingId
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
    if (unifiedStockList.length === 0) {
      toast({
        title: "No Data",
        description: "No stock or attendees to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Ticket Code / Slot",
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
      "data:text/csv;charset=utf-8," +
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
      `${safeName}_stock_manifest_${format(new Date(), "yyyyMMdd_HHmm")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Completed",
      description: `Exported ${filteredStock.length} stock & attendee records.`,
    });
  };

  const displayName =
    eventDetails?.name || initialEventName || `Event #${eventId}`;

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link
              href="/dashboard"
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href="/dashboard/events"
              className="hover:text-foreground transition-colors"
            >
              My Events
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium truncate max-w-[220px] sm:max-w-md">
              {displayName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold px-2.5 py-0.5 rounded-full"
            >
              <Ticket className="h-3 w-3 mr-1" />
              Stock Inventory & Buyer Details
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted-foreground mt-2">
            {eventDetails?.start_time && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {format(
                  new Date(eventDetails.start_time),
                  "MMMM d, yyyy 'at' h:mm a"
                )}
              </span>
            )}
            {eventDetails?.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {eventDetails.location_name}
              </span>
            )}
            {eventDetails?.organizer_name && (
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-primary" />
                {eventDetails.organizer_name}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls (Gate Scanner Removed) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAttendees}
            disabled={loading}
            className="h-10 px-4 bg-background/60 hover:bg-background/90 border-border/70"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={unifiedStockList.length === 0}
            className="h-10 px-4 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all font-semibold"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV ({filteredStock.length})
          </Button>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Stock Available & Capacity */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Stock Allocation
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Boxes className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {stockTotals.capacity || unifiedStockList.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{totalBoughtCount} bought</span> &bull;{" "}
              <span className="text-emerald-600 font-semibold">{totalAvailableCount} available in stock</span>
            </p>
          </CardContent>
        </Card>

        {/* Bought / Sold Tickets */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bought / Sold Units
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {totalBoughtCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stockTotals.capacity
                ? `${Math.round((totalBoughtCount / stockTotals.capacity) * 100)}% of total inventory sold`
                : "Active purchased passes"}
            </p>
          </CardContent>
        </Card>

        {/* Parchi Student Users */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-background to-background border-purple-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Parchi Student Buyers
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              {parchiCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Verified Parchi student app orders
            </p>
          </CardContent>
        </Card>

        {/* Gross Revenue */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Sales Revenue
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
              PKR {totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalBoughtCount > 0
                ? `Avg PKR ${Math.round(totalRevenue / totalBoughtCount).toLocaleString()} / pass`
                : "Total sales volume"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Stock by Tier Breakdown Cards */}
      {tierStock.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Stock Health & Inventory by Tier
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              {stockTotals.sold} bought &bull; {stockTotals.available} available &bull;{" "}
              {stockTotals.capacity} total
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tierStock.map((tier) => {
              const capacity =
                tier.capacity ??
                (tier.available != null ? tier.sold + tier.available : null);
              const pctSold = capacity
                ? Math.min(100, Math.round((tier.sold / capacity) * 100))
                : 0;

              return (
                <Card
                  key={tier.id}
                  className="bg-card/70 backdrop-blur-sm border-border/60 hover:border-primary/40 transition-all shadow-sm"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {tier.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PKR {tier.price.toLocaleString()}
                          {tier.hasPdfPool && " • PDF pool"}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs font-semibold shrink-0 bg-primary/10 text-primary border-primary/20"
                      >
                        {pctSold}% Sold
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pctSold >= 90
                              ? "bg-emerald-500"
                              : pctSold >= 50
                              ? "bg-primary"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${pctSold}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {tier.sold} bought
                        </span>
                        <span className="text-emerald-600 font-medium">
                          {tier.available ?? 0} available
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setUploadTier({ id: tier.id, name: tier.name })
                      }
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload PDFs
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Stock & Buyer Manifest Table Card */}
      <Card className="overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
        {/* Header with Stock Status Tabs */}
        <div className="border-b border-border/40 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Stock & Buyer Intelligence Manifest
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time stock status, buyer emails, tiers, and Parchi student verification details
              </p>
            </div>

            {/* Quick Status Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-3 bg-muted/60">
                <TabsTrigger value="all" className="text-xs">
                  All Stock ({unifiedStockList.length})
                </TabsTrigger>
                <TabsTrigger value="bought" className="text-xs text-emerald-600 dark:text-emerald-400">
                  Bought ({totalBoughtCount})
                </TabsTrigger>
                <TabsTrigger value="available" className="text-xs text-blue-600 dark:text-blue-400">
                  Available ({totalAvailableCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by buyer name, email, phone, ticket ID, or Parchi ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-background/60 border-border/70 focus:border-primary/50 text-xs sm:text-sm"
              />
            </div>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-10 bg-background/60 border-border/70 text-xs sm:text-sm">
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
              <SelectTrigger className="h-10 bg-background/60 border-border/70 text-xs sm:text-sm">
                <SelectValue placeholder="All User Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels & Users</SelectItem>
                <SelectItem value="parchi">
                  Parchi Student Discounts Only ({parchiCount})
                </SelectItem>
                <SelectItem value="standard">
                  Standard Web / App Orders
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Manifest Table */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground font-medium">
                Loading stock inventory and buyer records...
              </p>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <Boxes className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  No Matching Stock Records Found
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Try adjusting your search query, or clear active tier and Parchi user filters.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                  setTierFilter("all");
                  setParchiFilter("all");
                }}
                className="mt-2 text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border/40">
                  <tr>
                    <th className="py-3.5 px-5">Stock Status & Code</th>
                    <th className="py-3.5 px-4">Tier & Price</th>
                    <th className="py-3.5 px-4">Buyer / Customer Info</th>
                    <th className="py-3.5 px-4">Email & Phone</th>
                    <th className="py-3.5 px-4">Parchi User Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredStock.map((item) => {
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 transition-colors group ${
                          !item.isBought ? "opacity-75 bg-muted/5" : ""
                        }`}
                      >
                        {/* Stock Status & Code */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            {item.isBought ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold gap-1">
                                <PackageCheck className="h-3 w-3" />
                                Bought / Sold
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-medium gap-1"
                              >
                                <Boxes className="h-3 w-3" />
                                In Stock (Available)
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                            <span className="font-mono text-[11px] bg-muted/70 px-1.5 py-0.5 rounded text-foreground font-medium">
                              {item.ticketCode}
                            </span>
                            {item.bookingReference && (
                              <span className="text-[11px]">
                                &bull; Ref: {item.bookingReference}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tier & Price */}
                        <td className="py-4 px-4">
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
                        <td className="py-4 px-4">
                          {item.isBought ? (
                            <div>
                              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{item.customerName || "Purchased Customer"}</span>
                              </div>
                              {item.cnic && (
                                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                  CNIC: {item.cnic}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Unallocated (Available for purchase)
                            </span>
                          )}
                        </td>

                        {/* Email & Phone */}
                        <td className="py-4 px-4">
                          {item.isBought ? (
                            <div className="space-y-1">
                              {item.customerEmail ? (
                                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate max-w-[200px]">
                                    {item.customerEmail}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              {item.customerPhone && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  <span>{item.customerPhone}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Parchi User Status */}
                        <td className="py-4 px-4">
                          {item.isBought ? (
                            item.isParchi ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 text-xs font-semibold gap-1 shadow-sm">
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
                                className="text-xs text-muted-foreground font-normal border-border/60"
                              >
                                Standard Order
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          {item.isBought && item.attendeeRef ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (item.attendeeRef) setSelectedTicketForPreview(item.attendeeRef);
                                }}
                                className="h-8 px-2.5 text-xs bg-background/80 hover:bg-background border-border/80"
                                title="View QR Pass"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                QR Pass
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (item.attendeeRef) handleDownloadPdf(item.attendeeRef);
                                }}
                                disabled={isDownloadingPdf[item.attendeeRef.code]}
                                className="h-8 px-2 text-primary hover:bg-primary/10"
                                title="Download PDF"
                              >
                                <Download
                                  className={`h-3.5 w-3.5 ${
                                    isDownloadingPdf[item.attendeeRef.code]
                                      ? "animate-bounce"
                                      : ""
                                  }`}
                                />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">
                              Ready for Sale
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            <div className="space-y-6 pt-2">
              {/* QR Canvas */}
              <div className="p-6 bg-white rounded-2xl flex flex-col items-center justify-center border shadow-inner">
                <QRCodeCanvas
                  value={selectedTicketForPreview.code}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
                <p className="font-mono text-xs font-bold text-black mt-3 tracking-widest">
                  {selectedTicketForPreview.code}
                </p>
              </div>

              {/* Pass Metadata */}
              <div className="space-y-2.5 bg-muted/40 p-4 rounded-xl text-sm border border-border/40">
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
                      <span className="text-purple-600">Yes (Parchi Verified)</span>
                    ) : (
                      "No (Standard)"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={`font-semibold ${
                      selectedTicketForPreview.status === "checked_in"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
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
            void fetchAttendees();
          }}
        />
      )}
    </div>
  );
}
