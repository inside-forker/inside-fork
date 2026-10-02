"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
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
import { useSearch } from "@/hooks/useSearch";
import {
  Search,
  MapPin,
  Calendar,
  ArrowRight,
  ChevronDown,
  LocateFixed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { HOMEPAGE_AREAS, areaHref } from "@/lib/homepage/areas";

const quickLinks = [
  { label: "Places", href: "/listings" },
  { label: "Bank discounts", href: "/listings?deals=true" },
];

export function PremiumHomepageHero() {
  const [isLocating, setIsLocating] = useState(false);
  const router = useRouter();

  // Ref for search container to calculate dropdown position
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Use the production-ready search hook
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    showResults,
    setShowResults,
    getResultUrl,
  } = useSearch();

  // "Near me": ask for location only when chosen, then list places by distance
  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation || isLocating) {
      router.push("/listings");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);
        router.push(
          `/listings?sort=distance&lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`,
        );
      },
      () => {
        setIsLocating(false);
        router.push("/listings");
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
        maximumAge: 300000,
      },
    );
  }, [isLocating, router]);

  // Lock body scroll and update dropdown position when showing results
  useEffect(() => {
    if (!showResults) return;

    // Lock body scroll
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Update dropdown position (using viewport coordinates for fixed positioning)
    if (searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [showResults]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handler for Explore button
  const handleExplore = () => {
    if (searchQuery && searchQuery.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/listings");
    }
  };

  return (
    // Brand cream hero; Karachi's streets sit behind it as a faint ink shade
    <HeroSectionStatic
      className="bg-cream pb-8 sm:pb-10 lg:pb-10"
      floating={
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* The map's lines are cream on transparent; brightness-0 turns them
              dark so they show on white, and the low opacity keeps them a shade */}
          <Image
            src="/assets/hero/karachi-streets.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover brightness-0 opacity-[0.14]"
          />
          {/* Cream overlay: clear at the top, solid at the bottom, so the map
              is strongest up top and fades out into the page */}
          <div className="absolute inset-0 bg-gradient-to-b from-cream/0 via-cream/60 to-cream" />
        </div>
      }
    >
      {/* Main Content - CSS animations for entrance */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 text-center">
        {/* Eyebrow */}
        {/* Flex so the small label doesn't sit in a taller line box (keeps
            the space above the hero content equal to the space below) */}
        <div className="mb-4 flex justify-center animate-hero-fade-in">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Your guide to Karachi
          </span>
        </div>

        {/* Hero Heading */}
        <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 animate-hero-fade-in-delay-1">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Your next plan starts <span className="text-primary">Inside</span>.
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Discover places and unlock bank discounts across Karachi.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto animate-hero-fade-in-delay-2">
          <div className="relative group" ref={searchContainerRef}>
            {/* Search Container */}
            <div className="relative flex flex-col sm:flex-row bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Try a café, salon or restaurant"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() =>
                    searchQuery.length >= 2 && setShowResults(true)
                  }
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  className="h-12 sm:h-14 md:h-16 pl-11 sm:pl-12 md:pl-14 pr-4 sm:pr-6 text-sm sm:text-base md:text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                />
              </div>

              {/* Area picker: a menu of area links, not a filter on the typed search */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center px-4 sm:px-6 border-t sm:border-t-0 sm:border-l border-border/30 min-h-[48px] sm:min-h-[56px] md:min-h-[64px] hover:bg-muted/30 transition-colors"
                  >
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mr-2 sm:mr-3 flex-shrink-0" />
                    {isLocating && (
                      <span className="mr-2 h-3 w-3 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                      Choose an area
                    </span>
                    <ChevronDown className="ml-auto sm:ml-2 h-4 w-4 text-muted-foreground" aria-hidden />
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
                    <DropdownMenuItem key={area} asChild className="rounded-lg py-2">
                      <Link href={areaHref(area)}>{area}</Link>
                    </DropdownMenuItem>
                  ))}
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
          </div>

          {/* Starting points for visitors without a name in mind */}
          <nav
            aria-label="Start browsing"
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary active:opacity-80"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search Results Dropdown - Portal to escape parent transform stacking context */}
        {typeof document !== "undefined" &&
          ReactDOM.createPortal(
            <AnimatePresence>
              {showResults && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[9999] bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                  }}
                >
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <div className="inline-flex items-center space-x-2">
                        <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                        <span>Searching...</span>
                      </div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
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
                          className="w-full px-4 py-3 text-left hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors duration-200 border-b border-border/20 last:border-b-0"
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
                              <div className="text-sm font-medium text-foreground">
                                {result.name}
                              </div>
                              {result.category && (
                                <div className="text-xs text-muted-foreground">
                                  {result.category}
                                </div>
                              )}
                              {result.address && (
                                <div className="text-xs text-muted-foreground">
                                  {result.address}
                                </div>
                              )}
                              {result.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {result.description}
                                </div>
                              )}
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
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
            </AnimatePresence>,
            document.body,
          )}

      </div>
    </HeroSectionStatic>
  );
}
