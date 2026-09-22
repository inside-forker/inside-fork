"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  CheckCircle,
  Loader2,
  User,
  Calendar,
  Search,
  RefreshCw,
  CreditCard,
  Clock,
  TrendingUp,
  Ticket,
  Eye,
  DollarSign,
  Phone,
  Mail,
  Users,
  Hash,
  QrCode,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PrintableTicket } from "@/components/events/PrintableTicket";
import type { PublicPass } from "@/types/ticketing.types";

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

// Animation variants matching other admin pages
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

/**
 * Admin Bookings Management
 *
 * Shows all bookings with ability to:
 * - View booking details
 * - Mark as paid (super_admin only)
 * - Filter by status
 */
export function AdminBookingsManagement() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = React.useState<Booking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(
    null,
  );
  const [pdfPass, setPdfPass] = React.useState<PublicPass | null>(null);
  const [autoDownloadPdf, setAutoDownloadPdf] = React.useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);

  const { toast } = useToast();
  const itemsPerPage = 20;

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
          if (mutation.type === "attributes") {
            if (
              mutation.attributeName === "data-scroll-locked" &&
              body.hasAttribute("data-scroll-locked")
            ) {
              removeScrollLock();
            }
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

  // Fetch bookings and user role
  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/bookings");
      const result = await response.json();

      if (result.success) {
        setBookings(result.data || []);
        setUserRole(result.userRole);
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

  // Filter bookings
  React.useEffect(() => {
    let filtered = bookings;

    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.payment_status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.booking_reference?.toLowerCase().includes(query) ||
          b.customer_name?.toLowerCase().includes(query) ||
          b.customer_email?.toLowerCase().includes(query) ||
          b.event?.name.toLowerCase().includes(query),
      );
    }

    setFilteredBookings(filtered);
    setCurrentPage(1);
  }, [bookings, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBookings, currentPage]);

  // Mark booking as paid
  const handleMarkAsPaid = async (bookingId: number) => {
    try {
      setIsMarkingPaid(true);
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/mark-paid`,
        {
          method: "POST",
        },
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

  // Status badge without hover effects
  const getStatusBadge = (status: string | null) => {
    const baseClasses = "pointer-events-none select-none";
    switch (status) {
      case "paid":
        return (
          <Badge
            className={`${baseClasses} bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20`}
          >
            Paid
          </Badge>
        );
      case "awaiting_payment":
        return (
          <Badge
            className={`${baseClasses} bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/20`}
          >
            Awaiting
          </Badge>
        );
      case "failed":
        return (
          <Badge
            className={`${baseClasses} bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/20`}
          >
            Failed
          </Badge>
        );
      case "refunded":
        return (
          <Badge
            className={`${baseClasses} bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40 hover:bg-purple-500/20`}
          >
            Refunded
          </Badge>
        );
      case "expired":
        return (
          <Badge
            className={`${baseClasses} bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/40 hover:bg-gray-500/20`}
          >
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={baseClasses}>
            {status || "Unknown"}
          </Badge>
        );
    }
  };

  const isSuperAdmin = userRole === "super_admin";

  // Stats
  const stats = React.useMemo(() => {
    const total = bookings.length;
    const paid = bookings.filter((b) => b.payment_status === "paid").length;
    const awaiting = bookings.filter(
      (b) => b.payment_status === "awaiting_payment",
    ).length;
    const failed = bookings.filter((b) => b.payment_status === "failed").length;
    const revenue = bookings
      .filter((b) => b.payment_status === "paid")
      .reduce((sum, b) => sum + b.total_amount, 0);
    return { total, paid, awaiting, failed, revenue };
  }, [bookings]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-5 gap-4"
      >
        {/* Total Bookings */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors">
                Total Bookings
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Ticket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {stats.total}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Paid */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/10 dark:via-emerald-500/5 dark:to-emerald-500/0 border-emerald-500/30 dark:border-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-200 transition-colors">
                Paid
              </CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {stats.paid}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Awaiting Payment */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-amber-500/0 border-amber-500/30 dark:border-amber-500/20 hover:shadow-xl hover:shadow-amber-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100 group-hover:text-amber-800 dark:group-hover:text-amber-200 transition-colors">
                Awaiting
              </CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {stats.awaiting}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Failed */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0 border-red-500/30 dark:border-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100 group-hover:text-red-800 dark:group-hover:text-red-200 transition-colors">
                Failed
              </CardTitle>
              <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/5 dark:to-primary/0 border-primary/30 dark:border-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary/90 dark:text-primary/80 group-hover:text-primary transition-colors">
                Revenue
              </CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-primary group-hover:text-primary/90 transition-colors">
                PKR {stats.revenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters & actions bar matching ListingsManagementPage */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                id="bookings-search"
                name="bookings-search"
                autoComplete="off"
                placeholder="Search by reference, name, email, event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="awaiting_payment">
                  Awaiting Payment
                </SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={fetchData}
            disabled={isLoading}
            className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Bookings Table */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Bookings
                <Badge variant="secondary" className="ml-2">
                  {filteredBookings.length}
                </Badge>
              </CardTitle>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-16">
                <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No bookings found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">
                          Reference
                        </TableHead>
                        <TableHead className="font-semibold">Event</TableHead>
                        <TableHead className="font-semibold">
                          Customer
                        </TableHead>
                        <TableHead className="font-semibold">Tickets</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="text-right font-semibold">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBookings.map((booking, index) => (
                        <motion.tr
                          key={booking.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <TableCell className="font-mono text-sm font-medium">
                            {booking.booking_reference || `#${booking.id}`}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate font-medium">
                              {booking.event?.name || (
                                <span className="text-muted-foreground">
                                  No event
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {booking.customer_name ||
                                  booking.user?.full_name ||
                                  "-"}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {booking.customer_email || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              {booking.total_tickets || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              PKR {booking.total_amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(booking.payment_status)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(
                              new Date(booking.created_at),
                              "MMM d, yyyy",
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedBooking(booking)}
                              className="gap-1 hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredBookings.length,
                      )}{" "}
                      of {filteredBookings.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Booking Detail Dialog */}
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
              {selectedBooking?.booking_reference ||
                `Booking #${selectedBooking?.id}`}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-5">
              {/* Status and Amount Row */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                      Payment Status
                    </div>
                    {getStatusBadge(selectedBooking.payment_status)}
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                      Total Amount
                    </div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      PKR {selectedBooking.total_amount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Event Info */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Event</div>
                  <div className="font-medium">
                    {selectedBooking.event?.name || "No event linked"}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium">
                      {selectedBooking.customer_name ||
                        selectedBooking.user?.full_name ||
                        "-"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </div>
                    <div className="font-medium text-sm truncate">
                      {selectedBooking.customer_email || "-"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </div>
                    <div className="font-medium">
                      {selectedBooking.customer_phone ||
                        selectedBooking.user?.phone ||
                        "-"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Hash className="w-3 h-3" /> CNIC (Last 4)
                    </div>
                    <div className="font-medium font-mono">
                      {selectedBooking.cnic_last4 || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Items */}
              {selectedBooking.items && selectedBooking.items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Tickets Ordered ({selectedBooking.total_tickets})
                  </h4>
                  <div className="space-y-2">
                    {selectedBooking.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <div className="font-medium">
                            {item.ticket_type_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × PKR{" "}
                            {Number(item.price_per_ticket).toLocaleString()}
                          </div>
                        </div>
                        <div className="font-semibold">
                          PKR{" "}
                          {(
                            item.quantity * Number(item.price_per_ticket)
                          ).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guest Details (Ticket Passes) */}
              {selectedBooking.guests && selectedBooking.guests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Guest Details ({selectedBooking.guests.length})
                  </h4>
                  <ScrollArea className="max-h-[280px]">
                    <div className="space-y-2">
                      {selectedBooking.guests.map((guest, idx) => (
                        <div
                          key={guest.id ?? idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium">
                                {guest.name || "Guest " + (idx + 1)}
                              </div>
                              {guest.cnic && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  CNIC: ****{guest.cnic}
                                </span>
                              )}
                              {guest.gate_label && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-primary/30 text-primary"
                                >
                                  Enter: {guest.gate_label}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>{guest.ticket_type}</span>
                              <span className="font-mono text-xs">
                                {guest.code}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {guest.code &&
                              selectedBooking.payment_status === "paid" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                                  onClick={() => {
                                    setPdfPass({
                                      id: guest.id ?? idx + 1,
                                      booking_id: selectedBooking.id,
                                      code: guest.code,
                                      status: guest.status as PublicPass["status"],
                                      quantity_index: guest.quantity_index ?? idx,
                                      issued_at:
                                        guest.issued_at ||
                                        selectedBooking.created_at,
                                      ticket_type_id: guest.ticket_type_id ?? 0,
                                      guest_name: guest.name,
                                      cnic_last4: guest.cnic,
                                      assigned_gate_index:
                                        guest.assigned_gate_index ?? null,
                                      gate_label: guest.gate_label ?? null,
                                    });
                                    setAutoDownloadPdf(true);
                                  }}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  PDF
                                </Button>
                              )}
                            <Badge
                              className={
                                guest.status === "checked_in"
                                  ? "bg-emerald-500/20 text-emerald-600"
                                  : "bg-amber-500/20 text-amber-600"
                              }
                            >
                              {guest.status === "checked_in" ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Checked In
                                </>
                              ) : (
                                <>
                                  <QrCode className="w-3 h-3 mr-1" />
                                  Issued
                                </>
                              )}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Created At */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">
                    Booking Created
                  </div>
                  <div className="font-medium">
                    {format(new Date(selectedBooking.created_at), "PPpp")}
                  </div>
                </div>
              </div>

              {/* Mark as Paid Button - Super Admin Only */}
              {isSuperAdmin &&
                selectedBooking.payment_status === "awaiting_payment" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-4 border-t border-border/50"
                  >
                    <Button
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                      onClick={() => handleMarkAsPaid(selectedBooking.id)}
                      disabled={isMarkingPaid}
                    >
                      {isMarkingPaid ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Mark as Paid & Generate Tickets
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      This will generate ticket passes with QR codes for this
                      booking
                    </p>
                  </motion.div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {pdfPass && selectedBooking && (
        <PrintableTicket
          pass={pdfPass}
          eventName={selectedBooking.event?.name || "Event"}
          eventDate={
            selectedBooking.event?.start_time || selectedBooking.created_at
          }
          venueName={selectedBooking.event?.location_name || undefined}
          ticketType={
            selectedBooking.guests.find((g) => g.code === pdfPass.code)
              ?.ticket_type || undefined
          }
          autoDownloadPdf={autoDownloadPdf}
          onClose={() => {
            setPdfPass(null);
            setAutoDownloadPdf(false);
          }}
        />
      )}
    </motion.div>
  );
}
