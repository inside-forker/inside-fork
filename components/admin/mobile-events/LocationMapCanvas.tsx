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
  intensityMultiplier = 1.0,
  showHotspotBadges = true,
}: LocationMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const canvasLayerRef = useRef<HTMLCanvasElement | null>(null);
  const markersLayerGroupRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"midnight" | "contrast">("midnight");

  // 1. Initialize Leaflet safely on Client
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

        // High contrast dark tile layers
        const tileUrl =
          mapStyle === "midnight"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png";

        L.tileLayer(tileUrl, {
          maxZoom: 19,
          subdomains: "abcd",
        }).addTo(map);

        L.control.zoom({ position: "topright" }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);
        markersLayerGroupRef.current = markersGroup;
        mapInstanceRef.current = map;

        // Setup Canvas Overlay
        if (canvasLayerRef.current && canvasLayerRef.current.parentNode) {
          canvasLayerRef.current.parentNode.removeChild(canvasLayerRef.current);
        }

        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "350";
        canvasLayerRef.current = canvas;

        const mapPanes = map.getPanes();
        mapPanes.overlayPane.appendChild(canvas);

        setMapLoaded(true);

        setTimeout(() => {
          if (!isCancelled && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);
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

  // 2. Render Canvas Heatmap Blooms
  useEffect(() => {
    const map = mapInstanceRef.current;
    const canvas = canvasLayerRef.current;
    if (!map || !canvas || !mapLoaded) return;

    import("leaflet").then(({ default: L }) => {
      const renderHeatmap = () => {
        if (!canvas || !map) return;
        const size = map.getSize();
        if (!size || size.x <= 0 || size.y <= 0) return;

        if (canvas.width !== size.x || canvas.height !== size.y) {
          canvas.width = size.x;
          canvas.height = size.y;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, size.x, size.y);
        if (!heatmapPoints || heatmapPoints.length === 0) return;

        const zoom = map.getZoom();
        const radius = Math.max(18, Math.min(75, (zoom - 8) * 13)) * intensityMultiplier;

        ctx.save();
        ctx.globalCompositeOperation = "screen";

        heatmapPoints.forEach((point) => {
          const latLng = L.latLng(point.lat, point.lng);
          const containerPoint = map.latLngToContainerPoint(latLng);

          if (
            containerPoint.x < -radius ||
            containerPoint.x > size.x + radius ||
            containerPoint.y < -radius ||
            containerPoint.y > size.y + radius
          ) {
            return;
          }

          const pointWeight = Math.min(1.0, point.weight * 1.25);
          const grad = ctx.createRadialGradient(
            containerPoint.x,
            containerPoint.y,
            0,
            containerPoint.x,
            containerPoint.y,
            radius
          );

          // Snapchat thermal bloom gradient
          grad.addColorStop(0, `rgba(255, 20, 80, ${0.9 * pointWeight})`); // Red Hot Core
          grad.addColorStop(0.25, `rgba(255, 125, 0, ${0.75 * pointWeight})`); // Neon Orange
          grad.addColorStop(0.55, `rgba(255, 235, 0, ${0.45 * pointWeight})`); // Yellow Glow
          grad.addColorStop(0.85, `rgba(0, 240, 255, ${0.2 * pointWeight})`); // Soft Cyan Aura
          grad.addColorStop(1, "rgba(0, 240, 255, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(containerPoint.x, containerPoint.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
      };

      map.on("move", renderHeatmap);
      map.on("zoom", renderHeatmap);
      map.on("resize", renderHeatmap);
      renderHeatmap();
    });
  }, [mapLoaded, heatmapPoints, intensityMultiplier]);

  // 3. Render Hotspot Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerGroupRef.current;
    if (!map || !markersGroup || !mapLoaded) return;

    import("leaflet").then(({ default: L }) => {
      markersGroup.clearLayers();
      if (!showHotspotBadges) return;

      clusters.forEach((cluster) => {
        if (cluster.totalEvents === 0) return;

        const isSelected = selectedArea === cluster.name;
        const isBlazing = cluster.intensityLevel === "blazing";
        const isHot = cluster.intensityLevel === "hot";

        const pulseColor = isBlazing ? "#ff1a53" : isHot ? "#ff8800" : "#00f0ff";
        const badgeBg = isSelected
          ? "background: #ff184d; color: #ffffff; border: 2px solid #ffffff; box-shadow: 0 0 20px rgba(255,24,77,0.7);"
          : isBlazing
          ? "background: rgba(9, 9, 11, 0.95); color: #fda4af; border: 1.5px solid rgba(244, 63, 94, 0.8); box-shadow: 0 0 15px rgba(244,63,94,0.4);"
          : isHot
          ? "background: rgba(9, 9, 11, 0.95); color: #fde047; border: 1.5px solid rgba(234, 179, 8, 0.8); box-shadow: 0 0 15px rgba(234,179,8,0.4);"
          : "background: rgba(9, 9, 11, 0.95); color: #67e8f9; border: 1.5px solid rgba(6, 182, 212, 0.8); box-shadow: 0 0 15px rgba(6,182,212,0.4);";

        const topSearchPreview = cluster.topSearches[0]?.query
          ? `🔍 &ldquo;${cluster.topSearches[0].query}&rdquo;`
          : "Active Zone";

        const iconHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto;">
            <!-- Pulsing Rings -->
            <div style="position: absolute; top: -12px; left: -12px; width: 64px; height: 64px; pointer-events: none;">
              <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.5; background-color: ${pulseColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
            </div>

            <!-- Hotspot Bubble -->
            <div style="position: relative; z-index: 10; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px; backdrop-filter: blur(8px); ${badgeBg}; transition: all 0.2s ease;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background-color: ${pulseColor};"></span>
              <span style="font-size: 12px; font-weight: 700; white-space: nowrap;">${cluster.name}</span>
              <span style="font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 9999px; background: rgba(255,255,255,0.15); font-weight: 700;">
                ${cluster.uniqueUsers} 👤
              </span>
              ${isBlazing ? `<span style="font-size: 12px;">🔥</span>` : ""}
            </div>

            <!-- Query subtitle chip -->
            <div style="margin-top: 4px; padding: 2px 8px; border-radius: 6px; background: rgba(9, 9, 11, 0.9); border: 1px solid rgba(39, 39, 42, 0.8); font-size: 10px; color: #e4e4e7; font-weight: 600; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">
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
            duration: 1.0,
          });
        });

        marker.addTo(markersGroup);
      });
    });
  }, [mapLoaded, clusters, selectedArea, showHotspotBadges, onSelectArea]);

  const handleResetKarachi = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(KARACHI_CENTER, DEFAULT_ZOOM, {
        duration: 1.0,
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
        { duration: 1.0 }
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
          Live Heatmap ({heatmapPoints.length} Pings)
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
          <span>Activity Density</span>
          <span className="text-zinc-500">Snapchat Thermal Spectrum</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-cyan-400">Mild</span>
          <div className="w-36 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-amber-300 via-orange-500 to-rose-600 shadow-inner" />
          <span className="text-[11px] font-medium text-rose-500 flex items-center gap-0.5">
            Blazing <Flame className="w-3 h-3 inline" />
          </span>
        </div>
      </div>
    </div>
  );
}
