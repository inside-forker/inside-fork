"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventsTable } from "@/components/admin/EventsTable";
import { EventModal } from "@/components/admin/EventModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Calendar,
  Users,
  Eye,
  Filter,
  AlertCircle,
} from "lucide-react";
import type { AdminEvent } from "@/types/events.types";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import Link from "next/link";

export function EventsManagementPage() {
  const [events, setEvents] = React.useState<AdminEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = React.useState<AdminEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<AdminEvent | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  // When realtime changes arrive during edit/create, queue a refresh and run after close
  const pendingRefreshRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [organizerFilter, setOrganizerFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [eventToDelete, setEventToDelete] = React.useState<AdminEvent | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState(0);

  const { toast } = useToast();

  // Pagination
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEvents, currentPage]);

  // Fetch events. `silent` skips the loading state so background polling
  // refreshes don't flash the table every cycle.
  const fetchEvents = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await fetch("/api/admin/events");
      const result = await response.json();

      if (result.success) {
        setEvents(result.data.events);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Fetch events error:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to fetch events",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [toast]);

  // Fetch pending approvals count
  const fetchPendingApprovals = React.useCallback(async () => {
    try {
      const response = await fetch(
        "/api/admin/events/approvals?status=pending&limit=1",
      );
      const result = await response.json();
      if (result.success) {
        setPendingApprovalsCount(result.data.pendingCount || 0);
      }
    } catch (error) {
      console.error("Fetch pending approvals error:", error);
    }
  }, []);

  // Filter events
  React.useEffect(() => {
    let filtered = events;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (event) =>
          event.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.organizer_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          event.location_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (event) => event.event_status === statusFilter,
      );
    }

    // Organizer filter
    if (organizerFilter !== "all") {
      filtered = filtered.filter(
        (event) => event.organizer_name === organizerFilter,
      );
    }

    setFilteredEvents(filtered);

    // Only reset to first page if current page has no events after filtering
    const startIndex = (currentPage - 1) * itemsPerPage;
    const hasEventsOnCurrentPage =
      filtered.slice(startIndex, startIndex + itemsPerPage).length > 0;

    if (!hasEventsOnCurrentPage && filtered.length > 0) {
      setCurrentPage(1);
    }
  }, [
    events,
    searchQuery,
    statusFilter,
    organizerFilter,
    currentPage,
    itemsPerPage,
  ]);

  // Load events on mount
  React.useEffect(() => {
    fetchEvents();
    fetchPendingApprovals();
  }, [fetchEvents, fetchPendingApprovals]);

  // Realtime refresh when tables feeding events_with_details change: events, event_images, listings, profiles.
  useRealtimeRefresh(
    "admin-events-realtime",
    [
      { table: "events" },
      { table: "event_images" },
      { table: "listings" },
      { table: "profiles" },
    ],
    () => {
      if (isModalOpen) {
        pendingRefreshRef.current = true;
        return;
      }
      fetchEvents(true);
    },
    600,
    10_000,
  );

  // When modal closes, run any pending refresh from realtime updates
  React.useEffect(() => {
    if (!isModalOpen && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      fetchEvents(true);
    }
  }, [isModalOpen, fetchEvents]);

  const handleEditEvent = (event: AdminEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleViewEvent = (event: AdminEvent) => {
    // Navigate to event detail page using slug
    window.open(`/events/${event.event_slug}`, "_blank");
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (
    eventData: Partial<AdminEvent>,
  ): Promise<AdminEvent | undefined> => {
    try {
      const isUpdate = !!selectedEvent;
      const url = isUpdate
        ? `/api/admin/events/${selectedEvent.event_id}`
        : "/api/admin/events";
      const method = isUpdate ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      const result = await response.json();

      if (result.success) {
        setIsModalOpen(false);
        setSelectedEvent(null);
        fetchEvents();
        // Return the created/updated event data for temp image handling
        return result.data;
      } else {
        throw new Error(result.error || `Failed to ${isUpdate ? "update" : "create"} event`);
      }
    } catch (error) {
      console.error("Save event error:", error);
      throw error;
    }
  };

  const handleDeleteEvent = (event: AdminEvent) => {
    setEventToDelete(event);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/events/${eventToDelete.event_id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (result.success) {
        fetchEvents();
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Delete event error:", error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
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

  const getEventStats = () => {
    return {
      total: events.length,
      published: events.filter((e) => e.event_status === "published").length,
      draft: events.filter((e) => e.event_status === "draft").length,
      archived: events.filter((e) => e.event_status === "archived").length,
      featured: events.filter((e) => e.is_featured).length,
      upcoming: events.filter((e) => new Date(e.start_time) > new Date())
        .length,
    };
  };

  const stats = getEventStats();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Pending Approvals Banner */}
      {pendingApprovalsCount > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      {pendingApprovalsCount} event request
                      {pendingApprovalsCount > 1 ? "s" : ""} pending approval
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500">
                      Organizers have submitted events for your review
                    </p>
                  </div>
                </div>
                <Link href="/admin/events/approvals">
                  <Button
                    variant="outline"
                    className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10"
                  >
                    Review Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-6 gap-4"
      >
        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors">
                Total Events
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {stats.total}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors">
                Published
              </CardTitle>
              <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {stats.published}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors">
                Draft
              </CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {stats.draft}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors">
                Featured
              </CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {stats.featured}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors">
                Upcoming
              </CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {stats.upcoming}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="bg-gradient-to-br from-gray-500/20 via-gray-500/10 to-gray-500/5 dark:from-gray-500/10 dark:via-gray-500/5 dark:to-gray-500/0 border-gray-500/30 dark:border-gray-500/20 hover:shadow-xl hover:shadow-gray-500/25 transition-all duration-300 group cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                Archived
              </CardTitle>
              <div className="p-2 bg-gray-500/10 rounded-lg group-hover:bg-gray-500/20 transition-colors">
                <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                {stats.archived}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters and Actions */}
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
                placeholder="Search events by name, organizer, or venue..."
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
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Organizer Filter */}
            <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
              <SelectTrigger className="w-52 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by organizer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizers</SelectItem>
                {/* This would be populated with actual organizers */}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => fetchEvents()}
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

      {/* Events Table */}
      <motion.div variants={itemVariants}>
        <EventsTable
          events={paginatedEvents}
          isLoading={isLoading}
          onEditEvent={handleEditEvent}
          onViewEvent={handleViewEvent}
          onDeleteEvent={handleDeleteEvent}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </motion.div>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvent(null);
        }}
        onSave={handleSaveEvent}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={confirmDeleteEvent}
        title="Delete Event"
        description={`Are you sure you want to delete "${eventToDelete?.event_name}"? This action cannot be undone.`}
        confirmText="Delete Event"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
