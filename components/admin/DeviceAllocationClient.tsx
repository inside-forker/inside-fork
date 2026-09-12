"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Smartphone,
  Users,
  RefreshCw,
  ArrowLeft,
  Search,
  CheckCircle2,
  UserPlus,
  Link as LinkIcon,
  Download,
  Trash2,
  Sliders,
  Copy,
  Check,
  Mail,
  Phone,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface TicketItem {
  id: number;
  code: string;
  status: string;
  guestName: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  bookingCode: string;
  bookingId: number;
  ticketTypeId: number | null;
  ticketTypeName: string;
  ticketPrice: number;
  assignedDeviceIndex: number | null;
  checkedInAt: string | null;
  isCheckedIn: boolean;
}

interface DeviceSlot {
  deviceIndex: number;
  deviceNumber: number;
  label: string;
  assignedOperator: {
    operatorId: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    deviceLabel: string;
  } | null;
  assignedTicketsCount: number;
  checkedInCount: number;
  percentage: number;
}

interface EventData {
  id: number;
  name: string;
  location: string | null;
  startTime: string;
  endTime: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  organizerCompany: string | null;
  scanningMode: "single" | "multi_gate";
  totalDevices: number;
}

interface OperatorOption {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  isLinkedToEventOrganizer: boolean;
}

