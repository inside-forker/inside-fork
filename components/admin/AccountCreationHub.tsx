"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Shield,
  Building,
  Search,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserCheck,
  Globe,
  Phone,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  KeyRound,
  BadgeCheck,
  Smartphone,
  Calendar,
  Layers,
  ArrowRight,
  Sliders,
  Download,
  Trash2,
  Edit2,
  Link as LinkIcon,
  Check,
  ChevronDown,
  MapPin,
  Clock,
  Ticket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { EOProfilePreviewCard } from "@/components/admin/EOProfilePreviewCard";

// ================= TYPES =================

interface EventSummaryOption {
  event_id: number;
  event_name: string;
  organizer_id: string;
  organizer_name: string;
  start_time: string;
  location_name: string | null;
  total_gates: number;
  scanning_mode: string;
}

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
  assignedDeviceLabel: string | null;
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
    email: string | null;
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
  organizerEmail: string | null;
  organizerCompany: string | null;
  scanningMode: "single" | "multi_gate";
  totalDevices: number;
}

interface OperatorOption {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  isLinkedToEventOrganizer: boolean;
}

interface AccountCreationHubProps {
  initialEventId?: number;
  initialTab?: string;
}

export function AccountCreationHub({
  initialEventId,
  initialTab = "gates",
}: AccountCreationHubProps) {
  const { toast } = useToast();

  // Active Tab: "gates" | "staff" | "create-staff" | "organizer-profile"
  const [activeTab, setActiveTab] = useState<string>(initialTab === "allocation" ? "gates" : initialTab);

  // Events List for Selector
  const [eventsList, setEventsList] = useState<EventSummaryOption[]>([]);
  const [isLoadingEventsList, setIsLoadingEventsList] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(initialEventId || null);

  // Event Data State (Per Event)
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [deviceSlots, setDeviceSlots] = useState<DeviceSlot[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [allocationSummary, setAllocationSummary] = useState<{
    totalTickets: number;
    totalCheckedInCount: number;
    unassignedCount: number;
    isFullyAssigned: boolean;
  }>({ totalTickets: 0, totalCheckedInCount: 0, unassignedCount: 0, isFullyAssigned: false });

  // Event Operators List
  const [eventOperators, setEventOperators] = useState<OperatorOption[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);

  // Ticket Filters in Gates Tab
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("all");
  const [selectedTicketIds, setSelectedTicketIds] = useState<number[]>([]);

  // Modals State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configMode, setConfigMode] = useState<"single" | "multi_gate">("single");
  const [configDevices, setConfigDevices] = useState<string>("2");
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelForm, setLabelForm] = useState({ deviceIndex: 0, deviceLabel: "" });
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState({
    operatorId: "",
    fullName: "",
    email: "",
    password: "",
    phone: "",
    deviceIndex: 0,
    deviceLabel: "",
  });
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const [isCreateOperatorModalOpen, setIsCreateOperatorModalOpen] = useState(false);
  const [isLinkOperatorModalOpen, setIsLinkOperatorModalOpen] = useState(false);
  const [targetDeviceIndex, setTargetDeviceIndex] = useState<number>(0);

  const [slotOperatorForm, setSlotOperatorForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [isSubmittingSlotOperator, setIsSubmittingSlotOperator] = useState(false);
  const [slotCreatedCredentials, setSlotCreatedCredentials] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);

  // Gate Pass Operator Creation Tab Form State
  const [gpForm, setGpForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    customPassword: "",
  });
  const [isSubmittingGp, setIsSubmittingGp] = useState(false);

  // Password Success Dialog State
  const [createdCredentials, setCreatedCredentials] = useState<{
    user: {
      id: string;
      full_name: string;
      username: string;
      email: string;
      role: string;
      linked_organizer_name?: string;
    };
    tempPassword: string;
  } | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ================= DATA FETCHING =================

  // 1. Fetch Events List for Selector
  const fetchEventsList = useCallback(async () => {
    setIsLoadingEventsList(true);
    try {
      const res = await fetch("/api/admin/events?limit=100");
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      if (data.success) {
        const evts: EventSummaryOption[] = (data.data.events || []).map((e: any) => ({
          event_id: e.event_id,
          event_name: e.event_name,
          organizer_id: e.organizer_id,
          organizer_name: e.organizer_name || "Organizer",
          start_time: e.start_time,
          location_name: e.location_name,
          total_gates: e.total_gates || 1,
          scanning_mode: e.scanning_mode || "single",
        }));
        setEventsList(evts);

        // Select initial or first event
        if (!selectedEventId && evts.length > 0) {
          if (initialEventId && evts.some((e) => e.event_id === initialEventId)) {
            setSelectedEventId(initialEventId);
          } else {
            setSelectedEventId(evts[0].event_id);
          }
        }
      }
    } catch (err) {
      console.error("Error loading events list:", err);
    } finally {
      setIsLoadingEventsList(false);
    }
  }, [selectedEventId, initialEventId]);

  // 2. Fetch Selected Event's Full Allocation Data
  const fetchEventData = useCallback(
    async (eventId: number, silent = false) => {
      try {
        if (!silent) setLoadingEvent(true);
        const res = await fetch(`/api/admin/events/${eventId}/device-allocation`);
        const result = await res.json();
        if (result.success) {
          setEventData(result.data.event);
          setDeviceSlots(result.data.deviceSlots);
          setTickets(result.data.tickets);
          setAllocationSummary(result.data.summary);
          setConfigMode(result.data.event.scanningMode);
          setConfigDevices(result.data.event.totalDevices.toString());
        } else {
          toast({
            title: "Error loading event",
            description: result.error,
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Network error",
          description: "Could not retrieve event data",
          variant: "destructive",
        });
      } finally {
        if (!silent) setLoadingEvent(false);
      }
    },
    [toast],
  );

  // 3. Fetch Available Operators for Current Event's Organizer
  const fetchEventOperators = useCallback(async (eventId: number) => {
    try {
      setLoadingOperators(true);
      const res = await fetch(`/api/admin/events/${eventId}/device-allocation/operators`);
      const result = await res.json();
      if (result.success) {
        setEventOperators(result.data.operators || []);
      }
    } catch (err) {
      console.error("Failed to load operators for event", err);
    } finally {
      setLoadingOperators(false);
    }
  }, []);

  useEffect(() => {
    fetchEventsList();
  }, [fetchEventsList]);

  useEffect(() => {
    if (selectedEventId) {
      fetchEventData(selectedEventId);
      fetchEventOperators(selectedEventId);
    }
  }, [selectedEventId, fetchEventData, fetchEventOperators]);

  // Auto-copy password on modal open
  useEffect(() => {
    if (isPasswordDialogOpen && createdCredentials?.tempPassword) {
      navigator.clipboard
        .writeText(createdCredentials.tempPassword)
        .then(() => {
          toast({
            title: "Password Auto-Copied!",
            description: "Temporary password copied to clipboard.",
          });
        })
        .catch(() => {});
    }
  }, [isPasswordDialogOpen, createdCredentials, toast]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // ================= ACTIONS =================

  // Save Custom Gate Label
  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !labelForm.deviceLabel.trim()) return;

    try {
      setIsSavingLabel(true);
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_device_label",
          device_index: labelForm.deviceIndex,
          device_label: labelForm.deviceLabel.trim(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Gate Label Updated ✨",
          description: result.message,
        });
        setIsLabelModalOpen(false);
        fetchEventData(selectedEventId, true);
      } else {
        toast({
          title: "Failed to update label",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Network error",
        description: "Failed to save label",
        variant: "destructive",
      });
    } finally {
      setIsSavingLabel(false);
    }
  };

  // Save Operator Credentials & Password Reset
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    try {
      setIsSavingCredentials(true);
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_operator_credentials",
          operator_id: credentialsForm.operatorId,
          full_name: credentialsForm.fullName,
          email: credentialsForm.email,
          password: credentialsForm.password || undefined,
          phone: credentialsForm.phone,
          device_index: credentialsForm.deviceIndex,
          device_label: credentialsForm.deviceLabel,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Account & Device Updated 🎉",
          description: result.message,
        });
        setIsCredentialsModalOpen(false);
        fetchEventData(selectedEventId, true);
        fetchEventOperators(selectedEventId);
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
        description: "Failed to update operator credentials",
        variant: "destructive",
      });
    } finally {
      setIsSavingCredentials(false);
    }
  };

  // Create Operator directly on Device Slot
  const handleCreateSlotOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !slotOperatorForm.fullName.trim() || !slotOperatorForm.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name and email are required",
        variant: "destructive",
      });
      return;
    }

    const slot = deviceSlots.find((s) => s.deviceIndex === targetDeviceIndex);

    try {
      setIsSubmittingSlotOperator(true);
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation/operators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: slotOperatorForm.fullName,
          email: slotOperatorForm.email,
          phone: slotOperatorForm.phone,
          password: slotOperatorForm.password,
          device_index: targetDeviceIndex,
          device_label: slot?.label || `Device ${targetDeviceIndex + 1}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSlotCreatedCredentials({
          email: result.data.credentials.email,
          password: result.data.credentials.password,
          name: result.data.operator.name,
        });
        toast({
          title: "Operator Account Created 🎉",
          description: `Assigned to ${slot?.label || `Device ${targetDeviceIndex + 1}`}`,
        });
        fetchEventData(selectedEventId, true);
        fetchEventOperators(selectedEventId);
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
      setIsSubmittingSlotOperator(false);
    }
  };

  // Create Gate Pass from Tab 3 (Pre-locked to current event organizer)
  const handleCreateGp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !eventData) return;
    if (!gpForm.fullName.trim() || !gpForm.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Operator Name and Email are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingGp(true);
    try {
      const res = await fetch("/api/admin/accounts/gate-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: gpForm.fullName,
          username: gpForm.username || undefined,
          email: gpForm.email,
          phone: gpForm.phone || undefined,
          linked_organizer_id: eventData.organizerId,
          custom_password: gpForm.customPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create Gate Pass operator account");
      }

      setGpForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        customPassword: "",
      });

      setCreatedCredentials(data.data);
      setIsPasswordDialogOpen(true);
      fetchEventOperators(selectedEventId);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error creating operator";
      toast({
        title: "Creation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingGp(false);
    }
  };

  // Link Existing Operator to Device Slot
  const handleLinkOperator = async (operatorId: string | null) => {
    if (!selectedEventId) return;
    const slot = deviceSlots.find((s) => s.deviceIndex === targetDeviceIndex);

    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_operator",
          device_index: targetDeviceIndex,
          operator_id: operatorId,
          device_label: slot?.label,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Operator Updated",
          description: result.message,
        });
        setIsLinkOperatorModalOpen(false);
        fetchEventData(selectedEventId, true);
        fetchEventOperators(selectedEventId);
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
    if (!selectedEventId) return;
    try {
      setIsSavingConfig(true);
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
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
          title: "Architecture Saved ✨",
          description: result.message,
        });
        setIsConfigModalOpen(false);
        fetchEventData(selectedEventId, false);
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

  // Assign Single Ticket Pass to Device
  const handleAssignTicket = async (ticketId: number, deviceIndex: number | null) => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
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
        const targetSlot = deviceSlots.find((s) => s.deviceIndex === deviceIndex);
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  assignedDeviceIndex: deviceIndex,
                  assignedDeviceLabel: targetSlot ? targetSlot.label : null,
                }
              : t,
          ),
        );
        fetchEventData(selectedEventId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Batch Assign Selected Tickets
  const handleBatchAssign = async (deviceIndex: number | null) => {
    if (!selectedEventId || selectedTicketIds.length === 0) return;
    const targetSlot = deviceSlots.find((s) => s.deviceIndex === deviceIndex);

    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
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
            targetSlot ? targetSlot.label : "Unassigned"
          }`,
        });
        setSelectedTicketIds([]);
        fetchEventData(selectedEventId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Smart Auto-Distribute Evenly
  const handleAutoDistribute = async (onlyUnassigned = false) => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
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
          title: "Smart Distribution Complete ✨",
          description: result.message,
        });
        fetchEventData(selectedEventId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear All Assignments
  const handleClearAllAssignments = async () => {
    if (!selectedEventId) return;
    if (!confirm("Are you sure you want to clear all attendee gate allocations for this event?")) return;
    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}/device-allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_all_assignments",
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: "Assignments Cleared",
          description: result.message,
        });
        fetchEventData(selectedEventId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export Attendees CSV
  const handleExportCSV = () => {
    if (!selectedEventId) return;
    const headers = [
      "Ticket Code",
      "Attendee Name",
      "Customer Name",
      "Phone",
      "Email",
      "Booking Reference",
      "Pass Type",
      "Price (PKR)",
      "Assigned Gate / Device",
      "Check-In Status",
      "Check-In Time",
    ];

    const rows = tickets.map((t) => [
      `"${t.code}"`,
      `"${t.guestName}"`,
      `"${t.customerName}"`,
      `"${t.customerPhone || ""}"`,
      `"${t.customerEmail || ""}"`,
      `"${t.bookingCode}"`,
      `"${t.ticketTypeName}"`,
      t.ticketPrice,
      `"${t.assignedDeviceLabel || "Unassigned"}"`,
      `"${t.isCheckedIn ? "Checked In" : "Pending"}"`,
      `"${t.checkedInAt ? new Date(t.checkedInAt).toLocaleString() : ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `event_${selectedEventId}_device_allocation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (ticketSearchQuery.trim()) {
        const q = ticketSearchQuery.toLowerCase();
        const match =
          ticket.guestName.toLowerCase().includes(q) ||
          ticket.customerName.toLowerCase().includes(q) ||
          ticket.code.toLowerCase().includes(q) ||
          ticket.bookingCode.toLowerCase().includes(q) ||
          (ticket.customerPhone && ticket.customerPhone.includes(q)) ||
          (ticket.customerEmail && ticket.customerEmail.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (deviceFilter === "unassigned") {
        if (ticket.assignedDeviceIndex !== null) return false;
      } else if (deviceFilter !== "all") {
        if (ticket.assignedDeviceIndex !== parseInt(deviceFilter, 10)) return false;
      }

      if (ticketStatusFilter === "checked_in" && !ticket.isCheckedIn) return false;
      if (ticketStatusFilter === "pending" && ticket.isCheckedIn) return false;

      return true;
    });
  }, [tickets, ticketSearchQuery, deviceFilter, ticketStatusFilter]);

  const handleSelectAllTickets = () => {
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

  const isMultiDevice = eventData && eventData.scanningMode === "multi_gate" && eventData.totalDevices > 1;
  const assignedOperatorsCount = deviceSlots.filter((d) => !!d.assignedOperator).length;

  return (
    <div className="space-y-6">
      {/* Top Event Header & Selector Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-muted/20 to-background p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span>Admin Event Console</span>
              <span>•</span>
              <span className="text-primary font-semibold">Device Allocation & Gate Pass Control</span>
            </div>

            {/* Event Switcher Dropdown */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedEventId ? selectedEventId.toString() : ""}
                onValueChange={(val) => setSelectedEventId(parseInt(val, 10))}
              >
                <SelectTrigger className="w-full sm:w-[360px] bg-background font-bold text-base h-11 border-primary/40 shadow-xs focus:ring-primary">
                  <div className="flex items-center gap-2 truncate">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{eventData?.name || "Select an event..."}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {eventsList.map((e) => (
                    <SelectItem key={e.event_id} value={e.event_id.toString()}>
                      <div className="flex flex-col text-left py-1">
                        <span className="font-bold text-sm text-foreground">{e.event_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.organizer_name} • {new Date(e.start_time).toLocaleDateString()} {e.location_name ? `• ${e.location_name}` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {eventData && (
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    isMultiDevice
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isMultiDevice
                    ? `⚡ ${eventData.totalDevices}-Gate Multi-Device`
                    : "Single Scanner Mode"}
                </Badge>
              )}
            </div>

            {eventData && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Organizer: <strong className="text-foreground">{eventData.organizerName}</strong>
                </span>
                {eventData.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {eventData.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(eventData.startTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {eventData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="border-primary/40 hover:bg-primary/5 text-foreground text-xs font-semibold h-9"
                >
                  <Sliders className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Configure Gate Architecture
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={tickets.length === 0}
                  className="text-xs h-9"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export Roster
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchEventsList();
                if (selectedEventId) {
                  fetchEventData(selectedEventId);
                  fetchEventOperators(selectedEventId);
                }
              }}
              disabled={loadingEvent || isLoadingEventsList}
              className="hover:bg-muted text-xs h-9"
              title="Refresh Event Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingEvent ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Per-Event KPI Stats Cards */}
      {eventData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-xs p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-primary" /> Event Organizer
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="truncate">
                <div className="text-base font-bold text-foreground truncate">{eventData.organizerName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{eventData.organizerCompany || "Platform EO"}</div>
              </div>
              <BadgeCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-xs p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-primary" /> Verification Gates
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-black text-foreground">
                {eventData.totalDevices} <span className="text-xs font-normal text-muted-foreground">{eventData.totalDevices === 1 ? "Gate Slot" : "Gate Slots"}</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                {isMultiDevice ? "Multi-Gate" : "Single Device"}
              </Badge>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-xs p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-500" /> Active Gate Staff
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-black text-foreground">
                {assignedOperatorsCount} <span className="text-xs font-normal text-muted-foreground">/ {eventData.totalDevices} Assigned</span>
              </div>
              <span className={`text-[11px] font-semibold ${assignedOperatorsCount === eventData.totalDevices ? "text-emerald-500" : "text-amber-500"}`}>
                {assignedOperatorsCount === eventData.totalDevices ? "● All Linked" : "○ Unlinked Gates"}
              </span>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm shadow-xs p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 text-emerald-500" /> Total Attendees
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-black text-foreground">
                {allocationSummary.totalTickets}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-500">{allocationSummary.totalCheckedInCount} Checked In</span>
                {allocationSummary.unassignedCount > 0 && (
                  <div className="text-[10px] text-amber-500 font-medium">({allocationSummary.unassignedCount} Unassigned)</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Per-Event Synchronized Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl bg-muted/60 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="gates" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs font-semibold">
            <Smartphone className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Gates & Allocation
          </TabsTrigger>
          <TabsTrigger value="staff" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs font-semibold">
            <Shield className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            Gate Staff ({eventOperators.length})
          </TabsTrigger>
          <TabsTrigger value="create-staff" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs font-semibold">
            <UserPlus className="h-3.5 w-3.5 mr-1.5 text-primary" />
            + Add Gate Staff
          </TabsTrigger>
          <TabsTrigger value="organizer-profile" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs font-semibold">
            <Building className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
            Organizer Profile
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: GATES & DEVICE ALLOCATION ================= */}
        <TabsContent value="gates" className="space-y-6 outline-none">
          {loadingEvent ? (
            <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium text-sm">
                Loading device allocation & scanner gates...
              </p>
            </div>
          ) : !selectedEventId || !eventData ? (
            <div className="py-16 text-center text-muted-foreground bg-card/40 rounded-2xl border border-border/50">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Event Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Please choose an event from the dropdown above.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. Device Slots & Operators Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      Verification Devices & Gate Operators
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Manage gate slots, custom entrance names (e.g. <strong>GATE A</strong>, <strong>VIP ENTRANCE</strong>), and operator credentials for <strong>{eventData.name}</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {deviceSlots.map((slot) => {
                    const hasOperator = !!slot.assignedOperator;
                    return (
                      <Card
                        key={slot.deviceIndex}
                        className="relative overflow-hidden border border-border/80 bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 to-primary/30" />
                        <CardHeader className="pb-3 pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                                  D{slot.deviceNumber}
                                </span>
                                <div className="flex items-center gap-1.5 group">
                                  <CardTitle className="text-base font-bold text-foreground">
                                    {slot.label}
                                  </CardTitle>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLabelForm({ deviceIndex: slot.deviceIndex, deviceLabel: slot.label });
                                      setIsLabelModalOpen(true);
                                    }}
                                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    title="Edit Gate Label"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <CardDescription className="text-xs mt-1">
                                Assigned: <strong>{slot.assignedTicketsCount}</strong> ({slot.percentage}%)
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

                        <CardContent className="space-y-3 pt-0">
                          {/* Operator Info Sub-card */}
                          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>Scanner Operator</span>
                              {hasOperator ? (
                                <span className="inline-flex items-center text-green-600 dark:text-green-400 font-medium text-[10px]">
                                  ● Active Link
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-amber-500 font-medium text-[10px]">
                                  ○ Unassigned
                                </span>
                              )}
                            </div>

                            {hasOperator ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8 border border-border">
                                    <AvatarImage src={slot.assignedOperator?.avatar || ""} />
                                    <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
                                      {slot.assignedOperator?.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate">
                                      {slot.assignedOperator?.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {slot.assignedOperator?.email}
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    if (!slot.assignedOperator) return;
                                    setCredentialsForm({
                                      operatorId: slot.assignedOperator.operatorId,
                                      fullName: slot.assignedOperator.name,
                                      email: slot.assignedOperator.email || "",
                                      password: "",
                                      phone: slot.assignedOperator.phone || "",
                                      deviceIndex: slot.deviceIndex,
                                      deviceLabel: slot.label,
                                    });
                                    setCopiedKey(null);
                                    setIsCredentialsModalOpen(true);
                                  }}
                                  className="w-full text-xs h-7 mt-1 font-medium bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border/60"
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                  Reset Credentials
                                </Button>
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
                              onClick={() => {
                                setTargetDeviceIndex(slot.deviceIndex);
                                setSlotOperatorForm({
                                  fullName: "",
                                  email: "",
                                  phone: "",
                                  password: `GatePass${Math.floor(100000 + Math.random() * 900000)}!`,
                                });
                                setSlotCreatedCredentials(null);
                                setIsCreateOperatorModalOpen(true);
                              }}
                              className="text-xs h-8 px-2 font-medium"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1 text-primary" />
                              + New Account
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTargetDeviceIndex(slot.deviceIndex);
                                if (selectedEventId) fetchEventOperators(selectedEventId);
                                setIsLinkOperatorModalOpen(true);
                              }}
                              className="text-xs h-8 px-2 font-medium"
                            >
                              <LinkIcon className="h-3.5 w-3.5 mr-1" />
                              {hasOperator ? "Switch" : "Link Existing"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* 2. Attendee Distribution & Assignment Table */}
              <Card className="border border-border/70 shadow-sm overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Attendee Gate Allocation
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Assign attendees to {deviceSlots.map((d) => d.label).join(", ")}, or use smart auto-distribution below.
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
                        {allocationSummary.unassignedCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAutoDistribute(true)}
                            className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                          >
                            Assign Unassigned ({allocationSummary.unassignedCount})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleClearAllAssignments}
                          className="text-xs text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Reset
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Allocation Breakdown Progress */}
                  <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-background border border-border/60">
                      <span className="text-muted-foreground">Total Attendees</span>
                      <p className="text-base font-bold text-foreground mt-0.5">{allocationSummary.totalTickets}</p>
                    </div>
                    {deviceSlots.map((d) => (
                      <div key={d.deviceIndex} className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground">{d.label} Slice</span>
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
                          allocationSummary.unassignedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600"
                        }`}
                      >
                        {allocationSummary.unassignedCount}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Search & Filters */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-1 items-center gap-2 max-w-md">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search attendee, booking code, phone..."
                          value={ticketSearchQuery}
                          onChange={(e) => setTicketSearchQuery(e.target.value)}
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
                            {d.label} ({d.assignedTicketsCount})
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
                          Unassigned ({allocationSummary.unassignedCount})
                        </button>
                      </div>

                      {/* Status Filter */}
                      <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
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

                  {/* Batch Selection Banner */}
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
                            className="h-7 text-xs border-primary/30 bg-background hover:bg-primary/10"
                          >
                            {d.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleBatchAssign(null)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                          <tr>
                            <th className="p-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  filteredTickets.length > 0 &&
                                  selectedTicketIds.length === filteredTickets.length
                                }
                                onChange={handleSelectAllTickets}
                                className="rounded border-border"
                              />
                            </th>
                            <th className="p-3 font-semibold">Attendee / Guest</th>
                            <th className="p-3 font-semibold">Booking Info</th>
                            <th className="p-3 font-semibold">Ticket Type</th>
                            <th className="p-3 font-semibold">Check-In Status</th>
                            <th className="p-3 font-semibold">Assigned Verification Gate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredTickets.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-muted-foreground">
                                No attendees match your search or filter.
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
                                    <div className="font-semibold text-foreground text-sm">
                                      {ticket.guestName}
                                    </div>
                                    <div className="text-muted-foreground text-[11px] font-mono">
                                      Pass Code: {ticket.code}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium text-foreground">{ticket.customerName}</div>
                                    <div className="text-muted-foreground text-[11px]">
                                      Ref: {ticket.bookingCode}
                                    </div>
                                    {ticket.customerPhone && (
                                      <div className="text-muted-foreground text-[11px]">
                                        {ticket.customerPhone}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="text-[11px] font-medium">
                                      {ticket.ticketTypeName}
                                    </Badge>
                                  </td>
                                  <td className="p-3">
                                    {ticket.isCheckedIn ? (
                                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[11px]">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Checked In
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                        Pending Scan
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-3">
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
                                      <SelectTrigger className="h-8 text-xs w-[180px] bg-background">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {deviceSlots.map((d) => (
                                          <SelectItem key={d.deviceIndex} value={d.deviceIndex.toString()}>
                                            🚪 {d.label}
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
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 2: GATE STAFF & OPERATORS (FOR THIS EVENT) ================= */}
        <TabsContent value="staff" className="space-y-4 outline-none">
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Gate Scanner Staff for {eventData?.name || "this event"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Staff operators provisioned under <strong>{eventData?.organizerName}</strong> authorized to scan attendee tickets.
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  onClick={() => setActiveTab("create-staff")}
                  className="text-xs font-semibold bg-primary text-primary-foreground"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  + Add New Operator
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingOperators ? (
                <div className="py-16 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-xs font-medium">Loading gate staff...</p>
                </div>
              ) : eventOperators.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No gate staff provisioned yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Create scanner operator accounts for gate attendants to scan QR codes at venue doors.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("create-staff")}
                    className="mt-4 text-xs font-semibold"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Create First Operator
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="py-3 px-4">Operator Name</th>
                        <th className="py-3 px-4">Login Email / Username</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Current Assigned Gate</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {eventOperators.map((op) => {
                        const assignedSlot = deviceSlots.find(
                          (s) => s.assignedOperator?.operatorId === op.id,
                        );

                        return (
                          <tr key={op.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border">
                                  <AvatarImage src={op.avatar || ""} />
                                  <AvatarFallback className="text-xs font-bold bg-amber-500/10 text-amber-500">
                                    {op.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-foreground">{op.name}</div>
                                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/30">
                                    Gate Pass Role
                                  </Badge>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                              {op.email || `@${op.username}`}
                            </td>

                            <td className="py-3 px-4 text-xs text-muted-foreground">
                              {op.phone || "—"}
                            </td>

                            <td className="py-3 px-4">
                              {assignedSlot ? (
                                <Badge className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold">
                                  🚪 {assignedSlot.label}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCredentialsForm({
                                      operatorId: op.id,
                                      fullName: op.name,
                                      email: op.email || "",
                                      password: "",
                                      phone: op.phone || "",
                                      deviceIndex: assignedSlot ? assignedSlot.deviceIndex : 0,
                                      deviceLabel: assignedSlot ? assignedSlot.label : `Device 1`,
                                    });
                                    setCopiedKey(null);
                                    setIsCredentialsModalOpen(true);
                                  }}
                                  className="h-8 text-xs"
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                                  Reset Password
                                </Button>
                              </div>
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
        </TabsContent>

        {/* ================= TAB 3: PROVISION GATE PASS OPERATOR ================= */}
        <TabsContent value="create-staff" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 border-border/50 bg-card/70 backdrop-blur-xl shadow-lg">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Add Gate Pass Staff for {eventData?.name || "Event"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Provision a dedicated scanner operator account automatically linked to <strong>{eventData?.organizerName}</strong>.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-2">
                <form onSubmit={handleCreateGp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-muted-foreground flex items-center justify-between">
                    <span className="font-semibold text-foreground">Assigned Event Organizer:</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-bold">{eventData?.organizerName}</strong>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Operator Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Gate Attendant 1 (Bilal)"
                        value={gpForm.fullName}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, fullName: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="bilal.gate@insidekhi.com"
                        value={gpForm.email}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, email: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Username (Optional)</Label>
                      <Input
                        placeholder="auto-generated if blank"
                        value={gpForm.username}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, username: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        placeholder="+92 300 9876543"
                        value={gpForm.phone}
                        onChange={(e) =>
                          setGpForm({ ...gpForm, phone: e.target.value })
                        }
                        className="bg-background/60 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Custom Temporary Password (Optional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="Leave empty to auto-generate a secure password"
                      value={gpForm.customPassword}
                      onChange={(e) =>
                        setGpForm({ ...gpForm, customPassword: e.target.value })
                      }
                      className="bg-background/60 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingGp}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
                  >
                    {isSubmittingGp ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating Gate Staff Account...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Create Gate Staff Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              <EOProfilePreviewCard
                fullName={gpForm.fullName}
                username={gpForm.username}
                email={gpForm.email}
                phone={gpForm.phone}
                role="eo_gate_pass"
                linkedOrganizerName={eventData?.organizerName}
              />

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Shield className="h-3.5 w-3.5" /> Gate Pass Role Security Constraints
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
                  <li>Can log into the Inside Karachi mobile scanner & verify ticket QR codes.</li>
                  <li><strong>Cannot</strong> access organizer revenue, payouts, or event settings.</li>
                  <li>Assigned directly to this event's gates on mobile.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 4: EVENT ORGANIZER PROFILE ================= */}
        <TabsContent value="organizer-profile" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 border-border/50 bg-card/70 backdrop-blur-xl shadow-lg">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building className="h-5 w-5 text-emerald-500" />
                  Event Organizer Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Details for the Event Organizer hosting <strong>{eventData?.name}</strong>.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-2 space-y-4">
                {eventData ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg">
                          {eventData.organizerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-bold text-foreground">{eventData.organizerName}</h3>
                            <BadgeCheck className="h-4 w-4 text-emerald-500 fill-emerald-500/20" />
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{eventData.organizerEmail || "No public email"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-border/40">
                        <div>
                          <span className="text-muted-foreground">Company / Brand:</span>
                          <p className="font-semibold text-foreground mt-0.5">{eventData.organizerCompany || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Organizer UUID:</span>
                          <p className="font-mono text-foreground truncate mt-0.5" title={eventData.organizerId}>{eventData.organizerId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(eventData.organizerId);
                          toast({ title: "Copied", description: "Organizer UUID copied to clipboard" });
                        }}
                        className="text-xs"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy Organizer ID
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No event data available.</p>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-5 space-y-4">
              {eventData && (
                <EOProfilePreviewCard
                  fullName={eventData.organizerName}
                  email={eventData.organizerEmail || ""}
                  company={eventData.organizerCompany || undefined}
                  isVerified={true}
                  role="organizer"
                />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODALS & DIALOGS ================= */}

      {/* 1. Architecture Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Event Verification Architecture
            </DialogTitle>
            <DialogDescription>
              Configure how tickets will be verified at the venue on mobile scanners for <strong>{eventData?.name}</strong>.
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
                    <SelectItem value="2">2 Devices (e.g. Gate A & Gate B)</SelectItem>
                    <SelectItem value="3">3 Devices (e.g. Gate A, Gate B & VIP Gate)</SelectItem>
                    <SelectItem value="4">4 Devices</SelectItem>
                    <SelectItem value="5">5 Devices</SelectItem>
                    <SelectItem value="6">6 Devices</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each device operates independently. Attendees are exclusively verified at their assigned device lane.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveArchitecture} disabled={isSavingConfig} className="bg-primary text-primary-foreground font-semibold">
              {isSavingConfig ? "Saving..." : "Save Architecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Device / Gate Label Modal */}
      <Dialog open={isLabelModalOpen} onOpenChange={setIsLabelModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Gate / Device Name
            </DialogTitle>
            <DialogDescription>
              This name (e.g. <strong>GATE A</strong>, <strong>VIP ENTRANCE</strong>) will appear on attendees' tickets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLabel} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Gate Label / Entrance Name</Label>
              <Input
                required
                placeholder="e.g. GATE A or North Gate"
                value={labelForm.deviceLabel}
                onChange={(e) => setLabelForm((p) => ({ ...p, deviceLabel: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Example: <em>GATE A</em>, <em>GATE B</em>, <em>VIP Entrance</em>
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLabelModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingLabel} className="bg-primary text-primary-foreground">
                {isSavingLabel ? "Saving..." : "Save Gate Name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Manage Operator Credentials & Password Reset Modal */}
      <Dialog open={isCredentialsModalOpen} onOpenChange={setIsCredentialsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Manage Scanner Credentials
            </DialogTitle>
            <DialogDescription>
              Update or reset login email & password for <strong>{credentialsForm.deviceLabel}</strong> operator.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCredentials} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Operator Full Name</Label>
              <Input
                required
                value={credentialsForm.fullName}
                onChange={(e) => setCredentialsForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Login Email</Label>
              <Input
                required
                type="email"
                value={credentialsForm.email}
                onChange={(e) => setCredentialsForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Reset Password</Label>
                <button
                  type="button"
                  onClick={() => {
                    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
                    let pwd = "";
                    for (let i = 0; i < 10; i++) {
                      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setCredentialsForm((prev) => ({ ...prev, password: `Scan${pwd}!` }));
                  }}
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Generate Secure Password
                </button>
              </div>
              <Input
                placeholder="Leave blank to keep unchanged"
                value={credentialsForm.password}
                onChange={(e) => setCredentialsForm((p) => ({ ...p, password: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Enter a new password (min 6 characters) to reset it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phone (Optional)</Label>
              <Input
                placeholder="03001234567"
                value={credentialsForm.phone}
                onChange={(e) => setCredentialsForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Gate Name</Label>
              <Input
                value={credentialsForm.deviceLabel}
                onChange={(e) => setCredentialsForm((p) => ({ ...p, deviceLabel: e.target.value }))}
              />
            </div>

            {credentialsForm.password && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-muted-foreground">New Password:</span>
                  <span className="font-bold text-primary">{credentialsForm.password}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={() =>
                    copyToClipboard(
                      `Email: ${credentialsForm.email}\nPassword: ${credentialsForm.password}\nGate: ${credentialsForm.deviceLabel}`,
                      "edit_creds",
                    )
                  }
                >
                  {copiedKey === "edit_creds" ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied Credentials
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Login Details
                    </>
                  )}
                </Button>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCredentialsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCredentials} className="bg-primary text-primary-foreground">
                {isSavingCredentials ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Create Operator Account for Device Slot Modal */}
      <Dialog open={isCreateOperatorModalOpen} onOpenChange={setIsCreateOperatorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create Scanner Operator Account
            </DialogTitle>
            <DialogDescription>
              Create an operator account and immediately link them to <strong>{deviceSlots.find((s) => s.deviceIndex === targetDeviceIndex)?.label || `Device ${targetDeviceIndex + 1}`}</strong>.
            </DialogDescription>
          </DialogHeader>

          {slotCreatedCredentials ? (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Account Created & Assigned!
                </div>
                <p className="text-xs text-muted-foreground">
                  Hand these credentials over to the gate passer / scanning staff:
                </p>

                <div className="space-y-2 text-xs font-mono bg-background p-3 rounded-lg border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-semibold text-foreground">{slotCreatedCredentials.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Password:</span>
                    <span className="font-semibold text-primary">{slotCreatedCredentials.password}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() =>
                    copyToClipboard(
                      `Email: ${slotCreatedCredentials.email}\nPassword: ${slotCreatedCredentials.password}`,
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
            <form onSubmit={handleCreateSlotOperator} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Operator Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Ali Khan"
                  value={slotOperatorForm.fullName}
                  onChange={(e) =>
                    setSlotOperatorForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Operator Email *</Label>
                <Input
                  required
                  type="email"
                  placeholder="operator@event.com"
                  value={slotOperatorForm.email}
                  onChange={(e) =>
                    setSlotOperatorForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone (Optional)</Label>
                <Input
                  placeholder="03001234567"
                  value={slotOperatorForm.phone}
                  onChange={(e) =>
                    setSlotOperatorForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Password</Label>
                <Input
                  value={slotOperatorForm.password}
                  onChange={(e) =>
                    setSlotOperatorForm((p) => ({ ...p, password: e.target.value }))
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
                <Button type="submit" disabled={isSubmittingSlotOperator} className="bg-primary text-primary-foreground">
                  {isSubmittingSlotOperator ? "Creating..." : `Create & Assign to Gate`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Link Existing Operator Modal */}
      <Dialog open={isLinkOperatorModalOpen} onOpenChange={setIsLinkOperatorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Link Operator to {deviceSlots.find((s) => s.deviceIndex === targetDeviceIndex)?.label || `Device ${targetDeviceIndex + 1}`}
            </DialogTitle>
            <DialogDescription>
              Select an existing Scanner Operator account from <strong>{eventData?.organizerName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[350px] overflow-y-auto">
            {loadingOperators ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground mt-2">Loading operators...</p>
              </div>
            ) : eventOperators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No scanner operator accounts found for this organizer.</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setIsLinkOperatorModalOpen(false);
                    setTargetDeviceIndex(targetDeviceIndex);
                    setSlotOperatorForm({
                      fullName: "",
                      email: "",
                      phone: "",
                      password: `GatePass${Math.floor(100000 + Math.random() * 900000)}!`,
                    });
                    setSlotCreatedCredentials(null);
                    setIsCreateOperatorModalOpen(true);
                  }}
                  className="mt-2"
                >
                  + Create a new operator account now
                </Button>
              </div>
            ) : (
              eventOperators.map((op) => (
                <div
                  key={op.id}
                  onClick={() => handleLinkOperator(op.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={op.avatar || ""} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                        {op.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{op.name}</p>
                      <p className="text-xs text-muted-foreground">{op.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-primary font-semibold">
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

      {/* 6. Success Temporary Password Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPasswordDialogOpen(false);
            setCreatedCredentials(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-border/60">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-foreground">
              Account Created Successfully
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Provide these initial login credentials securely to the gate operator.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-semibold text-foreground">{createdCredentials.user.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-foreground">{createdCredentials.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">
                    {createdCredentials.user.role.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Temporary Password (Auto-Copied)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 rounded-xl bg-background border border-primary/30 font-mono text-sm font-bold text-primary tracking-wider text-center select-all">
                    {createdCredentials.tempPassword}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 px-3 border-border/60 hover:bg-muted"
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.tempPassword);
                      toast({
                        title: "Copied!",
                        description: "Temporary password copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1 bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                <p className="font-semibold text-amber-600 dark:text-amber-400">Security Warning:</p>
                <p>This password is only displayed once and will not be visible again after closing this dialog.</p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (createdCredentials) {
                  const summary = `Inside Karachi Credentials:\nRole: ${createdCredentials.user.role}\nEmail: ${createdCredentials.user.email}\nPassword: ${createdCredentials.tempPassword}`;
                  navigator.clipboard.writeText(summary);
                  toast({
                    title: "Summary Copied",
                    description: "Full login details copied to clipboard",
                  });
                }
              }}
              className="text-xs"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Full Credentials
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsPasswordDialogOpen(false);
                setCreatedCredentials(null);
              }}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
