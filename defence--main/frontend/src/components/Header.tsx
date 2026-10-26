import { useState, useEffect } from "react";
import { Shield, Radio, Zap, Clock, AlertTriangle, FileText } from "lucide-react";
import type { TacticalState } from "../types";

interface HeaderProps {
  state: TacticalState | null;
  isConnected: boolean;
  wsStatus: "CONNECTED" | "CONNECTING" | "DISCONNECTED";
  isMockMode?: boolean;
  onOpenSitrep?: () => void;
  onOpenCockpit?: () => void;
  onOpenCopilot?: () => void;
  onOpenDataLink?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isConnected,
  wsStatus,
  isMockMode = false,
  onOpenSitrep,
  onOpenCockpit,
  onOpenCopilot,
  onOpenDataLink
}) => {
  const [zuluTime, setZuluTime] = useState<string>("");
  const [istTime, setIstTime] = useState<string>("");

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + "Z");
      setIstTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) + " IST"
      );
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const defcon = state?.defcon_level || "DEFCON 3";
  const isDefcon2 = defcon.includes("DEFCON 2") || defcon.includes("DEFCON 1");
  const latencyMs = state?.latest_optimization?.latency_ms ?? 14.2;

  return (
    <header className="relative w-full bg-white border-b border-slate-200 shadow-sm z-30">
      {/* 1. Tricolour Top Strip: 1/3 Saffron (#FF9933), 1/3 White, 1/3 India Green (#138808) */}
      <div className="w-full h-1 flex">
        <div className="w-1/3 h-full bg-[#FF9933]" />
        <div className="w-1/3 h-full bg-white border-b border-slate-100" />
        <div className="w-1/3 h-full bg-[#138808]" />
      </div>

      <div className="px-4 py-2 flex items-center justify-between">
        {/* Left: Branding & National Emblem Badge */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#000080] flex items-center justify-center text-white shadow-sm ring-1 ring-slate-200">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black tracking-wider text-slate-900 uppercase font-sans">
                PROJECT VAYU-NET
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black tracking-widest uppercase bg-[#000080] text-white">
                AD-DSS V2.5
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 tracking-wide hidden sm:block">
              Vayusena Dynamic Air Tasking Engine & C2 Tactical Decision Support
            </p>
          </div>
        </div>

        {/* Right: Operational Status Badges & Mind-Blowing Tool Suite */}
        <div className="flex items-center space-x-2.5">
          {/* UTC/Zulu & IST Clock */}
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <div className="text-[11px] font-mono leading-tight">
              <span className="font-bold text-slate-900">{zuluTime || "00:00:00Z"}</span>
              <span className="text-slate-400 mx-1">|</span>
              <span className="text-slate-600">{istTime}</span>
            </div>
          </div>

          {/* Link-16 Status (Clickable to open Data Link Monitor) */}
          <button
            onClick={onOpenDataLink}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-all cursor-pointer"
            title="Open Link-16 / IACCS Electronic Warfare & Data Link Monitor"
          >
            <Radio className="w-3.5 h-3.5 text-[#138808] animate-pulse" />
            <div className="text-[11px] font-mono font-bold leading-tight text-left">
              <span className="text-[#138808]">LINK-16</span>
              <span className="text-[9px] block text-emerald-600 font-normal">TADIL-J</span>
            </div>
          </button>

          {/* Solver Latency Meter */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <div className="text-[11px] font-mono leading-tight text-left">
              <span className="text-slate-500 text-[9px] uppercase block">SCIP Solver</span>
              <span className="font-bold text-slate-900">{latencyMs} ms</span>
            </div>
          </div>

          {/* 1. Cockpit HUD Button */}
          {onOpenCockpit && (
            <button
              onClick={onOpenCockpit}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-950 hover:bg-black text-emerald-400 border border-emerald-500/50 shadow-sm font-mono text-xs font-bold transition-all"
              title="Enter Cockpit Glass HUD View (MIL-STD-1787C Symbology)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>COCKPIT HUD</span>
            </button>
          )}

          {/* 2. Tactical AI Copilot Button */}
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-700 to-[#000080] hover:from-blue-800 hover:to-blue-950 text-white font-mono text-xs font-bold transition-all shadow-sm ring-1 ring-blue-600"
              title="Open Voice & Text Tactical AI Air Dispatcher"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>AI COPILOT</span>
              <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                VOICE
              </span>
            </button>
          )}

          {/* 3. Theater SITREP Button */}
          {onOpenSitrep && (
            <button
              onClick={onOpenSitrep}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-mono text-xs font-bold transition-all"
              title="Open Complete Theater Readiness & Asset Allocation Report"
            >
              <FileText className="w-3.5 h-3.5 text-[#000080]" />
              <span>SITREP</span>
            </button>
          )}

          {/* DEFCON Badge */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border font-mono font-black text-xs tracking-wider transition-all shadow-sm ${
              isDefcon2
                ? "bg-red-50 border-red-300 text-[#DC2626] animate-pulse"
                : "bg-amber-50 border-amber-300 text-amber-900"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${isDefcon2 ? "text-[#DC2626]" : "text-amber-600"}`} />
            <div>
              <span className="block leading-none uppercase text-[11px]">{defcon.split(":")[0]}</span>
            </div>
          </div>

          {/* WebSocket / Telemetry Live Indicator */}
          <div className="flex items-center space-x-1.5 pl-1.5 border-l border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-[10px] font-mono font-bold text-slate-700 uppercase hidden sm:inline">
              {isMockMode ? "2 Hz SIMULATOR" : wsStatus === "CONNECTED" ? "2 Hz LIVE" : wsStatus}
            </span>
            {isMockMode && (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 hidden md:inline">
                PROTOTYPE MODE
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
