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
  X,
  User,
  Smartphone,
  Clock,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import type {
  HeatmapPoint,
  NeighborhoodCluster,
  PinnedUserTarget,
  TrackedUserSummary,
  UserPingHistoryItem,
} from "@/lib/analytics/mobile-location";

interface LocationMapCanvasProps {
  clusters: NeighborhoodCluster[];
  heatmapPoints: HeatmapPoint[];
  selectedArea: string | null;
  onSelectArea: (neighborhood: string) => void;
  pinnedUser?: PinnedUserTarget | null;
  onClearPinnedUser?: () => void;
  trackedUser?: TrackedUserSummary | null;
  userPings?: UserPingHistoryItem[];
  focusedPing?: UserPingHistoryItem | null;
  onClearTrackedUser?: () => void;
  onSelectPing?: (ping: UserPingHistoryItem) => void;
  intensityMultiplier?: number;
  showHotspotBadges?: boolean;
}

const KARACHI_CENTER: [number, number] = [24.89, 67.06];
const DEFAULT_ZOOM = 12;

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

export default function LocationMapCanvas({
  clusters,
  heatmapPoints,
  selectedArea,
  onSelectArea,
  pinnedUser,
  onClearPinnedUser,
  trackedUser,
  userPings,
  focusedPing,
  onClearTrackedUser,
  onSelectPing,
  intensityMultiplier,
  showHotspotBadges = true,
}: LocationMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerGroupRef = useRef<any>(null);
  const zonesLayerGroupRef = useRef<any>(null);
  const userPinLayerGroupRef = useRef<any>(null);
  const trajectoryLayerGroupRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"midnight" | "contrast">("midnight");
  const [copiedCoords, setCopiedCoords] = useState(false);

  const handleCopyCoords = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

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
          maxZoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        // 100% Free, Zero-Key, Watermark-Free Tile Providers
        if (mapStyle === "midnight") {
          // Esri Dark Gray Canvas Base
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 16,
              maxNativeZoom: 16,
              attribution: "Esri, HERE, Garmin, © OpenStreetMap",
            }
          ).addTo(map);

          // Add road names and landmark labels overlay
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 16,
              maxNativeZoom: 16,
              pane: "shadowPane",
            }
          ).addTo(map);
        } else {
          // OpenStreetMap Standard (100% Free)
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 16,
            maxNativeZoom: 16,
            subdomains: ["a", "b", "c"],
            attribution: "© OpenStreetMap contributors",
          }).addTo(map);
        }

        L.control.zoom({ position: "topright" }).addTo(map);

        const zonesGroup = L.layerGroup().addTo(map);
        zonesLayerGroupRef.current = zonesGroup;

        const markersGroup = L.layerGroup().addTo(map);
        markersLayerGroupRef.current = markersGroup;

        const userPinGroup = L.layerGroup().addTo(map);
        userPinLayerGroupRef.current = userPinGroup;

        const trajectoryGroup = L.layerGroup().addTo(map);
        trajectoryLayerGroupRef.current = trajectoryGroup;

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

  // 2. Render Hotspots and Radial Heatmap Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const zonesGroup = zonesLayerGroupRef.current;
    const markersGroup = markersLayerGroupRef.current;
    if (!map || !zonesGroup || !markersGroup || !mapLoaded) return;

    zonesGroup.clearLayers();
    markersGroup.clearLayers();

    if (!showHotspotBadges) return;

    const isTracking = !!(trackedUser && userPings && userPings.length > 0);

    import("leaflet").then(({ default: L }) => {
      clusters.forEach((cluster) => {
        const isSelected = selectedArea === cluster.name;
        const isBlazing = cluster.intensityLevel === "blazing";
        const isHot = cluster.intensityLevel === "hot";

        let primaryColor = "#00f0ff";
        let fillColor = "#00f0ff";
        let fillOpacity = isTracking ? 0.04 : 0.12 * (intensityMultiplier || 1);

        if (isBlazing) {
          primaryColor = "#ff184d";
          fillColor = "#ff184d";
          fillOpacity = isTracking ? 0.08 : 0.24 * (intensityMultiplier || 1);
        } else if (isHot) {
          primaryColor = "#f59e0b";
          fillColor = "#f59e0b";
          fillOpacity = isTracking ? 0.06 : 0.18 * (intensityMultiplier || 1);
        }

        const outerRadius = (cluster.radiusKm * 1000 * 1.5) * (isBlazing ? 1.25 : 1.0);
        const outerCircle = L.circle([cluster.center.lat, cluster.center.lng], {
          radius: outerRadius,
          color: primaryColor,
          weight: isSelected ? 2 : 1,
          opacity: isTracking ? 0.2 : (isSelected ? 0.8 : 0.4),
          fillColor: fillColor,
          fillOpacity: fillOpacity * 0.4,
          dashArray: isSelected ? undefined : "4, 6",
        });

        outerCircle.on("click", () => {
          onSelectArea(cluster.name);
          map.flyTo([cluster.center.lat, cluster.center.lng], 14, {
            duration: 0.8,
          });
        });

        outerCircle.addTo(zonesGroup);

        const innerRadius = cluster.radiusKm * 1000 * 0.8;
        const innerCircle = L.circle([cluster.center.lat, cluster.center.lng], {
          radius: innerRadius,
          color: primaryColor,
          weight: isSelected ? 2.5 : 1.5,
          opacity: isTracking ? 0.3 : (isSelected ? 0.95 : 0.65),
          fillColor: fillColor,
          fillOpacity: fillOpacity,
        });

        innerCircle.on("click", () => {
          onSelectArea(cluster.name);
          map.flyTo([cluster.center.lat, cluster.center.lng], 14, {
            duration: 0.8,
          });
        });

        innerCircle.addTo(zonesGroup);

        if (!showHotspotBadges && !isSelected) return;

        const badgeHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto; opacity: ${
            isTracking ? "0.6" : "1"
          };">
            <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 9999px; background: rgba(9, 9, 11, 0.9); border: 1.5px solid ${primaryColor}; box-shadow: 0 0 15px ${primaryColor}66; white-space: nowrap; backdrop-filter: blur(8px);">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: ${primaryColor};"></span>
              <span style="font-size: 11px; font-weight: 700; color: #ffffff;">${cluster.name}</span>
              <span style="font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 9999px; background: ${primaryColor}26; color: ${primaryColor};">${cluster.uniqueUsers} 👤</span>
            </div>
            ${
              cluster.topSearches[0] && !isTracking
                ? `<div style="margin-top: 3px; padding: 2px 6px; border-radius: 6px; background: rgba(0, 0, 0, 0.85); border: 1px solid rgba(255,255,255,0.15); font-size: 9px; color: #e4e4e7; white-space: nowrap;">
                    🔍 "${cluster.topSearches[0].query}"
                   </div>`
                : ""
            }
          </div>
        `;

        const customIcon = L.divIcon({
          html: badgeHtml,
          className: "snapchat-hotspot-badge-icon",
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
  }, [mapLoaded, clusters, selectedArea, showHotspotBadges, onSelectArea, intensityMultiplier, trackedUser, userPings]);

  // 3. Render Dedicated Pinned User Avatar Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userPinGroup = userPinLayerGroupRef.current;
    if (!map || !userPinGroup || !mapLoaded) return;

    userPinGroup.clearLayers();

    if (!pinnedUser || (trackedUser && userPings && userPings.length > 0)) return;

    import("leaflet").then(({ default: L }) => {
      // Smoothly pan to the user's coordinates with street-level zoom
      map.flyTo([pinnedUser.lat, pinnedUser.lng], 15, { duration: 1.0 });

      const initialLetter = pinnedUser.name ? pinnedUser.name[0].toUpperCase() : "U";
      const relativeTime = formatRelativeTime(pinnedUser.lastSeen);

      const userIconHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto; z-index: 999;">
          <!-- Glowing Pulsing Ring Aura -->
          <div style="position: absolute; top: -20px; left: -20px; width: 88px; height: 88px; pointer-events: none;">
            <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.75; background-color: #ff184d; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
            <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.35; background-color: #ff184d; transform: scale(1.4);"></span>
          </div>

          <!-- Avatar Pin Bubble -->
          <div style="position: relative; z-index: 100; width: 48px; height: 48px; border-radius: 9999px; background: #ff184d; border: 3px solid #ffffff; box-shadow: 0 0 25px rgba(255,24,77,0.9); display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${
              pinnedUser.avatarUrl
                ? `<img src="${pinnedUser.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                : `<span style="font-size: 20px; font-weight: 800; color: #ffffff;">${initialLetter}</span>`
            }
          </div>

          <!-- Detailed Info Card Floating Above Pin -->
          <div style="margin-top: 8px; padding: 8px 12px; border-radius: 12px; background: rgba(9, 9, 11, 0.96); border: 1.5px solid #ff184d; box-shadow: 0 8px 25px rgba(0,0,0,0.8); text-align: center; white-space: nowrap; backdrop-filter: blur(12px);">
            <div style="font-size: 12px; font-weight: 700; color: #ffffff; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>${pinnedUser.name}</span>
              ${
                pinnedUser.isSigned
                  ? `<span style="font-size: 9px; padding: 1px 5px; border-radius: 9999px; background: rgba(255,24,77,0.3); color: #fda4af; font-weight: 600;">Signed In</span>`
                  : ""
              }
            </div>
            <div style="font-size: 10px; color: #fbbf24; font-weight: 600; margin-top: 2px;">
              🕒 Last pinged: ${relativeTime}
            </div>
            <div style="font-size: 9px; color: #a1a1aa; margin-top: 1px;">
              ${pinnedUser.platform ? `${pinnedUser.platform.toUpperCase()} • ` : ""}Screen: ${
        pinnedUser.topScreen || "Home"
      }
            </div>

            <!-- Coordinates Pill & External Map Link -->
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; gap: 5px;">
              <div style="font-family: monospace; font-size: 10px; font-weight: 600; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(56,189,248,0.3);">
                📍 ${pinnedUser.lat.toFixed(5)}, ${pinnedUser.lng.toFixed(5)}
              </div>
              <a 
                href="https://www.google.com/maps?q=${pinnedUser.lat},${pinnedUser.lng}" 
                target="_blank" 
                rel="noopener noreferrer" 
                style="display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 600; color: #ffffff; background: #ff184d; padding: 2px 7px; border-radius: 6px; text-decoration: none;"
                title="View exact location on Google Maps"
              >
                Maps ↗
              </a>
            </div>
          </div>
        </div>
      `;

      const userCustomIcon = L.divIcon({
        html: userIconHtml,
        className: "snapchat-pinned-user-icon",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const userMarker = L.marker([pinnedUser.lat, pinnedUser.lng], {
        icon: userCustomIcon,
        zIndexOffset: 1000,
      });

      userMarker.addTo(userPinGroup);
    });
  }, [mapLoaded, pinnedUser, trackedUser, userPings]);

  // 4. Render User Tracker Mode Trajectory & Historical Breadcrumbs
  useEffect(() => {
    const map = mapInstanceRef.current;
    const trajGroup = trajectoryLayerGroupRef.current;
    const userPinGroup = userPinLayerGroupRef.current;
    if (!map || !trajGroup || !mapLoaded) return;

    trajGroup.clearLayers();

    if (!trackedUser || !userPings || userPings.length === 0) return;

    if (userPinGroup) userPinGroup.clearLayers();

    import("leaflet").then(({ default: L }) => {
      const latLngs: [number, number][] = userPings.map((p) => [p.lat, p.lng]);

      // Draw polyline route connecting pings
      if (latLngs.length > 1) {
        // Glowing halo path
        L.polyline(latLngs, {
          color: "#ff184d",
          weight: 7,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(trajGroup);

        // Vibrant dashed core line
        L.polyline(latLngs, {
          color: "#38bdf8",
          weight: 3.5,
          opacity: 0.95,
          dashArray: "8, 8",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(trajGroup);
      }

      // Render markers for all pings
      userPings.forEach((ping, idx) => {
        const isLatest = idx === userPings.length - 1;
        const relativeTime = formatRelativeTime(ping.occurredAt);

        if (isLatest) {
          const initialLetter = trackedUser.fullName
            ? trackedUser.fullName[0].toUpperCase()
            : trackedUser.username
            ? trackedUser.username[0].toUpperCase()
            : "U";

          const latestIconHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto; z-index: 1000;">
              <div style="position: absolute; top: -20px; left: -20px; width: 88px; height: 88px; pointer-events: none;">
                <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.75; background-color: #ff184d; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                <span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 9999px; opacity: 0.35; background-color: #ff184d; transform: scale(1.4);"></span>
              </div>
              <div style="position: relative; z-index: 100; width: 48px; height: 48px; border-radius: 9999px; background: #ff184d; border: 3px solid #ffffff; box-shadow: 0 0 25px rgba(255,24,77,0.9); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${
                  trackedUser.avatarUrl
                    ? `<img src="${trackedUser.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                    : `<span style="font-size: 20px; font-weight: 800; color: #ffffff;">${initialLetter}</span>`
                }
              </div>
              <div style="margin-top: 8px; padding: 8px 12px; border-radius: 12px; background: rgba(9, 9, 11, 0.96); border: 1.5px solid #ff184d; box-shadow: 0 8px 25px rgba(0,0,0,0.8); text-align: center; white-space: nowrap; backdrop-filter: blur(12px);">
                <div style="font-size: 12px; font-weight: 700; color: #ffffff; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <span>${trackedUser.fullName || trackedUser.username || "Tracked User"}</span>
                  ${
                    trackedUser.isUserId
                      ? `<span style="font-size: 9px; padding: 1px 5px; border-radius: 9999px; background: rgba(255,24,77,0.3); color: #fda4af; font-weight: 600;">Signed In</span>`
                      : ""
                  }
                </div>
                <div style="font-size: 10px; color: #fbbf24; font-weight: 600; margin-top: 2px;">
                  🏁 Latest Ping (#${idx + 1}): ${relativeTime}
                </div>
                <div style="font-size: 9px; color: #a1a1aa; margin-top: 1px;">
                  ${ping.neighborhood || "Karachi"} • ${ping.screen ? `Screen: ${ping.screen}` : ping.eventName}
                </div>
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; gap: 5px;">
                  <div style="font-family: monospace; font-size: 10px; font-weight: 600; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(56,189,248,0.3);">
                    📍 ${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)}
                  </div>
                  <a href="https://www.google.com/maps?q=${ping.lat},${ping.lng}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 600; color: #ffffff; background: #ff184d; padding: 2px 7px; border-radius: 6px; text-decoration: none;">Maps ↗</a>
                </div>
              </div>
            </div>
          `;

          const latestMarker = L.marker([ping.lat, ping.lng], {
            icon: L.divIcon({
              html: latestIconHtml,
              className: "snapchat-pinned-user-icon",
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
            zIndexOffset: 1200,
          });

          latestMarker.on("click", () => onSelectPing?.(ping));
          latestMarker.addTo(trajGroup);
        } else {
          // Numbered historical breadcrumb marker
          const breadcrumbHtml = `
            <div style="display: flex; align-items: center; justify-content: center; cursor: pointer; transform: translate(-50%, -50%); pointer-events: auto;">
              <div style="width: 26px; height: 26px; border-radius: 9999px; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 14px rgba(2,132,199,0.9); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #ffffff;">
                ${idx + 1}
              </div>
            </div>
          `;

          const breadcrumbMarker = L.marker([ping.lat, ping.lng], {
            icon: L.divIcon({
              html: breadcrumbHtml,
              className: "trajectory-breadcrumb-icon",
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
            zIndexOffset: 900 + idx,
          });

          const popupContent = `
            <div style="padding: 6px 8px; text-align: center; color: #ffffff; min-width: 150px;">
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8;">📍 Ping #${idx + 1} of ${userPings.length}</div>
              <div style="font-size: 11px; font-weight: 600; margin-top: 3px;">${ping.neighborhood || "Karachi"}</div>
              <div style="font-size: 10px; color: #fbbf24; margin-top: 2px;">🕒 ${relativeTime}</div>
              <div style="font-size: 9px; color: #a1a1aa; margin-top: 1px;">Event: ${ping.eventName}${ping.screen ? ` (${ping.screen})` : ""}</div>
              <div style="font-family: monospace; font-size: 9px; color: #38bdf8; margin-top: 4px;">${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)}</div>
            </div>
          `;

          breadcrumbMarker.bindPopup(popupContent, {
            className: "dark-custom-leaflet-popup",
          });

          breadcrumbMarker.on("click", () => onSelectPing?.(ping));
          breadcrumbMarker.addTo(trajGroup);
        }
      });

      // Fit map bounds to show full journey
      if (latLngs.length > 1) {
        map.fitBounds(L.latLngBounds(latLngs), {
          padding: [70, 70],
          maxZoom: 15,
          duration: 1.0,
        });
      } else if (latLngs.length === 1) {
        map.flyTo(latLngs[0], 15, { duration: 1.0 });
      }
    });
  }, [mapLoaded, trackedUser, userPings, onSelectPing]);

  // 5. Focus specific ping when clicked in list
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !focusedPing) return;

    map.flyTo([focusedPing.lat, focusedPing.lng], 16, {
      duration: 0.8,
    });
  }, [focusedPing, mapLoaded]);

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
      className={`relative w-full rounded-2xl overflow-hidden border border-border shadow-xl bg-card transition-all duration-300 ${
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
        {trackedUser ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="bg-background/95 backdrop-blur-md border-sky-500 text-foreground px-3 py-1.5 shadow-lg text-xs font-semibold flex items-center gap-2"
            >
              <Navigation className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span>
                Tracking: <strong className="text-sky-500">{trackedUser.fullName || trackedUser.username || "User"}</strong>
              </span>
              <Badge className="bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px] px-1.5 py-0">
                {userPings?.length || 0} pings
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearTrackedUser}
                className="h-5 w-5 p-0 hover:bg-muted ml-1 rounded-full text-muted-foreground hover:text-foreground"
                title="Exit Tracker Mode"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </Badge>

            {/* Coordinates & Copy Bar for latest ping */}
            <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-md border border-border px-2.5 py-1 rounded-lg shadow-lg">
              <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {trackedUser.lastLatitude.toFixed(5)}, {trackedUser.lastLongitude.toFixed(5)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyCoords(trackedUser.lastLatitude, trackedUser.lastLongitude)}
                className="h-6 px-2 text-[10px] gap-1 border-border font-medium hover:border-primary"
                title="Copy Lat, Lng coordinates"
              >
                {copiedCoords ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Lat/Lng
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-0.5"
              >
                <a
                  href={`https://www.google.com/maps?q=${trackedUser.lastLatitude},${trackedUser.lastLongitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open exact coordinates in Google Maps"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        ) : pinnedUser ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="bg-background/95 backdrop-blur-md border-rose-500 text-foreground px-3 py-1.5 shadow-lg text-xs font-semibold flex items-center gap-2"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>
                Pinned: <strong className="text-rose-500">{pinnedUser.name}</strong>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearPinnedUser}
                className="h-5 w-5 p-0 hover:bg-muted ml-1 rounded-full text-muted-foreground hover:text-foreground"
                title="Clear User Pin"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </Badge>

            {/* Coordinates & Copy Bar */}
            <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-md border border-border px-2.5 py-1 rounded-lg shadow-lg">
              <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {pinnedUser.lat.toFixed(5)}, {pinnedUser.lng.toFixed(5)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyCoords(pinnedUser.lat, pinnedUser.lng)}
                className="h-6 px-2 text-[10px] gap-1 border-border font-medium hover:border-primary"
                title="Copy Lat, Lng coordinates"
              >
                {copiedCoords ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Lat/Lng
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-0.5"
              >
                <a
                  href={`https://www.google.com/maps?q=${pinnedUser.lat},${pinnedUser.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open exact coordinates in Google Maps"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="bg-background/90 backdrop-blur-md border-border text-foreground px-3 py-1.5 shadow-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            Live Location Nodes ({heatmapPoints.length} Pings)
          </Badge>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleFocusHottest}
          className="bg-background/90 backdrop-blur-md border-border hover:border-rose-500 text-foreground hover:text-rose-500 text-xs shadow-lg h-8 gap-1.5"
        >
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          Focus Hottest Zone
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResetKarachi}
          className="bg-background/90 backdrop-blur-md border-border text-foreground text-xs shadow-lg h-8 gap-1.5"
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
          className="bg-background/90 backdrop-blur-md border-border text-foreground text-xs h-8 shadow-lg"
          title="Toggle Dark / Contrast Tiles"
        >
          <Layers className="w-3.5 h-3.5 mr-1" />
          {mapStyle === "midnight" ? "Midnight" : "Contrast"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFullscreen((f) => !f)}
          className="bg-background/90 backdrop-blur-md border-border text-foreground text-xs h-8 shadow-lg"
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
      <div className="absolute bottom-4 left-4 z-[400] bg-background/90 backdrop-blur-md border border-border rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5 flex items-center justify-between">
          <span>Hotspot Intensity</span>
          <span className="text-muted-foreground">Snapchat Radar</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-300">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-300">High Demand</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
              Blazing <Flame className="w-3 h-3 inline text-rose-500" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
