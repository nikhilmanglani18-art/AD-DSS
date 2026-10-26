"""
PROJECT VAYU-NET (AD-DSS): Tactical Theatre Database
Vayusena Dynamic Air Tasking Engine
"""

from typing import Dict, List, Any
import math

# Reference Coordinates (Northern & Western Sector Air Defence Theatre)
# Origin / Center approx Lat: 30.80 N, Lon: 75.80 E
THEATRE_BOUNDS = {
    "min_lat": 28.5,
    "max_lat": 33.2,
    "min_lon": 73.0,
    "max_lon": 78.5,
    "center_lat": 30.85,
    "center_lon": 75.80
}

# Cartographic Projection Helper (WGS84 -> Local Tactical Grid in KM)
# Equirectangular approximation for high-speed 30Hz calculation
def latlon_to_tactical_km(lat: float, lon: float, origin_lat: float = 30.85, origin_lon: float = 75.80) -> tuple[float, float]:
    lat_rad = math.radians(origin_lat)
    km_per_deg_lat = 111.132
    km_per_deg_lon = 111.320 * math.cos(lat_rad)
    x = (lon - origin_lon) * km_per_deg_lon
    y = (lat - origin_lat) * km_per_deg_lat
    return (round(x, 2), round(y, 2))

def tactical_km_to_latlon(x: float, y: float, origin_lat: float = 30.85, origin_lon: float = 75.80) -> tuple[float, float]:
    lat_rad = math.radians(origin_lat)
    km_per_deg_lat = 111.132
    km_per_deg_lon = 111.320 * math.cos(lat_rad)
    lat = origin_lat + (y / km_per_deg_lat)
    lon = origin_lon + (x / km_per_deg_lon)
    return (round(lat, 4), round(lon, 4))


