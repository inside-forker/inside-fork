"use client";

import { useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, MapPin, Search, TrendingUp } from "lucide-react";
import { Container } from "@/components/ds";
import { useSearch } from "@/hooks/useSearch";
import { cn } from "@/lib/utils";

/** The app's popular searches (RN `POPULAR_SEARCH_TERMS`); phones show the first three as chips. */
const TRENDING = ["Kolachi", "Café Flo", "Xander's", "Concerts", "Gyms"];

/**
 * Landing hero: the headline, the line under it, one search box with live
 * suggestions, and a Trending line. Left-aligned on phones, centred from lg.
 * Phones drop the eyebrow and show Trending as chips, so the category icons
 * below come into the first screen.
 */
export function LandingHero() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { searchQuery, setSearchQuery, searchResults, isSearching, showResults, setShowResults, getResultUrl } =
    useSearch({ lat: null, lng: null });

  useEffect(() => {
    if (!showResults) return;
    const close = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showResults, setShowResults]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setShowResults(false);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/listings");
  };

  return (
    <section className="pb-6 pt-6 lg:pb-14 lg:pt-[88px]">
      <Container className="flex flex-col items-start lg:items-center lg:text-center">
        <p className="hidden text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground lg:block">
          Karachi&rsquo;s city guide
        </p>
        <h1 className="text-[46px] font-bold leading-none tracking-[-0.05em] lg:mt-5 lg:max-w-[1000px] lg:text-8xl lg:leading-[0.98]">
          Find your kind of Karachi.
        </h1>
        <p className="mt-3 text-body text-muted-foreground lg:mt-5 lg:text-body-lg">
          Discover places, discounts, and events across Karachi.
        </p>

        <form ref={formRef} role="search" onSubmit={submit} className="relative mt-5 w-full lg:mt-10 lg:max-w-[680px]">
          <div className="flex h-14 items-center gap-2.5 rounded-full border border-border bg-background pl-[18px] pr-1.5 transition-colors duration-fast focus-within:border-foreground lg:h-[68px] lg:gap-3 lg:pl-[26px] lg:pr-[9px]">
            <Search className="hidden h-[22px] w-[22px] shrink-0 lg:block" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowResults(true)}
              aria-label="Search places, discounts and events"
              placeholder="Biryani, padel courts, salons…"
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground lg:text-[17px]"
            />
            <button
              type="submit"
              aria-label="Search"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity duration-fast hover:opacity-90 lg:flex lg:h-[50px] lg:w-auto lg:px-[26px] lg:text-body lg:font-semibold"
            >
              <Search className="h-5 w-5 lg:hidden" aria-hidden="true" />
              <span className="hidden lg:inline">Search</span>
            </button>
          </div>

          {showResults && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-media border border-border bg-background text-left shadow-overlay">
              {isSearching ? (
                <p className="p-4 text-center text-small text-muted-foreground">Searching…</p>
              ) : searchResults.length > 0 ? (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {searchResults.map((result) => (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearchQuery(result.name);
                          setShowResults(false);
                          router.push(getResultUrl(result));
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-fast hover:bg-muted"
                      >
                        {result.type === "event" ? (
                          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : result.type === "listing" ? (
                          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-small font-semibold">{result.name}</span>
                          {(result.category || result.address) && (
                            <span className="block truncate text-data text-muted-foreground">
                              {[result.category, result.address].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-center text-small text-muted-foreground">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </div>
          )}
        </form>

        <p className="mt-3 flex flex-wrap items-center gap-2 text-small lg:mt-[18px] lg:justify-center lg:gap-x-3.5 lg:gap-y-1 lg:text-[15px]">
          <TrendingUp className="h-5 w-5 shrink-0 text-muted-foreground lg:hidden" aria-hidden="true" />
          <span className="sr-only font-bold lg:not-sr-only">Trending</span>
          {TRENDING.map((term, i) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className={cn(
                "inline-flex h-11 items-center rounded-full bg-muted px-4 font-medium transition-colors duration-fast hover:bg-border",
                "lg:inline lg:h-auto lg:rounded-none lg:bg-transparent lg:px-0 lg:font-normal lg:underline lg:decoration-border lg:underline-offset-[3px] lg:hover:bg-transparent lg:hover:decoration-foreground",
                i >= 3 && "hidden",
              )}
            >
              {term}
            </Link>
          ))}
        </p>
      </Container>
    </section>
  );
}
