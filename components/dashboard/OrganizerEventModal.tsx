"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Users,
  MapPin,
  Tag,
  Clock,
  Image as ImageIcon,
  Ticket,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventGalleryUpload } from "@/components/admin/EventGalleryUpload";
import { ProposedTicketEditor } from "./ProposedTicketEditor";
import { v4 as uuidv4 } from "uuid";

import type {
  OrganizerManagedEvent,
  EventFormData,
  ProposedTicketType,
} from "@/types/event-change-request.types";
import type { EventImage } from "@/types/events.types";

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

interface OrganizerEventModalProps {
  event: OrganizerManagedEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  isSaving: boolean;
}

export function OrganizerEventModal({
  event,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: OrganizerEventModalProps) {
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
    is_featured: false, // Always false for organizers - admin only
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
  const [activeTab, setActiveTab] = React.useState("details");
  const { toast } = useToast();
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

  // Fetch categories
  React.useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch categories
        const categoriesResponse = await fetch("/api/categories?all=true");
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Warning",
          description: "Some data may not be available.",
          variant: "default",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, toast]);

  // Reset form when opening for new event
  React.useEffect(() => {
    if (isOpen && !event) {
      setFormData({
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
      setImages([]);
      setPendingImageDeletions(new Set());
      setProposedTickets([]);
      setErrors({});
    }
  }, [isOpen, event]);

  // Populate form when editing
  React.useEffect(() => {
    if (isOpen && event) {
      setFormData({
        name: event.event_name || "",
        description: event.event_description || "",
        start_time: event.start_time
          ? new Date(event.start_time).toISOString().slice(0, 16)
          : "",
        end_time: event.end_time
          ? new Date(event.end_time).toISOString().slice(0, 16)
          : "",
        location_name: event.location_name || "",
        address: event.address || "",
        latitude: null,
        longitude: null,
        category_id: null,
        max_capacity: event.max_capacity,
        is_featured: event.is_featured,
        status:
          (event.event_status as "draft" | "published" | "archived") || "draft",
        require_guest_details: false,
      });
      setErrors({});

      // Fetch existing images
      const fetchImages = async () => {
        try {
          const response = await fetch(
            `/api/organizer/events/${event.event_id}/images`,
          );
          if (response.ok) {
            const data = await response.json();
            setImages(data.images || []);
          }
        } catch (error) {
          console.error("Failed to fetch event images:", error);
        }
      };
      fetchImages();

      // Fetch existing tickets
      const fetchTickets = async () => {
        try {
          const response = await fetch(
            `/api/organizer/events/${event.event_id}/tickets`,
          );
          if (response.ok) {
            const data = await response.json();
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
          }
        } catch (error) {
          console.error("Failed to fetch event tickets:", error);
        }
      };
      fetchTickets();
    }
  }, [event, isOpen]);

  // Cleanup temp images when modal closes without saving (for new events only)
  React.useEffect(() => {
    if (!isOpen && !event?.event_id && images.length > 0 && tempSessionId) {
      fetch("/api/organizer/events/temp-images/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempSessionId }),
      }).catch(console.error);
    }
  }, [isOpen, event?.event_id, images.length, tempSessionId]);

  // Clear the "photo required" error as soon as at least one image is present.
  React.useEffect(() => {
    if (!errors.images) return;
    const remainingImageCount = images.filter(
      (img) => !pendingImageDeletions.has(img.id),
    ).length;
    if (remainingImageCount > 0) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.images;
        return next;
      });
    }
  }, [images, pendingImageDeletions, errors.images]);

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

    const remainingImageCount = images.filter(
      (img) => !pendingImageDeletions.has(img.id),
    ).length;
    if (remainingImageCount === 0) {
      newErrors.images = "At least one event photo is required";
    }

    setErrors(newErrors);

    // Jump the user to whichever tab holds the first error so a Gallery-only
    // failure (Details fields already valid) doesn't fail silently off-screen.
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.name || newErrors.start_time || newErrors.end_time) {
        setActiveTab("details");
      } else if (newErrors.images) {
        setActiveTab("gallery");
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Include temp images, session ID, and proposed tickets for new events (before approval)
    const submitData = {
      ...formData,
      // Only include temp images and tickets for new events (not for updates of existing events)
      ...((!event || !event.event_id) && images.length > 0
        ? {
            temp_images: images.map((img, index) => ({
              url: img.url,
              alt_text: img.alt_text || "",
              is_primary: img.is_primary || index === 0,
              display_order: img.display_order ?? index,
            })),
            temp_session_id: tempSessionId,
          }
        : {}),
      // Include proposed tickets for BOTH new and existing events (updates)
      temp_tickets: proposedTickets,
    };

    await onSave(submitData);

    // Delete images that were marked for deletion (soft-deleted)
    // Only for existing events (new events don't have persisted images yet)
    if (event?.event_id && pendingImageDeletions.size > 0) {
      console.log("[OrganizerEventModal] Persisting image deletions", {
        eventId: event.event_id,
        deletionCount: pendingImageDeletions.size,
        imageIds: Array.from(pendingImageDeletions),
      });

      const deletePromises = Array.from(pendingImageDeletions).map(
        async (imageId) => {
          try {
            const response = await fetch(
              `/api/organizer/events/${event.event_id}/images?imageId=${imageId}`,
              { method: "DELETE" },
            );
            if (!response.ok) {
              const error = await response.json();
              console.error(
                `[OrganizerEventModal] Failed to delete image ${imageId}:`,
                error,
              );
              return { imageId, success: false, error: error.error };
            }
            return { imageId, success: true };
          } catch (err) {
            console.error(
              `[OrganizerEventModal] Error deleting image ${imageId}:`,
              err,
            );
            return { imageId, success: false, error: String(err) };
          }
        },
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter((r) => !r.success);

      if (failed.length > 0) {
        console.warn(
          "[OrganizerEventModal] Some image deletions failed:",
          failed,
        );
        toast({
          title: "Warning",
          description: `${failed.length} image(s) could not be deleted. Please try again.`,
          variant: "destructive",
        });
      } else {
        // All deletions successful - update local state
        setImages((prev) =>
          prev.filter((img) => !pendingImageDeletions.has(img.id)),
        );
        console.log(
          "[OrganizerEventModal] All pending image deletions successful",
        );
      }

      // Clear pending deletions
      setPendingImageDeletions(new Set());
    }
  };

  const handleCancel = () => {
    // Clear pending deletions (user cancelled, don't delete anything)
    setPendingImageDeletions(new Set());
    onClose();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={modalRef}
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {event ? "Edit Event" : "Create New Event"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {event
                    ? "Update event details. Changes require admin approval."
                    : "Fill in the details. Your event will be reviewed before going live."}
                </DialogDescription>
              </div>
            </div>
            {event && (
              <Badge
                variant={getStatusBadgeVariant(event.event_status)}
                className="capitalize"
              >
                {event.event_status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {isLoadingData && !event ? (
            <div className="flex flex-col items-center justify-center h-full py-24">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <div className="text-lg font-medium text-muted-foreground">
                Loading...
              </div>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
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
                  {errors.images && (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="tickets"
                  className="flex items-center gap-2"
                >
                  <Ticket className="h-4 w-4" />
                  Tickets
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-8">
                {/* Approval Notice */}
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-400">
                    <p className="font-medium">Approval Required</p>
                    <p className="mt-1">
                      All changes will be submitted for review. An administrator
                      will approve or reject your request.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Basic Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">Basic Information</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium">
                          Event Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="name"
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
                          htmlFor="description"
                          className="text-sm font-medium"
                        >
                          Description
                        </Label>
                        <Textarea
                          id="description"
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

                  {/* Date & Time Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-medium">Date & Time</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="start_time"
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
                                "org-start-datetime-picker",
                              ) as HTMLInputElement;
                              if (input?.showPicker) input.showPicker();
                              else input?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="org-start-datetime-picker"
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
                          htmlFor="end_time"
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
                                "org-end-datetime-picker",
                              ) as HTMLInputElement;
                              if (input?.showPicker) input.showPicker();
                              else input?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="org-end-datetime-picker"
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

                  {/* Location & Category Section */}
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
                          htmlFor="location_name"
                          className="text-sm font-medium"
                        >
                          Location Name
                        </Label>
                        <Input
                          id="location_name"
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
                          htmlFor="address"
                          className="text-sm font-medium"
                        >
                          Address
                        </Label>
                        <Textarea
                          id="address"
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
                            htmlFor="latitude"
                            className="text-sm font-medium"
                          >
                            Latitude
                          </Label>
                          <Input
                            id="latitude"
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
                            htmlFor="longitude"
                            className="text-sm font-medium"
                          >
                            Longitude
                          </Label>
                          <Input
                            id="longitude"
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
                        <Label
                          htmlFor="category_id"
                          className="text-sm font-medium"
                        >
                          Category
                        </Label>
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

                  {/* Capacity & Settings Section */}
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
                          htmlFor="max_capacity"
                          className="text-sm font-medium"
                        >
                          Maximum Capacity
                        </Label>
                        <Input
                          id="max_capacity"
                          type="number"
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
                          min="1"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-sm font-medium">
                          Status
                        </Label>
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

                    {/* Toggles */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-red-50/60 to-orange-50/60 dark:from-red-950/30 dark:to-orange-950/30 border-red-200/60 dark:border-red-800/60 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                          <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <Label
                            htmlFor="require_guest_details"
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
                        id="require_guest_details"
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
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Event Photos <span className="text-destructive">*</span>
                </div>
                <p className="text-sm text-muted-foreground -mt-6">
                  At least one photo is required so attendees can recognize
                  your event.
                </p>
                <EventGalleryUpload
                  eventId={event?.event_id || null}
                  tempSessionId={!event?.event_id ? tempSessionId : undefined}
                  images={images}
                  onImagesChange={setImages}
                  isLoading={isLoadingData}
                  apiBasePath="/api/organizer/events"
                  tempImagesBasePath="/api/organizer/events/temp-images"
                  pendingDeletions={pendingImageDeletions}
                  onPendingDeletionsChange={setPendingImageDeletions}
                />
                {errors.images && (
                  <p className="text-sm text-red-500">{errors.images}</p>
                )}
              </TabsContent>

              <TabsContent value="tickets" className="space-y-8">
                <ProposedTicketEditor
                  tickets={proposedTickets}
                  onTicketsChange={setProposedTickets}
                  eventStartTime={formData.start_time}
                  eventEndTime={formData.end_time}
                  eventId={event?.event_id ?? null}
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
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 min-w-[140px]"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : event ? (
                "Submit Changes"
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
