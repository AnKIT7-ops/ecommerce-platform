"""Application configuration.

All settings come from environment variables (loaded from ``backend/.env`` in
development).  ``SECRET_KEY`` deliberately has no default: a fallback signing
key that silently works in production is the single most dangerous bug this
file could contain, so the app refuses to start without one.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path so alembic/pytest still find the env file when invoked from the
# repository root rather than from backend/.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database ---
    database_url: str
    test_database_url: str = ""

    # --- Security ---
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    refresh_token_expire_days: int = Field(default=7, gt=0)

    # --- Application ---
    environment: str = "development"
    project_name: str = "E-Commerce Platform API"
    api_prefix: str = "/api"

    # Stored as a raw string rather than list[str]: pydantic-settings tries to
    # JSON-decode complex types, which makes a plain comma-separated value fail.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Seed data ---
    seed_admin_email: str = ""
    seed_admin_password: str = ""

    @field_validator("secret_key")
    @classmethod
    def _secret_key_is_real(cls, v: str) -> str:
        if not v or v.startswith("CHANGE_ME"):
            raise ValueError(
                "SECRET_KEY is unset or still the placeholder value. Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values supplied by env/.env


settings = get_settings()
