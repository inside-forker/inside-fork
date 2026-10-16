"use client";

import * as React from "react";
import Link from "next/link";
import {
  Copy,
  Plus,
  Trash2,
  Search,
  MapPin,
  Clock,
  Store,
  Link2,
  ExternalLink,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  Phone,
  CheckCircle2,
  X,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type {
  DuplicatorSearchListing,
  DuplicatorSourceListing,
  DuplicatorOpeningHour,
  DuplicateListingsResult,
} from "@/lib/listings/duplicate-listings";

// Day names in Monday-first order for Karachi display (1=Mon ... 6=Sat, 0=Sun)
const DAYS_CONFIG = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 0, label: "Sunday" },
];

// Popular Karachi areas for one-click branch creation
const KARACHI_AREAS = [
  "Clifton",
  "DHA Phase 5",
  "DHA Phase 6",
  "Gulshan-e-Iqbal",
  "SMCHS",
  "North Nazimabad",
  "Bahria Town",
  "Gulistan-e-Johar",
  "Tipu Sultan",
  "PECHS",
  "Lucky One Mall",
  "Dolmen Mall Clifton",
  "Ocean Mall",
  "Malir Cantt",
  "North Karachi",
  "FB Area",
  "Boat Basin",
  "Khayaban-e-Shahbaz",
  "Khayaban-e-Bukhari",
  "Sindhi Muslim",
];

type DuplicateDraft = {
  id: string; // client-side unique key
  name: string;
  address: string;
  phone_number: string;
  status: "published" | "draft";
  latitude: string;
  longitude: string;
  google_maps_url: string;
  place_id: string;
  opening_hours: DuplicatorOpeningHour[];
  isCustomHours: boolean;
  showAdvanced: boolean;
};

