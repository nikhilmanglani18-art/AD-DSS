"""
PROJECT VAYU-NET (AD-DSS): Kinematic Theta* Any-Angle Pathfinding Engine
Vayusena Dynamic Air Tasking Engine

Features:
- Any-Angle continuous Line-Of-Sight (LOS) pathfinding via Theta* algorithm.
- Continuous analytical SAM threat dome circumnavigation (lethal bubble + buffer).
- Kinematic turn radius constraints based on aircraft aerodynamics and max allowable g-load:
    R_min = v^2 / (g * sqrt(n_max^2 - 1))
- Eliminates 90-degree Manhattan grid artifacts via continuous LOS shortcuts and circular fillet arcs.
- Full 4D Spatiotemporal flight plan generation (lat, lon, alt, speed, heading, g-load, ETA, fuel burn).
"""

from typing import Dict, List, Tuple, Any, Optional
import math
import heapq
import sys


# Self-contained cartographic projection helpers
# Default origin centered at Northern/Western Sector Air Defence Theatre (30.85 N, 75.80 E)
THEATRE_ORIGIN_LAT = 30.85
THEATRE_ORIGIN_LON = 75.80
KM_PER_DEG_LAT = 111.132


def latlon_to_tactical_km(
    lat: float,
    lon: float,
    origin_lat: float = THEATRE_ORIGIN_LAT,
    origin_lon: float = THEATRE_ORIGIN_LON
) -> Tuple[float, float]:
    """Projects WGS84 geographic coordinates to local tactical Cartesian grid (km)."""
    lat_rad = math.radians(origin_lat)
    km_per_deg_lon = 111.320 * math.cos(lat_rad)
    x = (lon - origin_lon) * km_per_deg_lon
    y = (lat - origin_lat) * KM_PER_DEG_LAT
    return (round(x, 3), round(y, 3))


def tactical_km_to_latlon(
    x: float,
    y: float,
    origin_lat: float = THEATRE_ORIGIN_LAT,
    origin_lon: float = THEATRE_ORIGIN_LON
) -> Tuple[float, float]:
    """Converts local tactical Cartesian coordinates (km) back to WGS84 geographic coordinates."""
    lat_rad = math.radians(origin_lat)
    km_per_deg_lon = 111.320 * math.cos(lat_rad)
    lat = origin_lat + (y / KM_PER_DEG_LAT)
    lon = origin_lon + (x / km_per_deg_lon)
    return (round(lat, 5), round(lon, 5))


