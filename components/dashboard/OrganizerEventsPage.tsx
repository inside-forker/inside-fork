"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Calendar,
  Eye,
  Filter,
  Clock,
  MapPin,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
  Ticket,
} from "lucide-react";
import type {
  OrganizerManagedEvent,
  EventFormData,
  EventChangeRequest,
  EventProposedData,
} from "@/types/event-change-request.types";
import { OrganizerEventModal } from "./OrganizerEventModal";
import { RejectedRequestModal } from "./RejectedRequestModal";
import { SoldTicketsModal } from "./SoldTicketsModal";

export function OrganizerEventsPage() {
  const [events, setEvents] = React.useState<OrganizerManagedEvent[]>([]);
  const [pendingCreates, setPendingCreates] = React.useState<
    EventChangeRequest[]
  >([]);
  const [rejectedRequests, setRejectedRequests] = React.useState<
    EventChangeRequest[]
  >([]);
  const [filteredEvents, setFilteredEvents] = React.useState<
    OrganizerManagedEvent[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] =
    React.useState<OrganizerManagedEvent | null>(null);
  const [isRejectedModalOpen, setIsRejectedModalOpen] = React.useState(false);
  const [selectedRejectedRequest, setSelectedRejectedRequest] =
    React.useState<EventChangeRequest | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [eventToDelete, setEventToDelete] =
    React.useState<OrganizerManagedEvent | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<number, boolean>
  >({});
  const [selectedEventForTickets, setSelectedEventForTickets] = React.useState<OrganizerManagedEvent | null>(null);

  const { toast } = useToast();

  // Pagination
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEvents, currentPage]);

  // Fetch events
  const fetchEvents = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/organizer/events/manage");
      const result = await response.json();

      if (result.success) {
        setEvents(result.data.events || []);
        setPendingCreates(result.data.pendingCreates || []);
        // Show all rejected requests - let the user dismiss them manually
        // Previously we tried to filter out "stale" rejections but this caused
        // new rejections to not appear. Now we show all and let users dismiss.
        setRejectedRequests(result.data.rejectedRequests || []);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Fetch events error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch events",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Filter events
  React.useEffect(() => {
    let filtered = events;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (event) =>
          event.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.location_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        filtered = filtered.filter((event) => event.has_pending_changes);
      } else {
        filtered = filtered.filter(
          (event) => event.event_status === statusFilter,
        );
      }
    }

    setFilteredEvents(filtered);

    // Reset to first page if current page has no events
    const startIndex = (currentPage - 1) * itemsPerPage;
    const hasEventsOnCurrentPage =
      filtered.slice(startIndex, startIndex + itemsPerPage).length > 0;
    if (!hasEventsOnCurrentPage && filtered.length > 0) {
      setCurrentPage(1);
    }
  }, [events, searchQuery, statusFilter, currentPage]);

  // Load events on mount
  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handlers
  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: OrganizerManagedEvent) => {
    if (event.has_pending_changes) {
      toast({
        title: "Pending Changes",
        description:
          "This event has pending changes awaiting approval. Please wait for approval before making new changes.",
        variant: "destructive",
      });
      return;
    }
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleViewEvent = (event: OrganizerManagedEvent) => {
    window.open(`/events/${event.event_slug}`, "_blank");
  };

  const handleDeleteEvent = (event: OrganizerManagedEvent) => {
    if (event.has_pending_changes) {
      toast({
        title: "Pending Changes",
        description:
          "This event has pending changes awaiting approval. Please wait for approval before deleting.",
        variant: "destructive",
      });
      return;
    }
    setEventToDelete(event);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/organizer/events/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "delete",
          event_id: eventToDelete.event_id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: result.data.requires_approval
            ? "Delete Request Submitted"
            : "Event Deleted",
          description: result.data.message,
        });
        fetchEvents();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Delete event error:", error);
      toast({
        title: "Error",
        description: "Failed to submit delete request",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const handleSaveEvent = async (eventData: EventFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/organizer/events/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: selectedEvent ? "update" : "create",
          event_id: selectedEvent?.event_id,
          event_data: eventData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: result.data.requires_approval
            ? "Change Request Submitted"
            : selectedEvent
              ? "Event Updated"
              : "Event Created",
          description: result.data.message,
        });
        setIsModalOpen(false);
        setSelectedEvent(null);
        await fetchEvents(); // Re-fetch to clear stale rejection alerts
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Save event error:", error);
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (
    status: string,
    hasPending: boolean,
    pendingAction: string | null,
  ) => {
    const baseClasses =
      "text-xs font-medium px-2 py-1 rounded-full border backdrop-blur-sm shadow-sm";

    if (hasPending && pendingAction) {
      const actionConfig: Record<string, { color: string; label: string }> = {
        create: {
          color:
            "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
          label: "Creation Pending",
        },
        update: {
          color:
            "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
          label: "Update Pending",
        },
        delete: {
          color:
            "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
          label: "Deletion Pending",
        },
      };
      const config = actionConfig[pendingAction];
      if (config) {
        return (
          <Badge className={`${baseClasses} ${config.color} gap-1`}>
            <Clock className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      }
    }

    switch (status) {
      case "published":
        return (
          <Badge
            className={`${baseClasses} bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30`}
          >
            Published
          </Badge>
        );
      case "draft":
        return (
          <Badge
            className={`${baseClasses} bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30`}
          >
            Draft
          </Badge>
        );
      case "archived":
        return (
          <Badge
            className={`${baseClasses} bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30`}
          >
            Archived
          </Badge>
        );
      default:
        return (
          <Badge
            className={`${baseClasses} bg-muted/50 text-muted-foreground border-border/50`}
          >
            {status}
          </Badge>
        );
    }
  };

  // Stats
  const stats = {
    total: events.length,
    published: events.filter((e) => e.event_status === "published").length,
    draft: events.filter((e) => e.event_status === "draft").length,
    pending:
      events.filter((e) => e.has_pending_changes).length +
      pendingCreates.length,
    rejected: rejectedRequests.length,
    upcoming: events.filter((e) => new Date(e.start_time) > new Date()).length,
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-6 gap-4"
      >
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Total Events
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {stats.total}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 border-green-500/30 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
                Published
              </CardTitle>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {stats.published}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Draft
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {stats.draft}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-yellow-500/5 border-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Pending
              </CardTitle>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Upcoming
              </CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {stats.upcoming}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 border-red-500/30 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">
                Rejected
              </CardTitle>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {stats.rejected}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Rejected Requests Alert */}
      {rejectedRequests.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      {rejectedRequests.length} request
                      {rejectedRequests.length > 1 ? "s" : ""} rejected
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Review feedback and resubmit with corrections.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {rejectedRequests.slice(0, 2).map((req) => {
                    const proposed =
                      req.proposed_data as EventProposedData | null;
                    return (
                      <Button
                        key={req.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRejectedRequest(req);
                          setIsRejectedModalOpen(true);
                        }}
                        className="border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                      >
                        {proposed?.name?.slice(0, 20)}
                        {(proposed?.name?.length ?? 0) > 20 ? "..." : ""}
                      </Button>
                    );
                  })}
                  {rejectedRequests.length > 2 && (
                    <Badge
                      variant="outline"
                      className="border-red-500/50 text-red-600"
                    >
                      +{rejectedRequests.length - 2} more
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Dismiss all rejected requests with proper error handling
                        const results = await Promise.allSettled(
                          rejectedRequests.map(async (req) => {
                            const response = await fetch(
                              `/api/organizer/events/manage?request_id=${req.id}`,
                              { method: "DELETE" },
                            );
                            if (!response.ok) {
                              const data = await response
                                .json()
                                .catch(() => ({}));
                              throw new Error(data.error || "Failed to delete");
                            }
                            return response;
                          }),
                        );

                        const successCount = results.filter(
                          (r) => r.status === "fulfilled",
                        ).length;
                        const failCount = results.filter(
                          (r) => r.status === "rejected",
                        ).length;

                        if (failCount > 0) {
                          console.error(
                            "Some dismissals failed:",
                            results.filter((r) => r.status === "rejected"),
                          );
                          toast({
                            title: "Partial Success",
                            description: `${successCount} dismissed, ${failCount} failed. Please try again.`,
                            variant: "destructive",
                          });
                        } else {
                          toast({
                            title: "Dismissed",
                            description:
                              "All rejected requests have been cleared.",
                          });
                        }

                        // Always refresh to show current state
                        await fetchEvents();
                      } catch (error) {
                        console.error("Error dismissing requests:", error);
                        toast({
                          title: "Error",
                          description:
                            "Failed to dismiss requests. Please try again.",
                          variant: "destructive",
                        });
                        // Still refresh to show current state
                        await fetchEvents();
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                  >
                    Dismiss All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending Creates Alert */}
      {pendingCreates.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">
                    {pendingCreates.length} event
                    {pendingCreates.length > 1 ? "s" : ""} pending creation
                    approval
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    Your event creation requests are being reviewed by
                    administrators.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters and Actions */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                placeholder="Search events by name or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchEvents}
              disabled={isLoading}
              className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={handleCreateEvent}
              className="h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Events Grid */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px] auto-rows-fr items-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-muted rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-6 bg-muted rounded w-20" />
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 min-h-[600px]">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No events found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first event"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={handleCreateEvent}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr min-h-[600px] items-start">
            {paginatedEvents.map((event) => (
              <motion.div
                key={event.event_id}
                variants={itemVariants}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Card className="group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <CardHeader className="pb-3 relative z-10 flex-shrink-0 min-h-[80px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base leading-tight truncate pr-2 text-foreground group-hover:text-primary transition-colors duration-300">
                            {event.event_name}
                          </h3>
                          {event.event_description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                              {event.event_description}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu
                        modal={false}
                        open={dropdownOpen[event.event_id] || false}
                        onOpenChange={(open) =>
                          setDropdownOpen((prev) => ({
                            ...prev,
                            [event.event_id]: open,
                          }))
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-shrink-0 relative z-10 hover:bg-primary/10"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-48 bg-background/95 backdrop-blur-md shadow-premium border-border/60 rounded-xl"
                          align="end"
                          sideOffset={4}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl pointer-events-none" />
                          <div className="relative z-10 p-2">
                            <DropdownMenuItem
                              onClick={() => setSelectedEventForTickets(event)}
                              className="cursor-pointer hover:bg-primary/10 text-primary font-medium"
                            >
                              <Ticket className="h-4 w-4 mr-2" />
                              Sold Tickets & PDFs
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditEvent(event)}
                              disabled={event.has_pending_changes}
                              className="cursor-pointer hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Event
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleViewEvent(event)}
                              className="cursor-pointer hover:bg-primary/10"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteEvent(event)}
                              disabled={event.has_pending_changes}
                              className="cursor-pointer text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Event
                            </DropdownMenuItem>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col justify-between space-y-3 relative z-10">
                    {/* Date & Time */}
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-muted/50 rounded-md">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {formatDate(event.start_time)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Date & Time
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-muted/50 rounded-md">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {event.location_name || "Location TBD"}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Location
                        </p>
                      </div>
                    </div>

                    {/* Status & Badges */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {event.max_capacity && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>{event.max_capacity}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {event.is_featured && (
                          <Badge className="text-xs font-medium px-2 py-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/40">
                            Featured
                          </Badge>
                        )}
                        {getStatusBadge(
                          event.event_status,
                          event.has_pending_changes,
                          event.pending_action_type,
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {paginatedEvents.length} of {filteredEvents.length} events
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
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
      </motion.div>

      {/* Event Modal */}
      <OrganizerEventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvent(null);
        }}
        onSave={handleSaveEvent}
        isSaving={isSaving}
      />

      {/* Sold Tickets Modal */}
      <SoldTicketsModal
        eventId={selectedEventForTickets?.event_id || null}
        eventName={selectedEventForTickets?.event_name}
        isOpen={!!selectedEventForTickets}
        onClose={() => setSelectedEventForTickets(null)}
      />

      {/* Rejected Request Modal */}
      <RejectedRequestModal
        request={selectedRejectedRequest}
        isOpen={isRejectedModalOpen}
        onClose={() => {
          setIsRejectedModalOpen(false);
          setSelectedRejectedRequest(null);
        }}
        onResubmit={async (eventData) => {
          setIsSaving(true);
          try {
            // Delete the old rejected request first
            if (selectedRejectedRequest) {
              const deleteResponse = await fetch(
                `/api/organizer/events/manage?request_id=${selectedRejectedRequest.id}`,
                { method: "DELETE" },
              );

              // If delete fails, log but continue with resubmission
              if (!deleteResponse.ok) {
                console.error(
                  "Failed to delete rejected request, but continuing with resubmission",
                );
              }
            }

            // Submit as new create request
            const response = await fetch("/api/organizer/events/manage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action_type: "create",
                event_data: eventData,
              }),
            });

            const result = await response.json();

            if (result.success) {
              toast({
                title: "Request Resubmitted",
                description: "Your event has been resubmitted for approval.",
              });
              setIsRejectedModalOpen(false);
              setSelectedRejectedRequest(null);
              // Fetch events to clear the rejection alert
              await fetchEvents();
            } else {
              throw new Error(result.error);
            }
          } catch (error) {
            console.error("Resubmit error:", error);
            toast({
              title: "Error",
              description:
                "Failed to resubmit request. Please try again or contact support.",
              variant: "destructive",
            });
            // Even on error, try to refresh to show current state
            await fetchEvents();
          } finally {
            setIsSaving(false);
          }
        }}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Request Event Deletion"
        description={`Are you sure you want to request deletion of "${eventToDelete?.event_name}"? This request will be reviewed by an administrator.`}
        confirmText="Submit Request"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
