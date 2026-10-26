export interface Waypoint {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  name: string;
}

export interface Aircraft {
  id: string;
  callsign: string;
  aircraft_type: string;
  roles: string[];
  base_id: string;
  pilot: string;
  fdl_hours_limit: number;
  fdl_hours_elapsed: number;
  status: string;
  lat: number;
  lon: number;
  alt_ft: number;
  speed_kts: number;
  mach: number;
  heading_deg: number;
  turn_rate_deg_s?: number;
  g_load?: number;
  fuel_kg: number;
  max_fuel_kg: number;
  bingo_fuel_kg: number;
  combat_radius_km: number;
  sfc_kg_per_km: number;
  max_g: number;
  payload: string[];
  assigned_mission: string;
  waypoints: Waypoint[];
  current_wp_index: number;
  fuel_burn_kg?: number;
  threat_warning?: string;
}

export interface Airbase {
  id: string;
  name: string;
  code: string;
  squadron: string;
  lat: number;
  lon: number;
  elevation_ft: number;
  runway_heading: string;
  runway_status: string;
  fuel_atf_tons: number;
  qra_status: string;
  assigned_aircraft: string[];
  munitions_stock: Record<string, number>;
}

export interface CivilTraffic {
  id: string;
  callsign: string;
  aircraft_type: string;
  route: string;
  airway: string;
  squawk: string;
  lat: number;
  lon: number;
  alt_ft: number;
  speed_kts: number;
  heading_deg: number;
  status: string;
}

export interface SAMThreat {
  id: string;
  name: string;
  type: string;
  threat_level: string;
  lat: number;
  lon: number;
  elevation_ft?: number;
  radar_range_km: number;
  lethal_range_km: number;
  buffer_km?: number;
  min_safe_alt_ft?: number;
  status: string;
  detected_time?: string;
  threat_emitter_signature?: string;
}

export interface HostileUAV {
  id: string;
  name: string;
  type: string;
  threat_level: string;
  ingress_sector?: string;
  target_facility?: string;
  lat: number;
  lon: number;
  alt_ft: number;
  speed_kts: number;
  heading_deg: number;
  status: string;
  detected_time?: string;
  estimated_time_to_impact_sec?: number;
  payload?: string;
  neutralized?: boolean;
}

export interface PendingMission {
  id: string;
  name: string;
  required_role: string;
  priority_score: number;
  target_lat: number;
  target_lon: number;
  urgency?: string;
  status?: string;
}

export interface AirframeAssignment {
  aircraft_id: string;
  aircraft_name: string;
  aircraft_type?: string;
  assigned_task?: string;
  assigned_mission?: string;
  target?: string;
  target_distance_km?: number;
  eta_seconds?: number;
  eta_formatted?: string;
  success_probability_pct?: number;
  attrition_risk_pct?: number;
  fuel_burn_pct?: number;
  weapon_selected?: string;
  weapon_payload?: string[];
  p_kill?: number;
  flight_profile?: string;
  trajectory_profile?: string;
}

export interface XAIBreakdown {
  mathematical_rationale: string;
  dominant_objective_term: string;
  constraints_verified: string[];
}

export interface COAQMetrics {
  success_probability_pct: number;
  attrition_risk_pct: number;
  fuel_burn_pct: number;
  eta_sec: number;
  eta_formatted: string;
}

export interface COA {
  id: string;
  rank: number;
  designation: string;
  recommended: boolean;
  classification: string;
  summary: string;
  objective_value?: number;
  quantitative_metrics?: COAQMetrics;
  assignments?: AirframeAssignment[];
  explainability?: XAIBreakdown;
  // Legacy / fallback fields
  tde_score?: number;
  threat_risk_index?: number;
  fuel_delta_kg?: string;
  reaction_time_sec?: number;
  interception_window_sec?: number;
  airframe_assignments?: AirframeAssignment[];
  xai_breakdown?: XAIBreakdown;
}

export interface TacticalAlert {
  id: string;
  level: "CRITICAL" | "KESARI_ACTION" | "SUCCESS" | "WARNING" | "INFO";
  timestamp: string;
  title: string;
  message: string;
  color: "red" | "kesari" | "green" | "blue";
  lat?: number;
  lon?: number;
  latency_ms?: number;
}

export interface OptimizationResult {
  solver_engine: string;
  solver_status: string;
  latency_ms: number;
  objective_value?: number;
  weights: {
    w_priority?: number;
    w_risk?: number;
    w_cost?: number;
    w1_priority?: number;
    w2_risk?: number;
    w3_distance?: number;
  };
  candidate_evaluations: any[];
  coas: COA[];
}

export interface WeatherCell {
  id: string;
  name: string;
  type: string;
  severity: "SEVERE_NO_FLY" | "MODERATE_CAUTION" | string;
  lat: number;
  lon: number;
  radius_km: number;
  cloud_top_ft: number;
  icing_risk: string;
  turbulence: string;
  wind_vector_kts: number;
  wind_heading_deg: number;
  reflectivity_dbz: number;
  status: string;
}

export interface AirbaseMETAR {
  metar: string;
  flight_category: string;
  visibility_km: number;
  wind_kts: number;
}

export interface TacticalState {
  sim_clock: string;
  sim_time_sec: number;
  sim_speed_multiplier?: number;
  is_running: boolean;
  disruption_injected: boolean;
  coa_authorized: string | null;
  intercept_success?: boolean;
  theatre_name: string;
  defcon_level?: string;
  airbases: Airbase[];
  bases?: Airbase[];
  sorties: Aircraft[];
  fleet?: Aircraft[];
  civil_traffic?: CivilTraffic[];
  threats: SAMThreat[];
  active_threats?: SAMThreat[];
  weather_layers?: WeatherCell[];
  airbase_weather?: Record<string, AirbaseMETAR>;
  hostile_uavs?: HostileUAV[];
  pending_missions?: PendingMission[];
  active_alerts: TacticalAlert[];
  latest_optimization: OptimizationResult | null;
}
