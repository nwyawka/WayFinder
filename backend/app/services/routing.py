"""
Routing service - gets route options from external APIs.
Uses HERE or TomTom as primary, falls back to OSRM for free tier.
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
    ) -> list[dict]:
        """
        Get route options between origin and destination.
        Returns list of route dicts with geometry, distance, duration.
        """
        # Try HERE first if key available
        if self.settings.here_api_key:
            return await self._get_here_routes(origin, destination, alternatives)

        # Fall back to TomTom
        if self.settings.tomtom_api_key:
            return await self._get_tomtom_routes(origin, destination, alternatives)

        # Last resort: OSRM (free, no traffic)
        return await self._get_osrm_routes(origin, destination, alternatives)

    async def _get_here_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
    ) -> list[dict]:
        """Fetch routes from HERE Routing API v8."""
        client = await self._get_client()

        params = {
            "apiKey": self.settings.here_api_key,
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "transportMode": "car",
            "return": "polyline,summary,travelSummary",
            "alternatives": 3 if alternatives else 0,
            "traffic": "enabled",
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

            routes.append({
                "id": f"here_{i}",
                "name": self._generate_route_name(i),
                "distance_km": summary.get("length", 0) / 1000,
                "duration_minutes": summary.get("duration", 0) / 60,
                "geometry": coords,
                "source": "here",
            })

        return routes

    async def _get_tomtom_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
    ) -> list[dict]:
        """Fetch routes from TomTom Routing API."""
        client = await self._get_client()

        locations = f"{origin[0]},{origin[1]}:{destination[0]},{destination[1]}"
        params = {
            "key": self.settings.tomtom_api_key,
            "traffic": "true",
            "travelMode": "car",
            "maxAlternatives": 3 if alternatives else 0,
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

            routes.append({
                "id": f"tomtom_{i}",
                "name": self._generate_route_name(i),
                "distance_km": summary.get("lengthInMeters", 0) / 1000,
                "duration_minutes": summary.get("travelTimeInSeconds", 0) / 60,
                "geometry": coords,
                "source": "tomtom",
            })

        return routes

    async def _get_osrm_routes(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        alternatives: bool,
    ) -> list[dict]:
        """Fetch routes from public OSRM (no traffic data)."""
        client = await self._get_client()

        coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        params = {
            "overview": "full",
            "geometries": "polyline",
            "alternatives": "true" if alternatives else "false",
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
            coords = [{"lat": lat, "lng": lng} for lat, lng in decoded]

            routes.append({
                "id": f"osrm_{i}",
                "name": self._generate_route_name(i),
                "distance_km": route.get("distance", 0) / 1000,
                "duration_minutes": route.get("duration", 0) / 60,
                "geometry": coords,
                "source": "osrm",
                "note": "No live traffic - baseline only",
            })

        return routes

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
