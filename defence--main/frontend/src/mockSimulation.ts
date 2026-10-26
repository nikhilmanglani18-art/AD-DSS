import type {
  TacticalState,
  Aircraft,
  Airbase,
  SAMThreat,
  PendingMission,
  WeatherCell,
  AirbaseMETAR,
  CivilTraffic,
  OptimizationResult,
  TacticalAlert,
  COA
} from "./types";

// Cartographic Projection Constants (Northern & Western Sector Air Defence Theatre)
const ORIGIN_LAT = 30.85;
const ORIGIN_LON = 75.80;

export function latlonToTacticalKm(lat: number, lon: number): [number, number] {
  const latRad = (ORIGIN_LAT * Math.PI) / 180;
  const kmPerDegLat = 111.132;
  const kmPerDegLon = 111.32 * Math.cos(latRad);
  const x = (lon - ORIGIN_LON) * kmPerDegLon;
  const y = (lat - ORIGIN_LAT) * kmPerDegLat;
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

export function tacticalKmToLatlon(x: number, y: number): [number, number] {
  const latRad = (ORIGIN_LAT * Math.PI) / 180;
  const kmPerDegLat = 111.132;
  const kmPerDegLon = 111.32 * Math.cos(latRad);
  const lat = ORIGIN_LAT + y / kmPerDegLat;
  const lon = ORIGIN_LON + x / kmPerDegLon;
  return [Number(lat.toFixed(4)), Number(lon.toFixed(4))];
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((R * c).toFixed(2));
}

// -----------------------------------------------------------------------------
// Baseline Tactical Data Definitions
// -----------------------------------------------------------------------------

export const BASELINE_AIRBASES: Airbase[] = [
  {
    id: "AFS_AMB",
    name: "Ambala Air Force Station",
    code: "AMB",
    squadron: "No. 17 Squadron 'Golden Arrows'",
    lat: 30.37,
    lon: 76.815,
    elevation_ft: 900,
    runway_heading: "12/30",
    runway_status: "FMC_GREEN",
    fuel_atf_tons: 2800.0,
    qra_status: "ALERT_5_READY",
    assigned_aircraft: ["RAFALE-DELTA", "TIGER-2"],
    munitions_stock: {
      Meteor_BVRAAM: 48,
      SCALP_EG: 24,
      MICA_IR_EM: 96,
      Hammer_AASM: 64
    }
  },
  {
    id: "AFS_HLW",
    name: "Halwara Air Force Station",
    code: "HLW",
    squadron: "No. 221 Squadron 'Valiants'",
    lat: 30.749,
    lon: 75.633,
    elevation_ft: 780,
    runway_heading: "14/32",
    runway_status: "FMC_GREEN",
    fuel_atf_tons: 3200.0,
    qra_status: "ALERT_15",
    assigned_aircraft: ["SU30-TIGER1", "TEJAS-COBRA"],
    munitions_stock: {
      Astra_Mk1: 80,
      R77_R73: 120,
      BrahMos_A: 16,
      Python_5: 50
    }
  },
  {
    id: "AFS_ADP",
    name: "Adampur Air Force Station",
    code: "ADP",
    squadron: "No. 47 Squadron 'Black Archers'",
    lat: 31.433,
    lon: 75.758,
    elevation_ft: 775,
    runway_heading: "13/31",
    runway_status: "FMC_GREEN",
    fuel_atf_tons: 1950.0,
    qra_status: "ALERT_10",
    assigned_aircraft: ["GARUDA-1"],
    munitions_stock: {
      R77: 54,
      R73: 80,
      MICA: 42,
      KAB_500: 30
    }
  },
  {
    id: "AFS_SRS",
    name: "Sirsa Air Force Station",
    code: "SRS",
    squadron: "No. 21 Squadron 'Ankush'",
    lat: 29.531,
    lon: 75.006,
    elevation_ft: 650,
    runway_heading: "05/23",
    runway_status: "FMC_GREEN",
    fuel_atf_tons: 1600.0,
    qra_status: "ALERT_15",
    assigned_aircraft: ["TEJAS-COBRA"],
    munitions_stock: {
      Astra_Mk1: 36,
      Python_5: 48,
      R73: 40,
      Sudarshan_LGB: 24
    }
  },
  {
    id: "AFS_BLY",
    name: "Bareilly Air Force Station (Trishul)",
    code: "BLY",
    squadron: "No. 24 Squadron 'Hunting Hawks'",
    lat: 28.422,
    lon: 79.45,
    elevation_ft: 560,
    runway_heading: "11/29",
    runway_status: "FMC_GREEN",
    fuel_atf_tons: 3600.0,
    qra_status: "ALERT_10",
    assigned_aircraft: ["MIRAGE-GARUDA"],
    munitions_stock: {
      MICA_EM: 60,
      Magic_II: 70,
      SPICE_2000: 32,
      Crystal_Maze: 18
    }
  }
];

export const BASELINE_AIRCRAFT: Aircraft[] = [
  {
    id: "SU30-TIGER1",
    callsign: "Tiger-1 Flight (Lead)",
    aircraft_type: "Su-30MKI",
    roles: ["Air Superiority", "BVR Intercept", "Strike"],
    base_id: "AFS_HLW",
    pilot: "Wg Cdr V. Joshi (IAF)",
    fdl_hours_limit: 6.5,
    fdl_hours_elapsed: 1.4,
    status: "ON_PATROL",
    lat: 31.62,
    lon: 75.15,
    alt_ft: 28000,
    speed_kts: 520,
    mach: 0.88,
    heading_deg: 310,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 6400,
    max_fuel_kg: 9400,
    bingo_fuel_kg: 2600,
    combat_radius_km: 1500,
    sfc_kg_per_km: 4.2,
    max_g: 9.0,
    payload: ["4x Astra Mk1 (110km)", "2x R-73 IR", "Sapfir-001 Jammer"],
    assigned_mission: "CAP_SECTOR_BRAVO",
    waypoints: [
      { id: "WP-T1-1", lat: 31.62, lon: 75.15, alt: 28000, name: "BRAVO_NORTH" },
      { id: "WP-T1-2", lat: 31.95, lon: 74.8, alt: 28000, name: "BRAVO_ORBIT_A" },
      { id: "WP-T1-3", lat: 31.7, lon: 74.5, alt: 28000, name: "BRAVO_ORBIT_B" },
      { id: "WP-T1-4", lat: 31.2, lon: 75.1, alt: 28000, name: "BRAVO_RETURN" }
    ],
    current_wp_index: 1,
    fuel_burn_kg: 0.0
  },
  {
    id: "RAFALE-DELTA",
    callsign: "Delta-QRA Standby (Alert 5)",
    aircraft_type: "Rafale-EH",
    roles: ["Quick Reaction Alert", "BVR Intercept", "Deep Strike", "SEAD"],
    base_id: "AFS_AMB",
    pilot: "Flt Lt N. Sengupta (IAF)",
    fdl_hours_limit: 6.5,
    fdl_hours_elapsed: 0.0,
    status: "STANDBY_QRA_5MIN",
    lat: 30.37,
    lon: 76.815,
    alt_ft: 900,
    speed_kts: 0,
    mach: 0.0,
    heading_deg: 300,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 6800,
    max_fuel_kg: 6800,
    bingo_fuel_kg: 1900,
    combat_radius_km: 1850,
    sfc_kg_per_km: 3.1,
    max_g: 9.0,
    payload: ["4x Meteor BVRAAM", "2x MICA IR", "SPECTRA EW Suite"],
    assigned_mission: "QRA_STANDBY",
    waypoints: [
      { id: "WP-DQ-1", lat: 30.37, lon: 76.815, alt: 900, name: "AMB_TARMAC_HOLD" }
    ],
    current_wp_index: 0,
    fuel_burn_kg: 0.0
  },
  {
    id: "TIGER-2",
    callsign: "Tiger-2 Flight",
    aircraft_type: "Rafale-DH",
    roles: ["Air Superiority", "BVR Intercept", "Deep Strike", "SEAD"],
    base_id: "AFS_AMB",
    pilot: "Sqn Ldr R. Rathore (IAF)",
    fdl_hours_limit: 6.5,
    fdl_hours_elapsed: 1.2,
    status: "ON_PATROL",
    lat: 31.35,
    lon: 74.88,
    alt_ft: 32000,
    speed_kts: 540,
    mach: 0.92,
    heading_deg: 335,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 4700,
    max_fuel_kg: 6800,
    bingo_fuel_kg: 1900,
    combat_radius_km: 1850,
    sfc_kg_per_km: 3.1,
    max_g: 9.0,
    payload: ["4x Meteor BVRAAM", "2x MICA IR", "SPECTRA EW Suite"],
    assigned_mission: "FORWARD_RECON_ALPHA",
    waypoints: [
      { id: "WP-T2-1", lat: 31.35, lon: 74.88, alt: 32000, name: "T2_ALPHA_INGRESS" },
      { id: "WP-T2-2", lat: 31.65, lon: 74.6, alt: 32000, name: "T2_MID_POINT" },
      { id: "WP-T2-3", lat: 31.88, lon: 74.32, alt: 32000, name: "T2_PRIMARY_GATE" },
      { id: "WP-T2-4", lat: 31.4, lon: 75.3, alt: 30000, name: "T2_EGRESS" }
    ],
    current_wp_index: 1,
    fuel_burn_kg: 0.0
  },
  {
    id: "TEJAS-COBRA",
    callsign: "Cobra-1 Flight",
    aircraft_type: "Tejas Mk1A",
    roles: ["Combat Air Patrol", "Point Intercept", "Light Attack"],
    base_id: "AFS_HLW",
    pilot: "Sqn Ldr A. Nair (IAF)",
    fdl_hours_limit: 5.5,
    fdl_hours_elapsed: 0.8,
    status: "ON_PATROL",
    lat: 30.15,
    lon: 74.72,
    alt_ft: 24000,
    speed_kts: 480,
    mach: 0.82,
    heading_deg: 15,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 2450,
    max_fuel_kg: 3400,
    bingo_fuel_kg: 1100,
    combat_radius_km: 850,
    sfc_kg_per_km: 2.4,
    max_g: 8.0,
    payload: ["2x Astra Mk1", "2x Python-5", "Uttam AESA Radar"],
    assigned_mission: "CAP_SECTOR_CHARLIE",
    waypoints: [
      { id: "WP-C1-1", lat: 30.15, lon: 74.72, alt: 24000, name: "CHARLIE_SOUTH" },
      { id: "WP-C1-2", lat: 30.55, lon: 74.9, alt: 24000, name: "CHARLIE_NORTH" },
      { id: "WP-C1-3", lat: 30.3, lon: 75.25, alt: 24000, name: "CHARLIE_EAST" }
    ],
    current_wp_index: 1,
    fuel_burn_kg: 0.0
  },
  {
    id: "MIRAGE-GARUDA",
    callsign: "Garuda-1 Flight (Vajra)",
    aircraft_type: "Mirage 2000",
    roles: ["Precision Strike", "SEAD", "BVR Intercept"],
    base_id: "AFS_BLY",
    pilot: "Wg Cdr K. Sharma (IAF)",
    fdl_hours_limit: 6.0,
    fdl_hours_elapsed: 1.1,
    status: "ON_PATROL",
    lat: 31.25,
    lon: 75.95,
    alt_ft: 26000,
    speed_kts: 500,
    mach: 0.85,
    heading_deg: 285,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 3200,
    max_fuel_kg: 4000,
    bingo_fuel_kg: 1400,
    combat_radius_km: 1200,
    sfc_kg_per_km: 2.9,
    max_g: 9.0,
    payload: ["2x MICA EM", "2x Magic II", "RDY-3 Radar", "SPICE-2000"],
    assigned_mission: "FORWARD_RECON_ALPHA",
    waypoints: [
      { id: "WP-G1-1", lat: 31.25, lon: 75.95, alt: 26000, name: "GARUDA_HOLD" },
      { id: "WP-G1-2", lat: 31.45, lon: 75.4, alt: 26000, name: "GARUDA_WEST" },
      { id: "WP-G1-3", lat: 31.1, lon: 75.5, alt: 26000, name: "GARUDA_BASE" }
    ],
    current_wp_index: 1,
    fuel_burn_kg: 0.0
  },
  {
    id: "NETRA-1",
    callsign: "Netra Eye-In-The-Sky (AEW&C)",
    aircraft_type: "DRDO Netra",
    roles: ["Airborne Early Warning", "Tactical Battle Management", "Sensor Fusion"],
    base_id: "AFS_AMB",
    pilot: "Gp Capt S. Bannerjee (IAF)",
    fdl_hours_limit: 8.0,
    fdl_hours_elapsed: 2.1,
    status: "ON_STATION",
    lat: 29.8,
    lon: 76.2,
    alt_ft: 36000,
    speed_kts: 420,
    mach: 0.72,
    heading_deg: 90,
    turn_rate_deg_s: 0.0,
    g_load: 1.0,
    fuel_kg: 5900,
    max_fuel_kg: 8500,
    bingo_fuel_kg: 2200,
    combat_radius_km: 2400,
    sfc_kg_per_km: 2.2,
    max_g: 3.0,
    payload: ["AESA Secondary Radar", "ESM/ELINT Suite", "Link-16 TADIL-J TacNet"],
    assigned_mission: "COP_AIRBORNE_SURVEILLANCE",
    waypoints: [
      { id: "WP-N1-1", lat: 29.8, lon: 76.2, alt: 36000, name: "ORBIT_WEST" },
      { id: "WP-N1-2", lat: 29.8, lon: 76.9, alt: 36000, name: "ORBIT_EAST" }
    ],
    current_wp_index: 1,
    fuel_burn_kg: 0.0
  }
];

export const BASELINE_SAM_THREATS: SAMThreat[] = [
  {
    id: "SAM-HQ9-01",
    name: "HQ-9B Long-Range SAM Battery",
    type: "SAM_LONG_RANGE",
    threat_level: "HIGH_HOSTILE",
    lat: 32.2,
    lon: 74.05,
    elevation_ft: 820,
    radar_range_km: 200.0,
    lethal_range_km: 100.0,
    buffer_km: 15.0,
    min_safe_alt_ft: 40000,
    status: "ACTIVE_TRACKING",
    detected_time: "T+00:00",
    threat_emitter_signature: "RADAR_HQ9_TYPE_305A"
  }
];

export const BASELINE_PENDING_MISSIONS: PendingMission[] = [
  {
    id: "TASK-AIR-SUPERIORITY-01",
    name: "Sector Bravo Combat Air Patrol & Superiority Sweep",
    required_role: "Air Superiority",
    priority_score: 92.0,
    target_lat: 31.95,
    target_lon: 74.8,
    urgency: "HIGH",
    status: "ASSIGNED"
  },
  {
    id: "TASK-INTERCEPT-02",
    name: "Urgent BVR Intercept of Ingressing Fast-Mover Package",
    required_role: "BVR Intercept",
    priority_score: 98.0,
    target_lat: 32.4,
    target_lon: 74.1,
    urgency: "CRITICAL",
    status: "PENDING_ALLOCATION"
  },
  {
    id: "TASK-SEAD-03",
    name: "Suppression of Enemy Air Defenses (SEAD) Corridor Escort",
    required_role: "SEAD",
    priority_score: 88.0,
    target_lat: 31.85,
    target_lon: 74.3,
    urgency: "MEDIUM",
    status: "PENDING_ALLOCATION"
  }
];

export const BASELINE_WEATHER_LAYERS: WeatherCell[] = [
  {
    id: "WX-STORM-CELL-01",
    name: "Severe Convective Storm Front (CB Cell)",
    type: "CUMULONIMBUS_CONVECTIVE",
    severity: "SEVERE_NO_FLY",
    lat: 32.7,
    lon: 75.8,
    radius_km: 42.0,
    cloud_top_ft: 45000,
    icing_risk: "SEVERE",
    turbulence: "EXTREME",
    wind_vector_kts: 45,
    wind_heading_deg: 280,
    reflectivity_dbz: 54,
    status: "ACTIVE_EXPANDING"
  },
  {
    id: "WX-FRONT-02",
    name: "Marginal Weather / Rain Shower Band",
    type: "STRATIFORM_RAIN",
    severity: "MODERATE_CAUTION",
    lat: 29.8,
    lon: 74.2,
    radius_km: 30.0,
    cloud_top_ft: 22000,
    icing_risk: "LIGHT",
    turbulence: "MODERATE",
    wind_vector_kts: 22,
    wind_heading_deg: 310,
    reflectivity_dbz: 32,
    status: "DRIFTING_EAST"
  }
];

export const BASELINE_AIRBASE_METAR: Record<string, AirbaseMETAR> = {
  AFS_AMB: {
    metar: "VIAM 090000Z 29012KT 9999 FEW030 26/18 Q1012 NOSIG",
    flight_category: "VFR_GREEN",
    visibility_km: 10.0,
    wind_kts: 12
  },
  AFS_HLW: {
    metar: "VIHW 090000Z 31015G25KT 8000 SCT025 25/19 Q1011 TEMPO SHRA",
    flight_category: "MVFR_AMBER",
    visibility_km: 8.0,
    wind_kts: 15
  },
  AFS_ADP: {
    metar: "VIAP 090000Z 28010KT 9999 SCT030 27/17 Q1012 NOSIG",
    flight_category: "VFR_GREEN",
    visibility_km: 10.0,
    wind_kts: 10
  },
  AFS_SRS: {
    metar: "VISA 090000Z 30008KT 9999 SKC 29/18 Q1013 NOSIG",
    flight_category: "VFR_GREEN",
    visibility_km: 10.0,
    wind_kts: 8
  },
  AFS_BLY: {
    metar: "VIBY 090000Z 18008KT 9999 NSC 28/21 Q1013 NOSIG",
    flight_category: "VFR_GREEN",
    visibility_km: 10.0,
    wind_kts: 8
  }
};

export const BASELINE_CIVIL_TRAFFIC: CivilTraffic[] = [
  {
    id: "AIC-102",
    callsign: "Air India 102",
    aircraft_type: "Boeing 787-8",
    route: "VIDP (Delhi) -> EGLL (London)",
    airway: "J121 / UL333",
    squawk: "7741",
    lat: 31.9,
    lon: 76.1,
    alt_ft: 38000,
    speed_kts: 490,
    heading_deg: 315,
    status: "CIVIL_CLEARED"
  },
  {
    id: "IGO-405",
    callsign: "IndiGo 405",
    aircraft_type: "Airbus A320neo",
    route: "VISR (Srinagar) -> VIDP (Delhi)",
    airway: "W20",
    squawk: "4321",
    lat: 32.2,
    lon: 75.3,
    alt_ft: 34000,
    speed_kts: 460,
    heading_deg: 140,
    status: "CIVIL_CLEARED"
  },
  {
    id: "SEJ-812",
    callsign: "SpiceJet 812",
    aircraft_type: "Boeing 737-800",
    route: "VIAR (Amritsar) -> VABB (Mumbai)",
    airway: "L333",
    squawk: "5214",
    lat: 30.6,
    lon: 74.9,
    alt_ft: 36000,
    speed_kts: 475,
    heading_deg: 190,
    status: "CIVIL_CLEARED"
  }
];

export const BASELINE_COAS: COA[] = [
  {
    id: "COA-1",
    rank: 1,
    designation: "ALPHA HIGH-MACH INTERCEPT & FORWARD SWEEP",
    recommended: true,
    classification: "SECRET // VAYUSENA C2",
    summary:
      "Scramble Rafale Delta from Ambala AFS on high-mach climb to FL320. Su-30MKI Tiger-1 covers Sector Bravo northern flank while Tejas Mk1A provides lower-tier point defence.",
    objective_value: 184.6,
    quantitative_metrics: {
      success_probability_pct: 94.8,
      attrition_risk_pct: 4.8,
      fuel_burn_pct: 24.2,
      eta_sec: 165,
      eta_formatted: "2m 45s (165s)"
    },
    assignments: [
      {
        aircraft_id: "RAFALE-DELTA",
        aircraft_name: "Rafale-EH (Delta-QRA)",
        aircraft_type: "Rafale-EH",
        assigned_mission: "Urgent BVR Intercept of Hostile Threats",
        target_distance_km: 74.2,
        eta_seconds: 165,
        eta_formatted: "2m 45s",
        success_probability_pct: 96.5,
        attrition_risk_pct: 3.8,
        fuel_burn_pct: 22.4,
        weapon_selected: "Meteor BVRAAM (Ramjet)",
        p_kill: 0.95,
        flight_profile: "Supersonic High-Altitude Ingress (FL320 / M1.35)"
      },
      {
        aircraft_id: "SU30-TIGER1",
        aircraft_name: "Su-30MKI (Tiger-1)",
        aircraft_type: "Su-30MKI",
        assigned_mission: "Sector Bravo Air Superiority Sweep",
        target_distance_km: 52.8,
        eta_seconds: 190,
        eta_formatted: "3m 10s",
        success_probability_pct: 93.2,
        attrition_risk_pct: 5.4,
        fuel_burn_pct: 25.1,
        weapon_selected: "Astra Mk1 + R-73",
        p_kill: 0.91,
        flight_profile: "Medium Altitude Sweep (FL280 / M0.88)"
      }
    ],
    explainability: {
      mathematical_rationale:
        "SCIP MILP DWTA solver converged in 12.8ms. Rafale-Delta with SPECTRA EW suite minimizes attrition inside SAM acquisition horizon. Meteor 150+km No-Escape-Zone guarantees highest P_kill.",
      dominant_objective_term: "Mission Priority * 1.0 - Attrition Penalty * 0.85",
      constraints_verified: [
        "Hard Constraint: Round-trip fuel <= combat radius (2.2x margin satisfied)",
        "Hard Constraint: Pilot Flight Duty Limit (0.0h elapsed vs 6.5h limit)",
        "Hard Constraint: Multi-track Link-16 deconfliction with civil J121 corridor"
      ]
    }
  },
  {
    id: "COA-2",
    rank: 2,
    designation: "STAGGERED PINCER ENVELOPE & SEAD CORRIDOR",
    recommended: false,
    classification: "SECRET // VAYUSENA C2",
    summary:
      "Dual-axis pincer: Tiger-1 executes aggressive low-altitude dash while Mirage 2000 provides high-altitude EW illumination and standoff jamming.",
    objective_value: 162.1,
    quantitative_metrics: {
      success_probability_pct: 88.2,
      attrition_risk_pct: 9.4,
      fuel_burn_pct: 31.0,
      eta_sec: 210,
      eta_formatted: "3m 30s (210s)"
    },
    assignments: [
      {
        aircraft_id: "SU30-TIGER1",
        aircraft_name: "Su-30MKI (Tiger-1)",
        aircraft_type: "Su-30MKI",
        assigned_mission: "Aggressive Low-Altitude Penetration",
        target_distance_km: 68.5,
        eta_seconds: 210,
        eta_formatted: "3m 30s",
        success_probability_pct: 89.0,
        attrition_risk_pct: 8.8,
        fuel_burn_pct: 32.5,
        weapon_selected: "Astra Mk1",
        p_kill: 0.88,
        flight_profile: "Terrain Masking Run (FL140 / M0.92)"
      }
    ],
    explainability: {
      mathematical_rationale:
        "Dual-axis envelope divides hostile radar tracking channels, but introduces higher fuel consumption (+6.8%) and elevated low-altitude bird-strike risk.",
      dominant_objective_term: "Aggressive Transit Velocity vs Fuel Penalty",
      constraints_verified: [
        "Fuel margin within acceptable BINGO limits",
        "Airspace separation deconflicted by 8.4km"
      ]
    }
  },
  {
    id: "COA-3",
    rank: 3,
    designation: "STAND-OFF BVR DEFENSIVE HANDOFF",
    recommended: false,
    classification: "SECRET // VAYUSENA C2",
    summary:
      "Defensive orbit outside SAM lethal bubble. Handoff terminal engagement to ground-based Akash-NG air defence battery at AFS Adampur.",
    objective_value: 145.3,
    quantitative_metrics: {
      success_probability_pct: 82.5,
      attrition_risk_pct: 3.2,
      fuel_burn_pct: 18.5,
      eta_sec: 290,
      eta_formatted: "4m 50s (290s)"
    },
    assignments: [
      {
        aircraft_id: "MIRAGE-GARUDA",
        aircraft_name: "Mirage 2000 (Garuda-1)",
        aircraft_type: "Mirage 2000",
        assigned_mission: "Standoff Orbit & Radar Relay",
        target_distance_km: 92.0,
        eta_seconds: 290,
        eta_formatted: "4m 50s",
        success_probability_pct: 82.5,
        attrition_risk_pct: 3.2,
        fuel_burn_pct: 18.5,
        weapon_selected: "MICA EM BVR",
        p_kill: 0.82,
        flight_profile: "Standoff Orbit (FL260 / M0.82)"
      }
    ],
    explainability: {
      mathematical_rationale:
        "Ultra-conservative risk posture. Yields lowest attrition but delays threat neutralization window by 125 seconds.",
      dominant_objective_term: "Minimum Risk Penalty",
      constraints_verified: [
        "Maximum distance from threat emitter maintained (>=135km)"
      ]
    }
  }
];

export const BASELINE_OPTIMIZATION: OptimizationResult = {
  solver_engine: "Google OR-Tools SCIP MILP (Prototype Standalone Core)",
  solver_status: "OPTIMAL",
  latency_ms: 12.8,
  objective_value: 184.6,
  weights: {
    w_priority: 1.0,
    w_risk: 0.85,
    w_cost: 0.002
  },
  candidate_evaluations: [],
  coas: BASELINE_COAS
};

export const BASELINE_ALERTS: TacticalAlert[] = [
  {
    id: "ALERT-INIT-1",
    level: "SUCCESS",
    timestamp: "T+00:00",
    title: "PROTOTYPE STANDALONE ENGINE ONLINE",
    message: "Northern & Western Air Defence Sector live. 6 IAF combat sorties synchronized with Link-16 nodes.",
    color: "green"
  },
  {
    id: "ALERT-INIT-2",
    level: "INFO",
    timestamp: "T+00:00",
    title: "IACCS SURVEILLANCE ACTIVE",
    message: "5 Airbases FMC Green. Phased array radar network sweeping Halwara & Ambala corridor at DEFCON 3.",
    color: "blue"
  }
];

export function getInitialMockState(): TacticalState {
  return {
    theatre_name: "NORTHERN & WESTERN SECTOR AIR DEFENCE (AD-DSS)",
    defcon_level: "DEFCON 3: ROUND HOUSE (INCREASED READINESS)",
    sim_time_sec: 0.0,
    sim_clock: "T+00:00.00",
    is_running: true,
    sim_speed_multiplier: 1.0,
    coa_authorized: null,
    disruption_injected: false,
    fleet: JSON.parse(JSON.stringify(BASELINE_AIRCRAFT)),
    sorties: JSON.parse(JSON.stringify(BASELINE_AIRCRAFT)),
    bases: JSON.parse(JSON.stringify(BASELINE_AIRBASES)),
    airbases: JSON.parse(JSON.stringify(BASELINE_AIRBASES)),
    threats: JSON.parse(JSON.stringify(BASELINE_SAM_THREATS)),
    active_threats: JSON.parse(JSON.stringify(BASELINE_SAM_THREATS)),
    pending_missions: JSON.parse(JSON.stringify(BASELINE_PENDING_MISSIONS)),
    weather_layers: JSON.parse(JSON.stringify(BASELINE_WEATHER_LAYERS)),
    airbase_weather: JSON.parse(JSON.stringify(BASELINE_AIRBASE_METAR)),
    civil_traffic: JSON.parse(JSON.stringify(BASELINE_CIVIL_TRAFFIC)),
    hostile_uavs: [],
    active_alerts: JSON.parse(JSON.stringify(BASELINE_ALERTS)),
    latest_optimization: JSON.parse(JSON.stringify(BASELINE_OPTIMIZATION))
  };
}

// -----------------------------------------------------------------------------
// Stateful Mock Simulation Engine
// -----------------------------------------------------------------------------

export class MockSimulationEngine {
  private state: TacticalState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: TacticalState) => void> = new Set();

  constructor() {
    this.state = getInitialMockState();
  }

  public getState(): TacticalState {
    return this.state;
  }

  public subscribe(listener: (state: TacticalState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const cloned = JSON.parse(JSON.stringify(this.state));
    this.listeners.forEach((listener) => listener(cloned));
  }

  public start() {
    if (this.timer) return;
    const dt = 0.4; // 2.5 Hz step for silky smooth flight rendering
    this.timer = setInterval(() => {
      this.stepSimulation(dt);
    }, 400);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setSimulationControl(action: "pause" | "resume" | "speed", speed?: number) {
    if (action === "pause") {
      this.state.is_running = false;
    } else if (action === "resume") {
      this.state.is_running = true;
    } else if (action === "speed" && speed) {
      this.state.sim_speed_multiplier = speed;
    }
    this.notify();
  }

  private stepSimulation(dtSec: number) {
    if (!this.state.is_running) return;

    const mult = this.state.sim_speed_multiplier || 1.0;
    const effectiveDt = dtSec * mult;
    this.state.sim_time_sec += effectiveDt;

    // Format Clock
    const totalSec = Math.floor(this.state.sim_time_sec);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const centis = Math.floor((this.state.sim_time_sec % 1) * 100);
    this.state.sim_clock = `T+${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;

    // 1. Advance Aircraft Kinematics along Waypoints
    const fleet = this.state.fleet || this.state.sorties || [];
    for (const ac of fleet) {
      if (ac.status === "STANDBY_QRA_5MIN" || ac.speed_kts <= 0) {
        continue;
      }

      const wps = ac.waypoints || [];
      const idx = ac.current_wp_index ?? 0;

      if (wps.length > 0 && idx < wps.length) {
        const targetWp = wps[idx];
        const pCurr = latlonToTacticalKm(ac.lat, ac.lon);
        const pTarget = latlonToTacticalKm(targetWp.lat, targetWp.lon);

        const dx = pTarget[0] - pCurr[0];
        const dy = pTarget[1] - pCurr[1];
        const distKm = Math.hypot(dx, dy);

        if (distKm < 2.5) {
          // Switch to next waypoint or loop
          ac.current_wp_index = (idx + 1) % wps.length;
        } else {
          // Advance along vector
          const speedKmS = (ac.speed_kts * 1.852) / 3600.0;
          const stepDist = speedKmS * effectiveDt;

          const angleRad = Math.atan2(dx, dy);
          const heading = ((angleRad * 180) / Math.PI + 360) % 360;
          ac.heading_deg = Math.round(heading);

          const moveRatio = Math.min(1.0, stepDist / distKm);
          const newX = pCurr[0] + dx * moveRatio;
          const newY = pCurr[1] + dy * moveRatio;

          const [newLat, newLon] = tacticalKmToLatlon(newX, newY);
          ac.lat = newLat;
          ac.lon = newLon;

          // Fuel burn
          const sfc = ac.sfc_kg_per_km || 3.0;
          const fuelUsed = stepDist * sfc;
          ac.fuel_kg = Math.max(200, Math.round((ac.fuel_kg - fuelUsed) * 10) / 10);
          ac.fuel_burn_kg = (ac.fuel_burn_kg || 0) + fuelUsed;

          // Flight duty timer
          ac.fdl_hours_elapsed = Math.round((ac.fdl_hours_elapsed + effectiveDt / 3600) * 1000) / 1000;
        }
      }
    }

    // 2. Advance Hostile UAVs and Check Intercepts
    const uavs = this.state.hostile_uavs || [];
    for (const uav of uavs) {
      if (uav.neutralized) continue;

      const uavSpeed = uav.speed_kts || 110.0;
      const stepKm = (uavSpeed * 1.852 / 3600.0) * effectiveDt;
      const hdgRad = ((uav.heading_deg || 135) * Math.PI) / 180;
      const dxKm = stepKm * Math.sin(hdgRad);
      const dyKm = stepKm * Math.cos(hdgRad);

      const pUav = latlonToTacticalKm(uav.lat, uav.lon);
      const [nLat, nLon] = tacticalKmToLatlon(pUav[0] + dxKm, pUav[1] + dyKm);
      uav.lat = nLat;
      uav.lon = nLon;

      if (uav.estimated_time_to_impact_sec !== undefined) {
        uav.estimated_time_to_impact_sec = Math.max(0, Math.round(uav.estimated_time_to_impact_sec - effectiveDt));
      }

      // Intercept check by airborne interceptors
      for (const ac of fleet) {
        if (
          ac.speed_kts > 400 &&
          (ac.status.includes("SCRAMBL") || ac.status.includes("INTERCEPT") || ac.status.includes("AIRBORNE"))
        ) {
          const distToUav = haversineDistanceKm(ac.lat, ac.lon, uav.lat, uav.lon);
          if (distToUav < 22.0) {
            uav.neutralized = true;
            uav.status = "SPLASH_NEUTRALIZED";
            this.addAlert(
              "SUCCESS",
              "BOGEY SPLASHED // TARGET DESTROYED",
              `${ac.callsign} locked & splashed ${uav.name} at range ${distToUav.toFixed(1)}km via BVR Astra Mk1!`,
              "green",
              uav.lat,
              uav.lon
            );
          }
        }
      }
    }

    // Keep aliases synced
    this.state.sorties = this.state.fleet || [];
    this.state.airbases = this.state.bases || [];
    this.state.active_threats = this.state.threats || [];

    this.notify();
  }

  public addAlert(
    level: TacticalAlert["level"],
    title: string,
    message: string,
    color: TacticalAlert["color"],
    lat?: number,
    lon?: number,
    latency_ms?: number
  ) {
    const alert: TacticalAlert = {
      id: `ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      level,
      timestamp: this.state.sim_clock,
      title,
      message,
      color,
      lat,
      lon,
      latency_ms
    };
    this.state.active_alerts.unshift(alert);
    if (this.state.active_alerts.length > 25) {
      this.state.active_alerts.pop();
    }
    return alert;
  }

  // Action: Inject Dynamic SAM Threat & UAVs
  public injectThreat(customPayload?: any) {
    this.state.disruption_injected = true;
    this.state.defcon_level = "DEFCON 2: ARMED FORCES READY (CRITICAL ALERT)";

    const newThreat: SAMThreat = customPayload || {
      id: "SAM-S400-AMBUSH",
      name: "Mobile S-400 Ambush Battery (91N6E Radar)",
      type: "SAM_LONG_RANGE",
      threat_level: "CRITICAL_LETHAL",
      lat: 31.35,
      lon: 75.65,
      elevation_ft: 750,
      radar_range_km: 180.0,
      lethal_range_km: 75.0,
      buffer_km: 15.0,
      min_safe_alt_ft: 45000,
      status: "ACTIVE_ILLUMINATING",
      detected_time: this.state.sim_clock,
      threat_emitter_signature: "EMITTER_91N6E_FREQ_S_BAND"
    };

    // Remove if existing id, else add
    this.state.threats = [
      newThreat,
      ...this.state.threats.filter((t) => t.id !== newThreat.id)
    ];
    this.state.active_threats = this.state.threats;

    // Spawn 2 hostile UAVs
    this.state.hostile_uavs = [
      {
        id: "UAV-SWARM-01",
        name: "Shahed-136 Loitering Munition #1",
        type: "UAV_LOW_RCS",
        threat_level: "HIGH",
        ingress_sector: "WESTERN_CORRIDOR",
        target_facility: "Halwara Air Force Station",
        lat: 32.1,
        lon: 74.3,
        alt_ft: 1500,
        speed_kts: 110,
        heading_deg: 135,
        status: "INGRESSING_LOW_ALTITUDE",
        estimated_time_to_impact_sec: 480,
        payload: "40kg High-Explosive",
        neutralized: false
      },
      {
        id: "UAV-SWARM-02",
        name: "Shahed-136 Loitering Munition #2",
        type: "UAV_LOW_RCS",
        threat_level: "HIGH",
        ingress_sector: "NORTHERN_CORRIDOR",
        target_facility: "Ambala Air Force Station",
        lat: 31.85,
        lon: 74.6,
        alt_ft: 1800,
        speed_kts: 110,
        heading_deg: 125,
        status: "INGRESSING_LOW_ALTITUDE",
        estimated_time_to_impact_sec: 620,
        payload: "40kg High-Explosive",
        neutralized: false
      }
    ];

    // Recompute COA-1 deconfliction routes around S-400
    const updatedCOAs: COA[] = [
      {
        id: "COA-1",
        rank: 1,
        designation: "ALPHA HIGH-MACH INTERCEPT // THETA* DECONFLICTED",
        recommended: true,
        classification: "TOP SECRET // VAYUSENA",
        summary:
          "Immediate Alert-5 scramble of Rafale-Delta from Ambala on supersonic climb. Kinematic Theta* deconflicts Tiger-2 east of the S-400 75km lethal envelope.",
        objective_value: 191.2,
        quantitative_metrics: {
          success_probability_pct: 95.4,
          attrition_risk_pct: 3.9,
          fuel_burn_pct: 23.8,
          eta_sec: 145,
          eta_formatted: "2m 25s (145s)"
        },
        assignments: [
          {
            aircraft_id: "RAFALE-DELTA",
            aircraft_name: "Rafale-EH (Delta-QRA)",
            aircraft_type: "Rafale-EH",
            assigned_mission: "High-Mach Intercept of UAV Swarm",
            target_distance_km: 72.0,
            eta_seconds: 145,
            eta_formatted: "2m 25s",
            success_probability_pct: 97.2,
            attrition_risk_pct: 3.1,
            fuel_burn_pct: 21.5,
            weapon_selected: "Meteor BVRAAM",
            p_kill: 0.96,
            flight_profile: "Supersonic Intercept (FL300 / M1.35)"
          },
          {
            aircraft_id: "TIGER-2",
            aircraft_name: "Rafale-DH (Tiger-2)",
            aircraft_type: "Rafale-DH",
            assigned_mission: "Theta* SAM Bypass Corridor",
            target_distance_km: 48.0,
            eta_seconds: 180,
            eta_formatted: "3m 00s",
            success_probability_pct: 93.8,
            attrition_risk_pct: 4.5,
            fuel_burn_pct: 26.0,
            weapon_selected: "SPECTRA Jammer + MICA IR",
            p_kill: 0.92,
            flight_profile: "Theta* Evasion Path around S-400"
          }
        ],
        explainability: {
          mathematical_rationale:
            "SCIP MILP DWTA solver re-optimized in 11.4ms. Rafale-Delta supersonic scramble provides fastest intercept before UAVs breach outer radar perimeter.",
          dominant_objective_term: "High-Priority Intercept Reward - S-400 Attrition Penalty",
          constraints_verified: [
            "Theta* path clears 75km S-400 lethal envelope with 15km safety buffer",
            "Ambala Alert-5 scramble readiness confirmed"
          ]
        }
      },
      ...BASELINE_COAS.slice(1)
    ];

    this.state.latest_optimization = {
      solver_engine: "Google OR-Tools SCIP MILP (Prototype Standalone Core)",
      solver_status: "OPTIMAL",
      latency_ms: 11.4,
      objective_value: 191.2,
      weights: { w_priority: 1.0, w_risk: 0.85, w_cost: 0.002 },
      candidate_evaluations: [],
      coas: updatedCOAs
    };

    this.addAlert(
      "CRITICAL",
      "POP-UP S-400 RADAR ILLUMINATION DETECTED",
      `Mobile S-400 Ambush active at 31.35°N, 75.65°E! 91N6E Radar illuminating sector. Hostile UAVs detected! DEFCON 2 set.`,
      "red",
      newThreat.lat,
      newThreat.lon,
      11.4
    );

    this.notify();
    return { state: this.state, optimization: this.state.latest_optimization };
  }

  // Action: Authorize Course of Action
  public authorizeCOA(coaId: string = "COA-1") {
    this.state.coa_authorized = coaId;
    const fleet = this.state.fleet || this.state.sorties || [];

    if (coaId === "COA-1") {
      // 1. Scramble Rafale Delta from Ambala
      const delta = fleet.find((a) => a.id === "RAFALE-DELTA");
      if (delta) {
        delta.status = "SCRAMBLING_AIRBORNE";
        delta.assigned_mission = "HIGH_MACH_INTERCEPT_UAV";
        delta.speed_kts = 720;
        delta.mach = 1.35;
        delta.alt_ft = 26000;
        delta.heading_deg = 315;
        delta.waypoints = [
          { id: "WP-DQ-1", lat: 30.37, lon: 76.815, alt: 5000, name: "AMB_SCRAMBLE_CLIMB" },
          { id: "WP-DQ-2", lat: 30.9, lon: 76.1, alt: 22000, name: "SUPERSONIC_GATE" },
          { id: "WP-DQ-3", lat: 31.6, lon: 75.1, alt: 26000, name: "INTERCEPT_BRACKET" },
          { id: "WP-DQ-4", lat: 32.0, lon: 74.6, alt: 26000, name: "TERMINAL_ENGAGE" }
        ];
        delta.current_wp_index = 1;
      }

      // 2. Reroute Tiger-2 along Theta* safe corridor
      const tiger2 = fleet.find((a) => a.id === "TIGER-2");
      if (tiger2) {
        tiger2.status = "DECONFLICTED_EVASION";
        tiger2.assigned_mission = "THETA_STAR_SAM_BYPASS";
        tiger2.waypoints = [
          { id: "WP-T2-THETA-1", lat: 31.35, lon: 74.88, alt: 30000, name: "THETA_BYPASS_INGRESS" },
          { id: "WP-T2-THETA-2", lat: 31.25, lon: 75.25, alt: 30000, name: "THETA_SAFE_CORRIDOR_1" },
          { id: "WP-T2-THETA-3", lat: 31.1, lon: 75.6, alt: 30000, name: "THETA_SAFE_CORRIDOR_2" },
          { id: "WP-T2-THETA-4", lat: 31.4, lon: 75.9, alt: 30000, name: "THETA_EGRESS_GATE" }
        ];
        tiger2.current_wp_index = 0;
      }

      // Ambala airbase status
      const ambBase = (this.state.bases || []).find((b) => b.code === "AMB");
      if (ambBase) {
        ambBase.qra_status = "AIRBORNE_SCRAMBLED";
      }

      this.addAlert(
        "SUCCESS",
        "COMMAND AUTHORIZATION: COA-1 TRANSMITTED",
        "Delta QRA airborne from Ambala on supersonic climb (Mach 1.35). Tiger-2 deconfliction corridor engaged. All orders active.",
        "green"
      );
    } else if (coaId === "COA-2") {
      const tiger1 = fleet.find((a) => a.id === "SU30-TIGER1");
      if (tiger1) {
        tiger1.status = "RETASKED_INTERCEPT";
        tiger1.speed_kts = 680;
        tiger1.mach = 1.15;
      }
      this.addAlert(
        "WARNING",
        "COMMAND AUTHORIZATION: COA-2 TRANSMITTED",
        "Tiger-1 retasked to BVR Intercept at high mach. Airframe fuel burn elevated.",
        "kesari"
      );
    } else {
      this.addAlert(
        "INFO",
        `COMMAND AUTHORIZATION: ${coaId} TRANSMITTED`,
        `${coaId} dispatch orders broadcast over secure Link-16 TADIL-J network.`,
        "blue"
      );
    }

    this.notify();
    return { state: this.state };
  }

  // Action: Re-run MILP Optimization
  public reOptimize(weights?: { w_priority?: number; w_risk?: number; w_cost?: number }) {
    const latMs = Math.round((10 + Math.random() * 5) * 10) / 10;
    const currentCOAs = this.state.latest_optimization?.coas || BASELINE_COAS;

    const optResult: OptimizationResult = {
      solver_engine: "Google OR-Tools SCIP MILP (Prototype Standalone Core)",
      solver_status: "OPTIMAL",
      latency_ms: latMs,
      objective_value: 184.6,
      weights: {
        w_priority: weights?.w_priority ?? 1.0,
        w_risk: weights?.w_risk ?? 0.85,
        w_cost: weights?.w_cost ?? 0.002
      },
      candidate_evaluations: [],
      coas: currentCOAs
    };

    this.state.latest_optimization = optResult;
    this.addAlert(
      "KESARI_ACTION",
      "MILP DWTA RE-OPTIMIZATION COMPLETE",
      `SCIP Solver generated optimal asset tasking in ${latMs} ms. COA-1 Recommended.`,
      "kesari",
      undefined,
      undefined,
      latMs
    );

    this.notify();
    return optResult;
  }

  // Action: Reset Sector to Baseline
  public resetSector() {
    this.state = getInitialMockState();
    this.addAlert(
      "INFO",
      "THEATER STATE RESET: T+00:00",
      "Restored 6 IAF aircraft, 5 airbases, baseline HQ-9 threat and DEFCON 3 readiness.",
      "blue"
    );
    this.notify();
    return { state: this.state };
  }

  // Action: Inject Crisis Scenario
  public injectScenario(scenarioType: string) {
    const stype = scenarioType.toUpperCase();
    this.state.disruption_injected = true;
    const fleet = this.state.fleet || this.state.sorties || [];
    const bases = this.state.bases || this.state.airbases || [];

    if (stype.includes("RUNWAY")) {
      for (const b of bases) {
        if (b.id === "AFS_HLW") {
          b.runway_status = "CRATERED_DENIED";
          b.qra_status = "SUSPENDED_RUNWAY_IMPACT";
        }
      }
      for (const ac of fleet) {
        if (ac.base_id === "AFS_HLW" && ac.speed_kts > 0) {
          ac.status = "DIVERTING_TO_BAREILLY";
          ac.waypoints = [
            { id: "WP-DIV-BLY", lat: 28.422, lon: 79.45, alt: 18000, name: "DIVERT_BAREILLY_RWY" }
          ];
          ac.current_wp_index = 0;
        }
      }
      this.addAlert(
        "CRITICAL",
        "CRISIS SCENARIO: RUNWAY DENIAL",
        "Halwara AFS runway cratered by ballistic impact. Runway 14/32 closed. Airborne CAP rerouted to AFS Bareilly.",
        "red",
        30.749,
        75.633
      );
    } else if (stype.includes("DRONE") || stype.includes("SWARM")) {
      this.state.hostile_uavs = [
        {
          id: "UAV-SWARM-01",
          name: "Shahed-136 Low-RCS Loitering Munition #1",
          type: "LOITERING_MUNITION_LOW_RCS",
          threat_level: "HIGH",
          ingress_sector: "WESTERN_CORRIDOR",
          target_facility: "AFS_HLW",
          lat: 32.1,
          lon: 74.3,
          alt_ft: 1500,
          speed_kts: 110,
          heading_deg: 135,
          status: "INGRESSING_LOW_ALTITUDE",
          estimated_time_to_impact_sec: 480,
          payload: "40kg HE",
          neutralized: false
        },
        {
          id: "UAV-SWARM-02",
          name: "Shahed-136 Low-RCS Loitering Munition #2",
          type: "LOITERING_MUNITION_LOW_RCS",
          threat_level: "HIGH",
          ingress_sector: "WESTERN_CORRIDOR",
          target_facility: "AFS_HLW",
          lat: 32.18,
          lon: 74.22,
          alt_ft: 1200,
          speed_kts: 115,
          heading_deg: 132,
          status: "INGRESSING_LOW_ALTITUDE",
          estimated_time_to_impact_sec: 510,
          payload: "40kg HE",
          neutralized: false
        },
        {
          id: "UAV-SWARM-03",
          name: "Shahed-136 Low-RCS Loitering Munition #3",
          type: "LOITERING_MUNITION_LOW_RCS",
          threat_level: "HIGH",
          ingress_sector: "NORTHERN_CORRIDOR",
          target_facility: "AFS_AMB",
          lat: 31.85,
          lon: 74.6,
          alt_ft: 1800,
          speed_kts: 110,
          heading_deg: 120,
          status: "INGRESSING_LOW_ALTITUDE",
          estimated_time_to_impact_sec: 620,
          payload: "40kg HE",
          neutralized: false
        },
        {
          id: "UAV-SWARM-04",
          name: "Shahed-136 Low-RCS Loitering Munition #4",
          type: "LOITERING_MUNITION_LOW_RCS",
          threat_level: "HIGH",
          ingress_sector: "NORTHERN_CORRIDOR",
          target_facility: "AFS_AMB",
          lat: 31.92,
          lon: 74.52,
          alt_ft: 1600,
          speed_kts: 112,
          heading_deg: 122,
          status: "INGRESSING_LOW_ALTITUDE",
          estimated_time_to_impact_sec: 645,
          payload: "40kg HE",
          neutralized: false
        }
      ];
      this.state.defcon_level = "DEFCON 2: MAXIMUM READINESS (SWARM INGRESS)";
      this.addAlert(
        "CRITICAL",
        "CRISIS SCENARIO: DRONE SWARM DETECTED",
        "4 Low-RCS UAV bogeys detected skimming at 1,500ft AGL. Multi-target intercept allocation initiated.",
        "red",
        32.1,
        74.3
      );
    } else if (stype.includes("WEATHER")) {
      const wxLayers = this.state.weather_layers || [];
      for (const w of wxLayers) {
        if (w.id.includes("STORM")) {
          w.radius_km = 75.0;
          w.cloud_top_ft = 48000;
          w.wind_vector_kts = 58;
          w.status = "SEVERE_SQUALL_CELL";
        }
      }
      if (this.state.airbase_weather) {
        this.state.airbase_weather["AFS_HLW"] = {
          metar: "VIHW 090000Z 30045G65KT 1200 +TSRA SQ BKN008CB 20/19 Q0998",
          flight_category: "LIFR_RED",
          visibility_km: 1.2,
          wind_kts: 45
        };
      }
      this.addAlert(
        "WARNING",
        "CRISIS SCENARIO: SEVERE CONVECTIVE STORM",
        "Violent CB squall cell expanded to 75km. Halwara visibility reduced to 1.2km. Terrain masking corridors enforced.",
        "kesari",
        32.7,
        75.8
      );
    } else if (stype.includes("EMERGENCY") || stype.includes("FUEL")) {
      for (const ac of fleet) {
        if (ac.id === "SU30-TIGER1") {
          ac.fuel_kg = 650;
          ac.status = "MAYDAY_BINGO_EMERGENCY";
          ac.threat_warning = "MAYDAY MAYDAY: CRITICAL FUEL DEREGULATION (650kg)";
          ac.waypoints = [
            { id: "WP-EMERG-AMB", lat: 30.37, lon: 76.815, alt: 4000, name: "EMERGENCY_AMBALA_APPROACH" }
          ];
          ac.current_wp_index = 0;
        }
      }
      this.addAlert(
        "CRITICAL",
        "CRISIS SCENARIO: IN-FLIGHT EMERGENCY (MAYDAY)",
        "Su-30MKI (Tiger-1) declared emergency. Fuel at 650kg (critical BINGO). Priority approach cleared to AFS Ambala.",
        "red"
      );
    }

    this.notify();
    return {
      status: "SCENARIO_INJECTED",
      scenario_type: stype,
      latency_ms: 13.5,
      state: this.state
    };
  }

  // Action: Intelligent Tactical Copilot Query
  public queryCopilot(queryText: string) {
    const q = queryText.toLowerCase().trim();
    const defcon = this.state.defcon_level;
    const activeThreatsCnt = (this.state.threats || []).length;
    const uavsCnt = (this.state.hostile_uavs || []).filter((u) => !u.neutralized).length;

    if (q.includes("strike") || q.includes("sead") || q.includes("s-400") || q.includes("sam") || q.includes("package")) {
      return {
        query: queryText,
        title: "SEAD / AIR SUPERIORITY STRIKE ALLOCATION",
        executive_summary:
          "Rafale-EH (Delta-QRA) equipped with Meteor BVRAAM and SPECTRA EW Suite provides the lowest kill-chain latency (12.4 mins) with 98.2% deconfliction clearance.",
        recommendation: "Authorize COA-1: Scramble Rafale-EH from AFS Ambala on supersonic egress vector 315°.",
        rationale:
          "Su-30MKI has consumed internal fuel on patrol. Scrambling fresh Rafale preserves Su-30 loiter reserve while exploiting Rafale's low radar cross-section against the S-400 acquisition envelope.",
        confidence_pct: 96.8,
        metrics: {
          kill_probability_pk: "0.94",
          reaction_time_sec: "38",
          attrition_risk: "4.2%",
          fuel_margin_kg: "+2,400 kg"
        },
        voice_script:
          "Tactical Copilot recommends Course of Action 1. Scramble Rafale Delta from Ambala on vector 315. High probability of kill at 94 percent with low attrition risk.",
        recommended_action: "AUTHORIZE_COA_1"
      };
    } else if (q.includes("runway") || q.includes("denial") || q.includes("halwara") || q.includes("base")) {
      return {
        query: queryText,
        title: "AIRBASE OPERATIONAL RESILIENCE AUDIT",
        executive_summary:
          "All 5 airbases (Ambala, Halwara, Adampur, Sirsa, Bareilly) have mapped automated diversion protocols to Bareilly (Trishul) and Ambala.",
        recommendation: "Maintain Ambala runway 12/30 on standby for rapid turnaround with 2,800 tons ATF on depot.",
        rationale:
          "In the event of runway cratering, the MILP solver enforces dynamic base retasking, diverting inbound sorties within 14ms and preventing fuel exhaustion.",
        confidence_pct: 98.4,
        metrics: {
          divert_time_min: "14.2",
          bareilly_fuel_atf: "3,600 Tons",
          qra_ready_bases: "3 / 5"
        },
        voice_script:
          "Airbase audit complete. Automated diversion protocol is primed for Bareilly and Ambala with immediate turnaround capacity.",
        recommended_action: "INJECT_RUNWAY_DENIAL"
      };
    } else if (q.includes("fatigue") || q.includes("pilot") || q.includes("fdl") || q.includes("crew")) {
      return {
        query: queryText,
        title: "IAF FLIGHT DUTY LIMITATION (FDL) AUDIT",
        executive_summary:
          "All pilots are within strict IAF SOP 6.5-hour combat duty limits. Highest elapsed duty is Wg Cdr V. Joshi on Su-30MKI (1.4h / 6.5h).",
        recommendation: "Retask Flt Lt N. Sengupta (Rafale-Delta, 0.0h elapsed) for upcoming high-g interception to ensure zero fatigue degradation.",
        rationale:
          "Cognitive latency increases by 22% after 3.5 flight hours under contested EW conditions. Fresh QRA crew on Alert 5 maximizes situational agility.",
        confidence_pct: 99.1,
        metrics: {
          fleet_avg_duty_hours: "0.82h",
          max_single_duty: "1.4h (Su-30)",
          crew_fatigue_index: "LOW (0.12)"
        },
        voice_script:
          "Pilot duty cycle check. All pilots within combat limits. Delta flight pilot has zero hours elapsed and is prime for scramble.",
        recommended_action: "AUDIT_CREW"
      };
    } else if (q.includes("bingo") || q.includes("fuel") || q.includes("range") || q.includes("divert")) {
      return {
        query: queryText,
        title: "THEATER FUEL MARGIN & BINGO RESERVE ASSESSMENT",
        executive_summary:
          "Fleet total fuel: 29,450 kg. All active sorties exceed designated BINGO fuel thresholds with positive divert margins to nearest TACAN station.",
        recommendation: "Enforce cruise profile at Mach 0.85 (SFC 3.1 kg/km) until weapon release envelope is confirmed.",
        rationale:
          "Rafale-Delta maintains 6,800 kg (Bingo: 1,900 kg). Su-30MKI maintains 6,400 kg (Bingo: 2,600 kg). Tejas Mk1A has 2,450 kg (Bingo: 1,100 kg).",
        confidence_pct: 97.5,
        metrics: {
          total_fuel_kg: "29,450 kg",
          bingo_margin_pct: "+68%",
          avg_combat_radius: "1,350 km"
        },
        voice_script:
          "Fuel state confirmed positive. All airframes maintain safe margins above bingo fuel. Divert corridors to Ambala and Bareilly are open.",
        recommended_action: "AUDIT_FUEL"
      };
    } else {
      return {
        query: queryText,
        title: "THEATER TACTICAL SITREP & COA RECOMMENDATION",
        executive_summary: `Theater operating at ${defcon}. Active threats: ${activeThreatsCnt}. Hostile UAVs: ${uavsCnt}. SCIP MILP solver generated 3 deconflicted COAs.`,
        recommendation: "Recommend executing Course of Action 1 for optimal deconflicted air superiority coverage.",
        rationale:
          "Multi-source sensor fusion confirms Link-16 nodes active across 5 airbases and 6 airframes. Theta* Kinematic pathfinding guarantees safe egress outside threat envelopes.",
        confidence_pct: 95.0,
        metrics: {
          solver_latency: "12.8 ms",
          deconfliction_score: "98.2%",
          active_fighters: "6 Combat Ready",
          qra_status: "Alert 5 Ready"
        },
        voice_script:
          "Theater sitrep confirmed. 6 combat airframes active, 3 ranked courses of action generated. Recommending Course of Action 1.",
        recommended_action: "AUTHORIZE_COA_1"
      };
    }
  }
}

// Singleton Engine instance
export const mockSimulationEngine = new MockSimulationEngine();
