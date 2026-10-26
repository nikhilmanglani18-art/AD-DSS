import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ruler,
  Crosshair,
  CloudLightning,
  X,
  Fuel,
  Radio,
  Eye,
  AlertTriangle,
  Zap,
  Target
} from "lucide-react";
import type { Aircraft, Airbase, SAMThreat, PendingMission, WeatherCell, HostileUAV } from "../types";

interface TacticalMapProps {
  aircraft: Aircraft[];
  airbases: Airbase[];
  threats: SAMThreat[];
  missions: PendingMission[];
  weather?: WeatherCell[];
  hostileUavs?: HostileUAV[];
  selectedAircraftId?: string;
  onSelectAircraft?: (ac: Aircraft) => void;
  onInjectThreat?: (payload?: any) => void;
  onAuthorizeCOA?: (coaId: string) => void;
  onOpenCockpit?: (aircraftId: string) => void;
}

// Tactical Center: Northern & Western Air Defence Theatre (Halwara / Punjab Sector)
const THEATRE_CENTER: [number, number] = [31.15, 75.85];
const DEFAULT_ZOOM = 7;

// 100% Free, Open, Zero-API-Key Military Tile Providers (Globally Accessible without any API key)
const TILE_LAYERS = {
  dark: {
    name: "Cyber IACCS Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
    attribution: "© CartoDB Dark Matter / IACCS"
  },
  satellite: {
    name: "Satellite Recon",
    url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "© Google Satellite Recon"
  },
  positron: {
    name: "Daylight Command",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    maxZoom: 19,
    attribution: "© CartoDB Positron / Daylight Command"
  },
  topo: {
    name: "Topography",
    url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "© Google Terrain / Topo"
  }
};

// Tactical Border Coordinates (International Border & Line of Control approximate axis)
const BORDER_COORDS: [number, number][] = [
  [27.6, 72.5],
  [28.2, 72.8],
  [29.0, 73.2],
  [29.8, 73.6],
  [30.4, 73.9],
  [30.9, 74.2],
  [31.4, 74.5],
  [31.7, 74.6],
  [32.2, 74.8],
  [32.6, 74.5],
  [33.1, 74.3],
  [33.8, 74.2]
];

// Civil Airway Corridors
const CIVIL_AIRWAYS: { id: string; name: string; fl: string; coords: [number, number][] }[] = [
  {
    id: "J121",
    name: "J121 (VIDP -> EGLL)",
    fl: "FL380",
    coords: [
      [28.6, 77.1],
      [30.2, 76.4],
      [31.4, 75.6],
      [32.5, 74.6]
    ]
  },
  {
    id: "W20",
    name: "W20 (VISR -> VIDP)",
    fl: "FL340",
    coords: [
      [33.8, 74.8],
      [32.2, 75.3],
      [30.6, 76.6],
      [28.6, 77.1]
    ]
  }
];

