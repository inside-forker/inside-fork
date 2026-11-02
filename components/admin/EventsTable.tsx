"use client";

import * as React from "react";
import { CalendarDays, Eye, MapPin, MoreHorizontal, Pencil, Smartphone, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminAvatar, AdminDataTable, StatusBadge, type AdminColumn } from "@/components/admin/ui";
import type { AdminEvent, EventsTableProps } from "@/types/events.types";

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
const numFmt = new Intl.NumberFormat("en-PK");

function EventMenu({ event, onView, onDelete }: { event: AdminEvent; onView: () => void; onDelete: () => void }) {
  return (
    // Non-modal so opening it doesn't lock page scroll.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`More actions for ${event.event_name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-admin="" align="end" className="w-56">
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => {
            window.location.href = `/admin/events/${event.event_id}/device-allocation`;
          }}
        >
          <Smartphone aria-hidden="true" className="size-4" />
          Devices and gate staff
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onView}>
          <Eye aria-hidden="true" className="size-4" />
          View public page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={onDelete}>
          <Trash2 aria-hidden="true" className="size-4 text-destructive" />
          Delete event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Events list for /admin/events. Presentational: the page owns fetching, filters and paging. */
export function EventsTable({
  events,
  isLoading,
  onEditEvent,
  onViewEvent,
  onDeleteEvent,
  currentPage,
  pageSize,
  total,
  toolbar,
  hasFilters,
  onClearFilters,
  onCreateEvent,
  onPageChange,
}: EventsTableProps) {
  const columns: AdminColumn<AdminEvent>[] = [
    {
      id: "event",
      header: "Event",
      priority: 1,
      hideable: false,
      cell: (e) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{e.event_name}</span>
            {e.is_featured && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded bg-foreground px-2 text-xs font-medium text-background">
                <Star aria-hidden="true" className="size-3 fill-primary text-primary" />
                Featured
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 truncate text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{e.location_name || "Venue not set"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: (e) => (
        <div className="whitespace-nowrap tabular-nums">
          <div className="font-medium">{dayFmt.format(new Date(e.start_time))}</div>
          <div className="text-xs text-muted-foreground">{timeFmt.format(new Date(e.start_time))}</div>
        </div>
      ),
    },
    {
      id: "organizer",
      header: "Organizer",
      className: "hidden lg:table-cell",
      cell: (e) =>
        e.organizer_name ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <AdminAvatar name={e.organizer_name} src={e.organizer_avatar} size="sm" />
            {e.organizer_name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: "status", header: "Status", cell: (e) => <StatusBadge status={e.event_status} /> },
    {
      id: "capacity",
      header: "Capacity",
      align: "end",
      priority: 3,
      cell: (e) => (e.max_capacity ? numFmt.format(e.max_capacity) : <span className="text-muted-foreground">—</span>),
    },
  ];

  return (
    <AdminDataTable
      label="Events"
      rows={events}
      columns={columns}
      getRowId={(e) => String(e.event_id)}
      state={isLoading ? "loading" : "ready"}
      toolbar={toolbar}
      empty={{
        icon: CalendarDays,
        title: "No events yet",
        description: "Events you create, or that organizers submit, will show up here.",
        action: (
          <Button variant="solid" onClick={onCreateEvent}>
            New event
          </Button>
        ),
      }}
      filteredEmpty={hasFilters ? { title: "No events match these filters", onClear: onClearFilters } : undefined}
      onRowOpen={onEditEvent}
      rowActions={(e) => (
        <>
          <Button variant="outline" size="xs" onClick={() => onEditEvent(e)}>
            <Pencil />
            Edit
          </Button>
          <EventMenu event={e} onView={() => onViewEvent(e)} onDelete={() => onDeleteEvent(e)} />
        </>
      )}
      pagination={{ page: currentPage, pageSize, total, onPageChange, itemLabel: "events" }}
    />
  );
}
