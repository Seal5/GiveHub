from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.models import Opportunity, OpportunityStatus, Recurrence, SourceCandidate
from givehub.source_refresh import run_refresh

RESULT_HTML = """
<div class="opportunity-card">
  <div class="meta-location">Toronto, Ontario</div>
  <h5 class="opportunity-title">
    <a href="/opportunities/new-gta-role-2026-08-02">New GTA Role</a>
  </h5>
  <div class="organization-name">WITH <a href="/organizations/example">Example Org</a></div>
  <p class="opportunity-description">Help neighbours at a new community event.</p>
</div>
"""


def test_refresh_discovers_candidates_without_publishing_them(db: Session) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/opportunities":
            return httpx.Response(200, text=RESULT_HTML)
        return httpx.Response(200, text="active")

    client = httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)
    checked_at = datetime(2026, 8, 2, 12, tzinfo=UTC)
    report = run_refresh(
        db,
        client=client,
        postal_code="M5V 2T6",
        radius_km=50,
        pages=2,
        checked_at=checked_at,
    )

    assert report.discovered == 1
    assert report.candidates_added == 1
    candidate = db.scalar(select(SourceCandidate))
    assert candidate is not None
    assert candidate.title == "New GTA Role"
    assert candidate.review_status == "pending"
    assert db.scalar(
        select(Opportunity).where(Opportunity.title == "New GTA Role")
    ) is None

    repeated = run_refresh(
        db,
        client=client,
        postal_code="M5V 2T6",
        radius_km=50,
        pages=1,
        checked_at=checked_at + timedelta(days=1),
    )
    assert repeated.candidates_added == 0
    assert repeated.candidates_updated == 1
    assert len(db.scalars(select(SourceCandidate)).all()) == 1


def test_refresh_unpublishes_expired_and_missing_external_listings(db: Session) -> None:
    listing = db.scalar(
        select(Opportunity).where(
            Opportunity.application_mode == "external",
            Opportunity.listing_source_url.contains("volunteersuccess.com"),
        )
    )
    assert listing is not None
    listing.recurrence = Recurrence.one_off
    listing.ends_at = datetime(2026, 8, 1, tzinfo=UTC)
    listing.status = OpportunityStatus.published

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/opportunities":
            return httpx.Response(200, text="<div id='opportunitiesGrid'></div>")
        return httpx.Response(404)

    report = run_refresh(
        db,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
        postal_code="M5V 2T6",
        radius_km=50,
        pages=1,
        checked_at=datetime(2026, 8, 2, tzinfo=UTC),
    )

    assert report.expired >= 1
    assert report.unavailable >= 1
    assert listing.status == OpportunityStatus.unpublished
    assert listing.listing_verification_status == "unverified"
    assert listing.source_checked_at == datetime(2026, 8, 2, tzinfo=UTC)
