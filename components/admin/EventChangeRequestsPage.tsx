"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  CalendarClock,
  Users,
  MapPin,
  Image as ImageIcon,
  Ticket,
  ClipboardList,
  Eye,
  Sparkles,
  Building2,
  Tag,
  Inbox,
  Clock,
  FileCheck,
  ArrowUpDown,
} from "lucide-react";
import type {
  EventChangeRequestWithDetails,
  EventChangeAction,
  EventChangeRequestStatus,
  EventChangeDiff,
  EventProposedData,
} from "@/types/event-change-request.types";
import { eventFieldValuesEqual } from "@/lib/events/mergeEventUpdateProposed";
import { format } from "date-fns";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  AdminAvatar,
  AdminFilterBar,
  AdminModal,
  AdminPageShell,
  DiffField,
  DiffGroup,
  EmptyState,
  FormField,
  Pagination,
  SegmentedControl,
  StatusBadge,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<EventChangeAction, string> = {
  create: "New event",
  update: "Update",
  delete: "Delete",
};

const STATUS_LABEL: Record<EventChangeRequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

// Format value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return format(new Date(value), "PPp");
      } catch {
        return value;
      }
    }
    return value.length > 80 ? `${value.substring(0, 80)}...` : value;
  }
  return String(value);
}

// Fields compared between the live event and the organizer's proposal.
const DIFF_FIELDS = [
  { key: "name", label: "Event name" },
  { key: "start_time", label: "Starts" },
  { key: "end_time", label: "Ends" },
  { key: "max_capacity", label: "Capacity" },
  { key: "status", label: "Status" },
  { key: "require_guest_details", label: "Guest details" },
] as const;

function buildDiffs(request: EventChangeRequestWithDetails): EventChangeDiff[] {
  const actionType = request.action_type as EventChangeAction;
  const original = request.original_data as Record<string, unknown> | null;
  const proposed = request.proposed_data as Record<string, unknown> | null;
  return DIFF_FIELDS.map((field) => {
    const oldValue = original ? original[field.key] : null;
    const newValue = proposed ? proposed[field.key] : null;
    const changed =
      actionType === "update"
        ? !eventFieldValuesEqual(field.key, oldValue, newValue)
        : !original || !eventFieldValuesEqual(field.key, oldValue, newValue);
    return {
      field: field.key,
      label: field.label,
      old_value: oldValue as string | number | boolean | null,
      new_value: (newValue === undefined ? oldValue : newValue) as string | number | boolean | null,
      changed,
    };
  });
}

function requestTitle(request: EventChangeRequestWithDetails) {
  const proposed = request.proposed_data as EventProposedData | null;
  return request.action_type === "create"
    ? proposed?.name || "New event"
    : request.current_event_name || "Unknown event";
}

function requestPoster(request: EventChangeRequestWithDetails) {
  const temp = (request.proposed_data as Record<string, unknown> | null)?.temp_images as
    | Array<{ url: string }>
    | undefined;
  return temp?.[0]?.url;
}

