"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  XCircle,
  AlertCircle,
  Tag,
  Clock,
  Users,
  MapPin,
  Image as ImageIcon,
  Ticket,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type {
  EventChangeRequest,
  EventFormData,
  EventProposedData,
  ProposedTicketType,
} from "@/types/event-change-request.types";
import type { EventImage } from "@/types/events.types";
import { EventGalleryUpload } from "@/components/admin/EventGalleryUpload";
import { ProposedTicketEditor } from "./ProposedTicketEditor";

interface Category {
  value: string;
  label: string;
  slug: string;
}

interface ExistingTicket {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  quantity_available: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  max_per_person: number;
}

interface RejectedRequestModalProps {
  request: EventChangeRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onResubmit: (data: EventFormData) => Promise<void>;
  isSaving: boolean;
}

export function RejectedRequestModal({
  request,
  isOpen,
  onClose,
  onResubmit,
  isSaving,
}: RejectedRequestModalProps) {
  const proposed = request?.proposed_data as EventProposedData | null;
  const { toast } = useToast();

  const [formData, setFormData] = React.useState<EventFormData>({
    name: "",
    description: "",
    start_time: "",
    end_time: "",
    location_name: "",
    address: "",
    latitude: null,
    longitude: null,
    category_id: null,
    max_capacity: null,
    is_featured: false,
    status: "draft",
    require_guest_details: false,
  });

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [images, setImages] = React.useState<EventImage[]>([]);
  // Track images marked for deletion (soft delete - persisted on Save)
  const [pendingImageDeletions, setPendingImageDeletions] = React.useState<
    Set<number>
  >(new Set());
  const [proposedTickets, setProposedTickets] = React.useState<
    ProposedTicketType[]
  >([]);
  const [tempSessionId] = React.useState(() => uuidv4());
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Capture initial body state on component mount - BEFORE any modal interactions
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

  // Initialize body state capture
  React.useEffect(() => {
    const body = document.body;
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
  }, []);

  // Apply CSS containment when modal opens
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
    }
  }, [isOpen]);

  // Load data (proposed + existing if update)
  React.useEffect(() => {
    if (!isOpen || !request) return;

    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // 1. Fetch static data (categories)
        const categoriesRes = await fetch("/api/categories?all=true");

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data.categories || []);
        }

        // 2. Set Form Data from Proposed
        if (proposed) {
          setFormData({
            name: proposed.name || "",
            description: proposed.description || "",
            start_time: proposed.start_time
              ? new Date(proposed.start_time).toISOString().slice(0, 16)
              : "",
            end_time: proposed.end_time
              ? new Date(proposed.end_time).toISOString().slice(0, 16)
              : "",
            location_name: proposed.location_name || "",
            address: proposed.address || "",
            latitude: proposed.latitude ?? null,
            longitude: proposed.longitude ?? null,
            category_id: proposed.category_id || null,
            max_capacity: proposed.max_capacity || null,
            is_featured: proposed.is_featured || false,
            status: proposed.status || "draft",
            require_guest_details: proposed.require_guest_details || false,
          });
        }

        // 3. Handle Images (Proposed > Existing > Empty)
        if (proposed?.temp_images && proposed.temp_images.length > 0) {
          setImages(
            proposed.temp_images.map((img, idx) => ({
              id: idx,
              event_id: 0,
              url: img.url,
              alt_text: img.alt_text || "",
              is_primary: img.is_primary || idx === 0,
              display_order: img.display_order ?? idx,
              created_at: new Date().toISOString(),
            })),
          );
          setPendingImageDeletions(new Set());
        } else if (request.event_id) {
          // Fetch existing images for update request
          const imagesRes = await fetch(
            `/api/organizer/events/${request.event_id}/images`,
          );
          if (imagesRes.ok) {
            const data = await imagesRes.json();
            setImages(data.images || []);
            setPendingImageDeletions(new Set());
          } else {
            setImages([]);
            setPendingImageDeletions(new Set());
          }
        } else {
          setImages([]);
          setPendingImageDeletions(new Set());
        }

        // 4. Handle Tickets (Proposed > Existing > Empty)
        if (proposed?.temp_tickets && proposed.temp_tickets.length > 0) {
          setProposedTickets(proposed.temp_tickets);
        } else if (request.event_id) {
          // Fetch existing tickets for update request
          const ticketsRes = await fetch(
            `/api/organizer/events/${request.event_id}/tickets`,
          );
          if (ticketsRes.ok) {
            const data = await ticketsRes.json();
            // Convert existing tickets to ProposedTicketType
            const existingTickets = (data.data?.ticket_types || []).map(
              (t: ExistingTicket) => ({
                id: t.id, // Preserve ID for updates
                temp_id: uuidv4(),
                name: t.name,
                description: t.description,
                price: t.price,
                quantity_available: t.quantity_available,
                sale_starts_at: t.sale_starts_at || "",
                sale_ends_at: t.sale_ends_at || "",
                max_per_person: t.max_per_person,
              }),
            );
            setProposedTickets(existingTickets);
          } else {
            setProposedTickets([]);
          }
        } else {
          setProposedTickets([]);
        }

        setErrors({});
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error",
          description: "Failed to load request data.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, request, proposed, toast]);

  // Cleanup temp images when modal closes without saving
  React.useEffect(() => {
    if (!isOpen && images.length > 0 && tempSessionId) {
      // Only cleanup if we have new temp images (not the original ones from proposed_data)
      const hasNewTempImages = images.some(
        (img) =>
          img.url.includes(`temp/${tempSessionId}`) ||
          img.url.includes("temp-images"),
      );
      if (hasNewTempImages) {
        fetch("/api/organizer/events/temp-images/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempSessionId }),
        }).catch(console.error);
      }
    }
  }, [isOpen, images, tempSessionId]);

  // Prevent Radix scroll lock from causing layout shifts
  React.useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const html = document.documentElement;

      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

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

      const restoreInitialState = () => {
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
        html.style.overflow = "visible";
        html.style.height = "auto";
      };

      restoreInitialState();

      const preventBodyChanges = () => {
        const currentScrollHeight = body.scrollHeight;
        const currentClientHeight = body.clientHeight;
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
        const computedStyle = getComputedStyle(body);
        if (
          computedStyle.overflow !== initialBodyState.current.overflow ||
          computedStyle.position !== initialBodyState.current.position ||
          computedStyle.marginRight !== initialBodyState.current.marginRight
        ) {
          restoreInitialState();
        }
      };

      const stabilizationInterval = setInterval(preventBodyChanges, 16);

      return () => {
        observer.disconnect();
        clearInterval(stabilizationInterval);
        removeScrollLock();
      };
    }
  }, [isOpen]);

  const handleInputChange = (
    field: keyof EventFormData,
    value: string | number | boolean | null,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Event name is required";
    }

    if (!formData.start_time) {
      newErrors.start_time = "Start time is required";
    }

    if (!formData.end_time) {
      newErrors.end_time = "End time is required";
    }

    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      if (end <= start) {
        newErrors.end_time = "End time must be after start time";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Filter out images marked for deletion when submitting
    const activeImages = images.filter(
      (img) => !pendingImageDeletions.has(img.id),
    );

    const submitData = {
      ...formData,
      ...(activeImages.length > 0
        ? {
            temp_images: activeImages.map((img, index) => ({
              url: img.url,
              alt_text: img.alt_text || "",
              is_primary: img.is_primary || index === 0,
              display_order: img.display_order ?? index,
            })),
            temp_session_id: tempSessionId,
          }
        : {}),
      temp_tickets: proposedTickets,
    };

    await onResubmit(submitData);

    // Clear pending deletions after successful submission
    setPendingImageDeletions(new Set());
  };

  const handleCancel = () => {
    // Clear pending deletions (user cancelled, don't delete anything)
    setPendingImageDeletions(new Set());
    onClose();
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={modalRef}
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Edit Rejected Request
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Review feedback, make corrections, and resubmit for approval.
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="bg-red-500/10 border-red-500/30 text-red-600"
            >
              Rejected
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Rejection Reason */}
          {request.review_notes && (
            <Card className="mb-6 border-red-500/30 bg-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Rejection Reason
                    </p>
                    <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                      {request.review_notes}
                    </p>
                    {request.reviewed_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Rejected on{" "}
                        {format(new Date(request.reviewed_at), "PPp")}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center h-full py-24">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <div className="text-lg font-medium text-muted-foreground">
                Loading...
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger
                  value="details"
                  className="flex items-center gap-2"
                >
                  <Tag className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="gallery"
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  Gallery
                  {images.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {images.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="tickets"
                  className="flex items-center gap-2"
                >
                  <Ticket className="h-4 w-4" />
                  Tickets
                  {proposedTickets.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {proposedTickets.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-8">
                {/* Resubmission Notice */}
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-400">
                    <p className="font-medium">Resubmission</p>
                    <p className="mt-1">
                      Make the necessary corrections and submit again for
                      approval.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Basic Information */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">Basic Information</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-name"
                          className="text-sm font-medium"
                        >
                          Event Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="rej-name"
                          value={formData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                          placeholder="Enter a compelling event name"
                          className={`h-11 ${
                            errors.name ? "border-red-500" : ""
                          }`}
                          required
                        />
                        {errors.name && (
                          <p className="text-sm text-red-500">{errors.name}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-description"
                          className="text-sm font-medium"
                        >
                          Description
                        </Label>
                        <Textarea
                          id="rej-description"
                          value={formData.description || ""}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                          placeholder="Describe your event, what attendees can expect, and any special highlights..."
                          rows={4}
                          className="min-h-[100px] resize-y"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Date & Time */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">Date & Time</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-start-datetime-picker"
                          className="text-sm font-medium"
                        >
                          Start Date & Time{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(
                                "rej-start-datetime-picker",
                              ) as HTMLInputElement;
                              if (input?.showPicker) input.showPicker();
                              else input?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="rej-start-datetime-picker"
                            type="datetime-local"
                            value={formData.start_time}
                            onChange={(e) =>
                              handleInputChange("start_time", e.target.value)
                            }
                            className={`h-11 pl-10 date-input-hide-icon ${
                              errors.start_time ? "border-red-500" : ""
                            }`}
                            required
                          />
                        </div>
                        {errors.start_time && (
                          <p className="text-sm text-red-500">
                            {errors.start_time}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-end-datetime-picker"
                          className="text-sm font-medium"
                        >
                          End Date & Time{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(
                                "rej-end-datetime-picker",
                              ) as HTMLInputElement;
                              if (input?.showPicker) input.showPicker();
                              else input?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="rej-end-datetime-picker"
                            type="datetime-local"
                            value={formData.end_time}
                            onChange={(e) =>
                              handleInputChange("end_time", e.target.value)
                            }
                            className={`h-11 pl-10 date-input-hide-icon ${
                              errors.end_time ? "border-red-500" : ""
                            }`}
                            required
                          />
                        </div>
                        {errors.end_time && (
                          <p className="text-sm text-red-500">
                            {errors.end_time}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Location & Category */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">
                        Location & Category
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-location_name"
                          className="text-sm font-medium"
                        >
                          Location Name
                        </Label>
                        <Input
                          id="rej-location_name"
                          value={formData.location_name || ""}
                          onChange={(e) =>
                            handleInputChange("location_name", e.target.value)
                          }
                          placeholder="e.g. Seaview Beach"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-address"
                          className="text-sm font-medium"
                        >
                          Address
                        </Label>
                        <Textarea
                          id="rej-address"
                          value={formData.address || ""}
                          onChange={(e) =>
                            handleInputChange("address", e.target.value)
                          }
                          placeholder="Full street address (optional)"
                          rows={2}
                          className="resize-y"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label
                            htmlFor="rej-latitude"
                            className="text-sm font-medium"
                          >
                            Latitude
                          </Label>
                          <Input
                            id="rej-latitude"
                            type="number"
                            step="any"
                            value={formData.latitude ?? ""}
                            onChange={(e) =>
                              handleInputChange(
                                "latitude",
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              )
                            }
                            placeholder="e.g. 24.8607"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="rej-longitude"
                            className="text-sm font-medium"
                          >
                            Longitude
                          </Label>
                          <Input
                            id="rej-longitude"
                            type="number"
                            step="any"
                            value={formData.longitude ?? ""}
                            onChange={(e) =>
                              handleInputChange(
                                "longitude",
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              )
                            }
                            placeholder="e.g. 67.0011"
                            className="h-11"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Category</Label>
                        <Select
                          value={formData.category_id?.toString() || "none"}
                          onValueChange={(value) =>
                            handleInputChange(
                              "category_id",
                              value === "none" ? null : parseInt(value, 10),
                            )
                          }
                          disabled={isLoadingData}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue
                              placeholder={
                                isLoadingData
                                  ? "Loading..."
                                  : "Select a category (optional)"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              No specific category
                            </SelectItem>
                            {categories.map((category) => (
                              <SelectItem
                                key={category.value}
                                value={category.value}
                              >
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Capacity & Settings */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">
                        Capacity & Settings
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="rej-max_capacity"
                          className="text-sm font-medium"
                        >
                          Maximum Capacity
                        </Label>
                        <Input
                          id="rej-max_capacity"
                          type="number"
                          min="1"
                          value={formData.max_capacity || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "max_capacity",
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          placeholder="Leave empty for unlimited"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status</Label>
                        <Select
                          value={formData.status || "draft"}
                          onValueChange={(value) =>
                            handleInputChange(
                              "status",
                              value as "draft" | "published" | "archived",
                            )
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-secondary" />
                                Draft
                              </div>
                            </SelectItem>
                            <SelectItem value="published">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Published
                              </div>
                            </SelectItem>
                            <SelectItem value="archived">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                Archived
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Guest Details Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-red-50/60 to-orange-50/60 dark:from-red-950/30 dark:to-orange-950/30 border-red-200/60 dark:border-red-800/60 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                          <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <Label
                            htmlFor="rej-require_guest_details"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Require Guest Details
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Collect name & CNIC for each ticket
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="rej-require_guest_details"
                        checked={formData.require_guest_details || false}
                        onCheckedChange={(checked) =>
                          handleInputChange("require_guest_details", checked)
                        }
                      />
                    </div>
                    {/* Extra bottom padding to ensure last section is visible */}
                    <div />
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="gallery" className="space-y-8">
                <EventGalleryUpload
                  eventId={null}
                  tempSessionId={tempSessionId}
                  images={images}
                  onImagesChange={setImages}
                  isLoading={isLoadingData}
                  apiBasePath="/api/organizer/events"
                  tempImagesBasePath="/api/organizer/events/temp-images"
                  pendingDeletions={pendingImageDeletions}
                  onPendingDeletionsChange={setPendingImageDeletions}
                />
              </TabsContent>

              <TabsContent value="tickets" className="space-y-8">
                <ProposedTicketEditor
                  tickets={proposedTickets}
                  onTicketsChange={setProposedTickets}
                  eventStartTime={formData.start_time}
                  eventEndTime={formData.end_time}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 pt-6 border-t bg-background/50 backdrop-blur-sm">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 min-w-[140px] bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                "Resubmit for Approval"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
