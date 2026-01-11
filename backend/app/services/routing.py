"""
Routing service - gets route options from external APIs.
Uses HERE or TomTom as primary, falls back to OSRM for free tier.
Includes turn-by-turn instructions for navigation.
"""
import httpx
from typing import Optional
import polyline
import flexpolyline

from app.config import get_settings


class RoutingService:
    """Fetches route options from routing APIs."""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def get_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool = True,
        include_instructions: bool = True,
    ) -> list[dict]:
        """
        Get route options between origin and destination.
        Returns list of route dicts with geometry, distance, duration, and instructions.
        """
        # Try HERE first if key available
        if self.settings.here_api_key:
            return await self._get_here_routes(origin, destination, alternatives, include_instructions)

        # Fall back to TomTom
        if self.settings.tomtom_api_key:
            return await self._get_tomtom_routes(origin, destination, alternatives, include_instructions)

        # Last resort: OSRM (free, no traffic)
        return await self._get_osrm_routes(origin, destination, alternatives, include_instructions)

    async def get_incidents(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> list[dict]:
        """Get traffic incidents along the route corridor."""
        # Calculate bounding box with some padding
        min_lat = min(origin[0], destination[0]) - 0.1
        max_lat = max(origin[0], destination[0]) + 0.1
        min_lng = min(origin[1], destination[1]) - 0.1
        max_lng = max(origin[1], destination[1]) + 0.1

        incidents = []

        # Try TomTom incidents
        if self.settings.tomtom_api_key:
            incidents.extend(await self._get_tomtom_incidents(min_lat, min_lng, max_lat, max_lng))

        # Try HERE incidents
        if self.settings.here_api_key and not incidents:
            incidents.extend(await self._get_here_incidents(min_lat, min_lng, max_lat, max_lng))

        return incidents

    async def _get_tomtom_incidents(
        self, min_lat: float, min_lng: float, max_lat: float, max_lng: float
    ) -> list[dict]:
        """Fetch incidents from TomTom Traffic API."""
        client = await self._get_client()
        try:
            bbox = f"{min_lat},{min_lng},{max_lat},{max_lng}"
            resp = await client.get(
                f"https://api.tomtom.com/traffic/services/5/incidentDetails",
                params={
                    "key": self.settings.tomtom_api_key,
                    "bbox": bbox,
                    "fields": "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},startTime,endTime}}}",
                    "language": "en-US",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            incidents = []
            for inc in data.get("incidents", []):
                props = inc.get("properties", {})
                geom = inc.get("geometry", {})
                coords = geom.get("coordinates", [])

                # Get first coordinate for marker placement
                if coords and isinstance(coords[0], list):
                    lat, lng = coords[0][1], coords[0][0]
                elif coords:
                    lat, lng = coords[1], coords[0]
                else:
                    continue

                events = props.get("events", [])
                description = events[0].get("description", "Traffic incident") if events else "Traffic incident"

                incidents.append({
                    "id": f"tomtom_{len(incidents)}",
                    "type": self._map_tomtom_incident_type(props.get("iconCategory", 0)),
                    "severity": self._map_delay_to_severity(props.get("magnitudeOfDelay", 0)),
                    "description": description,
                    "lat": lat,
                    "lng": lng,
                    "source": "tomtom",
                })

            return incidents
        except Exception as e:
            print(f"Error fetching TomTom incidents: {e}")
            return []

    async def _get_here_incidents(
        self, min_lat: float, min_lng: float, max_lat: float, max_lng: float
    ) -> list[dict]:
        """Fetch incidents from HERE Traffic API."""
        client = await self._get_client()
        try:
            resp = await client.get(
                "https://data.traffic.hereapi.com/v7/incidents",
                params={
                    "apiKey": self.settings.here_api_key,
                    "in": f"bbox:{min_lng},{min_lat},{max_lng},{max_lat}",
                    "locationReferencing": "shape",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            incidents = []
            for result in data.get("results", []):
                inc = result.get("incidentDetails", {})
                location = result.get("location", {})
                shape = location.get("shape", {})
                links = shape.get("links", [])

                # Get coordinates from first link
                if links and links[0].get("points"):
                    point = links[0]["points"][0]
                    lat, lng = point.get("lat", 0), point.get("lng", 0)
                else:
                    continue

                incidents.append({
                    "id": f"here_{len(incidents)}",
                    "type": inc.get("type", "UNKNOWN").lower(),
                    "severity": inc.get("criticality", "minor").lower(),
                    "description": inc.get("description", {}).get("value", "Traffic incident"),
                    "lat": lat,
                    "lng": lng,
                    "source": "here",
                })

            return incidents
        except Exception as e:
            print(f"Error fetching HERE incidents: {e}")
            return []

    def _map_tomtom_incident_type(self, icon_category: int) -> str:
        """Map TomTom icon category to incident type."""
        mapping = {
            0: "unknown",
            1: "accident",
            2: "fog",
            3: "dangerous_conditions",
            4: "rain",
            5: "ice",
            6: "jam",
            7: "lane_closed",
            8: "road_closed",
            9: "road_works",
            10: "wind",
            11: "flooding",
            14: "broken_down_vehicle",
        }
        return mapping.get(icon_category, "unknown")

    def _map_delay_to_severity(self, magnitude: int) -> str:
        """Map delay magnitude to severity level."""
        if magnitude >= 4:
            return "critical"
        elif magnitude >= 3:
            return "major"
        elif magnitude >= 2:
            return "moderate"
        elif magnitude >= 1:
            return "minor"
        return "low"

    async def _get_here_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
        include_instructions: bool,
    ) -> list[dict]:
        """Fetch routes from HERE Routing API v8."""
        client = await self._get_client()

        return_fields = "polyline,summary,travelSummary"
        if include_instructions:
            return_fields += ",actions,instructions,turnByTurnActions"

        params = {
            "apiKey": self.settings.here_api_key,
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "transportMode": "car",
            "return": return_fields,
            "alternatives": 3 if alternatives else 0,
            "traffic": "enabled",
            "units": "imperial",
        }

        resp = await client.get(
            "https://router.hereapi.com/v8/routes",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

        routes = []
        for i, route in enumerate(data.get("routes", [])):
            section = route["sections"][0]
            summary = section.get("travelSummary", section.get("summary", {}))

            # Decode polyline to coordinates
            encoded = section.get("polyline", "")
            coords = self._decode_here_polyline(encoded) if encoded else []

            # Extract turn-by-turn instructions
            instructions = []
            if include_instructions:
                for action in section.get("actions", []):
                    instruction = {
                        "type": action.get("action", "continue"),
                        "instruction": action.get("instruction", ""),
                        "distance_m": action.get("length", 0),
                        "duration_s": action.get("duration", 0),
                    }

                    # Get position for this instruction
                    if action.get("offset") is not None and coords:
                        offset = min(action["offset"], len(coords) - 1)
                        instruction["lat"] = coords[offset]["lat"]
                        instruction["lng"] = coords[offset]["lng"]

                    # Map HERE action types to standard types
                    instruction["maneuver"] = self._map_here_maneuver(action.get("action", ""))
                    instruction["road_name"] = action.get("nextRoad", {}).get("name", [""])[0] if action.get("nextRoad") else ""

                    instructions.append(instruction)

            routes.append({
                "id": f"here_{i}",
                "name": self._generate_route_name(i),
                "distance_km": summary.get("length", 0) / 1000,
                "duration_minutes": summary.get("duration", 0) / 60,
                "geometry": coords,
                "instructions": instructions,
                "source": "here",
            })

        return routes

    async def _get_tomtom_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
        include_instructions: bool,
    ) -> list[dict]:
        """Fetch routes from TomTom Routing API."""
        client = await self._get_client()

        locations = f"{origin[0]},{origin[1]}:{destination[0]},{destination[1]}"
        params = {
            "key": self.settings.tomtom_api_key,
            "traffic": "true",
            "travelMode": "car",
            "maxAlternatives": 3 if alternatives else 0,
            "instructionsType": "text" if include_instructions else "none",
            "language": "en-US",
        }

        resp = await client.get(
            f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

        routes = []
        for i, route in enumerate(data.get("routes", [])):
            summary = route.get("summary", {})
            legs = route.get("legs", [{}])

            # Extract coordinates from legs
            coords = []
            for leg in legs:
                for point in leg.get("points", []):
                    coords.append({"lat": point["latitude"], "lng": point["longitude"]})

            # Extract turn-by-turn instructions
            instructions = []
            if include_instructions:
                for leg in legs:
                    for guidance in leg.get("guidance", {}).get("instructions", []):
                        point = guidance.get("point", {})
                        instruction = {
                            "type": guidance.get("maneuver", "STRAIGHT"),
                            "instruction": guidance.get("message", ""),
                            "distance_m": guidance.get("routeOffsetInMeters", 0),
                            "duration_s": 0,  # TomTom doesn't provide per-step duration
                            "lat": point.get("latitude", 0),
                            "lng": point.get("longitude", 0),
                            "maneuver": self._map_tomtom_maneuver(guidance.get("maneuver", "")),
                            "road_name": guidance.get("street", ""),
                        }
                        instructions.append(instruction)

            routes.append({
                "id": f"tomtom_{i}",
                "name": self._generate_route_name(i),
                "distance_km": summary.get("lengthInMeters", 0) / 1000,
                "duration_minutes": summary.get("travelTimeInSeconds", 0) / 60,
                "geometry": coords,
                "instructions": instructions,
                "source": "tomtom",
            })

        return routes

    async def _get_osrm_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
        include_instructions: bool,
    ) -> list[dict]:
        """Fetch routes from public OSRM (no traffic data)."""
        client = await self._get_client()

        coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        params = {
            "overview": "full",
            "geometries": "polyline",
            "alternatives": "true" if alternatives else "false",
            "steps": "true" if include_instructions else "false",
            "annotations": "true",
        }

        resp = await client.get(
            f"https://router.project-osrm.org/route/v1/driving/{coords}",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

        routes = []
        for i, route in enumerate(data.get("routes", [])):
            # Decode polyline
            encoded = route.get("geometry", "")
            decoded = polyline.decode(encoded) if encoded else []
            route_coords = [{"lat": lat, "lng": lng} for lat, lng in decoded]

            # Extract turn-by-turn instructions
            instructions = []
            if include_instructions:
                for leg in route.get("legs", []):
                    for step in leg.get("steps", []):
                        maneuver = step.get("maneuver", {})
                        location = maneuver.get("location", [0, 0])

                        # Build instruction text
                        modifier = maneuver.get("modifier", "")
                        maneuver_type = maneuver.get("type", "continue")
                        road_name = step.get("name", "")

                        instruction_text = self._build_osrm_instruction(
                            maneuver_type, modifier, road_name
                        )

                        instructions.append({
                            "type": maneuver_type,
                            "instruction": instruction_text,
                            "distance_m": step.get("distance", 0),
                            "duration_s": step.get("duration", 0),
                            "lat": location[1],
                            "lng": location[0],
                            "maneuver": self._map_osrm_maneuver(maneuver_type, modifier),
                            "road_name": road_name,
                            "modifier": modifier,
                        })

            routes.append({
                "id": f"osrm_{i}",
                "name": self._generate_route_name(i),
                "distance_km": route.get("distance", 0) / 1000,
                "duration_minutes": route.get("duration", 0) / 60,
                "geometry": route_coords,
                "instructions": instructions,
                "source": "osrm",
                "note": "No live traffic - baseline only",
            })

        return routes

    def _build_osrm_instruction(self, maneuver_type: str, modifier: str, road_name: str) -> str:
        """Build human-readable instruction from OSRM maneuver."""
        road_part = f" onto {road_name}" if road_name else ""

        if maneuver_type == "depart":
            return f"Start{road_part}"
        elif maneuver_type == "arrive":
            return "You have arrived at your destination"
        elif maneuver_type == "turn":
            return f"Turn {modifier}{road_part}"
        elif maneuver_type == "merge":
            return f"Merge {modifier}{road_part}"
        elif maneuver_type == "ramp":
            return f"Take the ramp {modifier}{road_part}"
        elif maneuver_type == "fork":
            return f"Keep {modifier} at the fork{road_part}"
        elif maneuver_type == "roundabout":
            return f"Enter the roundabout{road_part}"
        elif maneuver_type == "exit roundabout":
            return f"Exit the roundabout{road_part}"
        elif maneuver_type == "continue":
            return f"Continue{road_part}"
        elif maneuver_type == "new name":
            return f"Continue onto {road_name}" if road_name else "Continue"
        else:
            return f"Continue {modifier}{road_part}".strip()

    def _map_here_maneuver(self, action: str) -> str:
        """Map HERE action type to standard maneuver."""
        mapping = {
            "depart": "depart",
            "arrive": "arrive",
            "turn": "turn",
            "continue": "straight",
            "roundaboutEnter": "roundabout",
            "roundaboutExit": "roundabout-exit",
            "ramp": "ramp",
            "merge": "merge",
            "fork": "fork",
            "uTurn": "uturn",
        }
        return mapping.get(action, "straight")

    def _map_tomtom_maneuver(self, maneuver: str) -> str:
        """Map TomTom maneuver to standard maneuver."""
        maneuver = maneuver.upper()
        if "LEFT" in maneuver:
            return "turn-left"
        elif "RIGHT" in maneuver:
            return "turn-right"
        elif "STRAIGHT" in maneuver:
            return "straight"
        elif "UTURN" in maneuver:
            return "uturn"
        elif "ROUNDABOUT" in maneuver:
            return "roundabout"
        elif "RAMP" in maneuver or "MOTORWAY" in maneuver:
            return "ramp"
        elif "MERGE" in maneuver:
            return "merge"
        elif "ARRIVE" in maneuver:
            return "arrive"
        elif "DEPART" in maneuver:
            return "depart"
        return "straight"

    def _map_osrm_maneuver(self, maneuver_type: str, modifier: str) -> str:
        """Map OSRM maneuver to standard maneuver."""
        if maneuver_type == "arrive":
            return "arrive"
        elif maneuver_type == "depart":
            return "depart"
        elif maneuver_type in ["turn", "ramp", "fork", "merge"]:
            if "left" in modifier:
                if "sharp" in modifier:
                    return "sharp-left"
                elif "slight" in modifier:
                    return "slight-left"
                return "turn-left"
            elif "right" in modifier:
                if "sharp" in modifier:
                    return "sharp-right"
                elif "slight" in modifier:
                    return "slight-right"
                return "turn-right"
            elif "straight" in modifier:
                return "straight"
            elif "uturn" in modifier:
                return "uturn"
        elif maneuver_type == "roundabout":
            return "roundabout"
        elif maneuver_type == "exit roundabout":
            return "roundabout-exit"
        return "straight"

    def _decode_here_polyline(self, encoded: str) -> list[dict]:
        """Decode HERE's flexible polyline format."""
        try:
            # HERE uses flexible polyline encoding
            decoded = flexpolyline.decode(encoded)
            # Returns list of (lat, lng) or (lat, lng, altitude) tuples
            return [{"lat": point[0], "lng": point[1]} for point in decoded]
        except Exception:
            # Fallback to standard polyline
            try:
                decoded = polyline.decode(encoded)
                return [{"lat": lat, "lng": lng} for lat, lng in decoded]
            except Exception:
                return []

    def _generate_route_name(self, index: int) -> str:
        """Generate a human-readable route name."""
        names = ["Primary Route", "Via Highway", "Local Streets", "Scenic Route"]
        return names[index] if index < len(names) else f"Route {index + 1}"