function RequestQueueItem({
  request,
  selected,
  onSelect,
}: {
  request: EventChangeRequestWithDetails;
  selected: boolean;
  onSelect: () => void;
}) {
  const poster = requestPoster(request);
  const changedCount =
    request.action_type === "update" ? buildDiffs(request).filter((d) => d.changed).length : null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "relative flex w-full gap-3 border-b px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50",
          selected && "bg-primary/5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary hover:bg-primary/5",
        )}
      >
        <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
          {poster ? (
            <OptimizedImage src={poster} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <ImageIcon aria-hidden="true" className="absolute inset-0 m-auto size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-data font-medium">{requestTitle(request)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex h-5 items-center rounded bg-muted px-2 font-medium text-foreground">
              {ACTION_LABEL[request.action_type as EventChangeAction]}
              {changedCount ? ` · ${changedCount} changes` : ""}
            </span>
            <span className="truncate">{request.organizer_name || "Unknown organizer"}</span>
            <span className="tabular-nums">{format(new Date(request.created_at), "d MMM, h:mm a")}</span>
          </div>
        </div>
      </button>
    </li>
  );
}

function RequestDetail({
  request,
  onApprove,
  onReject,
  onViewDetails,
}: {
  request: EventChangeRequestWithDetails;
  onApprove: () => void;
  onReject: () => void;
  onViewDetails: () => void;
}) {
  const actionType = request.action_type as EventChangeAction;
  const status = request.status as EventChangeRequestStatus;
  const poster = requestPoster(request);
  const diffs = buildDiffs(request);
  const rows =
    actionType === "create" ? diffs.filter((d) => d.new_value !== null && d.new_value !== undefined) : diffs;

  return (
    <section aria-labelledby="request-title" className="flex min-w-0 flex-col">
      <div className="border-b p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="request-title" className="text-xl font-semibold tracking-tight">
                {requestTitle(request)}
              </h2>
              <StatusBadge status={status} label={STATUS_LABEL[status]} />
              <span className="inline-flex h-5 items-center rounded bg-muted px-2 text-xs font-medium">{ACTION_LABEL[actionType]}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-data text-muted-foreground">
              <span className="flex items-center gap-2">
                <AdminAvatar name={request.organizer_name || "Organizer"} src={request.organizer_avatar} size="sm" />
                {request.organizer_name || "Unknown organizer"}
                {request.organizer_username && <span>@{request.organizer_username}</span>}
              </span>
              <span className="tabular-nums">Submitted {format(new Date(request.created_at), "EEE d MMM, h:mm a")}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            <Eye />
            Full details
          </Button>
        </div>
        {poster && (
          <div className="relative mt-6 aspect-video w-full max-w-md overflow-hidden rounded-lg border bg-muted">
            <OptimizedImage src={poster} alt={`Proposed poster for ${requestTitle(request)}`} fill className="object-cover" sizes="448px" />
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-6">
        {actionType === "delete" ? (
          <p className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-data">
            <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0 text-destructive" />
            Approving permanently deletes this event and everything attached to it.
          </p>
        ) : (
          <DiffGroup title={actionType === "create" ? "Submitted details" : "Changes"} icon={Clock}>
            {rows.length === 0 ? (
              <p className="border-t py-3 text-data text-muted-foreground">No changes detected.</p>
            ) : (
              rows.map((d) => (
                <DiffField
                  key={d.field}
                  label={d.label}
                  before={actionType === "create" ? null : formatValue(d.old_value)}
                  after={formatValue(d.new_value)}
                  changed={d.changed}
                />
              ))
            )}
          </DiffGroup>
        )}

        {request.review_notes && (
          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">Review notes</p>
            <p className="mt-1 text-data">{request.review_notes}</p>
            {request.reviewer_name && request.reviewed_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {request.reviewer_name}, {format(new Date(request.reviewed_at), "d MMM, h:mm a")}
              </p>
            )}
          </div>
        )}
      </div>

      {status === "pending" && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background px-6 py-3">
          <p className="mr-auto text-data text-muted-foreground">
            {actionType === "delete"
              ? "The organizer is asking to delete this event."
              : "Approving applies these changes and notifies the organizer."}
          </p>
          <Button variant="outline" onClick={onReject}>
            <XCircle />
            Reject…
          </Button>
          <Button variant="solid" onClick={onApprove}>
            <CheckCircle2 />
            Approve
          </Button>
        </div>
      )}
    </section>
  );
}

// Tickets Section Component
function TicketsSection({
  request,
}: {
  request: EventChangeRequestWithDetails;
}) {
  const [tickets, setTickets] = React.useState<
    Array<{
      id?: number;
      temp_id?: string;
      name: string;
      description?: string | null;
      price: number;
      quantity_available: number | null;
      max_per_person?: number;
      sale_starts_at: string;
      sale_ends_at: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const proposedData = request.proposed_data as EventProposedData | null;

  React.useEffect(() => {
    // If proposed data has tickets (for CREATE or UPDATE), use them as they represent the desired state
    if (proposedData?.temp_tickets && proposedData.temp_tickets.length > 0) {
      setTickets(proposedData.temp_tickets);
      return;
    }

    // Fallback: For UPDATE requests without ticket changes, fetch actual tickets from the database
    if (request.action_type === "update" && request.event_id) {
      setIsLoading(true);
      fetch(`/api/admin/events/${request.event_id}/tickets`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTickets(data.data.ticket_types || []);
          }
        })
        .catch((error) => {
          console.error("Error fetching tickets:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [request, proposedData]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          Ticket Types
        </h3>
        <div className="p-4 rounded-lg border bg-muted/20 text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">
            Loading tickets...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ticket className="h-4 w-4 text-primary" />
        Ticket Types
      </h3>
      {tickets && tickets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tickets.map((ticket, idx) => (
            <div
              key={ticket.temp_id || ticket.id || idx}
              className="p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{ticket.name}</span>
                <Badge variant="outline" className="text-xs">
                  PKR {ticket.price.toLocaleString()}
                </Badge>
              </div>
              {ticket.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {ticket.description}
                </p>
              )}
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span>{ticket.quantity_available || "Unlimited"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max per person:</span>
                  <span>{ticket.max_per_person || 10}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sale starts:</span>
                  <span>
                    {ticket.sale_starts_at
                      ? format(new Date(ticket.sale_starts_at), "PP")
                      : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sale ends:</span>
                  <span>
                    {ticket.sale_ends_at
                      ? format(new Date(ticket.sale_ends_at), "PP")
                      : "Not set"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 text-center">
          <Ticket className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No ticket types defined
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {request.action_type === "create"
              ? "Organizer can add tickets after event is approved"
              : "No tickets found for this event"}
          </p>
        </div>
      )}
    </div>
  );
}

// Full Details Dialog Component
function EventDetailsDialog({
  request,
  isOpen,
  onClose,
}: {
  request: EventChangeRequestWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Prevent scroll lock layout shift
  React.useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  // Apply CSS containment
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
    }
  }, [isOpen]);

  if (!request) return null;

  const proposedData = request.proposed_data as EventProposedData | null;
  const originalData = request.original_data as Record<string, unknown> | null;

  // Get temp images
  const tempImages = (proposedData as Record<string, unknown> | null)
    ?.temp_images as Array<{ url: string; alt_text?: string }> | undefined;

  const allFields = [
    { key: "name", label: "Event Name", icon: <Tag className="h-4 w-4" /> },
    {
      key: "description",
      label: "Description",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      key: "start_time",
      label: "Start Date & Time",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      key: "end_time",
      label: "End Date & Time",
      icon: <CalendarClock className="h-4 w-4" />,
    },
    {
      key: "location_name",
      label: "Location",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: "address",
      label: "Address",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: "category_id",
      label: "Category",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      key: "max_capacity",
      label: "Maximum Capacity",
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: "status",
      label: "Status",
      icon: <FileCheck className="h-4 w-4" />,
    },
    {
      key: "is_featured",
      label: "Featured Event",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      key: "require_guest_details",
      label: "Require Guest Details",
      icon: <ClipboardList className="h-4 w-4" />,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        ref={modalRef}
        className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-xl">
                {request.action_type === "create"
                  ? "New Event Request"
                  : request.action_type === "update"
                    ? "Event Update Request"
                    : "Event Deletion Request"}
              </DialogTitle>
              <DialogDescription>
                Submitted by {request.organizer_name || "Unknown"} on{" "}
                {format(new Date(request.created_at), "PPP")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Images Section */}
          {tempImages && tempImages.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Event Images ({tempImages.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tempImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-lg overflow-hidden border bg-muted"
                  >
                    <OptimizedImage
                      src={img.url}
                      alt={img.alt_text || `Event image ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                    {idx === 0 && (
                      <Badge className="absolute top-2 left-2 text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              {request.action_type === "update"
                ? "Proposed Changes"
                : "Event Details"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allFields.map((field) => {
                const oldVal = originalData ? originalData[field.key] : null;
                const rawNewVal = proposedData
                  ? (proposedData as unknown as Record<string, unknown>)[
                      field.key
                    ]
                  : null;
                const hasChanged =
                  request.action_type === "update" &&
                  !eventFieldValuesEqual(field.key, oldVal, rawNewVal);
                // Missing keys on update mean "unchanged" — show the current value.
                const newVal =
                  request.action_type === "update" && rawNewVal === undefined
                    ? oldVal
                    : rawNewVal;

                if (
                  request.action_type === "create" &&
                  (newVal === null || newVal === undefined)
                ) {
                  return null;
                }

                return (
                  <div
                    key={field.key}
                    className={`p-3 rounded-lg border ${
                      hasChanged
                        ? "border-warning/30 bg-warning/5"
                        : "border-border/50 bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {field.icon}
                      <span className="font-medium">{field.label}</span>
                      {hasChanged && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-xs text-warning border-warning/30"
                        >
                          Changed
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      {hasChanged && oldVal !== null && oldVal !== undefined && (
                        <div className="text-muted-foreground line-through text-xs mb-1">
                          {formatValue(oldVal)}
                        </div>
                      )}
                      <div
                        className={
                          hasChanged
                            ? "text-foreground font-medium"
                            : ""
                        }
                      >
                        {formatValue(newVal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tickets Section */}
          <TicketsSection request={request} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventChangeRequestsPage() {
  const [requests, setRequests] = React.useState<
    EventChangeRequestWithDetails[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Stats
  const [pendingCount, setPendingCount] = React.useState(0);
  const [approvedCount, setApprovedCount] = React.useState(0);
  const [rejectedCount, setRejectedCount] = React.useState(0);

  // Review dialog state
  const [isReviewDialogOpen, setIsReviewDialogOpen] = React.useState(false);
  const [reviewAction, setReviewAction] = React.useState<
    "approve" | "reject" | null
  >(null);
  const [selectedRequest, setSelectedRequest] =
    React.useState<EventChangeRequestWithDetails | null>(null);
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Details dialog
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
  const [detailsRequest, setDetailsRequest] =
    React.useState<EventChangeRequestWithDetails | null>(null);

  const { toast } = useToast();

  // Prevent scroll lock layout shift on review dialog
  React.useEffect(() => {
    if (isReviewDialogOpen) {
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
  }, [isReviewDialogOpen]);

  // Fetch requests
  const fetchRequests = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        page: currentPage.toString(),
        limit: "12",
      });

      if (actionFilter !== "all") {
        params.append("action_type", actionFilter);
      }

      const response = await fetch(`/api/admin/events/approvals?${params}`);
      const result = await response.json();

      if (result.success) {
        setRequests(result.data.requests || []);
        setTotalPages(result.data.pagination.totalPages || 1);
        setTotalCount(result.data.pagination.total || 0);
        setPendingCount(result.data.pendingCount || 0);
        setApprovedCount(result.data.approvedCount || 0);
        setRejectedCount(result.data.rejectedCount || 0);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Fetch requests error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch change requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, actionFilter, currentPage, toast]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filter by search
  const filteredRequests = React.useMemo(() => {
    if (!searchQuery) return requests;

    return requests.filter(
      (req) =>
        req.organizer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.proposed_event_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        req.current_event_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [requests, searchQuery]);

  // Open review dialog
  const openReviewDialog = (
    request: EventChangeRequestWithDetails,
    action: "approve" | "reject",
  ) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes("");
    setIsReviewDialogOpen(true);
  };

  // Open details dialog
  const openDetailsDialog = (request: EventChangeRequestWithDetails) => {
    setDetailsRequest(request);
    setIsDetailsDialogOpen(true);
  };

  // Process the request
  const processRequest = async () => {
    if (!selectedRequest || !reviewAction) return;

    if (reviewAction === "reject" && !reviewNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/admin/events/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: reviewAction,
          review_notes: reviewNotes || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title:
            reviewAction === "approve"
              ? "Request Approved"
              : "Request Rejected",
          description: result.data.message,
        });
        setIsReviewDialogOpen(false);
        fetchRequests();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Process request error:", error);
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const [selectedId, setSelectedId] = React.useState<string | number | null>(null);
  const selected = filteredRequests.find((r) => r.id === selectedId) ?? filteredRequests[0] ?? null;

  const statusOptions = [
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  return (
    <AdminPageShell
      eyebrow="Events & ticketing"
      title="Event approvals"
      description="Organizer changes wait here. Nothing goes live until it's approved."
      actions={
        <Button variant="outline" onClick={fetchRequests} loading={isLoading}>
          <RefreshCw />
          Refresh
        </Button>
      }
      metrics={[
        { label: "Pending review", value: pendingCount, emphasis: pendingCount > 0 },
        { label: "Approved", value: approvedCount.toLocaleString() },
        { label: "Rejected", value: rejectedCount.toLocaleString() },
        { label: "In this view", value: totalCount.toLocaleString() },
      ]}
      tabs={
        <SegmentedControl
          label="Request status"
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
          options={statusOptions}
        />
      }
    >
      <div className="grid min-w-0 overflow-clip rounded-lg border bg-card lg:grid-cols-[theme(spacing.96)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col border-b lg:border-b-0 lg:border-r">
          <AdminFilterBar
            search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search requests" }}
            facets={[
              {
                id: "action",
                label: "Type",
                single: true,
                selected: actionFilter === "all" ? [] : [actionFilter],
                onChange: (values) => {
                  setActionFilter(values[0] ?? "all");
                  setCurrentPage(1);
                },
                options: [
                  { value: "create", label: "New event" },
                  { value: "update", label: "Update" },
                  { value: "delete", label: "Delete" },
                ],
              },
            ]}
          />
          {isLoading ? (
            <ul aria-busy="true" aria-label="Loading requests">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex gap-3 border-b px-4 py-3">
                  <div className="size-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                  </div>
                </li>
              ))}
            </ul>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={statusFilter === "pending" && !searchQuery ? CheckCircle2 : Inbox}
              title={statusFilter === "pending" && !searchQuery ? "Queue is clear" : "No requests match"}
              description={
                statusFilter === "pending" && !searchQuery
                  ? "Every change request has been handled. New submissions will appear here."
                  : "Try another status, type or search."
              }
            />
          ) : (
            <ul aria-label="Change requests" className="max-h-[70vh] overflow-y-auto">
              {filteredRequests.map((request) => (
                <RequestQueueItem
                  key={request.id}
                  request={request}
                  selected={selected?.id === request.id}
                  onSelect={() => setSelectedId(request.id)}
                />
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              pageSize={12}
              total={totalCount}
              onPageChange={setCurrentPage}
              itemLabel="requests"
              className="mt-auto"
            />
          )}
        </div>

        {selected && !isLoading ? (
          <RequestDetail
            request={selected}
            onApprove={() => openReviewDialog(selected, "approve")}
            onReject={() => openReviewDialog(selected, "reject")}
            onViewDetails={() => openDetailsDialog(selected)}
          />
        ) : (
          <div className="hidden lg:block">
            <EmptyState icon={Inbox} title="Pick a request" description="Its changes show up here." />
          </div>
        )}
      </div>

      <AdminModal
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        title={reviewAction === "approve" ? "Approve this request?" : "Reject this request?"}
        description={
          selectedRequest
            ? `${ACTION_LABEL[selectedRequest.action_type as EventChangeAction]}: ${requestTitle(selectedRequest)}. ` +
              (reviewAction === "approve"
                ? "The changes apply right away and the organizer is notified."
                : "The organizer sees your reason and can resubmit.")
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === "approve" ? "solid" : "destructive"}
              onClick={processRequest}
              loading={isProcessing}
            >
              {reviewAction === "approve" ? "Approve" : "Reject request"}
            </Button>
          </>
        }
      >
        <FormField
          label={reviewAction === "approve" ? "Note for the organizer" : "Reason"}
          optional={reviewAction === "approve"}
          hint={reviewAction === "reject" ? "Required. The organizer sees this." : undefined}
        >
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder={
              reviewAction === "approve"
                ? "Anything the organizer should know"
                : "e.g. The poster text is unreadable"
            }
            rows={4}
            className="resize-none"
          />
        </FormField>
      </AdminModal>

      <EventDetailsDialog
        request={detailsRequest}
        isOpen={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
      />
    </AdminPageShell>
  );
}
