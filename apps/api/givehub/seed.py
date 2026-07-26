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
    WaiverDocument,
)

DEMO_ORGANISER_ID = uuid.UUID("00000000-0000-4000-8000-000000000010")
DEMO_VOLUNTEER_ID = uuid.UUID("00000000-0000-4000-8000-000000000020")

DEFAULT_WAIVER_TITLE = "GiveHub volunteer agreement"
DEFAULT_WAIVER_BODY = """\
By signing below you agree to take part in this volunteer activity on the \
following terms.

1. Voluntary participation. You are taking part of your own free will and are \
not an employee of the host organisation or of GiveHub. No payment is offered \
for your time.

2. Health and fitness. You confirm you are reasonably fit to carry out the \
tasks described in the listing, and you will tell the host about any medical \
condition, allergy, or access need that may affect your safety on the day.

3. Instructions and safety. You agree to follow the host's briefing, wear any \
protective equipment provided, and stop any task you believe is unsafe. \
Outdoor volunteering can involve uneven ground, weather exposure, tools, and \
manual handling.

4. Assumption of risk. You understand that volunteering carries a risk of \
injury, illness, or damage to personal property, and you accept those \
ordinary risks. Nothing in this agreement removes any right you have under \
the Accident Compensation Act 2001, the Consumer Guarantees Act 1993, or any \
other New Zealand law that cannot be excluded by agreement.

5. Liability. To the extent the law allows, you release the host organisation \
and GiveHub from claims arising from your participation, except where the \
loss is caused by their negligence or wilful misconduct.

6. Under 18s. If you are under 18, a parent or guardian must provide their \
name and email to give consent on your behalf.

7. Photographs. Hosts may take photographs at the activity for their own \
reporting. Tell the host on the day if you would rather not appear in them.

8. Personal information. The details in your application are shared with the \
host organisation so they can plan and run the activity, and are handled \
under the Privacy Act 2020.

This agreement is governed by New Zealand law."""


def seed_reference_data(db: Session) -> None:
    if db.scalar(select(Suburb.id).limit(1)):
        seed_default_waiver(db)
        return
    suburbs = {
        name: Suburb(name=name, city="Wellington", latitude=lat, longitude=lon)
        for name, lat, lon in [
            ("Te Aro", -41.2924, 174.7778),
            ("Newtown", -41.3102, 174.7793),
            ("Karori", -41.2841, 174.7361),
            ("Oriental Bay", -41.2911, 174.7945),
            ("Lower Hutt", -41.2092, 174.9081),
            ("Porirua", -41.1347, 174.8393),
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
        search_location_label="Wellington Central, Wellington",
        search_latitude=-41.2866,
        search_longitude=174.7756,
        search_radius_km=25,
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
        search_location_label="Wellington Central, Wellington",
        search_latitude=-41.2866,
        search_longitude=174.7756,
        search_radius_km=25,
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
            "139 Oriental Parade, Oriental Bay, Wellington 6011",
            -41.2911,
            174.7945,
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
            "Carrara Park, Newtown, Wellington 6021",
            -41.3102,
            174.7793,
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
            "Karori Park, Karori, Wellington 6012",
            -41.2841,
            174.7361,
            "monitoring",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "Hutt River Native Planting",
            "Restore a riverbank corridor with native plants and local conservation guides.",
            "Create healthier habitat along Te Awa Kairangi.",
            "Prepare planting sites, place native seedlings, and spread mulch.",
            "Lower Hutt",
            "Hutt Recreation Ground river entrance",
            "Hutt Recreation Ground, Lower Hutt 5010",
            -41.2110,
            174.9028,
            "planting",
            "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "Porirua Food Rescue Sort",
            "Sort rescued groceries into whānau food parcels with an experienced community team.",
            "Keep good food out of landfill and support families across Porirua.",
            "Check produce, assemble parcels, label dietary needs, and tidy the workspace.",
            "Porirua",
            "Community hub reception",
            "18 Hartham Place, Porirua 5022",
            -41.1357,
            174.8408,
            "community",
            "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85",
            Recurrence.weekly,
        ),
    ]
    for index, fixture in enumerate(fixtures):
        (
            title,
            description,
            impact,
            tasks,
            locality,
            meeting,
            address,
            latitude,
            longitude,
            cause,
            image,
            recurrence,
        ) = fixture
        event = Opportunity(
            organisation=organisation,
            suburb=suburbs[locality],
            title=title,
            description=description,
            impact_statement=impact,
            tasks=tasks,
            meeting_point=meeting,
            location_label=f"{locality}, Wellington Region",
            address_line=address,
            locality=locality,
            city="Wellington Region",
            country_code="NZ",
            latitude=latitude,
            longitude=longitude,
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
    seed_default_waiver(db)


def seed_default_waiver(db: Session) -> None:
    """Ensures the platform-wide waiver exists so waiver-required listings can be signed."""
    existing = db.scalar(
        select(WaiverDocument.id).where(WaiverDocument.organisation_id.is_(None)).limit(1)
    )
    if existing:
        return
    db.add(
        WaiverDocument(
            organisation_id=None,
            title=DEFAULT_WAIVER_TITLE,
            body=DEFAULT_WAIVER_BODY,
            version=1,
            is_active=True,
        )
    )
    db.commit()
