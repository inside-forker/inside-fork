"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QRCodeCanvas } from "qrcode.react";
import { downloadTicketPdf } from "@/lib/ticketing/download-ticket-pdf";
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
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

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

interface SoldTicketsModalProps {
  eventId: number | null;
  eventName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SoldTicketsModal({
  eventId,
  eventName: initialEventName,
  isOpen,
  onClose,
}: SoldTicketsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeTicketItem[]>([]);
  const [eventDetails, setEventDetails] = useState<EventMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedTicketForPreview, setSelectedTicketForPreview] = useState<AttendeeTicketItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<Record<string, boolean>>({});

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/attendees?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok) {
        setAttendees(data.attendees || []);
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
    if (isOpen && eventId) {
      fetchAttendees();
    } else {
      setAttendees([]);
      setSearchQuery("");
      setStatusFilter("all");
      setTierFilter("all");
      setSelectedTicketForPreview(null);
    }
  }, [isOpen, eventId, fetchAttendees]);

  // Unique ticket tiers
  const tiers = useMemo(() => {
    const list = Array.from(new Set(attendees.map((a) => a.ticketType).filter(Boolean)));
    return list;
  }, [attendees]);

  // Filtered attendees
  const filteredAttendees = useMemo(() => {
    return attendees.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.guestName?.toLowerCase().includes(q) ||
        item.buyerName?.toLowerCase().includes(q) ||
        item.buyerEmail?.toLowerCase().includes(q) ||
        item.buyerPhone?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "checked_in" && item.status === "checked_in") ||
        (statusFilter === "pending" && (item.status === "issued" || item.status === "active"));

      const matchesTier = tierFilter === "all" || item.ticketType === tierFilter;

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [attendees, searchQuery, statusFilter, tierFilter]);

  // Stats summary
  const totalRevenue = useMemo(() => {
    return attendees.reduce((sum, a) => sum + (a.price || 0), 0);
  }, [attendees]);

  const totalCheckedIn = useMemo(() => {
    return attendees.filter((a) => a.status === "checked_in").length;
  }, [attendees]);

  // PDF Download Handler
  const handleDownloadPdf = async (ticket: AttendeeTicketItem) => {
    try {
      setIsDownloadingPdf((prev) => ({ ...prev, [ticket.code]: true }));
      const eventName = eventDetails?.name || initialEventName || "Event";
      const eventDate = eventDetails?.start_time
        ? format(new Date(eventDetails.start_time), "EEE, MMM d, yyyy")
        : "Event Date";
      const eventTime = eventDetails?.start_time
        ? format(new Date(eventDetails.start_time), "h:mm a")
        : "";

      await downloadTicketPdf({
        code: ticket.code,
        eventName,
        eventDate,
        eventTime,
        venueName: eventDetails?.location_name || eventDetails?.address || "Karachi",
        venueAddress: eventDetails?.address || undefined,
        organizerName: eventDetails?.organizer_name || "Inside Karachi",
        ticketType: ticket.ticketType,
        guestName: ticket.guestName || ticket.buyerName,
        cnicLast4: ticket.guestCnic || undefined,
        gateLabel:
          ticket.assignedDeviceIndex !== null
            ? `Lane ${ticket.assignedDeviceIndex + 1}`
            : "Lane 1",
        bookingCode: ticket.bookingCode || undefined,
        ticketIndex: (ticket.quantityIndex || 0) + 1,
        totalTickets: 1,
        filename: `ticket-${eventName.replace(/[^a-zA-Z0-9]/g, "-")}-${ticket.code}.pdf`,
      });

      toast({
        title: "Ticket Downloaded",
        description: `Downloaded PDF pass for ${ticket.guestName || ticket.code}`,
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
    if (attendees.length === 0) return;
    const headers = [
      "Ticket Code",
      "Guest Name",
      "Buyer Name",
      "Buyer Email",
      "Buyer Phone",
      "Ticket Tier",
      "Price (PKR)",
      "Status",
      "Checked In At",
      "Issued At",
    ];

    const rows = attendees.map((a) => [
      a.code,
      a.guestName,
      a.buyerName,
      a.buyerEmail || "",
      a.buyerPhone || "",
      a.ticketType,
      a.price,
      a.status,
      a.checkedInAt ? format(new Date(a.checkedInAt), "yyyy-MM-dd HH:mm:ss") : "",
      a.issuedAt ? format(new Date(a.issuedAt), "yyyy-MM-dd HH:mm:ss") : "",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = (eventDetails?.name || initialEventName || `event-${eventId}`).replace(/\s+/g, "-");
    link.href = url;
    link.setAttribute("download", `sold-tickets-${name}-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Roster Exported",
      description: `Exported ${attendees.length} tickets to CSV`,
    });
  };

  const displayName = eventDetails?.name || initialEventName || "Event";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl">
          {/* Header */}
          <DialogHeader className="p-6 border-b border-border/40 bg-card/40 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Ticket className="w-3.5 h-3.5 mr-1" />
                    Sold Tickets & Attendee Passes
                  </Badge>
                  {eventDetails?.start_time && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(eventDetails.start_time), "PPP")}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
                  {displayName}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Live manifest of all purchased tickets, buyer contacts, and pass PDFs.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {eventId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/20 hover:bg-primary/5 text-xs"
                    asChild
                  >
                    <Link href={`/admin/accounts?event_id=${eventId}`} target="_blank">
                      <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      Gate & Device Console
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={attendees.length === 0}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchAttendees}
                  disabled={loading}
                  className="text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 bg-card rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground">Total Tickets Sold</div>
                <div className="text-xl font-bold text-primary">{attendees.length}</div>
              </div>
              <div className="p-3 bg-card rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground">Verified Check-Ins</div>
                <div className="text-xl font-bold text-emerald-500">
                  {totalCheckedIn} <span className="text-xs text-muted-foreground font-normal">({attendees.length > 0 ? Math.round((totalCheckedIn / attendees.length) * 100) : 0}%)</span>
                </div>
              </div>
              <div className="p-3 bg-card rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground">Pending Attendance</div>
                <div className="text-xl font-bold text-amber-500">{attendees.length - totalCheckedIn}</div>
              </div>
              <div className="p-3 bg-card rounded-xl border border-border/50">
                <div className="text-xs text-muted-foreground">Gross Revenue</div>
                <div className="text-xl font-bold text-foreground">PKR {totalRevenue.toLocaleString()}</div>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by attendee, buyer, email, phone, or ticket code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Statuses ({attendees.length})</option>
                  <option value="checked_in">Checked In ({totalCheckedIn})</option>
                  <option value="pending">Pending ({attendees.length - totalCheckedIn})</option>
                </select>

                {tiers.length > 1 && (
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Tiers</option>
                    {tiers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Tickets List Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm">Loading ticket records...</p>
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Ticket className="w-12 h-12 stroke-[1.2] text-muted-foreground/50 mb-3" />
                <h4 className="text-base font-semibold text-foreground">No Tickets Found</h4>
                <p className="text-xs max-w-sm mt-1">
                  {attendees.length === 0
                    ? "No tickets have been purchased for this event yet."
                    : "No sold tickets match your active search filters."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredAttendees.map((ticket) => {
                  const isCheckedIn = ticket.status === "checked_in";
                  return (
                    <div
                      key={ticket.id || ticket.code}
                      className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      {/* Left: Attendee Info */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-base text-foreground">
                            {ticket.guestName}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              isCheckedIn
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            }
                          >
                            {isCheckedIn ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Checked In
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Active Pass
                              </>
                            )}
                          </Badge>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {ticket.ticketType} • PKR {ticket.price.toLocaleString()}
                          </Badge>
                          {ticket.assignedDeviceIndex !== null && (
                            <Badge variant="outline" className="text-xs">
                              Gate {ticket.assignedDeviceIndex + 1}
                            </Badge>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {ticket.buyerEmail && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              <span>{ticket.buyerEmail}</span>
                            </div>
                          )}
                          {ticket.buyerPhone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{ticket.buyerPhone}</span>
                            </div>
                          )}
                          {ticket.buyerName && ticket.buyerName !== ticket.guestName && (
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              <span>Buyer: {ticket.buyerName}</span>
                            </div>
                          )}
                          {ticket.guestCnic && (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs">CNIC: {ticket.guestCnicFormatted}</span>
                            </div>
                          )}
                        </div>

                        {/* Timing */}
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/80 font-mono">
                          <span>Code: {ticket.code}</span>
                          {ticket.checkedInAt && (
                            <span className="text-emerald-500">
                              Checked in: {format(new Date(ticket.checkedInAt), "MMM d, h:mm a")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicketForPreview(ticket)}
                          className="h-8 text-xs flex-1 sm:flex-none"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-primary" />
                          View Pass
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownloadPdf(ticket)}
                          disabled={isDownloadingPdf[ticket.code]}
                          className="h-8 text-xs flex-1 sm:flex-none"
                        >
                          <Download className={`w-3.5 h-3.5 mr-1 ${isDownloadingPdf[ticket.code] ? "animate-spin" : ""}`} />
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Pass Preview Dialog */}
      {selectedTicketForPreview && (
        <Dialog open={!!selectedTicketForPreview} onOpenChange={() => setSelectedTicketForPreview(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <div className="p-6 bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border/40 text-center">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 mb-2">
                Official Inside Karachi Pass
              </Badge>
              <h3 className="text-xl font-bold text-foreground">
                {eventDetails?.name || initialEventName || "Event Ticket"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {eventDetails?.start_time ? format(new Date(eventDetails.start_time), "EEEE, MMMM d, yyyy • h:mm a") : ""}
              </p>
            </div>

            <div className="p-6 flex flex-col items-center space-y-6">
              {/* QR Code */}
              <div className="p-4 bg-white rounded-2xl shadow-md border border-border/20 flex flex-col items-center">
                <QRCodeCanvas
                  value={selectedTicketForPreview.code}
                  size={180}
                  level="H"
                  includeMargin={false}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
                <div className="font-mono text-xs font-bold text-zinc-900 tracking-wider mt-3">
                  {selectedTicketForPreview.code}
                </div>
              </div>

              {/* Ticket Details Box */}
              <div className="w-full bg-muted/40 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attendee Name:</span>
                  <span className="font-semibold text-foreground">{selectedTicketForPreview.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket Tier:</span>
                  <span className="font-semibold text-primary">{selectedTicketForPreview.ticketType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Paid:</span>
                  <span className="font-semibold text-foreground">PKR {selectedTicketForPreview.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-semibold ${selectedTicketForPreview.status === "checked_in" ? "text-emerald-500" : "text-amber-500"}`}>
                    {selectedTicketForPreview.status === "checked_in" ? "Checked In" : "Active / Valid"}
                  </span>
                </div>
                {selectedTicketForPreview.buyerEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer Email:</span>
                    <span className="text-muted-foreground truncate max-w-[200px]">{selectedTicketForPreview.buyerEmail}</span>
                  </div>
                )}
                {selectedTicketForPreview.buyerPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer Phone:</span>
                    <span className="text-muted-foreground">{selectedTicketForPreview.buyerPhone}</span>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="flex items-center gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTicketForPreview(null)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleDownloadPdf(selectedTicketForPreview)}
                  disabled={isDownloadingPdf[selectedTicketForPreview.code]}
                  className="flex-1 shadow-premium shadow-primary/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
