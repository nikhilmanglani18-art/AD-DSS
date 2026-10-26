import { useState } from "react";
import { useTelemetry } from "./useTelemetry";
import { Header } from "./components/Header";
import { FleetPanel } from "./components/FleetPanel";
import { TacticalMap } from "./components/TacticalMap";
import { COATerminal } from "./components/COATerminal";
import { BottomDock } from "./components/BottomDock";
import { TheaterSitrepModal } from "./components/TheaterSitrepModal";
import { CockpitHudModal } from "./components/CockpitHudModal";
import { TacticalAICopilotModal } from "./components/TacticalAICopilotModal";
import { WhatIfSandboxModal } from "./components/WhatIfSandboxModal";
import { DataLinkModal } from "./components/DataLinkModal";
import type { Aircraft } from "./types";

export default function App() {
  const {
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
    setSimulationControl
  } = useTelemetry();

  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(undefined);

  // Modal Dialog States
  const [isSitrepOpen, setIsSitrepOpen] = useState<boolean>(false);
  const [isCockpitOpen, setIsCockpitOpen] = useState<boolean>(false);
  const [cockpitAircraftId, setCockpitAircraftId] = useState<string | undefined>(undefined);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const [isDataLinkOpen, setIsDataLinkOpen] = useState<boolean>(false);

  const aircraftList = state?.sorties || state?.fleet || [];
  const airbasesList = state?.airbases || state?.bases || [];
  const threatsList = state?.threats || state?.active_threats || [];
  const missionsList = state?.pending_missions || [];
  const weatherList = state?.weather_layers || [];
  const hostileUavsList = state?.hostile_uavs || [];
  const airbaseWeatherMap = state?.airbase_weather || {};
  const coas = state?.latest_optimization?.coas || [];

  const handleSelectAircraft = (ac: Aircraft) => {
    setSelectedAircraftId((prev) => (prev === ac.id ? undefined : ac.id));
  };

  const handleOpenCockpit = (aircraftId?: string) => {
    setCockpitAircraftId(aircraftId || selectedAircraftId || aircraftList[0]?.id);
    setIsCockpitOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden select-none">
      {/* 1. Tactical Header with Tricolour Accent, Zulu Clocks & Action Launcher */}
      <Header
        state={state}
        isConnected={isConnected}
        wsStatus={wsStatus}
        isMockMode={isMockMode}
        onOpenSitrep={() => setIsSitrepOpen(true)}
        onOpenCockpit={() => handleOpenCockpit()}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenDataLink={() => setIsDataLinkOpen(true)}
      />

      {/* MODAL 1: Complete Theater Situation Report & Resource Audit */}
      <TheaterSitrepModal
        isOpen={isSitrepOpen}
        onClose={() => setIsSitrepOpen(false)}
        state={state}
      />

      {/* MODAL 2: Cockpit HUD Glass Display (MIL-STD-1787C Symbology) */}
      <CockpitHudModal
        isOpen={isCockpitOpen}
        onClose={() => setIsCockpitOpen(false)}
        aircraftList={aircraftList}
        threats={threatsList}
        initialAircraftId={cockpitAircraftId}
        onScramble={() => authorizeCOA("COA-1")}
      />

      {/* MODAL 3: Tactical AI Air Dispatcher & Voice Copilot */}
      <TacticalAICopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        state={state}
        onAuthorizeCOA={authorizeCOA}
        onInjectThreat={() => injectThreat()}
        onInjectScenario={injectScenario}
      />

      {/* MODAL 4: War Game "What-If" Scenario Stress-Test Sandbox */}
      <WhatIfSandboxModal
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        state={state}
        onInjectScenario={injectScenario}
        onReset={resetSector}
      />

      {/* MODAL 5: Link-16 / IACCS Electronic Warfare & Tactical Data Link Monitor */}
      <DataLinkModal
        isOpen={isDataLinkOpen}
        onClose={() => setIsDataLinkOpen(false)}
        state={state}
      />

      {/* 2. Main 12-Column Tactical Grid Workspace */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-3.5 p-3.5 overflow-hidden">
        {/* Left Panel (col-span-3): Fleet Readiness & Airbases */}
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <FleetPanel
            aircraft={aircraftList}
            airbases={airbasesList}
            airbaseWeather={airbaseWeatherMap}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={handleSelectAircraft}
            onOpenCockpit={handleOpenCockpit}
          />
        </div>

        {/* Center Panel (col-span-6): Interactive 2D Situation Map */}
        <div className="col-span-6 h-full min-h-0 overflow-hidden">
          <TacticalMap
            aircraft={aircraftList}
            airbases={airbasesList}
            threats={threatsList}
            missions={missionsList}
            weather={weatherList}
            hostileUavs={hostileUavsList}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={handleSelectAircraft}
            onInjectThreat={injectThreat}
            onAuthorizeCOA={authorizeCOA}
            onOpenCockpit={handleOpenCockpit}
          />
        </div>

        {/* Right Panel (col-span-3): Dynamic COA Decision Terminal */}
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <COATerminal
            coas={coas}
            selectedCOA={selectedCOA}
            onSelectCOA={setSelectedCOA}
            onAuthorize={authorizeCOA}
            isAuthorizing={actionLoading}
            authorizedCOAId={state?.coa_authorized || null}
          />
        </div>
      </main>

      {/* 3. Bottom Scenario Injector Dock, Speed Controls & Alert Ticker */}
      <BottomDock
        onInjectThreat={() => injectThreat()}
        onResetSector={resetSector}
        onReOptimize={() => reOptimize()}
        onOpenSandbox={() => setIsSandboxOpen(true)}
        onSimulationControl={setSimulationControl}
        isLoading={actionLoading}
        actionNotice={actionNotice}
        alerts={state?.active_alerts || []}
        simClock={state?.sim_clock || "T+00:00.00"}
      />
    </div>
  );
}
