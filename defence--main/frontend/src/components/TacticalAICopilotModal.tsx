import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Bot,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  CheckCircle2,
  Cpu,
  ArrowRight
} from "lucide-react";
import type { TacticalState } from "../types";
import { tacticalSound } from "../utils/audio";
import { mockSimulationEngine } from "../mockSimulation";

interface CopilotResponse {
  query: string;
  title: string;
  executive_summary: string;
  recommendation: string;
  rationale: string;
  confidence_pct: number;
  metrics: Record<string, string>;
  voice_script: string;
  recommended_action: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  timestamp: string;
  text?: string;
  data?: CopilotResponse;
}

interface TacticalAICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TacticalState | null;
  onAuthorizeCOA?: (coaId: string) => void;
  onInjectThreat?: () => void;
  onInjectScenario?: (scenarioType: string) => void;
}

const PRESET_QUERIES = [
  { label: "⚡ Strike Package Pairing", query: "Recommend optimal strike package for SEAD against S-400" },
  { label: "🚨 Runway Denial Audit", query: "Audit Halwara runway status and diversion resilience" },
  { label: "🛡️ Pilot Fatigue (FDL)", query: "Evaluate pilot combat duty hours and fatigue risks" },
  { label: "⛽ BINGO Fuel Margins", query: "Check fleet fuel state and bingo divert limits" },
  { label: "🎯 Current Best COA", query: "Explain why Course of Action 1 is recommended" }
];

