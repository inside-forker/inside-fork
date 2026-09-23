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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CalendarClock,
  Users,
  MapPin,
  Image as ImageIcon,
  Ticket,
  FileCheck,
  ClipboardList,
  Eye,
  Sparkles,
  Building2,
  Tag,
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

// Stat card variant styles - match EventsManagementPage patterns
type StatVariant = "blue" | "orange" | "green" | "red" | "purple" | "yellow";

const statVariantStyles: Record<
  StatVariant,
  {
    card: string;
    title: string;
    value: string;
    iconWrapper: string;
    icon: string;
  }
> = {
  blue: {
    card: "bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors",
    value:
      "text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
    iconWrapper:
      "p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors",
    icon: "h-4 w-4 text-blue-600 dark:text-blue-400",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors",
    value:
      "text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors",
    iconWrapper:
      "p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors",
    icon: "h-4 w-4 text-orange-600 dark:text-orange-400",
  },
  green: {
    card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors",
    value:
      "text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors",
    iconWrapper:
      "p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors",
    icon: "h-4 w-4 text-green-600 dark:text-green-400",
  },
  red: {
    card: "bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0 border-red-500/30 dark:border-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-red-900 dark:text-red-100 group-hover:text-red-800 dark:group-hover:text-red-200 transition-colors",
    value:
      "text-2xl font-bold text-red-700 dark:text-red-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors",
    iconWrapper:
      "p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors",
    icon: "h-4 w-4 text-red-600 dark:text-red-400",
  },
  purple: {
    card: "bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors",
    value:
      "text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors",
    iconWrapper:
      "p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors",
    icon: "h-4 w-4 text-purple-600 dark:text-purple-400",
  },
  yellow: {
    card: "bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-yellow-500/5 dark:from-yellow-500/10 dark:via-yellow-500/5 dark:to-yellow-500/0 border-yellow-500/30 dark:border-yellow-500/20 hover:shadow-xl hover:shadow-yellow-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-yellow-900 dark:text-yellow-100 group-hover:text-yellow-800 dark:group-hover:text-yellow-200 transition-colors",
    value:
      "text-2xl font-bold text-yellow-700 dark:text-yellow-300 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors",
    iconWrapper:
      "p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors",
    icon: "h-4 w-4 text-yellow-600 dark:text-yellow-400",
  },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Action type configuration
const actionTypeConfig: Record<
  EventChangeAction,
  { icon: React.ReactNode; label: string; color: string; bgColor: string }
> = {
  create: {
    icon: <Plus className="h-4 w-4" />,
    label: "New Event",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/50",
  },
  update: {
    icon: <Edit2 className="h-4 w-4" />,
    label: "Update",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/50",
  },
  delete: {
    icon: <Trash2 className="h-4 w-4" />,
    label: "Delete",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/50",
  },
};

// Status badge component
function RequestStatusBadge({ status }: { status: EventChangeRequestStatus }) {
  const config: Record<
    EventChangeRequestStatus,
    {
      className: string;
      icon: React.ReactNode;
      label: string;
    }
  > = {
    pending: {
      className:
        "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending Review",
    },
    approved: {
      className:
        "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      className:
        "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
    },
  };

  const c = config[status];

  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

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

// Compact diff viewer component
function CompactDiffViewer({
  original,
  proposed,
  actionType,
}: {
  original: Record<string, unknown> | null;
  proposed: Record<string, unknown> | null;
  actionType: EventChangeAction;
}) {
  if (!proposed && actionType !== "delete") return null;

  const fieldsToShow = [
    { key: "name", label: "Event Name", icon: <Tag className="h-3.5 w-3.5" /> },
    {
      key: "start_time",
      label: "Start",
      icon: <Calendar className="h-3.5 w-3.5" />,
    },
    {
      key: "end_time",
      label: "End",
      icon: <CalendarClock className="h-3.5 w-3.5" />,
    },
    {
      key: "max_capacity",
      label: "Capacity",
      icon: <Users className="h-3.5 w-3.5" />,
    },
    {
      key: "status",
      label: "Status",
      icon: <FileCheck className="h-3.5 w-3.5" />,
    },
    {
      key: "require_guest_details",
      label: "Guest Details",
      icon: <ClipboardList className="h-3.5 w-3.5" />,
    },
  ];

  const diffs: EventChangeDiff[] = fieldsToShow.map((field) => {
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
      new_value: (newValue === undefined ? oldValue : newValue) as
        | string
        | number
        | boolean
        | null,
      changed,
    };
  });

  const relevantDiffs =
    actionType === "create"
      ? diffs.filter((d) => d.new_value !== null && d.new_value !== undefined)
      : diffs.filter((d) => d.changed);

  if (relevantDiffs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No changes detected
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {relevantDiffs.slice(0, 6).map((diff) => {
        const fieldConfig = fieldsToShow.find((f) => f.key === diff.field);
        return (
          <div
            key={diff.field}
            className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg text-xs"
          >
            <div className="mt-0.5 text-muted-foreground">
              {fieldConfig?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-muted-foreground">
                {diff.label}
              </span>
              <div className="mt-0.5">
                {actionType === "update" &&
                  original &&
                  diff.old_value !== null && (
                    <span className="text-rose-600 dark:text-rose-400 line-through mr-1.5">
                      {formatValue(diff.old_value)}
                    </span>
                  )}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatValue(diff.new_value)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Event Request Card Component
function EventRequestCard({
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
  const actionConfig =
    actionTypeConfig[request.action_type as EventChangeAction];
  const proposedData = request.proposed_data as EventProposedData | null;

  // Get temp images from proposed data if available
  const tempImages = (proposedData as Record<string, unknown> | null)
    ?.temp_images as Array<{ url: string; alt_text?: string }> | undefined;
  const primaryImage = tempImages?.[0]?.url;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group"
    >
      <Card className="overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
        <div className="flex flex-col lg:flex-row">
          {/* Image Section */}
          <div className="relative w-full lg:w-48 h-32 lg:h-auto bg-muted/30 flex-shrink-0">
            {primaryImage ? (
              <OptimizedImage
                src={primaryImage}
                alt={proposedData?.name || "Event"}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 192px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  <span className="text-xs">No image</span>
                </div>
              </div>
            )}
            {/* Action Type Badge */}
            <div className="absolute top-2 left-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${actionConfig.bgColor} ${actionConfig.color}`}
              >
                {actionConfig.icon}
                {actionConfig.label}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                    {request.action_type === "create"
                      ? proposedData?.name || "New Event"
                      : request.current_event_name || "Unknown Event"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Submitted{" "}
                      {format(new Date(request.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
                <RequestStatusBadge
                  status={request.status as EventChangeRequestStatus}
                />
              </div>

              {/* Organizer Info */}
              <div className="flex items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={request.organizer_avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {request.organizer_name?.charAt(0) || "O"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {request.organizer_name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{request.organizer_username || "unknown"}
                  </p>
                </div>
              </div>

              {/* Event Details Preview */}
              {request.action_type !== "delete" && proposedData && (
                <div className="mb-3">
                  <CompactDiffViewer
                    original={
                      request.original_data as Record<string, unknown> | null
                    }
                    proposed={
                      proposedData as unknown as Record<string, unknown>
                    }
                    actionType={request.action_type as EventChangeAction}
                  />
                </div>
              )}

              {/* Delete Warning */}
              {request.action_type === "delete" && (
                <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    This will permanently delete the event and all associated
                    data
                  </p>
                </div>
              )}

              {/* Review Notes (if reviewed) */}
              {request.review_notes && (
                <div className="mb-3 p-2.5 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Review Notes
                  </p>
                  <p className="text-xs">{request.review_notes}</p>
                  {request.reviewer_name && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      — {request.reviewer_name},{" "}
                      {format(new Date(request.reviewed_at!), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewDetails}
                  className="flex-1 h-8 text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  View Details
                </Button>
                {request.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={onApprove}
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onReject}
                      className="flex-1 h-8 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
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
            <div
              className={`p-2 rounded-lg ${
                actionTypeConfig[request.action_type as EventChangeAction]
                  .bgColor
              }`}
            >
              {actionTypeConfig[request.action_type as EventChangeAction].icon}
            </div>
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
                      <Badge className="absolute top-2 left-2 text-[10px]">
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
                        ? "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/20"
                        : "border-border/50 bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {field.icon}
                      <span className="font-medium">{field.label}</span>
                      {hasChanged && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] text-amber-600 border-amber-300"
                        >
                          Changed
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      {hasChanged && oldVal !== null && oldVal !== undefined && (
                        <div className="text-rose-600 dark:text-rose-400 line-through text-xs mb-0.5">
                          {formatValue(oldVal)}
                        </div>
                      )}
                      <div
                        className={
                          hasChanged
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
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

  // Refs for modals
  const reviewModalRef = React.useRef<HTMLDivElement>(null);

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

  // Apply CSS containment to review modal
  React.useEffect(() => {
    if (isReviewDialogOpen && reviewModalRef.current) {
      reviewModalRef.current.style.contain = "layout style paint";
      reviewModalRef.current.style.isolation = "isolate";
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

  // Stats cards configuration
  const statsCards = React.useMemo(
    () => [
      {
        key: "pending",
        label: "Pending Review",
        value: pendingCount,
        icon: Clock,
        color: "yellow" as StatVariant,
      },
      {
        key: "total",
        label: "Total Requests",
        value: totalCount,
        icon: ClipboardList,
        color: "blue" as StatVariant,
      },
      {
        key: "approved",
        label: "Approved",
        value: approvedCount,
        icon: CheckCircle2,
        color: "green" as StatVariant,
      },
      {
        key: "rejected",
        label: "Rejected",
        value: rejectedCount,
        icon: XCircle,
        color: "red" as StatVariant,
      },
    ],
    [pendingCount, totalCount, approvedCount, rejectedCount],
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Event Approval Queue
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Review and approve organizer event submissions. Verify event
            details, images, and ticket configurations before making them live.
          </p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {statsCards.map((card) => {
          const styles = statVariantStyles[card.color];
          const Icon = card.icon;

          return (
            <motion.div
              key={card.key}
              variants={itemVariants}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            >
              <Card className={styles.card}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={styles.title}>{card.label}</CardTitle>
                  <div className={styles.iconWrapper}>
                    <Icon className={styles.icon} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={styles.value}>
                    {card.value.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border/50 bg-gradient-to-r from-background/50 to-background/30 p-6 backdrop-blur-sm"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 p-1">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                placeholder="Search by organizer or event name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 bg-background/50 pl-11 pr-4 font-medium placeholder:font-normal border-border/50 focus:border-primary/50"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full border-border/50 bg-background/50 md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-11 w-full border-border/50 bg-background/50 md:w-44">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={fetchRequests}
            disabled={isLoading}
            className="h-11"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Requests Grid */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="w-full lg:w-48 h-32 bg-muted" />
                    <div className="flex-1 p-4 space-y-3">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-16 bg-muted rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Queue is Clear!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {statusFilter === "pending"
                  ? "All event change requests have been processed. New submissions will appear here."
                  : "No requests match your current filters. Try adjusting your search criteria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRequests.map((request) => (
              <EventRequestCard
                key={request.id}
                request={request}
                onApprove={() => openReviewDialog(request, "approve")}
                onReject={() => openReviewDialog(request, "reject")}
                onViewDetails={() => openDetailsDialog(request)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center gap-1 px-4">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "ghost"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && (
              <>
                <span className="px-2 text-muted-foreground">...</span>
                <Button
                  variant={currentPage === totalPages ? "default" : "ghost"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent ref={reviewModalRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Approve Request
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600" />
                  Reject Request
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "The changes will be applied immediately and the organizer will be notified."
                : "Please provide a reason. The organizer will receive your feedback."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRequest && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`p-1.5 rounded ${
                      actionTypeConfig[
                        selectedRequest.action_type as EventChangeAction
                      ].bgColor
                    }`}
                  >
                    {
                      actionTypeConfig[
                        selectedRequest.action_type as EventChangeAction
                      ].icon
                    }
                  </div>
                  <span className="font-medium capitalize text-sm">
                    {selectedRequest.action_type} Event
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(selectedRequest.proposed_data as EventProposedData | null)
                    ?.name || selectedRequest.current_event_name}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {reviewAction === "approve"
                  ? "Notes (optional)"
                  : "Rejection Reason *"}
              </label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === "approve"
                    ? "Add any notes for the organizer..."
                    : "Explain why this request is being rejected..."
                }
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={processRequest}
              disabled={isProcessing}
              className={
                reviewAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : ""
              }
            >
              {isProcessing && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              {reviewAction === "approve"
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <EventDetailsDialog
        request={detailsRequest}
        isOpen={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
      />
    </motion.div>
  );
}
