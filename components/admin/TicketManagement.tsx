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

  const existingGroupNames = React.useMemo(() => {
    const names = new Set<string>();
    ticketTypes.forEach((t) => {
      if (t.group_name?.trim()) names.add(t.group_name.trim());
    });
    return Array.from(names);
  }, [ticketTypes]);

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

  // Open create dialog
  const handleCreate = () => {
    setEditingTicket(null);
    resetForm();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Ticket Types</h3>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Ticket Type
        </Button>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ticketTypes.map((ticket) => (
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
          ))}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-border/60 bg-muted/30">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="ticket-group-name" className="text-sm font-medium">
                  Section Header / Group <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="ticket-group-name"
                  list="ticket-group-suggestions"
                  value={formData.group_name || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, group_name: e.target.value }))
                  }
                  placeholder="e.g. Day 1 - 28th November, VIP Passes, Workshop"
                />
                <datalist id="ticket-group-suggestions">
                  {existingGroupNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Tickets sharing this header are grouped under collapsible accordions on the event page.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-group-order" className="text-sm font-medium">
                  Group Sort Order <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="ticket-group-order"
                  type="number"
                  min="0"
                  value={formData.group_order || "0"}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, group_order: e.target.value }))
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first.
                </p>
              </div>
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
    </div>
  );
}
