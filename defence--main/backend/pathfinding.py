"""
PROJECT VAYU-NET (AD-DSS): Kinematic Theta* Any-Angle Pathfinding Engine
Vayusena Dynamic Air Tasking Engine

Features:
- Kinematic Theta* Any-Angle pathfinding with Line-Of-Sight (LOS) threat avoidance
- Dynamic SAM threat dome penalty field (lethal bubble + radar acquisition horizon)
- Minimum turning radius constraint calculation based on max allowable g-load (n_max)
- 4D Spatiotemporal waypoint interpolation (lat, lon, alt, time, heading, speed, fuel burn)
"""

from typing import Dict, List, Tuple, Any, Optional
import math
import heapq

from .data import latlon_to_tactical_km, tactical_km_to_latlon

class KinematicThetaStarPlanner:
    def __init__(self, grid_res_km: float = 5.0, buffer_km: float = 15.0):
        self.grid_res = grid_res_km
        self.buffer_km = buffer_km

    def compute_turn_radius_km(self, speed_kts: float, n_max_g: float) -> float:
        """
        Calculates minimum turning radius: R = v^2 / (g * sqrt(n_max^2 - 1))
        speed in knots converted to m/s, result in km.
        """
        v_ms = speed_kts * 0.514444
        g = 9.80665
        if n_max_g <= 1.05:
            n_max_g = 1.05
        load_factor = math.sqrt(n_max_g**2 - 1.0)
        radius_m = (v_ms**2) / (g * load_factor)
        return round(radius_m / 1000.0, 3)

    def is_line_clear_of_threats(self, p1: Tuple[float, float], p2: Tuple[float, float], threats: List[Dict[str, Any]]) -> bool:
        """
        Checks if line segment between p1 and p2 (in tactical km) penetrates any lethal threat domes.
        """
        x1, y1 = p1
        x2, y2 = p2
        dx = x2 - x1
        dy = y2 - y1
        length = math.hypot(dx, dy)
        if length == 0:
            return True

        steps = max(2, int(length / (self.grid_res * 0.5)))
        for i in range(steps + 1):
            t = i / steps
            px = x1 + t * dx
            py = y1 + t * dy

            for th in threats:
                th_x, th_y = latlon_to_tactical_km(th["lat"], th["lon"])
                lethal_r = th.get("lethal_range_km", 100.0) + self.buffer_km
                dist = math.hypot(px - th_x, py - th_y)
                if dist < lethal_r:
                    return False
        return True

    def calculate_point_threat_cost(self, p: Tuple[float, float], threats: List[Dict[str, Any]]) -> float:
        """
        Returns cost multiplier based on threat proximity.
        """
        x, y = p
        cost = 0.0
        for th in threats:
            th_x, th_y = latlon_to_tactical_km(th["lat"], th["lon"])
            lethal_r = th.get("lethal_range_km", 100.0)
            radar_r = th.get("radar_range_km", 240.0)
            dist = math.hypot(x - th_x, y - th_y)
            if dist < lethal_r + self.buffer_km:
                return 1e6 # Effectively impassable lethal barrier
            elif dist < radar_r:
                # Quadratic gradient penalty for radar illumination
                cost += 15.0 * ((radar_r - dist) / radar_r)**2
        return cost

    def plan_theta_star(self, start_latlon: Tuple[float, float], goal_latlon: Tuple[float, float], threats: List[Dict[str, Any]], bounds_km: Tuple[float, float, float, float] = (-250, 250, -250, 250)) -> List[Tuple[float, float]]:
        """
        Kinematic Theta* Any-Angle Pathfinding in tactical coordinates (km).
        Returns list of (lat, lon) waypoints.
        """
        start_pt = latlon_to_tactical_km(start_latlon[0], start_latlon[1])
        goal_pt = latlon_to_tactical_km(goal_latlon[0], goal_latlon[1])

        # If direct path is already clear, return direct line!
        if self.is_line_clear_of_threats(start_pt, goal_pt, threats):
            return [start_latlon, goal_latlon]

        min_x, max_x, min_y, max_y = bounds_km

        def snap_to_grid(pt: Tuple[float, float]) -> Tuple[int, int]:
            return (round(pt[0] / self.grid_res), round(pt[1] / self.grid_res))

        def grid_to_point(gpt: Tuple[int, int]) -> Tuple[float, float]:
            return (gpt[0] * self.grid_res, gpt[1] * self.grid_res)

        start_grid = snap_to_grid(start_pt)
        goal_grid = snap_to_grid(goal_pt)

        # Open set priority queue: (f_score, grid_coord)
        open_set = []
        heapq.heappush(open_set, (0.0, start_grid))

        g_score: Dict[Tuple[int, int], float] = {start_grid: 0.0}
        parent: Dict[Tuple[int, int], Tuple[int, int]] = {start_grid: start_grid}

        # 8-connected grid directions
        directions = [
            (1, 0), (-1, 0), (0, 1), (0, -1),
            (1, 1), (1, -1), (-1, 1), (-1, -1)
        ]

        closed_set = set()
        max_iterations = 2500
        iterations = 0

        while open_set and iterations < max_iterations:
            iterations += 1
            _, current = heapq.heappop(open_set)

            if current == goal_grid:
                break

            if current in closed_set:
                continue
            closed_set.add(current)

            curr_pt = grid_to_point(current)
            curr_parent = parent[current]
            curr_parent_pt = grid_to_point(curr_parent)

            for dx, dy in directions:
                neighbor = (current[0] + dx, current[1] + dy)
                neighbor_pt = grid_to_point(neighbor)

                if not (min_x <= neighbor_pt[0] <= max_x and min_y <= neighbor_pt[1] <= max_y):
                    continue

                if neighbor in closed_set:
                    continue

                threat_cost = self.calculate_point_threat_cost(neighbor_pt, threats)
                if threat_cost >= 1e6:
                    continue # Inside lethal dome

                step_dist = math.hypot(dx * self.grid_res, dy * self.grid_res)

                # Theta* key step: Check Line of Sight from current node's parent to neighbor
                if self.is_line_clear_of_threats(curr_parent_pt, neighbor_pt, threats):
                    # Path 2 (Direct shortcut from parent to neighbor)
                    new_g = g_score[curr_parent] + math.hypot(neighbor_pt[0] - curr_parent_pt[0], neighbor_pt[1] - curr_parent_pt[1]) + threat_cost
                    if neighbor not in g_score or new_g < g_score[neighbor]:
                        g_score[neighbor] = new_g
                        parent[neighbor] = curr_parent
                        h_dist = math.hypot(goal_pt[0] - neighbor_pt[0], goal_pt[1] - neighbor_pt[1])
                        heapq.heappush(open_set, (new_g + h_dist, neighbor))
                else:
                    # Path 1 (Standard A* neighbor connection)
                    new_g = g_score[current] + step_dist + threat_cost
                    if neighbor not in g_score or new_g < g_score[neighbor]:
                        g_score[neighbor] = new_g
                        parent[neighbor] = current
                        h_dist = math.hypot(goal_pt[0] - neighbor_pt[0], goal_pt[1] - neighbor_pt[1])
                        heapq.heappush(open_set, (new_g + h_dist, neighbor))

        # Reconstruct path
        path_grid = []
        curr = goal_grid if goal_grid in parent else min(closed_set, key=lambda n: math.hypot(goal_pt[0] - grid_to_point(n)[0], goal_pt[1] - grid_to_point(n)[1]), default=start_grid)
        
        while curr != parent.get(curr, curr):
            path_grid.append(curr)
            curr = parent[curr]
        path_grid.append(start_grid)
        path_grid.reverse()

        # Convert back to lat/lon and insert exact start/goal endpoints
        raw_waypoints = [start_latlon]
        for gpt in path_grid:
            pt = grid_to_point(gpt)
            lat, lon = tactical_km_to_latlon(pt[0], pt[1])
            raw_waypoints.append((lat, lon))
        raw_waypoints.append(goal_latlon)

        # Simplify collinear points for silky smooth tactical display
        return self._smooth_waypoints(raw_waypoints, threats)

    def _smooth_waypoints(self, wps: List[Tuple[float, float]], threats: List[Dict[str, Any]]) -> List[Tuple[float, float]]:
        if len(wps) <= 2:
            return wps

        smoothed = [wps[0]]
        i = 0
        while i < len(wps) - 1:
            furthest = i + 1
            for j in range(len(wps) - 1, i, -1):
                p1 = latlon_to_tactical_km(wps[i][0], wps[i][1])
                p2 = latlon_to_tactical_km(wps[j][0], wps[j][1])
                if self.is_line_clear_of_threats(p1, p2, threats):
                    furthest = j
                    break
            smoothed.append(wps[furthest])
            i = furthest

        return smoothed

    def generate_4d_trajectory(self, waypoints_latlon: List[Tuple[float, float]], cruise_speed_kts: float = 540.0, cruise_alt_ft: float = 30000.0, sfc_kg_per_km: float = 3.1) -> List[Dict[str, Any]]:
        """
        Enriches waypoints into a 4D spatial-temporal flight plan with timestamps, headings, and fuel burn.
        """
        trajectory = []
        cumulative_dist_km = 0.0
        cumulative_time_sec = 0.0
        cumulative_fuel_kg = 0.0

        for idx, (lat, lon) in enumerate(waypoints_latlon):
            if idx == 0:
                heading = 0.0
                step_dist_km = 0.0
                step_time_sec = 0.0
                step_fuel = 0.0
            else:
                prev_lat, prev_lon = waypoints_latlon[idx - 1]
                p1 = latlon_to_tactical_km(prev_lat, prev_lon)
                p2 = latlon_to_tactical_km(lat, lon)
                step_dist_km = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                speed_km_s = (cruise_speed_kts * 1.852) / 3600.0
                step_time_sec = step_dist_km / speed_km_s if speed_km_s > 0 else 0
                step_fuel = step_dist_km * sfc_kg_per_km

                # Heading in degrees (0 = North, 90 = East)
                angle_rad = math.atan2(p2[0] - p1[0], p2[1] - p1[1])
                heading = (math.degrees(angle_rad) + 360.0) % 360.0

            cumulative_dist_km += step_dist_km
            cumulative_time_sec += step_time_sec
            cumulative_fuel_kg += step_fuel

            trajectory.append({
                "index": idx,
                "name": f"WP-{idx + 1:02d}",
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "alt_ft": int(cruise_alt_ft),
                "speed_kts": int(cruise_speed_kts),
                "heading_deg": round(heading, 1),
                "time_sec": round(cumulative_time_sec, 1),
                "cumulative_dist_km": round(cumulative_dist_km, 1),
                "fuel_burn_kg": round(cumulative_fuel_kg, 1)
            })

        return trajectory
