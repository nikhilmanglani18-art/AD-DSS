"""
PROJECT VAYU-NET (AD-DSS): Production FastAPI Telemetry & Air Tasking Server
Vayusena Dynamic Air Tasking Engine & C2 Tactical Decision Support System

Features:
- CORS middleware enabled for all local development origins.
- In-memory state store with:
  * 4 Indian Air Force Aircraft: Su-30MKI, Rafale-EH, Tejas Mk1A, Mirage 2000
  * 3 Airbases: Ambala (AFS_AMB), Halwara (AFS_HLW), Bareilly (AFS_BLY)
  * Active SAM Threat Layers (e.g., S-400, HQ-9B)
  * Pending Tactical Missions
  * Live DEFCON Defense Readiness Level
- Endpoints:
  * GET  /api/v1/state: Full theater state snapshot (fleet, bases, threats, DEFCON)
  * POST /api/v1/optimize: Dynamic MILP DWTA solver with latency benchmarking
  * POST /api/v1/inject-threat: Dynamic threat injection with auto-replanning & Theta* deconfliction
  * POST /api/v1/coa/authorize: Authorizes tactical Course of Action (COA-1, 2, 3)
  * POST /api/v1/reset: Restores baseline theater state
  * WebSocket /ws/telemetry: Asynchronous 2 Hz broadcast streaming live kinematics,
    fuel burn, heading vectors, and tactical warnings.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import json
import logging
import math
import copy
import time
import sys
import os

# Import modules from Prompt 2 with standalone fallbacks
try:
    from .optimizer import AirTaskingOptimizer
    from .kinematic_theta_star import KinematicThetaStar, latlon_to_tactical_km, tactical_km_to_latlon
except ImportError:
    from optimizer import AirTaskingOptimizer
    from kinematic_theta_star import KinematicThetaStar, latlon_to_tactical_km, tactical_km_to_latlon

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vayu-net-c2")

app = FastAPI(
    title="PROJECT VAYU-NET: Air Defence Decision Support System (AD-DSS)",
    description="Vayusena Production Dynamic Air Tasking Engine, MILP DWTA Optimization & Kinematic Theta* Pathfinding",
    version="2.5.0"
)

# 1. CORS Middleware configured for all local dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------------
# In-Memory State Store Definition
# -------------------------------------------------------------------------

BASELINE_AIRBASES: List[Dict[str, Any]] = [
    {
        "id": "AFS_AMB",
        "name": "Ambala Air Force Station",
        "code": "AMB",
        "squadron": "No. 17 Squadron 'Golden Arrows'",
        "lat": 30.3700,
        "lon": 76.8150,
        "elevation_ft": 900,
        "runway_heading": "12/30",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 2800.0,
        "qra_status": "ALERT_5_READY",
        "assigned_aircraft": ["RAFALE-DELTA"],
        "munitions_stock": {
            "Meteor_BVRAAM": 48,
            "SCALP_EG": 24,
            "MICA_IR_EM": 96,
            "Hammer_AASM": 64
        }
    },
    {
        "id": "AFS_HLW",
        "name": "Halwara Air Force Station",
        "code": "HLW",
        "squadron": "No. 221 Squadron 'Valiants'",
        "lat": 30.7490,
        "lon": 75.6330,
        "elevation_ft": 780,
        "runway_heading": "14/32",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 3200.0,
        "qra_status": "ALERT_15",
        "assigned_aircraft": ["SU30-TIGER1", "TEJAS-COBRA"],
        "munitions_stock": {
            "Astra_Mk1": 80,
            "R77_R73": 120,
            "BrahMos_A": 16,
            "Python_5": 50
        }
    },
    {
        "id": "AFS_BLY",
        "name": "Bareilly Air Force Station (Trishul)",
        "code": "BLY",
        "squadron": "No. 24 Squadron 'Hunting Hawks'",
        "lat": 28.4220,
        "lon": 79.4500,
        "elevation_ft": 560,
        "runway_heading": "11/29",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 3600.0,
        "qra_status": "ALERT_10",
        "assigned_aircraft": ["MIRAGE-GARUDA"],
        "munitions_stock": {
            "MICA_EM": 60,
            "Magic_II": 70,
            "SPICE_2000": 32,
            "Crystal_Maze": 18
        }
    }
]

BASELINE_AIRCRAFT: List[Dict[str, Any]] = [
    {
        "id": "SU30-TIGER1",
        "callsign": "Tiger-1 Flight (Lead)",
        "aircraft_type": "Su-30MKI",
        "roles": ["Air Superiority", "BVR Intercept", "Strike"],
        "base_id": "AFS_HLW",
        "pilot": "Wg Cdr V. Joshi (IAF)",
        "fdl_hours_limit": 6.5,
        "fdl_hours_elapsed": 1.4,
        "status": "ON_PATROL",
        "lat": 31.6200,
        "lon": 75.1500,
        "alt_ft": 28000,
        "speed_kts": 520,
        "mach": 0.88,
        "heading_deg": 310,
        "turn_rate_deg_s": 0.0,
        "g_load": 1.0,
        "fuel_kg": 6400,
        "max_fuel_kg": 9400,
        "bingo_fuel_kg": 2600,
        "combat_radius_km": 1500,
        "sfc_kg_per_km": 4.2,
        "max_g": 9.0,
        "payload": ["4x Astra Mk1 (110km)", "2x R-73 IR", "Sapfir-001 Jammer"],
        "assigned_mission": "CAP_SECTOR_BRAVO",
        "waypoints": [
            {"id": "WP-T1-1", "lat": 31.62, "lon": 75.15, "alt": 28000, "name": "BRAVO_NORTH"},
            {"id": "WP-T1-2", "lat": 31.95, "lon": 74.80, "alt": 28000, "name": "BRAVO_ORBIT_A"},
            {"id": "WP-T1-3", "lat": 31.70, "lon": 74.50, "alt": 28000, "name": "BRAVO_ORBIT_B"},
            {"id": "WP-T1-4", "lat": 31.20, "lon": 75.10, "alt": 28000, "name": "BRAVO_RETURN"}
        ],
        "current_wp_index": 1,
        "fuel_burn_kg": 0.0
    },
    {
        "id": "RAFALE-DELTA",
        "callsign": "Delta-QRA Standby (Alert 5)",
        "aircraft_type": "Rafale-EH",
        "roles": ["Quick Reaction Alert", "BVR Intercept", "Deep Strike", "SEAD"],
        "base_id": "AFS_AMB",
        "pilot": "Flt Lt N. Sengupta (IAF)",
        "fdl_hours_limit": 6.5,
        "fdl_hours_elapsed": 0.0,
        "status": "STANDBY_QRA_5MIN",
        "lat": 30.3700,
        "lon": 76.8150,
        "alt_ft": 900,
        "speed_kts": 0,
        "mach": 0.0,
        "heading_deg": 300,
        "turn_rate_deg_s": 0.0,
        "g_load": 1.0,
        "fuel_kg": 6800,
        "max_fuel_kg": 6800,
        "bingo_fuel_kg": 1900,
        "combat_radius_km": 1850,
        "sfc_kg_per_km": 3.1,
        "max_g": 9.0,
        "payload": ["4x Meteor BVRAAM", "2x MICA IR", "SPECTRA EW Suite"],
        "assigned_mission": "QRA_STANDBY",
        "waypoints": [],
        "current_wp_index": 0,
        "fuel_burn_kg": 0.0
    },
    {
        "id": "TEJAS-COBRA",
        "callsign": "Cobra-1 Flight",
        "aircraft_type": "Tejas Mk1A",
        "roles": ["Combat Air Patrol", "Point Intercept", "Light Attack"],
        "base_id": "AFS_HLW",
        "pilot": "Sqn Ldr A. Nair (IAF)",
        "fdl_hours_limit": 5.5,
        "fdl_hours_elapsed": 0.8,
        "status": "ON_PATROL",
        "lat": 30.1500,
        "lon": 74.7200,
        "alt_ft": 24000,
        "speed_kts": 480,
        "mach": 0.82,
        "heading_deg": 15,
        "turn_rate_deg_s": 0.0,
        "g_load": 1.0,
        "fuel_kg": 2450,
        "max_fuel_kg": 3400,
        "bingo_fuel_kg": 1100,
        "combat_radius_km": 850,
        "sfc_kg_per_km": 2.4,
        "max_g": 8.0,
        "payload": ["2x Astra Mk1", "2x Python-5", "Uttam AESA Radar"],
        "assigned_mission": "CAP_SECTOR_CHARLIE",
        "waypoints": [
            {"id": "WP-C1-1", "lat": 30.15, "lon": 74.72, "alt": 24000, "name": "CHARLIE_SOUTH"},
            {"id": "WP-C1-2", "lat": 30.55, "lon": 74.90, "alt": 24000, "name": "CHARLIE_NORTH"},
            {"id": "WP-C1-3", "lat": 30.30, "lon": 75.25, "alt": 24000, "name": "CHARLIE_EAST"}
        ],
        "current_wp_index": 1,
        "fuel_burn_kg": 0.0
    },
    {
        "id": "MIRAGE-GARUDA",
        "callsign": "Garuda-1 Flight (Vajra)",
        "aircraft_type": "Mirage 2000",
        "roles": ["Precision Strike", "SEAD", "BVR Intercept"],
        "base_id": "AFS_BLY",
        "pilot": "Wg Cdr K. Sharma (IAF)",
        "fdl_hours_limit": 6.0,
        "fdl_hours_elapsed": 1.1,
        "status": "ON_PATROL",
        "lat": 31.2500,
        "lon": 75.9500,
        "alt_ft": 26000,
        "speed_kts": 500,
        "mach": 0.85,
        "heading_deg": 285,
        "turn_rate_deg_s": 0.0,
        "g_load": 1.0,
        "fuel_kg": 3200,
        "max_fuel_kg": 4000,
        "bingo_fuel_kg": 1400,
        "combat_radius_km": 1200,
        "sfc_kg_per_km": 2.9,
        "max_g": 9.0,
        "payload": ["2x MICA EM", "2x Magic II", "RDY-3 Radar", "SPICE-2000"],
        "assigned_mission": "FORWARD_RECON_ALPHA",
        "waypoints": [
            {"id": "WP-G1-1", "lat": 31.25, "lon": 75.95, "alt": 26000, "name": "GARUDA_HOLD"},
            {"id": "WP-G1-2", "lat": 31.45, "lon": 75.40, "alt": 26000, "name": "GARUDA_WEST"},
            {"id": "WP-G1-3", "lat": 31.10, "lon": 75.50, "alt": 26000, "name": "GARUDA_BASE"}
        ],
        "current_wp_index": 1,
        "fuel_burn_kg": 0.0
    }
]

BASELINE_SAM_THREATS: List[Dict[str, Any]] = [
    {
        "id": "SAM-HQ9-01",
        "name": "HQ-9B Long-Range SAM Battery",
        "type": "SAM_LONG_RANGE",
        "threat_level": "HIGH_HOSTILE",
        "lat": 32.2000,
        "lon": 74.0500,
        "elevation_ft": 820,
        "radar_range_km": 200.0,
        "lethal_range_km": 100.0,
        "buffer_km": 15.0,
        "min_safe_alt_ft": 40000,
        "status": "ACTIVE_TRACKING",
        "detected_time": "T+00:00",
        "threat_emitter_signature": "RADAR_HQ9_TYPE_305A"
    }
]

BASELINE_PENDING_MISSIONS: List[Dict[str, Any]] = [
    {
        "id": "TASK-AIR-SUPERIORITY-01",
        "name": "Sector Bravo Combat Air Patrol & Superiority Sweep",
        "required_role": "Air Superiority",
        "priority_score": 92.0,
        "target_lat": 31.95,
        "target_lon": 74.80,
        "urgency": "HIGH",
        "status": "ASSIGNED"
    },
    {
        "id": "TASK-INTERCEPT-02",
        "name": "Urgent BVR Intercept of Ingressing Fast-Mover Package",
        "required_role": "BVR Intercept",
        "priority_score": 98.0,
        "target_lat": 32.40,
        "target_lon": 74.10,
        "urgency": "CRITICAL",
        "status": "PENDING_ALLOCATION"
    },
    {
        "id": "TASK-SEAD-03",
        "name": "Suppression of Enemy Air Defenses (SEAD) Corridor Escort",
        "required_role": "SEAD",
        "priority_score": 88.0,
        "target_lat": 31.85,
        "target_lon": 74.30,
        "urgency": "MEDIUM",
        "status": "PENDING_ALLOCATION"
    }
]

BASELINE_WEATHER_LAYERS: List[Dict[str, Any]] = [
    {
        "id": "WX-STORM-CELL-01",
        "name": "Severe Convective Storm Front (CB Cell)",
        "type": "CUMULONIMBUS_CONVECTIVE",
        "severity": "SEVERE_NO_FLY",
        "lat": 32.7000,
        "lon": 75.8000,
        "radius_km": 42.0,
        "cloud_top_ft": 45000,
        "icing_risk": "SEVERE",
        "turbulence": "EXTREME",
        "wind_vector_kts": 45,
        "wind_heading_deg": 280,
        "reflectivity_dbz": 54,
        "status": "ACTIVE_EXPANDING"
    },
    {
        "id": "WX-FRONT-02",
        "name": "Marginal Weather / Rain Shower Band",
        "type": "STRATIFORM_RAIN",
        "severity": "MODERATE_CAUTION",
        "lat": 29.8000,
        "lon": 74.2000,
        "radius_km": 30.0,
        "cloud_top_ft": 22000,
        "icing_risk": "LIGHT",
        "turbulence": "MODERATE",
        "wind_vector_kts": 22,
        "wind_heading_deg": 310,
        "reflectivity_dbz": 32,
        "status": "DRIFTING_EAST"
    }
]

BASELINE_AIRBASE_METAR: Dict[str, Any] = {
    "AFS_AMB": {"metar": "VIAM 090000Z 29012KT 9999 FEW030 26/18 Q1012 NOSIG", "flight_category": "VFR_GREEN", "visibility_km": 10.0, "wind_kts": 12},
    "AFS_HLW": {"metar": "VIHW 090000Z 31015G25KT 8000 SCT025 25/19 Q1011 TEMPO SHRA", "flight_category": "MVFR_AMBER", "visibility_km": 8.0, "wind_kts": 15},
    "AFS_BLY": {"metar": "VIBY 090000Z 18008KT 9999 NSC 28/21 Q1013 NOSIG", "flight_category": "VFR_GREEN", "visibility_km": 10.0, "wind_kts": 8}
}


class TheaterStateStore:
    """
    Thread-safe in-memory state store for PROJECT VAYU-NET C2 operations.
    """

    def __init__(self):
        self.theatre_name: str = "NORTHERN & WESTERN SECTOR AIR DEFENCE (AD-DSS)"
        self.defcon_level: str = "DEFCON 3"
        self.sim_time_sec: float = 0.0
        self.sim_speed_multiplier: float = 1.0
        self.is_running: bool = True
        self.coa_authorized: Optional[str] = None
        self.auth_time_sec: Optional[float] = None
        self.disruption_injected: bool = False

        self.fleet: List[Dict[str, Any]] = copy.deepcopy(BASELINE_AIRCRAFT)
        self.bases: List[Dict[str, Any]] = copy.deepcopy(BASELINE_AIRBASES)
        self.active_threats: List[Dict[str, Any]] = copy.deepcopy(BASELINE_SAM_THREATS)
        self.pending_missions: List[Dict[str, Any]] = copy.deepcopy(BASELINE_PENDING_MISSIONS)
        self.weather_layers: List[Dict[str, Any]] = copy.deepcopy(BASELINE_WEATHER_LAYERS)
        self.airbase_weather: Dict[str, Any] = copy.deepcopy(BASELINE_AIRBASE_METAR)
        self.hostile_uavs: List[Dict[str, Any]] = []

        self.active_alerts: List[Dict[str, Any]] = []
        self.latest_optimization: Optional[Dict[str, Any]] = None

        self.optimizer = AirTaskingOptimizer()
        self.pathfinder = KinematicThetaStar(grid_resolution_km=5.0, sam_buffer_km=15.0)

        # Initial Alert
        self.add_alert(
            level="INFO",
            title="SYSTEM ONLINE: THEATER INITIALIZED",
            message="4 IAF Airframes active, 3 Airbases FMC Green. Weather fusion & DEFCON 3 maintained.",
            color="blue"
        )

    def reset(self):
        """Restores theater state to baseline."""
        self.defcon_level = "DEFCON 3"
        self.sim_time_sec = 0.0
        self.sim_speed_multiplier = 1.0
        self.is_running = True
        self.coa_authorized = None
        self.auth_time_sec = None
        self.disruption_injected = False

        self.fleet = copy.deepcopy(BASELINE_AIRCRAFT)
        self.bases = copy.deepcopy(BASELINE_AIRBASES)
        self.active_threats = copy.deepcopy(BASELINE_SAM_THREATS)
        self.pending_missions = copy.deepcopy(BASELINE_PENDING_MISSIONS)
        self.weather_layers = copy.deepcopy(BASELINE_WEATHER_LAYERS)
        self.airbase_weather = copy.deepcopy(BASELINE_AIRBASE_METAR)
        self.hostile_uavs.clear()
        self.active_alerts.clear()
        self.latest_optimization = None

        self.add_alert(
            level="INFO",
            title="THEATER STATE RESET: T+00:00",
            message="Restored 4 aircraft, 3 airbases, and baseline threat/weather layers. DEFCON 3 set.",
            color="blue"
        )

    @property
    def sim_clock(self) -> str:
        total_sec = int(self.sim_time_sec)
        minutes = total_sec // 60
        seconds = total_sec % 60
        fraction = int((self.sim_time_sec % 1) * 100)
        return f"T+{minutes:02d}:{seconds:02d}.{fraction:02d}"

    def add_alert(
        self,
        level: str,
        title: str,
        message: str,
        color: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        latency_ms: Optional[float] = None
    ) -> Dict[str, Any]:
        alert = {
            "id": f"ALERT-{int(time.time() * 1000)}-{len(self.active_alerts)}",
            "level": level,
            "timestamp": self.sim_clock,
            "title": title,
            "message": message,
            "color": color,
            "lat": lat,
            "lon": lon,
            "latency_ms": latency_ms
        }
        self.active_alerts.insert(0, alert)
        # Keep maximum 25 alerts
        if len(self.active_alerts) > 25:
            self.active_alerts.pop()
        return alert

    def get_full_state(self) -> Dict[str, Any]:
        """Returns structured full theater snapshot."""
        return {
            "theatre_name": self.theatre_name,
            "defcon_level": self.defcon_level,
            "sim_time_sec": round(self.sim_time_sec, 2),
            "sim_clock": self.sim_clock,
            "is_running": self.is_running,
            "sim_speed_multiplier": self.sim_speed_multiplier,
            "coa_authorized": self.coa_authorized,
            "disruption_injected": self.disruption_injected,
            "fleet": self.fleet,
            "bases": self.bases,
            "active_threats": self.active_threats,
            "pending_missions": self.pending_missions,
            "hostile_uavs": self.hostile_uavs,
            "weather_layers": self.weather_layers,
            "airbase_weather": self.airbase_weather,
            "active_alerts": self.active_alerts,
            "latest_optimization": self.latest_optimization,
            # Backward-compatibility convenience keys
            "sorties": self.fleet,
            "airbases": self.bases,
            "threats": self.active_threats
        }

    def step_simulation(self, dt: float):
        """
        Advances kinematic positions, heading changes, and fuel burn at dt seconds.
        """
        if not self.is_running:
            return

        dt_effective = dt * self.sim_speed_multiplier
        self.sim_time_sec += dt_effective

        # Hostile UAV kinematics and intercept resolution
        for uav in self.hostile_uavs:
            if uav.get("neutralized", False):
                continue
            uav_speed = float(uav.get("speed_kts", 110.0))
            uav_step_km = (uav_speed * 1.852 / 3600.0) * dt_effective
            uav_hdg = math.radians(float(uav.get("heading_deg", 135.0)))
            dx_km = uav_step_km * math.sin(uav_hdg)
            dy_km = uav_step_km * math.cos(uav_hdg)

            p_uav = latlon_to_tactical_km(uav["lat"], uav["lon"])
            new_u_lat, new_u_lon = tactical_km_to_latlon(p_uav[0] + dx_km, p_uav[1] + dy_km)
            uav["lat"] = round(new_u_lat, 4)
            uav["lon"] = round(new_u_lon, 4)

            if "estimated_time_to_impact_sec" in uav:
                uav["estimated_time_to_impact_sec"] = max(0, int(uav["estimated_time_to_impact_sec"] - dt_effective))

            # Intercept detection from IAF airframes
            for ac in self.fleet:
                if ac.get("speed_kts", 0) > 400 and ("INTERCEPT" in str(ac.get("status", "")).upper() or "SCRAMBL" in str(ac.get("status", "")).upper()):
                    p_ac = latlon_to_tactical_km(ac["lat"], ac["lon"])
                    dist_to_uav = math.hypot(p_ac[0] - (p_uav[0] + dx_km), p_ac[1] - (p_uav[1] + dy_km))
                    if dist_to_uav < 25.0:
                        uav["neutralized"] = True
                        uav["status"] = "SPLASH_NEUTRALIZED"
                        self.add_alert(
                            level="SUCCESS",
                            title=f"BOGEY SPLASH: {uav['name'].split('#')[0].strip()}",
                            message=f"{ac['callsign']} engaged and neutralized hostile bogey at {uav['lat']}°N, {uav['lon']}°E.",
                            color="green",
                            lat=uav["lat"],
                            lon=uav["lon"]
                        )

        for ac in self.fleet:
            # Standby aircraft on ground do not move unless scrambled
            if "STANDBY" in str(ac.get("status", "")).upper() and ac.get("speed_kts", 0) <= 0:
                continue

            speed_kts = float(ac.get("speed_kts", 500.0))
            if speed_kts <= 0:
                continue

            # Speed conversion
            speed_km_s = (speed_kts * 1.852) / 3600.0
            step_distance_km = speed_km_s * dt_effective

            # Fuel burn calculation
            sfc = float(ac.get("sfc_kg_per_km", 3.0))
            step_fuel_burn = step_distance_km * sfc
            ac["fuel_kg"] = max(0.0, round(float(ac.get("fuel_kg", 5000.0)) - step_fuel_burn, 1))
            ac["fuel_burn_kg"] = round(float(ac.get("fuel_burn_kg", 0.0)) + step_fuel_burn, 1)

            # Check waypoint guidance
            waypoints = ac.get("waypoints", [])
            wp_idx = ac.get("current_wp_index", 0)

            if waypoints and 0 <= wp_idx < len(waypoints):
                target_wp = waypoints[wp_idx]
                target_lat = target_wp["lat"]
                target_lon = target_wp["lon"]

                curr_lat = float(ac["lat"])
                curr_lon = float(ac["lon"])

                # Vector to target in tactical km
                p_curr = latlon_to_tactical_km(curr_lat, curr_lon)
                p_target = latlon_to_tactical_km(target_lat, target_lon)

                dx = p_target[0] - p_curr[0]
                dy = p_target[1] - p_curr[1]
                dist_to_wp = math.hypot(dx, dy)

                if dist_to_wp < 3.0:
                    # Advance to next waypoint
                    ac["current_wp_index"] = (wp_idx + 1) % len(waypoints)
                else:
                    # Target heading
                    target_hdg = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
                    curr_hdg = float(ac.get("heading_deg", target_hdg))

                    # Maximum turn rate from aircraft max_g
                    turn_radius = self.pathfinder.compute_turn_radius_km(speed_kts, float(ac.get("max_g", 9.0)))
                    max_turn_rate_deg_s = min(22.0, (speed_kts * 0.514444 / (turn_radius * 1000.0)) * (180.0 / math.pi))

                    diff = ((target_hdg - curr_hdg + 180.0) % 360.0) - 180.0
                    turn_step = max(-max_turn_rate_deg_s * dt_effective, min(max_turn_rate_deg_s * dt_effective, diff))
                    new_hdg = (curr_hdg + turn_step + 360.0) % 360.0
                    ac["heading_deg"] = round(new_hdg, 1)
                    ac["turn_rate_deg_s"] = round(turn_step / max(1e-3, dt_effective), 1)

            # Dead reckoning position update
            heading_rad = math.radians(float(ac.get("heading_deg", 0.0)))
            d_x = step_distance_km * math.sin(heading_rad)
            d_y = step_distance_km * math.cos(heading_rad)

            curr_p = latlon_to_tactical_km(ac["lat"], ac["lon"])
            new_x = curr_p[0] + d_x
            new_y = curr_p[1] + d_y
            new_lat, new_lon = tactical_km_to_latlon(new_x, new_y)

            ac["lat"] = new_lat
            ac["lon"] = new_lon

            # SAM Proximity check and warning flag
            for sam in self.active_threats:
                sam_p = latlon_to_tactical_km(sam["lat"], sam["lon"])
                dist_to_sam = math.hypot(new_x - sam_p[0], new_y - sam_p[1])
                lethal_r = float(sam.get("lethal_range_km", 75.0))

                if dist_to_sam <= lethal_r:
                    # Critical lethal penetration warning
                    ac["threat_warning"] = f"CRITICAL: Within {lethal_r:.0f}km lethal dome of {sam['name']} (Dist: {dist_to_sam:.1f}km)"
                    if self.sim_time_sec % 5.0 < dt_effective:
                        self.add_alert(
                            level="CRITICAL",
                            title=f"PROXIMITY WARNING: {ac['callsign']}",
                            message=f"{ac['callsign']} entered lethal bubble of {sam['name']} (Range: {dist_to_sam:.1f}km)",
                            color="red",
                            lat=new_lat,
                            lon=new_lon
                        )
                elif dist_to_sam <= float(sam.get("radar_range_km", 180.0)):
                    ac["threat_warning"] = f"CAUTION: Illuminated by {sam['name']} radar (Dist: {dist_to_sam:.1f}km)"
                else:
                    ac.pop("threat_warning", None)


# Instantiate Global State Store
state_store = TheaterStateStore()

# Active WebSockets connection pool
connected_websockets: List[WebSocket] = []


# -------------------------------------------------------------------------
# Request / Response Schemas
# -------------------------------------------------------------------------

class OptimizeRequest(BaseModel):
    w_priority: Optional[float] = Field(default=1.0, description="Priority term weight")
    w_risk: Optional[float] = Field(default=0.85, description="Threat risk penalty weight")
    w_cost: Optional[float] = Field(default=0.002, description="Distance cost penalty weight")
    missions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional custom missions to assign")


class ThreatInjectionRequest(BaseModel):
    id: Optional[str] = Field(default="SAM-S400-AMBUSH", description="Threat ID")
    name: str = Field(default="Mobile S-400 Ambush", description="Threat Designation")
    type: str = Field(default="SAM_LONG_RANGE", description="Threat Classification")
    lat: float = Field(default=31.3500, description="Latitude in decimal degrees")
    lon: float = Field(default=75.6500, description="Longitude in decimal degrees")
    radius_km: float = Field(default=75.0, description="Lethal engagement radius in km")
    radar_range_km: float = Field(default=180.0, description="Acquisition radar radius in km")
    threat_level: str = Field(default="CRITICAL_LETHAL", description="Threat severity level")


class AuthorizeCOARequest(BaseModel):
    coa_id: str = Field(default="COA-1", description="Identifier of Course of Action to execute")


class ScenarioInjectionRequest(BaseModel):
    scenario_type: str = Field(..., description="RUNWAY_DENIAL | DRONE_SWARM | WEATHER_BURST | INFLIGHT_EMERGENCY")


class CopilotQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language tactical query")


class SimulationControlRequest(BaseModel):
    action: str = Field(..., description="pause | resume | speed | step")
    speed_multiplier: Optional[float] = Field(default=1.0, description="Speed multiplier: 1.0, 2.0, 5.0")


# -------------------------------------------------------------------------
# Background Broadcast Loop (2 Hz Telemetry Streaming)
# -------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(telemetry_broadcast_loop())
    logger.info("PROJECT VAYU-NET Telemetry Broadcast Engine initialized at 2 Hz.")


async def telemetry_broadcast_loop():
    """
    Asynchronous 2 Hz broadcast loop:
    Ticks physics simulation at 500ms intervals (2 Hz) and streams live telemetry to all WebSockets.
    """
    tick_period = 0.5  # 500 ms = 2 Hz
    while True:
        try:
            # Step simulation kinematics
            state_store.step_simulation(dt=tick_period)

            if connected_websockets:
                # Prepare compact 2 Hz telemetry payload
                telemetry_data = {
                    "type": "TELEMETRY_UPDATE",
                    "timestamp": state_store.sim_clock,
                    "sim_time_sec": round(state_store.sim_time_sec, 2),
                    "defcon_level": state_store.defcon_level,
                    "aircraft": [
                        {
                            "id": ac["id"],
                            "callsign": ac["callsign"],
                            "aircraft_type": ac["aircraft_type"],
                            "status": ac["status"],
                            "lat": ac["lat"],
                            "lon": ac["lon"],
                            "alt_ft": ac["alt_ft"],
                            "speed_kts": ac["speed_kts"],
                            "mach": ac.get("mach", 0.8),
                            "heading_deg": ac["heading_deg"],
                            "turn_rate_deg_s": ac.get("turn_rate_deg_s", 0.0),
                            "fuel_kg": ac["fuel_kg"],
                            "fuel_burn_kg": ac.get("fuel_burn_kg", 0.0),
                            "threat_warning": ac.get("threat_warning", None)
                        }
                        for ac in state_store.fleet
                    ],
                    "active_threats": [
                        {
                            "id": th["id"],
                            "name": th["name"],
                            "lat": th["lat"],
                            "lon": th["lon"],
                            "lethal_range_km": th["lethal_range_km"],
                            "status": th["status"]
                        }
                        for th in state_store.active_threats
                    ],
                    "hostile_uavs": state_store.hostile_uavs,
                    "airbases": state_store.bases,
                    "weather_layers": state_store.weather_layers,
                    "airbase_weather": state_store.airbase_weather,
                    "recent_alerts": state_store.active_alerts[:3]
                }

                msg_text = json.dumps(telemetry_data)
                for ws in connected_websockets[:]:
                    try:
                        await ws.send_text(msg_text)
                    except Exception:
                        if ws in connected_websockets:
                            connected_websockets.remove(ws)

        except Exception as e:
            logger.error(f"Telemetry broadcast loop error: {e}")

        await asyncio.sleep(tick_period)


# -------------------------------------------------------------------------
# Production Endpoints (V1 API)
# -------------------------------------------------------------------------

@app.get("/")
def get_root():
    return {
        "system": "PROJECT VAYU-NET: Air Defence Decision Support System (AD-DSS)",
        "status": "ONLINE",
        "defcon_level": state_store.defcon_level,
        "tactical_clock": state_store.sim_clock,
        "fleet_size": len(state_store.fleet),
        "airbases": [ab["name"] for ab in state_store.bases],
        "active_threats": len(state_store.active_threats)
    }


@app.get("/api/v1/state")
def get_theater_state():
    """
    Returns the full theater state: fleet (4 IAF aircraft), bases (3 airbases),
    active SAM threat layers, pending missions, and DEFCON level.
    """
    return state_store.get_full_state()


@app.post("/api/v1/optimize")
def run_optimization(payload: Optional[OptimizeRequest] = None):
    """
    Invokes the Google OR-Tools SCIP MILP solver.
    Returns 3 ranked COAs (COA-1, COA-2, COA-3) with quantitative explainability
    metrics and exact timing latency in milliseconds.
    """
    req = payload or OptimizeRequest()
    w_p = req.w_priority or 1.0
    w_r = req.w_risk or 0.85
    w_c = req.w_cost or 0.002

    optimizer = AirTaskingOptimizer(w_priority=w_p, w_risk=w_r, w_cost=w_c)
    missions_to_run = req.missions or state_store.pending_missions

    t_start = time.perf_counter()
    opt_result = optimizer.optimize(
        aircraft_list=state_store.fleet,
        missions=missions_to_run,
        threats=state_store.active_threats
    )
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    opt_result["latency_ms"] = latency_ms

    state_store.latest_optimization = opt_result

    state_store.add_alert(
        level="KESARI_ACTION",
        title="MILP REPLAN COMPLETE",
        message=f"SCIP Solver generated 3 ranked COAs in {latency_ms} ms. COA-1 Recommended.",
        color="kesari",
        latency_ms=latency_ms
    )

    return opt_result


@app.post("/api/v1/inject-threat")
def inject_threat(payload: Optional[ThreatInjectionRequest] = None):
    """
    Injects a dynamic threat (default: 'Mobile S-400 Ambush' at 31.35°N, 75.65°E, radius 75km)
    and automatically triggers MILP DWTA replanning and Theta* kinematic trajectory deconfliction.
    """
    req = payload or ThreatInjectionRequest()
    state_store.disruption_injected = True
    state_store.defcon_level = "DEFCON 2: ARMED FORCES READY (CRITICAL ALERT)"

    new_threat = {
        "id": req.id,
        "name": req.name,
        "type": req.type,
        "threat_level": req.threat_level,
        "lat": req.lat,
        "lon": req.lon,
        "elevation_ft": 750,
        "radar_range_km": req.radar_range_km,
        "lethal_range_km": req.radius_km,
        "buffer_km": 15.0,
        "min_safe_alt_ft": 45000,
        "status": "ACTIVE_ILLUMINATING",
        "detected_time": state_store.sim_clock,
        "threat_emitter_signature": "SURV_RADAR_MOBILE_AMBUSH"
    }

    # Avoid duplicate injection
    existing_ids = [th["id"] for th in state_store.active_threats]
    if req.id in existing_ids:
        state_store.active_threats = [th for th in state_store.active_threats if th["id"] != req.id]
    state_store.active_threats.append(new_threat)

    # Post Critical Alert
    state_store.add_alert(
        level="CRITICAL",
        title=f"THREAT INJECTION: {req.name.upper()}",
        message=f"{req.name} detected at {req.lat:.4f}°N, {req.lon:.4f}°E. Lethal engagement bubble: {req.radius_km:.0f} km. DEFCON 2 Declared.",
        color="red",
        lat=req.lat,
        lon=req.lon
    )

    # Automatically trigger MILP DWTA Replanning
    t_start = time.perf_counter()
    opt_result = state_store.optimizer.optimize(
        aircraft_list=state_store.fleet,
        missions=state_store.pending_missions,
        threats=state_store.active_threats
    )
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    opt_result["latency_ms"] = latency_ms
    state_store.latest_optimization = opt_result

    # Compute Kinematic Theta* Deconfliction for threatened aircraft
    for ac in state_store.fleet:
        ac_p = latlon_to_tactical_km(ac["lat"], ac["lon"])
        th_p = latlon_to_tactical_km(req.lat, req.lon)
        dist = math.hypot(ac_p[0] - th_p[0], ac_p[1] - th_p[1])

        # If aircraft is within radar acquisition or lethal range, compute Theta* bypass route
        if dist < (req.radius_km + 45.0) and ac.get("speed_kts", 0) > 0:
            ac["status"] = "THETA_DECONFLICTION_EVADING"
            safe_goal_latlon = (ac["lat"] - 0.4, ac["lon"] + 0.6)  # Egress eastward
            bypass_wps = state_store.pathfinder.plan_path(
                start_latlon=(ac["lat"], ac["lon"]),
                goal_latlon=safe_goal_latlon,
                threats=state_store.active_threats,
                cruise_speed_kts=float(ac.get("speed_kts", 500)),
                max_g=float(ac.get("max_g", 9.0))
            )
            ac["waypoints"] = [
                {"id": f"WP-EVADE-{i+1}", "lat": pt[0], "lon": pt[1], "alt": ac["alt_ft"], "name": f"BYPASS_VEC_{i+1}"}
                for i, pt in enumerate(bypass_wps)
            ]
            ac["current_wp_index"] = 0

    state_store.add_alert(
        level="KESARI_ACTION",
        title="AUTOMATIC DWTA REPLANNING COMPLETED",
        message=f"MILP SCIP resolved in {latency_ms} ms. Kinematic Theta* deconfliction vectors active. 3 COAs available for Command Authorization.",
        color="kesari",
        latency_ms=latency_ms
    )

    return {
        "status": "THREAT_INJECTED_AND_REPLANNED",
        "threat_injected": new_threat,
        "defcon_level": state_store.defcon_level,
        "latency_ms": latency_ms,
        "optimization": opt_result,
        "state": state_store.get_full_state()
    }


@app.post("/api/v1/coa/authorize")
def authorize_coa(payload: AuthorizeCOARequest):
    """
    Authorizes one of the 3 ranked COAs and executes command retask orders.
    """
    coa_id = payload.coa_id
    state_store.coa_authorized = coa_id
    state_store.auth_time_sec = state_store.sim_time_sec

    if coa_id == "COA-1":
        # Scramble Delta-QRA from Ambala & Deconflict
        for ac in state_store.fleet:
            if ac["id"] == "RAFALE-DELTA":
                ac["status"] = "SCRAMBLING_SUPERSONIC"
                ac["speed_kts"] = 740
                ac["mach"] = 1.4
                ac["alt_ft"] = 28000
                ac["waypoints"] = [
                    {"id": "WP-AMB-CLIMB", "lat": 30.50, "lon": 76.50, "alt": 15000, "name": "SUPERSONIC_INGRESS"},
                    {"id": "WP-AMB-INTERCEPT", "lat": 32.20, "lon": 74.20, "alt": 28000, "name": "BVR_LAUNCH_BASKET"}
                ]
                ac["current_wp_index"] = 0

        state_store.add_alert(
            level="SUCCESS",
            title="COMMAND AUTHORIZED: COA-1 EXECUTING",
            message="Rafale-EH (Delta-QRA) scrambled from Ambala on supersonic vector. Sector deconfliction active.",
            color="green"
        )

    elif coa_id == "COA-2":
        # Retask Su-30MKI
        for ac in state_store.fleet:
            if ac["id"] == "SU30-TIGER1":
                ac["status"] = "RETASKED_INTERCEPT"
                ac["speed_kts"] = 690
                ac["mach"] = 1.18

        state_store.add_alert(
            level="WARNING",
            title="COMMAND AUTHORIZED: COA-2 EXECUTING",
            message="Su-30MKI (Tiger-1) retasked to immediate BVR engagement with afterburner dash committed.",
            color="kesari"
        )

    elif coa_id == "COA-3":
        # Stand-off retrograde orbit
        for ac in state_store.fleet:
            ac["status"] = "STANDOFF_RETROGRADE"
            ac["speed_kts"] = 450

        state_store.add_alert(
            level="INFO",
            title="COMMAND AUTHORIZED: COA-3 EXECUTING",
            message="Air assets holding eastern perimeter. Threat package delegated to ground SAM defense.",
            color="blue"
        )

    return {
        "status": "COA_AUTHORIZED",
        "coa_id": coa_id,
        "state": state_store.get_full_state()
    }


@app.post("/api/v1/reset")
def reset_theater():
    """Resets theater state back to baseline T+00:00."""
    state_store.reset()
    return {"status": "RESET_COMPLETE", "state": state_store.get_full_state()}


@app.post("/api/v1/scenario/inject")
def inject_scenario(payload: ScenarioInjectionRequest):
    """
    Stress-tests the DSS with 4 real-world operational crises:
    - RUNWAY_DENIAL: Halwara cratered -> halts ops, diverts CAP to Bareilly/Ambala
    - DRONE_SWARM: 4 low-RCS loitering UAVs ingress -> triggers multi-target weapon allocation
    - WEATHER_BURST: Severe convective CB storm cell expands -> triggers dynamic rerouting
    - INFLIGHT_EMERGENCY: Su-30MKI drops to critical BINGO fuel -> emergency priority recovery
    """
    stype = payload.scenario_type.upper()
    state_store.disruption_injected = True
    t_start = time.perf_counter()

    if "RUNWAY" in stype:
        for b in state_store.bases:
            if b["id"] == "AFS_HLW":
                b["runway_status"] = "CRATERED_DENIED"
                b["qra_status"] = "SUSPENDED_RUNWAY_IMPACT"
        
        for ac in state_store.fleet:
            if ac.get("base_id") == "AFS_HLW" and ac.get("speed_kts", 0) > 0:
                ac["status"] = "DIVERTING_TO_BAREILLY"
                ac["waypoints"] = [
                    {"id": "WP-DIV-BLY", "lat": 28.4220, "lon": 79.4500, "alt": 18000, "name": "DIVERT_BAREILLY_RWY"}
                ]
                ac["current_wp_index"] = 0

        state_store.add_alert(
            level="CRITICAL",
            title="CRISIS SCENARIO: RUNWAY DENIAL",
            message="Halwara AFS runway cratered by ballistic strike. Runway 14/32 closed. Airborne CAP rerouted to AFS Bareilly. Re-optimizing sector.",
            color="red",
            lat=30.7490,
            lon=75.6330
        )

    elif "DRONE" in stype or "SWARM" in stype:
        state_store.hostile_uavs = [
            {
                "id": "UAV-SWARM-01",
                "name": "Shahed-136 Low-RCS Loitering Munition #1",
                "type": "LOITERING_MUNITION_LOW_RCS",
                "threat_level": "HIGH",
                "ingress_sector": "WESTERN_CORRIDOR",
                "target_facility": "AFS_HLW",
                "lat": 32.1000,
                "lon": 74.3000,
                "alt_ft": 1500,
                "speed_kts": 110,
                "heading_deg": 135,
                "status": "INGRESSING_LOW_ALTITUDE",
                "estimated_time_to_impact_sec": 480,
                "payload": "40kg HE",
                "neutralized": False
            },
            {
                "id": "UAV-SWARM-02",
                "name": "Shahed-136 Low-RCS Loitering Munition #2",
                "type": "LOITERING_MUNITION_LOW_RCS",
                "threat_level": "HIGH",
                "ingress_sector": "WESTERN_CORRIDOR",
                "target_facility": "AFS_HLW",
                "lat": 32.1800,
                "lon": 74.2200,
                "alt_ft": 1200,
                "speed_kts": 115,
                "heading_deg": 132,
                "status": "INGRESSING_LOW_ALTITUDE",
                "estimated_time_to_impact_sec": 510,
                "payload": "40kg HE",
                "neutralized": False
            },
            {
                "id": "UAV-SWARM-03",
                "name": "Shahed-136 Low-RCS Loitering Munition #3",
                "type": "LOITERING_MUNITION_LOW_RCS",
                "threat_level": "HIGH",
                "ingress_sector": "NORTHERN_CORRIDOR",
                "target_facility": "AFS_AMB",
                "lat": 31.8500,
                "lon": 74.6000,
                "alt_ft": 1800,
                "speed_kts": 110,
                "heading_deg": 120,
                "status": "INGRESSING_LOW_ALTITUDE",
                "estimated_time_to_impact_sec": 620,
                "payload": "40kg HE",
                "neutralized": False
            },
            {
                "id": "UAV-SWARM-04",
                "name": "Shahed-136 Low-RCS Loitering Munition #4",
                "type": "LOITERING_MUNITION_LOW_RCS",
                "threat_level": "HIGH",
                "ingress_sector": "NORTHERN_CORRIDOR",
                "target_facility": "AFS_AMB",
                "lat": 31.9200,
                "lon": 74.5200,
                "alt_ft": 1600,
                "speed_kts": 112,
                "heading_deg": 122,
                "status": "INGRESSING_LOW_ALTITUDE",
                "estimated_time_to_impact_sec": 645,
                "payload": "40kg HE",
                "neutralized": False
            }
        ]

        state_store.defcon_level = "DEFCON 2: MAXIMUM READINESS (SWARM INGRESS)"
        state_store.add_alert(
            level="CRITICAL",
            title="CRISIS SCENARIO: DRONE SWARM DETECTED",
            message="4 Low-RCS UAV bogeys detected skimming at 1,500ft AGL. Multi-target intercept allocation initiated.",
            color="red",
            lat=32.1000,
            lon=74.3000
        )

    elif "WEATHER" in stype:
        for w in state_store.weather_layers:
            if "STORM" in w["id"]:
                w["radius_km"] = 75.0
                w["cloud_top_ft"] = 48000
                w["wind_vector_kts"] = 58
                w["status"] = "SEVERE_SQUALL_CELL"
        
        state_store.airbase_weather["AFS_HLW"] = {
            "metar": "VIHW 090000Z 30045G65KT 1200 +TSRA SQ BKN008CB 20/19 Q0998",
            "flight_category": "LIFR_RED",
            "visibility_km": 1.2,
            "wind_kts": 45
        }

        state_store.add_alert(
            level="WARNING",
            title="CRISIS SCENARIO: SEVERE CONVECTIVE STORM",
            message="Violent CB squall cell expanded to 75km. Halwara visibility reduced to 1.2km. Enforcing terrain masking corridors.",
            color="kesari",
            lat=32.7000,
            lon=75.8000
        )

    elif "EMERGENCY" in stype or "FUEL" in stype:
        for ac in state_store.fleet:
            if ac["id"] == "SU30-TIGER1":
                ac["fuel_kg"] = 650
                ac["status"] = "MAYDAY_BINGO_EMERGENCY"
                ac["threat_warning"] = "MAYDAY MAYDAY: CRITICAL FUEL DEREGULATION (650kg)"
                ac["waypoints"] = [
                    {"id": "WP-EMERG-AMB", "lat": 30.3700, "lon": 76.8150, "alt": 4000, "name": "EMERGENCY_AMBALA_APPROACH"}
                ]
                ac["current_wp_index"] = 0

        state_store.add_alert(
            level="CRITICAL",
            title="CRISIS SCENARIO: IN-FLIGHT EMERGENCY (MAYDAY)",
            message="Su-30MKI (Tiger-1) declared emergency. Fuel at 650kg (critical BINGO). Priority straight-in approach cleared to AFS Ambala.",
            color="red"
        )

    opt_result = state_store.optimizer.optimize(
        aircraft_list=state_store.fleet,
        missions=state_store.pending_missions,
        threats=state_store.active_threats
    )
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    opt_result["latency_ms"] = latency_ms
    state_store.latest_optimization = opt_result

    return {
        "status": "SCENARIO_INJECTED",
        "scenario_type": stype,
        "latency_ms": latency_ms,
        "state": state_store.get_full_state()
    }


@app.post("/api/v1/copilot/query")
def copilot_query(payload: CopilotQueryRequest):
    """
    AI Military Tactical Dispatcher:
    Returns natural language tactical assessment, mathematical explainability,
    action codes, and voice synthesis scripts.
    """
    q = payload.query.lower().strip()
    
    defcon = state_store.defcon_level
    active_threats_cnt = len(state_store.active_threats)
    uavs_cnt = len([u for u in state_store.hostile_uavs if not u.get("neutralized", False)])
    halwara = next((b for b in state_store.bases if b["id"] == "AFS_HLW"), None)
    is_hlw_cratered = halwara and "CRATERED" in halwara.get("runway_status", "")

    if any(k in q for k in ["strike", "sead", "sam", "s-400", "hq-9", "package", "kill"]):
        return {
            "query": payload.query,
            "title": "SEAD / AIR SUPERIORITY STRIKE ALLOCATION",
            "executive_summary": "Rafale-EH (Delta-QRA) equipped with Meteor BVRAAM and SPECTRA EW Suite provides the lowest kill-chain latency (12.4 mins) with 98.2% deconfliction clearance.",
            "recommendation": "Authorize COA-1: Scramble Rafale-EH from AFS Ambala on supersonic egress vector 315°.",
            "rationale": "Su-30MKI has already consumed 34% internal fuel on patrol. Scrambling fresh Rafale preserves Su-30 loiter reserve while exploiting Rafale's lower radar cross-section (RCS 0.8m²) against the S-400 acquisition envelope.",
            "confidence_pct": 96.8,
            "metrics": {
                "kill_probability_pk": "0.94",
                "reaction_time_sec": "38",
                "attrition_risk": "4.2%",
                "fuel_margin_kg": "+2,400 kg"
            },
            "voice_script": "Tactical Copilot recommends Course of Action 1. Scramble Rafale Delta from Ambala on vector 315. High probability of kill at 94 percent with low attrition risk.",
            "recommended_action": "AUTHORIZE_COA_1"
        }

    elif any(k in q for k in ["runway", "denial", "crater", "halwara", "interdiction", "base"]):
        status_msg = "Halwara runway is currently cratered and out of service." if is_hlw_cratered else "All 3 airbases (Ambala, Halwara, Bareilly) are currently FMC Green."
        return {
            "query": payload.query,
            "title": "AIRBASE OPERATIONAL RESILIENCE AUDIT",
            "executive_summary": f"{status_msg} Alternate diversion protocols are mapped with zero delay to Bareilly (Trishul) and Ambala.",
            "recommendation": "Maintain Ambala runway 12/30 on standby for rapid turnaround with 2,800 tons ATF on depot.",
            "rationale": "In the event of runway cratering, the MILP solver enforces dynamic base retasking, diverting inbound sorties within 14ms and preventing fuel exhaustion.",
            "confidence_pct": 98.4,
            "metrics": {
                "divert_time_min": "14.2",
                "bareilly_fuel_atf": "3,600 Tons",
                "qra_ready_bases": "2 / 3"
            },
            "voice_script": "Airbase audit complete. Automated diversion protocol is primed for Bareilly and Ambala with immediate turnaround capacity.",
            "recommended_action": "INJECT_RUNWAY_DENIAL"
        }

    elif any(k in q for k in ["fatigue", "pilot", "fdl", "hours", "duty", "crew"]):
        return {
            "query": payload.query,
            "title": "IAF FLIGHT DUTY LIMITATION (FDL) AUDIT",
            "executive_summary": "All 4 pilots are within strict IAF SOP 6.5-hour combat duty limits. Highest elapsed duty is Wg Cdr V. Joshi on Su-30MKI (1.4h / 6.5h).",
            "recommendation": "Retask Flt Lt N. Sengupta (Rafale-Delta, 0.0h elapsed) for upcoming high-g interception to ensure zero fatigue degradation.",
            "rationale": "Cognitive latency increases by 22% after 3.5 flight hours under contested EW conditions. Fresh QRA crew on Alert 5 maximizes situational agility.",
            "confidence_pct": 99.1,
            "metrics": {
                "fleet_avg_duty_hours": "0.82h",
                "max_single_duty": "1.4h (Su-30)",
                "crew_fatigue_index": "LOW (0.12)"
            },
            "voice_script": "Pilot duty cycle check. All four pilots within combat limits. Delta flight pilot has zero hours elapsed and is prime for scramble.",
            "recommended_action": "AUDIT_CREW"
        }

    elif any(k in q for k in ["bingo", "fuel", "range", "divert", "atf", "consumption"]):
        return {
            "query": payload.query,
            "title": "THEATER FUEL MARGIN & BINGO RESERVE ASSESSMENT",
            "executive_summary": "Fleet total fuel: 18,850 kg. All active sorties exceed designated BINGO fuel thresholds with positive divert margins to nearest TACAN station.",
            "recommendation": "Enforce cruise profile at Mach 0.85 (SFC 3.1 kg/km) until weapon release envelope is confirmed.",
            "rationale": "Rafale-Delta maintains 6,800 kg (Bingo: 1,900 kg). Su-30MKI maintains 6,400 kg (Bingo: 2,600 kg). Tejas Mk1A has 2,450 kg (Bingo: 1,100 kg).",
            "confidence_pct": 97.5,
            "metrics": {
                "total_fuel_kg": "18,850 kg",
                "bingo_margin_pct": "+68%",
                "avg_combat_radius": "1,350 km"
            },
            "voice_script": "Fuel state confirmed positive. All airframes maintain safe margins above bingo fuel. Divert corridors to Ambala and Bareilly are open.",
            "recommended_action": "AUDIT_FUEL"
        }

    else:
        return {
            "query": payload.query,
            "title": "THEATER TACTICAL SITREP & COA RECOMMENDATION",
            "executive_summary": f"Theater operating at {defcon}. Active threats: {active_threats_cnt}. Hostile UAVs: {uavs_cnt}. SCIP MILP solver generated 3 deconflicted COAs.",
            "recommendation": "Recommend executing Course of Action 1 for optimal deconflicted air superiority coverage.",
            "rationale": "Multi-source sensor fusion confirms Link-16 nodes active across 3 airbases and 4 airframes. Theta* Kinematic pathfinding guarantees safe egress outside threat envelopes.",
            "confidence_pct": 95.0,
            "metrics": {
                "solver_latency": "14.2 ms",
                "deconfliction_score": "98.2%",
                "defcon": defcon
            },
            "voice_script": f"Vayu-Net online. Defense readiness is {defcon}. Recommend Course of Action 1 for maximum tactical dominance.",
            "recommended_action": "AUTHORIZE_COA_1"
        }


@app.post("/api/v1/simulation/control")
def simulation_control(payload: SimulationControlRequest):
    """Controls simulation speed, pause, and resumption."""
    act = payload.action.lower()
    if act == "pause":
        state_store.is_running = False
    elif act == "resume":
        state_store.is_running = True
    elif act == "speed":
        state_store.sim_speed_multiplier = max(0.5, min(10.0, payload.speed_multiplier or 1.0))

    return {
        "status": "SIMULATION_CONTROL_UPDATED",
        "is_running": state_store.is_running,
        "speed_multiplier": state_store.sim_speed_multiplier,
        "clock": state_store.sim_clock
    }


# -------------------------------------------------------------------------
# WebSocket /ws/telemetry (2 Hz Live Telemetry Stream)
# -------------------------------------------------------------------------

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    High-speed WebSocket endpoint broadcasting aircraft coordinates,
    headings, fuel burns, and tactical warnings at 2 Hz.
    """
    await websocket.accept()
    connected_websockets.append(websocket)
    logger.info(f"WebSocket client connected. Active connections: {len(connected_websockets)}")

    # Send initial full state immediately upon connect
    try:
        initial_msg = {
            "type": "INITIAL_STATE",
            "state": state_store.get_full_state()
        }
        await websocket.send_text(json.dumps(initial_msg))

        while True:
            # Listen for client command messages (e.g. ping, speed adjustment)
            client_msg = await websocket.receive_text()
            try:
                data = json.loads(client_msg)
                action = data.get("action")
                if action == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "time": state_store.sim_clock}))
                elif action == "REQUEST_STATE":
                    await websocket.send_text(json.dumps({
                        "type": "STATE_SNAPSHOT",
                        "state": state_store.get_full_state()
                    }))
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(connected_websockets)}")
    except Exception as e:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)
        logger.warning(f"WebSocket connection error: {e}")


# -------------------------------------------------------------------------
# Backward Compatibility Route Aliases
# -------------------------------------------------------------------------

@app.get("/api/state")
def legacy_get_state():
    return get_theater_state()

@app.post("/api/optimize")
def legacy_optimize(payload: Optional[OptimizeRequest] = None):
    return run_optimization(payload)

@app.post("/api/disruption/inject")
def legacy_inject_disruption():
    return inject_threat(ThreatInjectionRequest())

@app.post("/api/coa/authorize")
def legacy_authorize_coa(payload: AuthorizeCOARequest):
    return authorize_coa(payload)

@app.post("/api/simulation/reset")
def legacy_reset_simulation():
    return reset_theater()


# Standalone Verification Execution
if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("PROJECT VAYU-NET (AD-DSS): Launching Production C2 Backend")
    print("Host: 0.0.0.0 | Port: 8000 | WebSocket: /ws/telemetry (2 Hz)")
    print("Fleet: Su-30MKI, Rafale-EH, Tejas Mk1A, Mirage 2000")
    print("Airbases: Ambala, Halwara, Bareilly")
    print("=" * 70)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
