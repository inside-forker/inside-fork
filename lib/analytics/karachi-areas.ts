/**
 * Karachi Area Geocoding & Hotspot Reference Catalog
 * Standardized zones for heatmap clusters, geospatial rollups, and neighborhood intelligence.
 */

export interface KarachiNeighborhoodInfo {
  id: string;
  name: string;
  aliasList: string[];
  center: { lat: number; lng: number };
  radiusKm: number; // approximate cluster radius
  description: string;
  categoryAffinity?: string[];
}

export const KARACHI_NEIGHBORHOODS: KarachiNeighborhoodInfo[] = [
  {
    id: "gulshan-e-iqbal",
    name: "Gulshan-e-Iqbal",
    aliasList: ["gulshan", "gulshan e iqbal", "gulshan-e-iqbal", "block 13", "block 6", "block 1", "block 2", "block 3", "block 4", "block 7", "block 10", "block 11", "block 13a", "block 13b", "block 13c", "block 13d", "block 14", "block 15"],
    center: { lat: 24.9207, lng: 67.0982 },
    radiusKm: 3.5,
    description: "Major university and commercial hub, heavy food street and student traffic.",
    categoryAffinity: ["Restaurants", "Cafes", "Academia", "Fast Food"],
  },
  {
    id: "gulistan-e-johar",
    name: "Gulistan-e-Johar",
    aliasList: ["johar", "gulistan e johar", "gulistan-e-johar", "jauhar", "block 1", "block 12", "block 14", "block 15", "block 19", "safoora", "kamran chowrangi", "continental"],
    center: { lat: 24.918, lng: 67.135 },
    radiusKm: 3.8,
    description: "High density residential area with dynamic late-night eateries, chai spots, and markets.",
    categoryAffinity: ["Chai Dhabas", "Late Night Dining", "Local Markets"],
  },
  {
    id: "clifton",
    name: "Clifton",
    aliasList: ["clifton", "block 2", "block 4", "block 5", "block 7", "block 8", "block 9", "sea view", "bilawal house", "boat basin", "teen talwar", "do talwar"],
    center: { lat: 24.825, lng: 67.032 },
    radiusKm: 3.2,
    description: "Coastal prime commercial district with top restaurants, upscale shopping malls, and cafes.",
    categoryAffinity: ["Fine Dining", "Malls", "Seaside", "Luxury"],
  },
  {
    id: "dha",
    name: "DHA (Defence)",
    aliasList: ["dha", "defence", "phase 1", "phase 2", "phase 4", "phase 5", "phase 6", "phase 7", "phase 8", "khayaban-e-shahbaz", "khayaban-e-seher", "bukhari commercial", "itihad commercial", "muslim commercial", "zamzama"],
    center: { lat: 24.805, lng: 67.065 },
    radiusKm: 4.5,
    description: "Trendy food streets, boutique cafes, upscale nightlife, fitness studios, and specialty retail.",
    categoryAffinity: ["Artisan Cafes", "Fitness", "Nightlife", "Boutique Retail"],
  },
  {
    id: "pechs-bahadurabad",
    name: "PECHS & Bahadurabad",
    aliasList: ["pechs", "bahadurabad", "tariq road", "block 2 pechs", "block 6 pechs", "tariq rd", "khalid bin waleed", "char minar"],
    center: { lat: 24.871, lng: 67.062 },
    radiusKm: 2.8,
    description: "Bustling central retail fashion epicenter, street food landmarks, and electronics markets.",
    categoryAffinity: ["Fashion Retail", "Street Food", "Jewelry", "Central Commercial"],
  },
  {
    id: "north-nazimabad",
    name: "North Nazimabad",
    aliasList: ["north nazimabad", "nazimabad", "hyderi", "sakhi hassan", "five star", "kda market", "block a", "block b", "block d", "block f", "block h", "block l"],
    center: { lat: 24.942, lng: 67.038 },
    radiusKm: 3.5,
    description: "Vibrant food avenues, Hyderi super-markets, and family restaurants.",
    categoryAffinity: ["Family Restaurants", "Hyderi Market", "Sweets & Bakers"],
  },
  {
    id: "saddar",
    name: "Saddar & Downtown",
    aliasList: ["saddar", "burns road", "empress market", "i.i chundrigar", "cantt", "regal", "downtown", "bohri bazaar"],
    center: { lat: 24.858, lng: 67.021 },
    radiusKm: 2.5,
    description: "Historic commercial core, famous heritage food streets (Burns Road), and corporate district.",
    categoryAffinity: ["Heritage Dining", "Traditional Food", "Corporate", "Wholesale Markets"],
  },
  {
    id: "bahria-town",
    name: "Bahria Town Karachi",
    aliasList: ["bahria", "bahria town", "btk", "midway commercial", "danzoo", "eiffel tower karachi"],
    center: { lat: 25.015, lng: 67.31 },
    radiusKm: 5.0,
    description: "Gated master community on Super Highway featuring family attractions, cinemas, and theme parks.",
    categoryAffinity: ["Family Attractions", "Themed Dining", "Entertainment"],
  },
  {
    id: "federal-b-area",
    name: "Federal B Area & FB Area",
    aliasList: ["fb area", "federal b area", "water pump", "dastagir", "ancholi", "samnabad", "block 14", "block 16"],
    center: { lat: 24.935, lng: 67.072 },
    radiusKm: 3.0,
    description: "Dense community known for food streets (Ancholi / Water Pump) and sports complexes.",
    categoryAffinity: ["Night Food Streets", "Sports", "Local Bakeries"],
  },
  {
    id: "malir-cantt",
    name: "Malir & Cantt",
    aliasList: ["malir", "malir cantt", "model colony", "airport", "jinnah international", "cantt bazar"],
    center: { lat: 24.895, lng: 67.195 },
    radiusKm: 4.2,
    description: "Residential community near Jinnah International Airport with modern dining strips.",
    categoryAffinity: ["Airport Transit", "Family Cafes", "Parks"],
  },
];

/**
 * Calculate distance in kilometers between two GPS coordinates using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
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

/**
 * Resolves the closest matching Karachi neighborhood for given coordinates and optional text hint
 */
export function resolveKarachiNeighborhood(
  lat: number | null | undefined,
  lng: number | null | undefined,
  hintText?: string | null
): string {
  // If hintText directly matches one of our known neighborhoods
  if (hintText && typeof hintText === "string") {
    const cleaned = hintText.trim().toLowerCase();
    for (const n of KARACHI_NEIGHBORHOODS) {
      if (cleaned.includes(n.id) || cleaned.includes(n.name.toLowerCase())) {
        return n.name;
      }
      for (const alias of n.aliasList) {
        if (cleaned.includes(alias)) {
          return n.name;
        }
      }
    }
  }

  // If valid coordinates are provided, find closest neighborhood center within threshold
  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    let closestNeighborhood: KarachiNeighborhoodInfo | null = null;
    let minDistance = Infinity;

    for (const n of KARACHI_NEIGHBORHOODS) {
      const dist = calculateDistanceKm(lat, lng, n.center.lat, n.center.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestNeighborhood = n;
      }
    }

    if (closestNeighborhood && minDistance <= (closestNeighborhood.radiusKm * 1.5)) {
      return closestNeighborhood.name;
    }
  }

  return hintText?.trim() || "Karachi Central";
}