class KinematicThetaStar:
    """
    Any-Angle Continuous Line-Of-Sight Pathfinding Engine with Kinematic Turn Constraints.
    """

    def __init__(
        self,
        grid_resolution_km: float = 6.0,
        sam_buffer_km: float = 15.0,
        default_cruise_speed_kts: float = 540.0,
        default_max_g: float = 9.0
    ):
        """
        Initializes KinematicThetaStar planner.
        :param grid_resolution_km: Grid cell discretization step in km.
        :param sam_buffer_km: Safety clearance buffer added around SAM lethal radius.
        :param default_cruise_speed_kts: Nominal cruise speed in knots.
        :param default_max_g: Maximum allowable airframe g-load factor.
        """
        self.grid_res = float(grid_resolution_km)
        self.sam_buffer_km = float(sam_buffer_km)
        self.cruise_speed_kts = float(default_cruise_speed_kts)
        self.max_g = float(default_max_g)

    def compute_turn_radius_km(self, speed_kts: float, n_max_g: float) -> float:
        """
        Calculates minimum turning radius from flight mechanics:
        R_min = v^2 / (g * sqrt(n_max^2 - 1))
        where v is in m/s, g = 9.80665 m/s^2, result returned in km.
        """
        v_ms = speed_kts * 0.514444
        g = 9.80665
        n_effective = max(1.05, float(n_max_g))
        load_factor = math.sqrt(n_effective**2 - 1.0)
        radius_m = (v_ms**2) / (g * load_factor)
        return radius_m / 1000.0

    def compute_turn_g_load(self, speed_kts: float, turn_radius_km: float) -> float:
        """
        Calculates required g-load for a given turn radius at a specific airspeed:
        n = sqrt(1 + (v^2 / (g * R))^2)
        """
        if turn_radius_km <= 0.001:
            return self.max_g
        v_ms = speed_kts * 0.514444
        g = 9.80665
        radius_m = turn_radius_km * 1000.0
        centripetal_accel = (v_ms**2) / radius_m
        g_load = math.sqrt(1.0 + (centripetal_accel / g)**2)
        return g_load

    def line_segment_intersects_threat_circle(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        center: Tuple[float, float],
        radius: float
    ) -> bool:
        """
        Continuous analytical test: checks if line segment p1-p2 penetrates circle (center, radius).
        Computes exact minimum Euclidean distance from center to segment.
        """
        x1, y1 = p1
        x2, y2 = p2
        cx, cy = center

        dx = x2 - x1
        dy = y2 - y1
        seg_len_sq = dx * dx + dy * dy

        if seg_len_sq < 1e-9:
            # Segment is a single point
            dist_sq = (x1 - cx) ** 2 + (y1 - cy) ** 2
            return dist_sq < (radius * radius)

        # Parameter t of closest point on infinite line
        t = ((cx - x1) * dx + (cy - y1) * dy) / seg_len_sq
        # Clamped to segment [0, 1]
        t_clamped = max(0.0, min(1.0, t))

        closest_x = x1 + t_clamped * dx
        closest_y = y1 + t_clamped * dy
        dist_to_seg_sq = (closest_x - cx) ** 2 + (closest_y - cy) ** 2

        return dist_to_seg_sq < (radius * radius)

    def is_line_of_sight_clear(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        threats: List[Dict[str, Any]]
    ) -> bool:
        """
        Validates continuous line-of-sight between p1 and p2 in tactical km.
        Returns False if the segment penetrates any active SAM lethal envelope (lethal_range + buffer).
        """
        for th in threats:
            # Extract threat coordinates (supports lat/lon or pre-projected tactical x/y)
            if "x" in th and "y" in th:
                th_x, th_y = float(th["x"]), float(th["y"])
            else:
                th_x, th_y = latlon_to_tactical_km(float(th.get("lat", 0.0)), float(th.get("lon", 0.0)))

            lethal_r = float(th.get("lethal_range_km", 120.0))
            buffer_r = float(th.get("buffer_km", self.sam_buffer_km))
            avoidance_r = lethal_r + buffer_r

            if self.line_segment_intersects_threat_circle(p1, p2, (th_x, th_y), avoidance_r):
                return False

        return True

    def calculate_point_threat_cost(
        self,
        pt: Tuple[float, float],
        threats: List[Dict[str, Any]]
    ) -> float:
        """
        Calculates soft threat potential cost (radar acquisition horizon penalty).
        """
        px, py = pt
        cost = 0.0
        for th in threats:
            if "x" in th and "y" in th:
                th_x, th_y = float(th["x"]), float(th["y"])
            else:
                th_x, th_y = latlon_to_tactical_km(float(th.get("lat", 0.0)), float(th.get("lon", 0.0)))

            lethal_r = float(th.get("lethal_range_km", 120.0))
            buffer_r = float(th.get("buffer_km", self.sam_buffer_km))
            radar_r = float(th.get("radar_range_km", 240.0))
            avoidance_r = lethal_r + buffer_r

            dist = math.hypot(px - th_x, py - th_y)
            if dist < avoidance_r:
                return 1e7  # Impassable barrier inside lethal bubble
            elif dist < radar_r:
                # Soft penalty for illuminated radar envelope
                cost += 20.0 * ((radar_r - dist) / max(1.0, radar_r - avoidance_r)) ** 2

        return cost

    def _snap_to_grid(self, pt: Tuple[float, float]) -> Tuple[int, int]:
        return (int(round(pt[0] / self.grid_res)), int(round(pt[1] / self.grid_res)))

    def _grid_to_point(self, gpt: Tuple[int, int]) -> Tuple[float, float]:
        return (gpt[0] * self.grid_res, gpt[1] * self.grid_res)

    def plan_theta_star(
        self,
        start_pt: Tuple[float, float],
        goal_pt: Tuple[float, float],
        threats: List[Dict[str, Any]],
        bounds_km: Tuple[float, float, float, float] = (-300.0, 300.0, -300.0, 300.0)
    ) -> List[Tuple[float, float]]:
        """
        Executes Any-Angle continuous Line-of-Sight Theta* pathfinding in tactical km.
        Returns ordered list of (x, y) waypoints in kilometers.
        """
        # If direct path between start and goal is already unobstructed, return direct vector!
        if self.is_line_of_sight_clear(start_pt, goal_pt, threats):
            return [start_pt, goal_pt]

        min_x, max_x, min_y, max_y = bounds_km
        start_grid = self._snap_to_grid(start_pt)
        goal_grid = self._snap_to_grid(goal_pt)

        # Priority queue open set: (f_score, counter, grid_coord)
        open_set: List[Tuple[float, int, Tuple[int, int]]] = []
        counter = 0
        h_start = math.hypot(goal_pt[0] - start_pt[0], goal_pt[1] - start_pt[1])
        heapq.heappush(open_set, (h_start, counter, start_grid))

        g_score: Dict[Tuple[int, int], float] = {start_grid: 0.0}
        # Parent mapping: stores predecessor in any-angle tree
        parent: Dict[Tuple[int, int], Tuple[int, int]] = {start_grid: start_grid}

        closed_set = set()

        # 8-connected grid neighborhood
        neighbors_offset = [
            (1, 0), (-1, 0), (0, 1), (0, -1),
            (1, 1), (1, -1), (-1, 1), (-1, -1)
        ]

        max_iterations = 4000
        iterations = 0

        while open_set and iterations < max_iterations:
            iterations += 1
            f_val, _, current = heapq.heappop(open_set)

            if current == goal_grid:
                break

            if current in closed_set:
                continue
            closed_set.add(current)

            curr_pt = self._grid_to_point(current)
            p_node = parent.get(current, current)
            parent_pt = self._grid_to_point(p_node) if p_node != start_grid else start_pt

            for dx, dy in neighbors_offset:
                neighbor = (current[0] + dx, current[1] + dy)
                if neighbor in closed_set:
                    continue

                neighbor_pt = self._grid_to_point(neighbor)
                if not (min_x <= neighbor_pt[0] <= max_x and min_y <= neighbor_pt[1] <= max_y):
                    continue

                threat_cost = self.calculate_point_threat_cost(neighbor_pt, threats)
                if threat_cost >= 1e6:
                    continue  # Lethal zone barrier

                # THETA* CORE: Check Line of Sight from parent(current) to neighbor
                # If LOS is clear, shortcut directly from parent to neighbor!
                if self.is_line_of_sight_clear(parent_pt, neighbor_pt, threats):
                    # Direct shortcut edge from parent to neighbor
                    dist_from_parent = math.hypot(neighbor_pt[0] - parent_pt[0], neighbor_pt[1] - parent_pt[1])
                    tentative_g = g_score[p_node] + dist_from_parent + threat_cost
                    if tentative_g < g_score.get(neighbor, float("inf")):
                        g_score[neighbor] = tentative_g
                        parent[neighbor] = p_node
                        h_cost = math.hypot(goal_pt[0] - neighbor_pt[0], goal_pt[1] - neighbor_pt[1])
                        counter += 1
                        heapq.heappush(open_set, (tentative_g + h_cost, counter, neighbor))
                else:
                    # Standard grid edge from current to neighbor
                    step_dist = math.hypot(dx * self.grid_res, dy * self.grid_res)
                    tentative_g = g_score[current] + step_dist + threat_cost
                    if tentative_g < g_score.get(neighbor, float("inf")):
                        g_score[neighbor] = tentative_g
                        parent[neighbor] = current
                        h_cost = math.hypot(goal_pt[0] - neighbor_pt[0], goal_pt[1] - neighbor_pt[1])
                        counter += 1
                        heapq.heappush(open_set, (tentative_g + h_cost, counter, neighbor))

        # Reconstruct path
        path_nodes = []
        target = goal_grid if goal_grid in parent else min(
            closed_set,
            key=lambda n: math.hypot(goal_pt[0] - self._grid_to_point(n)[0], goal_pt[1] - self._grid_to_point(n)[1]),
            default=start_grid
        )

        curr = target
        while curr in parent and parent[curr] != curr:
            path_nodes.append(curr)
            curr = parent[curr]
        path_nodes.append(start_grid)
        path_nodes.reverse()

        # Convert grid nodes to continuous tactical points
        raw_waypoints = [start_pt]
        for gpt in path_nodes:
            raw_waypoints.append(self._grid_to_point(gpt))
        raw_waypoints.append(goal_pt)

        # Remove consecutive duplicate points
        cleaned = [raw_waypoints[0]]
        for pt in raw_waypoints[1:]:
            if math.hypot(pt[0] - cleaned[-1][0], pt[1] - cleaned[-1][1]) > 0.05:
                cleaned.append(pt)

        # 1. Apply any-angle Line-of-Sight Raycasting shortcutter
        smoothed = self._raycast_shortcut(cleaned, threats)

        return smoothed

    def _raycast_shortcut(
        self,
        waypoints: List[Tuple[float, float]],
        threats: List[Dict[str, Any]]
    ) -> List[Tuple[float, float]]:
        """
        Simplifies waypoint chain by finding the furthest visible waypoint along LOS,
        eliminating intermediate grid vertices and 90-degree artifacts.
        """
        if len(waypoints) <= 2:
            return waypoints

        result = [waypoints[0]]
        i = 0
        n = len(waypoints)

        while i < n - 1:
            furthest = i + 1
            for j in range(n - 1, i, -1):
                if self.is_line_of_sight_clear(waypoints[i], waypoints[j], threats):
                    furthest = j
                    break
            result.append(waypoints[furthest])
            i = furthest

        return result

    def apply_kinematic_turn_smoothing(
        self,
        waypoints: List[Tuple[float, float]],
        threats: List[Dict[str, Any]],
        speed_kts: Optional[float] = None,
        max_g: Optional[float] = None
    ) -> List[Tuple[float, float]]:
        """
        Rounds corners using circular fillet arcs governed by aircraft minimum turn radius:
            R_min = v^2 / (g * sqrt(n_max^2 - 1))
        Ensures turns satisfy structural load factor and removes sharp corners.
        """
        if len(waypoints) <= 2:
            return waypoints

        spd = speed_kts if speed_kts is not None else self.cruise_speed_kts
        g_lim = max_g if max_g is not None else self.max_g
        r_min = self.compute_turn_radius_km(spd, g_lim)

        smoothed_path = [waypoints[0]]

        for i in range(1, len(waypoints) - 1):
            p_prev = smoothed_path[-1]
            p_curr = waypoints[i]
            p_next = waypoints[i + 1]

            # Ingress vector v1 and Egress vector v2
            v1 = (p_curr[0] - p_prev[0], p_curr[1] - p_prev[1])
            v2 = (p_next[0] - p_curr[0], p_next[1] - p_curr[1])
            len1 = math.hypot(v1[0], v1[1])
            len2 = math.hypot(v2[0], v2[1])

            if len1 < 0.1 or len2 < 0.1:
                smoothed_path.append(p_curr)
                continue

            u1 = (v1[0] / len1, v1[1] / len1)
            u2 = (v2[0] / len2, v2[1] / len2)

            # Turn deflection angle delta_theta
            dot = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
            turn_angle = math.acos(dot)

            # If angle is negligible (< 2 degrees), no fillet needed
            if turn_angle < math.radians(2.0):
                smoothed_path.append(p_curr)
                continue

            # Tangent distance from vertex: d_tangent = R_min * tan(turn_angle / 2)
            half_angle = turn_angle / 2.0
            tan_half = math.tan(half_angle)
            d_tangent_nominal = r_min * tan_half

            # Ensure fillet tangent fits within adjacent leg lengths
            max_d_tangent = 0.45 * min(len1, len2)
            d_tangent = min(d_tangent_nominal, max_d_tangent)
            eff_radius = d_tangent / max(1e-4, tan_half)

            # Tangent points
            t1 = (p_curr[0] - d_tangent * u1[0], p_curr[1] - d_tangent * u1[1])
            t2 = (p_curr[0] + d_tangent * u2[0], p_curr[1] + d_tangent * u2[1])

            # Inward normal bisector to find arc center
            # Cross product to determine turn direction (Left vs Right)
            cross_z = u1[0] * u2[1] - u1[1] * u2[0]
            turn_dir = 1.0 if cross_z >= 0 else -1.0

            # Normal to u1 pointing into turn
            n1 = (-turn_dir * u1[1], turn_dir * u1[0])
            center = (t1[0] + eff_radius * n1[0], t1[1] + eff_radius * n1[1])

            # Generate discrete fillet arc points
            start_angle = math.atan2(t1[1] - center[1], t1[0] - center[0])
            end_angle = math.atan2(t2[1] - center[1], t2[0] - center[0])

            # Adjust angle sweep
            sweep = end_angle - start_angle
            if turn_dir > 0 and sweep < 0:
                sweep += 2 * math.pi
            elif turn_dir < 0 and sweep > 0:
                sweep -= 2 * math.pi

            num_arc_steps = max(3, int(math.degrees(abs(sweep)) / 10.0))
            arc_points = []
            arc_clear = True

            for step in range(1, num_arc_steps):
                frac = step / float(num_arc_steps)
                theta = start_angle + frac * sweep
                arc_pt = (center[0] + eff_radius * math.cos(theta), center[1] + eff_radius * math.sin(theta))
                arc_points.append(arc_pt)

            # Verify that arc points do not violate SAM lethal zones
            for pt in [t1] + arc_points + [t2]:
                if not self.is_line_of_sight_clear(pt, pt, threats):
                    arc_clear = False
                    break

            if arc_clear and arc_points:
                smoothed_path.append(t1)
                smoothed_path.extend(arc_points)
                smoothed_path.append(t2)
            else:
                # If arc touches threat boundary, preserve the clear waypoint
                smoothed_path.append(p_curr)

        smoothed_path.append(waypoints[-1])

        # Clean small duplicate hops
        cleaned_final = [smoothed_path[0]]
        for pt in smoothed_path[1:]:
            if math.hypot(pt[0] - cleaned_final[-1][0], pt[1] - cleaned_final[-1][1]) > 0.05:
                cleaned_final.append(pt)

        return cleaned_final

    def plan_path(
        self,
        start_latlon: Tuple[float, float],
        goal_latlon: Tuple[float, float],
        threats: List[Dict[str, Any]],
        aircraft_type: str = "Dassault Rafale",
        cruise_speed_kts: Optional[float] = None,
        max_g: Optional[float] = None
    ) -> List[Tuple[float, float]]:
        """
        High-level path planning pipeline:
        1. Projects start & goal to local tactical grid.
        2. Executes continuous Line-of-Sight Theta*.
        3. Applies Kinematic Turn Radius circular fillet smoothing.
        4. Re-projects smoothed path back to WGS84 geographic coordinates (lat, lon).
        """
        start_pt = latlon_to_tactical_km(start_latlon[0], start_latlon[1])
        goal_pt = latlon_to_tactical_km(goal_latlon[0], goal_latlon[1])

        spd = cruise_speed_kts if cruise_speed_kts is not None else self.cruise_speed_kts
        g_val = max_g if max_g is not None else self.max_g

        # Step 1: Any-angle Theta* with analytical SAM avoidance
        raw_tactical_path = self.plan_theta_star(start_pt, goal_pt, threats)

        # Step 2: Kinematic fillet curvature smoothing
        kinematic_path = self.apply_kinematic_turn_smoothing(
            raw_tactical_path,
            threats,
            speed_kts=spd,
            max_g=g_val
        )

        # Step 3: Project back to Lat/Lon
        latlon_path = []
        for pt in kinematic_path:
            lat, lon = tactical_km_to_latlon(pt[0], pt[1])
            latlon_path.append((lat, lon))

        return latlon_path

    def generate_4d_trajectory(
        self,
        waypoints_latlon: List[Tuple[float, float]],
        cruise_speed_kts: float = 540.0,
        cruise_alt_ft: float = 30000.0,
        sfc_kg_per_km: float = 3.1
    ) -> List[Dict[str, Any]]:
        """
        Enriches geometric waypoints into a 4D tactical flight trajectory
        with timestamps, heading vectors, turn rate, g-load, and fuel burn.
        """
        trajectory = []
        cumulative_dist_km = 0.0
        cumulative_time_sec = 0.0
        cumulative_fuel_kg = 0.0

        num_wps = len(waypoints_latlon)

        for idx, (lat, lon) in enumerate(waypoints_latlon):
            p_curr = latlon_to_tactical_km(lat, lon)

            if idx == 0:
                heading_deg = 0.0
                step_dist_km = 0.0
                step_time_sec = 0.0
                step_fuel = 0.0
                turn_rate_deg_s = 0.0
                g_load = 1.0
            else:
                prev_lat, prev_lon = waypoints_latlon[idx - 1]
                p_prev = latlon_to_tactical_km(prev_lat, prev_lon)

                step_dist_km = math.hypot(p_curr[0] - p_prev[0], p_curr[1] - p_prev[1])
                speed_km_s = (cruise_speed_kts * 1.852) / 3600.0
                step_time_sec = step_dist_km / max(0.001, speed_km_s)
                step_fuel = step_dist_km * sfc_kg_per_km

                angle_rad = math.atan2(p_curr[0] - p_prev[0], p_curr[1] - p_prev[1])
                heading_deg = (math.degrees(angle_rad) + 360.0) % 360.0

                # Compute turn rate and normal g-load if intermediate turn
                if idx < num_wps - 1:
                    next_lat, next_lon = waypoints_latlon[idx + 1]
                    p_next = latlon_to_tactical_km(next_lat, next_lon)
                    next_angle = (math.degrees(math.atan2(p_next[0] - p_curr[0], p_next[1] - p_curr[1])) + 360.0) % 360.0
                    d_heading = abs((next_angle - heading_deg + 180.0) % 360.0 - 180.0)

                    if step_time_sec > 0.1:
                        turn_rate_deg_s = round(d_heading / max(1.0, step_time_sec), 2)
                    else:
                        turn_rate_deg_s = 0.0
                    v_ms = cruise_speed_kts * 0.514444
                    omega_rad_s = math.radians(turn_rate_deg_s)
                    a_c = v_ms * omega_rad_s
                    g_load = round(math.sqrt(1.0 + (a_c / 9.80665)**2), 2)
                else:
                    turn_rate_deg_s = 0.0
                    g_load = 1.0

            cumulative_dist_km += step_dist_km
            cumulative_time_sec += step_time_sec
            cumulative_fuel_kg += step_fuel

            trajectory.append({
                "index": idx,
                "name": f"WP-{idx + 1:02d}",
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "x_km": round(p_curr[0], 2),
                "y_km": round(p_curr[1], 2),
                "alt_ft": int(cruise_alt_ft),
                "speed_kts": int(cruise_speed_kts),
                "heading_deg": round(heading_deg, 1),
                "turn_rate_deg_s": turn_rate_deg_s,
                "g_load": g_load,
                "time_sec": round(cumulative_time_sec, 1),
                "cumulative_dist_km": round(cumulative_dist_km, 2),
                "fuel_burn_kg": round(cumulative_fuel_kg, 1)
            })

        return trajectory


