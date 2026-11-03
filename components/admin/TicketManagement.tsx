"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Ticket,
  Calendar,
  Users,
  Banknote,
  Clock,
  ExternalLink,
  FileText,
  Upload,
  Sparkles,
  FolderPlus,
  Folder,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  TicketType,
  TicketManagementProps,
  TicketFormData,
} from "@/types/events.types";
import { fromKarachiInput, toKarachiInput } from "@/lib/events/datetime";
import {
  AttendeeFieldsEditor,
  GroupSizeInputs,
} from "@/components/ticketing/AttendeeFieldsEditor";
import type { AttendeeField } from "@/lib/ticketing/attendee-fields";

const DESCRIPTION_MAX_LENGTH = 500;

export function TicketManagement({ eventId }: TicketManagementProps) {
  const [ticketTypes, setTicketTypes] = React.useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTicket, setEditingTicket] = React.useState<TicketType | null>(
    null,
  );
  const [deletingTicket, setDeletingTicket] = React.useState<TicketType | null>(
    null,
  );
  const [formData, setFormData] = React.useState<TicketFormData>({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
    sale_starts_at: "",
    sale_ends_at: "",
    max_per_person: "10",
    ticket_url: "",
    people_per_ticket: "1",
    min_people_per_ticket: "1",
    group_name: "",
    group_order: "0",
    original_price: "",
    parchi_price: "",
    parchi_original_price: "",
    is_pdf_flow: false,
    attendee_fields: [],
  });

  const [uploadingTicket, setUploadingTicket] = React.useState<TicketType | null>(null);
  const [isUploadingPdfs, setIsUploadingPdfs] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Section Header Management
  const [isHeaderDialogOpen, setIsHeaderDialogOpen] = React.useState(false);
  const [headerForm, setHeaderForm] = React.useState({ name: "", order: "0" });
  const [knownHeaders, setKnownHeaders] = React.useState<Array<{ name: string; order: number }>>([]);
  const [isCustomHeaderInput, setIsCustomHeaderInput] = React.useState(false);

  // Bundled PDF Splitter
  const [isSplitImportOpen, setIsSplitImportOpen] = React.useState(false);
  const [splitPdfFile, setSplitPdfFile] = React.useState<File | null>(null);
  const [isSplitting, setIsSplitting] = React.useState(false);
  const [splitResult, setSplitResult] = React.useState<{
    totalPages: number;
    totalTiers: number;
    newTiersCreated: number;
    passesUploaded: number;
    breakdown: Array<{
      show: string;
      ticket: string;
      ticketTypeId: number;
      passesCount: number;
      isNewTier: boolean;
      status: string;
    }>;
  } | null>(null);
  const splitInputRef = React.useRef<HTMLInputElement>(null);

  // Revert / Delete All Tickets state
  const [isRevertAllDialogOpen, setIsRevertAllDialogOpen] = React.useState(false);
  const [isRevertingAll, setIsRevertingAll] = React.useState(false);

  const handleUploadPdfs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingTicket || !selectedFiles || selectedFiles.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one PDF file to upload",
        variant: "destructive",
      });
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append("ticket_type_id", String(uploadingTicket.id));
    for (let i = 0; i < selectedFiles.length; i++) {
      formDataUpload.append("files", selectedFiles[i]);
    }

    try {
      setIsUploadingPdfs(true);
      const res = await fetch(
        `/api/organizer/events/${eventId}/ticket-pdf-inventory/upload`,
        {
          method: "POST",
          body: formDataUpload,
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to upload PDFs");
      }

      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${json.data?.inserted ?? selectedFiles.length} ticket PDFs!`,
      });

      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadingTicket(null);
      fetchTicketTypes();
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload ticket PDFs",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPdfs(false);
    }
  };
  const { toast } = useToast();
  // Checkout questions every ticket of this event asks.
  const [eventFields, setEventFields] = React.useState<AttendeeField[]>([]);
  const [isSavingEventFields, setIsSavingEventFields] = React.useState(false);

  const modalRef = React.useRef<HTMLDivElement>(null);

  const initialBodyState = React.useRef({
    scrollHeight: 0,
    clientHeight: 0,
    scrollWidth: 0,
    clientWidth: 0,
    marginRight: "",
    paddingRight: "",
    overflow: "",
    position: "",
    minHeight: "",
    height: "",
    maxHeight: "",
  });

  // Fetch ticket types
  const fetchTicketTypes = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/events/${eventId}/tickets`);

      if (response.ok) {
        const data = await response.json();
        setTicketTypes(data.data.ticket_types || []);
        setEventFields(data.data.event_attendee_fields || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch ticket types",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching ticket types:", error);
      toast({
        title: "Error",
        description: "Failed to fetch ticket types",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId, toast]);

  React.useEffect(() => {
    fetchTicketTypes();
  }, [fetchTicketTypes]);

  // Combined headers from existing tickets and manually created headers
  const allHeaders = React.useMemo(() => {
    const map = new Map<string, number>();
    ticketTypes.forEach((t) => {
      if (t.group_name?.trim()) {
        map.set(t.group_name.trim(), t.group_order ?? 0);
      }
    });
    knownHeaders.forEach((h) => {
      if (!map.has(h.name)) {
        map.set(h.name, h.order);
      }
    });
    return Array.from(map.entries())
      .map(([name, order]) => ({ name, order }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [ticketTypes, knownHeaders]);

  // Tickets grouped by section header
  const groupedTickets = React.useMemo(() => {
    const map = new Map<string, { order: number; tickets: TicketType[] }>();
    const ungrouped: TicketType[] = [];

    // Pre-seed known headers
    allHeaders.forEach((h) => {
      map.set(h.name, { order: h.order, tickets: [] });
    });

    ticketTypes.forEach((t) => {
      const gName = t.group_name?.trim();
      if (gName) {
        if (!map.has(gName)) {
          map.set(gName, { order: t.group_order ?? 0, tickets: [] });
        }
        map.get(gName)!.tickets.push(t);
      } else {
        ungrouped.push(t);
      }
    });

    const groups: Array<{ name: string; order: number; tickets: TicketType[] }> = [];
    for (const [name, data] of map.entries()) {
      groups.push({ name, order: data.order, tickets: data.tickets });
    }
    groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return { groups, ungrouped };
  }, [ticketTypes, allHeaders]);

  // Initialize body state capture
  React.useEffect(() => {
    const body = document.body;

    // Capture the pristine body state
    initialBodyState.current = {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      marginRight: body.style.marginRight || getComputedStyle(body).marginRight,
      paddingRight:
        body.style.paddingRight || getComputedStyle(body).paddingRight,
      overflow: body.style.overflow || getComputedStyle(body).overflow,
      position: body.style.position || getComputedStyle(body).position,
      minHeight: body.style.minHeight || getComputedStyle(body).minHeight,
      height: body.style.height || getComputedStyle(body).height,
      maxHeight: body.style.maxHeight || getComputedStyle(body).maxHeight,
    };

    // Initial body state captured
  }, []); // Empty dependency array - run only once on mount

  // Apply CSS containment when modal opens
  React.useEffect(() => {
    if (isDialogOpen && modalRef.current) {
      // Dialog content mounted
      // Dialog mounted

      // Apply CSS containment to prevent layout shifts
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
      modalRef.current.style.position = "relative";

      // Applied CSS containment to modal
    }
  }, [isDialogOpen]);

  // Prevent layout shift when Radix Select dropdowns open
  React.useEffect(() => {
    if (isDialogOpen) {
      const body = document.body;
      const removeScrollLock = () => {
        body.hasAttribute("data-scroll-locked");

        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver((mutations) => {
        let scrollLockDetected = false;
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            if (
              mutation.attributeName === "data-scroll-locked" &&
              body.hasAttribute("data-scroll-locked")
            ) {
              scrollLockDetected = true;
            }
            if (mutation.attributeName === "style") {
              const newStyle = body.getAttribute("style") || "";
              if (
                newStyle.includes("margin-right") ||
                newStyle.includes("padding-right") ||
                newStyle.includes("overflow")
              ) {
                // Style change detected
              }
            }
          }
        });

        if (scrollLockDetected) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
        attributeOldValue: true,
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [isDialogOpen]);

  // Prevent body height/layout shifts when modal opens - PROACTIVE APPROACH
  React.useEffect(() => {
    if (isDialogOpen) {
      // Body stabilization active

      const body = document.body;
      const html = document.documentElement;

      // Immediately restore initial body state to prevent any shifts
      const restoreInitialState = () => {
        // Force body to maintain exact initial dimensions
        body.style.setProperty(
          "height",
          initialBodyState.current.height,
          "important",
        );
        body.style.setProperty(
          "min-height",
          initialBodyState.current.minHeight,
          "important",
        );
        body.style.setProperty(
          "max-height",
          initialBodyState.current.maxHeight,
          "important",
        );
        body.style.setProperty(
          "margin-right",
          initialBodyState.current.marginRight,
          "important",
        );
        body.style.setProperty(
          "padding-right",
          initialBodyState.current.paddingRight,
          "important",
        );
        body.style.setProperty(
          "overflow",
          initialBodyState.current.overflow,
          "important",
        );
        body.style.setProperty(
          "position",
          initialBodyState.current.position,
          "important",
        );

        // Prevent any layout shifts by fixing body dimensions
        if (
          !initialBodyState.current.height ||
          initialBodyState.current.height === "auto"
        ) {
          body.style.setProperty(
            "height",
            `${initialBodyState.current.scrollHeight}px`,
            "important",
          );
        }

        // Also ensure html doesn't change
        html.style.overflow = "visible";
        html.style.height = "auto";
      };

      // Restore immediately
      restoreInitialState();

      // Set up aggressive monitoring to prevent any changes
      const preventBodyChanges = () => {
        const currentScrollHeight = body.scrollHeight;
        const currentClientHeight = body.clientHeight;

        // If body dimensions have changed from initial state, restore them
        if (
          Math.abs(
            currentScrollHeight - initialBodyState.current.scrollHeight,
          ) > 5 ||
          Math.abs(
            currentClientHeight - initialBodyState.current.clientHeight,
          ) > 5
        ) {
          restoreInitialState();
        }

        // Check for any style changes that might affect layout
        const computedStyle = getComputedStyle(body);
        if (
          computedStyle.overflow !== initialBodyState.current.overflow ||
          computedStyle.position !== initialBodyState.current.position ||
          computedStyle.marginRight !== initialBodyState.current.marginRight
        ) {
          // Body style shift detected - restoring
          restoreInitialState();
        }
      };

      // Monitor continuously with high frequency
      const stabilizationInterval = setInterval(preventBodyChanges, 16); // ~60fps

      // Also monitor for modal-specific changes
      const modalStabilizationTimer = setTimeout(() => {
        // Modal stabilization check
        preventBodyChanges();
      }, 100);

      return () => {
        // Cleaning up body stabilization
        clearInterval(stabilizationInterval);
        clearTimeout(modalStabilizationTimer);

        // Restore initial state one final time on cleanup
        restoreInitialState();
      };
    }
  }, [isDialogOpen]);

  // Modal content detection with multiple strategies
  React.useEffect(() => {
    if (isDialogOpen) {
      // Modal detection starting

      let retryCount = 0;
      const maxRetries = 15;
      let resizeObserver: ResizeObserver | null = null;

      const findModalContent = (): HTMLElement | null => {
        // Try multiple selectors for Radix Dialog content
        const selectors = [
          "[data-radix-dialog-content]",
          "[data-radix-portal] [data-radix-dialog-content]",
          ".fixed [data-radix-dialog-content]",
          '[role="dialog"]',
          '[data-state="open"][data-radix-dialog-content]',
          "[data-radix-dialog-overlay] + [data-radix-dialog-content]",
          "body > div:last-child [data-radix-dialog-content]",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
            // Found modal content with selector
            return element;
          }
        }
        return null;
      };

      const setupEnhancedTracking = () => {
        const modalContent = findModalContent();

        if (modalContent) {
          // Modal tracking active

          resizeObserver = new ResizeObserver(() => {
            // Modal resize detected
          });

          resizeObserver.observe(modalContent);
          // ResizeObserver active

          return true;
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = Math.min(50 + retryCount * 10, 200); // Progressive delay
            // Detection retry
            setTimeout(setupEnhancedTracking, delay);
          } else {
            // Detection failed
          }
          return false;
        }
      };

      // Start with minimal delay for portal rendering
      setTimeout(setupEnhancedTracking, 5);

      return () => {
        // Cleaning up modal detection
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, [isDialogOpen]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Ticket name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      toast({
        title: "Validation Error",
        description: "Valid price is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sale_starts_at || !formData.sale_ends_at) {
      toast({
        title: "Validation Error",
        description: "Sale dates are required",
        variant: "destructive",
      });
      return;
    }

    const saleStart = new Date(formData.sale_starts_at);
    const saleEnd = new Date(formData.sale_ends_at);

    if (saleStart >= saleEnd) {
      toast({
        title: "Validation Error",
        description: "Sale end date must be after start date",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const url = editingTicket
        ? `/api/admin/events/${eventId}/tickets/${editingTicket.id}`
        : `/api/admin/events/${eventId}/tickets`;

      const method = editingTicket ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: parseFloat(formData.price),
          quantity_available: formData.quantity_available
            ? parseInt(formData.quantity_available)
            : null,
          sale_starts_at: fromKarachiInput(formData.sale_starts_at),
          sale_ends_at: fromKarachiInput(formData.sale_ends_at),
          max_per_person: formData.max_per_person
            ? parseInt(formData.max_per_person)
            : 10,
          people_per_ticket: parseInt(formData.people_per_ticket || "1") || 1,
          min_people_per_ticket:
            parseInt(formData.min_people_per_ticket || "") || null,
          group_name: formData.group_name?.trim() || null,
          group_order: parseInt(formData.group_order || "0") || 0,
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          parchi_price: formData.parchi_price ? parseFloat(formData.parchi_price) : null,
          parchi_original_price: formData.parchi_original_price ? parseFloat(formData.parchi_original_price) : null,
          attendee_fields: formData.attendee_fields ?? [],
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: editingTicket
            ? "Ticket type updated successfully"
            : "Ticket type created successfully",
        });

        setIsDialogOpen(false);
        setEditingTicket(null);
        resetForm();
        fetchTicketTypes();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to save ticket type",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving ticket type:", error);
      toast({
        title: "Error",
        description: "Failed to save ticket type",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingTicket) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/admin/events/${eventId}/tickets/${deletingTicket.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Ticket type deleted successfully",
        });
        setDeletingTicket(null);
        fetchTicketTypes();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete ticket type",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting ticket type:", error);
      toast({
        title: "Error",
        description: "Failed to delete ticket type",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      quantity_available: "",
      sale_starts_at: "",
      sale_ends_at: "",
      max_per_person: "10",
      ticket_url: "",
      people_per_ticket: "1",
      min_people_per_ticket: "1",
      group_name: "",
      group_order: "0",
      original_price: "",
      parchi_price: "",
      parchi_original_price: "",
      is_pdf_flow: false,
      attendee_fields: [],
    });
  };

  const handleSaveEventFields = async () => {
    setIsSavingEventFields(true);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/tickets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_attendee_fields: eventFields }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save");
      setEventFields(result.data?.event_attendee_fields || []);
      toast({ title: "Saved", description: "Additional fields updated" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSavingEventFields(false);
    }
  };

  // Open edit dialog
  const handleEdit = (ticket: TicketType) => {
    setEditingTicket(ticket);
    setFormData({
      name: ticket.name,
      description: ticket.description || "",
      price: ticket.price.toString(),
      quantity_available: ticket.quantity_available?.toString() || "",
      sale_starts_at: toKarachiInput(ticket.sale_starts_at),
      sale_ends_at: toKarachiInput(ticket.sale_ends_at),
      max_per_person: ticket.max_per_person?.toString() || "10",
      ticket_url: ticket.ticket_url || "",
      people_per_ticket: String(ticket.people_per_ticket ?? 1),
      min_people_per_ticket: String(
        ticket.min_people_per_ticket ?? ticket.people_per_ticket ?? 1,
      ),
      group_name: ticket.group_name || "",
      group_order: String(ticket.group_order ?? 0),
      original_price: ticket.original_price?.toString() || "",
      parchi_price: ticket.parchi_price?.toString() || "",
      parchi_original_price: ticket.parchi_original_price?.toString() || "",
      is_pdf_flow: (ticket.pdf_total ?? 0) > 0,
      attendee_fields: ticket.attendee_fields ?? [],
    });
    setIsDialogOpen(true);
  };

  // Header management handlers
  const handleSaveHeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a section header name",
        variant: "destructive",
      });
      return;
    }

    const name = headerForm.name.trim();
    const order = parseInt(headerForm.order || "0", 10) || 0;

    setKnownHeaders((prev) => {
      const filtered = prev.filter((h) => h.name.toLowerCase() !== name.toLowerCase());
      return [...filtered, { name, order }];
    });

    toast({
      title: "Section Header Created",
      description: `Header "${name}" is now ready. Assign tickets to it via the dropdown.`,
    });

    setIsHeaderDialogOpen(false);
    setHeaderForm({ name: "", order: "0" });
  };

  const handleRunSplitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitPdfFile) {
      toast({
        title: "Validation Error",
        description: "Please select a bundled PDF file to import",
        variant: "destructive",
      });
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append("file", splitPdfFile);

    try {
      setIsSplitting(true);
      const res = await fetch(`/api/admin/events/${eventId}/tickets/split-import`, {
        method: "POST",
        body: formDataUpload,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to split and import bundled PDF");
      }

      setSplitResult(json.data);
      toast({
        title: "Bundled PDF Imported Successfully",
        description: `Imported ${json.data.passesUploaded} passes across ${json.data.totalTiers} tiers!`,
      });

      // Refresh ticket types list
      await fetchTicketTypes();
    } catch (error) {
      console.error("Split import error:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import bundled PDF",
        variant: "destructive",
      });
    } finally {
      setIsSplitting(false);
    }
  };

  const handleRevertAll = async () => {
    try {
      setIsRevertingAll(true);
      const res = await fetch(`/api/admin/events/${eventId}/tickets/revert-all`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete tickets");
      }
      toast({
        title: "All Tickets Reverted",
        description: json.message || "All ticket tiers and PDF passes have been deleted.",
      });
      setIsRevertAllDialogOpen(false);
      await fetchTicketTypes();
    } catch (error) {
      toast({
        title: "Revert Failed",
        description: error instanceof Error ? error.message : "Failed to revert all tickets",
        variant: "destructive",
      });
    } finally {
      setIsRevertingAll(false);
    }
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingTicket(null);
    resetForm();
    setIsCustomHeaderInput(false);
    setIsDialogOpen(true);
  };

  const handleCreateForGroup = (groupName?: string, groupOrder?: number) => {
    setEditingTicket(null);
    resetForm();
    if (groupName) {
      setFormData((prev) => ({
        ...prev,
        group_name: groupName,
        group_order: String(groupOrder ?? 0),
      }));
    }
    setIsCustomHeaderInput(false);
    setIsDialogOpen(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTicketCard = (ticket: TicketType) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ticket.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(ticket)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingTicket(ticket)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {ticket.group_name && (
                    <span className="inline-block rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                      Section: {ticket.group_name}
                      {ticket.group_order ? ` (#${ticket.group_order})` : ""}
                    </span>
                  )}
                  {(ticket.people_per_ticket ?? 1) > 1 && (
                    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                      Group of{" "}
                      {ticket.min_people_per_ticket &&
                      ticket.min_people_per_ticket < (ticket.people_per_ticket ?? 1)
                        ? `${ticket.min_people_per_ticket}–${ticket.people_per_ticket}`
                        : ticket.people_per_ticket}
                    </span>
                  )}
                </div>
                {ticket.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ticket.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(ticket.price)}
                      </span>
                      {ticket.original_price && ticket.original_price > ticket.price && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(ticket.original_price)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {Math.round(((ticket.original_price - ticket.price) / ticket.original_price) * 100)}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {ticket.parchi_price && (
                    <div className="flex items-center gap-1.5 text-xs text-[#0069DB] font-semibold bg-[#0069DB]/10 border border-[#0069DB]/20 px-2 py-0.5 rounded-full w-fit">
                      <span>Parchi: {formatCurrency(ticket.parchi_price)}</span>
                      {ticket.parchi_original_price && ticket.parchi_original_price > ticket.parchi_price && (
                        <span className="line-through text-muted-foreground text-[10px]">
                          {formatCurrency(ticket.parchi_original_price)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">
                      {ticket.quantity_available === null
                        ? "Unlimited"
                        : `${ticket.quantity_available} available`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Sale starts: {formatDate(ticket.sale_starts_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Sale ends: {formatDate(ticket.sale_ends_at)}
                    </span>
                  </div>
                  {ticket.ticket_url && (
                    <div className="flex items-center gap-2 text-primary">
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs truncate max-w-[260px]" title={ticket.ticket_url}>
                        {ticket.ticket_url}
                      </span>
                    </div>
                  )}
                </div>

                {ticket.max_per_person && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Max {ticket.max_per_person} per person
                    </span>
                  </div>
                )}

                {/* PDF Inventory Status & Fast Upload */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between flex-wrap gap-2">
                  {(ticket.pdf_total ?? 0) > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{ticket.pdf_available ?? 0} / {ticket.pdf_total} PDFs ready</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Dynamic Inside Pass
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => {
                        setUploadingTicket(ticket);
                        setSelectedFiles(null);
                      }}
                    >
                      <Upload className="h-3 w-3" />
                      Upload PDFs
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="Manage in Ticket PDF Inventory"
                    >
                      <a href="/admin/ticket-pdf-inventory" target="_blank" rel="noopener noreferrer">
                        Manage
                        <ExternalLink className="h-2.5 w-2.5 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Ticket Types</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsHeaderDialogOpen(true)}
            className="flex items-center gap-1.5"
          >
            <FolderPlus className="h-4 w-4 text-primary" />
            + Add Section Header
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSplitResult(null);
              setSplitPdfFile(null);
              setIsSplitImportOpen(true);
            }}
            className="flex items-center gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Import Bundled PDF
          </Button>
          <Button onClick={handleCreate} size="sm" className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Add Ticket Type
          </Button>
          {ticketTypes.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRevertAllDialogOpen(true)}
              className="flex items-center gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              title="Delete all ticket types and inventory PDFs for this event"
            >
              <Trash2 className="h-4 w-4" />
              Revert / Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Questions every ticket of the event asks at checkout */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Additional fields (all tickets)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Extra details buyers fill in at checkout, e.g. university name.
            These apply to every ticket of this event; add fields for one
            ticket only inside that ticket type.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <AttendeeFieldsEditor value={eventFields} onChange={setEventFields} />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void handleSaveEventFields()}
              disabled={isSavingEventFields}
            >
              {isSavingEventFields ? "Saving…" : "Save fields"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Types List */}
      {isLoading && ticketTypes.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ticketTypes.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No ticket types yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first ticket type to start selling tickets for this
              event.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Ticket Type
            </Button>
          </div>
        </Card>
      ) : allHeaders.length > 0 ? (
        <div className="space-y-6">
          {groupedTickets.groups.map((group) => {
            if (group.tickets.length === 0 && !knownHeaders.some((h) => h.name === group.name)) {
              return null;
            }
            return (
              <div
                key={group.name}
                className="rounded-xl border border-primary/20 bg-muted/10 p-4 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        {group.name}
                        {group.order > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            (Sort: #{group.order})
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {group.tickets.length} ticket type{group.tickets.length !== 1 ? "s" : ""} under this header
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateForGroup(group.name, group.order)}
                    className="text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add to this Section
                  </Button>
                </div>

                {group.tickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">
                    No tickets assigned to this section yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.tickets.map(renderTicketCard)}
                  </div>
                )}
              </div>
            );
          })}

          {groupedTickets.ungrouped.length > 0 && (
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div>
                  <h4 className="font-semibold text-sm">General / Ungrouped Tickets</h4>
                  <p className="text-xs text-muted-foreground">
                    {groupedTickets.ungrouped.length} ticket{groupedTickets.ungrouped.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedTickets.ungrouped.map(renderTicketCard)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ticketTypes.map(renderTicketCard)}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          ref={modalRef}
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          style={{
            contain: "layout style paint",
            isolation: "isolate",
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editingTicket ? "Edit Ticket Type" : "Create Ticket Type"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update the ticket type details below."
                : "Fill in the details to create a new ticket type for this event."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section Header / Grouping */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ticket-group-select" className="text-sm font-semibold flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-primary" />
                    Section Header / Group <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assign this ticket to an accordion section (e.g. Day 1, VIP Passes). Multiple tickets share one header.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <select
                    id="ticket-group-select"
                    value={isCustomHeaderInput ? "__new__" : formData.group_name || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__new__") {
                        setIsCustomHeaderInput(true);
                        setFormData((prev) => ({ ...prev, group_name: "", group_order: "0" }));
                      } else {
                        setIsCustomHeaderInput(false);
                        const matched = allHeaders.find((h) => h.name === val);
                        setFormData((prev) => ({
                          ...prev,
                          group_name: val,
                          group_order: matched ? String(matched.order) : "0",
                        }));
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">None (Ungrouped / Standalone Ticket)</option>
                    {allHeaders.map((h) => (
                      <option key={h.name} value={h.name}>
                        📁 {h.name} {h.order ? `(#${h.order})` : ""}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Section Header...</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Input
                    id="ticket-group-order"
                    type="number"
                    min="0"
                    value={formData.group_order || "0"}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, group_order: e.target.value }))
                    }
                    placeholder="Sort Order"
                    title="Section Sort Order (Lower numbers appear first)"
                  />
                </div>
              </div>

              {isCustomHeaderInput && (
                <div className="pt-2 border-t border-border/40">
                  <Label htmlFor="custom-group-name" className="text-xs font-medium text-primary">
                    New Section Header Title:
                  </Label>
                  <Input
                    id="custom-group-name"
                    value={formData.group_name || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, group_name: e.target.value }))
                    }
                    placeholder="e.g. Day 1 - 28th November, Workshop Passes"
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ticket Name */}
              <div className="space-y-2">
                <Label htmlFor="ticket-name" className="text-sm font-medium">
                  Ticket Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., General Admission, VIP, Early Bird"
                  required
                />
              </div>

            </div>

            {/* Native Inside Price & Original Price */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Inside Karachi Pricing (Native)</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ticket-price" className="text-sm font-medium">
                    Price (Rs) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ticket-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-original-price" className="text-sm font-medium">
                    Original Price (Rs) <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="ticket-original-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.original_price || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, original_price: e.target.value }))
                    }
                    placeholder="e.g. 3500"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shows slashed price & % off discount badge on Inside
                  </p>
                </div>
              </div>
            </div>

            {/* Parchi Student Pricing */}
            <div className="p-4 rounded-xl border border-[#0069DB]/30 bg-[#0069DB]/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0069DB]" />
                  <h4 className="text-sm font-semibold text-[#0069DB]">Parchi Student Pricing</h4>
                </div>
                <span className="text-[11px] text-muted-foreground">Unlocked via Parchi 2FA at checkout</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ticket-parchi-price" className="text-sm font-medium">
                    Parchi Price (Rs) <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="ticket-parchi-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.parchi_price || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, parchi_price: e.target.value }))
                    }
                    placeholder="e.g. 2499"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Exclusive rate for verified students
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-parchi-original-price" className="text-sm font-medium">
                    Parchi Comparison Price (Rs) <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="ticket-parchi-original-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.parchi_original_price || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, parchi_original_price: e.target.value }))
                    }
                    placeholder="e.g. 2999"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Slashed comparison for students (defaults to native price)
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="ticket-description"
                className="text-sm font-medium"
              >
                Description{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="ticket-description"
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value.slice(0, DESCRIPTION_MAX_LENGTH);
                  setFormData((prev) => ({ ...prev, description: value }));
                }}
                placeholder="Describe what this ticket includes, e.g., access to all areas, complimentary drinks, etc."
                className="resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length}/{DESCRIPTION_MAX_LENGTH}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quantity Available */}
              <div className="space-y-2">
                <Label
                  htmlFor="ticket-quantity"
                  className="text-sm font-medium"
                >
                  Quantity Available
                </Label>
                <Input
                  id="ticket-quantity"
                  type="number"
                  min="0"
                  value={formData.quantity_available}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity_available: e.target.value,
                    }))
                  }
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited tickets
                </p>
              </div>

              {/* Max Per Person */}
              <div className="space-y-2">
                <Label htmlFor="max-per-person" className="text-sm font-medium">
                  Max tickets per buyer
                </Label>
                <Input
                  id="max-per-person"
                  type="number"
                  min="1"
                  value={formData.max_per_person}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_per_person: e.target.value,
                    }))
                  }
                  placeholder="10"
                />
              </div>

              <GroupSizeInputs
                min={formData.min_people_per_ticket ?? "1"}
                max={formData.people_per_ticket ?? "1"}
                onChange={({ min, max }) =>
                  setFormData((prev) => ({
                    ...prev,
                    min_people_per_ticket: min,
                    people_per_ticket: max,
                  }))
                }
              />

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">
                  Additional fields for this ticket only (optional)
                </Label>
                <AttendeeFieldsEditor
                  value={formData.attendee_fields ?? []}
                  onChange={(next) =>
                    setFormData((prev) => ({ ...prev, attendee_fields: next }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ticket-url" className="text-sm font-medium">
                  External Ticket Link (Optional)
                </Label>
                <Input
                  id="ticket-url"
                  type="url"
                  value={formData.ticket_url}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      ticket_url: e.target.value,
                    }))
                  }
                  placeholder="https://ticketwala.pk/... or organizer site"
                />
                <p className="text-xs text-muted-foreground">
                  Redirects buyers directly to this URL instead of Inside checkout.
                </p>
              </div>
            </div>

            <Separator />

            {/* Pre-Uploaded Ticket PDF Flow Toggle */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold">Pre-Uploaded Ticket PDF Flow</h4>
                    <p className="text-xs text-muted-foreground">
                      Sell pre-issued PDF passes (e.g. Ticketwala / external barcodes) instead of dynamic generation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ticket-pdf-flow-toggle" className="text-xs font-medium cursor-pointer">
                    {formData.is_pdf_flow ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id="ticket-pdf-flow-toggle"
                    checked={Boolean(formData.is_pdf_flow)}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_pdf_flow: checked }))
                    }
                  />
                </div>
              </div>

              {formData.is_pdf_flow && (
                <div className="pt-2 border-t border-border/40 space-y-2">
                  {editingTicket ? (
                    <div className="flex items-center justify-between bg-background p-2.5 rounded-lg border border-border/50 text-xs">
                      <div>
                        <span className="font-semibold text-foreground">
                          {editingTicket.pdf_available ?? 0} available
                        </span>{" "}
                        <span className="text-muted-foreground">
                          ({editingTicket.pdf_total ?? 0} total PDFs uploaded)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setUploadingTicket(editingTicket);
                            setSelectedFiles(null);
                          }}
                        >
                          <Upload className="h-3 w-3" />
                          Upload More PDFs
                        </Button>
                        <Button
                          asChild
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                        >
                          <a href="/admin/ticket-pdf-inventory" target="_blank" rel="noopener noreferrer">
                            Manage in Inventory
                            <ExternalLink className="h-2.5 w-2.5 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Save this ticket type first. Once saved, you can immediately upload your PDF batch directly to this tier.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sale Dates */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sale Period
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sale-start" className="text-sm font-medium">
                    Sale Starts <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sale-start"
                    type="datetime-local"
                    value={formData.sale_starts_at}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sale_starts_at: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale-end" className="text-sm font-medium">
                    Sale Ends <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sale-end"
                    type="datetime-local"
                    value={formData.sale_ends_at}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sale_ends_at: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {editingTicket ? "Updating..." : "Creating..."}
                  </div>
                ) : editingTicket ? (
                  "Update Ticket Type"
                ) : (
                  "Create Ticket Type"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick PDF Upload Dialog */}
      <Dialog open={!!uploadingTicket} onOpenChange={(open) => !open && setUploadingTicket(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Ticket PDFs
            </DialogTitle>
            <DialogDescription>
              Upload pre-issued PDF passes for &ldquo;{uploadingTicket?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadPdfs} className="space-y-4 pt-2">
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span>Current Inventory:</span>
                <span className="text-primary font-semibold">
                  {uploadingTicket?.pdf_available ?? 0} available / {uploadingTicket?.pdf_total ?? 0} total
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Each uploaded PDF file counts as 1 available ticket in stock.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-files-input" className="text-sm font-medium">
                Select PDF Files (.pdf)
              </Label>
              <Input
                id="pdf-files-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="cursor-pointer"
                required
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-xs text-primary font-medium">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected for upload
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                asChild
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <a href="/admin/ticket-pdf-inventory" target="_blank" rel="noopener noreferrer">
                  Full Inventory Page
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadingTicket(null)}
                  disabled={isUploadingPdfs}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploadingPdfs || !selectedFiles || selectedFiles.length === 0}
                >
                  {isUploadingPdfs ? "Uploading..." : "Upload PDFs"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Section Header Dialog */}
      <Dialog open={isHeaderDialogOpen} onOpenChange={setIsHeaderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Create Section Header
            </DialogTitle>
            <DialogDescription>
              Group tickets under a collapsible accordion header on the event page (e.g. Day 1 - 28th November).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveHeader} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-header-name" className="text-sm font-medium">
                Section Header Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-header-name"
                value={headerForm.name}
                onChange={(e) => setHeaderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Day 1 - 28th November, VIP Passes, Workshop"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-header-order" className="text-sm font-medium">
                Group Sort Order <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="new-header-order"
                type="number"
                min="0"
                value={headerForm.order}
                onChange={(e) => setHeaderForm((prev) => ({ ...prev, order: e.target.value }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first on the event page.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHeaderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Section Header
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Auto-Import & Split Bundled PDF Dialog */}
      <Dialog open={isSplitImportOpen} onOpenChange={(open) => !open && !isSplitting && setIsSplitImportOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Auto-Import & Split Bundled Ticket PDF
            </DialogTitle>
            <DialogDescription>
              Upload a multi-pass bundled PDF (e.g. Ticketwala). Pages will be sliced, grouped into shows/tiers, ticket types created with Pre-Uploaded PDF flow enabled, and passes saved into inventory.
            </DialogDescription>
          </DialogHeader>

          {!splitResult ? (
            <form onSubmit={handleRunSplitImport} className="space-y-4 pt-2">
              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-xl p-6 text-center space-y-3 transition-colors bg-muted/20">
                <FileText className="h-10 w-10 text-primary mx-auto opacity-80" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {splitPdfFile ? splitPdfFile.name : "Select or Drop Bundled PDF"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {splitPdfFile
                      ? `${(splitPdfFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to slice & import`
                      : "Multi-page pass PDF (e.g. 80-page Ticketwala bundle)"}
                  </p>
                </div>
                <Input
                  ref={splitInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setSplitPdfFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="bundled-pdf-file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => splitInputRef.current?.click()}
                  disabled={isSplitting}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {splitPdfFile ? "Change PDF" : "Choose PDF File"}
                </Button>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  What happens automatically:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 text-[11px]">
                  <li>Slices multi-page PDF into standalone 1-page passes</li>
                  <li>Reads Show line (e.g. <em>Day 1 - 28th November</em>) and groups tiers under that header</li>
                  <li>Reads Ticket name and auto-creates clean ticket types</li>
                  <li>Pre-Uploaded PDF Flow is enabled automatically</li>
                  <li>Passes are uploaded to DO Spaces and added to inventory</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSplitImportOpen(false)}
                  disabled={isSplitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSplitting || !splitPdfFile}
                  className="min-w-[140px]"
                >
                  {isSplitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Slicing & Uploading…</span>
                    </div>
                  ) : (
                    "Split & Import Passes"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-emerald-800 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Import Complete!
                </p>
                <p className="text-muted-foreground text-xs">
                  Processed {splitResult.totalPages} pages across {splitResult.totalTiers} tiers ({splitResult.passesUploaded} passes ready in inventory).
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {splitResult.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-border/70 bg-background flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.ticket}</p>
                      <p className="text-[11px] text-muted-foreground">📁 {item.show}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-600">
                        {item.passesCount} passes
                      </span>
                      <p className="text-[10px] text-muted-foreground">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => setIsSplitImportOpen(false)}
                >
                  Done & View Tickets
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deletingTicket}
        onClose={() => setDeletingTicket(null)}
        onConfirm={handleDelete}
        title="Delete Ticket Type"
        description={`Are you sure you want to delete "${deletingTicket?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isLoading}
      />

      {/* Revert / Delete All Tickets Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isRevertAllDialogOpen}
        onClose={() => setIsRevertAllDialogOpen(false)}
        onConfirm={handleRevertAll}
        title="Delete All Ticket Types & Passes?"
        description="This will permanently delete all ticket types and all uploaded inventory PDF passes for this event, giving you a fresh clean slate. This action cannot be undone."
        confirmText="Yes, Delete All"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isRevertingAll}
      />
    </div>
  );
}
