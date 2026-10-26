import { useState } from "react";
import { ShieldCheck, Send, Award, Cpu, AlertCircle, BarChart3, CheckCircle2, ChevronRight, Check } from "lucide-react";
import type { COA } from "../types";

interface COATerminalProps {
  coas: COA[];
  selectedCOA: COA | null;
  onSelectCOA: (coa: COA) => void;
  onAuthorize: (coaId: string) => void;
  isAuthorizing: boolean;
  authorizedCOAId: string | null;
}

export const COATerminal: React.FC<COATerminalProps> = ({
  coas,
  selectedCOA,
  onSelectCOA,
  onAuthorize,
  isAuthorizing,
  authorizedCOAId
}) => {
  const [showMatrix, setShowMatrix] = useState<boolean>(false);
  const currentCOA = selectedCOA || (coas.length > 0 ? coas[0] : null);

  return (
    <aside className="h-full flex flex-col space-y-3.5 overflow-y-auto pl-1">
      {/* 1. Terminal Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-[#000080]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
              Dynamic COA Decision Terminal
            </h2>
          </div>
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors flex items-center space-x-1 ${
              showMatrix
                ? "bg-[#000080] text-white border-[#000080]"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>MATRIX</span>
          </button>
        </div>

        {/* COA Comparison Matrix Table */}
        {showMatrix && coas.length > 0 && (
          <div className="mt-2.5 p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[9.5px]">
            <div className="font-bold text-slate-700 uppercase mb-1.5 flex justify-between">
              <span>Multi-Objective Decision Matrix</span>
              <span className="text-slate-400">DWTA MILP</span>
            </div>
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[8.5px]">
                  <th className="text-left pb-1">COA</th>
                  <th className="pb-1">Success</th>
                  <th className="pb-1">Attrition</th>
                  <th className="pb-1">Fuel</th>
                  <th className="pb-1">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {coas.map((c) => {
                  const qm = c.quantitative_metrics || {
                    success_probability_pct: 90,
                    attrition_risk_pct: 10,
                    fuel_burn_pct: 25,
                    eta_sec: 240,
                    eta_formatted: "4m 00s"
                  };
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCOA(c)}
                      className={`cursor-pointer hover:bg-slate-100 transition-colors ${
                        currentCOA?.id === c.id ? "bg-slate-200/70 font-bold" : ""
                      }`}
                    >
                      <td className="text-left py-1 text-slate-900 font-bold">{c.id}</td>
                      <td className="py-1 text-[#138808]">{qm.success_probability_pct}%</td>
                      <td className="py-1 text-[#DC2626]">{qm.attrition_risk_pct}%</td>
                      <td className="py-1 text-slate-700">{qm.fuel_burn_pct}%</td>
                      <td className="py-1 text-[#000080]">{qm.eta_formatted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ranked COA Selector Cards */}
        <div className="mt-3 space-y-2.5">
          {coas.map((coa) => {
            const isSelected = currentCOA?.id === coa.id;
            const isAuthorized = authorizedCOAId === coa.id;

            const qm = coa.quantitative_metrics || {
              success_probability_pct: coa.tde_score || 90.0,
              attrition_risk_pct: coa.threat_risk_index || 10.0,
              fuel_burn_pct: 25.0,
              eta_sec: coa.reaction_time_sec || 300,
              eta_formatted: `${Math.round((coa.reaction_time_sec || 300) / 60)}m 00s`
            };

            return (
              <div
                key={coa.id}
                onClick={() => onSelectCOA(coa)}
                className={`p-3 rounded-lg border transition-all cursor-pointer relative ${
                  isSelected
                    ? "border-[#000080] bg-slate-50 ring-1 ring-[#000080] shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {/* Header: Rank + Recommended badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-black ${
                        coa.rank === 1
                          ? "bg-[#000080] text-white"
                          : coa.rank === 2
                          ? "bg-slate-700 text-white"
                          : "bg-slate-400 text-white"
                      }`}
                    >
                      {coa.rank}
                    </span>
                    <span className="font-bold text-xs text-slate-900 tracking-tight">
                      {coa.id}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {coa.recommended && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-[#138808] border border-emerald-200">
                        <Award className="w-2.5 h-2.5 mr-1" />
                        RECOMMENDED
                      </span>
                    )}
                    {isAuthorized && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#000080] text-white flex items-center space-x-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>ACTIVE ORDER</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Designation / Title */}
                <h4 className="mt-1.5 font-bold text-[11px] text-slate-800 tracking-tight leading-snug">
                  {coa.designation}
                </h4>

                {/* Quantitative Metric Strip */}
                <div className="mt-2.5 grid grid-cols-4 gap-1 pt-2 border-t border-slate-150 font-mono text-center">
                  <div className="p-1 rounded bg-white border border-slate-100">
                    <span className="text-[8px] text-slate-400 block uppercase">Success</span>
                    <span className="text-[10px] font-bold text-[#138808]">
                      {qm.success_probability_pct}%
                    </span>
                  </div>
                  <div className="p-1 rounded bg-white border border-slate-100">
                    <span className="text-[8px] text-slate-400 block uppercase">Attrition</span>
                    <span
                      className={`text-[10px] font-bold ${
                        qm.attrition_risk_pct > 20
                          ? "text-[#DC2626]"
                          : qm.attrition_risk_pct > 10
                          ? "text-[#FF9933]"
                          : "text-[#138808]"
                      }`}
                    >
                      {qm.attrition_risk_pct}%
                    </span>
                  </div>
                  <div className="p-1 rounded bg-white border border-slate-100">
                    <span className="text-[8px] text-slate-400 block uppercase">Fuel</span>
                    <span className="text-[10px] font-bold text-slate-700">
                      {qm.fuel_burn_pct}%
                    </span>
                  </div>
                  <div className="p-1 rounded bg-white border border-slate-100">
                    <span className="text-[8px] text-slate-400 block uppercase">ETA</span>
                    <span className="text-[10px] font-bold text-[#000080] truncate block">
                      {qm.eta_formatted || `${qm.eta_sec}s`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Detailed COA Explainability & Breakdown */}
      {currentCOA && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5 space-y-3">
          <div className="pb-2 border-b border-slate-100">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">
              COA Tactical Profile
            </span>
            <h3 className="text-xs font-black text-slate-900 tracking-tight">
              {currentCOA.id}: {currentCOA.designation}
            </h3>
            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
              {currentCOA.summary}
            </p>
          </div>

          {/* Quantitative Visual Meters */}
          {currentCOA.quantitative_metrics && (
            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <div className="flex justify-between text-slate-600 mb-0.5 text-[10px]">
                  <span className="flex items-center">
                    <ShieldCheck className="w-3 h-3 mr-1 text-[#138808]" />
                    Mission Success Probability
                  </span>
                  <span className="font-bold text-[#138808]">
                    {currentCOA.quantitative_metrics.success_probability_pct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-[#138808] rounded-full transition-all duration-500"
                    style={{ width: `${currentCOA.quantitative_metrics.success_probability_pct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-0.5 text-[10px]">
                  <span className="flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1 text-[#DC2626]" />
                    Enemy Attrition Risk
                  </span>
                  <span className="font-bold text-[#DC2626]">
                    {currentCOA.quantitative_metrics.attrition_risk_pct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-[#DC2626] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, currentCOA.quantitative_metrics.attrition_risk_pct * 2)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Airframe Assignments */}
          {((currentCOA.assignments && currentCOA.assignments.length > 0) ||
            (currentCOA.airframe_assignments && currentCOA.airframe_assignments.length > 0)) && (
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-700 uppercase block mb-1.5">
                Committed Airframe Tasks
              </span>
              <div className="space-y-1.5">
                {(currentCOA.assignments || currentCOA.airframe_assignments || []).map((asgn: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {asgn.aircraft_name || asgn.aircraft_id}
                      </span>
                      <span className="text-[#000080] font-semibold truncate max-w-[150px]">
                        {asgn.assigned_task || asgn.assigned_mission}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-500 text-[9px] flex justify-between">
                      <span>Munition: {asgn.weapon_selected || asgn.weapon_payload?.[0] || "Meteor BVRAAM"}</span>
                      <span className="text-emerald-700 font-bold">
                        P_kill: {asgn.p_kill ? `${Math.round(asgn.p_kill * 100)}%` : "95%"}
                      </span>
                    </div>
                    {asgn.flight_profile && (
                      <div className="mt-1 text-slate-400 text-[8.5px] truncate">
                        Profile: {asgn.flight_profile}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explainability Constraints Verified */}
          {(currentCOA.explainability?.constraints_verified ||
            currentCOA.xai_breakdown?.constraints_verified) && (
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-700 uppercase block mb-1">
                MILP Hard Constraints Verified
              </span>
              <ul className="space-y-1 text-[9px] font-mono text-slate-600 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                {(
                  currentCOA.explainability?.constraints_verified ||
                  currentCOA.xai_breakdown?.constraints_verified ||
                  []
                ).map((c: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-[#138808] shrink-0 mt-0.5" />
                    <span className="leading-tight">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AUTHORIZE & DISPATCH COMMAND BUTTON (Ashoka Navy) */}
          <div className="pt-2">
            <button
              onClick={() => onAuthorize(currentCOA.id)}
              disabled={isAuthorizing}
              className={`w-full py-2.5 px-4 rounded-md font-sans font-bold text-xs uppercase tracking-wider text-white shadow-sm transition-all flex items-center justify-center space-x-2 ${
                authorizedCOAId === currentCOA.id
                  ? "bg-[#138808] hover:bg-emerald-700 ring-2 ring-emerald-300"
                  : "bg-[#000080] hover:bg-[#000066] active:scale-[0.99] ring-2 ring-indigo-200"
              } disabled:opacity-60`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isAuthorizing
                  ? "TRANSMITTING COMMAND..."
                  : authorizedCOAId === currentCOA.id
                  ? `AUTHORIZED: ${currentCOA.id} COMMITTED`
                  : `AUTHORIZE & DISPATCH ${currentCOA.id}`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
