import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """System Configuration Settings for Workflow Engine."""

    APP_NAME: str = "Workflow Engine & Data Fusion Layer"
    APP_VERSION: str = "1.1.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Auth & Cache configuration
    AUTH_TOKEN_TTL_SECONDS: int = 3600
    MAX_CACHE_SIZE: int = 1000

    # Async HTTP Client configuration
    DEFAULT_MAX_CONCURRENCY: int = 5
    HTTP_TIMEOUT_SECONDS: float = 30.0
    HTTP_MAX_KEEPALIVE_CONNECTIONS: int = 50
    HTTP_MAX_CONNECTIONS: int = 100

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent
    TEMPLATES_DIR: Path = BASE_DIR / "templates"
    WORKFLOWS_DIR: Path = BASE_DIR / "workflows"

    # Legacy EMS connection defaults
    LEGACY_EMS_BASE_URL: str = "http://localhost:9000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


settings = Settings()
