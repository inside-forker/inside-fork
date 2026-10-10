"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Ticket,
  Users,
  Banknote,
  Clock,
  Upload,
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
import { Badge } from "@/components/ui/badge";
import { TicketPdfUploadDialog } from "@/components/ticketing/TicketPdfUploadDialog";

const DESCRIPTION_MAX_LENGTH = 500;

interface TicketType {
  id: number;
  event_id: number;
  name: string;
  description?: string | null;
  price: number;
  quantity_available: number;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  max_per_person: number;
}

interface TicketFormData {
  name: string;
  description: string;
  price: string;
  quantity_available: string;
  sale_starts_at: string;
  sale_ends_at: string;
  max_per_person: string;
}

interface PdfTierStock {
  ticket_type_id: number;
  total: number;
  sold: number;
  available: number;
}

interface OrganizerTicketManagementProps {
  eventId: number;
}

export function OrganizerTicketManagement({
  eventId,
}: OrganizerTicketManagementProps) {
  const [ticketTypes, setTicketTypes] = React.useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTicket, setEditingTicket] = React.useState<TicketType | null>(
    null
  );
  const [deletingTicket, setDeletingTicket] = React.useState<TicketType | null>(
    null
  );
  const [uploadTicket, setUploadTicket] = React.useState<TicketType | null>(
    null
  );
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
  const { toast } = useToast();

  const modalRef = React.useRef<HTMLDivElement>(null);

  // Capture initial body state
  const initialBodyState = React.useRef({
    scrollHeight: 0,
    clientHeight: 0,
    marginRight: "",
    paddingRight: "",
    overflow: "",
    position: "",
  });

  const fetchPdfInventory = React.useCallback(async () => {
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

  // Fetch ticket types
  const fetchTicketTypes = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/organizer/events/${eventId}/tickets`);

      if (response.ok) {
        const data = await response.json();
        setTicketTypes(data.data?.ticket_types || []);
        void fetchPdfInventory();
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
  }, [eventId, toast, fetchPdfInventory]);

  React.useEffect(() => {
    fetchTicketTypes();
  }, [fetchTicketTypes]);

  // Initialize body state capture
  React.useEffect(() => {
    const body = document.body;
    initialBodyState.current = {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      marginRight: body.style.marginRight || getComputedStyle(body).marginRight,
      paddingRight:
        body.style.paddingRight || getComputedStyle(body).paddingRight,
      overflow: body.style.overflow || getComputedStyle(body).overflow,
      position: body.style.position || getComputedStyle(body).position,
    };
  }, []);

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

  // Apply containment to modal
  React.useEffect(() => {
    if (isDialogOpen && modalRef.current) {
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
    }
  }, [isDialogOpen]);

  const handleOpenDialog = (ticket?: TicketType) => {
    if (ticket) {
      setEditingTicket(ticket);
      setFormData({
        name: ticket.name,
        description: ticket.description || "",
        price: ticket.price.toString(),
        quantity_available: ticket.quantity_available.toString(),
        sale_starts_at: ticket.sale_starts_at
          ? new Date(ticket.sale_starts_at).toISOString().slice(0, 16)
          : "",
        sale_ends_at: ticket.sale_ends_at
          ? new Date(ticket.sale_ends_at).toISOString().slice(0, 16)
          : "",
        max_per_person: ticket.max_per_person.toString(),
      });
    } else {
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
    }
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.quantity_available) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingTicket
        ? `/api/organizer/events/${eventId}/tickets?ticketId=${editingTicket.id}`
        : `/api/organizer/events/${eventId}/tickets`;

      const method = editingTicket ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          description: formData.description.trim() || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: editingTicket
            ? "Ticket type updated successfully"
            : "Ticket type created successfully",
        });
        handleCloseDialog();
        fetchTicketTypes();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save ticket type");
      }
    } catch (error) {
      console.error("Error saving ticket type:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save ticket type",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingTicket) return;

    try {
      const response = await fetch(
        `/api/organizer/events/${eventId}/tickets?ticketId=${deletingTicket.id}`,
        { method: "DELETE" }
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
        throw new Error(error.error || "Failed to delete ticket type");
      }
    } catch (error) {
      console.error("Error deleting ticket type:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete ticket type",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <div className="text-lg font-medium text-muted-foreground">
          Loading tickets...
        </div>
      </div>
    );
  }

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

      {/* Ticket List */}
      {ticketTypes.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No ticket types yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first ticket type to start selling tickets for this
              event.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Ticket Type
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ticketTypes.map((ticket) => {
            const pdfStock = pdfStockByType[ticket.id];
            return (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ticket.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadTicket(ticket)}
                      className="h-8 w-8 p-0"
                      title="Upload PDF tickets"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
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
                      Max {ticket.max_per_person} per person
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadTicket(ticket)}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload PDFs
                  </Button>
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
              {editingTicket ? "Edit Ticket Type" : "Create Ticket Type"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update the ticket type details."
                : "Fill in the details for the new ticket type."}
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
                placeholder="e.g., General Admission"
                required
              />
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
                placeholder="Describe what this ticket includes..."
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
                  required
                />
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
                  required
                />
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
              <Label htmlFor="ticket-start">Sale Starts</Label>
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-end">Sale Ends</Label>
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
              />
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
                {editingTicket ? "Update" : "Create"}
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
        title="Delete Ticket Type"
        description={`Are you sure you want to delete "${deletingTicket?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {uploadTicket && (
        <TicketPdfUploadDialog
          open={!!uploadTicket}
          onOpenChange={(open) => {
            if (!open) setUploadTicket(null);
          }}
          ticketTypeId={uploadTicket.id}
          ticketTypeName={uploadTicket.name}
          uploadUrl={`/api/organizer/events/${eventId}/ticket-pdf-inventory/upload`}
          onSuccess={() => {
            void fetchTicketTypes();
          }}
        />
      )}
    </div>
  );
}