AIRBASES: List[Dict[str, Any]] = [
    {
        "id": "AFS_AMB",
        "name": "Ambala Air Force Station",
        "code": "AMB",
        "squadron": "No. 17 Squadron 'Golden Arrows'",
        "lat": 30.3700,
        "lon": 76.8150,
        "elevation_ft": 900,
        "runway_heading": "12/30",
        "runway_status": "FMC_GREEN", # Fully Mission Capable
        "fuel_atf_tons": 2400.0,
        "qra_status": "ALERT_5_READY", # 5 min scramble ready
        "assigned_aircraft": ["TIGER-2", "DELTA-QRA"],
        "munitions_stock": {
            "Meteor_BVRAAM": 48,
            "SCALP_EG": 22,
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
        "assigned_aircraft": ["TIGER-1"],
        "munitions_stock": {
            "Astra_Mk1": 72,
            "R77_R73": 110,
            "BrahMos_A": 14,
            "Spice_2000": 38
        }
    },
    {
        "id": "AFS_ADP",
        "name": "Adampur Air Force Station",
        "code": "ADP",
        "squadron": "No. 47 Squadron 'Black Archers'",
        "lat": 31.4330,
        "lon": 75.7580,
        "elevation_ft": 775,
        "runway_heading": "13/31",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 1950.0,
        "qra_status": "ALERT_10",
        "assigned_aircraft": ["GARUDA-1"],
        "munitions_stock": {
            "R77": 54,
            "R73": 80,
            "MICA": 42,
            "KAB_500": 30
        }
    },
    {
        "id": "AFS_SRS",
        "name": "Sirsa Air Force Station",
        "code": "SRS",
        "squadron": "No. 21 Squadron 'Ankush'",
        "lat": 29.5310,
        "lon": 75.0060,
        "elevation_ft": 650,
        "runway_heading": "05/23",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 1600.0,
        "qra_status": "ALERT_15",
        "assigned_aircraft": ["COBRA-1"],
        "munitions_stock": {
            "Astra_Mk1": 36,
            "Python_5": 48,
            "R73": 40,
            "Sudarshan_LGB": 24
        }
    },
    {
        "id": "AFS_JDP",
        "name": "Jodhpur Air Force Station",
        "code": "JDP",
        "squadron": "No. 32 Squadron 'Thunderbirds'",
        "lat": 26.2510,
        "lon": 73.0480,
        "elevation_ft": 718,
        "runway_heading": "09/27",
        "runway_status": "FMC_GREEN",
        "fuel_atf_tons": 4100.0,
        "qra_status": "STANDBY",
        "assigned_aircraft": ["NETRA-1"],
        "munitions_stock": {
            "Astra_Mk1": 80,
            "Meteor": 30,
            "BrahMos_A": 20
        }
    }
]

# Baseline Active Sorties
INITIAL_SORTIES: List[Dict[str, Any]] = [
    {
        "id": "TIGER-1",
        "callsign": "Tiger-1 Flight (Lead)",
        "aircraft_type": "SU-30MKI Flanker-H",
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
        "current_wp_index": 1
    },
    {
        "id": "TIGER-2",
        "callsign": "Tiger-2 Flight",
        "aircraft_type": "Dassault Rafale DH",
        "roles": ["Air Superiority", "BVR Intercept", "Deep Strike", "SEAD"],
        "base_id": "AFS_AMB",
        "pilot": "Sqn Ldr R. Rathore (IAF)",
        "fdl_hours_limit": 6.5,
        "fdl_hours_elapsed": 1.2,
        "status": "ON_PATROL",
        "lat": 31.3500,
        "lon": 74.8800,
        "alt_ft": 32000,
        "speed_kts": 540,
        "mach": 0.92,
        "heading_deg": 335,
        "fuel_kg": 4700,
        "max_fuel_kg": 6800,
        "bingo_fuel_kg": 1900,
        "combat_radius_km": 1850,
        "sfc_kg_per_km": 3.1,
        "max_g": 9.0,
        "payload": ["4x Meteor BVRAAM (150+km)", "2x MICA IR", "SPECTRA EW Suite"],
        "assigned_mission": "FORWARD_RECON_ALPHA",
        "waypoints": [
            {"id": "WP-T2-1", "lat": 31.35, "lon": 74.88, "alt": 32000, "name": "T2_ALPHA_INGRESS"},
            {"id": "WP-T2-2", "lat": 31.65, "lon": 74.60, "alt": 32000, "name": "T2_MID_POINT"},
            # Notice WP-T2-3: (31.88, 74.32) which is directly in the lethal zone of the incoming S-400 threat!
            {"id": "WP-T2-3", "lat": 31.88, "lon": 74.32, "alt": 32000, "name": "T2_PRIMARY_GATE"},
            {"id": "WP-T2-4", "lat": 31.40, "lon": 75.30, "alt": 30000, "name": "T2_EGRESS"}
        ],
        "current_wp_index": 1
    },
    {
        "id": "COBRA-1",
        "callsign": "Cobra-1 Flight",
        "aircraft_type": "HAL Tejas MK1A",
        "roles": ["Combat Air Patrol", "Point Intercept", "Light Attack"],
        "base_id": "AFS_SRS",
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
        "current_wp_index": 1
    },
    {
        "id": "GARUDA-1",
        "callsign": "Garuda-1 Flight",
        "aircraft_type": "Dassault Mirage 2000-5",
        "roles": ["Precision Strike", "SEAD", "BVR Intercept"],
        "base_id": "AFS_ADP",
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
        "fuel_kg": 3200,
        "max_fuel_kg": 4000,
        "bingo_fuel_kg": 1400,
        "combat_radius_km": 1200,
        "sfc_kg_per_km": 2.9,
        "max_g": 9.0,
        "payload": ["2x MICA EM", "2x Magic II", "RDY-3 Radar"],
        "assigned_mission": "REAR_GUARD_BRAVO",
        "waypoints": [
            {"id": "WP-G1-1", "lat": 31.25, "lon": 75.95, "alt": 26000, "name": "GARUDA_HOLD"},
            {"id": "WP-G1-2", "lat": 31.45, "lon": 75.40, "alt": 26000, "name": "GARUDA_WEST"},
            {"id": "WP-G1-3", "lat": 31.10, "lon": 75.50, "alt": 26000, "name": "GARUDA_BASE"}
        ],
        "current_wp_index": 1
    },
    {
        "id": "DELTA-QRA",
        "callsign": "Delta QRA Standby (Alert 5)",
        "aircraft_type": "Dassault Rafale EH",
        "roles": ["Quick Reaction Alert", "BVR Intercept", "High Mach Dash"],
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
        "fuel_kg": 6800,
        "max_fuel_kg": 6800,
        "bingo_fuel_kg": 1900,
        "combat_radius_km": 1850,
        "sfc_kg_per_km": 3.1,
        "max_g": 9.0,
        "payload": ["4x Meteor BVRAAM", "2x Mica IR", "1x External Tank"],
        "assigned_mission": "QRA_STANDBY",
        "waypoints": [],
        "current_wp_index": 0
    },
    {
        "id": "NETRA-1",
        "callsign": "Netra Eye-In-The-Sky (AEW&C)",
        "aircraft_type": "DRDO Embraer Netra",
        "roles": ["Airborne Early Warning", "Tactical Battle Management", "Sensor Fusion"],
        "base_id": "AFS_JDP",
        "pilot": "Gp Capt S. Bannerjee (IAF)",
        "fdl_hours_limit": 8.0,
        "fdl_hours_elapsed": 2.1,
        "status": "ON_STATION",
        "lat": 29.8000,
        "lon": 76.2000,
        "alt_ft": 36000,
        "speed_kts": 420,
        "mach": 0.72,
        "heading_deg": 90,
        "fuel_kg": 5900,
        "max_fuel_kg": 8500,
        "bingo_fuel_kg": 2200,
        "combat_radius_km": 2400,
        "sfc_kg_per_km": 2.2,
        "max_g": 3.0,
        "payload": ["AESA Secondary Radar", "ESM/ELINT Suite", "Secure Mil-Link TacNet"],
        "assigned_mission": "COP_AIRBORNE_SURVEILLANCE",
        "waypoints": [
            {"id": "WP-N1-1", "lat": 29.80, "lon": 76.20, "alt": 36000, "name": "ORBIT_WEST"},
            {"id": "WP-N1-2", "lat": 29.80, "lon": 76.90, "alt": 36000, "name": "ORBIT_EAST"}
        ],
        "current_wp_index": 1
    }
]

# Civil Air Traffic (Must remain deconflicted)
CIVIL_TRAFFIC: List[Dict[str, Any]] = [
    {
        "id": "AIC-102",
        "callsign": "Air India 102",
        "aircraft_type": "Boeing 787-8 Dreamliner",
        "route": "VIDP (Delhi) -> EGLL (London Heathrow)",
        "airway": "J121 / UL333",
        "squawk": "7741",
        "lat": 31.9000,
        "lon": 76.1000,
        "alt_ft": 38000,
        "speed_kts": 490,
        "heading_deg": 315,
        "status": "CIVIL_CLEARED"
    },
    {
        "id": "IGO-405",
        "callsign": "IndiGo 405",
        "aircraft_type": "Airbus A320neo",
        "route": "VISR (Srinagar) -> VIDP (Delhi)",
        "airway": "W20",
        "squawk": "4321",
        "lat": 32.2000,
        "lon": 75.3000,
        "alt_ft": 34000,
        "speed_kts": 460,
        "heading_deg": 140,
        "status": "CIVIL_CLEARED"
    },
    {
        "id": "SEJ-812",
        "callsign": "SpiceJet 812",
        "aircraft_type": "Boeing 737-800",
        "route": "VIAR (Amritsar) -> VABB (Mumbai)",
        "airway": "L333",
        "squawk": "5214",
        "lat": 30.6000,
        "lon": 74.9000,
        "alt_ft": 36000,
        "speed_kts": 475,
        "heading_deg": 190,
        "status": "CIVIL_CLEARED"
    }
]

# Hostile Threats (Populated on Threat Injection)
DISRUPTION_THREATS = {
    "sam": {
        "id": "SAM-S400-01",
        "name": "Mobile S-400 Triumf Battery (Emitter 91N6E Big Bird)",
        "type": "SAM_LONG_RANGE",
        "threat_level": "CRITICAL_LETHAL",
        "lat": 31.8500,
        "lon": 74.3000,
        "elevation_ft": 650,
        "radar_range_km": 240.0,    # Acquisition envelope
        "lethal_range_km": 120.0,   # 48N6DM lethal engagement bubble
        "min_safe_alt_ft": 45000,
        "status": "ACTIVE_ILLUMINATING",
        "detected_time": "T+00:30",
        "threat_emitter_signature": "SURV_RADAR_91N6E_FREQ_S_BAND"
    },
    "hostile_uav": {
        "id": "HOSTILE-SWARM-01",
        "name": "Hostile UAV Strike Package (2x Wing Loong II + Cruise Decoys)",
        "type": "UAV_STRIKE_PACKAGE",
        "threat_level": "HIGH_PRIORITY_INTERCEPT",
        "ingress_sector": "SECTOR_BRAVO_NORTHWEST",
        "target_facility": "Adampur Radar Relay Depot & Ambala Approach",
        "lat": 32.4000,
        "lon": 74.1000,
        "alt_ft": 18000,
        "speed_kts": 240,
        "heading_deg": 135,
        "status": "INGRESSING",
        "detected_time": "T+00:30",
        "estimated_time_to_impact_sec": 380,
        "payload": "4x BA-7 ATGMs & High-Explosive Warheads"
    }
}
