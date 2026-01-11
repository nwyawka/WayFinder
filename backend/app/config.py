"""Application configuration from environment variables."""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Keys
    tomtom_api_key: str = ""
    here_api_key: str = ""
    ny_511_api_key: str = ""

    # Polling and rerouting
    poll_interval_seconds: int = 60
    reroute_threshold_minutes: float = 2.0  # Alert if alternate saves this much time

    # ML model settings
    prediction_horizon_minutes: int = 30
    historical_data_days: int = 90

    # Cache settings
    cache_ttl_seconds: int = 30

    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
