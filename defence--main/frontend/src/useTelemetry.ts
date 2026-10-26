import { useState, useEffect, useRef, useCallback } from "react";
import type { TacticalState, COA } from "./types";
import { tacticalSound } from "./utils/audio";
import { mockSimulationEngine } from "./mockSimulation";

// Determine backend connection strategy:
// On hosted HTTPS production environments (e.g. *.vercel.app) without VITE_API_URL,
// skip polling http://localhost:8000 to avoid browser Mixed Content security blocks.
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0");

const explicitApiUrl = (import.meta as any).env?.VITE_API_URL;
const shouldAttemptBackend = Boolean(explicitApiUrl) || isLocalhost;
const API_BASE = explicitApiUrl || "http://localhost:8000";
const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws/telemetry";

export function useTelemetry() {
  // 1. Initialize immediately with rich mock state so the map & UI are NEVER blank
  const [state, setState] = useState<TacticalState>(() => mockSimulationEngine.getState());
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [wsStatus, setWsStatus] = useState<"CONNECTED" | "CONNECTING" | "DISCONNECTED">("CONNECTED");
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [selectedCOA, setSelectedCOA] = useState<COA | null>(() => {
    const initOpt = mockSimulationEngine.getState().latest_optimization;
    return initOpt?.coas?.length ? initOpt.coas[0] : null;
  });
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUsingBackendRef = useRef<boolean>(false);

  // Fallback HTTP state fetcher
  const fetchStateHttp = useCallback(async () => {
    if (!shouldAttemptBackend) {
      setIsMockMode(true);
      mockSimulationEngine.start();
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE}/api/v1/state`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: TacticalState = await res.json();
        isUsingBackendRef.current = true;
        setIsMockMode(false);
        setIsConnected(true);
        setWsStatus("CONNECTED");
        mockSimulationEngine.stop(); // Stop mock engine since backend is active
        setState(data);
        if (data.latest_optimization?.coas?.length && !selectedCOA) {
          setSelectedCOA(data.latest_optimization.coas[0]);
        }
      } else {
        // Backend returned non-200, ensure mock mode is running
        if (!isUsingBackendRef.current) {
          setIsMockMode(true);
          mockSimulationEngine.start();
        }
      }
    } catch {
      // Backend not accessible (hosted frontend standalone prototype)
      if (!isUsingBackendRef.current) {
        setIsMockMode(true);
        mockSimulationEngine.start();
      }
    }
  }, [selectedCOA]);

  // WebSocket lifecycle management
  const connectWebSocket = useCallback(() => {
    if (!shouldAttemptBackend) {
      setIsMockMode(true);
      setIsConnected(true);
      setWsStatus("CONNECTED");
      mockSimulationEngine.start();
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        isUsingBackendRef.current = true;
        setIsMockMode(false);
        setIsConnected(true);
        setWsStatus("CONNECTED");
        mockSimulationEngine.stop();
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "INITIAL_STATE" || payload.type === "STATE_SNAPSHOT") {
            const newState: TacticalState = payload.state;
            setState(newState);
            if (newState.latest_optimization?.coas?.length) {
              setSelectedCOA((prev) => prev || newState.latest_optimization!.coas[0]);
            }
          } else if (payload.type === "TELEMETRY_UPDATE") {
            setState((prevState) => {
              if (!prevState) return prevState;

              // Merge live aircraft positions and telemetry
              const updatedAircraftMap = new Map<string, any>(
                payload.aircraft.map((a: any) => [a.id, a])
              );
              const mergedSorties = prevState.sorties.map((ac) => {
                const live = updatedAircraftMap.get(ac.id);
                if (live) {
                  return {
                    ...ac,
                    lat: live.lat,
                    lon: live.lon,
                    alt_ft: live.alt_ft,
                    speed_kts: live.speed_kts,
                    mach: live.mach,
                    heading_deg: live.heading_deg,
                    turn_rate_deg_s: live.turn_rate_deg_s,
                    fuel_kg: live.fuel_kg,
                    fuel_burn_kg: live.fuel_burn_kg,
                    threat_warning: live.threat_warning,
                    status: live.status
                  };
                }
                return ac;
              });

              // Merge threats and weather if present
              const activeThreats =
                payload.active_threats || prevState.active_threats || prevState.threats;
              const weatherLayers = payload.weather_layers || prevState.weather_layers;
              const airbaseWeather = payload.airbase_weather || prevState.airbase_weather;

              return {
                ...prevState,
                sim_clock: payload.timestamp || prevState.sim_clock,
                sim_time_sec: payload.sim_time_sec ?? prevState.sim_time_sec,
                defcon_level: payload.defcon_level || prevState.defcon_level,
                sorties: mergedSorties,
                fleet: mergedSorties,
                threats: activeThreats,
                active_threats: activeThreats,
                hostile_uavs: payload.hostile_uavs ?? prevState.hostile_uavs,
                airbases: payload.airbases ?? prevState.airbases,
                bases: payload.airbases ?? prevState.bases,
                weather_layers: weatherLayers,
                airbase_weather: airbaseWeather,
                active_alerts: payload.recent_alerts?.length
                  ? payload.recent_alerts
                  : prevState.active_alerts
              };
            });
          }
        } catch (e) {
          console.error("Failed to parse telemetry message:", e);
        }
      };

      ws.onclose = () => {
        // Backend disconnected or unavailable: switch to Mock Simulation Engine
        isUsingBackendRef.current = false;
        setIsMockMode(true);
        setIsConnected(true); // Connected to internal 2Hz mock simulation engine
        setWsStatus("CONNECTED");
        wsRef.current = null;
        mockSimulationEngine.start();

        // Retry connecting to backend in background every 6s
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 6000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      isUsingBackendRef.current = false;
      setIsMockMode(true);
      setIsConnected(true);
      setWsStatus("CONNECTED");
      mockSimulationEngine.start();
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 6000);
    }
  }, []);

  useEffect(() => {
    // 1. Subscribe to local Mock Simulation Engine immediately
    const unsubscribeMock = mockSimulationEngine.subscribe((mockState) => {
      if (!isUsingBackendRef.current) {
        setState(mockState);
      }
    });

    // Start mock simulation loop right away
    mockSimulationEngine.start();

    // 2. Try background detection of real backend
    fetchStateHttp();
    connectWebSocket();

    // Occasional HTTP heartbeat probe
    const pollInterval = setInterval(() => {
      if (!isUsingBackendRef.current) {
        fetchStateHttp();
      }
    }, 8000);

    return () => {
      unsubscribeMock();
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      mockSimulationEngine.stop();
    };
  }, [fetchStateHttp, connectWebSocket]);

  // Action: Inject Dynamic Pop-Up Threat
  const injectThreat = async (customPayload?: any) => {
    setActionLoading(true);
    setActionNotice("INJECTING S-400 POP-UP AMBUSH BATTERY...");
    tacticalSound.playThreatAlert();

    // If in mock mode or backend fails, run through MockSimulationEngine
    if (isMockMode || !isUsingBackendRef.current) {
      const res = mockSimulationEngine.injectThreat(customPayload);
      setState(res.state);
      if (res.optimization?.coas?.length) {
        setSelectedCOA(res.optimization.coas[0]);
      }
      setActionNotice("THREAT INJECTED: S-400 ILLUMINATION DETECTED. DEFCON 2 ACTIVE.");
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${API_BASE}/api/v1/inject-threat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(
          customPayload || {
            id: "SAM-S400-AMBUSH",
            name: "Mobile S-400 Ambush",
            type: "SAM_LONG_RANGE",
            lat: 31.35,
            lon: 75.65,
            radius_km: 75.0,
            radar_range_km: 180.0,
            threat_level: "CRITICAL_LETHAL"
          }
        )
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        }
        if (data.optimization?.coas?.length) {
          setSelectedCOA(data.optimization.coas[0]);
        }
        setActionNotice("THREAT INJECTED: S-400 ILLUMINATION DETECTED. DEFCON 2 ACTIVE.");
      } else {
        throw new Error("Backend response error");
      }
    } catch {
      // Seamless mock fallback
      const mockRes = mockSimulationEngine.injectThreat(customPayload);
      setState(mockRes.state);
      if (mockRes.optimization?.coas?.length) {
        setSelectedCOA(mockRes.optimization.coas[0]);
      }
      setActionNotice("THREAT INJECTED: S-400 ILLUMINATION DETECTED. DEFCON 2 ACTIVE.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Action: Authorize Selected COA
  const authorizeCOA = async (coaId: string) => {
    setActionLoading(true);
    setActionNotice(`TRANSMITTING AUTHORIZATION FOR ${coaId}...`);
    tacticalSound.playAuthorizeChime();

    if (isMockMode || !isUsingBackendRef.current) {
      const res = mockSimulationEngine.authorizeCOA(coaId);
      setState(res.state);
      setActionNotice(`COMMAND EXECUTED: ${coaId} DISPATCH ORDERS TRANSMITTED`);
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${API_BASE}/api/v1/coa/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ coa_id: coaId })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        }
        setActionNotice(`COMMAND EXECUTED: ${coaId} DISPATCH ORDERS TRANSMITTED`);
      } else {
        throw new Error("Authorization call failed");
      }
    } catch {
      const mockRes = mockSimulationEngine.authorizeCOA(coaId);
      setState(mockRes.state);
      setActionNotice(`COMMAND EXECUTED: ${coaId} DISPATCH ORDERS TRANSMITTED`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Action: Re-run MILP Optimization
  const reOptimize = async (weights?: { w_priority?: number; w_risk?: number; w_cost?: number }) => {
    setActionLoading(true);
    setActionNotice("COMPUTING MILP SCIP OPTIMIZATION...");
    tacticalSound.playTacticalBlip();

    if (isMockMode || !isUsingBackendRef.current) {
      const optResult = mockSimulationEngine.reOptimize(weights);
      setState((prev) => ({ ...prev, latest_optimization: optResult }));
      if (optResult.coas?.length) {
        setSelectedCOA(optResult.coas[0]);
      }
      setActionNotice(`OPTIMIZATION COMPLETE (${optResult.latency_ms} ms)`);
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 4000);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE}/api/v1/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(
          weights || {
            w_priority: 1.0,
            w_risk: 0.85,
            w_cost: 0.002
          }
        )
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const optResult = await res.json();
        setState((prev) => ({ ...prev, latest_optimization: optResult }));
        if (optResult.coas?.length) {
          setSelectedCOA(optResult.coas[0]);
        }
        setActionNotice(`OPTIMIZATION COMPLETE (${optResult.latency_ms} ms)`);
      } else {
        throw new Error("Optimization API failed");
      }
    } catch {
      const optResult = mockSimulationEngine.reOptimize(weights);
      setState((prev) => ({ ...prev, latest_optimization: optResult }));
      if (optResult.coas?.length) {
        setSelectedCOA(optResult.coas[0]);
      }
      setActionNotice(`OPTIMIZATION COMPLETE (${optResult.latency_ms} ms)`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Action: Reset Sector
  const resetSector = async () => {
    setActionLoading(true);
    setActionNotice("RESETTING SECTOR TO BASELINE T+00:00...");
    tacticalSound.playTacticalBlip();

    if (isMockMode || !isUsingBackendRef.current) {
      const res = mockSimulationEngine.resetSector();
      setState(res.state);
      if (res.state.latest_optimization?.coas?.length) {
        setSelectedCOA(res.state.latest_optimization.coas[0]);
      } else {
        setSelectedCOA(null);
      }
      setActionNotice("SECTOR RESTORED TO BASELINE (DEFCON 3)");
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 4000);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${API_BASE}/api/v1/reset`, {
        method: "POST",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
          if (data.state.latest_optimization?.coas?.length) {
            setSelectedCOA(data.state.latest_optimization.coas[0]);
          } else {
            setSelectedCOA(null);
          }
        }
        setActionNotice("SECTOR RESTORED TO BASELINE (DEFCON 3)");
      } else {
        throw new Error("Reset endpoint failed");
      }
    } catch {
      const res = mockSimulationEngine.resetSector();
      setState(res.state);
      if (res.state.latest_optimization?.coas?.length) {
        setSelectedCOA(res.state.latest_optimization.coas[0]);
      } else {
        setSelectedCOA(null);
      }
      setActionNotice("SECTOR RESTORED TO BASELINE (DEFCON 3)");
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Action: Inject Crisis Stress-Test Scenario
  const injectScenario = async (scenarioType: string) => {
    setActionLoading(true);
    setActionNotice(`INJECTING SCENARIO: ${scenarioType}...`);
    tacticalSound.playThreatAlert();

    if (isMockMode || !isUsingBackendRef.current) {
      const res = mockSimulationEngine.injectScenario(scenarioType);
      setState(res.state);
      if (res.state.latest_optimization?.coas?.length) {
        setSelectedCOA(res.state.latest_optimization.coas[0]);
      }
      setActionNotice(`SCENARIO ACTIVE: ${scenarioType} (RE-SOLVED in ${res.latency_ms} ms)`);
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${API_BASE}/api/v1/scenario/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ scenario_type: scenarioType })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
          if (data.state.latest_optimization?.coas?.length) {
            setSelectedCOA(data.state.latest_optimization.coas[0]);
          }
        }
        setActionNotice(`SCENARIO ACTIVE: ${scenarioType} (RE-SOLVED in ${data.latency_ms} ms)`);
      } else {
        throw new Error("Scenario injection failed");
      }
    } catch {
      const res = mockSimulationEngine.injectScenario(scenarioType);
      setState(res.state);
      if (res.state.latest_optimization?.coas?.length) {
        setSelectedCOA(res.state.latest_optimization.coas[0]);
      }
      setActionNotice(`SCENARIO ACTIVE: ${scenarioType} (RE-SOLVED in ${res.latency_ms} ms)`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Action: Simulation Control (Pause / Resume / Speed)
  const setSimulationControl = (action: "pause" | "resume" | "speed", speed?: number) => {
    mockSimulationEngine.setSimulationControl(action, speed);
    if (!isMockMode && isUsingBackendRef.current) {
      fetch(`${API_BASE}/api/v1/simulation/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, speed_multiplier: speed })
      }).catch(() => {});
    }
  };

  return {
    state,
    isConnected,
    wsStatus,
    isMockMode,
    selectedCOA,
    setSelectedCOA,
    actionLoading,
    actionNotice,
    injectThreat,
    injectScenario,
    authorizeCOA,
    reOptimize,
    resetSector,
    setSimulationControl,
    refreshState: fetchStateHttp
  };
}
