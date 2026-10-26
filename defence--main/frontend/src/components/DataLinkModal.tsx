import React from "react";
import {
  X,
  Radio,
  Shield,
  Activity,
  CheckCircle2,
  Lock,
  Wifi,
  Server,
  Plane
} from "lucide-react";
import type { TacticalState } from "../types";

interface DataLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TacticalState | null;
}

export const DataLinkModal: React.FC<DataLinkModalProps> = ({ isOpen, onClose, state }) => {
  if (!isOpen) return null;

  const aircraftList = state?.sorties || state?.fleet || [];
  const airbasesList = state?.airbases || state?.bases || [];

  const J_SERIES_LOGS = [
    { code: "J2.2", type: "AIR PPLI", source: "RAFALE-DELTA", payload: "FL280 / HDG 315° / MACH 1.4 / FUEL 6,800KG", status: "ACK" },
    { code: "J3.2", type: "AIR TRACK", source: "IACCS-C2", payload: "EMITTER HQ-9B DETECTED AT 32.20°N, 74.05°E", status: "BROADCAST" },
    { code: "J12.0", type: "MISSION ASSIGN", source: "VAYU-NET-DSS", payload: "COA-1 SUPERSONIC INTERCEPT VECTOR TO AMBALA QRA", status: "EXECUTING" },
    { code: "J13.2", type: "AIRFIELD SITREP", source: "AFS_AMB", payload: "RWY 12/30 FMC GREEN / ATF 2,800T / QRA READY", status: "ACK" },
    { code: "J2.2", type: "AIR PPLI", source: "SU30-TIGER1", payload: "FL280 / HDG 310° / MACH 0.88 / ASTRA MK1 ARMED", status: "ACK" }
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-inner">
              <Radio className="w-5 h-5 text-emerald-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-wide uppercase font-mono">
                  LINK-16 / IACCS TACTICAL DATA LINK & EW TELEMETRY
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  TADIL-J // ENCRYPTED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                MIL-STD-6016 Joint Tactical Information Distribution System (JTIDS / MIDS)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top EW Status Bar */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 font-mono text-center">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-bold">CRYPTO ALGORITHM</span>
            <div className="flex items-center justify-center space-x-1.5 mt-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-black text-slate-900">KGV-72 (TYPE-1)</span>
            </div>
            <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">KEY ROLLOVER: 18h 42m</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-bold">FREQUENCY HOPPING (FHSS)</span>
            <div className="flex items-center justify-center space-x-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-[#000080]" />
              <span className="text-xs font-black text-slate-900">77,000 HOPS / SEC</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">BAND: 969 - 1206 MHz</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-bold">ANTI-JAM MARGIN (ECCM)</span>
            <div className="flex items-center justify-center space-x-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-black text-slate-900">38.4 dB (SUPERIOR)</span>
            </div>
            <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">JAM RATIO: 0.02%</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-bold">NETWORK THROUGHPUT</span>
            <div className="flex items-center justify-center space-x-1.5 mt-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-black text-slate-900">238 KBPS (100% SLOTS)</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">PACKET LOSS: 0.00%</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden p-5 gap-5">
          {/* Left: Active Data Link Nodes Mesh */}
          <div className="col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-mono font-bold uppercase text-slate-600 flex items-center space-x-1.5">
                  <Server className="w-4 h-4 text-[#000080]" />
                  <span>ACTIVE MESH PARTICIPANTS (8 NODES)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  ALL NODES SYNCHRONIZED
                </span>
              </div>

              {/* Node Cards */}
              <div className="space-y-2 mt-3 overflow-y-auto max-h-[360px] pr-1">
                {/* IACCS Central Node */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-slate-900">IACCS-C2 // WESTERN COMMAND HUB</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">NTR MASTER CLOCK</span>
                </div>

                {/* Airframe Nodes */}
                {aircraftList.map((ac) => (
                  <div
                    key={ac.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <Plane className="w-3.5 h-3.5 text-[#000080]" />
                      <span className="font-bold text-slate-800">{ac.callsign}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="text-slate-400">LATENCY: 8ms</span>
                      <span className="text-emerald-600 font-bold">LINKED</span>
                    </div>
                  </div>
                ))}

                {/* Airbase Nodes */}
                {airbasesList.map((ab) => (
                  <div
                    key={ab.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <Radio className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold text-slate-800">{ab.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="text-slate-400">FMC GREEN</span>
                      <span className="text-emerald-600 font-bold">RELAY ON</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>TIME SLOTS: 128 / SEC</span>
              <span className="text-emerald-600 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>NTR ACCURACY: 0.04μs</span>
              </span>
            </div>
          </div>

          {/* Right: Real-time J-Series TADIL-J Message Stream */}
          <div className="col-span-6 bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between text-slate-300 font-mono">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase text-emerald-400 flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 animate-spin" style={{ animationDuration: "8s" }} />
                  <span>REAL-TIME TADIL-J MESSAGE BUS</span>
                </span>
                <span className="text-[10px] text-slate-400">RATE: 48 MSGS / SEC</span>
              </div>

              {/* Message log entries */}
              <div className="space-y-2 mt-3 overflow-y-auto max-h-[360px] pr-1 text-xs">
                {J_SERIES_LOGS.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1 hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold text-[9px]">
                          {log.code}
                        </span>
                        <span className="font-bold text-white">{log.type}</span>
                        <span className="text-slate-500">FROM {log.source}</span>
                      </div>
                      <span className="text-[9px] text-emerald-400 font-bold">{log.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pl-1 border-l-2 border-slate-700">
                      {log.payload}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>STANDALONE ZERO-API-KEY BUFFER</span>
              <span className="text-emerald-400 font-bold">SECURE BROADCAST ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
