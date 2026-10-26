import React, { useState } from "react";
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  Zap,
  CloudRain,
  Flame,
  Radio,
  Clock,
  Compass
} from "lucide-react";
import type { TacticalState } from "../types";
import { tacticalSound } from "../utils/audio";

interface WhatIfSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TacticalState | null;
  onInjectScenario: (scenarioType: string) => Promise<void> | void;
  onReset: () => void;
}

interface ScenarioConfig {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: any;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  color: string;
  description: string;
  operationalImpact: string[];
  expectedAIBehavior: string;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: "SCENARIO-1-RUNWAY-DENIAL",
    type: "RUNWAY_DENIAL",
    title: "AIRBASE RUNWAY DENIAL // BALLISTIC CRATERING",
    subtitle: "Halwara Airbase Runway 14/32 Interdicted",
    icon: Flame,
    severity: "CRITICAL",
    color: "red",
    description: "Enemy ballistic missile strike craters primary runway at AFS Halwara. Runway status transitions to CRATERED_DENIED with zero operational takeoffs or landings permitted.",
    operationalImpact: [
      "Runway 14/32 closed immediately via automated NOTAM",
      "QRA alert scrambles from Halwara suspended",
      "Airborne sorties rerouted to Bareilly (Trishul) or Ambala",
      "Depot ATF & weapon stocks quarantined"
    ],
    expectedAIBehavior: "SCIP MILP solver initiates sub-15ms reallocation, diverting Su-30MKI and Tejas Mk1A to Bareilly AFS with positive fuel reserve."
  },
  {
    id: "SCENARIO-2-DRONE-SWARM",
    type: "DRONE_SWARM",
    title: "LOW-RCS DRONE SWARM INGRESS // MULTI-AXIS BOGEYS",
    subtitle: "4 Loitering Munitions Skimming at 1,500ft AGL",
    icon: Radio,
    severity: "CRITICAL",
    color: "red",
    description: "4 low-observable loitering munitions penetrate Western perimeter undetected by conventional ground radar. Radars detect targets skimming at 1,500ft AGL towards Halwara & Ambala.",
    operationalImpact: [
      "Simultaneous 4-bogey hostile threat vectors detected",
      "Estimated time to impact: 480 - 645 seconds",
      "High probability of infrastructure damage if unintercepted",
      "Low radar cross-section requires BVR active radar seeker lock"
    ],
    expectedAIBehavior: "Dynamic Weapon-Target Assignment (DWTA) pairs airborne Su-30MKI and Mirage 2000 with Astra Mk-1 and Mica BVRAAMs, initiating automated deconfliction corridors."
  },
  {
    id: "SCENARIO-3-WEATHER-BURST",
    type: "WEATHER_BURST",
    title: "SEVERE CONVECTIVE STORM FRONT // CB EXPANSION",
    subtitle: "Violent 75km Squall Front with 58kt Wind Gusts",
    icon: CloudRain,
    severity: "HIGH",
    color: "amber",
    description: "Severe monsoonal Cumulonimbus (CB) cloud burst cell expands violently across the Punjab corridor. Cloud tops breach FL480 with extreme turbulence and severe airframe icing.",
    operationalImpact: [
      "No-Fly corridor enforced over 75km radius",
      "Halwara visibility degraded to 1.2km (LIFR Red)",
      "High-altitude cruising routes compromised",
      "Sensor attenuation reduces airborne radar range by 35%"
    ],
    expectedAIBehavior: "Kinematic Theta* algorithm computes low-altitude terrain-masking bypass corridors, evading storm cell while maintaining minimum safe altitude."
  },
  {
    id: "SCENARIO-4-INFLIGHT-EMERGENCY",
    type: "INFLIGHT_EMERGENCY",
    title: "IN-FLIGHT EMERGENCY // MAYDAY BINGO FUEL DEREGULATION",
    subtitle: "Su-30MKI Critical Fuel (650kg) & Hydraulics Derate",
    icon: Zap,
    severity: "CRITICAL",
    color: "red",
    description: "Su-30MKI (Tiger-1) declares Mayday Mayday due to high-pressure fuel line leak and hydraulic pressure loss. Remaining internal fuel drops to 650kg (far below 2,600kg BINGO).",
    operationalImpact: [
      "Mayday status broadcast over military emergency frequency 243.0 MHz",
      "Immediate fuel exhaustion within 8 minutes if unrecovered",
      "Aircraft loses combat effectiveness",
      "Surrounding airspace must be sanitized for priority approach"
    ],
    expectedAIBehavior: "DSS designates immediate emergency glide vector to Ambala runway 12/30, sanitizes approach cone, and retasks Rafale-Delta to backfill sector CAP."
  }
];

