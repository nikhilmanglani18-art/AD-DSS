import React, { useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  Zap,
  Bell,
  CheckCircle2,
  Play,
  Pause,
  Compass
} from "lucide-react";
import type { TacticalAlert } from "../types";
import { tacticalSound } from "../utils/audio";

interface BottomDockProps {
  onInjectThreat: () => void;
  onResetSector: () => void;
  onReOptimize: () => void;
  onOpenSandbox?: () => void;
  onSimulationControl?: (action: "pause" | "resume" | "speed", speed?: number) => void;
  isLoading: boolean;
  actionNotice: string | null;
  alerts: TacticalAlert[];
  simClock: string;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  onInjectThreat,
  onResetSector,
  onReOptimize,
  onOpenSandbox,
  onSimulationControl,
  isLoading,
  actionNotice,
  alerts,
  simClock
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  const handleTogglePlay = async () => {
    tacticalSound.playTacticalBlip();
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (onSimulationControl) {
      onSimulationControl(nextPlaying ? "resume" : "pause");
    }
    try {
      await fetch("http://localhost:8000/api/v1/simulation/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextPlaying ? "resume" : "pause" })
      });
    } catch {}
  };

  const handleSpeedChange = async (speed: number) => {
    tacticalSound.playTacticalBlip();
    setSimSpeed(speed);
    if (onSimulationControl) {
      onSimulationControl("speed", speed);
    }
    try {
      await fetch("http://localhost:8000/api/v1/simulation/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speed", speed_multiplier: speed })
      });
    } catch {}
  };

  return (
    <footer className="w-full bg-white border-t border-slate-200 shadow-sm px-4 py-2 z-20">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Scenario Injector Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* War Game Sandbox Button */}
          {onOpenSandbox && (
            <button
              onClick={onOpenSandbox}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-md font-sans font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#EA580C] to-red-600 hover:from-[#C2410C] hover:to-red-700 active:scale-[0.98] shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-60 ring-1 ring-orange-500"
              title="Open War Game 'What-If' Scenario Stress-Test Sandbox"
            >
              <Compass className="w-3.5 h-3.5 text-amber-200 animate-spin" style={{ animationDuration: "12s" }} />
              <span>WAR GAME SANDBOX</span>
            </button>
          )}

          {/* 1. Inject Pop-Up SAM Radar Button */}
          <button
            onClick={onInjectThreat}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-md font-sans font-bold text-xs uppercase tracking-wider text-slate-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 active:scale-[0.98] shadow-2xs transition-all flex items-center space-x-1.5 disabled:opacity-60"
            title="Inject Mobile S-400 Ambush and auto-replan with MILP SCIP"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>+ S-400 SAM</span>
          </button>

          {/* 2. Re-Optimize MILP Button (Ashoka Navy) */}
          <button
            onClick={onReOptimize}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-md font-sans font-bold text-xs uppercase tracking-wider text-white bg-[#000080] hover:bg-[#000066] active:scale-[0.98] shadow-2xs transition-all flex items-center space-x-1.5 disabled:opacity-60"
            title="Force immediate MILP DWTA solver execution"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>RE-SOLVE MILP</span>
          </button>

          {/* 3. Reset Sector Button */}
          <button
            onClick={onResetSector}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-md font-sans font-bold text-xs uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 active:scale-[0.98] shadow-2xs transition-all flex items-center space-x-1.5 disabled:opacity-60"
            title="Reset theater back to baseline T+00:00"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>RESET</span>
          </button>
        </div>

        {/* Center: Live Action Notification & Alert Ticker */}
        <div className="flex-1 max-w-xl flex items-center space-x-2 px-3 py-1 bg-slate-50 rounded-md border border-slate-200 overflow-hidden">
          <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="text-[11px] font-mono truncate">
            {actionNotice ? (
              <span className="font-bold text-[#000080] animate-pulse">
                ► {actionNotice}
              </span>
            ) : latestAlert ? (
              <span className="text-slate-700">
                <span className="font-bold text-slate-900">[{latestAlert.timestamp}]</span>{" "}
                <span
                  className={`font-semibold ${
                    latestAlert.level === "CRITICAL"
                      ? "text-[#DC2626]"
                      : latestAlert.level === "KESARI_ACTION"
                      ? "text-[#EA580C]"
                      : latestAlert.level === "SUCCESS"
                      ? "text-[#138808]"
                      : "text-[#000080]"
                  }`}
                >
                  {latestAlert.title}:
                </span>{" "}
                {latestAlert.message}
              </span>
            ) : (
              <span className="text-slate-400">All systems normal. Airborne patrol standing by.</span>
            )}
          </div>
        </div>

        {/* Right: Simulation Controls, Tactical Clock & Readiness */}
        <div className="flex items-center space-x-2 shrink-0 font-mono text-xs">
          {/* Play/Pause & Speed Multiplier Controller */}
          <div className="flex items-center rounded-md border border-slate-300 bg-slate-100 p-0.5 text-[10px]">
            <button
              onClick={handleTogglePlay}
              className={`p-1 rounded font-bold transition-all ${
                isPlaying ? "bg-white text-slate-900 shadow-2xs" : "bg-red-500 text-white"
              }`}
              title={isPlaying ? "Pause Simulation" : "Resume Simulation"}
            >
              {isPlaying ? <Pause className="w-3 h-3 text-slate-700" /> : <Play className="w-3 h-3 text-white fill-current" />}
            </button>
            <button
              onClick={() => handleSpeedChange(1)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                simSpeed === 1 ? "bg-white text-[#000080] shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              1X
            </button>
            <button
              onClick={() => handleSpeedChange(2)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                simSpeed === 2 ? "bg-white text-[#000080] shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              2X
            </button>
            <button
              onClick={() => handleSpeedChange(5)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                simSpeed === 5 ? "bg-white text-[#000080] shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              5X
            </button>
          </div>

          <div className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px]">
            {simClock || "T+00:00.00"}
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-[#138808] font-bold text-[10px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ACTIVE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
