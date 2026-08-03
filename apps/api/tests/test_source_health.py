from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from givehub.models import SourceRefreshRun
from givehub.seed import DEMO_ORGANISER_ID


def test_source_health_requires_reviewer_access(client: TestClient) -> None:
    assert client.get("/v1/organiser/source-health").status_code == 403
    assert client.post("/v1/organiser/source-health/refresh").status_code == 403


def test_source_health_summarises_sources_and_recent_runs(
    client: TestClient, db: Session, identity_override
) -> None:
    db.add(
        SourceRefreshRun(
            trigger="scheduled",
            status="succeeded",
            started_at=datetime(2026, 8, 2, 10, 15, tzinfo=UTC),
            completed_at=datetime(2026, 8, 2, 10, 16, tzinfo=UTC),
            discovered=12,
            candidates_added=3,
            checked=8,
        )
    )
    db.commit()
    identity_override(DEMO_ORGANISER_ID)

    response = client.get("/v1/organiser/source-health")
    assert response.status_code == 200
    health = response.json()
    assert health["schedule"] == "Nightly at 10:15 UTC"
    assert health["next_scheduled_at"]
    assert health["sources"]
    assert any(item["active_listings"] > 0 for item in health["sources"])
    assert health["recent_runs"][0]["discovered"] == 12
    assert health["recent_runs"][0]["candidates_added"] == 3


def test_manual_refresh_is_queued_once(
    client: TestClient, identity_override, monkeypatch
) -> None:
    executed: list[object] = []
    monkeypatch.setattr(
        "givehub.api.execute_refresh_run",
        lambda run_id, **_kwargs: executed.append(run_id),
    )
    identity_override(DEMO_ORGANISER_ID)

    response = client.post("/v1/organiser/source-health/refresh")
    assert response.status_code == 202
    assert response.json()["trigger"] == "manual"
    assert response.json()["status"] == "queued"
    assert executed

    repeated = client.post("/v1/organiser/source-health/refresh")
    assert repeated.status_code == 409
