"""
Traffic prediction model.

Uses Gradient Boosting for robust predictions.
Could be swapped for LSTM/Transformer for sequence modeling.
"""
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from typing import Optional


class TrafficModel:
    """
    Gradient Boosting model for traffic duration prediction.

    Predicts a multiplier to apply to base route duration.
    E.g., 1.2 means trip will take 20% longer than base estimate.
    """

    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            min_samples_split=5,
            min_samples_leaf=3,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self._feature_importances: Optional[np.ndarray] = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        """
        Train the model on historical data.

        Args:
            X: Feature matrix (n_samples, n_features)
            y: Target values (duration multipliers)
        """
        if len(X) < 10:
            return  # Need minimum data

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Fit model
        self.model.fit(X_scaled, y)
        self.is_trained = True
        self._feature_importances = self.model.feature_importances_

    def predict(self, features: np.ndarray) -> float:
        """
        Predict duration multiplier for given features.

        Args:
            features: Feature vector (1D array)

        Returns:
            Duration multiplier (e.g., 1.2 for 20% longer)
        """
        if not self.is_trained:
            return 1.0  # No prediction without training

        # Reshape and scale
        X = features.reshape(1, -1)
        X_scaled = self.scaler.transform(X)

        # Predict
        prediction = self.model.predict(X_scaled)[0]

        # Clamp to reasonable range
        return float(np.clip(prediction, 0.5, 3.0))

    def get_feature_importance(self) -> dict[str, float]:
        """Get feature importance for interpretability."""
        if self._feature_importances is None:
            return {}

        from app.ml.features import get_feature_names
        names = get_feature_names()

        return {
            name: float(importance)
            for name, importance in zip(names, self._feature_importances)
        }


class EnsemblePredictor:
    """
    Ensemble of models for more robust predictions.
    Combines multiple approaches:
    - Gradient Boosting (strong on tabular data)
    - Time-weighted historical average
    - Current conditions extrapolation
    """

    def __init__(self):
        self.gb_model = TrafficModel()
        self.weights = {
            "gradient_boosting": 0.5,
            "historical_avg": 0.3,
            "current_extrapolation": 0.2,
        }

    def predict(
        self,
        features: np.ndarray,
        historical_avg: float,
        current_multiplier: float,
    ) -> float:
        """
        Ensemble prediction combining multiple sources.
        """
        predictions = {}

        # Gradient boosting prediction
        if self.gb_model.is_trained:
            predictions["gradient_boosting"] = self.gb_model.predict(features)
        else:
            predictions["gradient_boosting"] = 1.0

        predictions["historical_avg"] = historical_avg
        predictions["current_extrapolation"] = current_multiplier

        # Weighted average
        total = sum(
            predictions[key] * self.weights[key]
            for key in predictions
        )

        return total
