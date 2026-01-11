"""
ML-based traffic prediction.

Uses historical patterns + current conditions to predict future traffic.
This is the core differentiator - predicting congestion BEFORE it appears in APIs.
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import joblib

from app.ml.features import extract_features
from app.ml.model import TrafficModel


MODEL_PATH = Path(__file__).parent / "trained_model.joblib"


class TrafficPredictor:
    """
    Predicts traffic conditions using ML.

    Key insight: Traffic patterns are highly predictable based on:
    - Time of day
    - Day of week
    - Historical patterns for this route
    - Current conditions (leading indicator)
    - Weather (optional enhancement)
    - Special events (optional enhancement)
    """

    def __init__(self):
        self.model = self._load_or_create_model()
        self._confidence_cache: dict = {}

    def _load_or_create_model(self) -> TrafficModel:
        """Load trained model or create new one."""
        if MODEL_PATH.exists():
            try:
                return joblib.load(MODEL_PATH)
            except Exception:
                pass
        return TrafficModel()

    def predict_duration(
        self,
        route: dict,
        current_traffic: dict,
        horizon_minutes: int = 30,
    ) -> float:
        """
        Predict route duration accounting for traffic changes.

        Args:
            route: Route dict with geometry, base duration
            current_traffic: Current traffic conditions
            horizon_minutes: How far ahead to predict

        Returns:
            Predicted duration in minutes
        """
        base_duration = route.get("duration_minutes", 0)

        # Extract features for prediction
        features = extract_features(
            route=route,
            current_traffic=current_traffic,
            prediction_time=datetime.now() + timedelta(minutes=horizon_minutes // 2),
        )

        # Get prediction from model
        try:
            traffic_multiplier = self.model.predict(features)
        except Exception:
            # Fall back to simple estimation
            traffic_multiplier = self._estimate_multiplier(current_traffic)

        predicted_duration = base_duration * traffic_multiplier
        return round(predicted_duration, 1)

    def _estimate_multiplier(self, current_traffic: dict) -> float:
        """
        Simple fallback estimation when ML model not trained.
        Uses current traffic level + time-of-day heuristics.
        """
        level = current_traffic.get("level", "unknown")
        speed_ratio = current_traffic.get("avg_speed_ratio", 1.0)

        # Base multiplier from current conditions
        if speed_ratio > 0:
            base_multiplier = 1 / speed_ratio
        else:
            base_multiplier = 1.5  # Default assumption

        # Time-of-day adjustment
        hour = datetime.now().hour
        is_rush_hour = (7 <= hour <= 9) or (16 <= hour <= 19)

        if is_rush_hour:
            # During rush hour, conditions often get worse
            trend_adjustment = 1.1
        elif 9 <= hour <= 16:
            # Mid-day typically stable
            trend_adjustment = 1.0
        else:
            # Evening/night, conditions typically improve
            trend_adjustment = 0.95

        return min(base_multiplier * trend_adjustment, 3.0)  # Cap at 3x

    def get_confidence(self, route: dict) -> float:
        """
        Get confidence in prediction for this route.
        Higher confidence with more historical data.
        """
        route_id = route.get("id", "")

        # Check if we have historical data for this route
        if route_id in self._confidence_cache:
            return self._confidence_cache[route_id]

        # Base confidence on model training status
        if self.model.is_trained:
            base_confidence = 0.7
        else:
            base_confidence = 0.4  # Lower confidence for heuristic-only

        # Would increase with more historical data for this specific route
        self._confidence_cache[route_id] = base_confidence
        return base_confidence

    def train_on_history(self, history: list[dict]):
        """
        Train/update model on historical commute data.
        Called periodically as new data accumulates.
        """
        if len(history) < 10:
            return  # Need minimum data

        X, y = self._prepare_training_data(history)
        self.model.fit(X, y)
        self.model.is_trained = True

        # Save model
        joblib.dump(self.model, MODEL_PATH)

    def _prepare_training_data(
        self, history: list[dict]
    ) -> tuple[np.ndarray, np.ndarray]:
        """Prepare training data from history."""
        features_list = []
        targets = []

        for entry in history:
            if not entry.get("duration_minutes"):
                continue

            # Extract features from historical entry
            features = extract_features(
                route=entry.get("route", {}),
                current_traffic=entry.get("traffic_conditions", {}),
                prediction_time=datetime.fromisoformat(entry.get("started_at", "")),
            )
            features_list.append(features)

            # Target: actual duration / expected duration
            expected = entry.get("route", {}).get("duration_minutes", 1)
            actual = entry["duration_minutes"]
            targets.append(actual / max(expected, 1))

        return np.array(features_list), np.array(targets)