export const TacticalMap: React.FC<TacticalMapProps> = ({
  aircraft,
  airbases,
  threats,
  missions,
  weather = [],
  hostileUavs = [],
  selectedAircraftId,
  onSelectAircraft,
  onInjectThreat,
  onAuthorizeCOA,
  onOpenCockpit
}) => {
  // Map Container & Instance Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);

  // Layer Groups
  const radarSweepLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const corridorsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const weatherLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const threatLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const airbaseLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const trajectoryLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const missionsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const aircraftLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const measureLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // UI State: Default to Satellite or Dark for maximum visual impact
  const [activeBasemap, setActiveBasemap] = useState<"dark" | "satellite" | "positron" | "topo">("dark");
  const [showAirways, setShowAirways] = useState<boolean>(true);
  const [showThreatRings, setShowThreatRings] = useState<boolean>(true);
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [showRadarSweep, setShowRadarSweep] = useState<boolean>(true);

  // Interactive Tools
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [isSpawnThreatMode, setIsSpawnThreatMode] = useState<boolean>(false);
  const [followAircraftId, setFollowAircraftId] = useState<string | null>(null);

  // Measurement Tool State
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [measureResult, setMeasureResult] = useState<{
    km: number;
    nm: number;
    azimuthDeg: number;
    supersonicMin: number;
  } | null>(null);

  // Cursor Coordinates
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);

  // Inspected Object State
  const [inspectedAircraft, setInspectedAircraft] = useState<Aircraft | null>(null);
  const [inspectedThreat, setInspectedThreat] = useState<SAMThreat | null>(null);
  const [inspectedAirbase, setInspectedAirbase] = useState<Airbase | null>(null);
  const [inspectedWeather, setInspectedWeather] = useState<WeatherCell | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Initialize Leaflet Map with Smooth Inertia & Auto-Resize
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: THEATRE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: 5,
      maxZoom: 18,
      preferCanvas: true
    });

    // Add Base Tile
    const initialTile = L.tileLayer(TILE_LAYERS[activeBasemap].url, {
      subdomains: TILE_LAYERS[activeBasemap].subdomains,
      maxZoom: TILE_LAYERS[activeBasemap].maxZoom
    }).addTo(map);
    baseTileRef.current = initialTile;

    // Attach Layer Groups
    corridorsLayerRef.current.addTo(map);
    radarSweepLayerRef.current.addTo(map);
    weatherLayerRef.current.addTo(map);
    threatLayerRef.current.addTo(map);
    airbaseLayerRef.current.addTo(map);
    trajectoryLayerRef.current.addTo(map);
    missionsLayerRef.current.addTo(map);
    aircraftLayerRef.current.addTo(map);
    measureLayerRef.current.addTo(map);

    // Event Listeners
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: Number(e.latlng.lat.toFixed(4)),
        lon: Number(e.latlng.lng.toFixed(4))
      });
    });

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    // Invalidate Size after layout calculation to eliminate blank/grey tiles
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

    // ResizeObserver for continuous responsive rendering
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    mapRef.current = map;

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Basemap Switcher
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const config = TILE_LAYERS[activeBasemap];
    if (baseTileRef.current) {
      mapRef.current.removeLayer(baseTileRef.current);
    }
    const newTile = L.tileLayer(config.url, {
      subdomains: config.subdomains,
      maxZoom: config.maxZoom
    }).addTo(mapRef.current);
    newTile.bringToBack();
    baseTileRef.current = newTile;
  }, [activeBasemap]);

  // ---------------------------------------------------------------------------
  // 3. Follow Aircraft Camera Mode
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!followAircraftId || !mapRef.current) return;
    const target = aircraft.find((a) => a.id === followAircraftId);
    if (target) {
      mapRef.current.panTo([target.lat, target.lon], { animate: true, duration: 0.4 });
    }
  }, [aircraft, followAircraftId]);

  // ---------------------------------------------------------------------------
  // 4. Render Phased Array Radar Range Rings & Central Sweep
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = radarSweepLayerRef.current;
    layer.clearLayers();

    if (!showRadarSweep) return;

    // Central Sector Radar Hub (Halwara AFS)
    const hubCenter: [number, number] = [30.749, 75.633];
    const rangeKmSteps = [50, 100, 150, 200, 250];

    rangeKmSteps.forEach((km) => {
      L.circle(hubCenter, {
        radius: km * 1000,
        color: activeBasemap === "dark" ? "#06B6D4" : "#000080",
        weight: 1,
        opacity: 0.25,
        dashArray: "3, 6",
        fill: false
      }).addTo(layer);
    });
  }, [showRadarSweep, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 5. Render Tactical Borders & Airways
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = corridorsLayerRef.current;
    layer.clearLayers();

    // 10 NM Tactical Border Buffer
    L.polyline(BORDER_COORDS, {
      color: "#FB7185",
      weight: 18,
      opacity: activeBasemap === "dark" ? 0.18 : 0.12,
      lineCap: "round"
    }).addTo(layer);

    // International Border / LoC Demarcation Axis
    L.polyline(BORDER_COORDS, {
      color: "#E11D48",
      weight: 2.5,
      dashArray: "8, 6, 2, 6",
      opacity: 0.9
    }).bindTooltip("INTERNATIONAL BORDER / LOC AXIS [10 NM BUFFER]", {
      permanent: false,
      direction: "top",
      className: "tactical-tooltip"
    }).addTo(layer);

    // Civil Airways
    if (showAirways) {
      CIVIL_AIRWAYS.forEach((airway) => {
        L.polyline(airway.coords, {
          color: activeBasemap === "dark" ? "#38BDF8" : "#0284C7",
          weight: 2,
          dashArray: "6, 6",
          opacity: 0.7
        }).bindTooltip(`${airway.name} | ${airway.fl}`, {
          permanent: false,
          direction: "center",
          className: "tactical-tooltip"
        }).addTo(layer);
      });
    }
  }, [showAirways, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 6. Render SAM Threat Batteries & Lethal Envelopes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = threatLayerRef.current;
    layer.clearLayers();

    if (!showThreatRings) return;

    threats.forEach((sam) => {
      const center: [number, number] = [sam.lat, sam.lon];
      const lethalMeters = sam.lethal_range_km * 1000;
      const radarMeters = (sam.radar_range_km || sam.lethal_range_km * 1.8) * 1000;
      const bufferMeters = ((sam.buffer_km || 15) + sam.lethal_range_km) * 1000;

      // 1. Radar Surveillance Dome
      L.circle(center, {
        radius: radarMeters,
        color: "#DC2626",
        weight: 1,
        dashArray: "3, 6",
        fillColor: "#DC2626",
        fillOpacity: 0.04
      }).addTo(layer);

      // 2. Stand-off Safe Clearance Buffer Ring
      L.circle(center, {
        radius: bufferMeters,
        color: "#138808",
        weight: 1.5,
        dashArray: "4, 4",
        fill: false
      }).addTo(layer);

      // 3. Lethal Engagement Bubble
      L.circle(center, {
        radius: lethalMeters,
        color: "#DC2626",
        weight: 2.2,
        dashArray: "6, 4",
        fillColor: "#DC2626",
        fillOpacity: activeBasemap === "dark" ? 0.28 : 0.16
      }).bindTooltip(`⚠️ ${sam.name} [${sam.lethal_range_km} KM LETHAL]`, {
        permanent: false,
        direction: "top",
        className: "tactical-tooltip"
      }).addTo(layer);

      // 4. Custom SAM Battery Center Icon
      const samIcon = L.divIcon({
        className: "sam-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 32px; height: 32px;">
            <div class="absolute w-8 h-8 bg-red-600/30 rounded-full animate-ping"></div>
            <div class="w-6 h-6 rotate-45 bg-[#DC2626] border-2 border-white shadow-lg flex items-center justify-center">
              <span class="text-[9px] font-black text-white -rotate-45 font-mono">SAM</span>
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-red-300 px-1.5 py-0.5 rounded shadow text-[9px] font-mono font-bold border border-red-500/50">
              ${sam.name.split(" ")[0]}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(center, { icon: samIcon }).addTo(layer);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setInspectedThreat(sam);
      });
    });

    // Render active hostile UAV swarm bogeys if present
    hostileUavs.forEach((uav) => {
      if (uav.neutralized) return;
      const uavIcon = L.divIcon({
        className: "uav-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 28px; height: 28px;">
            <div class="absolute w-7 h-7 bg-orange-600/40 rounded-full animate-ping"></div>
            <div class="w-5 h-5 rounded-full bg-red-600 border border-white flex items-center justify-center shadow">
              <span class="text-[8px] font-black text-white font-mono">UAV</span>
            </div>
            <div class="absolute -bottom-4 whitespace-nowrap bg-black/90 text-amber-300 px-1 py-0.2 rounded text-[8px] font-mono font-bold">
              ${uav.name.split(" ")[0]} (${uav.alt_ft}ft)
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker([uav.lat, uav.lon], { icon: uavIcon })
        .bindTooltip(`⚠️ HOSTILE BOGEY: ${uav.name} | SPEED: ${uav.speed_kts}kt | ALT: ${uav.alt_ft}ft`, {
          direction: "top",
          className: "tactical-tooltip"
        })
        .addTo(layer);
    });
  }, [threats, hostileUavs, showThreatRings, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 7. Render Convective Weather Cells & Doppler Reflectivity
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = weatherLayerRef.current;
    layer.clearLayers();

    if (!showWeather) return;

    weather.forEach((wx) => {
      const center: [number, number] = [wx.lat, wx.lon];
      const radiusMeters = wx.radius_km * 1000;
      const isSevere = wx.severity === "SEVERE_NO_FLY";

      // Outer Reflectivity Band
      L.circle(center, {
        radius: radiusMeters,
        color: isSevere ? "#D946EF" : "#38BDF8",
        weight: 1.8,
        dashArray: isSevere ? "4, 3" : "6, 4",
        fillColor: isSevere ? "#C026D3" : "#0284C7",
        fillOpacity: activeBasemap === "dark" ? 0.32 : 0.16
      }).addTo(layer);

      // Inner Core Reflectivity (Extreme Hail/Turbulence)
      if (isSevere) {
        L.circle(center, {
          radius: radiusMeters * 0.45,
          color: "#A21CAF",
          weight: 1.2,
          fillColor: "#DC2626",
          fillOpacity: 0.45
        }).addTo(layer);
      }

      // Center Weather Marker Icon
      const wxIcon = L.divIcon({
        className: "weather-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 32px; height: 32px;">
            <div class="w-7 h-7 rounded-full ${isSevere ? "bg-fuchsia-700" : "bg-sky-600"} border-2 border-white shadow-lg flex items-center justify-center text-white text-xs">
              ${isSevere ? "⚡" : "🌧"}
            </div>
            <div class="absolute -bottom-6 whitespace-nowrap bg-slate-900/90 text-fuchsia-300 px-1.5 py-0.5 rounded shadow text-[8.5px] font-mono font-bold border border-fuchsia-400/50">
              ${isSevere ? `CB CELL ${wx.reflectivity_dbz}dBZ` : `RAIN ${wx.reflectivity_dbz}dBZ`}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(center, { icon: wxIcon }).addTo(layer);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setInspectedWeather(wx);
      });
    });
  }, [weather, showWeather, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 8. Render Airbases & Runways
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = airbaseLayerRef.current;
    layer.clearLayers();

    airbases.forEach((base) => {
      const center: [number, number] = [base.lat, base.lon];
      const isAmbala = base.code === "AMB";
      const headingDeg = isAmbala ? 120 : 140;

      const baseIcon = L.divIcon({
        className: "airbase-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 40px; height: 40px;">
            <!-- Runway Strip -->
            <div class="absolute w-10 h-2 bg-slate-800 border border-slate-300 rounded shadow-sm" style="transform: rotate(${headingDeg}deg)">
              <div class="w-full h-px border-t border-dashed border-white mt-0.5 opacity-80"></div>
            </div>
            <!-- Center Tower Icon -->
            <div class="relative z-10 w-6 h-6 rounded-full bg-[#000080] border-2 border-white shadow-lg flex items-center justify-center">
              <span class="text-[8.5px] font-black text-white font-mono">${base.code}</span>
            </div>
            <!-- Station Label -->
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-slate-200 px-1.5 py-0.5 rounded shadow text-[9px] font-mono font-bold border border-slate-700">
              AFS ${base.code}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker(center, { icon: baseIcon }).addTo(layer);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setInspectedAirbase(base);
      });
    });
  }, [airbases]);

  // ---------------------------------------------------------------------------
  // 9. Render Trajectories & Intercept Flightpaths
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = trajectoryLayerRef.current;
    layer.clearLayers();

    if (!showTrajectories) return;

    aircraft.forEach((ac) => {
      if (!ac.waypoints || ac.waypoints.length < 2) return;

      const pathCoords: [number, number][] = ac.waypoints.map((wp) => [wp.lat, wp.lon]);
      const isEvading = ac.status.includes("EVAD") || ac.status.includes("DECONFLICT");
      const isScramble = ac.status.includes("SCRAMBL") || ac.status.includes("INTERCEPT");

      const lineColor = isEvading ? "#138808" : isScramble ? "#FF9933" : activeBasemap === "dark" ? "#06B6D4" : "#000080";

      // Draw Flightpath Polyline
      L.polyline(pathCoords, {
        color: lineColor,
        weight: 3,
        dashArray: isScramble ? "6, 4" : "none",
        opacity: 0.9
      }).addTo(layer);

      // Draw Waypoint Dots
      ac.waypoints.forEach((wp, wIdx) => {
        L.circleMarker([wp.lat, wp.lon], {
          radius: 4,
          color: lineColor,
          weight: 2,
          fillColor: "#FFFFFF",
          fillOpacity: 1
        }).bindTooltip(`${wp.name || `WP-${wIdx + 1}`} (${ac.callsign})`, {
          permanent: false,
          direction: "top",
          className: "tactical-tooltip"
        }).addTo(layer);
      });
    });
  }, [aircraft, showTrajectories, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 10. Render Pending Mission Objectives
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = missionsLayerRef.current;
    layer.clearLayers();

    missions.forEach((m) => {
      const center: [number, number] = [m.target_lat, m.target_lon];

      const missionIcon = L.divIcon({
        className: "mission-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 34px; height: 34px;">
            <div class="absolute w-8 h-8 rounded-full border-2 border-dashed border-[#EA580C] animate-spin" style="animation-duration: 8s;"></div>
            <div class="w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-bold">
              🎯
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-amber-300 px-1.5 py-0.5 rounded shadow text-[8.5px] font-mono font-bold border border-amber-500/50">
              TARGET: ${m.name.slice(0, 16)}
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      L.marker(center, { icon: missionIcon })
        .bindTooltip(`🎯 ${m.name} | Role: ${m.required_role} | Pri: ${m.priority_score}`, {
          permanent: false,
          direction: "top",
          className: "tactical-tooltip"
        })
        .addTo(layer);
    });
  }, [missions]);

  // ---------------------------------------------------------------------------
  // 11. Render Live Aircraft Glyphs & Velocity Vectors
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const layer = aircraftLayerRef.current;
    layer.clearLayers();

    aircraft.forEach((ac) => {
      const isSelected = selectedAircraftId === ac.id;
      const isEvading = ac.status.includes("EVAD");
      const isScramble = ac.status.includes("SCRAMBL") || ac.status.includes("INTERCEPT");

      let jetColor = activeBasemap === "dark" ? "#06B6D4" : "#000080";
      if (isEvading) jetColor = "#DC2626";
      else if (isScramble) jetColor = "#FF9933";

      const altitudeTag = ac.alt_ft > 0 ? `FL${Math.round(ac.alt_ft / 100)}` : "GND";

      // 60-Second Forward Velocity Leader Vector
      const speedKmS = (ac.speed_kts * 1.852) / 3600;
      const leaderKm = speedKmS * 60; // 60s ahead
      const hdgRad = (ac.heading_deg * Math.PI) / 180;
      const leaderLat = ac.lat + (leaderKm / 111.132) * Math.cos(hdgRad);
      const leaderLon = ac.lon + (leaderKm / (111.32 * Math.cos((ac.lat * Math.PI) / 180))) * Math.sin(hdgRad);

      if (ac.speed_kts > 0) {
        L.polyline([[ac.lat, ac.lon], [leaderLat, leaderLon]], {
          color: jetColor,
          weight: 1.8,
          dashArray: "3, 3",
          opacity: 0.8
        }).addTo(layer);
      }

      // Custom Oriented SVG Fighter Jet DivIcon
      const planeIcon = L.divIcon({
        className: "aircraft-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer select-none" style="width: 46px; height: 46px;">
            ${
              isSelected
                ? `<div class="absolute w-11 h-11 rounded-full border-2 border-dashed border-[#06B6D4] animate-spin" style="animation-duration: 3s;"></div>`
                : ""
            }
            ${
              isScramble
                ? `<div class="absolute w-12 h-12 bg-amber-500/20 rounded-full animate-ping"></div>`
                : ""
            }
            <!-- Rotated Fighter Jet Airframe -->
            <div style="transform: rotate(${ac.heading_deg}deg); transition: transform 0.4s ease-out;">
              <svg width="30" height="30" viewBox="-15 -15 30 30" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                <!-- Silhouette -->
                <path
                  d="M 0 -13 L 9 5 L 3 5 L 0 9 L -3 5 L -9 5 Z"
                  fill="${jetColor}"
                  stroke="#FFFFFF"
                  stroke-width="1.8"
                />
                <!-- Afterburner Plume when Scrambling -->
                ${
                  isScramble
                    ? `<polygon points="0,9 -2,14 0,16 2,14" fill="#FF9933" />`
                    : ""
                }
                <!-- Cockpit Canopy Dot -->
                <circle cx="0" cy="-3" r="1.5" fill="#FFFFFF" />
              </svg>
            </div>
            <!-- Tactical Airframe Tag -->
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-white px-1.5 py-0.5 rounded shadow text-[9px] font-mono font-bold border ${
              isSelected ? "border-[#06B6D4] text-[#06B6D4] ring-1 ring-[#06B6D4]" : "border-slate-700"
            }">
              <span class="text-[8px] text-slate-400">${altitudeTag}</span> ${ac.callsign.split(" ")[0]}
            </div>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });

      const marker = L.marker([ac.lat, ac.lon], { icon: planeIcon }).addTo(layer);

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectAircraft) onSelectAircraft(ac);
        setInspectedAircraft(ac);
      });
    });
  }, [aircraft, selectedAircraftId, onSelectAircraft, activeBasemap]);

  // ---------------------------------------------------------------------------
  // 12. Interactive Threat Spawn Mode on Map Click
  // ---------------------------------------------------------------------------
  const handleMapClickForSpawnThreat = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!isSpawnThreatMode || !onInjectThreat) return;

      const lat = Number(e.latlng.lat.toFixed(4));
      const lon = Number(e.latlng.lng.toFixed(4));

      onInjectThreat({
        id: `SAM-POPUP-${Date.now().toString().slice(-4)}`,
        name: `Mobile S-400 Ambush (${lat}°N)`,
        type: "SAM_LONG_RANGE",
        lat: lat,
        lon: lon,
        radius_km: 75.0,
        radar_range_km: 180.0,
        threat_level: "CRITICAL_LETHAL"
      });

      setIsSpawnThreatMode(false);
    },
    [isSpawnThreatMode, onInjectThreat]
  );

  // ---------------------------------------------------------------------------
  // 13. Interactive Distance Measurement Tool Logic
  // ---------------------------------------------------------------------------
  const handleMapClickForMeasure = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!isMeasuring) return;

      const newPoint = e.latlng;
      if (measurePoints.length === 0) {
        setMeasurePoints([newPoint]);
        setMeasureResult(null);
      } else if (measurePoints.length === 1) {
        const p1 = measurePoints[0];
        const p2 = newPoint;
        setMeasurePoints([p1, p2]);

        // Compute Great Circle Distance
        const distMeters = p1.distanceTo(p2);
        const km = Math.round(distMeters / 1000);
        const nm = Math.round((distMeters / 1000) * 0.539957);
        const supersonicMin = Math.round((km / (540 * 1.852)) * 60 * 10) / 10;

        // Compute Bearing
        const lat1 = (p1.lat * Math.PI) / 180;
        const lat2 = (p2.lat * Math.PI) / 180;
        const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.cos(lat1) * Math.cos(dLon);
        const bearing = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);

        setMeasureResult({ km, nm, azimuthDeg: bearing, supersonicMin });
      } else {
        // Reset and start new measurement
        setMeasurePoints([newPoint]);
        setMeasureResult(null);
      }
    },
    [isMeasuring, measurePoints]
  );

  // Bind/Unbind Map Click Handlers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (isSpawnThreatMode) {
      map.on("click", handleMapClickForSpawnThreat);
      L.DomUtil.addClass(map.getContainer(), "cursor-crosshair");
    } else if (isMeasuring) {
      map.on("click", handleMapClickForMeasure);
      L.DomUtil.addClass(map.getContainer(), "cursor-crosshair");
    } else {
      map.off("click", handleMapClickForSpawnThreat);
      map.off("click", handleMapClickForMeasure);
      L.DomUtil.removeClass(map.getContainer(), "cursor-crosshair");
      measureLayerRef.current.clearLayers();
    }

    return () => {
      map.off("click", handleMapClickForSpawnThreat);
      map.off("click", handleMapClickForMeasure);
    };
  }, [isSpawnThreatMode, isMeasuring, handleMapClickForSpawnThreat, handleMapClickForMeasure]);

  // Render Measurement Visuals
  useEffect(() => {
    const layer = measureLayerRef.current;
    layer.clearLayers();

    if (!isMeasuring || measurePoints.length === 0) return;

    // Point A
    L.circleMarker(measurePoints[0], {
      radius: 6,
      color: "#FF9933",
      fillColor: "#000080",
      fillOpacity: 1,
      weight: 2
    }).addTo(layer);

    if (measurePoints.length === 2) {
      // Point B
      L.circleMarker(measurePoints[1], {
        radius: 6,
        color: "#DC2626",
        fillColor: "#FFFFFF",
        fillOpacity: 1,
        weight: 2
      }).addTo(layer);

      // Connection Line
      L.polyline(measurePoints, {
        color: "#06B6D4",
        weight: 3,
        dashArray: "6, 4"
      }).addTo(layer);
    }
  }, [isMeasuring, measurePoints]);

  // ---------------------------------------------------------------------------
  // 14. Viewport Controls
  // ---------------------------------------------------------------------------
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetSector = () => {
    setFollowAircraftId(null);
    mapRef.current?.setView(THEATRE_CENTER, DEFAULT_ZOOM, { animate: true });
    setMeasurePoints([]);
    setMeasureResult(null);
    setIsMeasuring(false);
    setIsSpawnThreatMode(false);
  };

  const handleCenterOnAircraft = (ac: Aircraft) => {
    mapRef.current?.setView([ac.lat, ac.lon], Math.max(9, currentZoom), { animate: true });
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 rounded-lg border border-slate-700 shadow-xl overflow-hidden select-none">
      {/* 1. Tactical Command Bar (C2 Header) */}
      <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20 flex-wrap gap-2 text-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 font-sans flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>COP: AIR OPERATIONS COMMAND</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            NORTHERN & WESTERN SECTOR
          </span>
        </div>

        {/* Tactical Controls & Basemap Switcher */}
        <div className="flex items-center space-x-1 text-[10px] font-mono flex-wrap">
          {/* Basemap Switcher */}
          <div className="flex rounded border border-slate-700 bg-slate-800 p-0.5 mr-1">
            <button
              onClick={() => setActiveBasemap("dark")}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                activeBasemap === "dark" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              🌙 CYBER IACCS
            </button>
            <button
              onClick={() => setActiveBasemap("satellite")}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                activeBasemap === "satellite" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              🛰️ SATELLITE
            </button>
            <button
              onClick={() => setActiveBasemap("positron")}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                activeBasemap === "positron" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              ☀️ DAYLIGHT
            </button>
            <button
              onClick={() => setActiveBasemap("topo")}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                activeBasemap === "topo" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              🏔️ TOPO
            </button>
          </div>

          {/* Interactive Threat Spawner Button */}
          {onInjectThreat && (
            <button
              onClick={() => {
                setIsSpawnThreatMode(!isSpawnThreatMode);
                setIsMeasuring(false);
              }}
              title="Click anywhere on the map to inject a pop-up SAM threat"
              className={`px-2 py-1 rounded font-bold border transition-colors flex items-center space-x-1 ${
                isSpawnThreatMode
                  ? "bg-red-600 text-white border-red-500 animate-pulse"
                  : "bg-red-950/60 text-red-300 border-red-800 hover:bg-red-900/80"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>{isSpawnThreatMode ? "CLICK MAP TO SPAWN" : "+ SPAWN THREAT"}</span>
            </button>
          )}

          {/* Layer Toggles */}
          <button
            onClick={() => setShowRadarSweep(!showRadarSweep)}
            title="Toggle Phased Array Radar Rings"
            className={`px-2 py-1 rounded font-bold border transition-colors ${
              showRadarSweep ? "bg-cyan-950 text-cyan-300 border-cyan-700" : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            RADAR
          </button>

          <button
            onClick={() => setShowAirways(!showAirways)}
            title="Toggle Civil Airways"
            className={`px-2 py-1 rounded font-bold border transition-colors ${
              showAirways ? "bg-sky-950 text-sky-300 border-sky-700" : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            AIRWAYS
          </button>

          <button
            onClick={() => setShowThreatRings(!showThreatRings)}
            title="Toggle SAM Lethal Rings"
            className={`px-2 py-1 rounded font-bold border transition-colors ${
              showThreatRings ? "bg-red-950 text-red-300 border-red-700" : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            SAM RINGS
          </button>

          <button
            onClick={() => setShowWeather(!showWeather)}
            title="Toggle Convective Storm Cells"
            className={`px-2 py-1 rounded font-bold border transition-colors flex items-center space-x-1 ${
              showWeather ? "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-700" : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            <CloudLightning className="w-3 h-3 text-fuchsia-400" />
            <span>WEATHER</span>
          </button>

          <button
            onClick={() => setShowTrajectories(!showTrajectories)}
            title="Toggle Flight Trajectories"
            className={`px-2 py-1 rounded font-bold border transition-colors ${
              showTrajectories ? "bg-emerald-950 text-emerald-300 border-emerald-700" : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            VECTORS
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Measure Tool Button */}
          <button
            onClick={() => {
              setIsMeasuring(!isMeasuring);
              setIsSpawnThreatMode(false);
              setMeasurePoints([]);
              setMeasureResult(null);
            }}
            title="Measure Geodesic Distance"
            className={`px-2 py-1 rounded font-bold border transition-colors flex items-center space-x-1 ${
              isMeasuring ? "bg-cyan-600 text-white border-cyan-500" : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            <Ruler className="w-3 h-3" />
            <span>{isMeasuring ? "MEASURING..." : "RULER"}</span>
          </button>

          {/* Zoom Buttons */}
          <button
            onClick={handleZoomIn}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetSector}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Reset Sector View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Leaflet Map Surface */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden bg-slate-950">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Dynamic Threat Spawn Float Guide */}
        {isSpawnThreatMode && (
          <div className="absolute top-4 left-4 z-[1000] p-3 rounded-lg bg-red-950/95 border-2 border-red-500 shadow-2xl font-mono text-xs text-white backdrop-blur-md max-w-sm animate-pulse">
            <div className="flex items-center space-x-2 text-red-300 font-bold mb-1">
              <Crosshair className="w-4 h-4 text-red-400" />
              <span>RADAR TARGETING RETICLE ACTIVE</span>
            </div>
            <p className="text-slate-200 text-[11px]">
              Click anywhere on the map to deploy an unexpected pop-up SAM battery and trigger real-time MILP re-optimization!
            </p>
          </div>
        )}

        {/* Active Measurement Float Notification */}
        {isMeasuring && (
          <div className="absolute top-4 left-4 z-[1000] p-3 rounded-lg bg-slate-900/95 border border-cyan-500 shadow-2xl font-mono text-xs text-white backdrop-blur-md max-w-sm">
            <div className="flex items-center justify-between font-bold border-b border-slate-700 pb-1 mb-1.5 text-cyan-400">
              <span className="flex items-center space-x-1.5">
                <Ruler className="w-3.5 h-3.5" />
                <span>GEODESIC DISTANCE RULER</span>
              </span>
              <button
                onClick={() => {
                  setIsMeasuring(false);
                  setMeasurePoints([]);
                  setMeasureResult(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {measurePoints.length === 0 && <p className="text-slate-400">Click anywhere on the map to place Point A.</p>}
            {measurePoints.length === 1 && (
              <p className="text-amber-400 font-semibold">Point A placed. Click second point to compute range.</p>
            )}
            {measureResult && (
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Range:</span>
                  <span className="font-bold text-white">{measureResult.km} km ({measureResult.nm} NM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">True Bearing:</span>
                  <span className="font-bold text-cyan-400">{measureResult.azimuthDeg}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Intercept Time @ 540kt:</span>
                  <span className="font-bold text-emerald-400">{measureResult.supersonicMin} mins</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Live Floating Inspector HUD (Aircraft / Threat / Airbase / Weather) */}
        {inspectedAircraft && (
          <div className="absolute bottom-5 left-5 z-[1000] w-84 bg-slate-900/95 rounded-xl border border-cyan-500/70 shadow-2xl p-4 font-sans backdrop-blur-md text-white">
            <div className="flex items-start justify-between border-b border-slate-700 pb-2">
              <div>
                <span className="font-black text-sm text-cyan-300 block">{inspectedAircraft.callsign}</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">{inspectedAircraft.aircraft_type}</span>
              </div>
              <button onClick={() => setInspectedAircraft(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-[9px] text-slate-400 block uppercase">Pilot / Duty</span>
                <span className="font-semibold text-white truncate block">{inspectedAircraft.pilot}</span>
                <span className="text-[9px] text-emerald-400 block mt-0.5">
                  FDL: {inspectedAircraft.fdl_hours_elapsed}h / {inspectedAircraft.fdl_hours_limit}h
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-[9px] text-slate-400 block uppercase">Kinematics</span>
                <span className="font-semibold text-white">
                  {inspectedAircraft.alt_ft > 0 ? `FL${Math.round(inspectedAircraft.alt_ft / 100)}` : "GND"} | {inspectedAircraft.speed_kts}kt
                </span>
                <span className="text-[9px] text-cyan-300 block mt-0.5">
                  Mach {inspectedAircraft.mach || 0.85} | {inspectedAircraft.heading_deg}°
                </span>
              </div>
            </div>

            <div className="mt-2 bg-slate-800/80 p-2 rounded border border-slate-700 text-[11px] font-mono flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Fuel className="w-3.5 h-3.5 text-cyan-400" />
                <span>Fuel: {inspectedAircraft.fuel_kg} kg</span>
              </div>
              <span className="text-[10px] text-slate-400">Bingo: {inspectedAircraft.bingo_fuel_kg} kg</span>
            </div>

            {/* Munitions Loadout */}
            <div className="mt-2">
              <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block mb-1">Loadout</span>
              <div className="flex flex-wrap gap-1">
                {(inspectedAircraft.payload || []).map((p, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[9px] font-mono border border-slate-700 font-semibold">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Tactical Action Bar */}
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setFollowAircraftId((prev) => (prev === inspectedAircraft.id ? null : inspectedAircraft.id));
                }}
                className={`px-2 py-1 rounded font-mono text-[9.5px] font-bold border transition-colors flex items-center space-x-1 ${
                  followAircraftId === inspectedAircraft.id
                    ? "bg-cyan-500 text-black border-cyan-400"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{followAircraftId === inspectedAircraft.id ? "TRACKING" : "TRACK CAM"}</span>
              </button>

              {onAuthorizeCOA && (
                <button
                  onClick={() => onAuthorizeCOA("COA-1")}
                  className="px-2.5 py-1 rounded bg-[#FF9933] hover:bg-amber-600 text-slate-950 font-mono text-[10px] font-black flex items-center space-x-1 shadow"
                >
                  <Zap className="w-3 h-3" />
                  <span>SCRAMBLE QRA</span>
                </button>
              )}

              {onOpenCockpit && (
                <button
                  onClick={() => onOpenCockpit(inspectedAircraft.id)}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-black text-emerald-400 font-mono text-[10px] font-bold flex items-center space-x-1 border border-emerald-500/50 shadow"
                  title="Open Cockpit HUD"
                >
                  <Crosshair className="w-3 h-3 text-emerald-400" />
                  <span>HUD</span>
                </button>
              )}

              <button
                onClick={() => handleCenterOnAircraft(inspectedAircraft)}
                className="px-2.5 py-1 rounded bg-[#000080] hover:bg-blue-900 text-white font-mono text-[10px] font-bold flex items-center space-x-1"
              >
                <Crosshair className="w-3 h-3" />
                <span>CENTER</span>
              </button>
            </div>
          </div>
        )}

        {/* Inspected Threat HUD */}
        {inspectedThreat && (
          <div className="absolute bottom-5 left-5 z-[1000] w-84 bg-slate-900/95 rounded-xl border border-red-500 shadow-2xl p-4 font-sans backdrop-blur-md text-white">
            <div className="flex items-start justify-between border-b border-red-800 pb-2">
              <div>
                <span className="font-black text-sm text-red-400 block">⚠️ {inspectedThreat.name}</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">{inspectedThreat.type}</span>
              </div>
              <button onClick={() => setInspectedThreat(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-red-950/60 p-2 rounded border border-red-800">
                <span className="text-[9px] text-red-400 uppercase block">Lethal Range</span>
                <span className="font-black text-red-300 text-sm">{inspectedThreat.lethal_range_km} km</span>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-[9px] text-slate-400 uppercase block">Radar Range</span>
                <span className="font-black text-white text-sm">{inspectedThreat.radar_range_km} km</span>
              </div>
            </div>

            <div className="mt-2 p-2 bg-slate-800/80 rounded border border-slate-700 text-[10.5px] font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Emitter:</span>
                <span className="font-semibold text-white">{inspectedThreat.threat_emitter_signature || "TYPE-305A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Safe Floor:</span>
                <span className="font-bold text-emerald-400">{inspectedThreat.min_safe_alt_ft || 40000} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-red-400">{inspectedThreat.status}</span>
              </div>
            </div>

            {onAuthorizeCOA && (
              <div className="mt-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => onAuthorizeCOA("COA-1")}
                  className="w-full py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-mono text-[10.5px] font-black flex items-center justify-center space-x-1.5 shadow"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>DISPATCH SEAD ESCORT (AUTHORIZE COA-1)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inspected Airbase HUD */}
        {inspectedAirbase && (
          <div className="absolute bottom-5 left-5 z-[1000] w-84 bg-slate-900/95 rounded-xl border border-cyan-500 shadow-2xl p-4 font-sans backdrop-blur-md text-white">
            <div className="flex items-start justify-between border-b border-slate-700 pb-2">
              <div>
                <span className="font-black text-sm text-cyan-300 block">{inspectedAirbase.name}</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">{inspectedAirbase.squadron}</span>
              </div>
              <button onClick={() => setInspectedAirbase(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-[8px] text-slate-400 block uppercase">Runway</span>
                <span className="font-bold text-white">{inspectedAirbase.runway_heading}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-[8px] text-slate-400 block uppercase">Alert</span>
                <span className="font-bold text-emerald-400">{inspectedAirbase.qra_status}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-[8px] text-slate-400 block uppercase">ATF Depot</span>
                <span className="font-bold text-white">{inspectedAirbase.fuel_atf_tons} T</span>
              </div>
            </div>

            <div className="mt-2 p-2 bg-slate-800/80 rounded border border-slate-700">
              <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block mb-1">Munitions Stock</span>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                {Object.entries(inspectedAirbase.munitions_stock || {}).map(([weapon, qty]) => (
                  <div key={weapon} className="flex justify-between border-b border-slate-700/50 pb-0.5">
                    <span className="text-slate-400 truncate">{weapon}:</span>
                    <span className="font-bold text-cyan-300 ml-1">{qty}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inspected Weather HUD */}
        {inspectedWeather && (
          <div className="absolute bottom-5 left-5 z-[1000] w-84 bg-slate-900/95 rounded-xl border border-fuchsia-500 shadow-2xl p-4 font-sans backdrop-blur-md text-white">
            <div className="flex items-start justify-between border-b border-fuchsia-800 pb-2">
              <div>
                <span className="font-black text-sm text-fuchsia-400 block">⚡ {inspectedWeather.name}</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">{inspectedWeather.type}</span>
              </div>
              <button onClick={() => setInspectedWeather(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-fuchsia-950/60 p-2 rounded border border-fuchsia-800">
                <span className="text-[9px] text-fuchsia-400 uppercase block">Reflectivity</span>
                <span className="font-black text-fuchsia-300 text-sm">{inspectedWeather.reflectivity_dbz} dBZ</span>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-[9px] text-slate-400 uppercase block">Cloud Top</span>
                <span className="font-black text-white text-sm">FL{Math.round(inspectedWeather.cloud_top_ft / 100)}</span>
              </div>
            </div>

            <div className="mt-2 p-2 bg-slate-800/80 rounded border border-slate-700 text-[10.5px] font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Icing / Turb:</span>
                <span className="font-bold text-red-400">{inspectedWeather.icing_risk} / {inspectedWeather.turbulence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wind Vector:</span>
                <span className="font-semibold text-white">{inspectedWeather.wind_vector_kts} kt @ {inspectedWeather.wind_heading_deg}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coverage:</span>
                <span className="font-semibold text-white">{inspectedWeather.radius_km} km</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Bottom Tactical Coordinates & Zoom HUD */}
        <div className="absolute bottom-3 right-3 z-[1000] px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 shadow-xl font-mono text-[9.5px] text-slate-300 flex items-center space-x-3 backdrop-blur-md">
          <div>
            <span className="text-slate-500">LAT:</span>{" "}
            <span className="font-bold text-cyan-300">{cursorCoords ? `${cursorCoords.lat}° N` : "--"}</span>
          </div>
          <div>
            <span className="text-slate-500">LON:</span>{" "}
            <span className="font-bold text-cyan-300">{cursorCoords ? `${cursorCoords.lon}° E` : "--"}</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div>
            <span className="text-slate-500">ZOOM:</span>{" "}
            <span className="font-bold text-emerald-400">Z{currentZoom}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
