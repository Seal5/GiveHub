import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from givehub.auth import current_identity
from givehub.config import Settings


def test_production_rejects_development_identity() -> None:
    settings = Settings(app_env="production", supabase_url="https://pilot.supabase.co")
    with pytest.raises(HTTPException) as error:
        current_identity(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=f"dev:{uuid.uuid4()}"),
            settings,
        )
    assert error.value.status_code == 401


def test_production_verifies_signed_jwt_and_rejects_wrong_audience(monkeypatch) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = Settings(app_env="production", supabase_url="https://pilot.supabase.co")
    user_id = uuid.uuid4()
    monkeypatch.setattr(
        "givehub.auth.PyJWKClient",
        lambda url: SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(key=key.public_key())
        ),
    )
    payload = {
        "sub": str(user_id),
        "email": "verified@example.com",
        "aud": "authenticated",
        "iss": f"{settings.supabase_url}/auth/v1",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    def credentials(claims):
        return HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=jwt.encode(claims, key, algorithm="RS256")
        )
    assert current_identity(credentials(payload), settings).user_id == user_id
    with pytest.raises(HTTPException) as error:
        current_identity(credentials({**payload, "aud": "another-service"}), settings)
    assert error.value.status_code == 401


def test_environment_lists_accept_documented_comma_and_json_formats(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://web.example.com,http://localhost:8081")
    monkeypatch.setenv("SOURCE_REVIEWER_EMAILS", '["Reviewer@Example.com"]')
    settings = Settings()
    assert settings.cors_origins == ["https://web.example.com", "http://localhost:8081"]
    assert settings.source_reviewer_emails == ["reviewer@example.com"]