export const TacticalAICopilotModal: React.FC<TacticalAICopilotModalProps> = ({
  isOpen,
  onClose,
  state: _state,
  onAuthorizeCOA,
  onInjectScenario
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "copilot",
      timestamp: "T+00:00",
      data: {
        query: "INITIALIZATION",
        title: "VAYU-NET TACTICAL AIR DISPATCHER ONLINE",
        executive_summary: "AI Air Operations Decision Support System initialized. Multi-source data fusion active across Link-16, IACCS radar network, and METAR feeds.",
        recommendation: "Standby for dynamic threat vectoring or execute high-priority Combat Air Patrol retasking.",
        rationale: "4 IAF airframes ready (Su-30MKI, Rafale-EH, Tejas Mk1A, Mirage 2000). SCIP MILP solver operating with sub-15ms latency.",
        confidence_pct: 99.4,
        metrics: {
          "solver_latency": "14.2 ms",
          "fmc_readiness": "100%",
          "defcon": "DEFCON 3",
          "link_16": "ACTIVE"
        },
        voice_script: "Vayu-Net Tactical Copilot online. Standing by for air tasking queries or scenario execution.",
        recommended_action: "STANDBY"
      }
    }
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || isLoading) return;

    tacticalSound.playTacticalBlip();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      text
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("http://localhost:8000/api/v1/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ query: text })
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("Copilot response failed");
      const data: CopilotResponse = await res.json();

      const copilotMsg: ChatMessage = {
        id: `copilot-${Date.now()}`,
        sender: "copilot",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        data
      };

      setMessages((prev) => [...prev, copilotMsg]);

      if (isVoiceEnabled && data.voice_script) {
        tacticalSound.speak(data.voice_script);
      }
    } catch {
      // Seamless prototype fallback
      const data = mockSimulationEngine.queryCopilot(text) as unknown as CopilotResponse;
      const copilotMsg: ChatMessage = {
        id: `copilot-${Date.now()}`,
        sender: "copilot",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        data
      };

      setMessages((prev) => [...prev, copilotMsg]);

      if (isVoiceEnabled && data.voice_script) {
        tacticalSound.speak(data.voice_script);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVoiceRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        tacticalSound.playRadioClick();
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
        handleSend(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleActionExecute = (actionCode: string) => {
    tacticalSound.playAuthorizeChime();
    if (actionCode === "AUTHORIZE_COA_1" && onAuthorizeCOA) {
      onAuthorizeCOA("COA-1");
    } else if (actionCode === "INJECT_RUNWAY_DENIAL" && onInjectScenario) {
      onInjectScenario("RUNWAY_DENIAL");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-4xl h-[88vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#000080] flex items-center justify-center text-amber-400 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-wide uppercase font-mono">
                  TACTICAL AI AIR DISPATCHER & COPILOT
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  ONLINE // MIL-SPEC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Explainable Multi-Objective AI Reasoning & Natural Language Air Tasking
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Voice Readout Toggle */}
            <button
              onClick={() => {
                tacticalSound.playTacticalBlip();
                setIsVoiceEnabled(!isVoiceEnabled);
              }}
              className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1 transition-all ${
                isVoiceEnabled
                  ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
              title={isVoiceEnabled ? "Tactical Audio Synthesis ON" : "Tactical Audio Synthesis OFF"}
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline text-[10px]">{isVoiceEnabled ? "RADIO ON" : "MUTED"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preset Prompt Pills */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 whitespace-nowrap">
            DIRECTIVES:
          </span>
          {PRESET_QUERIES.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p.query)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-300 hover:border-[#000080] hover:bg-blue-50 text-slate-700 font-medium whitespace-nowrap transition-all shadow-2xs hover:shadow-xs text-[11px] disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chat Message Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              {msg.sender === "user" ? (
                <div className="max-w-xl bg-[#000080] text-white p-3.5 rounded-2xl rounded-tr-none shadow-sm font-sans text-sm">
                  <p className="leading-relaxed">{msg.text}</p>
                  <span className="block text-[10px] text-blue-200 text-right mt-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              ) : msg.data ? (
                <div className="max-w-3xl w-full bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-mono font-bold text-xs uppercase tracking-wide">
                        {msg.data.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                      <span className="text-slate-400">CONFIDENCE:</span>
                      <span className="font-bold text-emerald-400">{msg.data.confidence_pct}%</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 text-xs">
                    {/* Executive Assessment */}
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                        OPERATIONAL EVALUATION:
                      </span>
                      <p className="text-slate-800 leading-relaxed font-sans font-medium">
                        {msg.data.executive_summary}
                      </p>
                    </div>

                    {/* Recommendation Box */}
                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/60">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-[#000080] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#000080] block text-xs">
                            RECOMMENDED COURSE OF ACTION:
                          </span>
                          <p className="text-slate-700 mt-0.5 leading-relaxed font-medium">
                            {msg.data.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mathematical & Tactical Rationale */}
                    <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200 text-[11px]">
                      <span className="font-mono font-bold uppercase text-slate-500 block mb-0.5">
                        XAI MATHEMATICAL & TACTICAL RATIONALE:
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        {msg.data.rationale}
                      </p>
                    </div>

                    {/* Quantitative Metrics Grid */}
                    {msg.data.metrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
                        {Object.entries(msg.data.metrics).map(([k, v]) => (
                          <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[9px] text-slate-400 uppercase block truncate">
                              {k.replace(/_/g, " ")}
                            </span>
                            <span className="font-black text-slate-900 text-xs mt-0.5 block truncate">
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Execution Button */}
                    {msg.data.recommended_action && msg.data.recommended_action !== "STANDBY" && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleActionExecute(msg.data!.recommended_action)}
                          className="px-3.5 py-2 rounded-xl bg-[#000080] hover:bg-blue-900 text-white font-mono text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>EXECUTE {msg.data.recommended_action.replace(/_/g, " ")}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-xl bg-white text-slate-800 p-3.5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-sm">
                  <p>{msg.text}</p>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-mono p-3 bg-white rounded-xl border border-slate-200 w-fit animate-pulse">
              <Cpu className="w-4 h-4 text-[#000080] animate-spin" />
              <span>Synthesizing multi-source radar, weather & MILP allocation...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Dock */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputQuery);
            }}
            className="flex items-center space-x-2"
          >
            {/* Mic Speech Button */}
            <button
              type="button"
              onClick={handleToggleVoiceRecognition}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? "bg-red-500 border-red-600 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
              }`}
              title={isListening ? "Listening... click to stop" : "Speak command via microphone"}
            >
              {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-slate-500" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={isListening ? "Listening to tactical speech..." : "Ask Copilot e.g., 'Recommend strike package against S-400'..."}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#000080] focus:border-transparent font-medium"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#000080] hover:bg-blue-900 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <span>SEND</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
