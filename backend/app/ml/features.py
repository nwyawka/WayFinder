"""
Feature extraction for traffic prediction.

Key features that predict traffic:
1. Temporal: hour, day of week, is_holiday
2. Current conditions: speed ratio, incident count
3. Route characteristics: distance, highway ratio
4. Trend: is traffic getting worse or better?
"""
from datetime import datetime
import numpy as np


def extract_features(
    route: dict,
    current_traffic: dict,
    prediction_time: datetime,
) -> np.ndarray:
    """
    Extract feature vector for ML prediction.

    Returns:
        numpy array of features
    """
    features = []

    # Temporal features
    features.extend(extract_temporal_features(prediction_time))

    # Current traffic features
    features.extend(extract_traffic_features(current_traffic))

    # Route characteristics
    features.extend(extract_route_features(route))

    return np.array(features)


def extract_temporal_features(dt: datetime) -> list[float]:
    """
    Extract time-based features.
    These are the strongest predictors of traffic patterns.
    """
    features = []

    # Hour of day (cyclical encoding)
    hour = dt.hour + dt.minute / 60
    features.append(np.sin(2 * np.pi * hour / 24))
    features.append(np.cos(2 * np.pi * hour / 24))

    # Day of week (cyclical encoding)
    dow = dt.weekday()
    features.append(np.sin(2 * np.pi * dow / 7))
    features.append(np.cos(2 * np.pi * dow / 7))

    # Is weekend
    features.append(1.0 if dow >= 5 else 0.0)

    # Rush hour indicators
    is_morning_rush = 1.0 if 7 <= dt.hour <= 9 else 0.0
    is_evening_rush = 1.0 if 16 <= dt.hour <= 19 else 0.0
    features.append(is_morning_rush)
    features.append(is_evening_rush)

    # Month (for seasonal patterns)
    month = dt.month
    features.append(np.sin(2 * np.pi * month / 12))
    features.append(np.cos(2 * np.pi * month / 12))

    return features


def extract_traffic_features(traffic: dict) -> list[float]:
    """Extract features from current traffic conditions."""
    features = []

    # Speed ratio (1.0 = free flow)
    speed_ratio = traffic.get("avg_speed_ratio", 1.0)
    features.append(speed_ratio)

    # Traffic level as numeric
    level_map = {
        "free": 1.0,
        "light": 0.8,
        "moderate": 0.6,
        "heavy": 0.4,
        "severe": 0.2,
        "unknown": 0.5,
    }
    level = traffic.get("level", "unknown")
    features.append(level_map.get(level, 0.5))

    # Incident count
    incidents = traffic.get("incidents", [])
    features.append(min(len(incidents), 5) / 5)  # Normalize to 0-1

    # Has severe incident
    has_severe = any(
        i.get("severity", "") in ["major", "severe", "critical"]
        for i in incidents
    )
    features.append(1.0 if has_severe else 0.0)

    return features


def extract_route_features(route: dict) -> list[float]:
    """Extract features from route characteristics."""
    features = []

    # Distance (normalized, assuming max 100km commute)
    distance = route.get("distance_km", 0)
    features.append(min(distance / 100, 1.0))

    # Base duration (normalized, assuming max 120 min)
    duration = route.get("duration_minutes", 0)
    features.append(min(duration / 120, 1.0))

    # Average speed (km/h, indicates highway vs local)
    if duration > 0:
        avg_speed = distance / (duration / 60)
        features.append(min(avg_speed / 120, 1.0))  # Normalize to highway speed
    else:
        features.append(0.5)

    return features


def get_feature_names() -> list[str]:
    """Get names of all features for interpretability."""
    return [
        "hour_sin",
        "hour_cos",
        "dow_sin",
        "dow_cos",
        "is_weekend",
        "is_morning_rush",
        "is_evening_rush",
        "month_sin",
        "month_cos",
        "speed_ratio",
        "traffic_level",
        "incident_ratio",
        "has_severe_incident",
        "distance_norm",
        "duration_norm",
        "avg_speed_norm",
    ]
