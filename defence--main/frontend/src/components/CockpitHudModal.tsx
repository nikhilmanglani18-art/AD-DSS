import React, { useState } from "react";
import {
  X,
  Crosshair,
  Fuel,
  Plane,
  Zap,
  Target
} from "lucide-react";
import type { Aircraft, SAMThreat } from "../types";

interface CockpitHudModalProps {
  isOpen: boolean;
  onClose: () => void;
  aircraftList: Aircraft[];
  threats: SAMThreat[];
  initialAircraftId?: string;
  onScramble?: (aircraftId: string) => void;
}

export const CockpitHudModal: React.FC<CockpitHudModalProps> = ({
  isOpen,
  onClose,
  aircraftList,
  threats,
  initialAircraftId,
  onScramble
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialAircraftId || aircraftList[0]?.id || "RAFALE-DELTA"
  );
  const [hudColor, setHudColor] = useState<"green" | "cyan" | "amber">("green");

  if (!isOpen) return null;

  const currentAircraft =
    aircraftList.find((a) => a.id === selectedId) || aircraftList[0];

  if (!currentAircraft) return null;

  const isScramble =
    currentAircraft.status.includes("SCRAMBL") ||
    currentAircraft.status.includes("INTERCEPT");

  // Dynamic values
  const speedKts = currentAircraft.speed_kts || 520;
  const mach = currentAircraft.mach || 0.85;
  const altFt = currentAircraft.alt_ft || 26000;
  const heading = currentAircraft.heading_deg || 315;
  const gLoad = currentAircraft.g_load || 1.2;
  const fuelKg = currentAircraft.fuel_kg || 4200;
  const bingoKg = currentAircraft.bingo_fuel_kg || 1500;
  const fuelPct = Math.round(
    (fuelKg / Math.max(1, currentAircraft.max_fuel_kg || 5000)) * 100
  );

  // HUD Color Palette
  const colorScheme = {
    green: {
      primary: "#22C55E",
      glow: "rgba(34, 197, 94, 0.4)",
      border: "border-emerald-500",
      text: "text-emerald-400",
      bgGlow: "shadow-[0_0_20px_rgba(34,197,94,0.3)]"
    },
    cyan: {
      primary: "#06B6D4",
      glow: "rgba(6, 182, 212, 0.4)",
      border: "border-cyan-500",
      text: "text-cyan-400",
      bgGlow: "shadow-[0_0_20px_rgba(6,182,212,0.3)]"
    },
    amber: {
      primary: "#F59E0B",
      glow: "rgba(245, 158, 11, 0.4)",
      border: "border-amber-500",
      text: "text-amber-400",
      bgGlow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]"
    }
  }[hudColor];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none font-mono">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-950 rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col overflow-hidden text-emerald-400">
        {/* Cockpit Canopy Top Frame */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
              <Crosshair className="w-4 h-4 animate-spin" style={{ animationDuration: "10s" }} />
              <span>HEAD-UP DISPLAY (HUD) // MULTI-FUNCTION COCKPIT MFD</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
              MIL-STD-1787C FLIGHT SYMBOLOGY
            </span>
          </div>

          {/* Airframe Switcher Tabs */}
          <div className="flex items-center space-x-2">
            <div className="flex rounded border border-slate-700 bg-slate-800 p-0.5 text-[10px]">
              {aircraftList.map((ac) => (
                <button
                  key={ac.id}
                  onClick={() => setSelectedId(ac.id)}
                  className={`px-2 py-0.5 rounded font-bold transition-all ${
                    selectedId === ac.id
                      ? "bg-emerald-600 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {ac.callsign.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Phosphor Glow Color Switcher */}
            <div className="flex rounded border border-slate-700 bg-slate-800 p-0.5 text-[10px]">
              <button
                onClick={() => setHudColor("green")}
                className={`px-1.5 py-0.5 rounded font-bold ${hudColor === "green" ? "bg-emerald-500 text-black" : "text-slate-400"}`}
              >
                NVG
              </button>
              <button
                onClick={() => setHudColor("cyan")}
                className={`px-1.5 py-0.5 rounded font-bold ${hudColor === "cyan" ? "bg-cyan-500 text-black" : "text-slate-400"}`}
              >
                CYAN
              </button>
              <button
                onClick={() => setHudColor("amber")}
                className={`px-1.5 py-0.5 rounded font-bold ${hudColor === "amber" ? "bg-amber-500 text-black" : "text-slate-400"}`}
              >
                AMBER
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Master CRT Glass Surface */}
        <div className="relative flex-1 bg-black/90 p-6 flex flex-col justify-between overflow-hidden">
          {/* Subtle CRT Scanline overlay effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
              backgroundSize: "100% 3px, 6px 100%"
            }}
          />

          {/* TOP SECTION: HEADING TAPE */}
          <div className="relative w-full flex flex-col items-center">
            {/* Heading Digital Box */}
            <div
              className={`px-3 py-0.5 border ${colorScheme.border} ${colorScheme.text} font-black text-sm tracking-widest bg-black/60 rounded`}
            >
              HDG {String(heading).padStart(3, "0")}°
            </div>

            {/* Heading Tape Ruler */}
            <div className="w-96 h-8 flex items-end justify-between border-b border-emerald-500/50 mt-1 px-4 text-[10px]">
              {[heading - 20, heading - 10, heading, heading + 10, heading + 20].map((h, i) => {
                const norm = ((h % 360) + 360) % 360;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <span className={h === heading ? "font-bold text-white text-xs" : "text-slate-400"}>
                      {String(norm).padStart(3, "0")}
                    </span>
                    <div className={`w-0.5 ${h === heading ? "h-3 bg-emerald-400" : "h-1.5 bg-slate-600"}`} />
                  </div>
                );
              })}
            </div>

            {/* Steerpoint Caret */}
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-6 border-transparent border-b-emerald-400 -mt-1.5" />
          </div>

          {/* CENTER SECTION: SPEED TAPE, ARTIFICIAL HORIZON, ALTITUDE TAPE */}
          <div className="relative flex-1 flex items-center justify-between px-4 my-2">
            {/* LEFT: AIRSPEED TAPE */}
            <div className="flex flex-col items-start space-y-2">
              <div
                className={`p-2.5 rounded border ${colorScheme.border} bg-black/60 backdrop-blur text-left min-w-[120px]`}
              >
                <span className="text-[9px] uppercase tracking-wider block text-slate-400">AIRSPEED</span>
                <div className="text-2xl font-black tracking-tight text-white">{speedKts} <span className="text-xs font-normal">KTS</span></div>
                <div className="text-xs font-bold text-emerald-400 mt-1">MACH {mach}</div>
                <div className="text-[10px] text-slate-400">CAS: {Math.round(speedKts * 0.96)} KT</div>
                <div className="text-[10px] text-amber-400 mt-1">G-LOAD: {gLoad.toFixed(1)}g (Max 9g)</div>
              </div>

              {/* Angle of Attack (AoA) */}
              <div className="p-2 rounded border border-slate-700 bg-black/40 text-[10px]">
                <div className="text-slate-400">ALPHA (AoA): <span className="font-bold text-white">4.2°</span></div>
                <div className="text-slate-400">BETA (SIDESLIP): <span className="font-bold text-white">0.1°</span></div>
              </div>
            </div>

            {/* CENTER: ARTIFICIAL HORIZON & BVR SHOOT CUE */}
            <div className="relative flex-1 flex flex-col items-center justify-center max-w-md h-72">
              {/* Pitch Ladder Lines */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-80">
                {/* +10 deg pitch */}
                <div className="w-32 flex justify-between items-center -translate-y-16">
                  <div className="w-8 border-t-2 border-emerald-400" />
                  <span className="text-[10px] text-emerald-400">+10</span>
                  <div className="w-8 border-t-2 border-emerald-400" />
                </div>
                {/* +5 deg pitch */}
                <div className="w-24 flex justify-between items-center -translate-y-8">
                  <div className="w-6 border-t border-emerald-400" />
                  <span className="text-[9px] text-emerald-400">+5</span>
                  <div className="w-6 border-t border-emerald-400" />
                </div>
                {/* 0 deg Horizon Line */}
                <div className="w-48 flex items-center justify-between">
                  <div className="w-16 border-t-2 border-emerald-300" />
                  <div className="w-4 h-4 rounded-full border border-emerald-300 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  </div>
                  <div className="w-16 border-t-2 border-emerald-300" />
                </div>
                {/* -5 deg pitch */}
                <div className="w-24 flex justify-between items-center translate-y-8">
                  <div className="w-6 border-t border-dashed border-emerald-500" />
                  <span className="text-[9px] text-emerald-500">-5</span>
                  <div className="w-6 border-t border-dashed border-emerald-500" />
                </div>
                {/* -10 deg pitch */}
                <div className="w-32 flex justify-between items-center translate-y-16">
                  <div className="w-8 border-t-2 border-dashed border-emerald-500" />
                  <span className="text-[10px] text-emerald-500">-10</span>
                  <div className="w-8 border-t-2 border-dashed border-emerald-500" />
                </div>
              </div>

              {/* BVR Target Intercept Reticle */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border border-dashed border-emerald-400 flex items-center justify-center animate-pulse">
                  <div className="w-10 h-10 border-2 border-emerald-300 rotate-45 flex items-center justify-center">
                    <Target className="w-4 h-4 -rotate-45 text-amber-400" />
                  </div>
                </div>

                {/* Shoot Cue Box */}
                <div className="mt-3 px-3 py-1 rounded bg-emerald-950/90 border border-emerald-400 text-center shadow-lg">
                  <span className="text-[10px] font-black uppercase text-emerald-300 block">
                    {isScramble ? "⚠️ SUPERSONIC INTERCEPT ACTIVE" : "ARMED // BVRAAM SHOOT CUE"}
                  </span>
                  <span className="text-[9px] text-slate-300">
                    TARGET CLOSURE: +740 KT | TTI: 00:38
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: ALTITUDE TAPE */}
            <div className="flex flex-col items-end space-y-2">
              <div
                className={`p-2.5 rounded border ${colorScheme.border} bg-black/60 backdrop-blur text-right min-w-[120px]`}
              >
                <span className="text-[9px] uppercase tracking-wider block text-slate-400">BARO ALTITUDE</span>
                <div className="text-2xl font-black tracking-tight text-white">
                  FL{Math.round(altFt / 100)} <span className="text-xs font-normal">({altFt} ft)</span>
                </div>
                <div className="text-xs font-bold text-emerald-400 mt-1">RALT: {Math.max(500, altFt - 900)} FT</div>
                <div className="text-[10px] text-slate-400">VSI: +1,200 FPM</div>
                <div className="text-[10px] text-slate-300 mt-1">BARO: 1013.25 HPA</div>
              </div>

              {/* Flight Duty Time Remaining */}
              <div className="p-2 rounded border border-slate-700 bg-black/40 text-[10px] text-right">
                <div className="text-slate-400">PILOT: <span className="font-bold text-white">{currentAircraft.pilot.split(" ")[0]}</span></div>
                <div className="text-emerald-400 font-bold">
                  FDL REMAIN: {((currentAircraft.fdl_hours_limit || 6) - (currentAircraft.fdl_hours_elapsed || 0)).toFixed(1)}h
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: RWR THREAT ROSE, ENGINE/FUEL, WEAPONS */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-800 bg-slate-950/70 p-3 rounded-lg text-xs">
            {/* 1. Radar Warning Receiver (RWR) 360 Azimuth */}
            <div className="flex items-center space-x-3 bg-black/60 p-2.5 rounded border border-slate-800">
              <div className="relative w-16 h-16 rounded-full border border-emerald-500/60 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="w-full h-px bg-emerald-500/30 absolute" />
                <div className="h-full w-px bg-emerald-500/30 absolute" />
                {/* Active Threat Blips on RWR */}
                {threats.map((t, idx) => (
                  <div
                    key={t.id}
                    className="absolute text-[8px] font-black text-red-500 animate-ping"
                    style={{
                      transform: `rotate(${idx * 75 + 30}deg) translate(22px) rotate(-${idx * 75 + 30}deg)`
                    }}
                  >
                    SAM
                  </div>
                ))}
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">RWR SUITE: SPECTRA</span>
                <span className="text-[11px] text-red-400 font-bold block mt-0.5">
                  ⚠️ {threats[0]?.name.split(" ")[0] || "RADAR"} ILLUMINATION
                </span>
                <span className="text-[9px] text-slate-400">TRACKS: {threats.length} ACTIVE</span>
              </div>
            </div>

            {/* 2. Fuel State & Bingo Fuel Warning */}
            <div className="bg-black/60 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-cyan-400" />
                  <span>FUEL SYSTEM</span>
                </span>
                <span className={`text-[10px] font-bold ${fuelKg <= bingoKg ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                  {fuelKg <= bingoKg ? "⚠️ BINGO WARNING" : "OPTIMAL"}
                </span>
              </div>
              <div className="mt-1">
                <div className="flex justify-between text-xs">
                  <span className="font-black text-white">{fuelKg} kg ({fuelPct}%)</span>
                  <span className="text-slate-400 text-[10px]">Bingo: {bingoKg} kg</span>
                </div>
                {/* Fuel Gauge Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${fuelKg <= bingoKg ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Weapons Inventory Mounted */}
            <div className="bg-black/60 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>PAYLOAD PYLONS</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">MASTER ARM: ON</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(currentAircraft.payload || []).map((p, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.2 rounded bg-slate-800 border border-emerald-500/40 text-[9px] text-emerald-300 font-bold"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cockpit Action Bar */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Plane className="w-3.5 h-3.5 text-cyan-400" />
            <span>PLATFORM: <strong className="text-white">{currentAircraft.aircraft_type}</strong></span>
            <span>|</span>
            <span>ROLE: <strong className="text-emerald-400">{(currentAircraft.roles || []).join(", ")}</strong></span>
          </div>

          <div className="flex items-center space-x-2">
            {onScramble && !isScramble && (
              <button
                onClick={() => onScramble(currentAircraft.id)}
                className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center space-x-1 text-xs transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>SCRAMBLE SUPERSONIC DASH</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
            >
              EXIT COCKPIT VIEW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
