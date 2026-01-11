"""Weather service for getting current conditions along commute route."""
import os
import httpx
from typing import Optional
from datetime import datetime, timedelta
from functools import lru_cache


class WeatherService:
    """Fetches weather data from OpenWeatherMap API."""

    def __init__(self):
        self.api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
        self.base_url = "https://api.openweathermap.org/data/2.5"
        self._cache: dict = {}
        self._cache_ttl = timedelta(minutes=10)

    async def get_weather(
        self,
        lat: float,
        lng: float,
    ) -> dict:
        """
        Get current weather conditions for a location.

        Returns weather data including:
        - condition (clear, clouds, rain, snow, etc.)
        - temperature
        - visibility
        - wind speed
        - precipitation
        - driving_impact (none, low, moderate, high, severe)
        """
        # Check cache first
        cache_key = f"{lat:.2f},{lng:.2f}"
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            if datetime.utcnow() - cached_time < self._cache_ttl:
                return cached_data

        # If no API key, return mock data for demo
        if not self.api_key:
            return self._get_demo_weather(lat, lng)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/weather",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "appid": self.api_key,
                        "units": "metric",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                weather = self._parse_weather(data)
                self._cache[cache_key] = (weather, datetime.utcnow())
                return weather

        except Exception as e:
            print(f"Weather API error: {e}")
            return self._get_demo_weather(lat, lng)

    def _parse_weather(self, data: dict) -> dict:
        """Parse OpenWeatherMap response into our format."""
        main = data.get("main", {})
        weather = data.get("weather", [{}])[0]
        wind = data.get("wind", {})
        rain = data.get("rain", {})
        snow = data.get("snow", {})
        visibility = data.get("visibility", 10000)

        condition = weather.get("main", "Clear").lower()
        condition_id = weather.get("id", 800)
        description = weather.get("description", "clear sky")
        icon = weather.get("icon", "01d")

        # Calculate driving impact based on conditions
        driving_impact = self._calculate_driving_impact(
            condition_id=condition_id,
            visibility=visibility,
            wind_speed=wind.get("speed", 0),
            rain_1h=rain.get("1h", 0),
            snow_1h=snow.get("1h", 0),
        )

        return {
            "condition": condition,
            "condition_id": condition_id,
            "description": description,
            "icon": icon,
            "icon_url": f"https://openweathermap.org/img/wn/{icon}@2x.png",
            "temperature_c": round(main.get("temp", 20), 1),
            "feels_like_c": round(main.get("feels_like", 20), 1),
            "humidity": main.get("humidity", 50),
            "visibility_m": visibility,
            "wind_speed_ms": round(wind.get("speed", 0), 1),
            "wind_gust_ms": round(wind.get("gust", 0), 1) if "gust" in wind else None,
            "rain_1h_mm": round(rain.get("1h", 0), 1) if rain else 0,
            "snow_1h_mm": round(snow.get("1h", 0), 1) if snow else 0,
            "driving_impact": driving_impact,
            "driving_warning": self._get_driving_warning(driving_impact, condition_id, visibility),
        }

    def _calculate_driving_impact(
        self,
        condition_id: int,
        visibility: int,
        wind_speed: float,
        rain_1h: float,
        snow_1h: float,
    ) -> str:
        """
        Calculate impact on driving conditions.

        OpenWeatherMap condition IDs:
        - 2xx: Thunderstorm
        - 3xx: Drizzle
        - 5xx: Rain
        - 6xx: Snow
        - 7xx: Atmosphere (fog, mist, etc.)
        - 800: Clear
        - 80x: Clouds
        """
        impact_score = 0

        # Thunderstorm - severe impact
        if 200 <= condition_id < 300:
            impact_score += 4

        # Heavy rain
        if 500 <= condition_id < 600:
            if condition_id >= 502:  # Heavy rain
                impact_score += 3
            else:
                impact_score += 1

        # Snow
        if 600 <= condition_id < 700:
            if condition_id >= 602:  # Heavy snow
                impact_score += 4
            else:
                impact_score += 2

        # Fog/mist/haze
        if 700 <= condition_id < 800:
            if condition_id == 741:  # Fog
                impact_score += 3
            else:
                impact_score += 1

        # Visibility impact
        if visibility < 1000:
            impact_score += 3
        elif visibility < 3000:
            impact_score += 2
        elif visibility < 5000:
            impact_score += 1

        # Wind impact
        if wind_speed > 20:  # Strong wind (>72 km/h)
            impact_score += 3
        elif wind_speed > 15:  # High wind (>54 km/h)
            impact_score += 2
        elif wind_speed > 10:  # Moderate wind (>36 km/h)
            impact_score += 1

        # Precipitation amount
        if rain_1h > 10 or snow_1h > 5:
            impact_score += 2
        elif rain_1h > 5 or snow_1h > 2:
            impact_score += 1

        # Map score to impact level
        if impact_score >= 5:
            return "severe"
        elif impact_score >= 3:
            return "high"
        elif impact_score >= 2:
            return "moderate"
        elif impact_score >= 1:
            return "low"
        else:
            return "none"

    def _get_driving_warning(
        self,
        impact: str,
        condition_id: int,
        visibility: int,
    ) -> Optional[str]:
        """Get a driving warning message if conditions warrant it."""
        if impact == "none":
            return None

        warnings = []

        if 200 <= condition_id < 300:
            warnings.append("Thunderstorm activity - use caution")

        if 600 <= condition_id < 700:
            warnings.append("Snowy conditions - reduce speed")

        if condition_id == 741 or visibility < 1000:
            warnings.append("Low visibility - use fog lights")

        if 500 <= condition_id < 600 and condition_id >= 502:
            warnings.append("Heavy rain - maintain safe following distance")

        if not warnings:
            if impact == "severe":
                warnings.append("Severe weather conditions - consider delaying travel")
            elif impact == "high":
                warnings.append("Poor driving conditions - exercise caution")
            elif impact == "moderate":
                warnings.append("Weather may affect driving conditions")

        return "; ".join(warnings) if warnings else None

    def _get_demo_weather(self, lat: float, lng: float) -> dict:
        """Return demo weather data when no API key is configured."""
        # Generate slightly varied demo data based on coordinates
        import hashlib
        seed = int(hashlib.md5(f"{lat}{lng}".encode()).hexdigest()[:8], 16)

        conditions = [
            ("clear", 800, "clear sky", "01d"),
            ("clouds", 802, "scattered clouds", "03d"),
            ("clouds", 804, "overcast clouds", "04d"),
            ("rain", 500, "light rain", "10d"),
        ]

        condition, condition_id, description, icon = conditions[seed % len(conditions)]
        temp = 15 + (seed % 20)

        return {
            "condition": condition,
            "condition_id": condition_id,
            "description": description,
            "icon": icon,
            "icon_url": f"https://openweathermap.org/img/wn/{icon}@2x.png",
            "temperature_c": temp,
            "feels_like_c": temp - 2,
            "humidity": 50 + (seed % 40),
            "visibility_m": 10000,
            "wind_speed_ms": 2 + (seed % 8),
            "wind_gust_ms": None,
            "rain_1h_mm": 0,
            "snow_1h_mm": 0,
            "driving_impact": "none",
            "driving_warning": None,
        }

    async def get_route_weather(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> dict:
        """
        Get weather conditions for a route.

        Returns weather at origin, destination, and overall route impact.
        """
        origin_weather = await self.get_weather(origin[0], origin[1])
        dest_weather = await self.get_weather(destination[0], destination[1])

        # Determine worst impact along route
        impact_levels = ["none", "low", "moderate", "high", "severe"]
        origin_impact = impact_levels.index(origin_weather["driving_impact"])
        dest_impact = impact_levels.index(dest_weather["driving_impact"])
        worst_impact = impact_levels[max(origin_impact, dest_impact)]

        # Collect warnings
        warnings = []
        if origin_weather.get("driving_warning"):
            warnings.append(f"At start: {origin_weather['driving_warning']}")
        if dest_weather.get("driving_warning") and dest_weather["driving_warning"] != origin_weather.get("driving_warning"):
            warnings.append(f"At destination: {dest_weather['driving_warning']}")

        return {
            "origin": origin_weather,
            "destination": dest_weather,
            "route_impact": worst_impact,
            "warnings": warnings,
        }
