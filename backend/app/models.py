"""Pydantic models for the application."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CommuteCreate(BaseModel):
    name: str  # e.g., "Work to Home"
    origin_lat: float
    origin_lng: float
    origin_address: Optional[str] = None
    dest_lat: float
    dest_lng: float
    dest_address: Optional[str] = None
    typical_departure_time: Optional[str] = None  # "17:30"
    days_of_week: list[int] = [0, 1, 2, 3, 4]  # Mon-Fri default


class Commute(CommuteCreate):
    id: str
    created_at: datetime
    avg_duration_minutes: Optional[float] = None
    best_duration_minutes: Optional[float] = None
    worst_duration_minutes: Optional[float] = None


class CommuteHistory(BaseModel):
    commute_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    route_taken: Optional[str] = None  # Route ID
    traffic_conditions: Optional[dict] = None
    switched_routes: bool = False


class Coordinate(BaseModel):
    lat: float
    lng: float


class RouteOption(BaseModel):
    id: str
    name: str
    distance_km: float
    duration_minutes: float
    predicted_duration_minutes: float  # ML-adjusted
    traffic_level: str  # "free", "light", "moderate", "heavy", "severe"
    geometry: list[Coordinate]
    savings_vs_current: float  # minutes saved compared to current route
    confidence: float  # 0-1 confidence in prediction


class RouteComparison(BaseModel):
    current_route: RouteOption
    alternatives: list[RouteOption]
    recommended_switch: Optional[str]  # ID of route to switch to, if any
    recommendation_reason: Optional[str]


class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    departure_time: Optional[str] = None  # ISO format, defaults to now
