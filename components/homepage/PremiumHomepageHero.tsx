"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { HeroSectionStatic } from "@/components/ui/HeroSectionStatic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistance, useSearch } from "@/hooks/useSearch";
import {
  Search,
  MapPin,
  Calendar,
  ArrowRight,
  ChevronDown,
  LocateFixed,
  CreditCard,
  Ticket,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  HOMEPAGE_AREAS,
  areaBrowseHref,
  type HomepageArea,
} from "@/lib/homepage/areas";

const quickLinks = [
  { label: "Places", href: "/listings", icon: MapPin },
  { label: "Bank discounts", href: "/listings?deals=true", icon: CreditCard },
  { label: "Events", href: "/events", icon: Ticket },
];

type LocationPin = {
  label: string;
  lat: number;
  lng: number;
  /** Named area (for browse deep-link); null for Near me */
  area: string | null;
};

export function PremiumHomepageHero() {
  const [isLocating, setIsLocating] = useState(false);
  const [locationPin, setLocationPin] = useState<LocationPin | null>(null);
  const router = useRouter();

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    showResults,
    setShowResults,
    getResultUrl,
  } = useSearch({
    lat: locationPin?.lat ?? null,
    lng: locationPin?.lng ?? null,
  });

  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation || isLocating) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);
        setLocationPin({
          label: "Near me",
          lat: latitude,
          lng: longitude,
          area: null,
        });
      },
      () => {
        setIsLocating(false);
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
        maximumAge: 300000,
      },
    );
  }, [isLocating]);

  const handleSelectArea = useCallback((area: HomepageArea) => {
    setLocationPin({
      label: area.label,
      lat: area.center.lat,
      lng: area.center.lng,
      area: area.label,
    });
  }, []);

  const clearLocationPin = useCallback(() => {
    setLocationPin(null);
  }, []);

  // Close dropdown on click/touch outside
  useEffect(() => {
    if (!showResults) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showResults, setShowResults]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleExplore = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) {
      const params = new URLSearchParams({ q: trimmed });
      if (locationPin) {
        params.set("lat", locationPin.lat.toFixed(6));
        params.set("lng", locationPin.lng.toFixed(6));
        if (locationPin.area) params.set("area", locationPin.area);
      }
      router.push(`/search?${params.toString()}`);
      return;
    }

    router.push(
      areaBrowseHref({
        area: locationPin?.area ?? null,
        lat: locationPin?.lat ?? null,
        lng: locationPin?.lng ?? null,
      }),
    );
  };

  return (
    <HeroSectionStatic
      className="bg-cream pb-8 sm:pb-10 lg:pb-10"
      floating={
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src="/assets/hero/karachi-streets.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover brightness-0 opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-cream/0 via-cream/60 to-cream" />
        </div>
      }
    >
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <div className="mb-4 flex justify-center animate-hero-fade-in">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Your guide to Karachi
          </span>
        </div>

        <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 animate-hero-fade-in-delay-1">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Your next plan starts <span className="text-primary">Inside</span>.
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Discover places, discounts, and events across Karachi.
          </p>
        </div>

        <div className="max-w-2xl mx-auto animate-hero-fade-in-delay-2">
          <div className="relative z-30 group" ref={searchContainerRef}>
            <div className="relative flex flex-col sm:flex-row bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Try a café, salon or restaurant"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setShowResults(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleExplore();
                    }
                  }}
                  className="h-12 sm:h-14 md:h-16 pl-11 sm:pl-12 md:pl-14 pr-4 sm:pr-6 text-base md:text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center px-4 sm:px-6 border-t sm:border-t-0 sm:border-l border-border/30 min-h-[48px] sm:min-h-[56px] md:min-h-[64px] hover:bg-muted/30 transition-colors"
                  >
                    <MapPin
                      className={`h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0 ${
                        locationPin ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {isLocating && (
                      <span className="mr-2 h-3 w-3 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                    )}
                    <span
                      className={`text-xs sm:text-sm font-medium truncate ${
                        locationPin
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {locationPin?.label ?? "Choose an area"}
                    </span>
                    <ChevronDown
                      className="ml-auto sm:ml-2 h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                  <DropdownMenuItem
                    onSelect={handleNearMe}
                    className="rounded-lg py-2 font-medium"
                  >
                    <LocateFixed className="text-primary" />
                    Near me
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {HOMEPAGE_AREAS.map((area) => (
                    <DropdownMenuItem
                      key={area.label}
                      className="rounded-lg py-2"
                      onSelect={() => handleSelectArea(area)}
                    >
                      {area.label}
                    </DropdownMenuItem>
                  ))}
                  {locationPin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={clearLocationPin}
                        className="rounded-lg py-2 text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                        Clear area
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="sm:flex-shrink-0">
                <Button
                  size="lg"
                  className="h-12 sm:h-14 md:h-16 w-full sm:w-auto px-4 sm:px-6 md:px-8 bg-primary hover:bg-primary/90 active:opacity-80 text-primary-foreground font-semibold rounded-none group"
                  onClick={handleExplore}
                  aria-label={
                    searchQuery && searchQuery.trim().length > 0
                      ? `Explore results for ${searchQuery}`
                      : "Explore all listings"
                  }
                >
                  <span className="mr-2">Explore</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </div>
            </div>

            {/* Results Dropdown anchored directly below the search bar */}
            <AnimatePresence>
              {showResults && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden text-left"
                >
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="inline-flex items-center space-x-2">
                        <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                        <span>Searching...</span>
                      </div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto">
                      {searchResults.map((result) => {
                        const distance = formatDistance(
                          result.distance_meters,
                        );
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchQuery(result.name);
                              setShowResults(false);
                              try {
                                window.dispatchEvent(
                                  new Event("insidekhi:closeDiscovery"),
                                );
                              } catch {
                                /* ignore */
                              }
                              try {
                                router.push(getResultUrl(result));
                              } catch {
                                window.location.href = getResultUrl(result);
                              }
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors duration-200 border-b border-border/20 last:border-b-0 cursor-pointer"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {result.type === "listing" && (
                                  <MapPin className="h-4 w-4 text-primary" />
                                )}
                                {result.type === "category" && (
                                  <Search className="h-4 w-4 text-primary" />
                                )}
                                {result.type === "event" && (
                                  <Calendar className="h-4 w-4 text-primary" />
                                )}
                                {result.type === "post" && (
                                  <Search className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-foreground truncate">
                                    {result.name}
                                  </div>
                                  {result.avg_rating != null &&
                                    result.avg_rating > 0 && (
                                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        {result.avg_rating.toFixed(1)}
                                      </span>
                                    )}
                                  {distance && (
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                      {distance}
                                    </span>
                                  )}
                                </div>
                                {result.category && (
                                  <div className="text-xs text-muted-foreground">
                                    {result.category}
                                  </div>
                                )}
                                {result.address && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {result.address}
                                  </div>
                                )}
                                {result.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {result.description}
                                  </div>
                                )}
                              </div>
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="text-sm">
                        No results found for &ldquo;{searchQuery}&rdquo;
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <nav
            aria-label="Start browsing"
            className="-mx-6 mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:mx-0 sm:gap-2"
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium sm:gap-1.5 sm:px-4 sm:text-sm text-foreground transition-colors hover:border-primary hover:text-primary active:opacity-80"
              >
                <link.icon
                  className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4"
                  aria-hidden
                />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </HeroSectionStatic>
  );
}
