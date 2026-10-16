import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[1]
# A container installs the package at /app/givehub rather than apps/api/givehub.
REPOSITORY_ENV = (API_ROOT.parent.parent if API_ROOT.parent.name == "apps" else API_ROOT) / ".env"
API_ENV = API_ROOT / ".env"


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
    email_from: str = "GiveHub <notifications@example.com>"
    public_web_url: str = ""
    community_upload_dir: str = "./data/community-covers"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:8081"]
    source_refresh_postal_code: str = "M5V 2T6"
    source_refresh_radius_km: int = 50
    source_refresh_pages: int = 3
    source_reviewer_emails: Annotated[list[str], NoDecode] = []

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            if value.strip().startswith("["):
                return json.loads(value)
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @field_validator("source_reviewer_emails", mode="before")
    @classmethod
    def split_reviewer_emails(cls, value: object) -> object:
        if isinstance(value, str):
            if value.strip().startswith("["):
                return [part.casefold() for part in json.loads(value)]
            return [part.strip().casefold() for part in value.split(",") if part.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
