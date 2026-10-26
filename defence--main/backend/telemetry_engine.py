"""
PROJECT VAYU-NET (AD-DSS): Telemetry & Kinematic Simulation Engine
Vayusena Dynamic Air Tasking Engine

Features:
- High-frequency simulation clock (multi-track kinematics)
- Collision & threat envelope detection (<800ms flagging)
- Automatic state management for the 4-Stage Hackathon Live Run:
  * T+00:00: Baseline patrol
  * T+00:30: Threat Injection (S-400 + Hostile UAVs)
  * T+00:31: MILP Solver triggered, 3 COAs pushed
  * T+00:45: Authorized COA-1 execution (Scramble & Deconfliction)
"""

from typing import Dict, List, Any, Optional
import math
import copy
import time
import asyncio

from .data import (
    AIRBASES,
    INITIAL_SORTIES,
    CIVIL_TRAFFIC,
    DISRUPTION_THREATS,
    latlon_to_tactical_km,
    tactical_km_to_latlon
)
from .milp_solver import AirTaskingMILPSolver
from .pathfinding import KinematicThetaStarPlanner

class TelemetryEngine:
    def __init__(self):
        self.sim_time_sec: float = 0.0
        self.sim_speed_multiplier: float = 1.0
        self.is_running: bool = True
        self.disruption_injected: bool = False
        self.coa_authorized: Optional[str] = None
        self.auth_time_sec: Optional[float] = None
        self.intercept_success: bool = False

        self.airbases: List[Dict[str, Any]] = copy.deepcopy(AIRBASES)
        self.sorties: List[Dict[str, Any]] = copy.deepcopy(INITIAL_SORTIES)
        self.civil_traffic: List[Dict[str, Any]] = copy.deepcopy(CIVIL_TRAFFIC)
        self.threats: List[Dict[str, Any]] = []
        self.hostile_uavs: List[Dict[str, Any]] = []

        self.active_alerts: List[Dict[str, Any]] = []
        self.latest_optimization: Optional[Dict[str, Any]] = None

        self.solver = AirTaskingMILPSolver()
        self.planner = KinematicThetaStarPlanner()

    def reset(self):
        """Resets simulation to T+00:00 Baseline."""
        self.sim_time_sec = 0.0
        self.is_running = True
        self.disruption_injected = False
        self.coa_authorized = None
        self.auth_time_sec = None
        self.intercept_success = False

        self.airbases = copy.deepcopy(AIRBASES)
        self.sorties = copy.deepcopy(INITIAL_SORTIES)
        self.civil_traffic = copy.deepcopy(CIVIL_TRAFFIC)
        self.threats = []
        self.hostile_uavs = []
        self.active_alerts = [
            {
                "id": "SYS-INIT",
                "level": "INFO",
                "timestamp": "T+00:00",
                "message": "PROJECT VAYU-NET: Western Tactical Air Command Online. 4 Sorties on CAP.",
                "color": "green"
            }
        ]
        self.latest_optimization = None

    def inject_disruption(self):
        """
        Stage 2 (T+00:30): Injects mobile S-400 SAM threat and hostile UAV strike package.
        Triggers MILP optimization (<800ms latency).
        """
        if self.disruption_injected:
            return

        self.disruption_injected = True
        
        # 1. Add S-400 SAM Emitter
        s400 = copy.deepcopy(DISRUPTION_THREATS["sam"])
        self.threats.append(s400)

        # 2. Add Hostile UAV Strike Package
        uav = copy.deepcopy(DISRUPTION_THREATS["hostile_uav"])
        self.hostile_uavs.append(uav)

        # 3. Add High Priority Alert Banner
        alert_timestamp = f"T+{int(self.sim_time_sec):02d}:{int((self.sim_time_sec % 1) * 100):02d}"
        self.active_alerts.insert(0, {
            "id": f"ALERT-SAM-{int(self.sim_time_sec)}",
            "level": "CRITICAL",
            "timestamp": alert_timestamp,
            "title": "THREAT INGESTION: S-400 RADAR ILLUMINATION DETECTED",
            "message": "Mobile S-400 Battery illuminated Sortie Tiger-2 (WP-T2-3 within 120km lethal dome). Hostile UAV Strike Package entering Sector Bravo NW.",
            "color": "red",
            "lat": s400["lat"],
            "lon": s400["lon"]
        })

        # 4. Trigger Instantaneous MILP Optimization (<800ms Latency target)
        missions = [
            {
                "id": "TASK-DEFENSE-INTERCEPT",
                "name": "Urgent BVR Intercept of Hostile UAV Strike Package",
                "required_role": "BVR Intercept",
                "priority_score": 98.0,
                "target_lat": uav["lat"],
                "target_lon": uav["lon"]
            },
            {
                "id": "TASK-DECONFLICT-T2",
                "name": "Deconflict Sortie Tiger-2 from S-400 Threat Dome",
                "required_role": "Air Superiority",
                "priority_score": 94.0,
                "target_lat": 31.45,
                "target_lon": 75.30
            }
        ]

        # Aircraft candidates: Active sorties + Delta QRA at Ambala
        candidates = copy.deepcopy(self.sorties)
        opt_result = self.solver.solve(candidates, missions, self.threats)
        self.latest_optimization = opt_result

        self.active_alerts.insert(0, {
            "id": f"ALERT-OPT-{int(self.sim_time_sec)}",
            "level": "KESARI_ACTION",
            "timestamp": alert_timestamp,
            "title": "AD-DSS REPLANNER: 3 COURSES OF ACTION GENERATED",
            "message": f"MILP Solver (SCIP Engine) resolved in {opt_result['latency_ms']} ms. COA-1 Recommended: Scramble Delta QRA + Kinematic Theta* Evasion.",
            "color": "kesari",
            "latency_ms": opt_result['latency_ms']
        })

    def authorize_coa(self, coa_id: str = "COA-1"):
        """
        Stage 4 (T+00:45): High Command authorizes Course of Action.
        Recomputes trajectories and updates mission status to INTERCEPTING.
        """
        self.coa_authorized = coa_id
        self.auth_time_sec = self.sim_time_sec

        auth_timestamp = f"T+{int(self.sim_time_sec):02d}:{int((self.sim_time_sec % 1) * 100):02d}"

        if coa_id == "COA-1":
            # 1. Scramble Delta-QRA from Ambala AFS
            for ac in self.sorties:
                if ac["id"] == "DELTA-QRA":
                    ac["status"] = "SCRAMBLING_AIRBORNE"
                    ac["assigned_mission"] = "HIGH_MACH_INTERCEPT_UAV"
                    ac["speed_kts"] = 720
                    ac["mach"] = 1.35
                    ac["alt_ft"] = 26000
                    # Plan direct supersonic vector toward hostile UAV expected track
                    ac["waypoints"] = [
                        {"id": "WP-DQ-1", "lat": 30.37, "lon": 76.81, "alt": 5000, "name": "AMB_SCRAMBLE_CLIMB"},
                        {"id": "WP-DQ-2", "lat": 30.90, "lon": 76.10, "alt": 22000, "name": "SUPERSONIC_GATE"},
                        {"id": "WP-DQ-3", "lat": 31.60, "lon": 75.10, "alt": 26000, "name": "INTERCEPT_BRACKET"},
                        {"id": "WP-DQ-4", "lat": 32.00, "lon": 74.60, "alt": 26000, "name": "TERMINAL_ENGAGE"}
                    ]
                    ac["current_wp_index"] = 1

                elif ac["id"] == "TIGER-2":
                    # Recompute Tiger-2 trajectory using Kinematic Theta* pathfinding around S-400
                    ac["status"] = "DECONFLICTED_EVASION"
                    ac["assigned_mission"] = "THETA_STAR_SAM_BYPASS"
                    start_ll = (ac["lat"], ac["lon"])
                    goal_ll = (31.35, 75.40) # Safe egress waypoint east of threat dome
                    smooth_wps = self.planner.plan_theta_star(start_ll, goal_ll, self.threats)
                    
                    new_wps = []
                    for idx, pt in enumerate(smooth_wps):
                        new_wps.append({
                            "id": f"WP-T2-THETA-{idx + 1}",
                            "lat": pt[0],
                            "lon": pt[1],
                            "alt": 30000,
                            "name": f"THETA_CORRIDOR_{idx + 1}"
                        })
                    ac["waypoints"] = new_wps
                    ac["current_wp_index"] = 0

            # Update Airbase QRA status
            for ab in self.airbases:
                if ab["code"] == "AMB":
                    ab["qra_status"] = "AIRBORNE_SCRAMBLED"

            self.active_alerts.insert(0, {
                "id": f"ALERT-EXEC-{int(self.sim_time_sec)}",
                "level": "SUCCESS",
                "timestamp": auth_timestamp,
                "title": "COMMAND AUTHORIZATION: COA-1 EXECUTED",
                "message": "Delta QRA airborne from Ambala AFS. Tiger-2 re-routed via Theta* SAM bypass corridor. Mission Status: INTERCEPTING.",
                "color": "green"
            })

        elif coa_id == "COA-2":
            # Retask Tiger-1, terrain mask Tiger-2
            for ac in self.sorties:
                if ac["id"] == "TIGER-1":
                    ac["status"] = "RETASKED_INTERCEPT"
                    ac["speed_kts"] = 680
                    ac["mach"] = 1.15
                    ac["waypoints"] = [
                        {"id": "WP-T1-RT-1", "lat": ac["lat"], "lon": ac["lon"], "alt": 24000, "name": "RETASK_TURN"},
                        {"id": "WP-T1-RT-2", "lat": 32.10, "lon": 74.50, "alt": 24000, "name": "ASTRA_LAUNCH_GATE"}
                    ]
                    ac["current_wp_index"] = 1
                elif ac["id"] == "TIGER-2":
                    ac["status"] = "TERRAIN_MASK_DESCENT"
                    ac["alt_ft"] = 14000
                    ac["speed_kts"] = 490

            self.active_alerts.insert(0, {
                "id": f"ALERT-EXEC-{int(self.sim_time_sec)}",
                "level": "WARNING",
                "timestamp": auth_timestamp,
                "title": "COMMAND AUTHORIZATION: COA-2 EXECUTED",
                "message": "Tiger-1 retasked to BVR Intercept. Tiger-2 descending to FL140 under radar horizon. Higher fuel burn committed.",
                "color": "kesari"
            })

        elif coa_id == "COA-3":
            # Abort Tiger-2, Akash-NG handoff
            for ac in self.sorties:
                if ac["id"] == "TIGER-2":
                    ac["status"] = "ABORT_HOLDING_ORBIT"
                    ac["heading_deg"] = (ac["heading_deg"] + 180) % 360
                    ac["waypoints"] = [
                        {"id": "WP-T2-HOLD-1", "lat": 31.20, "lon": 75.30, "alt": 28000, "name": "ORBIT_HOLD_BEAS"}
                    ]

            self.active_alerts.insert(0, {
                "id": f"ALERT-EXEC-{int(self.sim_time_sec)}",
                "level": "INFO",
                "timestamp": auth_timestamp,
                "title": "COMMAND AUTHORIZATION: COA-3 EXECUTED",
                "message": "Tiger-2 pulled back to defensive orbit. Terminal engagement delegated to Adampur Akash-NG SAM battery.",
                "color": "blue"
            })

    def update_step(self, dt_sec: float = 0.1):
        """
        Advances the kinematic simulation by dt_sec seconds.
        """
        if not self.is_running:
            return

        effective_dt = dt_sec * self.sim_speed_multiplier
        self.sim_time_sec += effective_dt

        # Check for auto-trigger of disruption if user let it run past T+00:30
        if self.sim_time_sec >= 30.0 and not self.disruption_injected:
            self.inject_disruption()

        # Update Aircraft Sorties Positions
        for ac in self.sorties:
            if ac["status"] == "STANDBY_QRA_5MIN":
                continue # stationary on tarmac until scramble

            wps = ac.get("waypoints", [])
            idx = ac.get("current_wp_index", 0)

            if wps and idx < len(wps):
                target_wp = wps[idx]
                target_lat = target_wp["lat"]
                target_lon = target_wp["lon"]

                curr_lat = ac["lat"]
                curr_lon = ac["lon"]

                p_curr = latlon_to_tactical_km(curr_lat, curr_lon)
                p_target = latlon_to_tactical_km(target_lat, target_lon)

                dx = p_target[0] - p_curr[0]
                dy = p_target[1] - p_curr[1]
                dist_km = math.hypot(dx, dy)

                if dist_km < 3.0: # Close to waypoint, cycle next
                    if idx + 1 < len(wps):
                        ac["current_wp_index"] = idx + 1
                    else:
                        # Loop back or reverse
                        ac["current_wp_index"] = 0
                else:
                    # Advance towards target waypoint
                    speed_km_s = (ac["speed_kts"] * 1.852) / 3600.0
                    step_dist = speed_km_s * effective_dt

                    # Heading calculation
                    angle_rad = math.atan2(dx, dy)
                    heading = (math.degrees(angle_rad) + 360.0) % 360.0
                    ac["heading_deg"] = round(heading, 1)

                    move_ratio = min(1.0, step_dist / dist_km)
                    new_x = p_curr[0] + dx * move_ratio
                    new_y = p_curr[1] + dy * move_ratio

                    new_lat, new_lon = tactical_km_to_latlon(new_x, new_y)
                    ac["lat"] = new_lat
                    ac["lon"] = new_lon

                    # Fuel burn consumption
                    sfc = ac.get("sfc_kg_per_km", 3.0)
                    fuel_used = step_dist * sfc
                    ac["fuel_kg"] = max(0, round(ac["fuel_kg"] - fuel_used, 1))

                    # Pilot FDL timer progression
                    ac["fdl_hours_elapsed"] = round(ac["fdl_hours_elapsed"] + (effective_dt / 3600.0), 3)

        # Update Civil Traffic
        for civ in self.civil_traffic:
            heading_rad = math.radians(civ["heading_deg"])
            speed_km_s = (civ["speed_kts"] * 1.852) / 3600.0
            dist = speed_km_s * effective_dt
            dx = dist * math.sin(heading_rad)
            dy = dist * math.cos(heading_rad)

            px, py = latlon_to_tactical_km(civ["lat"], civ["lon"])
            nlat, nlon = tactical_km_to_latlon(px + dx, py + dy)
            civ["lat"] = nlat
            civ["lon"] = nlon

        # Update Hostile UAVs (if active)
        for uav in self.hostile_uavs:
            if uav.get("neutralized", False):
                continue

            heading_rad = math.radians(uav["heading_deg"])
            speed_km_s = (uav["speed_kts"] * 1.852) / 3600.0
            dist = speed_km_s * effective_dt
            dx = dist * math.sin(heading_rad)
            dy = dist * math.cos(heading_rad)

            px, py = latlon_to_tactical_km(uav["lat"], uav["lon"])
            nlat, nlon = tactical_km_to_latlon(px + dx, py + dy)
            uav["lat"] = nlat
            uav["lon"] = nlon

            # Check if intercepted by Delta-QRA or Tiger-1
            for ac in self.sorties:
                if ac["status"] in ["SCRAMBLING_AIRBORNE", "RETASKED_INTERCEPT"]:
                    p_ac = latlon_to_tactical_km(ac["lat"], ac["lon"])
                    dist_to_uav = math.hypot(p_ac[0] - px, p_ac[1] - py)
                    
                    # Within BVR missile lock envelope (under 45km)
                    if dist_to_uav < 45.0 and not self.intercept_success:
                        self.intercept_success = True
                        uav["neutralized"] = True
                        uav["status"] = "SPLASH_CONFIRMED_NEUTRALIZED"
                        ac["status"] = "SPLASH_CONFIRMED_RTB"
                        
                        splash_time = f"T+{int(self.sim_time_sec):02d}:{int((self.sim_time_sec % 1) * 100):02d}"
                        self.active_alerts.insert(0, {
                            "id": f"ALERT-SPLASH-{int(self.sim_time_sec)}",
                            "level": "SUCCESS",
                            "timestamp": splash_time,
                            "title": "BVR WEAPON LOCK: SPLASH CONFIRMED",
                            "message": f"Sortie {ac['id']} successfully engaged and destroyed hostile UAV strike package with Meteor BVRAAM. Sector Bravo airspace secured.",
                            "color": "green"
                        })

    def get_state(self) -> Dict[str, Any]:
        """
        Returns full Common Operational Picture (COP) state.
        """
        sim_min = int(self.sim_time_sec // 60)
        sim_sec = int(self.sim_time_sec % 60)
        formatted_sim_clock = f"T+{sim_min:02d}:{sim_sec:02d}"

        return {
            "sim_clock": formatted_sim_clock,
            "sim_time_sec": round(self.sim_time_sec, 2),
            "sim_speed_multiplier": self.sim_speed_multiplier,
            "is_running": self.is_running,
            "disruption_injected": self.disruption_injected,
            "coa_authorized": self.coa_authorized,
            "intercept_success": self.intercept_success,
            "theatre_name": "WESTERN AIR COMMAND (TACTICAL COP)",
            "airbases": self.airbases,
            "sorties": self.sorties,
            "civil_traffic": self.civil_traffic,
            "threats": self.threats,
            "hostile_uavs": self.hostile_uavs,
            "active_alerts": self.active_alerts[:8], # Recent 8 alerts
            "latest_optimization": self.latest_optimization
        }