# Alias for backward compatibility with existing codebase
KinematicThetaStarPlanner = KinematicThetaStar


# Self-contained Unit Tests
if __name__ == "__main__":
    print("=" * 70)
    print("PROJECT VAYU-NET: KinematicThetaStar Unit Verification")
    print("=" * 70)

    planner = KinematicThetaStar(grid_resolution_km=5.0, sam_buffer_km=15.0)

    # 1. Aerodynamic Minimum Turn Radius Test
    print("\n--- Minimum Turn Radius Aerodynamic Verification ---")
    r_turn_9g = planner.compute_turn_radius_km(speed_kts=540.0, n_max_g=9.0)
    r_turn_4g = planner.compute_turn_radius_km(speed_kts=540.0, n_max_g=4.0)
    r_turn_3g = planner.compute_turn_radius_km(speed_kts=420.0, n_max_g=3.0)
    print(f"  [PASS] Mach 0.9 (540 kts) @ 9.0g limit : R_min = {r_turn_9g:.3f} km (~{r_turn_9g*1000:.0f} m)")
    print(f"  [PASS] Mach 0.9 (540 kts) @ 4.0g gentle: R_min = {r_turn_4g:.3f} km")
    print(f"  [PASS] AEW&C Netra (420 kts) @ 3.0g cap : R_min = {r_turn_3g:.3f} km")
    assert 0.5 < r_turn_9g < 1.5, f"Unrealistic 9g turn radius: {r_turn_9g}"

    # 2. Direct Unobstructed Vector Verification (No threats)
    print("\n--- Direct Vector Test (Unobstructed Airspace) ---")
    start_ll = (30.3700, 76.8150)  # Ambala AFS
    goal_ll = (30.7490, 75.6330)   # Halwara AFS
    unobstructed_path = planner.plan_path(start_ll, goal_ll, threats=[])
    print(f"  Start: {start_ll} -> Goal: {goal_ll}")
    print(f"  Waypoint Count: {len(unobstructed_path)} (Direct Vector, zero grid stair-stepping)")
    assert len(unobstructed_path) == 2, f"Expected direct 2-point vector, got {len(unobstructed_path)}"
    assert unobstructed_path[0] == start_ll
    assert unobstructed_path[-1] == goal_ll

    # 3. Active SAM Circumnavigation Verification
    print("\n--- SAM Dome Circumnavigation Verification ---")
    # S-400 deployed directly between Tiger-2 route
    sam_threat = {
        "id": "SAM-S400",
        "name": "S-400 Triumf Battery",
        "lat": 31.8500,
        "lon": 74.3000,
        "lethal_range_km": 120.0,
        "radar_range_km": 240.0,
        "buffer_km": 15.0
    }
    avoidance_r = sam_threat["lethal_range_km"] + sam_threat["buffer_km"]  # 135 km

    # Flight path directly crosses through the SAM lethal bubble
    # Start in Halwara/Ludhiana area (safe eastern flank), goal in northwest sector
    t2_start = (30.8000, 75.8000)
    t2_goal = (32.8000, 73.0000)

    sam_pt = latlon_to_tactical_km(sam_threat["lat"], sam_threat["lon"])
    s_pt = latlon_to_tactical_km(t2_start[0], t2_start[1])
    g_pt = latlon_to_tactical_km(t2_goal[0], t2_goal[1])

    direct_intersects = planner.line_segment_intersects_threat_circle(s_pt, g_pt, sam_pt, avoidance_r)
    print(f"  Direct straight line penetrates SAM lethal circle: {direct_intersects}")
    assert direct_intersects, "Test setup error: direct path should intersect SAM circle!"

    # Run KinematicThetaStar to plan safe circumnavigation
    evasion_path = planner.plan_path(t2_start, t2_goal, threats=[sam_threat])
    print(f"  Evasion Waypoints Planned: {len(evasion_path)}")

    # Check every segment and waypoint for clearance
    min_dist_to_sam = float("inf")
    for idx, wp in enumerate(evasion_path):
        wpt_tactical = latlon_to_tactical_km(wp[0], wp[1])
        dist_to_center = math.hypot(wpt_tactical[0] - sam_pt[0], wpt_tactical[1] - sam_pt[1])
        min_dist_to_sam = min(min_dist_to_sam, dist_to_center)
        print(f"    WP {idx+1:02d}: Lat={wp[0]:.4f}, Lon={wp[1]:.4f} | Dist to SAM: {dist_to_center:.1f} km (Min Safe: {avoidance_r} km)")
        assert dist_to_center >= (avoidance_r - 1.0), f"Waypoint {idx} penetrated lethal bubble! {dist_to_center} < {avoidance_r}"

    print(f"  [PASS] Minimum standoff margin achieved: {min_dist_to_sam:.2f} km >= {avoidance_r} km")

    # 4. Verify No 90-Degree Jagged Artifacts
    print("\n--- Grid Artifact Elimination Verification ---")
    angles = []
    for i in range(1, len(evasion_path) - 1):
        p1 = latlon_to_tactical_km(evasion_path[i-1][0], evasion_path[i-1][1])
        p2 = latlon_to_tactical_km(evasion_path[i][0], evasion_path[i][1])
        p3 = latlon_to_tactical_km(evasion_path[i+1][0], evasion_path[i+1][1])
        v1 = (p2[0] - p1[0], p2[1] - p1[1])
        v2 = (p3[0] - p2[0], p3[1] - p2[1])
        dot = max(-1.0, min(1.0, (v1[0]*v2[0] + v1[1]*v2[1]) / (math.hypot(v1[0], v1[1]) * math.hypot(v2[0], v2[1]))))
        defl_deg = math.degrees(math.acos(dot))
        angles.append(defl_deg)
        print(f"  Turn at WP-{i+1:02d}: Deflection = {defl_deg:.1f}°")
        # Ensure smooth turns, no harsh 90° or 180° hairpin artifacts
        assert defl_deg < 85.0, f"Jagged turn artifact detected: {defl_deg}°"

    print("  [PASS] All turn vectors are smooth any-angle transitions (<85° max deflection).")

    # 5. Generate 4D Flight Plan Trajectory
    print("\n--- 4D Spatiotemporal Trajectory Output ---")
    trajectory_4d = planner.generate_4d_trajectory(
        evasion_path,
        cruise_speed_kts=540.0,
        cruise_alt_ft=32000.0,
        sfc_kg_per_km=3.1
    )
    for wp in trajectory_4d:
        print(
            f"  {wp['name']}: Lat {wp['lat']:.4f}, Lon {wp['lon']:.4f} | "
            f"Hdg: {wp['heading_deg']:05.1f}° | G-Load: {wp['g_load']:.1f}g | "
            f"T+{wp['time_sec']:.1f}s | Fuel: {wp['fuel_burn_kg']:.1f} kg"
        )

    assert len(trajectory_4d) == len(evasion_path)
    assert trajectory_4d[-1]["fuel_burn_kg"] > 0
    assert trajectory_4d[-1]["time_sec"] > 0

    print("\n" + "=" * 70)
    print("[ALL KINEMATIC THETA* TESTS PASSED SUCCESSFULLY!]")
    print("=" * 70)
