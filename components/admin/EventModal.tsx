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
  Users,
  Star,
  MapPin,
  Tag,
  Clock,
  Image as ImageIcon,
  Ticket,
  ShieldCheck,
  Layers,
  QrCode,
  GraduationCap,
  CreditCard,
} from "lucide-react";
import { AdminDrawer, FormFooter, StatusBadge } from "@/components/admin/ui";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizerSelect } from "./OrganizerSelect";
import { EventGalleryUpload } from "./EventGalleryUpload";
import { EventVenueMapUpload } from "./EventVenueMapUpload";
import { TicketManagement } from "./TicketManagement";
import { EventInvitesPanel } from "./EventInvitesPanel";
import { v4 as uuidv4 } from "uuid";

import type { AdminEvent } from "@/types/events.types";
import type { EventImage } from "@/types/events.types";
import { fromKarachiInput, toKarachiInput } from "@/lib/events/datetime";

interface Category {
  value: string;
  label: string;
  slug: string;
  parentId: string | null;
  iconName: string | null;
}

interface EventModalProps {
  event: AdminEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<AdminEvent>) => Promise<AdminEvent | undefined>;
}

export function EventModal({
  event,
  isOpen,
  onClose,
  onSave,
}: EventModalProps) {
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    start_time: "",
    end_time: "",
    organizer_id: "",
    location_name: "",
    address: "",
    latitude: "",
    longitude: "",
    category_id: "",
    max_capacity: "",
    is_featured: false,
    status: "draft",
    require_guest_details: false,
    parchi_enabled: false,
    parchi_discount_percent: "",
    custom_fees_enabled: false,
    payment_processing_fee_percentage: "",
    payment_processing_fee_fixed: "",
    platform_fee_percentage: "",
    platform_fee_fixed: "",
    scanning_mode: "single",
    total_gates: "1",
    layout_image_url: "",
  });

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [images, setImages] = React.useState<EventImage[]>([]);
  // Track images marked for deletion (soft delete - persisted on Save)
  const [pendingImageDeletions, setPendingImageDeletions] = React.useState<
    Set<number>
  >(new Set());
  // Temp session id for gallery uploads (used if creating new event)
  const [tempSessionId] = React.useState(() => uuidv4());
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const { toast } = useToast();
  // Each open starts on Details, as it did when the tabs lived inside the dialog.
  const [activeTab, setActiveTab] = React.useState("details");
  React.useEffect(() => {
    if (isOpen) setActiveTab("details");
  }, [isOpen, event?.event_id]);

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

  // Fetch categories data
  React.useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;

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
          description:
            "Some data may not be available. You can still save the event.",
          variant: "default",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [isOpen, toast]);

  // Reset form data when modal opens for new event
  React.useEffect(() => {
    if (isOpen && !event) {
      setFormData({
        name: "",
        description: "",
        start_time: "",
        end_time: "",
        organizer_id: "",
        location_name: "",
        address: "",
        latitude: "",
        longitude: "",
        category_id: "",
        max_capacity: "",
        is_featured: false,
        status: "draft",
        require_guest_details: false,
        parchi_enabled: false,
        parchi_discount_percent: "",
        custom_fees_enabled: false,
        payment_processing_fee_percentage: "",
        payment_processing_fee_fixed: "",
        platform_fee_percentage: "",
        platform_fee_fixed: "",
        scanning_mode: "single",
        total_gates: "1",
        layout_image_url: "",
      });
      setImages([]);
      setPendingImageDeletions(new Set());
    }
  }, [isOpen, event]);

  // Fetch event data when editing existing event
  React.useEffect(() => {
    let isMounted = true;
    const fetchEventData = async () => {
      if (!event?.event_id || !isOpen) return;
      setIsLoadingData(true);
      // Immediately clear form to prevent flicker
      setFormData({
        name: "",
        description: "",
        start_time: "",
        end_time: "",
        organizer_id: "",
        location_name: "",
        address: "",
        latitude: "",
        longitude: "",
        category_id: "",
        max_capacity: "",
        is_featured: false,
        status: "draft",
        require_guest_details: false,
        parchi_enabled: false,
        parchi_discount_percent: "",
        custom_fees_enabled: false,
        payment_processing_fee_percentage: "",
        payment_processing_fee_fixed: "",
        platform_fee_percentage: "",
        platform_fee_fixed: "",
        scanning_mode: "single",
        total_gates: "1",
        layout_image_url: "",
      });
      setImages([]);
      setPendingImageDeletions(new Set());
      try {
        const response = await fetch(`/api/admin/events/${event.event_id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && isMounted) {
            const eventData = result.data;
            setFormData({
              name: eventData.event_name || "",
              description: eventData.event_description || "",
              start_time: toKarachiInput(eventData.start_time),
              end_time: toKarachiInput(eventData.end_time),
              organizer_id: eventData.organizer_id || "",
              location_name: eventData.location_name || "",
              address: eventData.address || "",
              latitude:
                eventData.latitude !== null && eventData.latitude !== undefined
                  ? eventData.latitude.toString()
                  : "",
              longitude:
                eventData.longitude !== null &&
                eventData.longitude !== undefined
                  ? eventData.longitude.toString()
                  : "",
              category_id: eventData.category_id?.toString() || "",
              max_capacity: eventData.max_capacity?.toString() || "",
              is_featured: eventData.is_featured || false,
              status: eventData.event_status || "draft",
              require_guest_details: eventData.require_guest_details || false,
              parchi_enabled: eventData.parchi_enabled === true,
              parchi_discount_percent:
                eventData.parchi_discount_percent != null
                  ? String(eventData.parchi_discount_percent)
                  : "",
              custom_fees_enabled:
                eventData.payment_processing_fee_percentage != null ||
                eventData.payment_processing_fee_fixed != null ||
                eventData.platform_fee_percentage != null ||
                eventData.platform_fee_fixed != null,
              payment_processing_fee_percentage:
                eventData.payment_processing_fee_percentage != null
                  ? String(eventData.payment_processing_fee_percentage)
                  : "",
              payment_processing_fee_fixed:
                eventData.payment_processing_fee_fixed != null
                  ? String(eventData.payment_processing_fee_fixed)
                  : "",
              platform_fee_percentage:
                eventData.platform_fee_percentage != null
                  ? String(eventData.platform_fee_percentage)
                  : "",
              platform_fee_fixed:
                eventData.platform_fee_fixed != null
                  ? String(eventData.platform_fee_fixed)
                  : "",
              scanning_mode: eventData.scanning_mode || "single",
              total_gates: (eventData.total_gates || 1).toString(),
              layout_image_url: eventData.layout_image_url || "",
            });
            setImages(eventData.images || []);
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to load event data",
            variant: "destructive",
          });
        }
      } catch (_error) {
        toast({
          title: "Error",
          description: "Failed to load event data",
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };
    fetchEventData();
    return () => {
      isMounted = false;
    };
  }, [event?.event_id, isOpen, toast]);

  // Prevent layout shift when Radix Select dropdowns open
  React.useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const removeScrollLock = () => {
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
  }, [isOpen]);

  // Track modal content size changes
  React.useEffect(() => {
    if (isOpen) {
      // Setting up content size tracking

      // Use setTimeout to wait for modal to render
      const timer = setTimeout(() => {
        const modalContent = document.querySelector(
          "[data-radix-dialog-content]",
        ) as HTMLElement;
        if (modalContent) {
          // Found modal content
          // Initial modal dimensions captured

          const resizeObserver = new ResizeObserver((entries) => {
            entries.forEach((_entry) => {
              // Modal content resized
            });
          });

          resizeObserver.observe(modalContent);
          // ResizeObserver active on modal content

          return () => {
            // Cleaning up ResizeObserver
            resizeObserver.disconnect();
          };
        } else {
          // Modal content element not found for tracking
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent body height/layout shifts when modal opens - PROACTIVE APPROACH
  React.useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  // Modal content detection with multiple strategies
  React.useEffect(() => {
    if (isOpen) {
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

          resizeObserver = new ResizeObserver((entries) => {
            entries.forEach((_entry) => {
              // Modal resize detected
            });
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
  }, [isOpen]);

  // Track when categories data changes
  React.useEffect(() => {
    // Data state tracking for debugging
  }, [categories.length, isLoadingData]);

  // Cleanup temp images when modal closes without saving (for new events)
  React.useEffect(() => {
    return () => {
      // Only cleanup if we have temp images and no event (new event creation)
      if (!event?.event_id && images.length > 0 && tempSessionId) {
        console.log("[EventModal] Cleaning up temp images on modal close", {
          tempSessionId,
          imagesCount: images.length,
        });

        // Cleanup temp images
        fetch("/api/admin/events/temp-images/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempSessionId }),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("[EventModal] Temp images cleanup response", data);
          })
          .catch((error) => {
            console.error("[EventModal] Failed to cleanup temp images", error);
          });
      }
    };
  }, [event?.event_id, images.length, tempSessionId]);

  // Additional cleanup when modal closes
  React.useEffect(() => {
    if (!isOpen && !event?.event_id && images.length > 0 && tempSessionId) {
      console.log("[EventModal] Modal closed, cleaning up temp images", {
        tempSessionId,
        imagesCount: images.length,
      });

      // Cleanup temp images
      fetch("/api/admin/events/temp-images/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempSessionId }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("[EventModal] Modal close cleanup response", data);
        })
        .catch((error) => {
          console.error(
            "[EventModal] Failed to cleanup temp images on modal close",
            error,
          );
        });
    }
  }, [isOpen, event?.event_id, images.length, tempSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Event name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      toast({
        title: "Validation Error",
        description: "Start and end times are required",
        variant: "destructive",
      });
      return;
    }

    // Validate date order
    const startDate = new Date(formData.start_time);
    const endDate = new Date(formData.end_time);
    if (endDate <= startDate) {
      toast({
        title: "Validation Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const eventData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        start_time: fromKarachiInput(formData.start_time),
        end_time: fromKarachiInput(formData.end_time),
        organizer_id:
          formData.organizer_id && formData.organizer_id !== ""
            ? formData.organizer_id
            : undefined,
        location_name: formData.location_name.trim() || null,
        address: formData.address.trim() || null,
        latitude: formData.latitude.trim()
          ? parseFloat(formData.latitude)
          : null,
        longitude: formData.longitude.trim()
          ? parseFloat(formData.longitude)
          : null,
        category_id:
          formData.category_id && formData.category_id !== "none"
            ? parseInt(formData.category_id)
            : null,
        max_capacity: formData.max_capacity
          ? parseInt(formData.max_capacity)
          : null,
        is_featured: formData.is_featured,
        status: formData.status,
        require_guest_details: formData.require_guest_details,
        parchi_enabled: formData.parchi_enabled,
        parchi_discount_percent: formData.parchi_discount_percent
          ? Number(formData.parchi_discount_percent)
          : null,
        payment_processing_fee_percentage:
          formData.custom_fees_enabled && formData.payment_processing_fee_percentage.trim() !== ""
            ? Number(formData.payment_processing_fee_percentage)
            : null,
        payment_processing_fee_fixed:
          formData.custom_fees_enabled && formData.payment_processing_fee_fixed.trim() !== ""
            ? Number(formData.payment_processing_fee_fixed)
            : null,
        platform_fee_percentage:
          formData.custom_fees_enabled && formData.platform_fee_percentage.trim() !== ""
            ? Number(formData.platform_fee_percentage)
            : null,
        platform_fee_fixed:
          formData.custom_fees_enabled && formData.platform_fee_fixed.trim() !== ""
            ? Number(formData.platform_fee_fixed)
            : null,
        scanning_mode: formData.scanning_mode as "single" | "multi_gate",
        total_gates: Math.max(1, parseInt(formData.total_gates || "1", 10) || 1),
        layout_image_url: formData.layout_image_url || null,
      };

      const result = await onSave(eventData);

      // Move temp images if creating new event and images were uploaded
      if (!event?.event_id && images.length > 0 && result) {
        console.log(
          "[EventModal] Attempting to move temp images after create",
          {
            tempSessionId,
            imagesCount: images.length,
          },
        );

        // Extract new event id from result
        let newEventId: number | undefined = undefined;
        if (result && typeof result === "object") {
          if (
            "event_id" in result &&
            typeof (result as { event_id: number }).event_id === "number"
          ) {
            newEventId = (result as { event_id: number }).event_id;
          } else if (
            "id" in result &&
            typeof (result as { id: number }).id === "number"
          ) {
            newEventId = (result as { id: number }).id;
          }
        }

        if (newEventId) {
          try {
            const moveRes = await fetch("/api/admin/events/temp-images/move", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tempSessionId, eventId: newEventId }),
            });
            const moveData = await moveRes.json();
            console.log("[EventModal] Move API response", moveData);
            if (!moveRes.ok) {
              console.error("[EventModal] Move API failed", moveData);
            }
          } catch (err) {
            console.error("[EventModal] Failed to move temp images", err);
          }
        }
      }

      // Delete images that were marked for deletion (soft-deleted)
      const effectiveEventId =
        event?.event_id ?? (result as { event_id?: number })?.event_id;
      if (effectiveEventId && pendingImageDeletions.size > 0) {
        console.log("[EventModal] Persisting image deletions", {
          eventId: effectiveEventId,
          deletionCount: pendingImageDeletions.size,
          imageIds: Array.from(pendingImageDeletions),
        });

        const deletePromises = Array.from(pendingImageDeletions).map(
          async (imageId) => {
            try {
              const response = await fetch(
                `/api/admin/events/${effectiveEventId}/images/${imageId}`,
                { method: "DELETE" },
              );
              if (!response.ok) {
                let errorMsg = "Delete failed";
                try {
                  const error = await response.json();
                  errorMsg = error.error || errorMsg;
                } catch {
                  // ignore non-JSON response
                }
                console.error(
                  `[EventModal] Failed to delete image ${imageId}:`,
                  errorMsg,
                );
                return { imageId, success: false, error: errorMsg };
              }
              return { imageId, success: true };
            } catch (err) {
              console.error(
                `[EventModal] Error deleting image ${imageId}:`,
                err,
              );
              return { imageId, success: false, error: String(err) };
            }
          },
        );

        const results = await Promise.all(deletePromises);
        const failed = results.filter((r) => !r.success);

        if (failed.length > 0) {
          console.warn("[EventModal] Some image deletions failed:", failed);
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
          console.log("[EventModal] All pending image deletions successful");
        }

        // Clear pending deletions
        setPendingImageDeletions(new Set());
      }

      toast({
        title: "Success",
        description: event
          ? "Event updated successfully"
          : "Event created successfully",
      });
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Clear pending deletions (user cancelled, don't delete anything)
    setPendingImageDeletions(new Set());
    onClose();
  };

  const handleInputChange = (
    field: string,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  return (
    // Tabs wraps the drawer so the tab row (header) and panels (body) share state.
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <AdminDrawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={event ? event.event_name || "Edit event" : "New event"}
        description={event ? "Update event details and settings" : "Fill in the details to create an event"}
        meta={event ? <StatusBadge status={event.event_status} /> : undefined}
        tabs={
          <TabsList variant="underline">
            <TabsTrigger value="details">
              <Tag className="size-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="gallery">
              <ImageIcon className="size-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="size-4" />
              Tickets
            </TabsTrigger>
          </TabsList>
        }
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" onClick={handleSubmit} loading={isLoading}>
              {isLoading ? "Saving…" : event ? "Save changes" : "Create event"}
            </Button>
          </FormFooter>
        }
      >
          {event && isLoadingData ? (
            <div role="status" className="flex flex-col items-center justify-center py-24 text-data text-muted-foreground">
              <div className="mb-4 size-8 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
              Loading event details…
            </div>
          ) : (
            <>

              <TabsContent value="details" className="space-y-8">
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
                          className="h-11"
                          required
                        />
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
                          value={formData.description}
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
                              const dateInput = document.getElementById(
                                "start-datetime-picker",
                              ) as HTMLInputElement;
                              if (dateInput?.showPicker) dateInput.showPicker();
                              else dateInput?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="start-datetime-picker"
                            type="datetime-local"
                            value={formData.start_time}
                            onChange={(e) =>
                              handleInputChange("start_time", e.target.value)
                            }
                            className="h-11 pl-10 date-input-hide-icon"
                            required
                          />
                        </div>
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
                              const dateInput = document.getElementById(
                                "end-datetime-picker",
                              ) as HTMLInputElement;
                              if (dateInput?.showPicker) dateInput.showPicker();
                              else dateInput?.focus();
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-primary transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <Input
                            id="end-datetime-picker"
                            type="datetime-local"
                            value={formData.end_time}
                            onChange={(e) =>
                              handleInputChange("end_time", e.target.value)
                            }
                            className="h-11 pl-10 date-input-hide-icon"
                            required
                          />
                        </div>
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
                          value={formData.location_name}
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
                          value={formData.address}
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
                            value={formData.latitude}
                            onChange={(e) =>
                              handleInputChange("latitude", e.target.value)
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
                            value={formData.longitude}
                            onChange={(e) =>
                              handleInputChange("longitude", e.target.value)
                            }
                            placeholder="e.g. 67.0011"
                            className="h-11"
                          />
                        </div>
                      </div>

                      <OrganizerSelect
                        selectedOrganizerId={formData.organizer_id}
                        onOrganizerSelect={(organizerId) => {
                          setFormData((prev) => ({
                            ...prev,
                            organizer_id: organizerId,
                          }));
                        }}
                        eventId={event?.event_id || 0}
                        disabled={isLoadingData}
                      />

                      <div className="space-y-2">
                        <Label
                          htmlFor="category_id"
                          className="text-sm font-medium"
                        >
                          Category
                        </Label>
                        <Select
                          value={formData.category_id}
                          onValueChange={(value) =>
                            handleInputChange("category_id", value)
                          }
                          disabled={isLoadingData}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue
                              placeholder={
                                isLoadingData
                                  ? "Loading categories..."
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
                          value={formData.max_capacity}
                          onChange={(e) =>
                            handleInputChange("max_capacity", e.target.value)
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
                          value={formData.status}
                          onValueChange={(value) =>
                            handleInputChange("status", value)
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                                Draft
                              </div>
                            </SelectItem>
                            <SelectItem value="published">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-success"></div>
                                Published
                              </div>
                            </SelectItem>
                            <SelectItem value="invite_only">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-warning"></div>
                                Invite only (hidden)
                              </div>
                            </SelectItem>
                            <SelectItem value="archived">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-muted-foreground"></div>
                                Archived
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Toggles Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <Star className="h-4 w-4 text-primary" />
                          <div>
                            <Label
                              htmlFor="is_featured"
                              className="text-sm font-medium cursor-pointer"
                            >
                              Featured Event
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Highlight this event on the homepage
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="is_featured"
                          checked={formData.is_featured}
                          onCheckedChange={(checked) =>
                            handleInputChange("is_featured", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Users className="h-4 w-4 text-primary" />
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
                          checked={formData.require_guest_details}
                          onCheckedChange={(checked) =>
                            handleInputChange("require_guest_details", checked)
                          }
                        />
                      </div>
                    </div>

                    {/* Parchi Student Discount */}
                    <div className="rounded-xl border border-[#0069DB]/25 bg-[#0069DB]/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-[#0069DB]/10 shrink-0">
                            <GraduationCap className="h-4 w-4 text-[#0069DB]" />
                          </div>
                          <div>
                            <Label
                              htmlFor="parchi_enabled"
                              className="text-sm font-medium cursor-pointer"
                            >
                              Parchi Student Discount
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Inside Karachi and Parchi banners, slashed prices and Parchi ID verification at checkout.
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="parchi_enabled"
                          checked={formData.parchi_enabled}
                          onCheckedChange={(checked) =>
                            handleInputChange("parchi_enabled", checked)
                          }
                        />
                      </div>

                      {formData.parchi_enabled && (
                        <div className="pt-2 border-t border-[#0069DB]/20 space-y-1.5">
                          <Label htmlFor="parchi_discount_percent" className="text-xs font-medium">
                            Parchi discount (% off every ticket)
                          </Label>
                          <Input
                            id="parchi_discount_percent"
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            placeholder="e.g. 20"
                            value={formData.parchi_discount_percent}
                            onChange={(e) =>
                              handleInputChange("parchi_discount_percent", e.target.value)
                            }
                            className="h-10 max-w-[180px]"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Applies to every ticket. Leave empty to use each ticket&apos;s own Parchi price instead.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Custom Checkout Fees Section */}
                    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                            <CreditCard className="h-5 w-5" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                Custom Processing & Platform Fees
                              </h4>
                              {formData.custom_fees_enabled ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Custom active
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  Global default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Override universal system checkout fees (standard 5% payment processing) for this event.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <Label
                            htmlFor="custom_fees_enabled"
                            className="text-xs text-muted-foreground cursor-pointer select-none"
                          >
                            {formData.custom_fees_enabled ? "On" : "Off"}
                          </Label>
                          <Switch
                            id="custom_fees_enabled"
                            checked={formData.custom_fees_enabled}
                            onCheckedChange={(checked) =>
                              handleInputChange("custom_fees_enabled", checked)
                            }
                          />
                        </div>
                      </div>

                      {formData.custom_fees_enabled ? (
                        <div className="pt-3 border-t border-border/50 space-y-4">
                          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                            💡 Enter <span className="font-semibold text-foreground">0</span> to waive a fee completely for this event, or enter a custom rate. Leave blank to inherit global system default.
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="payment_processing_fee_percentage" className="text-xs font-medium">
                                Processing Fee (%)
                              </Label>
                              <div className="relative">
                                <Input
                                  id="payment_processing_fee_percentage"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  placeholder="5.0"
                                  value={formData.payment_processing_fee_percentage}
                                  onChange={(e) =>
                                    handleInputChange("payment_processing_fee_percentage", e.target.value)
                                  }
                                  className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  %
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Default: 5% of ticket total
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="payment_processing_fee_fixed" className="text-xs font-medium">
                                Fixed Processing (PKR)
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  Rs
                                </span>
                                <Input
                                  id="payment_processing_fee_fixed"
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={formData.payment_processing_fee_fixed}
                                  onChange={(e) =>
                                    handleInputChange("payment_processing_fee_fixed", e.target.value)
                                  }
                                  className="h-10 pl-9"
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Default: Rs 0 per order
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="platform_fee_percentage" className="text-xs font-medium">
                                Platform Fee (%)
                              </Label>
                              <div className="relative">
                                <Input
                                  id="platform_fee_percentage"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  placeholder="0.0"
                                  value={formData.platform_fee_percentage}
                                  onChange={(e) =>
                                    handleInputChange("platform_fee_percentage", e.target.value)
                                  }
                                  className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  %
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Default: 0%
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="platform_fee_fixed" className="text-xs font-medium">
                                Fixed Platform (PKR)
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  Rs
                                </span>
                                <Input
                                  id="platform_fee_fixed"
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={formData.platform_fee_fixed}
                                  onChange={(e) =>
                                    handleInputChange("platform_fee_fixed", e.target.value)
                                  }
                                  className="h-10 pl-9"
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Default: Rs 0
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          <span>Using global defaults: 5% payment processing fee, Rs 0 fixed, 0% platform fee.</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Gate Scanner & Zone Partitioning Settings */}
                    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                          <div>
                            <h4 className="text-base font-semibold">
                              Device Verification & Attendance Mode
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Configure single device or offline-first jammer-proof multi-device partition for scanners.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="scanning_toggle" className="text-xs font-medium cursor-pointer">
                            {formData.scanning_mode === "disabled" ? "Off" : "On"}
                          </Label>
                          <Switch
                            id="scanning_toggle"
                            checked={formData.scanning_mode !== "disabled"}
                            onCheckedChange={(checked) =>
                              handleInputChange("scanning_mode", checked ? "single" : "disabled")
                            }
                          />
                        </div>
                      </div>

                      {formData.scanning_mode !== "disabled" ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                              <Label htmlFor="scanning_mode" className="text-sm font-medium">
                                Verification Architecture
                              </Label>
                              <Select
                                value={formData.scanning_mode}
                                onValueChange={(value) =>
                                  handleInputChange("scanning_mode", value)
                                }
                              >
                                <SelectTrigger id="scanning_mode" className="h-11 bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">
                                    <div className="flex items-center gap-2">
                                      <QrCode className="h-4 w-4 text-muted-foreground" />
                                      <span>Single Device Verification (1 Device)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="multi_gate">
                                    <div className="flex items-center gap-2">
                                      <Layers className="h-4 w-4 text-primary" />
                                      <span>Multi-Device Verification (Anti-Fraud)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="disabled">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span>Disabled (No Scanners Required)</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {formData.scanning_mode === "multi_gate" && (
                              <div className="space-y-2">
                                <Label htmlFor="total_gates" className="text-sm font-medium">
                                  Configured Total Devices
                                </Label>
                                <Select
                                  value={formData.total_gates}
                                  onValueChange={(value) =>
                                    handleInputChange("total_gates", value)
                                  }
                                >
                                  <SelectTrigger id="total_gates" className="h-11 bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[2, 3, 4, 5, 6, 8, 10].map((num) => (
                                      <SelectItem key={num} value={num.toString()}>
                                        {num} Devices (Partitioned Verification)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {event?.event_id && (
                            <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                Assign individual attendees to Device 1, Device 2 or link scanner operator accounts:
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  window.location.href = `/admin/events/${event.event_id}/device-allocation`;
                                }}
                                className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                              >
                                Manage Device & Operator Allocations →
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-1">
                          Device verification is turned off for this event. No scanner partitioning or operator device binding is required.
                        </p>
                      )}
                    </div>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="gallery" className="space-y-8">
                <EventGalleryUpload
                  eventId={event?.event_id || null}
                  tempSessionId={!event?.event_id ? tempSessionId : undefined}
                  images={images}
                  onImagesChange={setImages}
                  isLoading={isLoadingData}
                  pendingDeletions={pendingImageDeletions}
                  onPendingDeletionsChange={setPendingImageDeletions}
                />
                <Separator />
                <EventVenueMapUpload
                  value={formData.layout_image_url}
                  onChange={(url) =>
                    setFormData((prev) => ({ ...prev, layout_image_url: url }))
                  }
                  disabled={isLoadingData}
                />
              </TabsContent>

              <TabsContent value="tickets" className="space-y-8">
                {event ? (
                  <>
                    {formData.status === "invite_only" && (
                      <EventInvitesPanel eventId={event.event_id} />
                    )}
                    <TicketManagement eventId={event.event_id} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Save Event First
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Please save the event before managing ticket types.
                    </p>
                  </div>
                )}
              </TabsContent>
            </>
          )}
      </AdminDrawer>
    </Tabs>
  );
}
