from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ENV = Path(__file__).resolve().parents[3] / ".env"
API_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    # Support the documented repository-level file and an API-local override.
    model_config = SettingsConfigDict(env_file=(REPOSITORY_ENV, API_ENV), extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./givehub.db"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_storage_bucket: str = "opportunity-images"
    google_places_api_key: str = ""
    resend_api_key: str = ""
    email_from: str = "GiveHub <notifications@givehub.nz>"
    cors_origins: list[str] = ["http://localhost:8081"]
    source_refresh_postal_code: str = "M5V 2T6"
    source_refresh_radius_km: int = 50
    source_refresh_pages: int = 3
    source_reviewer_emails: list[str] = []

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @field_validator("source_reviewer_emails", mode="before")
    @classmethod
    def split_reviewer_emails(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip().casefold() for part in value.split(",") if part.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
