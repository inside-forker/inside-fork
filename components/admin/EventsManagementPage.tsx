"use client";

import * as React from "react";
import { CalendarDays, List, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventsTable } from "@/components/admin/EventsTable";
import { EventsCalendar } from "@/components/admin/EventsCalendar";
import { EventModal } from "@/components/admin/EventModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AdminFilterBar, AdminPageShell, SegmentedControl } from "@/components/admin/ui";
import { useToast } from "@/hooks/use-toast";
import type { AdminEvent } from "@/types/events.types";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

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
  const [viewMode, setViewMode] = React.useState<"table" | "calendar">("table");

  const { toast } = useToast();

  // Pagination
  const itemsPerPage = 12;
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

  const organizerOptions = React.useMemo(
    () =>
      [...new Set(events.map((e) => e.organizer_name).filter((n): n is string => Boolean(n)))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    [events],
  );

  const hasFilters = searchQuery !== "" || statusFilter !== "all" || organizerFilter !== "all";
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setOrganizerFilter("all");
  };

  const toolbar = (
    <AdminFilterBar
      search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search events" }}
      facets={[
        {
          id: "status",
          label: "Status",
          single: true,
          selected: statusFilter === "all" ? [] : [statusFilter],
          onChange: (values) => setStatusFilter(values[0] ?? "all"),
          options: [
            { value: "published", label: "Published", count: stats.published },
            { value: "draft", label: "Draft", count: stats.draft },
            { value: "archived", label: "Archived", count: stats.archived },
          ],
        },
        {
          id: "organizer",
          label: "Organizer",
          single: true,
          selected: organizerFilter === "all" ? [] : [organizerFilter],
          onChange: (values) => setOrganizerFilter(values[0] ?? "all"),
          options: organizerOptions,
        },
      ]}
      onClearAll={clearFilters}
      trailing={
        <SegmentedControl
          label="View"
          value={viewMode}
          onValueChange={setViewMode}
          options={[
            { value: "table", label: "Table", icon: List },
            { value: "calendar", label: "Calendar", icon: CalendarDays },
          ]}
        />
      }
    />
  );

  return (
    <AdminPageShell
      eyebrow="Events & ticketing"
      title="Events"
      description={`${stats.total} events, ${stats.upcoming} upcoming.`}
      live="live"
      actions={
        <>
          <Button variant="outline" onClick={() => fetchEvents()} loading={isLoading}>
            <RefreshCw />
            Refresh
          </Button>
          <Button variant="solid" onClick={handleCreateEvent}>
            <Plus />
            New event
          </Button>
        </>
      }
      metrics={[
        { label: "Upcoming", value: stats.upcoming, caption: `${stats.featured} featured` },
        { label: "Published", value: stats.published, caption: `of ${stats.total} events` },
        { label: "Drafts", value: stats.draft, caption: `${stats.archived} archived` },
        {
          label: "Awaiting approval",
          value: pendingApprovalsCount,
          emphasis: pendingApprovalsCount > 0,
          href: "/admin/events/approvals",
          caption: pendingApprovalsCount > 0 ? "Review requests" : "All caught up",
        },
      ]}
    >
      {viewMode === "table" ? (
        <EventsTable
          events={paginatedEvents}
          isLoading={isLoading}
          onEditEvent={handleEditEvent}
          onViewEvent={handleViewEvent}
          onDeleteEvent={handleDeleteEvent}
          onCreateEvent={handleCreateEvent}
          currentPage={currentPage}
          pageSize={itemsPerPage}
          total={filteredEvents.length}
          onPageChange={setCurrentPage}
          toolbar={toolbar}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />
      ) : (
        <div className="min-w-0 overflow-clip rounded-lg border bg-card">
          {toolbar}
          <EventsCalendar events={filteredEvents} onOpenEvent={handleEditEvent} />
        </div>
      )}

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
        title="Delete event"
        description={`Delete "${eventToDelete?.event_name}"? This can't be undone.`}
        confirmText="Delete event"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </AdminPageShell>
  );
}
