"use client";

import * as React from "react";
import {
  isLikelyGoogleMapsHost,
  parseGoogleMapsLink,
} from "@/lib/utils/google-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  GalleryHorizontal as GalleryIcon,
  Clock,
  Tag,
  Star,
  ChefHat,
  Loader2,
  MapPin,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuItemImageUpload } from "./MenuItemImageUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DetailsTab,
  AttributesTab,
  GalleryTab,
  HoursTab,
  MenuTab,
  DealsTab,
  BranchesTab,
} from "./listing-modal";
import { v4 as uuidv4 } from "uuid";
import {
  ListingImage,
  ListingModalProps,
  OpeningHour,
  CustomAttributes,
  ListingFormData,
  BranchWithHours,
} from "@/types/listing.types";
import { Database } from "@/types/database";
import { getListingStatusLabel } from "@/lib/listings/status-display";
import {
  loadListingEditModalHydration,
  mergePrimaryBranchIntoEditor,
  mapListingOpeningHoursFromApi,
} from "@/lib/listings/listing-modal-edit-hydration";
import {
  createEmptyListingFormData,
  listingRowToListingFormData,
} from "@/lib/listings/listing-row-to-form-data";

export function ListingModal({
  listing,
  isOpen,
  onClose,
  onSave,
  hideAdminFields = false,
  currentUserId = null,
  activeEditors = [],
}: ListingModalProps) {
  const { toast } = useToast();

  const listingRef = React.useRef(listing);
  listingRef.current = listing;

  const hydrateGenRef = React.useRef(0);
  const [formData, setFormData] = React.useState<ListingFormData>({
    name: "",
    description: "",
    address: "",
    phone_number: "",
    email: "",
    website: "",
    latitude: "",
    longitude: "",
    category_id: "",
    category_ids: [],
    custom_category: "",
    is_featured: false,
    status: "draft",
    show_member_badge: false,
    display_order: "",
    custom_attributes: null,
    owner_id: "",
    menu_pdf_url: null,
    parking_information: null,
    parking_amenities: null,
    // Social Links
    facebook_url: "",
    instagram_url: "",
    whatsapp_number: "",
    youtube_url: "",
    google_maps_url: "",
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [images, setImages] = React.useState<ListingImage[]>([]);
  // Track images marked for deletion (soft delete - persisted on Save)
  const [pendingImageDeletions, setPendingImageDeletions] = React.useState<
    Set<number>
  >(new Set());
  // Temp session id for gallery uploads (used if creating new listing)
  const [tempSessionId] = React.useState(() => uuidv4());
  const [categories, setCategories] = React.useState<
    Array<{
      value: string;
      label: string;
      slug: string;
      parentId: string | null;
      iconName: string | null;
    }>
  >([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(false);
  const [menuSections, setMenuSections] = React.useState<
    Array<{
      id: number;
      name: string;
      description: string | null;
      display_order: number;
      menu_items: Array<{
        id: number;
        name: string;
        description: string | null;
        price: number;
        is_available: boolean;
        is_featured: boolean;
        display_order: number;
        image_url: string | null;
        image_alt: string | null;
      }> | null;
    }>
  >([]);
  const [menuLoading, setMenuLoading] = React.useState(false);

  // Menu modal states
  const [showAddSectionModal, setShowAddSectionModal] = React.useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = React.useState(false);
  const [showAddItemModal, setShowAddItemModal] = React.useState(false);
  const [selectedSection, setSelectedSection] = React.useState<{
    id: number;
    name: string;
    description: string | null;
    display_order: number;
  } | null>(null);
  const [selectedItem] = React.useState<{
    id: number;
    name: string;
    description: string | null;
    price: number;
    is_available: boolean;
    display_order: number;
    section_id: number;
  } | null>(null);
  const [sectionFormData, setSectionFormData] = React.useState({
    name: "",
    description: "",
    display_order: 0,
  });
  const [itemFormData, setItemFormData] = React.useState<{
    name: string;
    description: string;
    price: number;
    is_available: boolean;
    display_order: number;
    section_id: number;
    is_featured: boolean;
    image_url: string | null;
    image_alt: string | null;
  }>({
    name: "",
    description: "",
    price: 0,
    is_available: true,
    display_order: 0,
    section_id: 0,
    is_featured: false,
    image_url: null,
    image_alt: null,
  });

  // Opening hours state: array of 7 days (database format: 0=Sunday, 1=Monday, etc.)
  const [openingHours, setOpeningHours] = React.useState<OpeningHour[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i, // Database convention: 0=Sunday through 6=Saturday
      openTime: null,
      closeTime: null,
      isClosed: false,
    })),
  );

  // Deals state
  const [deals, setDeals] = React.useState<
    Array<
      Database["public"]["Tables"]["deals"]["Row"] & {
        banks?: {
          id: number;
          name: string;
          logo_url: string | null;
        } | null;
      }
    >
  >([]);
  const [banks, setBanks] = React.useState<
    Array<{
      id: number;
      name: string;
      logo_url: string | null;
    }>
  >([]);
  const [_dealsLoading, setDealsLoading] = React.useState(false);

  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);
  const [dirtyBaseline, setDirtyBaseline] = React.useState<string | null>(null);
  const [editHydrationState, setEditHydrationState] = React.useState<
    "idle" | "loading" | "ready"
  >("idle");
  const snapshotReadyRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) {
      snapshotReadyRef.current = false;
      setDirtyBaseline(null);
      setDiscardConfirmOpen(false);
      setEditHydrationState("idle");
      return;
    }
    snapshotReadyRef.current = false;
    setDirtyBaseline(null);
    setEditHydrationState("idle");
  }, [isOpen, listing?.id]);

  // Branches state
  const [branches, setBranches] = React.useState<BranchWithHours[]>([]);
  const [branchesLoading, setBranchesLoading] = React.useState(false);
  const getNormalizedOpeningHours = React.useCallback(
    (hours: OpeningHour[]) =>
      hours
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime ?? null,
          closeTime: h.closeTime ?? null,
          isClosed: h.isClosed,
          branch_id: h.branch_id ?? null,
        }))
        .sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return (a.branch_id ?? 0) - (b.branch_id ?? 0);
        }),
    [],
  );

  // Fetch branches helper
  const fetchBranches = React.useCallback(async () => {
    if (!listing?.id) {
      setBranches([]);
      return;
    }

    setBranchesLoading(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/branches`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch branches");
      }

      // Fetch opening hours for each branch
      const branchesWithHours = await Promise.all(
        (data.branches || []).map(async (branch: BranchWithHours) => {
          try {
            const hoursRes = await fetch(
              `/api/admin/listings/${listing.id}/opening-hours?branch_id=${branch.id}`,
            );
            if (hoursRes.ok) {
              const hoursData = await hoursRes.json();
              return {
                ...branch,
                opening_hours: mapListingOpeningHoursFromApi(hoursData.data),
              };
            }
          } catch (err) {
            console.error("Error fetching hours for branch:", branch.id, err);
          }
          return { ...branch, opening_hours: [] };
        }),
      );

      setBranches(branchesWithHours);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast({
        title: "Error",
        description: "Failed to load branches",
        variant: "destructive",
      });
    } finally {
      setBranchesLoading(false);
    }
  }, [listing?.id, toast]);

  // Auto-sync location from primary branch
  React.useEffect(() => {
    const primaryBranch = branches.find((b) => b.is_primary);
    if (primaryBranch) {
      setFormData((prev) => {
        // Only update if values differ to avoid unnecessary renders
        if (
          prev.address === primaryBranch.address &&
          prev.latitude === String(primaryBranch.latitude) &&
          prev.longitude === String(primaryBranch.longitude)
        ) {
          return prev;
        }

        return {
          ...prev,
          address: primaryBranch.address,
          latitude: String(primaryBranch.latitude),
          longitude: String(primaryBranch.longitude),
        };
      });

      // Sync opening hours if they exist on the primary branch
      // We do a deep comparison or basic check to see if update is needed,
      // but simpler to just set it if we trust the branch data is fresh.
      // To avoid infinite loops or unnecessary updates, we can check if they are different.
      if (
        primaryBranch.opening_hours &&
        primaryBranch.opening_hours.length > 0
      ) {
        const nextHours = getNormalizedOpeningHours(
          primaryBranch.opening_hours,
        );
        setOpeningHours((prev) => {
          const currentHours = getNormalizedOpeningHours(prev);
          if (JSON.stringify(currentHours) === JSON.stringify(nextHours)) {
            return prev;
          }
          return primaryBranch.opening_hours as OpeningHour[];
        });
      }
    }
  }, [branches, getNormalizedOpeningHours]);

  const modalRef = React.useRef<HTMLDivElement>(null);

  // Remember the modal mode to prevent switching during close animation
  const [modalMode, setModalMode] = React.useState<"edit" | "create">("create");

  // Fetch categories when modal opens
  React.useEffect(() => {
    if (isOpen && categories.length === 0) {
      setCategoriesLoading(true);
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setCategories(data.categories);
          } else {
            console.error("Failed to fetch categories:", data.error);
            toast({
              title: "Error",
              description: "Failed to load categories",
              variant: "destructive",
            });
          }
        })
        .catch((error) => {
          console.error("Error fetching categories:", error);
          toast({
            title: "Error",
            description: "Failed to load categories",
            variant: "destructive",
          });
        })
        .finally(() => setCategoriesLoading(false));
    }
  }, [isOpen, categories.length, toast]);

  // Fetch deals and banks when modal opens
  const [activeTab, setActiveTab] = React.useState("details");
  const hasFetchedDeals = React.useRef(false);
  const editorConflictText = React.useMemo(() => {
    const others: string[] = [];
    const seen = new Set<string>();
    let hasCurrentUser = false;

    for (const editor of activeEditors) {
      if (currentUserId && editor.userId === currentUserId) {
        hasCurrentUser = true;
        continue;
      }
      const fullName = editor.fullName?.trim();
      if (!fullName) continue;
      const key = fullName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      others.push(fullName);
    }

    if (others.length === 0) return null;
    if (others.length === 1) {
      return hasCurrentUser
        ? `You and ${others[0]} are also editing this listing.`
        : `${others[0]} is also editing this listing.`;
    }

    if (others.length === 2) {
      return hasCurrentUser
        ? `You, ${others[0]}, and ${others[1]} are also editing this listing.`
        : `${others[0]} and ${others[1]} are also editing this listing.`;
    }

    const lastName = others[others.length - 1];
    const leadingNames = others.slice(0, -1).join(", ");
    return hasCurrentUser
      ? `You, ${leadingNames}, and ${lastName} are also editing this listing.`
      : `${leadingNames}, and ${lastName} are also editing this listing.`;
  }, [activeEditors, currentUserId]);

  // Reset fetch cache when listing changes
  React.useEffect(() => {
    hasFetchedDeals.current = false;
    if (isOpen) {
      // Reset tab to details when opening a new listing
      setActiveTab("details");
    }
  }, [listing?.id, isOpen]);

  // Parallel hydrate for edit: menu, gallery, listing hours, branches (+ per-branch hours), deals/banks.
  React.useEffect(() => {
    if (!isOpen || !listing?.id) {
      return;
    }

    const targetId = listing.id;
    const ac = new AbortController();
    const gen = ++hydrateGenRef.current;

    setEditHydrationState("loading");
    setMenuLoading(true);
    setBranchesLoading(true);
    setDealsLoading(true);

    (async () => {
      try {
        const pack = await loadListingEditModalHydration(targetId, {
          signal: ac.signal,
        });

        if (ac.signal.aborted || gen !== hydrateGenRef.current) {
          return;
        }

        const row = listingRef.current;
        if (!row || row.id !== targetId) {
          return;
        }

        const baseForm = listingRowToListingFormData(row);
        if (pack.categoryIds.length > 0) {
          baseForm.category_ids = pack.categoryIds.map(String);
          if (!baseForm.category_id) {
            baseForm.category_id = String(pack.categoryIds[0]);
          }
        }
        const primaryMerge = mergePrimaryBranchIntoEditor({
          baseFormAddress: baseForm.address,
          baseFormLatitude: baseForm.latitude,
          baseFormLongitude: baseForm.longitude,
          openingHoursFromListingApi: pack.openingHours,
          branchesWithHours: pack.branchesWithHours,
        });

        setMenuSections(pack.menuSections);
        setImages(pack.images);
        setPendingImageDeletions(new Set());
        setBranches(pack.branchesWithHours);
        setDeals(pack.deals);
        setBanks(pack.banks);
        setFormData({
          ...baseForm,
          address: primaryMerge.nextAddress,
          latitude: primaryMerge.nextLatitude,
          longitude: primaryMerge.nextLongitude,
        });
        setOpeningHours(primaryMerge.openingHours);
        hasFetchedDeals.current = true;
        setEditHydrationState("ready");
      } catch (err) {
        if (ac.signal.aborted || gen !== hydrateGenRef.current) {
          return;
        }
        console.error("Listing edit hydrate failed:", err);
        toast({
          title: "Error",
          description: "Failed to load listing editor data.",
          variant: "destructive",
        });
        setEditHydrationState("idle");
      } finally {
        if (gen === hydrateGenRef.current) {
          setMenuLoading(false);
          setBranchesLoading(false);
          setDealsLoading(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [isOpen, listing?.id, listing?.updated_at, toast]);

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

  // Apply CSS containment when modal opens
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      // Dialog content mounted
      // Dialog mounted

      // Apply CSS containment to prevent layout shifts
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
      modalRef.current.style.position = "relative";

      // Applied CSS containment to modal
    }
  }, [isOpen]);

  // Prevent layout shift when Radix Select dropdowns open
  React.useEffect(() => {
    if (isOpen) {
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

      // Event-driven monitoring instead of per-frame polling.
      // The previous 60fps interval was a major source of typing jank.
      const observer = new MutationObserver(() => {
        preventBodyChanges();
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      const modalStabilizationTimer = setTimeout(preventBodyChanges, 100);

      return () => {
        // Cleaning up body stabilization
        observer.disconnect();
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
  }, [isOpen]);

  // Reset form when modal opens/closes or listing changes.
  React.useLayoutEffect(() => {
    const currentListing = listingRef.current;
    if (currentListing) {
      setModalMode("edit");
      setFormData(listingRowToListingFormData(currentListing));
    } else {
      setModalMode("create");
      setFormData(createEmptyListingFormData());
      setImages([]);
      setPendingImageDeletions(new Set());
      setMenuSections([]);
      setBranches([]);
      setDeals([]);
      setBanks([]);
      setOpeningHours(
        Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: null,
          closeTime: null,
          isClosed: false,
        })),
      );
    }
  }, [listing?.id, isOpen]);

  const getListingModalSnapshot = React.useCallback((): string => {
    const sortedImages = [...images]
      .sort((a, b) => a.id - b.id)
      .map((img) => ({
        id: img.id,
        url: img.url,
        alt_text: img.alt_text,
        is_primary: img.is_primary,
        display_order: img.display_order,
      }));
    const sortedMenu = [...menuSections]
      .sort((a, b) => a.id - b.id)
      .map((section) => ({
        id: section.id,
        name: section.name,
        description: section.description,
        display_order: section.display_order,
        menu_items: section.menu_items
          ? [...section.menu_items]
              .sort((a, b) => a.id - b.id)
              .map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                price: item.price,
                is_available: item.is_available,
                is_featured: item.is_featured,
                display_order: item.display_order,
                image_url: item.image_url,
                image_alt: item.image_alt,
              }))
          : null,
      }));
    const sortedBranches = [...branches]
      .sort((a, b) => a.id - b.id)
      .map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
        country: b.country,
        latitude: b.latitude,
        longitude: b.longitude,
        phone_number: b.phone_number ?? null,
        is_primary: b.is_primary,
        opening_hours: !b.opening_hours?.length
          ? []
          : [...b.opening_hours]
              .map((h) => ({
                dayOfWeek: h.dayOfWeek,
                openTime: h.openTime,
                closeTime: h.closeTime,
                isClosed: h.isClosed,
                branch_id: h.branch_id ?? null,
              }))
              .sort((x, y) => {
                if (x.dayOfWeek !== y.dayOfWeek) {
                  return x.dayOfWeek - y.dayOfWeek;
                }
                return (x.branch_id ?? 0) - (y.branch_id ?? 0);
              }),
      }));
    const sortedDeals = [...deals].sort((a, b) => a.id - b.id);

    return JSON.stringify({
      formData,
      images: sortedImages,
      pendingImageDeletions: [...pendingImageDeletions].sort((a, b) => a - b),
      menuSections: sortedMenu,
      openingHours,
      branches: sortedBranches,
      deals: sortedDeals,
    });
  }, [
    formData,
    images,
    pendingImageDeletions,
    menuSections,
    openingHours,
    branches,
    deals,
  ]);

  React.useEffect(() => {
    if (!isOpen || snapshotReadyRef.current) return;
    if (listing?.id && editHydrationState !== "ready") return;

    snapshotReadyRef.current = true;
    setDirtyBaseline(getListingModalSnapshot());
  }, [isOpen, listing?.id, editHydrationState, getListingModalSnapshot]);

  const performClose = React.useCallback(async () => {
    setDiscardConfirmOpen(false);
    setPendingImageDeletions(new Set());

    const shouldCleanupTempGallery = !listing?.id && images.length > 0;

    if (shouldCleanupTempGallery) {
      try {
        const res = await fetch("/api/admin/listings/temp-images/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempSessionId }),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error("Failed to cleanup temp images", err);
        }
      } catch (err) {
        console.error("Failed to cleanup temp images", err);
      }
    }
    onClose();
  }, [onClose, tempSessionId, listing?.id, images.length]);

  const hasUnsavedChanges = React.useCallback((): boolean => {
    if (dirtyBaseline === null) {
      return false;
    }
    return getListingModalSnapshot() !== dirtyBaseline;
  }, [dirtyBaseline, getListingModalSnapshot]);

  const isEditHydrating =
    Boolean(listing?.id) && editHydrationState !== "ready";

  function requestClose(): void {
    if (isEditHydrating) {
      return;
    }
    if (hasUnsavedChanges()) {
      setDiscardConfirmOpen(true);
      return;
    }
    void performClose();
  }

  function handleDialogOpenChange(nextOpen: boolean): void {
    if (nextOpen) return;
    if (isEditHydrating) {
      return;
    }
    if (hasUnsavedChanges()) {
      setDiscardConfirmOpen(true);
      return;
    }
    void performClose();
  }

  function handleCancel(): void {
    requestClose();
  }

  // Move temp images to listing folder on save (new listing)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Listing name is required",
        variant: "destructive",
      });
      return;
    }

    // ...existing validation and save logic...
    // Validate social links URLs
    const urlValidationErrors: string[] = [];
    const validateUrl = (url: string, fieldName: string) => {
      if (!url.trim()) return true;
      // Basic check via URL constructor; fine to proceed if parseable
      try {
        const urlObj = new URL(url);
        const validDomains: Record<string, string[]> = {
          facebook_url: ["facebook.com", "www.facebook.com"],
          instagram_url: ["instagram.com", "www.instagram.com"],
          youtube_url: ["youtube.com", "www.youtube.com", "youtu.be"],
          // Broader google maps and short links
          google_maps_url: [
            "maps.google.com",
            "www.google.com",
            "google.com",
            "www.google.com.pk",
            "google.com.pk",
            "maps.app.goo.gl",
            "goo.gl",
            "g.page",
            "g.co",
          ],
        };
        const allowedDomains = validDomains[fieldName] || [];
        if (
          !allowedDomains.includes(urlObj.hostname) &&
          (fieldName !== "google_maps_url" ||
            !isLikelyGoogleMapsHost(urlObj.hostname))
        ) {
          urlValidationErrors.push(
            `${fieldName
              .replace("_url", "")
              .replace("_number", "")} URL is not valid`,
          );
          return false;
        }
        return true;
      } catch {
        urlValidationErrors.push(
          `${fieldName
            .replace("_url", "")
            .replace("_number", "")} URL format is invalid`,
        );
        return false;
      }
    };
    validateUrl(formData.facebook_url, "facebook_url");
    validateUrl(formData.instagram_url, "instagram_url");
    validateUrl(formData.youtube_url, "youtube_url");

    let resolvedLatitude = formData.latitude;
    let resolvedLongitude = formData.longitude;
    let resolvedGoogleMapsUrl = formData.google_maps_url;

    // If maps URL is provided, try to parse and auto-fill lat/lng and normalize
    if (resolvedGoogleMapsUrl?.trim()) {
      try {
        const parsed = parseGoogleMapsLink(resolvedGoogleMapsUrl.trim());
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          if (!resolvedLatitude) resolvedLatitude = String(parsed.lat);
          if (!resolvedLongitude) resolvedLongitude = String(parsed.lng);
        }
        if (parsed.normalizedUrl) {
          resolvedGoogleMapsUrl = parsed.normalizedUrl;
        }
      } catch {}
    }
    validateUrl(resolvedGoogleMapsUrl, "google_maps_url");
    if (urlValidationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: urlValidationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      // Validate opening hours only for published listings
      // Make opening hours optional: allow listings to be saved without timings.
      // We only block when one time is set and the other is missing (incomplete entry).
      if (formData.status === "published") {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        for (const hour of openingHours) {
          const openEmpty = !hour.openTime;
          const closeEmpty = !hour.closeTime;

          // If both empty and not explicitly closed, it's okay (optional)
          if (!hour.isClosed && openEmpty && closeEmpty) {
            continue;
          }

          // If explicitly marked closed, both open/close can be empty - that's OK
          if (hour.isClosed) continue;

          // If one of open/close is missing, show validation error
          if (!hour.isClosed && (openEmpty || closeEmpty)) {
            toast({
              title: "Error",
              description: `Please enter both open and close time for ${
                dayNames[hour.dayOfWeek]
              } or mark it as closed`,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }
      }
      const listingData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        address: formData.address?.trim() || null,
        phone_number: formData.phone_number?.trim() || null,
        email: formData.email?.trim() || null,
        website: formData.website?.trim() || null,
        category_id: formData.category_id
          ? parseInt(formData.category_id)
          : null,
        category_ids: (formData.category_ids?.length
          ? formData.category_ids
          : formData.category_id
            ? [formData.category_id]
            : []
        )
          .map((id) => parseInt(id, 10))
          .filter((n) => Number.isFinite(n)),
        latitude: resolvedLatitude ? parseFloat(resolvedLatitude) : null,
        longitude: resolvedLongitude ? parseFloat(resolvedLongitude) : null,
        is_featured: formData.is_featured,
        status: formData.status,
        show_member_badge: formData.show_member_badge,
        display_order: formData.display_order
          ? parseInt(formData.display_order)
          : null,
        custom_attributes: {
          ...formData.custom_attributes,
          custom_category: formData.custom_category?.trim() || null,
        } as unknown as Database["public"]["Tables"]["listings"]["Row"]["custom_attributes"],
        owner_id: formData.owner_id || null,
        menu_pdf_url: formData.menu_pdf_url,
        parking_information: formData.parking_information?.trim() || null,
        parking_amenities:
          formData.parking_amenities && formData.parking_amenities.length > 0
            ? formData.parking_amenities
            : null,
        // Social Links
        facebook_url: formData.facebook_url?.trim() || null,
        instagram_url: formData.instagram_url?.trim() || null,
        whatsapp_number: formData.whatsapp_number?.trim() || null,
        youtube_url: formData.youtube_url?.trim() || null,
        google_maps_url: resolvedGoogleMapsUrl?.trim() || null,
        place_id:
          typeof (formData as unknown as { place_id?: string }).place_id ===
          "string"
            ? (
                (formData as unknown as { place_id?: string }).place_id || ""
              ).trim() || null
            : null,
        ...(listing?.updated_at
          ? { expected_updated_at: listing.updated_at }
          : {}),
      };

      const result = await onSave(listingData);

      if (!result) {
        // onSave intentionally returns null after a handled failure
        // (validation error, 409 conflict, thrown error) - it has already
        // shown the user a toast, so there's nothing else to do here.
        return;
      }

      // Defensive: extract listing id from result shape
      let newListingId: number | undefined = undefined;
      if (result && typeof result === "object") {
        if (
          "listing" in result &&
          typeof (result as { listing: { id: number } }).listing?.id ===
            "number"
        ) {
          newListingId = (result as { listing: { id: number } }).listing.id;
        } else if (
          "id" in result &&
          typeof (result as { id: number }).id === "number"
        ) {
          newListingId = (result as { id: number }).id;
        } else if (
          "data" in result &&
          typeof (result as { data: any }).data === "object" &&
          (result as { data: any }).data !== null
        ) {
          const dataObj = (result as { data: any }).data;
          if (typeof dataObj.id === "number") {
            newListingId = dataObj.id;
          } else if (typeof dataObj.listing?.id === "number") {
            newListingId = dataObj.listing.id;
          }
        }
      }

      if (!listing?.id && images.length > 0 && newListingId) {
        try {
          const moveRes = await fetch("/api/admin/listings/temp-images/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempSessionId, listingId: newListingId }),
          });
          const moveData = await moveRes.json();
          if (!moveRes.ok) {
            console.error("[ListingModal] Move API failed", moveData);
            toast({
              title: "Image Error",
              description: "Some images could not be saved",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error("[ListingModal] Failed to move temp images", err);
        }
      }

      const effectiveListingId = listing?.id ?? newListingId;
      if (!effectiveListingId) {
        // Save failed or returned unexpected payload: stop before any dependent writes.
        return;
      }

      // Save opening hours for both edit and newly created listings
      // CRITICAL: Only save top-level opening hours for listings with NO branches.
      // Any listing with a branch (1 or more) manages hours exclusively via the
      // per-branch dialog (BranchesTab) - writing here too would clobber that
      // branch-specific save with this stale top-level `openingHours` state.
      try {
        const hoursListingId = effectiveListingId;

        if (hoursListingId) {
          // Fetch ACTUAL branch count from DB (don't trust state which might not be loaded yet)
          const branchCheckResponse = await fetch(
            `/api/admin/listings/${hoursListingId}/branches`,
          );
          const branchCheckData = await branchCheckResponse.json();
          const actualBranchCount = branchCheckData.branches?.length || 0;
          const hasAnyBranch = actualBranchCount > 0;

          if (hasAnyBranch) {
            // No-op: listings with a branch manage hours per branch.
          } else {
            const response = await fetch(
              `/api/admin/listings/${hoursListingId}/opening-hours`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ opening_hours: openingHours }),
              },
            );

            const result = await response.json();

            if (!response.ok) {
              console.error("[OPENING HOURS SAVE] Save failed:", result);
              toast({
                title: "Save Failed",
                description: "Opening hours could not be saved",
                variant: "destructive",
              });
            }
          }
        }
      } catch (err) {
        console.error("[ListingModal] Failed to save opening hours", err);
      }

      // Delete images that were marked for deletion (soft-deleted)
      if (effectiveListingId && pendingImageDeletions.size > 0) {
        const deletePromises = Array.from(pendingImageDeletions).map(
          async (imageId) => {
            try {
              const response = await fetch(
                `/api/admin/listings/${effectiveListingId}/images/${imageId}`,
                { method: "DELETE" },
              );
              if (!response.ok) {
                const error = await response.json();
                console.error(
                  `[ListingModal] Failed to delete image ${imageId}:`,
                  error,
                );
                return { imageId, success: false, error: error.error };
              }
              return { imageId, success: true };
            } catch (err) {
              console.error(
                `[ListingModal] Error deleting image ${imageId}:`,
                err,
              );
              return { imageId, success: false, error: String(err) };
            }
          },
        );

        const results = await Promise.all(deletePromises);
        const failed = results.filter((r) => !r.success);

        if (failed.length > 0) {
          console.error("[ListingModal] Some image deletions failed:", failed);
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
        }

        // Clear pending deletions
        setPendingImageDeletions(new Set());
      }
    } catch (error) {
      console.error("[ListingModal] Save flow failed", {
        listingId: listing?.id ?? null,
        changedKeys: Object.keys(formData),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      toast({
        title: "Error",
        description: "Failed to save listing",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number | CustomAttributes | string[] | null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Menu handler functions
  const handleAddSection = async () => {
    if (!listing?.id || menuLoading) return;

    // Validate required fields
    if (!sectionFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Section name is required",
        variant: "destructive",
      });
      return;
    }

    setMenuLoading(true);

    try {
      const response = await fetch(`/api/admin/listings/${listing.id}/menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sectionFormData,
          description: sectionFormData.description.trim() || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) => [...prev, result.data]);
        setShowAddSectionModal(false);
        setSectionFormData({ name: "", description: "", display_order: 0 });
        toast({
          title: "Success",
          description: "Menu section added successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error adding section:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add menu section",
        variant: "destructive",
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleEditSection = async () => {
    if (!listing?.id || !selectedSection) return;

    setMenuLoading(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/menu/sections/${selectedSection.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...sectionFormData,
            description: sectionFormData.description.trim() || null,
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) =>
          prev.map((section) =>
            section.id === selectedSection.id ? result.data : section,
          ),
        );
        setShowEditSectionModal(false);
        setSelectedSection(null);
        setSectionFormData({ name: "", description: "", display_order: 0 });
        toast({
          title: "Success",
          description: "Menu section updated successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error updating section:", error);
      toast({
        title: "Error",
        description: "Failed to update menu section",
        variant: "destructive",
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!listing?.id) return;

    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/menu/sections/${sectionId}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) =>
          prev.filter((section) => section.id !== sectionId),
        );
        toast({
          title: "Success",
          description: "Menu section deleted successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error deleting section:", error);
      toast({
        title: "Error",
        description: "Failed to delete menu section",
        variant: "destructive",
      });
    }
  };

  const handleAddItem = async () => {
    if (!listing?.id || menuLoading) return;

    // Validate required fields
    if (!itemFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    setMenuLoading(true);

    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/menu/sections/${itemFormData.section_id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemFormData.name.trim(),
            description: itemFormData.description.trim() || null,
            price: itemFormData.price,
            is_available: itemFormData.is_available,
            display_order: itemFormData.display_order,
            is_featured: itemFormData.is_featured,
            image_url: itemFormData.image_url?.trim() || null,
            image_alt: itemFormData.image_alt?.trim() || null,
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) =>
          prev.map((section) =>
            section.id === itemFormData.section_id
              ? {
                  ...section,
                  menu_items: section.menu_items
                    ? [...section.menu_items, result.data]
                    : [result.data],
                }
              : section,
          ),
        );
        setShowAddItemModal(false);
        setItemFormData({
          name: "",
          description: "",
          price: 0,
          is_available: true,
          display_order: 0,
          section_id: 0,
          is_featured: false,
          image_url: null,
          image_alt: null,
        });
        toast({
          title: "Success",
          description: "Menu item added successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error adding item:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add menu item",
        variant: "destructive",
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleEditItem = async (
    sectionId: number,
    itemId: number,
    itemData: {
      name: string;
      description: string;
      price: number;
      is_available: boolean;
      display_order: number;
      section_id: number;
      is_featured: boolean;
      image_url: string | null;
      image_alt: string | null;
    },
    onSuccess?: () => void,
  ) => {
    if (!listing?.id) return;

    setMenuLoading(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/menu/sections/${sectionId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemData.name,
            description: itemData.description?.trim() || null,
            price: itemData.price,
            is_available: itemData.is_available,
            display_order: itemData.display_order,
            is_featured: itemData.is_featured,
            image_url: itemData.image_url?.trim() || null,
            image_alt: itemData.image_alt?.trim() || null,
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) =>
          prev.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  menu_items:
                    section.menu_items?.map((item) =>
                      item.id === itemId ? result.data : item,
                    ) || null,
                }
              : section,
          ),
        );
        onSuccess?.();
        toast({
          title: "Success",
          description: "Menu item updated successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast({
        title: "Error",
        description: "Failed to update menu item",
        variant: "destructive",
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDeleteItem = async (sectionId: number, itemId: number) => {
    if (!listing?.id) return;

    try {
      const response = await fetch(
        `/api/admin/listings/${listing.id}/menu/sections/${sectionId}/items/${itemId}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();
      if (result.success) {
        setMenuSections((prev) =>
          prev.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  menu_items:
                    section.menu_items?.filter((item) => item.id !== itemId) ||
                    null,
                }
              : section,
          ),
        );
        toast({
          title: "Success",
          description: "Menu item deleted successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error",
        description: "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          ref={modalRef}
          className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          style={{
            contain: "layout style paint",
            isolation: "isolate",
          }}
        >
          <DialogHeader className="flex-shrink-0 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Tag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">
                    {modalMode === "edit"
                      ? "Edit Listing"
                      : "Create New Listing"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    {modalMode === "edit"
                      ? "Update listing details and settings"
                      : "Fill in the details to create a new listing"}
                  </DialogDescription>
                </div>
              </div>
              {modalMode === "edit" && (
                <Badge
                  variant={
                    formData.status === "published"
                      ? "default"
                      : formData.status === "draft"
                        ? "secondary"
                        : "outline"
                  }
                  className="capitalize"
                >
                  {getListingStatusLabel(formData.status)}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {editorConflictText && (
            <div className="mx-6 mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>{editorConflictText}</strong> Your changes may conflict.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-7 mb-6">
                <TabsTrigger
                  value="details"
                  className="flex items-center gap-2"
                >
                  <Tag className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="attributes"
                  className="flex items-center gap-2"
                >
                  <Star className="h-4 w-4" />
                  Attributes
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  Menu
                </TabsTrigger>
                <TabsTrigger
                  value="gallery"
                  className="flex items-center gap-2"
                >
                  <GalleryIcon className="h-4 w-4" />
                  Gallery
                </TabsTrigger>
                <TabsTrigger value="hours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Hours
                </TabsTrigger>
                <TabsTrigger
                  value="branches"
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Branches
                </TabsTrigger>
                <TabsTrigger value="deals" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Deals
                </TabsTrigger>
              </TabsList>

              {activeTab === "details" && (
                <DetailsTab
                  formData={formData}
                  onInputChange={handleInputChange}
                  categories={categories}
                  categoriesLoading={categoriesLoading}
                  onSubmit={handleSubmit}
                  listing={listing}
                  branches={branches}
                  hideAdminFields={hideAdminFields}
                />
              )}

              {activeTab === "attributes" && (
                <AttributesTab
                  customAttributes={formData.custom_attributes}
                  onChange={(attributes) =>
                    handleInputChange("custom_attributes", attributes)
                  }
                  isLoading={isLoading}
                  listingId={listing?.id}
                />
              )}

              {activeTab === "gallery" && (
                <GalleryTab
                  listingId={listing?.id || null}
                  tempSessionId={!listing?.id ? tempSessionId : undefined}
                  images={images}
                  onImagesChange={setImages}
                  isLoading={isLoading}
                  pendingDeletions={pendingImageDeletions}
                  onPendingDeletionsChange={setPendingImageDeletions}
                />
              )}

              {activeTab === "hours" && (
                <HoursTab
                  openingHours={openingHours}
                  onChange={setOpeningHours}
                  isLoading={isLoading}
                  branches={branches}
                />
              )}

              {activeTab === "branches" && (
                <BranchesTab
                  listingId={listing?.id || null}
                  branches={branches}
                  isLoading={branchesLoading}
                  onUpdate={fetchBranches}
                />
              )}

              {activeTab === "menu" && (
                <MenuTab
                  listingId={listing?.id || null}
                  menuPdfUrl={formData.menu_pdf_url}
                  onMenuPdfUpdate={(pdfUrl: string | null) => {
                    setFormData((prev) => ({
                      ...prev,
                      menu_pdf_url: pdfUrl,
                    }));
                  }}
                  menuSections={menuSections}
                  menuLoading={menuLoading}
                  onAddSection={handleAddSection}
                  onEditSection={handleEditSection}
                  onDeleteSection={handleDeleteSection}
                  onAddItem={handleAddItem}
                  onEditItem={handleEditItem}
                  onDeleteItem={handleDeleteItem}
                />
              )}

              {activeTab === "deals" && (
                <DealsTab
                  listingId={listing?.id?.toString() || ""}
                  deals={deals}
                  banks={banks}
                  onDealsChange={setDeals}
                />
              )}
            </Tabs>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 pt-6 border-t bg-background/50 backdrop-blur-sm">
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading || isEditHydrating}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading || isEditHydrating}
                className="px-6 min-w-[120px]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : modalMode === "edit" ? (
                  "Update Listing"
                ) : (
                  <>Create Listing</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>

        {/* Add Section Modal */}
        <Dialog
          open={showAddSectionModal}
          onOpenChange={setShowAddSectionModal}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Menu Section</DialogTitle>
              <DialogDescription>
                Create a new section for your menu
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="section-name">Section Name</Label>
                <Input
                  id="section-name"
                  name="section-name"
                  autoComplete="off"
                  value={sectionFormData.name}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Appetizers, Main Course"
                />
              </div>
              <div>
                <Label htmlFor="section-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="section-description"
                  name="section-description"
                  autoComplete="off"
                  value={sectionFormData.description}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of this section"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="section-order">Display Order</Label>
                <Input
                  id="section-order"
                  name="section-order"
                  type="number"
                  autoComplete="off"
                  value={sectionFormData.display_order}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      display_order: parseInt(e.target.value) || 0,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddSectionModal(false);
                  setSectionFormData({
                    name: "",
                    description: "",
                    display_order: 0,
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSection}
                disabled={menuLoading || !sectionFormData.name.trim()}
              >
                {menuLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Section"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Section Modal */}
        <Dialog
          open={showEditSectionModal}
          onOpenChange={setShowEditSectionModal}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Menu Section</DialogTitle>
              <DialogDescription>Update the section details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-section-name">Section Name</Label>
                <Input
                  id="edit-section-name"
                  value={sectionFormData.name}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Appetizers, Main Course"
                />
              </div>
              <div>
                <Label htmlFor="edit-section-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="edit-section-description"
                  value={sectionFormData.description}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of this section"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-section-order">Display Order</Label>
                <Input
                  id="edit-section-order"
                  type="number"
                  value={sectionFormData.display_order}
                  onChange={(e) =>
                    setSectionFormData((prev) => ({
                      ...prev,
                      display_order: parseInt(e.target.value) || 0,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditSectionModal(false);
                  setSelectedSection(null);
                  setSectionFormData({
                    name: "",
                    description: "",
                    display_order: 0,
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditSection} disabled={menuLoading}>
                Update Section
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Item Modal */}
        <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Menu Item</DialogTitle>
              <DialogDescription>
                Add a new item to this menu section
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  value={itemFormData.name}
                  onChange={(e) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Chicken Biryani"
                />
              </div>
              <div>
                <Label htmlFor="item-description">Description (Optional)</Label>
                <Textarea
                  id="item-description"
                  value={itemFormData.description}
                  onChange={(e) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of this item"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="item-price">Price (Rs.)</Label>
                <Input
                  id="item-price"
                  type="number"
                  value={itemFormData.price}
                  onChange={(e) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      price: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="item-available"
                    checked={itemFormData.is_available}
                    onCheckedChange={(checked) =>
                      setItemFormData((prev) => ({
                        ...prev,
                        is_available: checked,
                      }))
                    }
                  />
                  <Label htmlFor="item-available">Available</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="item-featured"
                    checked={itemFormData.is_featured}
                    onCheckedChange={(checked) =>
                      setItemFormData((prev) => ({
                        ...prev,
                        is_featured: checked,
                      }))
                    }
                  />
                  <Label htmlFor="item-featured">Featured Item</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="item-order">Display Order</Label>
                <Input
                  id="item-order"
                  type="number"
                  value={itemFormData.display_order}
                  onChange={(e) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      display_order: parseInt(e.target.value) || 0,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <MenuItemImageUpload
                  listingId={listing?.id || 0}
                  sectionId={
                    selectedItem?.section_id || itemFormData.section_id
                  }
                  itemId={selectedItem?.id || 0}
                  currentImageUrl={itemFormData.image_url}
                  currentImageAlt={itemFormData.image_alt}
                  onImageUpdate={(
                    imageUrl: string | null,
                    imageAlt: string | null,
                  ) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      image_url: imageUrl,
                      image_alt: imageAlt,
                    }))
                  }
                  isLoading={menuLoading}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddItemModal(false);
                  setItemFormData({
                    name: "",
                    description: "",
                    price: 0,
                    is_available: true,
                    display_order: 0,
                    section_id: 0,
                    is_featured: false,
                    image_url: null,
                    image_alt: null,
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={menuLoading || !itemFormData.name.trim()}
              >
                {menuLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Item"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Dialog>

      <AlertDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
      >
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void performClose()}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
