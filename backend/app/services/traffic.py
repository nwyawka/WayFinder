"""
Traffic data aggregation from multiple sources.
Combines TomTom, HERE, and state DOT feeds for comprehensive coverage.
"""
import httpx
from typing import Optional
from datetime import datetime
import asyncio

from app.config import get_settings


class TrafficAggregator:
    """
    Aggregates traffic data from multiple sources.
    Cross-references to improve accuracy and reduce false positives.
    """

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None
        self._cache: dict = {}  # Simple in-memory cache

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def get_traffic_for_routes(self, routes: list[dict]) -> list[dict]:
        """
        Get current traffic conditions for multiple routes.
        Returns traffic data aligned with input routes.
        """
        tasks = [self._get_traffic_for_route(route) for route in routes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        traffic_data = []
        for result in results:
            if isinstance(result, Exception):
                traffic_data.append({"level": "unknown", "error": str(result)})
            else:
                traffic_data.append(result)

        return traffic_data

    async def _get_traffic_for_route(self, route: dict) -> dict:
        """Get traffic for a single route by sampling points along it."""
        geometry = route.get("geometry", [])
        if not geometry:
            return {"level": "unknown", "reason": "no geometry"}

        # Sample points along the route (every ~5km or so)
        sample_points = self._sample_route_points(geometry, max_points=10)

        # Get traffic at each point
        sources_data = await asyncio.gather(
            self._get_tomtom_traffic(sample_points),
            self._get_here_traffic(sample_points),
            return_exceptions=True,
        )

        # Aggregate results
        speeds = []
        incidents = []

        for data in sources_data:
            if isinstance(data, dict):
                speeds.extend(data.get("speeds", []))
                incidents.extend(data.get("incidents", []))

        if not speeds:
            return {"level": "unknown", "reason": "no data from sources"}

        # Calculate overall traffic level
        avg_speed_ratio = sum(speeds) / len(speeds) if speeds else 1.0
        level = self._speed_ratio_to_level(avg_speed_ratio)

        return {
            "level": level,
            "avg_speed_ratio": avg_speed_ratio,  # 1.0 = free flow, 0.5 = half speed
            "incidents": incidents,
            "sample_points": len(sample_points),
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _get_tomtom_traffic(self, points: list[dict]) -> dict:
        """Get traffic flow from TomTom for sample points."""
        if not self.settings.tomtom_api_key:
            return {"speeds": [], "incidents": []}

        client = await self._get_client()
        speeds = []
        incidents = []

        for point in points[:5]:  # Limit API calls
            try:
                # TomTom Traffic Flow API
                resp = await client.get(
                    f"https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json",
                    params={
                        "key": self.settings.tomtom_api_key,
                        "point": f"{point['lat']},{point['lng']}",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    flow = data.get("flowSegmentData", {})
                    current = flow.get("currentSpeed", 0)
                    free_flow = flow.get("freeFlowSpeed", 1)
                    if free_flow > 0:
                        speeds.append(current / free_flow)
            except Exception:
                continue

        return {"speeds": speeds, "incidents": incidents}

    async def _get_here_traffic(self, points: list[dict]) -> dict:
        """Get traffic flow from HERE for sample points."""
        if not self.settings.here_api_key:
            return {"speeds": [], "incidents": []}

        client = await self._get_client()
        speeds = []
        incidents = []

        for point in points[:5]:
            try:
                # HERE Traffic Flow API
                resp = await client.get(
                    "https://data.traffic.hereapi.com/v7/flow",
                    params={
                        "apiKey": self.settings.here_api_key,
                        "in": f"circle:{point['lat']},{point['lng']};r=500",
                        "locationReferencing": "none",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for result in data.get("results", []):
                        current_flow = result.get("currentFlow", {})
                        speed = current_flow.get("speed", 0)
                        free_flow = current_flow.get("freeFlow", 1)
                        if free_flow > 0:
                            speeds.append(speed / free_flow)
            except Exception:
                continue

        return {"speeds": speeds, "incidents": incidents}

    async def get_traffic_by_route_id(self, route_id: str) -> Optional[dict]:
        """Get cached traffic for a route ID."""
        return self._cache.get(route_id)

    def _sample_route_points(
        self, geometry: list[dict], max_points: int = 10
    ) -> list[dict]:
        """Sample evenly-spaced points along a route."""
        if len(geometry) <= max_points:
            return geometry

        step = len(geometry) // max_points
        return [geometry[i] for i in range(0, len(geometry), step)][:max_points]

    def _speed_ratio_to_level(self, ratio: float) -> str:
        """Convert speed ratio to human-readable level."""
        if ratio >= 0.9:
            return "free"
        elif ratio >= 0.7:
            return "light"
        elif ratio >= 0.5:
            return "moderate"
        elif ratio >= 0.3:
            return "heavy"
        else:
            return "severe"
