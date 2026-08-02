"""Respectful discovery and freshness checks for externally sourced opportunities."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.config import get_settings
from givehub.database import SessionLocal
from givehub.models import Opportunity, OpportunityStatus, Recurrence, SourceCandidate

VOLUNTEER_SUCCESS = "https://volunteersuccess.com"
USER_AGENT = "GiveHub/0.1 source refresh (public volunteer listing index)"
CHECKABLE_HOSTS = {
    "volunteersuccess.com",
    "www.volunteersuccess.com",
    "jamii.ca",
    "www.jamii.ca",
    "unitedwaygt.org",
    "www.unitedwaygt.org",
}
GTA_LOCATION_TERMS = {
    "ajax",
    "brampton",
    "durham",
    "east york",
    "etobicoke",
    "greater toronto",
    "halton",
    "markham",
    "milton",
    "mississauga",
    "north york",
    "oakville",
    "peel",
    "pickering",
    "richmond hill",
    "scarborough",
    "toronto",
    "vaughan",
    "whitby",
    "york, on",
    "york, ontario",
}


@dataclass
class RefreshReport:
    discovered: int = 0
    candidates_added: int = 0
    candidates_updated: int = 0
    checked: int = 0
    expired: int = 0
    unavailable: int = 0
    skipped_protected: int = 0
    out_of_area: int = 0
    failed: int = 0


def canonical_url(value: str) -> str:
    """Normalize stable URL parts so www and fragments do not create duplicates."""
    parts = urlsplit(value)
    host = parts.netloc.lower().removeprefix("www.")
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower() or "https", host, path, parts.query, ""))


def is_gta_location(value: str) -> bool:
    normalized = " ".join(value.lower().split())
    return any(term in normalized for term in GTA_LOCATION_TERMS)


def discover_volunteer_success(
    client: httpx.Client,
    *,
    postal_code: str,
    radius_km: int,
    pages: int,
) -> list[dict[str, str]]:
    """Read a bounded number of public GTA result pages; detail review happens separately."""
    found: dict[str, dict[str, str]] = {}
    for page in range(1, max(1, pages) + 1):
        response = client.get(
            f"{VOLUNTEER_SUCCESS}/opportunities",
            params={
                "distance": "1",
                "distance_km": str(radius_km),
                "postal_code": postal_code,
                "page": str(page),
            },
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        for card in soup.select(".opportunity-card"):
            title_link = card.select_one(".opportunity-title a[href*='/opportunities/']")
            organisation = card.select_one(".organization-name a")
            if not title_link or not organisation:
                continue
            href = str(title_link.get("href", ""))
            source_url = urljoin(VOLUNTEER_SUCCESS, href)
            key = canonical_url(source_url)
            location = card.select_one(".meta-location") or card.select_one(".card-location")
            summary = card.select_one(".opportunity-description")
            location_label = (
                location.get_text(" ", strip=True)[:240]
                if location
                else "Greater Toronto Area"
            )
            if not is_gta_location(location_label):
                continue
            found[key] = {
                "source_name": "Volunteer Success",
                "source_url": source_url,
                "title": title_link.get_text(" ", strip=True)[:180],
                "organisation_name": organisation.get_text(" ", strip=True)[:180],
                "location_label": location_label,
                "summary": summary.get_text(" ", strip=True) if summary else "",
            }
    return list(found.values())


def upsert_candidates(
    db: Session,
    discovered: list[dict[str, str]],
    *,
    checked_at: datetime,
) -> tuple[int, int]:
    existing_opportunity_urls = {
        canonical_url(url)
        for url in db.scalars(
            select(Opportunity.listing_source_url).where(
                Opportunity.listing_source_url.is_not(None)
            )
        ).all()
        if url
    }
    candidates = {
        canonical_url(candidate.source_url): candidate
        for candidate in db.scalars(select(SourceCandidate)).all()
    }
    added = 0
    updated = 0
    for item in discovered:
        key = canonical_url(item["source_url"])
        if key in existing_opportunity_urls:
            continue
        candidate = candidates.get(key)
        if candidate:
            candidate.title = item["title"]
            candidate.organisation_name = item["organisation_name"]
            candidate.location_label = item["location_label"]
            candidate.summary = item["summary"]
            candidate.last_seen_at = checked_at
            updated += 1
            continue
        candidate = SourceCandidate(
            **item,
            review_status="pending",
            first_seen_at=checked_at,
            last_seen_at=checked_at,
        )
        db.add(candidate)
        candidates[key] = candidate
        added += 1
    return added, updated


def mark_out_of_area_candidates(db: Session) -> int:
    changed = 0
    candidates = db.scalars(
        select(SourceCandidate).where(
            SourceCandidate.source_name == "Volunteer Success",
            SourceCandidate.review_status == "pending",
        )
    ).all()
    for candidate in candidates:
        if not is_gta_location(candidate.location_label):
            candidate.review_status = "out_of_area"
            changed += 1
    return changed


def refresh_existing_sources(
    db: Session,
    client: httpx.Client,
    *,
    checked_at: datetime,
) -> RefreshReport:
    report = RefreshReport()
    listings = db.scalars(
        select(Opportunity).where(
            Opportunity.application_mode == "external",
            Opportunity.listing_source_url.is_not(None),
        )
    ).all()
    for listing in listings:
        ends_at = listing.ends_at
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=UTC)
        if listing.recurrence == Recurrence.one_off and ends_at < checked_at:
            if listing.status == OpportunityStatus.published:
                listing.status = OpportunityStatus.unpublished
                report.expired += 1

        assert listing.listing_source_url is not None
        host = urlsplit(listing.listing_source_url).netloc.lower()
        if host not in CHECKABLE_HOSTS:
            report.skipped_protected += 1
            continue
        try:
            response = client.get(listing.listing_source_url)
        except httpx.HTTPError:
            report.failed += 1
            continue
        if 200 <= response.status_code < 400:
            listing.source_checked_at = checked_at
            listing.listing_verification_status = "verified"
            report.checked += 1
        elif response.status_code in {404, 410}:
            listing.source_checked_at = checked_at
            listing.listing_verification_status = "unverified"
            listing.status = OpportunityStatus.unpublished
            report.unavailable += 1
        elif response.status_code in {401, 403, 429}:
            report.skipped_protected += 1
        else:
            report.failed += 1
    return report


def run_refresh(
    db: Session,
    *,
    client: httpx.Client,
    postal_code: str,
    radius_km: int,
    pages: int,
    checked_at: datetime | None = None,
) -> RefreshReport:
    checked_at = checked_at or datetime.now(UTC)
    report = refresh_existing_sources(db, client, checked_at=checked_at)
    report.out_of_area = mark_out_of_area_candidates(db)
    try:
        discovered = discover_volunteer_success(
            client,
            postal_code=postal_code,
            radius_km=radius_km,
            pages=pages,
        )
    except httpx.HTTPError:
        report.failed += 1
    else:
        report.discovered = len(discovered)
        report.candidates_added, report.candidates_updated = upsert_candidates(
            db,
            discovered,
            checked_at=checked_at,
        )
    db.commit()
    return report


def pending_review_items(db: Session, *, limit: int = 50) -> list[dict[str, str]]:
    candidates = db.scalars(
        select(SourceCandidate)
        .where(SourceCandidate.review_status == "pending")
        .order_by(SourceCandidate.first_seen_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "title": candidate.title,
            "organisation": candidate.organisation_name,
            "location": candidate.location_label,
            "source_url": candidate.source_url,
            "first_seen_at": candidate.first_seen_at.isoformat(),
        }
        for candidate in candidates
    ]


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Refresh GiveHub external opportunity sources")
    parser.add_argument("--pages", type=int, default=settings.source_refresh_pages)
    parser.add_argument(
        "--list-pending",
        action="store_true",
        help="Print pending source candidates without contacting external sources",
    )
    args = parser.parse_args()
    if args.list_pending:
        with SessionLocal() as db:
            print(json.dumps(pending_review_items(db), sort_keys=True))
        return
    with httpx.Client(
        follow_redirects=True,
        timeout=20,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        with SessionLocal() as db:
            report = run_refresh(
                db,
                client=client,
                postal_code=settings.source_refresh_postal_code,
                radius_km=settings.source_refresh_radius_km,
                pages=max(1, min(args.pages, 10)),
            )
    print(json.dumps(asdict(report), sort_keys=True))


if __name__ == "__main__":
    main()
