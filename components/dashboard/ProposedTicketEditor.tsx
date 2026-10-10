"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  Ticket,
  Users,
  Banknote,
  Clock,
  AlertCircle,
  Upload,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ProposedTicketType } from "@/types/event-change-request.types";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TicketPdfUploadDialog } from "@/components/ticketing/TicketPdfUploadDialog";

const DESCRIPTION_MAX_LENGTH = 500;

type PdfTierStock = {
  ticket_type_id: number;
  total: number;
  sold: number;
  available: number;
};

interface TicketFormData {
  name: string;
  description: string;
  price: string;
  quantity_available: string;
  sale_starts_at: string;
  sale_ends_at: string;
  max_per_person: string;
}

interface ProposedTicketEditorProps {
  tickets: ProposedTicketType[];
  onTicketsChange: (tickets: ProposedTicketType[]) => void;
  eventStartTime?: string;
  eventEndTime?: string;
  /** When set (existing event), enable PDF inventory upload + stock for saved tiers. */
  eventId?: number | null;
}

export function ProposedTicketEditor({
  tickets,
  onTicketsChange,
  eventStartTime,
  eventEndTime: _eventEndTime,
  eventId = null,
}: ProposedTicketEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTicket, setEditingTicket] =
    React.useState<ProposedTicketType | null>(null);
  const [deletingTicket, setDeletingTicket] =
    React.useState<ProposedTicketType | null>(null);
  const [uploadTicket, setUploadTicket] =
    React.useState<ProposedTicketType | null>(null);
  const [pdfStockByType, setPdfStockByType] = React.useState<
    Record<number, PdfTierStock>
  >({});
  const [formData, setFormData] = React.useState<TicketFormData>({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
    sale_starts_at: "",
    sale_ends_at: "",
    max_per_person: "10",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const modalRef = React.useRef<HTMLDivElement>(null);

  const fetchPdfInventory = React.useCallback(async () => {
    if (!eventId || !Number.isInteger(eventId) || eventId <= 0) {
      setPdfStockByType({});
      return;
    }
    try {
      const response = await fetch(
        `/api/organizer/events/${eventId}/ticket-pdf-inventory`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = await response.json();
      const tiers = (data.data?.tiers ?? []) as PdfTierStock[];
      const map: Record<number, PdfTierStock> = {};
      for (const tier of tiers) {
        map[tier.ticket_type_id] = tier;
      }
      setPdfStockByType(map);
    } catch (error) {
      console.error("Error fetching PDF inventory:", error);
    }
  }, [eventId]);

  React.useEffect(() => {
    void fetchPdfInventory();
  }, [fetchPdfInventory]);

  // Prevent scroll lock layout shift
  React.useEffect(() => {
    if (isDialogOpen) {
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
  }, [isDialogOpen]);

  const handleOpenDialog = (ticket?: ProposedTicketType) => {
    if (ticket) {
      setEditingTicket(ticket);
      setFormData({
        name: ticket.name,
        description: ticket.description || "",
        price: ticket.price.toString(),
        quantity_available: ticket.quantity_available?.toString() || "",
        sale_starts_at: ticket.sale_starts_at
          ? new Date(ticket.sale_starts_at).toISOString().slice(0, 16)
          : "",
        sale_ends_at: ticket.sale_ends_at
          ? new Date(ticket.sale_ends_at).toISOString().slice(0, 16)
          : "",
        max_per_person: ticket.max_per_person?.toString() || "10",
      });
    } else {
      setEditingTicket(null);
      // Set default sale times: starts NOW, ends 1 hour before event starts
      const now = new Date();
      const defaultStart = now.toISOString().slice(0, 16);

      // Sale ends 1 hour before event starts (or event start if not enough time)
      let defaultEnd = "";
      if (eventStartTime) {
        const eventStart = new Date(eventStartTime);
        const oneHourBefore = new Date(eventStart.getTime() - 60 * 60 * 1000);
        // If event is less than 1 hour away, use event start time
        defaultEnd = (oneHourBefore > now ? oneHourBefore : eventStart)
          .toISOString()
          .slice(0, 16);
      }

      setFormData({
        name: "",
        description: "",
        price: "",
        quantity_available: "",
        sale_starts_at: defaultStart,
        sale_ends_at: defaultEnd,
        max_per_person: "10",
      });
    }
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTicket(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      quantity_available: "",
      sale_starts_at: "",
      sale_ends_at: "",
      max_per_person: "10",
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      newErrors.price = "Valid price is required";
    }

    if (
      !formData.quantity_available ||
      parseInt(formData.quantity_available) < 1
    ) {
      newErrors.quantity_available = "Quantity must be at least 1";
    }

    if (!formData.sale_starts_at) {
      newErrors.sale_starts_at = "Sale start date is required";
    }

    if (!formData.sale_ends_at) {
      newErrors.sale_ends_at = "Sale end date is required";
    }

    if (formData.sale_starts_at && formData.sale_ends_at) {
      const start = new Date(formData.sale_starts_at);
      const end = new Date(formData.sale_ends_at);
      if (end <= start) {
        newErrors.sale_ends_at = "Sale end must be after sale start";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const ticketData: ProposedTicketType = {
      id: editingTicket?.id, // Preserve ID if editing existing
      temp_id: editingTicket?.temp_id || uuidv4(),
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: parseFloat(formData.price),
      quantity_available: parseInt(formData.quantity_available),
      sale_starts_at: new Date(formData.sale_starts_at).toISOString(),
      sale_ends_at: new Date(formData.sale_ends_at).toISOString(),
      max_per_person: parseInt(formData.max_per_person) || 10,
    };

    if (editingTicket) {
      // Update existing
      onTicketsChange(
        tickets.map((t) =>
          t.temp_id === editingTicket.temp_id ? ticketData : t
        )
      );
    } else {
      // Add new
      onTicketsChange([...tickets, ticketData]);
    }

    handleCloseDialog();
  };

  const handleDelete = () => {
    if (!deletingTicket) return;
    onTicketsChange(
      tickets.filter((t) => t.temp_id !== deletingTicket.temp_id)
    );
    setDeletingTicket(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Ticket Type
        </Button>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400">
          <p className="font-medium">Define Your Tickets</p>
          <p className="mt-1">
            {eventId
              ? "Edit ticket types here. For saved categories you can upload Ticketwala PDF inventory (stock counts only — no pool download)."
              : "Add ticket types here. They will be reviewed along with your event and created after approval."}
          </p>
        </div>
      </div>

      {/* Ticket List */}
      {tickets.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No ticket types yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first ticket type. They will be reviewed along with
              your event.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Ticket Type
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map((ticket) => {
            const savedTypeId =
              typeof ticket.id === "number" && ticket.id > 0
                ? ticket.id
                : null;
            const canUploadPdfs = Boolean(eventId && savedTypeId);
            const pdfStock = savedTypeId
              ? pdfStockByType[savedTypeId]
              : undefined;

            return (
            <Card
              key={ticket.temp_id || ticket.id || ticket.name}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ticket.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    {canUploadPdfs && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadTicket(ticket)}
                        className="h-8 w-8 p-0"
                        title="Upload PDF tickets"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(ticket)}
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
                {ticket.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ticket.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-600">
                      {formatCurrency(ticket.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">
                      {pdfStock
                        ? `${pdfStock.available} of ${pdfStock.total} left`
                        : ticket.quantity_available === null
                          ? "Unlimited"
                          : `${ticket.quantity_available} available`}
                    </span>
                  </div>
                </div>

                {pdfStock && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">PDF pool</Badge>
                    <span className="text-xs text-muted-foreground">
                      {pdfStock.sold} sold · {pdfStock.available} available
                    </span>
                  </div>
                )}

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
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Max {ticket.max_per_person || 10} per person
                    </span>
                  </div>
                  {canUploadPdfs && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadTicket(ticket)}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload PDFs
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent ref={modalRef} className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTicket ? "Edit Ticket Type" : "Add Ticket Type"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update the ticket type details."
                : "Define a ticket type for your event."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ticket-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., General Admission, VIP Pass"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-description">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-price">
                  Price (PKR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-price"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0"
                  className={errors.price ? "border-red-500" : ""}
                />
                {errors.price && (
                  <p className="text-sm text-red-500">{errors.price}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-quantity">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-quantity"
                  type="number"
                  min="1"
                  value={formData.quantity_available}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity_available: e.target.value,
                    }))
                  }
                  placeholder="100"
                  className={errors.quantity_available ? "border-red-500" : ""}
                />
                {errors.quantity_available && (
                  <p className="text-sm text-red-500">
                    {errors.quantity_available}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-max">Max Per Person</Label>
              <Input
                id="ticket-max"
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

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="ticket-start">
                Sale Starts <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ticket-start"
                type="datetime-local"
                value={formData.sale_starts_at}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sale_starts_at: e.target.value,
                  }))
                }
                className={errors.sale_starts_at ? "border-red-500" : ""}
              />
              {errors.sale_starts_at && (
                <p className="text-sm text-red-500">{errors.sale_starts_at}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-end">
                Sale Ends <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ticket-end"
                type="datetime-local"
                value={formData.sale_ends_at}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sale_ends_at: e.target.value,
                  }))
                }
                className={errors.sale_ends_at ? "border-red-500" : ""}
              />
              {errors.sale_ends_at && (
                <p className="text-sm text-red-500">{errors.sale_ends_at}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingTicket ? "Update" : "Add Ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deletingTicket}
        onClose={() => setDeletingTicket(null)}
        onConfirm={handleDelete}
        title="Remove Ticket Type"
        description={`Are you sure you want to remove "${deletingTicket?.name}"?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
      />

      {eventId &&
        uploadTicket &&
        typeof uploadTicket.id === "number" &&
        uploadTicket.id > 0 && (
          <TicketPdfUploadDialog
            open={!!uploadTicket}
            onOpenChange={(open) => {
              if (!open) setUploadTicket(null);
            }}
            ticketTypeId={uploadTicket.id}
            ticketTypeName={uploadTicket.name}
            uploadUrl={`/api/organizer/events/${eventId}/ticket-pdf-inventory/upload`}
            onSuccess={() => {
              void fetchPdfInventory();
            }}
          />
        )}
    </div>
  );
}
