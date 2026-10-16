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
  Phone,
  CheckCircle2,
  X,
  ArrowRight,
  Info,
  Navigation,
  Globe,
  FileText,
  Maximize2,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [customAddCount, setCustomAddCount] = React.useState<number>(5);

  // Timing editor dialog (single row)
  const [editingHoursRowId, setEditingHoursRowId] = React.useState<string | null>(null);
  const [tempHours, setTempHours] = React.useState<DuplicatorOpeningHour[]>([]);

  // Address expand modal (single row)
  const [editingAddressRowId, setEditingAddressRowId] = React.useState<string | null>(null);
  const [tempAddress, setTempAddress] = React.useState("");

  // Batch timing editor (apply to all)
  const [showBatchTimingDialog, setShowBatchTimingDialog] = React.useState(false);
  const [batchHours, setBatchHours] = React.useState<DuplicatorOpeningHour[]>([]);

  // Bulk paste text dialog
  const [showBulkPasteDialog, setShowBulkPasteDialog] = React.useState(false);
  const [bulkPasteText, setBulkPasteText] = React.useState("");

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
    (areaName?: string, customAddress?: string): DuplicateDraft => {
      const bName = brandName.trim() || sourceListing?.suggested_brand_name || "Listing";
      const name = areaName ? `${bName} - ${areaName}` : `${bName} - `;
      const address = customAddress || (areaName ? `${areaName}, Karachi` : "");

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

  // Parse bulk paste text
  const handleBulkPasteImport = () => {
    if (!bulkPasteText.trim() || !sourceListing) return;
    const lines = bulkPasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const newRows: DuplicateDraft[] = [];
    const bName = brandName.trim() || sourceListing.suggested_brand_name || sourceListing.name;

    for (const line of lines) {
      let area = "";
      let address = "";

      if (line.includes(":")) {
        const parts = line.split(":");
        area = parts[0].trim();
        address = parts.slice(1).join(":").trim();
      } else if (line.includes(" - ")) {
        const parts = line.split(" - ");
        area = parts[0].trim();
        address = parts.slice(1).join(" - ").trim();
      } else if (line.includes(",")) {
        const parts = line.split(",");
        area = parts[0].trim();
        address = line.trim();
      } else {
        area = line.trim();
        address = `${area}, Karachi`;
      }

      const name = area.toLowerCase().startsWith(bName.toLowerCase())
        ? area
        : `${bName} - ${area}`;

      newRows.push({
        id: crypto.randomUUID(),
        name,
        address: address || `${area}, Karachi`,
        phone_number: sourceListing.phone_number || "",
        status: (sourceListing.status as "published" | "draft") || "published",
        latitude: "",
        longitude: "",
        google_maps_url: "",
        place_id: "",
        opening_hours: sourceListing.opening_hours || [],
        isCustomHours: false,
      });
    }

    if (newRows.length > 0) {
      setDuplicates((prev) => [...prev, ...newRows]);
      setShowBulkPasteDialog(false);
      setBulkPasteText("");
      toast({
        title: "Imported Branches",
        description: `Imported ${newRows.length} branch rows successfully`,
      });
    }
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

  // Open address modal
  const openAddressModal = (row: DuplicateDraft) => {
    setEditingAddressRowId(row.id);
    setTempAddress(row.address);
  };

  // Save address from modal
  const saveRowAddress = () => {
    if (!editingAddressRowId) return;
    updateDraft(editingAddressRowId, {
      address: tempAddress,
    });
    setEditingAddressRowId(null);
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
          description: `Row #${i + 1} is missing a listing name.`,
          variant: "destructive",
        });
        return;
      }
      if (!d.address.trim()) {
        toast({
          title: "Missing Address",
          description: `Row #${i + 1} (${d.name}) needs an address or location.`,
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
    <div className="space-y-6 max-w-7xl mx-auto pb-28">
      {/* Step 1: Search / Lookup Bar */}
      <Card className="border border-border/80 shadow-sm bg-card overflow-visible">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Step 1: Look Up Source Listing
            </CardTitle>
            {sourceListing && (
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Source Selected: #{sourceListing.id}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Search any existing listing. All photos, categories, and attributes will be automatically copied to every duplicate.
          </CardDescription>
        </CardHeader>

        <CardContent className="overflow-visible">
          <div className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center pointer-events-none text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                autoComplete="off"
                placeholder="Search listing by name, address, or ID (e.g. 'Pizza Max', 'SMCHS', 'Xander's')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                className="w-full pl-10 pr-10 h-11 text-sm bg-background border border-border/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
              {isSearching ? (
                <div className="absolute right-3.5 flex items-center text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
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
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-xl max-h-80 overflow-y-auto divide-y divide-border/40">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadSourceListing(item.id)}
                    className="w-full text-left p-3 hover:bg-muted/60 transition-colors flex items-center gap-3"
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {item.name}
                        </span>
                        <Badge
                          variant={item.status === "published" ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {item.status}
                        </Badge>
                        {item.brand_group_name && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 py-0">
                            <Link2 className="h-2.5 w-2.5 mr-0.5" />
                            {item.brand_group_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.address || "No address"}
                        {item.category_name ? ` • ${item.category_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono ml-auto flex-shrink-0">
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
        <div className="p-8 text-center text-muted-foreground bg-card rounded-xl border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-xs font-medium">Fetching listing assets and brand metadata...</p>
        </div>
      )}

      {/* Source Listing Selected Banner */}
      {sourceListing && !isLoadingSource && (
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {sourceListing.images[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sourceListing.images[0].url}
                  alt={sourceListing.name}
                  className="w-14 h-14 rounded-lg object-cover border flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">
                    {sourceListing.name}
                  </h2>
                  <Badge variant="outline" className="font-mono text-xs">
                    #{sourceListing.id}
                  </Badge>
                  <Badge
                    variant={sourceListing.status === "published" ? "default" : "secondary"}
                    className="text-xs capitalize"
                  >
                    {sourceListing.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-foreground/80">
                    <MapPin className="h-3 w-3 text-primary" />
                    {sourceListing.address || "No address"}
                  </span>
                  <span>•</span>
                  <span>{sourceListing.images.length} photo(s) to clone</span>
                  <span>•</span>
                  <span>{sourceListing.categories.map((c) => c.name).join(", ")}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/listing/${sourceListing.slug}`}
                target="_blank"
                className="inline-flex"
              >
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
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
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </Button>
            </div>
          </div>

          {/* Brand Group Input Bar */}
          <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 -mx-4 -mb-4 p-4 rounded-b-xl">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Brand Group Auto-Link:
                </span>
                <p className="text-[11px] text-muted-foreground">
                  All outlets will be linked under this brand name, enabling the branch switcher across web & mobile.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm w-full sm:w-auto">
              <div className="relative flex-1">
                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Brand name, e.g. 'Pizza Max'"
                  className="h-9 text-xs pl-8 font-semibold bg-background border-border/80"
                />
              </div>
              {sourceListing.brand_group && (
                <Badge variant="outline" className="text-[10px] text-primary whitespace-nowrap h-9 px-2">
                  {sourceListing.brand_group.member_count} outlets already
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Duplicates Configuration */}
      {sourceListing && !isLoadingSource && (
        <div className="space-y-4">
          {/* Quick-Add Toolbar */}
          <Card className="border border-border/80 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Copy className="h-4 w-4 text-primary" />
                    Step 2: Add Duplicate Branches
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Quickly add outlets using preset count buttons, area chips, or paste a list of branches.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Preset count buttons */}
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
                    <span className="text-[11px] text-muted-foreground px-1.5 font-medium">
                      Add:
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(1)}
                      className="h-7 px-2 text-xs"
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(5)}
                      className="h-7 px-2 text-xs"
                    >
                      +5
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(10)}
                      className="h-7 px-2 text-xs"
                    >
                      +10
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(20)}
                      className="h-7 px-2 text-xs font-semibold text-primary"
                    >
                      +20
                    </Button>
                  </div>

                  {/* Custom count */}
                  <div className="flex items-center gap-1 bg-background border rounded-lg px-2 h-9">
                    <span className="text-[11px] text-muted-foreground">Qty:</span>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={customAddCount}
                      onChange={(e) => setCustomAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 h-6 text-center text-xs p-0 border-0 focus-visible:ring-0"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addDuplicates(customAddCount)}
                      className="h-6 px-1.5 text-xs font-medium"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Bulk Paste Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkPasteDialog(true)}
                    className="h-9 text-xs gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Paste List
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {/* Area Preset Chips */}
              <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Karachi Commercial Areas (Click any area to add pre-filled branch):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {KARACHI_AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => addByArea(area)}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-background border border-border/80 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors text-foreground font-medium shadow-2xs"
                    >
                      + {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {duplicates.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs px-2 py-0.5 font-medium">
                      {duplicates.length} {duplicates.length === 1 ? "Outlet" : "Outlets"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Edit details inline in the grid below
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchHours(JSON.parse(JSON.stringify(sourceListing.opening_hours)));
                        setShowBatchTimingDialog(true);
                      }}
                      className="h-7 text-xs gap-1"
                    >
                      <Clock className="h-3 w-3 text-primary" />
                      Set All Hours
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetAllHoursToSource}
                      className="h-7 text-xs"
                    >
                      Reset Hours
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllStatus("published")}
                      className="h-7 text-xs"
                    >
                      All Published
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllStatus("draft")}
                      className="h-7 text-xs"
                    >
                      All Draft
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDuplicates([])}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Empty State */}
          {duplicates.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl border-border/60 bg-card">
              <Copy className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="font-semibold text-foreground text-sm">
                No duplicate outlets added yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                Click any of the quick count buttons (+1, +5, +10, +20) or click the area chips above to start adding branches.
              </p>
              <Button size="sm" onClick={() => addDuplicates(1)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add First Outlet
              </Button>
            </div>
          )}

          {/* SPREADSHEET / DATA GRID TABLE VIEW */}
          {duplicates.length > 0 && (
            <Card className="border border-border/80 shadow-sm bg-card overflow-hidden">
              <div className="relative w-full overflow-x-auto">
                <Table className="min-w-[1300px]">
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                      <TableHead className="w-[300px] min-w-[270px] text-xs font-semibold">
                        Header / Listing Name <span className="text-destructive">*</span>
                      </TableHead>
                      <TableHead className="w-[450px] min-w-[380px] text-xs font-semibold">
                        Location / Full Address <span className="text-destructive">*</span>
                      </TableHead>
                      <TableHead className="w-[180px] min-w-[150px] text-xs font-semibold">Branch Phone</TableHead>
                      <TableHead className="w-36 text-xs font-semibold">Operating Hours</TableHead>
                      <TableHead className="w-32 text-xs font-semibold">Status</TableHead>
                      <TableHead className="w-24 text-center text-xs font-semibold">Maps / GPS</TableHead>
                      <TableHead className="w-20 text-center text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((draft, idx) => (
                      <TableRow
                        key={draft.id}
                        className="hover:bg-muted/20 transition-colors border-b last:border-0 align-top"
                      >
                        {/* Index */}
                        <TableCell className="text-center font-mono text-xs text-muted-foreground p-3 pt-4">
                          #{idx + 1}
                        </TableCell>

                        {/* Name Input */}
                        <TableCell className="p-2.5">
                          <Input
                            placeholder="e.g. Pizza Max - Gulshan"
                            value={draft.name}
                            onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                            className={`h-10 text-xs font-semibold w-full ${
                              !draft.name.trim() ? "border-destructive/60 bg-destructive/5" : ""
                            }`}
                          />
                        </TableCell>

                        {/* Location / Full Address (Spacious multi-line textarea with expand dialog) */}
                        <TableCell className="p-2.5">
                          <div className="relative group/addr">
                            <Textarea
                              rows={2}
                              placeholder="Shop / Plot / Street, Block/Phase, Area, Karachi"
                              value={draft.address}
                              onChange={(e) => updateDraft(draft.id, { address: e.target.value })}
                              className={`min-h-[64px] text-xs leading-relaxed resize-y w-full bg-background border-border/80 focus-visible:ring-1 p-2.5 pr-8 font-normal shadow-2xs ${
                                !draft.address.trim() ? "border-destructive/60 bg-destructive/5" : ""
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => openAddressModal(draft)}
                              title="Open large address editor"
                              className="absolute top-2 right-2 p-1 rounded bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground opacity-60 group-hover/addr:opacity-100 transition-opacity border shadow-xs"
                            >
                              <Maximize2 className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>

                        {/* Phone Input */}
                        <TableCell className="p-2.5">
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Phone number"
                              value={draft.phone_number}
                              onChange={(e) =>
                                updateDraft(draft.id, { phone_number: e.target.value })
                              }
                              className="h-10 pl-8 text-xs font-mono w-full"
                            />
                          </div>
                        </TableCell>

                        {/* Operating Hours Button */}
                        <TableCell className="p-2.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openHoursEditor(draft)}
                            className="h-10 text-xs w-full justify-start gap-1.5 px-2.5"
                          >
                            <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="truncate">
                              {draft.isCustomHours ? (
                                <span className="text-primary font-medium">Custom Hours</span>
                              ) : (
                                "Source Hours"
                              )}
                            </span>
                          </Button>
                        </TableCell>

                        {/* Status Select */}
                        <TableCell className="p-2.5">
                          <Select
                            value={draft.status}
                            onValueChange={(val: "published" | "draft") =>
                              updateDraft(draft.id, { status: val })
                            }
                          >
                            <SelectTrigger className="h-10 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="published">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-green-500" />
                                  Published
                                </span>
                              </SelectItem>
                              <SelectItem value="draft">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                                  Draft
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* GPS / Maps Popover */}
                        <TableCell className="p-2.5 text-center">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant={draft.latitude || draft.google_maps_url ? "default" : "outline"}
                                size="sm"
                                className="h-10 px-2 text-xs gap-1"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                                {draft.latitude ? "Set" : "GPS"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3 space-y-2 text-xs" align="end">
                              <div className="font-semibold text-foreground flex items-center gap-1.5 pb-1 border-b">
                                <Navigation className="h-3.5 w-3.5 text-primary" />
                                Location Coordinates & Maps Link
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px]">Latitude</label>
                                  <Input
                                    placeholder="24.9123"
                                    value={draft.latitude}
                                    onChange={(e) => updateDraft(draft.id, { latitude: e.target.value })}
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-muted-foreground text-[10px]">Longitude</label>
                                  <Input
                                    placeholder="67.0987"
                                    value={draft.longitude}
                                    onChange={(e) => updateDraft(draft.id, { longitude: e.target.value })}
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-muted-foreground text-[10px]">Google Maps URL</label>
                                <Input
                                  placeholder="https://maps.google.com/..."
                                  value={draft.google_maps_url}
                                  onChange={(e) =>
                                    updateDraft(draft.id, { google_maps_url: e.target.value })
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => cloneDraft(draft)}
                              title="Clone row"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDraft(draft.id)}
                              title="Delete row"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Add row bottom bar */}
              <div className="p-3 bg-muted/20 border-t flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addDuplicates(1)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Row
                </Button>
                <span className="text-xs text-muted-foreground font-mono">
                  Total: {duplicates.length} rows
                </span>
              </div>
            </Card>
          )}

          {/* Sticky Bottom Action Bar */}
          {duplicates.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl py-3 px-6">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-xs px-2.5 py-1 font-semibold">
                    {duplicates.length} {duplicates.length === 1 ? "Outlet" : "Outlets"}
                  </Badge>
                  <span className="text-xs text-foreground font-medium">
                    Duplicating &ldquo;{sourceListing.name}&rdquo; into brand &ldquo;{brandName}&rdquo;
                  </span>
                </div>

                <Button
                  size="default"
                  disabled={isDuplicating}
                  onClick={handleExecuteDuplication}
                  className="font-semibold text-sm px-6 h-10 shadow-md gap-2"
                >
                  {isDuplicating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Creating {duplicates.length} Outlets...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Duplicate & Create {duplicates.length} Listings
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Report Card */}
      {duplicationResult && (
        <Card className="border-green-500/40 bg-gradient-to-br from-card to-green-500/5 shadow-xl mt-6">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-xl text-green-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">
                  Duplication Complete!
                </CardTitle>
                <CardDescription className="text-xs">
                  Created {duplicationResult.created_listings.length} listings linked under Brand Group &ldquo;
                  {duplicationResult.brand_group.name}&rdquo;.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <Alert className="bg-green-500/10 border-green-500/30 text-foreground py-2 text-xs">
              <Check className="h-4 w-4 text-green-500" />
              <AlertTitle className="font-semibold text-xs">Auto-Linked Successfully</AlertTitle>
              <AlertDescription className="text-[11px] text-muted-foreground">
                All outlets can now switch between each other on both web and mobile detail pages.
              </AlertDescription>
            </Alert>

            {/* List of Created Items */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto divide-y divide-border/40 border rounded-lg bg-background/50">
              {duplicationResult.created_listings.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {item.name}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        #{item.id}
                      </Badge>
                      <Badge
                        variant={item.status === "published" ? "default" : "secondary"}
                        className="text-[10px] py-0"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.address || "No address"}
                    </p>
                  </div>

                  <Link
                    href={`/listing/${item.slug}`}
                    target="_blank"
                    className="inline-flex"
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" /> View Live
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link href="/admin/brand-groups">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Link2 className="h-3.5 w-3.5" /> Go to Brand Groups
                </Button>
              </Link>
              <Link href="/admin/listings">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Store className="h-3.5 w-3.5" /> Go to Listings
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => {
                  setDuplicationResult(null);
                  setDuplicates([]);
                }}
                className="gap-1.5 ml-auto text-xs"
              >
                Duplicate Another Listing <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dedicated Large Address Editor Dialog */}
      <Dialog
        open={Boolean(editingAddressRowId)}
        onOpenChange={(open) => {
          if (!open) setEditingAddressRowId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Edit Full Branch Address
            </DialogTitle>
            <DialogDescription className="text-xs">
              View and edit the complete location details for this branch outlet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Textarea
              rows={4}
              placeholder="Shop #, Plot/Street, Block/Phase, Area, Landmark directions, Karachi"
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              className="text-xs leading-relaxed p-3"
            />

            {/* Quick append chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-muted-foreground font-medium">Quick append:</span>
              <button
                type="button"
                onClick={() => setTempAddress((prev) => (prev.endsWith(", Karachi") ? prev : `${prev}, Karachi`))}
                className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border"
              >
                + , Karachi
              </button>
              <button
                type="button"
                onClick={() => setTempAddress((prev) => `${prev} Shop # `)}
                className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border"
              >
                + Shop #
              </button>
              <button
                type="button"
                onClick={() => setTempAddress((prev) => `${prev} Block `)}
                className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border"
              >
                + Block
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingAddressRowId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveRowAddress}>
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row Timing Editor Dialog */}
      <Dialog
        open={Boolean(editingHoursRowId)}
        onOpenChange={(open) => {
          if (!open) setEditingHoursRowId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Customize Branch Operating Hours
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set hours for Monday through Sunday.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
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
                    className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-foreground w-20">
                      {label}
                    </span>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <label className="flex items-center gap-1 cursor-pointer mr-2">
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
                        <span className="text-muted-foreground text-[11px]">Closed</span>
                      </label>

                      {!hourItem.isClosed ? (
                        <div className="flex items-center gap-1">
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
                            className="w-24 h-7 text-xs font-mono p-1"
                          />
                          <span className="text-muted-foreground text-[10px]">to</span>
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
                            className="w-24 h-7 text-xs font-mono p-1"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic w-52 text-center text-[11px]">
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
                Copy Mon to All Days
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
                className="text-xs h-7 text-muted-foreground ml-auto"
              >
                Reset to Source
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingHoursRowId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveRowHours}>Apply Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Timing Editor Dialog (Apply to All) */}
      <Dialog open={showBatchTimingDialog} onOpenChange={setShowBatchTimingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Set Operating Hours for All {duplicates.length} Duplicates
            </DialogTitle>
            <DialogDescription className="text-xs">
              This schedule will apply to all duplicate branches at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
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
                    className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-foreground w-20">
                      {label}
                    </span>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <label className="flex items-center gap-1 cursor-pointer mr-2">
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
                        <span className="text-muted-foreground text-[11px]">Closed</span>
                      </label>

                      {!hourItem.isClosed ? (
                        <div className="flex items-center gap-1">
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
                            className="w-24 h-7 text-xs font-mono p-1"
                          />
                          <span className="text-muted-foreground text-[10px]">to</span>
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
                            className="w-24 h-7 text-xs font-mono p-1"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic w-52 text-center text-[11px]">
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
                Copy Mon to All Days
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowBatchTimingDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyBatchHoursToAll}>
              Apply to All {duplicates.length} Outlets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Paste Dialog */}
      <Dialog open={showBulkPasteDialog} onOpenChange={setShowBulkPasteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Paste List of Branches
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste one branch per line. You can paste area names or &ldquo;Area: Full Address&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              rows={8}
              placeholder={`Example:
Clifton: Shop 4, Marine Drive, Block 4, Clifton
Gulshan: Block 7, Main University Road
DHA Phase 6: Khayaban-e-Shahbaz
SMCHS: Main Shahrah-e-Faisal
North Nazimabad: Block H, Hydri`}
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              className="text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Each line creates a duplicate row automatically prefixed with &ldquo;{brandName || sourceListing?.name}&rdquo;.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowBulkPasteDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleBulkPasteImport}>
              Generate Outlets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
