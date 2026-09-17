"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Maximize2,
  Minimize2,
  Navigation,
  Layers,
  Sparkles,
  MapPin,
  RefreshCw,
  Radio,
} from "lucide-react";
import type {
  HeatmapPoint,
  NeighborhoodCluster,
} from "@/lib/analytics/mobile-location";

interface LocationMapCanvasProps {
  clusters: NeighborhoodCluster[];
  heatmapPoints: HeatmapPoint[];
  selectedArea: string | null;
  onSelectArea: (neighborhood: string) => void;
  intensityMultiplier?: number;
  showHotspotBadges?: boolean;
}

const KARACHI_CENTER: [number, number] = [24.89, 67.06];
const DEFAULT_ZOOM = 12;

export default function LocationMapCanvas({
  clusters,
  heatmapPoints,
  selectedArea,
  onSelectArea,
  showHotspotBadges = true,
}: LocationMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerGroupRef = useRef<any>(null);
  const zonesLayerGroupRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"midnight" | "contrast">("midnight");

  // 1. Initialize Map
  useEffect(() => {
    let isCancelled = false;

    async function initLeafletMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      try {
        const L = (await import("leaflet")).default;

        // Ensure Leaflet CSS is linked
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        if (isCancelled || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: KARACHI_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 10,
          maxZoom: 17,
          zoomControl: false,
          attributionControl: false,
        });

        // 100% Free, Zero-Key, Watermark-Free Tile Providers
        if (mapStyle === "midnight") {
          // Esri Dark Gray Canvas Base
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 18,
              attribution: "Esri, HERE, Garmin, © OpenStreetMap",
            }
          ).addTo(map);

          // Add road names and landmark labels overlay
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 18,
              pane: "shadowPane",
            }
          ).addTo(map);
        } else {
          // OpenStreetMap Standard (100% Free)
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            subdomains: ["a", "b", "c"],
            attribution: "© OpenStreetMap contributors",
          }).addTo(map);
        }

        L.control.zoom({ position: "topright" }).addTo(map);

        const zonesGroup = L.layerGroup().addTo(map);
        zonesLayerGroupRef.current = zonesGroup;

        const markersGroup = L.layerGroup().addTo(map);
        markersLayerGroupRef.current = markersGroup;
        mapInstanceRef.current = map;

        setMapLoaded(true);

        setTimeout(() => {
          if (!isCancelled && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);
      } catch (err) {
        console.error("Failed to initialize Leaflet Map:", err);
      }
    }

    initLeafletMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapStyle]);

  // 2. Render Native Radiant Zones & Blinking Hotspots
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerGroupRef.current;
    const zonesGroup = zonesLayerGroupRef.current;
    if (!map || !markersGroup || !zonesGroup || !mapLoaded) return;

    import("leaflet").then(({ default: L }) => {
      markersGroup.clearLayers();
      zonesGroup.clearLayers();

      if (!showHotspotBadges) return;

      clusters.forEach((cluster) => {
        if (cluster.totalEvents === 0) return;

        const isSelected = selectedArea === cluster.name;
        const isBlazing = cluster.intensityLevel === "blazing";
        const isHot = cluster.intensityLevel === "hot";

        // Distinct radiant colors for intensity tiers
        const primaryColor = isBlazing ? "#ff184d" : isHot ? "#f59e0b" : "#06b6d4";
        const fillColor = isBlazing ? "#ff184d" : isHot ? "#eab308" : "#00f0ff";
        const fillOpacity = isSelected ? 0.25 : isBlazing ? 0.18 : isHot ? 0.14 : 0.1;

        // 1) Smooth Native Radial Activity Circle on Map (Never drifts during zoom)
        const radiusMeters = Math.max(1200, (cluster.radiusKm || 2.5) * 650);
        const circle = L.circle([cluster.center.lat, cluster.center.lng], {
          radius: radiusMeters,
          color: primaryColor,
          weight: isSelected ? 2.5 : 1.5,
          opacity: isSelected ? 0.9 : 0.6,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          dashArray: isSelected ? undefined : "4, 6",
        });

        circle.on("click", () => {
          onSelectArea(cluster.name);
          map.flyTo([cluster.center.lat, cluster.center.lng], 14, {
            duration: 0.8,
          });
        });

        circle.addTo(zonesGroup);

        // 2) Snapchat-Style Pulsing / Blinking Radar Node
        const pulseColor = isBlazing ? "#ff184d" : isHot ? "#fbbf24" : "#22d3ee";
        const badgeBg = isSelected
          ? "background: #ff184d; color: #ffffff; border: 2px solid #ffffff; box-shadow: 0 0 25px rgba(255,24,77,0.85);"
          : isBlazing
          ? "background: rgba(15, 15, 20, 0.95); color: #fda4af; border: 1.5px solid rgba(244, 63, 94, 0.9); box-shadow: 0 0 18px rgba(244,63,94,0.45);"
          : isHot
          ? "background: rgba(15, 15, 20, 0.95); color: #fde047; border: 1.5px solid rgba(234, 179, 8, 0.9); box-shadow: 0 0 18px rgba(234,179,8,0.45);"
          : "background: rgba(15, 15, 20, 0.95); color: #67e8f9; border: 1.5px solid rgba(6, 182, 212, 0.9); box-shadow: 0 0 18px rgba(6,182,212,0.45);";

        const topSearchPreview = cluster.topSearches[0]?.query
          ? `🔍 &ldquo;${cluster.topSearches[0].query}&rdquo;`
          : "Active Zone";

        const iconHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto;">
            <!-- Radiant Multi-Ring Pulsing Radar Waves -->
            <div style="position: absolute; top: -16px; left: -16px; width: 80px; height: 80px; pointer-events: none;">
              <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.6; background-color: ${pulseColor}; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.25; background-color: ${pulseColor}; transform: scale(1.3);"></span>
            </div>

            <!-- Hotspot Node Pill -->
            <div style="position: relative; z-index: 10; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px; backdrop-filter: blur(10px); ${badgeBg}; transition: all 0.2s ease;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background-color: ${pulseColor}; box-shadow: 0 0 8px ${pulseColor};"></span>
              <span style="font-size: 12px; font-weight: 700; white-space: nowrap;">${cluster.name}</span>
              <span style="font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 9999px; background: rgba(255,255,255,0.18); font-weight: 700;">
                ${cluster.uniqueUsers} 👤
              </span>
              ${isBlazing ? `<span style="font-size: 12px;">🔥</span>` : ""}
            </div>

            <!-- Top Search Bubble -->
            <div style="margin-top: 4px; padding: 2px 8px; border-radius: 6px; background: rgba(10, 10, 14, 0.92); border: 1px solid rgba(63, 63, 70, 0.8); font-size: 10px; color: #f4f4f5; font-weight: 600; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.6);">
              ${topSearchPreview}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "snapchat-hotspot-div-icon",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([cluster.center.lat, cluster.center.lng], {
          icon: customIcon,
        });

        marker.on("click", () => {
          onSelectArea(cluster.name);
          map.flyTo([cluster.center.lat, cluster.center.lng], 14, {
            duration: 0.8,
          });
        });

        marker.addTo(markersGroup);
      });
    });
  }, [mapLoaded, clusters, selectedArea, showHotspotBadges, onSelectArea]);

  const handleResetKarachi = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(KARACHI_CENTER, DEFAULT_ZOOM, {
        duration: 0.8,
      });
    }
  };

  const handleFocusHottest = () => {
    const hottest = clusters[0];
    if (hottest && mapInstanceRef.current) {
      onSelectArea(hottest.name);
      mapInstanceRef.current.flyTo(
        [hottest.center.lat, hottest.center.lng],
        14,
        { duration: 0.8 }
      );
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950 transition-all duration-300 ${
        isFullscreen ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[620px]"
      }`}
      style={{ minHeight: "620px", height: isFullscreen ? "calc(100vh - 2rem)" : "620px" }}
    >
      {/* Map DOM Element */}
      <div
        ref={mapContainerRef}
        className="w-full h-full bg-zinc-950"
        style={{ minHeight: "620px", height: "100%", width: "100%" }}
      />

      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 flex-wrap pointer-events-auto">
        <Badge
          variant="outline"
          className="bg-zinc-950/90 backdrop-blur-md border-zinc-700 text-zinc-100 px-3 py-1.5 shadow-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          Live Location Nodes ({heatmapPoints.length} Pings)
        </Badge>

        <Button
          size="sm"
          variant="outline"
          onClick={handleFocusHottest}
          className="bg-zinc-950/90 backdrop-blur-md border-zinc-700 hover:border-rose-500 text-zinc-100 hover:text-rose-400 text-xs shadow-lg h-8 gap-1.5"
        >
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          Focus Hottest Zone
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResetKarachi}
          className="bg-zinc-950/90 backdrop-blur-md border-zinc-700 text-zinc-100 text-xs shadow-lg h-8 gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Reset Karachi View
        </Button>
      </div>

      {/* Top Right Tool Buttons */}
      <div className="absolute top-4 right-14 z-[400] flex items-center gap-2 pointer-events-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setMapStyle((s) => (s === "midnight" ? "contrast" : "midnight"))
          }
          className="bg-zinc-950/90 backdrop-blur-md border-zinc-700 text-zinc-200 text-xs h-8 shadow-lg"
          title="Toggle Dark / Contrast Tiles"
        >
          <Layers className="w-3.5 h-3.5 mr-1" />
          {mapStyle === "midnight" ? "Midnight" : "Contrast"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFullscreen((f) => !f)}
          className="bg-zinc-950/90 backdrop-blur-md border-zinc-700 text-zinc-200 text-xs h-8 shadow-lg"
          title="Toggle Fullscreen Map"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-4 left-4 z-[400] bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-2.5 shadow-2xl pointer-events-auto">
        <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1.5 flex items-center justify-between">
          <span>Hotspot Intensity</span>
          <span className="text-zinc-500">Snapchat Radar Spectrum</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span className="text-[11px] font-medium text-cyan-300">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-[11px] font-medium text-amber-300">High Demand</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-[11px] font-medium text-rose-400 flex items-center gap-0.5">
              Blazing <Flame className="w-3 h-3 inline text-rose-500" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
