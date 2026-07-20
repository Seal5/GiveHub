import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.models import (
    Cause,
    Opportunity,
    OpportunityStatus,
    Organisation,
    Profile,
    Recurrence,
    Role,
    Suburb,
    VerificationStatus,
)

DEMO_ORGANISER_ID = uuid.UUID("00000000-0000-4000-8000-000000000010")
DEMO_VOLUNTEER_ID = uuid.UUID("00000000-0000-4000-8000-000000000020")


def seed_reference_data(db: Session) -> None:
    if db.scalar(select(Suburb.id).limit(1)):
        return
    suburbs = {
        name: Suburb(name=name, city="Wellington", latitude=lat, longitude=lon)
        for name, lat, lon in [
            ("Te Aro", -41.2924, 174.7778),
            ("Newtown", -41.3102, 174.7793),
            ("Karori", -41.2841, 174.7361),
            ("Oriental Bay", -41.2911, 174.7945),
        ]
    }
    causes = {
        slug: Cause(slug=slug, name=name)
        for slug, name in [
            ("cleanup", "Cleanup"),
            ("planting", "Planting"),
            ("monitoring", "Monitoring"),
            ("community", "Community"),
        ]
    }
    db.add_all([*suburbs.values(), *causes.values()])
    db.flush()
    organiser = Profile(
        id=DEMO_ORGANISER_ID,
        role=Role.organiser,
        display_name="Kaitiaki Coastal Network",
        email="organiser@example.com",
        suburb_id=suburbs["Te Aro"].id,
    )
    organisation = Organisation(
        owner=organiser,
        name="Kaitiaki Coastal Network",
        verification_status=VerificationStatus.approved,
    )
    volunteer = Profile(
        id=DEMO_VOLUNTEER_ID,
        role=Role.volunteer,
        display_name="Mia Thompson",
        email="volunteer@example.com",
        suburb_id=suburbs["Te Aro"].id,
    )
    db.add_all([organiser, organisation, volunteer])
    db.flush()
    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(days=5)
    fixtures = [
        (
            "Oriental Bay Beach Clean",
            "Spend a purposeful morning restoring the shoreline with a friendly local crew.",
            "Leave one of Wellington’s busiest beaches better than you found it.",
            "Collect litter, sort recyclables, and record the most common waste items.",
            "Oriental Bay",
            "Freyberg Beach changing rooms",
            "cleanup",
            "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=85",
            Recurrence.weekly,
        ),
        (
            "Community Garden Planting Day",
            "Help prepare garden beds and plant winter vegetables for the local food pantry.",
            "Grow fresh food that stays in the neighbourhood.",
            "Prepare soil, plant seedlings, mulch beds, and share morning tea.",
            "Newtown",
            "Carrara Park community garden gate",
            "planting",
            "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "Karori Stream Monitoring",
            "Join trained coordinators to measure stream health and identify freshwater species.",
            "Build the evidence needed to protect an urban waterway.",
            "Take water readings, photograph sites, and log observations.",
            "Karori",
            "Karori Park pavilion",
            "monitoring",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
    ]
    for index, fixture in enumerate(fixtures):
        title, description, impact, tasks, suburb, meeting, cause, image, recurrence = fixture
        event = Opportunity(
            organisation=organisation,
            suburb=suburbs[suburb],
            title=title,
            description=description,
            impact_statement=impact,
            tasks=tasks,
            meeting_point=meeting,
            starts_at=start + timedelta(days=index * 3),
            ends_at=start + timedelta(days=index * 3, hours=3),
            recurrence=recurrence,
            effort="moderate",
            minimum_age=14,
            accessibility="Step-free meeting point; tasks can be adapted.",
            safety_notes="Bring water, sun protection, and closed shoes.",
            capacity=24,
            image_url=image,
            status=OpportunityStatus.published,
            causes=[causes[cause]],
        )
        db.add(event)
    db.commit()