export const WhatIfSandboxModal: React.FC<WhatIfSandboxModalProps> = ({
  isOpen,
  onClose,
  state: _state,
  onInjectScenario,
  onReset
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIOS[0].id);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  const handleExecute = async () => {
    setIsExecuting(true);
    tacticalSound.playThreatAlert();

    try {
      await onInjectScenario(currentScenario.type);
      setLastExecuted(currentScenario.title);
      tacticalSound.playAuthorizeChime();
    } catch {
      // Failed
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    tacticalSound.playTacticalBlip();
    onReset();
    setLastExecuted(null);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#EA580C] flex items-center justify-center text-white shadow-inner">
              <Compass className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-wide uppercase font-mono">
                  WAR GAME "WHAT-IF" SCENARIO STRESS-TEST SANDBOX
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#EA580C] text-white">
                  REAL-TIME SIMULATION
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Dynamic Air Tasking Resilience Under Contested, Rapidly Changing Threats
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-colors"
              title="Reset sector back to baseline T+00:00"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>RESET SECTOR</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split Grid */}
        <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
          {/* Left: Scenario Selector Cards */}
          <div className="col-span-5 border-r border-slate-200 bg-slate-50 p-4 space-y-3 overflow-y-auto">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider block">
              SELECT CRISIS STRESS-TEST SCENARIO:
            </span>

            {SCENARIOS.map((sc) => {
              const IconComp = sc.icon;
              const isSelected = sc.id === selectedScenarioId;

              return (
                <div
                  key={sc.id}
                  onClick={() => {
                    tacticalSound.playTacticalBlip();
                    setSelectedScenarioId(sc.id);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-white border-[#000080] ring-2 ring-blue-100 shadow-sm"
                      : "bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          sc.color === "red"
                            ? "bg-red-100 text-red-600"
                            : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 leading-tight">
                          {sc.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          {sc.subtitle}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 font-mono ${
                        sc.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {sc.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Detailed Briefing & Execution Console */}
          <div className="col-span-7 p-6 overflow-y-auto flex flex-col justify-between bg-white space-y-4">
            <div className="space-y-4">
              {/* Scenario Title Header */}
              <div className="pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono font-black text-[10px] uppercase">
                    SECTOR THREAT LEVEL: {currentScenario.severity}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {currentScenario.type}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 uppercase mt-1">
                  {currentScenario.title}
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {currentScenario.description}
                </p>
              </div>

              {/* Operational Impacts */}
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider block mb-2">
                  TACTICAL IMPACT ON AIR OPERATIONS:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {currentScenario.operationalImpact.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2 text-xs text-slate-700"
                    >
                      <span className="font-mono font-bold text-red-500 shrink-0">►</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected AI Adaptive Behavior */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/80">
                <span className="text-[10px] font-mono font-bold uppercase text-[#000080] tracking-wider block mb-1 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>PROJECT VAYU-NET (AD-DSS) AUTOMATED RESPONSE:</span>
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {currentScenario.expectedAIBehavior}
                </p>
              </div>

              {/* Execution Feedback Indicator */}
              {lastExecuted && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-800 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    SUCCESSFULLY INJECTED: <strong>{lastExecuted}</strong>. Dynamic replanning active on Tactical Map.
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Execution Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] font-mono text-slate-500 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>SOLVER RE-PLAN SPEED: &lt;15ms</span>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold transition-all"
                >
                  CANCEL
                </button>

                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] disabled:opacity-50 text-white font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 text-amber-200 fill-current" />
                  <span>{isExecuting ? "INJECTING..." : "EXECUTE SCENARIO STRESS-TEST"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
