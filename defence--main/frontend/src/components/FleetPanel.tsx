import { Plane, Fuel, UserCheck, ShieldAlert, Navigation, Building2, CheckCircle2, Radar, Cloud } from "lucide-react";
import type { Aircraft, Airbase, AirbaseMETAR } from "../types";

interface FleetPanelProps {
  aircraft: Aircraft[];
  airbases: Airbase[];
  airbaseWeather?: Record<string, AirbaseMETAR>;
  onSelectAircraft?: (ac: Aircraft) => void;
  selectedAircraftId?: string;
  onOpenCockpit?: (aircraftId: string) => void;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  aircraft,
  airbases,
  airbaseWeather,
  onSelectAircraft,
  selectedAircraftId,
  onOpenCockpit
}) => {
  return (
    <aside className="h-full flex flex-col space-y-3.5 overflow-y-auto pr-1">
      {/* 1. Fleet Readiness Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Plane className="w-4 h-4 text-[#000080]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
              Fleet Readiness ({aircraft.length} Airframes)
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-[#138808] border border-emerald-200">
            FMC READY
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {aircraft.map((ac) => {
            const isSelected = selectedAircraftId === ac.id;
            const fuelPct = Math.round((ac.fuel_kg / Math.max(1, ac.max_fuel_kg)) * 100);
            const isBingo = ac.fuel_kg <= (ac.bingo_fuel_kg || 1500);
            const fdlPct = Math.min(100, Math.round((ac.fdl_hours_elapsed / Math.max(0.1, ac.fdl_hours_limit)) * 100));

            // Status styling
            let statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
            if (ac.status.includes("PATROL") || ac.status.includes("ON_STATION")) {
              statusBadgeClass = "bg-emerald-50 text-[#138808] border-emerald-200 font-bold";
            } else if (ac.status.includes("STANDBY") || ac.status.includes("QRA")) {
              statusBadgeClass = "bg-indigo-50 text-[#000080] border-indigo-200 font-bold";
            } else if (ac.status.includes("SCRAMBL") || ac.status.includes("INTERCEPT")) {
              statusBadgeClass = "bg-amber-50 text-[#EA580C] border-amber-300 font-bold animate-pulse";
            } else if (ac.status.includes("EVAD") || ac.status.includes("DECONFLICT")) {
              statusBadgeClass = "bg-red-50 text-[#DC2626] border-red-300 font-bold animate-pulse";
            }

            // Radar suite naming by platform
            let radarSuite = "Uttam AESA";
            if (ac.aircraft_type.includes("Rafale")) radarSuite = "RBE2 AESA / SPECTRA EW";
            else if (ac.aircraft_type.includes("Su-30")) radarSuite = "N011M Bars PESA";
            else if (ac.aircraft_type.includes("Mirage")) radarSuite = "RDY-3 Doppler";

            return (
              <div
                key={ac.id}
                onClick={() => onSelectAircraft && onSelectAircraft(ac)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#000080] bg-slate-50/80 ring-1 ring-[#000080] shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {/* Header: Aircraft Callsign, Type, and Status */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs text-slate-900 tracking-tight">
                        {ac.callsign}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-500 block">
                      {ac.aircraft_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {onOpenCockpit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCockpit(ac.id);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-black text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/40 shadow-2xs transition-all"
                        title="Enter Cockpit HUD"
                      >
                        HUD
                      </button>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase border ${statusBadgeClass}`}>
                      {ac.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Threat Proximity Warning Banner */}
                {ac.threat_warning && (
                  <div className="mt-2 p-1.5 rounded bg-red-50 border border-red-200 flex items-center space-x-1.5 text-red-700 text-[10px] font-mono">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                    <span className="truncate">{ac.threat_warning}</span>
                  </div>
                )}

                {/* Tactical Telemetry Strip */}
                <div className="mt-2 grid grid-cols-4 gap-1 p-1.5 bg-slate-50 rounded border border-slate-200/70 font-mono text-[9.5px]">
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Altitude</span>
                    <span className="font-bold text-slate-800">
                      {ac.alt_ft > 0 ? `FL${Math.round(ac.alt_ft / 100)}` : "GND"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Speed</span>
                    <span className="font-bold text-slate-800">
                      {ac.speed_kts} kt
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Mach</span>
                    <span className="font-bold text-slate-800">
                      M {ac.mach || 0.85}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Heading</span>
                    <span className="font-bold text-slate-800 flex items-center">
                      <Navigation
                        className="w-2.5 h-2.5 mr-0.5 text-slate-500 inline"
                        style={{ transform: `rotate(${ac.heading_deg}deg)` }}
                      />
                      {ac.heading_deg}°
                    </span>
                  </div>
                </div>

                {/* Fuel Gauge & Bingo Threshold */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[9.5px] font-mono mb-1">
                    <span className="flex items-center text-slate-600">
                      <Fuel className="w-3 h-3 mr-1 text-slate-400" />
                      ATF Fuel: {ac.fuel_kg} / {ac.max_fuel_kg} kg
                    </span>
                    <span
                      className={`font-bold ${
                        isBingo ? "text-[#DC2626]" : fuelPct < 40 ? "text-[#FF9933]" : "text-[#138808]"
                      }`}
                    >
                      {fuelPct}% {isBingo && "(BINGO ALERT)"}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isBingo
                          ? "bg-[#DC2626]"
                          : fuelPct < 40
                          ? "bg-[#FF9933]"
                          : "bg-[#138808]"
                      }`}
                      style={{ width: `${fuelPct}%` }}
                    />
                  </div>
                </div>

                {/* Pilot Duty (FDL) & Radar Suite */}
                <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                  <span className="flex items-center truncate">
                    <UserCheck className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                    <span className="truncate">{ac.pilot}</span>
                  </span>
                  <span className="shrink-0 font-medium">
                    Duty: {ac.fdl_hours_elapsed.toFixed(1)}h / {ac.fdl_hours_limit.toFixed(1)}h ({fdlPct}%)
                  </span>
                </div>

                {/* Sensor & Weapons Inventory */}
                <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-[#000080] font-semibold flex items-center truncate">
                    <Radar className="w-2.5 h-2.5 mr-1 shrink-0" />
                    {radarSuite}
                  </span>
                  <span className="text-slate-500">Max G: {ac.max_g || 9.0}g</span>
                </div>

                {ac.payload && ac.payload.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ac.payload.map((weapon, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[8.5px] font-mono border border-slate-200"
                      >
                        {weapon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Airbase Runway Statuses Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-[#000080]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
              Airbase Stations ({airbases.length} Facilities)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-bold">MIL-STD-FMC</span>
        </div>

        <div className="mt-3 space-y-2.5">
          {airbases.map((base) => (
            <div
              key={base.id}
              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    {base.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    {base.squadron}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-[#138808] border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                    {base.runway_status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 font-mono text-[9.5px] text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase">Runway</span>
                  <span className="font-semibold text-slate-800">{base.runway_heading}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase">QRA Alert</span>
                  <span className="font-semibold text-[#000080]">{base.qra_status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase">ATF Depot</span>
                  <span className="font-semibold text-slate-800">{base.fuel_atf_tons} T</span>
                </div>
              </div>

              {/* Real-time Airbase METAR Weather Data */}
              {airbaseWeather?.[base.id] && (
                <div className="mt-2 pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[9px] font-mono">
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <Cloud className="w-3 h-3 text-sky-600 shrink-0" />
                    <span>VIS: {airbaseWeather[base.id].visibility_km}KM | WND: {airbaseWeather[base.id].wind_kts}KT</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase border ${
                      airbaseWeather[base.id].flight_category.includes("GREEN")
                        ? "bg-emerald-50 text-[#138808] border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-300"
                    }`}
                  >
                    {airbaseWeather[base.id].flight_category.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
