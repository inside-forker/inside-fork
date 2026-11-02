"use client";

/**
 * City Context
 * Provides a city switcher that persists via a cookie + URL param.
 * Phase 1: Karachi is always the active default.
 * Phase 2: City selection will be added to the landing page header.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface City {
  id?: number;
  slug: string;
  name: string;
  short_code: string;
  center_lat?: number;
  center_lng?: number;
  is_active: boolean;
}

// Seed cities for immediate client use (fetched server-side in production)
export const KNOWN_CITIES: City[] = [
  {
    slug: "karachi",
    name: "Karachi",
    short_code: "KHI",
    center_lat: 24.8607,
    center_lng: 67.0011,
    is_active: true,
  },
  {
    slug: "lahore",
    name: "Lahore",
    short_code: "LHR",
    center_lat: 31.5204,
    center_lng: 74.3587,
    is_active: true,
  },
];

const CITY_COOKIE_KEY = "inside_city_slug";
const DEFAULT_CITY_SLUG = "karachi";

interface CityContextValue {
  activeCity: City;
  cities: City[];
  setActiveCity: (city: City) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

function getCityFromCookie(): string {
  if (typeof document === "undefined") return DEFAULT_CITY_SLUG;
  const match = document.cookie.match(new RegExp(`${CITY_COOKIE_KEY}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : DEFAULT_CITY_SLUG;
}

function setCityCookie(slug: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${CITY_COOKIE_KEY}=${encodeURIComponent(slug)};max-age=${maxAge};path=/;SameSite=Lax`;
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [activeCity, setActiveCityState] = useState<City>(() => {
    const slug = getCityFromCookie();
    return KNOWN_CITIES.find((c) => c.slug === slug) ?? KNOWN_CITIES[0];
  });

  const setActiveCity = useCallback((city: City) => {
    setActiveCityState(city);
    setCityCookie(city.slug);
  }, []);

  // Sync from cookie on mount (handles SSR/CSR mismatch)
  useEffect(() => {
    const slug = getCityFromCookie();
    const city = KNOWN_CITIES.find((c) => c.slug === slug);
    if (city && city.slug !== activeCity.slug) {
      setActiveCityState(city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CityContext.Provider
      value={{ activeCity, cities: KNOWN_CITIES, setActiveCity }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) {
    throw new Error("useCity must be used inside <CityProvider>");
  }
  return ctx;
}