export function ListingsDuplicatorPage() {
  const { toast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<DuplicatorSearchListing[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);

  // Selected source listing
  const [selectedSourceId, setSelectedSourceId] = React.useState<number | null>(null);
  const [isLoadingSource, setIsLoadingSource] = React.useState(false);
  const [sourceListing, setSourceListing] = React.useState<DuplicatorSourceListing | null>(null);

  // Brand configuration
  const [brandName, setBrandName] = React.useState("");

  // Duplicates list
  const [duplicates, setDuplicates] = React.useState<DuplicateDraft[]>([]);
  const [customAddCount, setCustomAddCount] = React.useState<number>(1);

  // Timing editor dialog
  const [editingHoursRowId, setEditingHoursRowId] = React.useState<string | null>(null);
  const [tempHours, setTempHours] = React.useState<DuplicatorOpeningHour[]>([]);

  // Batch timing editor (apply to all)
  const [showBatchTimingDialog, setShowBatchTimingDialog] = React.useState(false);
  const [batchHours, setBatchHours] = React.useState<DuplicatorOpeningHour[]>([]);

  // Execution state
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const [duplicationResult, setDuplicationResult] = React.useState<DuplicateListingsResult | null>(
    null,
  );

  // Debounced search
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/admin/listings-duplicator?search=${encodeURIComponent(searchQuery.trim())}`,
        );
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.listings || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load selected listing details
  const loadSourceListing = React.useCallback(
    async (id: number) => {
      setIsLoadingSource(true);
      setDuplicationResult(null);
      try {
        const res = await fetch(`/api/admin/listings-duplicator?id=${id}`);
        const data = await res.json();
        if (data.success && data.listing) {
          const l: DuplicatorSourceListing = data.listing;
          setSourceListing(l);
          setSelectedSourceId(l.id);
          setBrandName(l.suggested_brand_name || l.name);

          // Clear previous duplicates and initialize batch hours
          setDuplicates([]);
          setBatchHours(l.opening_hours);
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to load listing details",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Fetch source error:", err);
        toast({
          title: "Network Error",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSource(false);
        setShowDropdown(false);
      }
    },
    [toast],
  );

  // Helper to create a new duplicate draft
  const createDraftRow = React.useCallback(
    (areaName?: string): DuplicateDraft => {
      const bName = brandName.trim() || sourceListing?.suggested_brand_name || "Listing";
      const name = areaName ? `${bName} - ${areaName}` : `${bName} - `;
      const address = areaName ? `${areaName}, Karachi` : "";

      return {
        id: crypto.randomUUID(),
        name,
        address,
        phone_number: sourceListing?.phone_number || "",
        status: (sourceListing?.status as "published" | "draft") || "published",
        latitude: "",
        longitude: "",
        google_maps_url: "",
        place_id: "",
        opening_hours: sourceListing?.opening_hours || [],
        isCustomHours: false,
        showAdvanced: false,
      };
    },
    [brandName, sourceListing],
  );

  // Add N duplicates
  const addDuplicates = (count: number) => {
    if (!sourceListing) return;
    const newRows: DuplicateDraft[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createDraftRow());
    }
    setDuplicates((prev) => [...prev, ...newRows]);
  };

  // Add by clicking an area pill
  const addByArea = (area: string) => {
    if (!sourceListing) return;
    setDuplicates((prev) => [...prev, createDraftRow(area)]);
    toast({
      title: "Branch Added",
      description: `Added "${brandName || sourceListing.name} - ${area}"`,
    });
  };

  // Update a single draft row field
  const updateDraft = (id: string, updates: Partial<DuplicateDraft>) => {
    setDuplicates((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  // Remove a draft row
  const removeDraft = (id: string) => {
    setDuplicates((prev) => prev.filter((d) => d.id !== id));
  };

  // Clone a draft row
  const cloneDraft = (draft: DuplicateDraft) => {
    const cloned: DuplicateDraft = {
      ...draft,
      id: crypto.randomUUID(),
      name: `${draft.name} (Copy)`,
    };
    setDuplicates((prev) => [...prev, cloned]);
  };

  // Open hours editor for row
  const openHoursEditor = (row: DuplicateDraft) => {
    setEditingHoursRowId(row.id);
    setTempHours(JSON.parse(JSON.stringify(row.opening_hours)));
  };

  // Save hours for row
  const saveRowHours = () => {
    if (!editingHoursRowId) return;
    updateDraft(editingHoursRowId, {
      opening_hours: tempHours,
      isCustomHours: true,
    });
    setEditingHoursRowId(null);
  };

  // Apply batch hours to all rows
  const applyBatchHoursToAll = () => {
    setDuplicates((prev) =>
      prev.map((d) => ({
        ...d,
        opening_hours: JSON.parse(JSON.stringify(batchHours)),
        isCustomHours: true,
      })),
    );
    setShowBatchTimingDialog(false);
    toast({
      title: "Timings Applied",
      description: `Updated operating hours across all ${duplicates.length} duplicates`,
    });
  };

  // Reset all to source hours
  const resetAllHoursToSource = () => {
    if (!sourceListing) return;
    setDuplicates((prev) =>
      prev.map((d) => ({
        ...d,
        opening_hours: JSON.parse(JSON.stringify(sourceListing.opening_hours)),
        isCustomHours: false,
      })),
    );
    toast({
      title: "Reset Timings",
      description: "Restored source listing's operating hours to all duplicates",
    });
  };

  // Set all status
  const setAllStatus = (status: "published" | "draft") => {
    setDuplicates((prev) => prev.map((d) => ({ ...d, status })));
  };

  // Execute Duplication
  const handleExecuteDuplication = async () => {
    if (!sourceListing) return;
    if (!brandName.trim()) {
      toast({
        title: "Brand Name Required",
        description: "Please specify the brand name for this group of listings.",
        variant: "destructive",
      });
      return;
    }
    if (duplicates.length === 0) {
      toast({
        title: "No Duplicates Configured",
        description: "Please add at least one duplicate listing.",
        variant: "destructive",
      });
      return;
    }

    // Validation
    for (let i = 0; i < duplicates.length; i++) {
      const d = duplicates[i];
      if (!d.name.trim()) {
        toast({
          title: "Missing Name",
          description: `Duplicate #${i + 1} is missing a listing name.`,
          variant: "destructive",
        });
        return;
      }
      if (!d.address.trim()) {
        toast({
          title: "Missing Address",
          description: `Duplicate #${i + 1} (${d.name}) needs an address or location.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsDuplicating(true);
    try {
      const payload = {
        source_listing_id: sourceListing.id,
        brand_name: brandName.trim(),
        duplicates: duplicates.map((d) => ({
          name: d.name.trim(),
          address: d.address.trim(),
          phone_number: d.phone_number.trim() || null,
          status: d.status,
          latitude: d.latitude ? parseFloat(d.latitude) : null,
          longitude: d.longitude ? parseFloat(d.longitude) : null,
          google_maps_url: d.google_maps_url.trim() || null,
          place_id: d.place_id.trim() || null,
          opening_hours: d.isCustomHours ? d.opening_hours : undefined,
        })),
      };

      const res = await fetch("/api/admin/listings-duplicator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setDuplicationResult(data.data);
        toast({
          title: "Duplication Successful!",
          description: `Created ${data.data.created_listings.length} listings linked under "${data.data.brand_group.name}"`,
        });
      } else {
        toast({
          title: "Duplication Failed",
          description: data.error || "Failed to create duplicates",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Execute duplication error:", err);
      toast({
        title: "Network Error",
        description: "An unexpected error occurred while duplicating.",
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Search / Lookup Bar */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Step 1: Look Up Source Listing
          </CardTitle>
          <CardDescription>
            Search by listing name, address, or ID. All photos, categories, amenities, and details
            will be cloned from this listing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search listing (e.g. 'Pizza Max', 'SMCHS', 'Xander's', or ID '124')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                className="pl-10 pr-10 h-11 text-base bg-background/80"
              />
              {isSearching ? (
                <RefreshCw className="absolute right-3.5 h-4 w-4 text-muted-foreground animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowDropdown(false);
                  }}
                  className="absolute right-3.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Results Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-2xl max-h-96 overflow-y-auto divide-y divide-border/40">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadSourceListing(item.id)}
                    className="w-full text-left p-3 hover:bg-muted/70 transition-colors flex items-center gap-3.5"
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {item.name}
                        </span>
                        <Badge
                          variant={item.status === "published" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-mono px-1.5 py-0"
                        >
                          {item.status}
                        </Badge>
                        {item.brand_group_name && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                            <Link2 className="h-2.5 w-2.5 mr-1" />
                            {item.brand_group_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.address || "No address specified"}
                        {item.category_name ? ` • ${item.category_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      #{item.id}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading Source Spinner */}
      {isLoadingSource && (
        <div className="p-12 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm font-medium">Loading listing details & media...</p>
        </div>
      )}

      {/* Source Listing Selected Card */}
      {sourceListing && !isLoadingSource && (
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-md">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                {sourceListing.images[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sourceListing.images[0].url}
                    alt={sourceListing.name}
                    className="w-16 h-16 rounded-xl object-cover border border-primary/20 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Store className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-foreground">
                      {sourceListing.name}
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs">
                      #{sourceListing.id}
                    </Badge>
                    <Badge
                      variant={sourceListing.status === "published" ? "default" : "secondary"}
                    >
                      {sourceListing.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {sourceListing.address || "No address specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/listing/${sourceListing.slug}`}
                  target="_blank"
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Live
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSourceListing(null);
                    setSelectedSourceId(null);
                    setDuplicates([]);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change Listing
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cloned Assets Summary */}
            <div className="space-y-2 text-sm">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Assets to be Replicated:
              </span>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  <strong className="text-foreground">{sourceListing.images.length}</strong> photo(s) in gallery
                </li>
                <li>
                  Categories:{" "}
                  <strong className="text-foreground">
                    {sourceListing.categories.map((c) => c.name).join(", ") || "General"}
                  </strong>
                </li>
                <li>
                  Phone:{" "}
                  <strong className="text-foreground">{sourceListing.phone_number || "None"}</strong>
                </li>
                <li>
                  Description, social links & custom amenities preserved
                </li>
              </ul>
            </div>

            {/* Brand Group Connection */}
            <div className="md:col-span-2 space-y-3 bg-background/50 p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                  <Link2 className="h-4 w-4 text-primary" />
                  Brand Group Auto-Linking:
                </span>
                {sourceListing.brand_group && (
                  <Badge variant="outline" className="text-xs text-primary border-primary/30">
                    Already Linked ({sourceListing.brand_group.member_count} branches)
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Brand Name (Used to link all outlets together on frontend & mobile):
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Brand name, e.g. 'Pizza Max'"
                    className="h-9 font-medium"
                  />
                  {sourceListing.suggested_brand_name &&
                    brandName !== sourceListing.suggested_brand_name && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBrandName(sourceListing.suggested_brand_name)}
                        className="text-xs h-9 whitespace-nowrap"
                      >
                        Reset to &ldquo;{sourceListing.suggested_brand_name}&rdquo;
                      </Button>
                    )}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  When published, all {duplicates.length + 1} listings will show the other-branch
                  picker on their detail pages automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Duplicates Configuration */}
      {sourceListing && !isLoadingSource && (
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Copy className="h-5 w-5 text-primary" />
                    Step 2: Configure Branch Duplicates
                  </CardTitle>
                  <CardDescription>
                    Create as many branch duplicates as needed (e.g. 10, 19, 20, 25+). Each duplicate
                    inherits everything, with customized name, location, and operating hours.
                  </CardDescription>
                </div>

                {/* Batch Add Counter & Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">
                    Add Duplicates:
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addDuplicates(1)}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> +1
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addDuplicates(5)}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> +5
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addDuplicates(10)}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> +10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addDuplicates(20)}
                    className="gap-1 font-semibold text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" /> +20
                  </Button>

                  {/* Custom Number Input */}
                  <div className="flex items-center gap-1 ml-2 border rounded-lg px-2 bg-background">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={customAddCount}
                      onChange={(e) => setCustomAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 h-8 text-center text-xs p-1 border-0 focus-visible:ring-0"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(customAddCount)}
                      className="h-7 text-xs px-2 font-medium"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Fast Area Pill Presets */}
              <div className="space-y-2 bg-muted/30 p-3.5 rounded-xl border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Quick Karachi Area Presets (Click to add branch):
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Auto-names &ldquo;{brandName || sourceListing.name} - [Area]&rdquo;
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {KARACHI_AREAS.map((area) => (
                    <Button
                      key={area}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addByArea(area)}
                      className="h-7 text-xs px-2.5 rounded-full hover:bg-primary/20 hover:text-primary transition-colors"
                    >
                      + {area}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Duplicates Count and Bulk Actions Bar */}
              {duplicates.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5">
                      {duplicates.length} {duplicates.length === 1 ? "Duplicate" : "Duplicates"} Configured
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Fill in the branch-specific details below
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchHours(JSON.parse(JSON.stringify(sourceListing.opening_hours)));
                        setShowBatchTimingDialog(true);
                      }}
                      className="h-8 text-xs gap-1"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Batch Timings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetAllHoursToSource}
                      className="h-8 text-xs"
                    >
                      Source Hours to All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllStatus("published")}
                      className="h-8 text-xs"
                    >
                      All Published
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllStatus("draft")}
                      className="h-8 text-xs"
                    >
                      All Draft
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDuplicates([])}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {duplicates.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl border-border/60">
                  <Copy className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground text-base">
                    No duplicates added yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Click one of the quick count buttons (+1, +5, +10, +20) or click an area pill above
                    to start building your branch duplicates.
                  </p>
                  <Button onClick={() => addDuplicates(1)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add First Duplicate
                  </Button>
                </div>
              )}

              {/* Duplicates List */}
              <div className="space-y-4">
                {duplicates.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
                        >
                          #{idx + 1}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                          {draft.name || `Duplicate #${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => cloneDraft(draft)}
                          title="Clone this duplicate"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDraft(draft.id)}
                          title="Remove this duplicate"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Main Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Header Name */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                          <span>Header / Listing Name <span className="text-destructive">*</span></span>
                        </label>
                        <Input
                          placeholder="e.g. Pizza Max - Gulshan"
                          value={draft.name}
                          onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                          className="h-9 font-medium"
                        />
                      </div>

                      {/* Location / Address */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Location / Address <span className="text-destructive">*</span>
                        </label>
                        <Input
                          placeholder="Shop / block address, Karachi"
                          value={draft.address}
                          onChange={(e) => updateDraft(draft.id, { address: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      {/* Phone */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Branch Phone
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Phone number"
                            value={draft.phone_number}
                            onChange={(e) =>
                              updateDraft(draft.id, { phone_number: e.target.value })
                            }
                            className="h-9 pl-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Secondary Row: Hours & Status & Advanced Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Select */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Status:</span>
                          <Select
                            value={draft.status}
                            onValueChange={(val: "published" | "draft") =>
                              updateDraft(draft.id, { status: val })
                            }
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Timing Trigger */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Hours:</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openHoursEditor(draft)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {draft.isCustomHours ? (
                              <span className="text-primary font-medium">Custom Hours</span>
                            ) : (
                              <span>Same as Source</span>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Advanced toggle (Coordinates, Google Place ID, Maps URL) */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateDraft(draft.id, { showAdvanced: !draft.showAdvanced })
                        }
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        {draft.showAdvanced ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Hide Coordinates & Maps
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> GPS Coordinates & Maps Link
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Advanced Collapsible Section */}
                    {draft.showAdvanced && (
                      <div className="p-3 bg-muted/30 rounded-lg border border-border/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mt-2">
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Latitude</label>
                          <Input
                            placeholder="e.g. 24.9123"
                            value={draft.latitude}
                            onChange={(e) => updateDraft(draft.id, { latitude: e.target.value })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Longitude</label>
                          <Input
                            placeholder="e.g. 67.0987"
                            value={draft.longitude}
                            onChange={(e) => updateDraft(draft.id, { longitude: e.target.value })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Google Maps URL</label>
                          <Input
                            placeholder="https://maps.google.com/..."
                            value={draft.google_maps_url}
                            onChange={(e) =>
                              updateDraft(draft.id, { google_maps_url: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add more button at bottom of list */}
              {duplicates.length > 0 && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => addDuplicates(1)}
                    className="gap-2 border-dashed"
                  >
                    <Plus className="h-4 w-4" /> Add Another Duplicate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Duplication Action Bar */}
          {duplicates.length > 0 && (
            <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Ready to Create {duplicates.length} {duplicates.length === 1 ? "Listing" : "Listings"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      All new listings and &ldquo;{sourceListing.name}&rdquo; will be automatically grouped
                      under brand <strong className="text-foreground">&ldquo;{brandName}&rdquo;</strong>.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    disabled={isDuplicating}
                    onClick={handleExecuteDuplication}
                    className="font-semibold text-base px-8 h-12 shadow-md gap-2"
                  >
                    {isDuplicating ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Duplicating {duplicates.length} Listings...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Duplicate & Create {duplicates.length} Listings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Success Modal / Report View */}
      {duplicationResult && (
        <Card className="border-green-500/40 bg-gradient-to-br from-card to-green-500/5 shadow-xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500/10 rounded-xl text-green-500">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-2xl text-foreground">
                  Duplication Complete!
                </CardTitle>
                <CardDescription className="text-sm">
                  Created {duplicationResult.created_listings.length} listings linked under Brand Group &ldquo;
                  {duplicationResult.brand_group.name}&rdquo;.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <Alert className="bg-green-500/10 border-green-500/30 text-foreground">
              <Check className="h-4 w-4 text-green-500" />
              <AlertTitle className="font-semibold">Brand Group Linked Successfully</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                All outlets can now switch between each other on both web and mobile detail pages.
              </AlertDescription>
            </Alert>

            {/* List of Created Items */}
            <div className="space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Created Outlets ({duplicationResult.created_listings.length}):
              </span>
              <div className="divide-y divide-border/40 border rounded-xl overflow-hidden bg-background/50">
                {duplicationResult.created_listings.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {item.name}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          #{item.id}
                        </Badge>
                        <Badge
                          variant={item.status === "published" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.address || "No address"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/listing/${item.slug}`}
                        target="_blank"
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> View Live
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/admin/brand-groups">
                <Button variant="outline" className="gap-2">
                  <Link2 className="h-4 w-4" /> Go to Brand Groups
                </Button>
              </Link>
              <Link href="/admin/listings">
                <Button variant="outline" className="gap-2">
                  <Store className="h-4 w-4" /> Go to Listings Management
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setDuplicationResult(null);
                  setDuplicates([]);
                }}
                className="gap-2 ml-auto"
              >
                Duplicate More Outlets <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row Timing Editor Dialog */}
      <Dialog
        open={Boolean(editingHoursRowId)}
        onOpenChange={(open) => {
          if (!open) setEditingHoursRowId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Customize Operating Hours
            </DialogTitle>
            <DialogDescription>
              Set the opening and closing hours for this branch outlet (Monday through Sunday).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 divide-y divide-border/40">
              {DAYS_CONFIG.map(({ dayOfWeek, label }) => {
                const hourItem =
                  tempHours.find((h) => h.dayOfWeek === dayOfWeek) || {
                    dayOfWeek,
                    openTime: "12:00",
                    closeTime: "00:00",
                    isClosed: false,
                  };

                return (
                  <div
                    key={dayOfWeek}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="font-semibold text-foreground w-24">
                      {label}
                    </span>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <label className="flex items-center gap-1.5 cursor-pointer mr-3">
                        <input
                          type="checkbox"
                          checked={hourItem.isClosed}
                          onChange={(e) => {
                            const isClosed = e.target.checked;
                            setTempHours((prev) =>
                              prev.map((h) =>
                                h.dayOfWeek === dayOfWeek ? { ...h, isClosed } : h,
                              ),
                            );
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-muted-foreground">Closed</span>
                      </label>

                      {!hourItem.isClosed ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={hourItem.openTime || "12:00"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempHours((prev) =>
                                prev.map((h) =>
                                  h.dayOfWeek === dayOfWeek
                                    ? { ...h, openTime: val }
                                    : h,
                                ),
                              );
                            }}
                            className="w-28 h-8 text-xs font-mono"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={hourItem.closeTime || "00:00"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempHours((prev) =>
                                prev.map((h) =>
                                  h.dayOfWeek === dayOfWeek
                                    ? { ...h, closeTime: val }
                                    : h,
                                ),
                              );
                            }}
                            className="w-28 h-8 text-xs font-mono"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic w-64 text-center">
                          Closed all day
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick helper */}
            <div className="flex items-center gap-2 pt-2 border-t text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const mon = tempHours.find((h) => h.dayOfWeek === 1);
                  if (!mon) return;
                  setTempHours((prev) =>
                    prev.map((h) => ({
                      ...h,
                      openTime: mon.openTime,
                      closeTime: mon.closeTime,
                      isClosed: mon.isClosed,
                    })),
                  );
                }}
                className="text-xs h-7"
              >
                Copy Monday to All Days
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (sourceListing) {
                    setTempHours(JSON.parse(JSON.stringify(sourceListing.opening_hours)));
                  }
                }}
                className="text-xs h-7 text-muted-foreground"
              >
                Reset to Source Hours
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingHoursRowId(null)}>
              Cancel
            </Button>
            <Button onClick={saveRowHours}>Apply Hours to Branch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Timing Editor Dialog (Apply to All) */}
      <Dialog open={showBatchTimingDialog} onOpenChange={setShowBatchTimingDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Batch Operating Hours for All Duplicates
            </DialogTitle>
            <DialogDescription>
              Adjust hours below and click &ldquo;Apply to All&rdquo; to set the same schedule on all{" "}
              {duplicates.length} duplicate branches at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 divide-y divide-border/40">
              {DAYS_CONFIG.map(({ dayOfWeek, label }) => {
                const hourItem =
                  batchHours.find((h) => h.dayOfWeek === dayOfWeek) || {
                    dayOfWeek,
                    openTime: "12:00",
                    closeTime: "00:00",
                    isClosed: false,
                  };

                return (
                  <div
                    key={dayOfWeek}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="font-semibold text-foreground w-24">
                      {label}
                    </span>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <label className="flex items-center gap-1.5 cursor-pointer mr-3">
                        <input
                          type="checkbox"
                          checked={hourItem.isClosed}
                          onChange={(e) => {
                            const isClosed = e.target.checked;
                            setBatchHours((prev) =>
                              prev.map((h) =>
                                h.dayOfWeek === dayOfWeek ? { ...h, isClosed } : h,
                              ),
                            );
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-muted-foreground">Closed</span>
                      </label>

                      {!hourItem.isClosed ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={hourItem.openTime || "12:00"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchHours((prev) =>
                                prev.map((h) =>
                                  h.dayOfWeek === dayOfWeek
                                    ? { ...h, openTime: val }
                                    : h,
                                ),
                              );
                            }}
                            className="w-28 h-8 text-xs font-mono"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={hourItem.closeTime || "00:00"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchHours((prev) =>
                                prev.map((h) =>
                                  h.dayOfWeek === dayOfWeek
                                    ? { ...h, closeTime: val }
                                    : h,
                                ),
                              );
                            }}
                            className="w-28 h-8 text-xs font-mono"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic w-64 text-center">
                          Closed all day
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const mon = batchHours.find((h) => h.dayOfWeek === 1);
                  if (!mon) return;
                  setBatchHours((prev) =>
                    prev.map((h) => ({
                      ...h,
                      openTime: mon.openTime,
                      closeTime: mon.closeTime,
                      isClosed: mon.isClosed,
                    })),
                  );
                }}
                className="text-xs h-7"
              >
                Copy Monday to All Days
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBatchTimingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={applyBatchHoursToAll}>
              Apply to All {duplicates.length} Duplicates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