export function DeviceAllocationClient({ eventId }: { eventId: number }) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [eventData, setEventData] = React.useState<EventData | null>(null);
  const [deviceSlots, setDeviceSlots] = React.useState<DeviceSlot[]>([]);
  const [tickets, setTickets] = React.useState<TicketItem[]>([]);
  const [summary, setSummary] = React.useState<{
    totalTickets: number;
    totalCheckedInCount: number;
    unassignedCount: number;
    isFullyAssigned: boolean;
  }>({ totalTickets: 0, totalCheckedInCount: 0, unassignedCount: 0, isFullyAssigned: false });

  // Filtering & Search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [deviceFilter, setDeviceFilter] = React.useState<string>("all"); // 'all', 'unassigned', '0', '1', etc.
  const [statusFilter, setStatusFilter] = React.useState<string>("all"); // 'all', 'checked_in', 'pending'

  // Multi-select for bulk assign
  const [selectedTicketIds, setSelectedTicketIds] = React.useState<number[]>([]);

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = React.useState(false);
  const [configMode, setConfigMode] = React.useState<"single" | "multi_gate">("single");
  const [configDevices, setConfigDevices] = React.useState<string>("2");
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);

  // Operator modal state
  const [isCreateOperatorModalOpen, setIsCreateOperatorModalOpen] = React.useState(false);
  const [isLinkOperatorModalOpen, setIsLinkOperatorModalOpen] = React.useState(false);
  const [targetDeviceIndex, setTargetDeviceIndex] = React.useState<number>(0);
  const [availableOperators, setAvailableOperators] = React.useState<OperatorOption[]>([]);
  const [loadingOperators, setLoadingOperators] = React.useState(false);

  // Create Operator Form
  const [operatorForm, setOperatorForm] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [isSubmittingOperator, setIsSubmittingOperator] = React.useState(false);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Fetch Page Data
  const fetchData = React.useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const res = await fetch(`/api/admin/events/${eventId}/device-allocation`);
        const result = await res.json();
        if (result.success) {
          setEventData(result.data.event);
          setDeviceSlots(result.data.deviceSlots);
          setTickets(result.data.tickets);
          setSummary(result.data.summary);
          setConfigMode(result.data.event.scanningMode);
          setConfigDevices(result.data.event.totalDevices.toString());
        } else {
          toast({
            title: "Error loading device allocation",
            description: result.error,
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Network error",
          description: "Could not retrieve allocation data",
          variant: "destructive",
        });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [eventId, toast],
  );

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Available Operators
  const fetchAvailableOperators = async () => {
    try {
      setLoadingOperators(true);
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation/operators`);
      const result = await res.json();
      if (result.success) {
        setAvailableOperators(result.data.operators || []);
      }
    } catch (err) {
      console.error("Failed to load operators", err);
    } finally {
      setLoadingOperators(false);
    }
  };

  // Open Link Operator modal
  const handleOpenLinkOperator = (deviceIndex: number) => {
    setTargetDeviceIndex(deviceIndex);
    fetchAvailableOperators();
    setIsLinkOperatorModalOpen(true);
  };

  // Open Create Operator modal
  const handleOpenCreateOperator = (deviceIndex: number) => {
    setTargetDeviceIndex(deviceIndex);
    setOperatorForm({
      fullName: "",
      email: "",
      phone: "",
      password: `Pass${Math.floor(100000 + Math.random() * 900000)}!`,
    });
    setCreatedCredentials(null);
    setIsCreateOperatorModalOpen(true);
  };

  // Submit Create Operator
  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorForm.fullName.trim() || !operatorForm.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name and email are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingOperator(true);
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation/operators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: operatorForm.fullName,
          email: operatorForm.email,
          phone: operatorForm.phone,
          password: operatorForm.password,
          device_index: targetDeviceIndex,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setCreatedCredentials({
          email: result.data.credentials.email,
          password: result.data.credentials.password,
          name: result.data.operator.name,
        });
        toast({
          title: "Operator Account Created 🎉",
          description: `Assigned to Device ${targetDeviceIndex + 1}`,
        });
        fetchData(true);
      } else {
        toast({
          title: "Failed to create operator",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Creation failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOperator(false);
    }
  };

  // Link Existing Operator
  const handleLinkOperator = async (operatorId: string | null) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_operator",
          device_index: targetDeviceIndex,
          operator_id: operatorId,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Operator Updated",
          description: result.message,
        });
        setIsLinkOperatorModalOpen(false);
        fetchData(true);
      } else {
        toast({
          title: "Update failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Network error",
        description: "Failed to update operator assignment",
        variant: "destructive",
      });
    }
  };

  // Save Architecture Configuration
  const handleSaveArchitecture = async () => {
    try {
      setIsSavingConfig(true);
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_architecture",
          scanning_mode: configMode,
          total_devices: parseInt(configDevices, 10) || 2,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Configuration Saved",
          description: result.message,
        });
        setIsConfigModalOpen(false);
        fetchData(false);
      } else {
        toast({
          title: "Error saving config",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error saving config",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Assign Ticket Pass to Device
  const handleAssignTicket = async (ticketId: number, deviceIndex: number | null) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_tickets",
          ticket_pass_ids: [ticketId],
          assigned_device_index: deviceIndex,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, assignedDeviceIndex: deviceIndex } : t,
          ),
        );
        fetchData(true);
      } else {
        toast({
          title: "Assignment failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk Assign Selected Tickets
  const handleBatchAssign = async (deviceIndex: number | null) => {
    if (selectedTicketIds.length === 0) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_tickets",
          ticket_pass_ids: selectedTicketIds,
          assigned_device_index: deviceIndex,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Batch Update Successful",
          description: `Assigned ${selectedTicketIds.length} tickets to ${
            deviceIndex !== null ? `Device ${deviceIndex + 1}` : "Unassigned"
          }`,
        });
        setSelectedTicketIds([]);
        fetchData(true);
      } else {
        toast({
          title: "Batch update failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-Distribute Evenly
  const handleAutoDistribute = async (onlyUnassigned = false) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_distribute",
          only_unassigned: onlyUnassigned,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Auto-Distribution Complete ✨",
          description: result.message,
        });
        fetchData(true);
      } else {
        toast({
          title: "Distribution failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear All
  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to reset all attendee device assignments?")) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all_assignments" }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Assignments Reset",
          description: "All tickets are now unassigned",
        });
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (tickets.length === 0) return;
    const headers = [
      "Ticket Code",
      "Guest / Attendee Name",
      "Customer Phone",
      "Customer Email",
      "Ticket Type",
      "Assigned Device",
      "Check-in Status",
      "Checked In At",
    ];

    const rows = tickets.map((t) => [
      t.code,
      `"${(t.guestName || "").replace(/"/g, '""')}"`,
      `"${t.customerPhone || ""}"`,
      `"${t.customerEmail || ""}"`,
      `"${t.ticketTypeName}"`,
      t.assignedDeviceIndex !== null ? `Device ${t.assignedDeviceIndex + 1}` : "Unassigned",
      t.isCheckedIn ? "Checked In" : "Pending",
      t.checkedInAt || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `event_${eventId}_device_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered Tickets
  const filteredTickets = React.useMemo(() => {
    return tickets.filter((ticket) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ticket.guestName.toLowerCase().includes(q) ||
          ticket.customerName.toLowerCase().includes(q) ||
          ticket.code.toLowerCase().includes(q) ||
          ticket.bookingCode.toLowerCase().includes(q) ||
          (ticket.customerPhone && ticket.customerPhone.includes(q)) ||
          ticket.ticketTypeName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Device filter
      if (deviceFilter === "unassigned") {
        if (ticket.assignedDeviceIndex !== null) return false;
      } else if (deviceFilter !== "all") {
        const targetDev = parseInt(deviceFilter, 10);
        if (ticket.assignedDeviceIndex !== targetDev) return false;
      }

      // Status filter
      if (statusFilter === "checked_in" && !ticket.isCheckedIn) return false;
      if (statusFilter === "pending" && ticket.isCheckedIn) return false;

      return true;
    });
  }, [tickets, searchQuery, deviceFilter, statusFilter]);

  // Select all toggle
  const handleSelectAll = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(filteredTickets.map((t) => t.id));
    }
  };

  const handleToggleSelectTicket = (id: number) => {
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading Device & Operator Allocation...</p>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Event Not Found</h2>
        <Button onClick={() => router.push("/admin/events")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Events
        </Button>
      </div>
    );
  }

  const isMultiDevice = eventData.scanningMode === "multi_gate" && eventData.totalDevices > 1;

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Navigation */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-muted/30 to-background p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/admin/events" className="hover:text-primary transition-colors">
                Events
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium truncate max-w-[250px]">
                {eventData.name}
              </span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-primary font-medium">Device Allocation</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {eventData.name}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isMultiDevice
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isMultiDevice
                  ? `⚡ ${eventData.totalDevices}-Device Verification Mode`
                  : "Single Scanner Device Mode"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Organizer: <strong className="text-foreground">{eventData.organizerName}</strong> •{" "}
              {eventData.location || "Venue TBD"} • {summary.totalTickets} total attendees
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigModalOpen(true)}
              className="border-primary/30 hover:bg-primary/5 text-foreground"
            >
              <Sliders className="h-4 w-4 mr-2 text-primary" />
              Configure Architecture
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(false)}
              className="hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              disabled={tickets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Roster
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Device Slots & Operators Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Verification Devices & Scanner Operators
            </h2>
            <p className="text-sm text-muted-foreground">
              Each device scans its assigned attendee slice offline. Link or create scanner accounts for each device slot.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {deviceSlots.map((slot) => {
            const hasOperator = !!slot.assignedOperator;
            return (
              <Card
                key={slot.deviceIndex}
                className="relative overflow-hidden border border-border/80 bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 to-primary/30" />
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          D{slot.deviceNumber}
                        </span>
                        <CardTitle className="text-base font-bold text-foreground">
                          {slot.label}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Assigned Attendees: <strong>{slot.assignedTicketsCount}</strong> ({slot.percentage}%)
                      </CardDescription>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-[11px] font-semibold bg-primary/10 text-primary border-transparent"
                    >
                      {slot.checkedInCount} Checked In
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 space-y-1">
                    <Progress
                      value={
                        slot.assignedTicketsCount > 0
                          ? (slot.checkedInCount / slot.assignedTicketsCount) * 100
                          : 0
                      }
                      className="h-1.5"
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Operator Info Sub-card */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Scanner Operator</span>
                      {hasOperator && (
                        <span className="inline-flex items-center text-green-600 dark:text-green-400 font-medium text-[10px]">
                          ● Active Link
                        </span>
                      )}
                    </div>

                    {hasOperator ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={slot.assignedOperator?.avatar || ""} />
                          <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
                            {slot.assignedOperator?.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {slot.assignedOperator?.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {slot.assignedOperator?.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-muted-foreground">
                        <p className="italic">No operator account linked yet</p>
                      </div>
                    )}
                  </div>

                  {/* Actions for this device */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateOperator(slot.deviceIndex)}
                      className="text-xs h-8 px-2 font-medium"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1 text-primary" />
                      + New Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLinkOperator(slot.deviceIndex)}
                      className="text-xs h-8 px-2 font-medium"
                    >
                      <LinkIcon className="h-3.5 w-3.5 mr-1" />
                      {hasOperator ? "Change" : "Link Existing"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Attendee Distribution & Assignment Table */}
      <Card className="border border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Attendee Device Allocation
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Assign attendees to Device 1, Device 2, or use one-click distribution tools below.
              </CardDescription>
            </div>

            {/* Quick Bulk Distribution Actions */}
            {isMultiDevice && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAutoDistribute(false)}
                  className="text-xs shadow-sm bg-primary text-primary-foreground font-medium"
                >
                  ⚡ Auto-Distribute Evenly
                </Button>
                {summary.unassignedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAutoDistribute(true)}
                    className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                  >
                    Assign Unassigned ({summary.unassignedCount})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              </div>
            )}
          </div>

          {/* Allocation Breakdown Progress */}
          <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-2.5 rounded-lg bg-background border border-border/60">
              <span className="text-muted-foreground">Total Attendees</span>
              <p className="text-base font-bold text-foreground mt-0.5">{summary.totalTickets}</p>
            </div>
            {deviceSlots.map((d) => (
              <div key={d.deviceIndex} className="p-2.5 rounded-lg bg-background border border-border/60">
                <span className="text-muted-foreground">Device {d.deviceNumber} Slice</span>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {d.assignedTicketsCount}{" "}
                  <span className="text-xs text-muted-foreground font-normal">({d.percentage}%)</span>
                </p>
              </div>
            ))}
            <div className="p-2.5 rounded-lg bg-background border border-border/60">
              <span className="text-muted-foreground">Unassigned Attendees</span>
              <p
                className={`text-base font-bold mt-0.5 ${
                  summary.unassignedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600"
                }`}
              >
                {summary.unassignedCount}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Search, Filter Tabs & Batch Selection Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search attendee, booking code, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDeviceFilter("all")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    deviceFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  All ({tickets.length})
                </button>
                {deviceSlots.map((d) => (
                  <button
                    key={d.deviceIndex}
                    type="button"
                    onClick={() => setDeviceFilter(d.deviceIndex.toString())}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      deviceFilter === d.deviceIndex.toString()
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    Dev {d.deviceNumber} ({d.assignedTicketsCount})
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDeviceFilter("unassigned")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    deviceFilter === "unassigned"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  Unassigned ({summary.unassignedCount})
                </button>
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue placeholder="Check-in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Batch Actions Banner if items selected */}
          {selectedTicketIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {selectedTicketIds.length} attendees selected
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Assign selection to:</span>
                {deviceSlots.map((d) => (
                  <Button
                    key={d.deviceIndex}
                    size="sm"
                    variant="outline"
                    onClick={() => handleBatchAssign(d.deviceIndex)}
                    className="h-7 text-xs bg-background hover:bg-primary/10"
                  >
                    Device {d.deviceNumber}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBatchAssign(null)}
                  className="h-7 text-xs text-muted-foreground hover:text-red-600"
                >
                  Unassign
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTicketIds([])}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {/* Attendees Table */}
          <div className="rounded-xl border border-border overflow-hidden bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredTickets.length > 0 &&
                          selectedTicketIds.length === filteredTickets.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="p-3">Attendee</th>
                    <th className="p-3">Booking / Pass Code</th>
                    <th className="p-3">Ticket Tier</th>
                    <th className="p-3">Check-in Status</th>
                    <th className="p-3 text-right">Assigned Device Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No attendees match the filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const isSelected = selectedTicketIds.includes(ticket.id);
                      return (
                        <tr
                          key={ticket.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectTicket(ticket.id)}
                              className="rounded border-border"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">
                              {ticket.guestName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              {ticket.customerPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {ticket.customerPhone}
                                </span>
                              )}
                              {ticket.customerEmail && (
                                <span className="flex items-center gap-1 truncate max-w-[150px]">
                                  <Mail className="h-3 w-3" /> {ticket.customerEmail}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div className="text-foreground font-semibold">{ticket.code}</div>
                            <div className="text-muted-foreground text-[11px]">{ticket.bookingCode}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {ticket.ticketTypeName}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {ticket.isCheckedIn ? (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                                Checked In
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-muted-foreground font-normal">
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {/* Inline Device Selector */}
                            <Select
                              value={
                                ticket.assignedDeviceIndex !== null
                                  ? ticket.assignedDeviceIndex.toString()
                                  : "unassigned"
                              }
                              onValueChange={(val) =>
                                handleAssignTicket(
                                  ticket.id,
                                  val === "unassigned" ? null : parseInt(val, 10),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px] ml-auto text-xs bg-background font-medium">
                                <SelectValue placeholder="Assign Device" />
                              </SelectTrigger>
                              <SelectContent align="end">
                                <SelectItem value="unassigned">
                                  <span className="text-muted-foreground">Unassigned</span>
                                </SelectItem>
                                {deviceSlots.map((d) => (
                                  <SelectItem key={d.deviceIndex} value={d.deviceIndex.toString()}>
                                    <span className="font-semibold text-primary">
                                      Device {d.deviceNumber}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Configuration Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Event Verification Architecture
            </DialogTitle>
            <DialogDescription>
              Configure how tickets will be verified at the venue on mobile scanners.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Verification Architecture</Label>
              <Select
                value={configMode}
                onValueChange={(val: "single" | "multi_gate") => setConfigMode(val)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Scanner Device (1 Device for all)</SelectItem>
                  <SelectItem value="multi_gate">
                    Multi-Device Verification (Anti-Fraud Slice)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {configMode === "multi_gate" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Total Verification Devices</Label>
                <Select value={configDevices} onValueChange={setConfigDevices}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Devices (Device 1 & Device 2)</SelectItem>
                    <SelectItem value="3">3 Devices (Device 1, 2 & 3)</SelectItem>
                    <SelectItem value="4">4 Devices</SelectItem>
                    <SelectItem value="5">5 Devices</SelectItem>
                    <SelectItem value="6">6 Devices</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each device operates offline independently. Attendees are exclusively checked into their assigned device lane.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveArchitecture} disabled={isSavingConfig}>
              {isSavingConfig ? "Saving..." : "Save Architecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Create Operator Account Modal */}
      <Dialog open={isCreateOperatorModalOpen} onOpenChange={setIsCreateOperatorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create Scanner Operator Account
            </DialogTitle>
            <DialogDescription>
              Create an operator account and immediately link them to <strong>Device {targetDeviceIndex + 1}</strong>.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Account Created & Assigned!
                </div>
                <p className="text-xs text-muted-foreground">
                  Hand these credentials over to the gate passer / scanning staff for Device {targetDeviceIndex + 1}:
                </p>

                <div className="space-y-2 text-xs font-mono bg-background p-3 rounded-lg border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-semibold text-foreground">{createdCredentials.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Password:</span>
                    <span className="font-semibold text-primary">{createdCredentials.password}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() =>
                    copyToClipboard(
                      `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`,
                      "creds",
                    )
                  }
                >
                  {copiedKey === "creds" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" /> Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" /> Copy Credentials
                    </>
                  )}
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsCreateOperatorModalOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateOperator} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Operator Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Ali Khan"
                  value={operatorForm.fullName}
                  onChange={(e) =>
                    setOperatorForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Operator Email *</Label>
                <Input
                  required
                  type="email"
                  placeholder="operator@event.com"
                  value={operatorForm.email}
                  onChange={(e) =>
                    setOperatorForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone (Optional)</Label>
                <Input
                  placeholder="03001234567"
                  value={operatorForm.phone}
                  onChange={(e) =>
                    setOperatorForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Password</Label>
                <Input
                  value={operatorForm.password}
                  onChange={(e) =>
                    setOperatorForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Auto-generated secure password. Operator can change it later.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOperatorModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingOperator}>
                  {isSubmittingOperator ? "Creating..." : `Create & Assign to Device ${targetDeviceIndex + 1}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Link Existing Operator Modal */}
      <Dialog open={isLinkOperatorModalOpen} onOpenChange={setIsLinkOperatorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Link Operator to Device {targetDeviceIndex + 1}
            </DialogTitle>
            <DialogDescription>
              Select an existing Scanner Operator account to handle this device slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[350px] overflow-y-auto">
            {loadingOperators ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground mt-2">Loading operators...</p>
              </div>
            ) : availableOperators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No scanner operator accounts found.</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setIsLinkOperatorModalOpen(false);
                    handleOpenCreateOperator(targetDeviceIndex);
                  }}
                  className="mt-2"
                >
                  + Create a new operator account now
                </Button>
              </div>
            ) : (
              availableOperators.map((op) => (
                <div
                  key={op.id}
                  onClick={() => handleLinkOperator(op.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={op.avatar || ""} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {op.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{op.name}</p>
                      <p className="text-xs text-muted-foreground">{op.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-primary">
                    Select
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleLinkOperator(null)}
              className="text-xs"
            >
              Unlink Operator
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLinkOperatorModalOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
