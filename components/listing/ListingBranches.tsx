// Multi-branch selector. Rendering adapts to count: <=6 cards, 7-12 cards + modal, 13+ map-first.
// Only renders when branches.length > 1.

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Phone,
  Navigation,
  Building2,
  MapPinned,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumHeading } from "@/components/brand/Typography";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Database } from "@/types/database";
import { useBranchSelection } from "@/lib/context/BranchSelectionContext";

// Use the actual database types
type ListingBranch = Database["public"]["Tables"]["listing_branches"]["Row"];

// Extended type with calculated distance
type BranchWithDistance = ListingBranch & { distance: number | null };

interface ListingBranchesProps {
  branches: ListingBranch[];
  listingName: string;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ListingBranches({
  branches,
  listingName,
}: ListingBranchesProps) {
  const { selectedBranchId, setSelectedBranchId } = useBranchSelection();
  const [localSelectedBranchId, setLocalSelectedBranchId] = useState<number>(
    branches.find((b) => b.is_primary)?.id || branches[0]?.id || 0,
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(6); // Pagination: show 6 initially
  const [geoPermission, setGeoPermission] = useState<PermissionState | null>(
    null,
  );

  // Sync local state with context on mount and when branches change
  useEffect(() => {
    const initialId =
      branches.find((b) => b.is_primary)?.id || branches[0]?.id || 0;
    setLocalSelectedBranchId(initialId);
    setSelectedBranchId(initialId);
  }, [branches, setSelectedBranchId]);

  // Update context when local selection changes
  const handleBranchSelect = (branchId: number) => {
    setLocalSelectedBranchId(branchId);
    setSelectedBranchId(branchId);
  };

  // Shared location request used on mount and after permission changes.
  const requestUserLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Silently fail if user denies location
          setUserLocation(null);
        },
        { timeout: 5000, maximumAge: 300000 }, // Cache for 5 mins
      );
    }
  }, []);

  // Request user location for distance calculation on first render.
  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // Listen for geolocation permission changes (when supported) and fetch immediately once granted.
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let permissionStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (!permissionStatus) return;
      setGeoPermission(permissionStatus.state);
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        setGeoPermission(status.state);
        status.addEventListener("change", handlePermissionChange);
      })
      .catch(() => {
        setGeoPermission(null);
      });

    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener("change", handlePermissionChange);
      }
    };
  }, []);

  // If user grants permission after initial render, fetch location immediately.
  useEffect(() => {
    if (geoPermission === "granted" && !userLocation) {
      requestUserLocation();
    }
  }, [geoPermission, userLocation, requestUserLocation]);

  // Calculate distances for all branches (MUST be before early return)
  const branchesWithDistance: BranchWithDistance[] = useMemo(() => {
    return branches.map((branch) => {
      let distance: number | null = null;
      if (
        userLocation &&
        branch.latitude &&
        branch.longitude &&
        typeof branch.latitude === "number" &&
        typeof branch.longitude === "number"
      ) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          branch.latitude,
          branch.longitude,
        );
      }
      return { ...branch, distance };
    });
  }, [branches, userLocation]);

  // Sort by distance if available, otherwise primary first (MUST be before early return)
  const sortedBranches = useMemo(() => {
    return [...branchesWithDistance].sort((a, b) => {
      // Primary branch always first
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      // Then by distance if available
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      return 0;
    });
  }, [branchesWithDistance]);

  // Get unique cities for filter (MUST be before early return)
  const uniqueCities = useMemo(() => {
    const cities = new Set(
      branches.map((b) => b.city).filter((city): city is string => !!city),
    );
    return Array.from(cities).sort();
  }, [branches]);

  // Filter branches by search and city (MUST be before early return)
  const filteredBranches = useMemo(() => {
    return sortedBranches.filter((branch) => {
      // City filter
      if (cityFilter !== "all" && branch.city !== cityFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = branch.name?.toLowerCase().includes(query);
        const matchAddress = branch.address.toLowerCase().includes(query);
        const matchCity = branch.city?.toLowerCase().includes(query);
        return matchName || matchAddress || matchCity;
      }

      return true;
    });
  }, [sortedBranches, cityFilter, searchQuery]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(6); // Reset to first page
  }, [searchQuery, cityFilter]);

  // Only show for MULTIPLE branches (NOW after all hooks)
  if (!branches || branches.length <= 1) {
    return null;
  }

  const selectedBranch = branchesWithDistance.find(
    (b) => b.id === localSelectedBranchId,
  );

  if (!selectedBranch) {
    return null;
  }

  // Adaptive rendering constants
  const ITEMS_PER_PAGE = 6; // Show 6 branches per page
  const MANY_BRANCHES_THRESHOLD = 20; // Only show search/filter for 20+ branches

  // Determine display mode
  const totalBranches = branches.length;
  const isManyBranches = totalBranches >= MANY_BRANCHES_THRESHOLD;
  const hasMoreThanSix = filteredBranches.length > ITEMS_PER_PAGE;

  // Pagination: show limited results
  const displayBranches = filteredBranches.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBranches.length;
  const canShowLess =
    visibleCount > ITEMS_PER_PAGE && filteredBranches.length > ITEMS_PER_PAGE;

  // Handlers
  const handleShowMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + ITEMS_PER_PAGE, filteredBranches.length),
    );
  };

  const handleShowLess = () => {
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const getDirectionsUrl = (branch: ListingBranch) => {
    if (branch.latitude && branch.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
    }
    // Fallback to address search
    const addressParts = [branch.address, branch.city, branch.country].filter(
      Boolean,
    );
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      addressParts.join(", "),
    )}`;
  };

  // Build embed URL without API key (same as ListingMap.tsx)
  const embedUrl =
    selectedBranch.latitude && selectedBranch.longitude
      ? `https://www.google.com/maps?q=loc:${selectedBranch.latitude},${selectedBranch.longitude}&z=16&output=embed`
      : selectedBranch.address
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            selectedBranch.address,
          )}&z=16&output=embed`
        : null;

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
    >
      {/* Header - Simple & Clear */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              <span className="gradient-text-primary">Our</span> Locations
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              {userLocation
                ? "Sorted by distance from you"
                : totalBranches === 2
                  ? "We have 2 locations"
                  : `We have ${totalBranches} locations across Karachi`}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="px-4 py-2 font-semibold border-2 bg-primary/5"
        >
          {totalBranches} {totalBranches === 1 ? "Location" : "Locations"}
        </Badge>
      </div>

      {/* Search & Filter Bar - ONLY for 20+ branches */}
      {isManyBranches && (
        <Card className="p-4 border-2 bg-gradient-to-br from-primary/5 via-transparent to-background">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, area, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 border-2"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {uniqueCities.length > 1 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 border-2">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {uniqueCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {(searchQuery || cityFilter !== "all") && (
            <p className="text-sm text-muted-foreground mt-3">
              Showing {filteredBranches.length} of {totalBranches} locations
            </p>
          )}
        </Card>
      )}

      {/* Simple List of All Locations - ALWAYS VISIBLE, NO HIDDEN CARDS */}
      <motion.div className="hidden md:grid md:grid-cols-1 gap-3">
        {displayBranches.map((branch) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <Card
              className={`group cursor-pointer transition-all duration-200 border-2 ${
                localSelectedBranchId === branch.id
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-primary/30 hover:shadow-sm"
              }`}
              onClick={() => handleBranchSelect(branch.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleBranchSelect(branch.id);
                }
              }}
              aria-pressed={localSelectedBranchId === branch.id}
              aria-label={`Select ${branch.name || branch.city} location`}
            >
              <div className="p-4 flex items-center gap-4">
                {/* Branch Badge/Indicator */}
                <div className="flex-shrink-0">
                  {branch.is_primary ? (
                    <Badge className="bg-primary text-primary-foreground px-2 py-1 text-xs">
                      Main
                    </Badge>
                  ) : localSelectedBranchId === branch.id ? (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                {/* Branch Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {branch.name || branch.city || "Branch Location"}
                    </h3>
                    {branch.distance !== null && (
                      <span className="text-xs text-primary font-semibold flex-shrink-0">
                        {branch.distance < 1
                          ? `${Math.round(branch.distance * 1000)}m away`
                          : `${branch.distance.toFixed(1)}km away`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {branch.address}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {branch.phone_number && (
                    <Link
                      href={`tel:${branch.phone_number}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                    </Link>
                  )}
                  <Link
                    href={getDirectionsUrl(branch)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      Directions
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Pagination Controls (Desktop) */}
      {hasMoreThanSix && (
        <div className="hidden md:flex justify-center gap-3 pt-2">
          {hasMore && (
            <Button
              onClick={handleShowMore}
              variant="outline"
              size="sm"
              className="h-9 px-6 border-2 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all"
            >
              Show More ({filteredBranches.length - visibleCount} remaining)
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          )}
          {canShowLess && (
            <Button
              onClick={handleShowLess}
              variant="ghost"
              size="sm"
              className="h-9 px-4 hover:bg-muted transition-all"
            >
              <ChevronUp className="h-4 w-4 mr-2" />
              Show Less
            </Button>
          )}
        </div>
      )}

      {/* MOBILE: Compact Dropdown Selector - Optimized */}
      <Card className="md:hidden p-3 border-2 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm shadow-sm">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 px-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Select Location
        </label>
        <Select
          value={localSelectedBranchId.toString()}
          onValueChange={(val) => handleBranchSelect(parseInt(val))}
        >
          <SelectTrigger className="w-full h-auto min-h-[3rem] py-2 px-3 text-sm font-medium border border-input bg-background/50 hover:bg-background/80 hover:border-primary/50 transition-all rounded-xl shadow-sm">
            <div className="flex flex-col items-start gap-0.5 text-left w-full pr-2 overflow-hidden">
              <span className="truncate w-full font-semibold text-foreground">
                {selectedBranch.name || selectedBranch.city || "Select Branch"}
              </span>
              <span className="text-xs text-muted-foreground truncate w-full">
                {selectedBranch.address}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {sortedBranches.map((branch) => (
              <SelectItem
                key={branch.id}
                value={branch.id.toString()}
                className="py-3 border-b border-border/40 last:border-0"
              >
                <div className="flex flex-col gap-1 w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {branch.name ||
                        branch.city ||
                        `Branch ${branches.indexOf(branch) + 1}`}
                    </span>
                    {branch.is_primary && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20"
                      >
                        Main
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {branch.address}
                    </span>
                    {branch.distance !== null && (
                      <span className="text-[10px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        {branch.distance < 1
                          ? `${Math.round(branch.distance * 1000)}m`
                          : `${branch.distance.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Selected Branch Details + Map */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedBranchId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden border-2 relative bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-md">
            {/* Background overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50 pointer-events-none" />

            {/* Compact Branch Info Header - Mobile Optimized */}
            <div className="relative p-3 md:p-5 bg-gradient-to-r from-primary/5 to-transparent border-b backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-foreground leading-tight">
                        {selectedBranch.name ||
                          selectedBranch.city ||
                          `${listingName} Branch`}
                      </h3>
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mt-0.5 min-w-0">
                        <p
                          className="text-xs text-muted-foreground truncate max-w-[250px] sm:max-w-none"
                          title={selectedBranch.address}
                        >
                          {selectedBranch.address}
                        </p>

                        {/* Desktop: Distance inline with address */}
                        {selectedBranch.distance !== null && (
                          <div className="hidden md:flex items-center gap-1.5 text-primary flex-shrink-0">
                            <span className="hidden md:inline w-1 h-1 rounded-full bg-primary/40" />
                            <Navigation className="h-3 w-3 text-primary" />
                            <span className="text-xs font-semibold whitespace-nowrap">
                              {selectedBranch.distance < 1
                                ? `${Math.round(selectedBranch.distance * 1000)}m`
                                : `${selectedBranch.distance.toFixed(1)}km`}{" "}
                              from you
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedBranch.is_primary && (
                      <Badge className="bg-primary text-[10px] h-5 px-1.5 flex-shrink-0">
                        Main
                      </Badge>
                    )}
                  </div>

                  {/* Mobile: Distance below address */}
                  {selectedBranch.distance !== null && (
                    <div className="flex md:hidden items-center gap-1.5 text-primary">
                      <Navigation className="h-3 w-3 text-primary" />
                      <span className="text-xs font-semibold">
                        {selectedBranch.distance < 1
                          ? `${Math.round(selectedBranch.distance * 1000)}m from you`
                          : `${selectedBranch.distance.toFixed(1)}km from you`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex md:hidden items-center gap-2 pt-1">
                  {selectedBranch.phone_number && (
                    <Link
                      href={`tel:${selectedBranch.phone_number}`}
                      className="flex-1"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs font-semibold bg-background/50 border-primary/20 hover:bg-primary/5 hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5 mr-1.5" />
                        Call
                      </Button>
                    </Link>
                  )}
                  <Link
                    href={getDirectionsUrl(selectedBranch)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs font-semibold shadow-sm bg-primary hover:bg-primary/90"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1.5" />
                      Directions
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Map Section */}
            <div className="relative h-72 md:h-80 lg:h-96 bg-gradient-to-br from-primary/5 via-muted/30 to-primary/10">
              {embedUrl ? (
                <>
                  <iframe
                    src={embedUrl ?? undefined}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    title={`Map showing ${selectedBranch.name || listingName}`}
                    className="absolute inset-0"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                  {/* Map Badge - Compact on Mobile, Full on Desktop */}
                  <div className="absolute bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-auto max-w-xs bg-background/95 backdrop-blur-md border border-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 shadow-lg">
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary flex-shrink-0" />
                      <p className="text-xs md:text-sm font-medium text-foreground truncate flex-1">
                        {selectedBranch.name || listingName}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center p-8">
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20 shadow-lg">
                      <MapPin className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2 text-foreground">
                        {selectedBranch.name || listingName}
                      </h3>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                        {selectedBranch.address}
                      </p>
                      <Link
                        href={getDirectionsUrl(selectedBranch)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button className="bg-gradient-to-r from-primary to-primary/80 shadow-lg">
                          <Navigation className="h-4 w-4 mr-2" />
                          View on Google Maps
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
