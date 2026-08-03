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
applicable Ontario and Canadian law that cannot be excluded by agreement.

5. Liability. To the extent the law allows, you release the host organisation \
and GiveHub from claims arising from your participation, except where the \
loss is caused by their negligence or wilful misconduct.

6. Under 18s. If you are under 18, a parent or guardian must provide their \
name and email to give consent on your behalf.

7. Photographs. Hosts may take photographs at the activity for their own \
reporting. Tell the host on the day if you would rather not appear in them.

8. Personal information. The details in your application are shared with the \
host organisation so they can plan and run the activity, and are handled \
under applicable Canadian privacy laws.

This agreement is governed by the laws of Ontario and Canada."""


def seed_reference_data(db: Session) -> None:
    if db.scalar(select(Suburb.id).limit(1)):
        migrate_legacy_demo_content(db)
        seed_gta_showcase_opportunities(db)
        seed_live_gta_opportunities(db)
        seed_default_waiver(db)
        return
    suburbs = {
        name: Suburb(name=name, city="Greater Toronto Area", latitude=lat, longitude=lon)
        for name, lat, lon in [
            ("Downtown Toronto", 43.6532, -79.3832),
            ("Parkdale", 43.6405, -79.4369),
            ("East York", 43.6912, -79.3417),
            ("The Beaches", 43.6621, -79.3094),
            ("Mississauga", 43.5890, -79.6441),
            ("North York", 43.7615, -79.4111),
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
        display_name="Toronto Community Action Network",
        email="organiser@example.com",
        suburb_id=suburbs["Downtown Toronto"].id,
        search_location_label="Downtown Toronto, Ontario",
        search_latitude=43.6532,
        search_longitude=-79.3832,
        search_radius_km=50,
        onboarding_completed=True,
    )
    organisation = Organisation(
        owner=organiser,
        name="Toronto Community Action Network",
        verification_status=VerificationStatus.approved,
    )
    volunteer = Profile(
        id=DEMO_VOLUNTEER_ID,
        role=Role.volunteer,
        display_name="Mia Thompson",
        email="volunteer@example.com",
        suburb_id=suburbs["Downtown Toronto"].id,
        search_location_label="Downtown Toronto, Ontario",
        search_latitude=43.6532,
        search_longitude=-79.3832,
        search_radius_km=50,
        onboarding_completed=True,
        preferred_cause_slugs=["cleanup", "community"],
        preferred_availability=["weekend_morning", "weekend_afternoon"],
        preferred_recurrences=["one_off", "weekly"],
        max_time_commitment_minutes=240,
        training_preference="open",
        screening_preference="any",
        transportation_preference="transit",
    )
    db.add_all([organiser, organisation, volunteer])
    db.flush()
    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(days=5)
    fixtures = [
        (
            "Woodbine Beach Cleanup",
            "Spend a purposeful morning restoring the shoreline with a friendly local crew.",
            "Leave one of Toronto’s busiest beaches better than you found it.",
            "Collect litter, sort recyclables, and record the most common waste items.",
            "The Beaches",
            "Woodbine Beach boardwalk entrance",
            "1675 Lake Shore Boulevard East, Toronto, ON M4L 3W6",
            43.6621,
            -79.3094,
            "cleanup",
            "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=85",
            Recurrence.weekly,
        ),
        (
            "Community Garden Planting Day",
            "Help prepare garden beds and plant winter vegetables for the local food pantry.",
            "Grow fresh food that stays in the neighbourhood.",
            "Prepare soil, plant seedlings, mulch beds, and share morning tea.",
            "Parkdale",
            "Masaryk Park community garden gate",
            "220 Cowan Avenue, Toronto, ON M6K 2N6",
            43.6405,
            -79.4369,
            "planting",
            "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "Don River Water Quality Monitoring",
            "Join trained coordinators to measure stream health and identify freshwater species.",
            "Build the evidence needed to protect an urban waterway.",
            "Take water readings, photograph sites, and log observations.",
            "East York",
            "Evergreen Brick Works welcome centre",
            "550 Bayview Avenue, Toronto, ON M4W 3X8",
            43.6841,
            -79.3654,
            "monitoring",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "Credit River Native Planting",
            "Restore a riverbank corridor with native plants and local conservation guides.",
            "Create healthier habitat along the Credit River.",
            "Prepare planting sites, place native seedlings, and spread mulch.",
            "Mississauga",
            "Erindale Park main entrance",
            "1695 Dundas Street West, Mississauga, ON L5C 1E3",
            43.5499,
            -79.6627,
            "planting",
            "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85",
            Recurrence.monthly,
        ),
        (
            "North York Food Rescue Sort",
            "Sort rescued groceries into family food parcels with an experienced community team.",
            "Keep good food out of landfill and support families across North York.",
            "Check produce, assemble parcels, label dietary needs, and tidy the workspace.",
            "North York",
            "Community hub reception",
            "5100 Yonge Street, North York, ON M2N 5V7",
            43.7686,
            -79.4126,
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
            location_label=f"{locality}, Greater Toronto Area",
            address_line=address,
            locality=locality,
            city="Greater Toronto Area",
            country_code="CA",
            latitude=latitude,
            longitude=longitude,
            starts_at=start + timedelta(days=index * 3),
            ends_at=start + timedelta(days=index * 3, hours=3),
            recurrence=recurrence,
            effort="moderate",
            minimum_age=14,
            accessibility="Step-free meeting point; tasks can be adapted.",
            is_accessible=True,
            eligibility_notes="Open to volunteers aged 14 and over.",
            time_commitment_minutes=180,
            training_required=index == 2,
            training_commitment=(
                "Complete a 45-minute field methods briefing before your first session."
                if index == 2
                else "A short briefing is provided at the meeting point."
            ),
            screening_required=False,
            screening_steps="No screening required.",
            transportation_info="Public transport is available nearby; plan your own trip.",
            qualifications="No prior qualifications required.",
            safety_notes="Bring water, sun protection, and closed shoes.",
            capacity=24,
            image_url=image,
            status=OpportunityStatus.published,
            listing_source=(
                "Toronto Food Share Collective website"
                if index == len(fixtures) - 1
                else "GiveHub organiser"
            ),
            listing_source_url=(
                "https://example.org/volunteer/food-rescue" if index == len(fixtures) - 1 else None
            ),
            listing_verification_status="verified",
            source_updated_at=datetime.now(UTC),
            application_mode="external" if index == len(fixtures) - 1 else "internal",
            external_application_url=(
                "https://example.org/volunteer/food-rescue" if index == len(fixtures) - 1 else None
            ),
            causes=[causes[cause]],
        )
        db.add(event)
    db.commit()
    seed_gta_showcase_opportunities(db)
    seed_live_gta_opportunities(db)
    seed_default_waiver(db)


def migrate_legacy_demo_content(db: Session) -> None:
    """Move the original Wellington demo records to the GTA without touching user-created data."""
    suburb_updates = {
        "Te Aro": ("Downtown Toronto", 43.6532, -79.3832),
        "Newtown": ("Parkdale", 43.6405, -79.4369),
        "Karori": ("East York", 43.6912, -79.3417),
        "Oriental Bay": ("The Beaches", 43.6621, -79.3094),
        "Lower Hutt": ("Mississauga", 43.5890, -79.6441),
        "Porirua": ("North York", 43.7615, -79.4111),
    }
    for old_name, (name, latitude, longitude) in suburb_updates.items():
        suburb = db.scalar(select(Suburb).where(Suburb.name == old_name))
        if suburb:
            suburb.name = name
            suburb.city = "Greater Toronto Area"
            suburb.latitude = latitude
            suburb.longitude = longitude

    organiser = db.get(Profile, DEMO_ORGANISER_ID)
    if organiser and organiser.display_name == "Kaitiaki Coastal Network":
        organiser.display_name = "Toronto Community Action Network"
        organiser.search_location_label = "Downtown Toronto, Ontario"
        organiser.search_latitude = 43.6532
        organiser.search_longitude = -79.3832
        organiser.search_radius_km = 50
        if organiser.organisation:
            organiser.organisation.name = "Toronto Community Action Network"
    volunteer = db.get(Profile, DEMO_VOLUNTEER_ID)
    if volunteer and volunteer.search_location_label == "Wellington Central, Wellington":
        volunteer.search_location_label = "Downtown Toronto, Ontario"
        volunteer.search_latitude = 43.6532
        volunteer.search_longitude = -79.3832
        volunteer.search_radius_km = 50

    opportunity_updates = {
        "Oriental Bay Beach Clean": {
            "title": "Woodbine Beach Cleanup",
            "impact_statement": "Leave one of Toronto’s busiest beaches better than you found it.",
            "meeting_point": "Woodbine Beach boardwalk entrance",
            "location_label": "The Beaches, Greater Toronto Area",
            "address_line": "1675 Lake Shore Boulevard East, Toronto, ON M4L 3W6",
            "locality": "The Beaches",
            "latitude": 43.6621,
            "longitude": -79.3094,
        },
        "Community Garden Planting Day": {
            "meeting_point": "Masaryk Park community garden gate",
            "location_label": "Parkdale, Greater Toronto Area",
            "address_line": "220 Cowan Avenue, Toronto, ON M6K 2N6",
            "locality": "Parkdale",
            "latitude": 43.6405,
            "longitude": -79.4369,
        },
        "Karori Stream Monitoring": {
            "title": "Don River Water Quality Monitoring",
            "meeting_point": "Evergreen Brick Works welcome centre",
            "location_label": "East York, Greater Toronto Area",
            "address_line": "550 Bayview Avenue, Toronto, ON M4W 3X8",
            "locality": "East York",
            "latitude": 43.6841,
            "longitude": -79.3654,
        },
        "Hutt River Native Planting": {
            "title": "Credit River Native Planting",
            "impact_statement": "Create healthier habitat along the Credit River.",
            "meeting_point": "Erindale Park main entrance",
            "location_label": "Mississauga, Greater Toronto Area",
            "address_line": "1695 Dundas Street West, Mississauga, ON L5C 1E3",
            "locality": "Mississauga",
            "latitude": 43.5499,
            "longitude": -79.6627,
        },
        "Porirua Food Rescue Sort": {
            "title": "North York Food Rescue Sort",
            "description": "Sort rescued groceries into family food parcels with an experienced community team.",
            "impact_statement": "Keep good food out of landfill and support families across North York.",
            "location_label": "North York, Greater Toronto Area",
            "address_line": "5100 Yonge Street, North York, ON M2N 5V7",
            "locality": "North York",
            "latitude": 43.7686,
            "longitude": -79.4126,
            "listing_source": "Toronto Food Share Collective website",
        },
    }
    for old_title, updates in opportunity_updates.items():
        opportunity = db.scalar(select(Opportunity).where(Opportunity.title == old_title))
        if opportunity:
            for field, value in updates.items():
                setattr(opportunity, field, value)
            opportunity.city = "Greater Toronto Area"
            opportunity.country_code = "CA"

    waiver = db.scalar(
        select(WaiverDocument)
        .where(WaiverDocument.organisation_id.is_(None), WaiverDocument.is_active.is_(True))
        .limit(1)
    )
    if waiver and "New Zealand law" in waiver.body:
        waiver.body = DEFAULT_WAIVER_BODY
        waiver.version += 1
    db.commit()


def seed_gta_showcase_opportunities(db: Session) -> None:
    """Add varied synthetic listings so every discovery filter has useful examples."""
    organiser = db.get(Profile, DEMO_ORGANISER_ID)
    if not organiser or not organiser.organisation:
        return
    causes = {cause.slug: cause for cause in db.scalars(select(Cause)).all()}
    suburb_specs = {
        "High Park": ("Toronto", 43.6465, -79.4637),
        "Scarborough": ("Toronto", 43.7764, -79.2318),
        "Etobicoke": ("Toronto", 43.6205, -79.5132),
        "Brampton": ("Greater Toronto Area", 43.7315, -79.7624),
        "Markham": ("Greater Toronto Area", 43.8561, -79.3370),
    }
    suburbs: dict[str, Suburb] = {}
    for name, (city, latitude, longitude) in suburb_specs.items():
        suburb = db.scalar(select(Suburb).where(Suburb.name == name))
        if not suburb:
            suburb = Suburb(name=name, city=city, latitude=latitude, longitude=longitude)
            db.add(suburb)
            db.flush()
        suburbs[name] = suburb

    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    listings: list[dict[str, object]] = [
        {
            "title": "High Park Pollinator Count",
            "description": "Join a guided citizen-science walk to count bees, butterflies, and flowering plants.",
            "impact_statement": "Create a snapshot of pollinator health in one of Toronto’s largest parks.",
            "tasks": "Walk a marked route, photograph pollinators, and record observations on a provided sheet.",
            "suburb": "High Park",
            "meeting_point": "High Park Nature Centre entrance",
            "address_line": "375 Colborne Lodge Drive, Toronto, ON M6R 2Z3",
            "postcode": "M6R 2Z3",
            "latitude": 43.6465,
            "longitude": -79.4637,
            "cause": "monitoring",
            "days": 4,
            "hours": 1,
            "recurrence": Recurrence.one_off,
            "effort": "light",
            "minimum_age": 12,
            "capacity": 20,
            "is_accessible": True,
            "accessibility": "Paved route with frequent rest points; seated counting is available.",
            "image_url": "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Scarborough Newcomer Conversation Club",
            "description": "Support newcomers practising conversational English in a welcoming small-group setting.",
            "impact_statement": "Help new neighbours build confidence and community connections.",
            "tasks": "Facilitate conversation prompts, welcome participants, and help prepare learning materials.",
            "suburb": "Scarborough",
            "meeting_point": "Scarborough Civic Centre library entrance",
            "address_line": "150 Borough Drive, Scarborough, ON M1P 4N7",
            "postcode": "M1P 4N7",
            "latitude": 43.7739,
            "longitude": -79.2577,
            "cause": "community",
            "days": 6,
            "hours": 2,
            "recurrence": Recurrence.weekly,
            "effort": "light",
            "minimum_age": 18,
            "capacity": 10,
            "is_accessible": True,
            "accessibility": "Step-free indoor venue with accessible washrooms.",
            "screening_required": True,
            "screening_steps": "A brief reference check and volunteer orientation are required.",
            "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Etobicoke Seniors Tech Help",
            "description": "Offer patient one-to-one support with phones, tablets, video calls, and online services.",
            "impact_statement": "Help older adults stay connected and confident online.",
            "tasks": "Answer basic device questions, demonstrate accessibility settings, and share safety tips.",
            "suburb": "Etobicoke",
            "meeting_point": "Etobicoke Civic Centre reception",
            "address_line": "399 The West Mall, Etobicoke, ON M9C 2Y2",
            "postcode": "M9C 2Y2",
            "latitude": 43.6432,
            "longitude": -79.5657,
            "cause": "community",
            "days": 9,
            "hours": 1.5,
            "recurrence": Recurrence.monthly,
            "effort": "light",
            "minimum_age": 16,
            "capacity": 8,
            "is_accessible": True,
            "accessibility": "Fully accessible indoor venue; quiet workstations are available.",
            "training_required": True,
            "training_commitment": "Complete a 30-minute digital-safety orientation online.",
            "image_url": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Rouge Valley Trail Restoration",
            "description": "Work with a conservation crew to restore a worn trail edge and protect native habitat.",
            "impact_statement": "Reduce erosion and help visitors enjoy the Rouge responsibly.",
            "tasks": "Move mulch, install trail markers, remove invasive plants, and clear light debris.",
            "suburb": "Scarborough",
            "meeting_point": "Rouge Valley Conservation Centre parking area",
            "address_line": "1749 Meadowvale Road, Scarborough, ON M1B 5W8",
            "postcode": "M1B 5W8",
            "latitude": 43.8177,
            "longitude": -79.1717,
            "cause": "planting",
            "days": 12,
            "hours": 4,
            "recurrence": Recurrence.one_off,
            "effort": "active",
            "minimum_age": 16,
            "capacity": 28,
            "is_accessible": False,
            "accessibility": "Uneven natural terrain with slopes and no step-free task area.",
            "image_url": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Brampton Park Cleanup Sprint",
            "description": "Take part in a focused neighbourhood cleanup around trails, play areas, and picnic spaces.",
            "impact_statement": "Make a busy community park cleaner in just ninety minutes.",
            "tasks": "Collect litter, separate recyclables, and report bulky waste to the event lead.",
            "suburb": "Brampton",
            "meeting_point": "Chinguacousy Park greenhouse entrance",
            "address_line": "9050 Bramalea Road, Brampton, ON L6S 6G7",
            "postcode": "L6S 6G7",
            "latitude": 43.7284,
            "longitude": -79.7258,
            "cause": "cleanup",
            "days": 15,
            "hours": 1.5,
            "recurrence": Recurrence.monthly,
            "effort": "moderate",
            "minimum_age": 14,
            "capacity": 40,
            "is_accessible": True,
            "accessibility": "Paved cleanup zone and lightweight grabbers are available.",
            "application_mode": "external",
            "external_application_url": "https://example.org/volunteer/brampton-cleanup",
            "listing_source": "Brampton Neighbourhood Green Team website",
            "listing_source_url": "https://example.org/volunteer/brampton-cleanup",
            "listing_verification_status": "pending",
            "image_url": "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Markham Young Tree Care Day",
            "description": "Help recently planted street trees survive summer heat with hands-on care.",
            "impact_statement": "Give young urban trees a stronger start across Markham.",
            "tasks": "Water trees, refresh mulch rings, inspect guards, and record damaged stakes.",
            "suburb": "Markham",
            "meeting_point": "Markham Civic Centre flagpoles",
            "address_line": "101 Town Centre Boulevard, Markham, ON L3R 9W3",
            "postcode": "L3R 9W3",
            "latitude": 43.8561,
            "longitude": -79.3370,
            "cause": "planting",
            "days": 18,
            "hours": 3,
            "recurrence": Recurrence.monthly,
            "effort": "active",
            "minimum_age": 16,
            "capacity": 22,
            "is_accessible": False,
            "accessibility": "Work takes place on grass boulevards with uneven surfaces.",
            "training_required": True,
            "training_commitment": "Attend a 45-minute tool and tree-care briefing before starting.",
            "image_url": "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "title": "Downtown Youth Meal Kit Packing",
            "description": "Pack shelf-stable meal kits for youth outreach programs in a fast-moving team shift.",
            "impact_statement": "Prepare practical food support for young people across downtown Toronto.",
            "tasks": "Check expiry dates, assemble meal kits, label boxes, and reset packing stations.",
            "suburb": "High Park",
            "meeting_point": "Community warehouse volunteer desk",
            "address_line": "50 Wabash Avenue, Toronto, ON M6R 1N2",
            "postcode": "M6R 1N2",
            "latitude": 43.6537,
            "longitude": -79.4442,
            "cause": "community",
            "days": 21,
            "hours": 2,
            "recurrence": Recurrence.weekly,
            "effort": "moderate",
            "minimum_age": 18,
            "capacity": 14,
            "is_accessible": True,
            "accessibility": "Step-free warehouse floor with seated packing tasks on request.",
            "screening_required": True,
            "screening_steps": "Complete an online vulnerable-sector screening form before confirmation.",
            "image_url": "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85",
        },
    ]
    for listing in listings:
        title = str(listing["title"])
        if db.scalar(select(Opportunity.id).where(Opportunity.title == title)):
            continue
        days_value = listing.pop("days")
        hours_value = listing.pop("hours")
        assert isinstance(days_value, int)
        assert isinstance(hours_value, (int, float))
        days = days_value
        hours = float(hours_value)
        suburb_name = str(listing.pop("suburb"))
        cause_slug = str(listing.pop("cause"))
        event = Opportunity(
            organisation=organiser.organisation,
            suburb=suburbs[suburb_name],
            starts_at=start + timedelta(days=days),
            ends_at=start + timedelta(days=days, hours=hours),
            location_label=f"{suburb_name}, Greater Toronto Area",
            locality=suburb_name,
            city="Greater Toronto Area",
            country_code="CA",
            eligibility_notes="Open to volunteers who meet the listed minimum age.",
            time_commitment_minutes=round(hours * 60),
            transportation_info="Public transit is available nearby; plan your own trip.",
            qualifications="No prior qualifications required.",
            safety_notes="Follow the event lead’s safety briefing and dress for the conditions.",
            status=OpportunityStatus.published,
            source_updated_at=datetime.now(UTC),
            causes=[causes[cause_slug]],
            **listing,
        )
        db.add(event)
    db.commit()


def seed_live_gta_opportunities(db: Session) -> None:
    """Seed concise, source-linked summaries of public listings checked on 2 August 2026."""
    causes = {cause.slug: cause for cause in db.scalars(select(Cause)).all()}
    checked_at = datetime(2026, 8, 2, 12, tzinfo=UTC)
    listings: list[dict[str, object]] = [
        {
            "host": "Belmont House",
            "slug": "belmont-house",
            "title": "Summerfest Special Event Volunteer",
            "description": "Help Belmont House residents enjoy its annual Summerfest celebration on 12 August 2026.",
            "impact_statement": "Create a welcoming and memorable celebration for seniors and their families.",
            "tasks": "Prepare the event space, welcome and accompany residents, serve refreshments, socialize, and help reset afterward.",
            "meeting_point": "Belmont House reception",
            "location_label": "Yorkville, Toronto",
            "address_line": "55 Belmont Street, Toronto, ON M5R 1R1",
            "locality": "Yorkville",
            "city": "Toronto",
            "postcode": "M5R 1R1",
            "latitude": 43.6768,
            "longitude": -79.3967,
            "starts_at": datetime(2026, 8, 12, 13, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 12, 18, 30, tzinfo=UTC),
            "recurrence": Recurrence.one_off,
            "effort": "moderate",
            "minimum_age": 16,
            "capacity": 30,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Indoor long-term-care setting; contact Belmont House for accommodations.",
            "training_required": True,
            "training_commitment": "Attend the event-day introduction and orientation at 9:00 a.m.",
            "source": "Volunteer Toronto · Belmont House",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1082031&view=2",
            "source_date": datetime(2026, 7, 8, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Fred Victor",
            "slug": "fred-victor",
            "title": "Urban Growers Volunteer Training Program",
            "description": "Join Fred Victor’s August-to-October urban growing cohort at its Oak Street site.",
            "impact_statement": "Grow food for community meals while building practical urban-agriculture skills.",
            "tasks": "Prepare beds, plant, water, weed, prune, harvest, compost, and process produce for community meals.",
            "meeting_point": "Fred Victor Oak Street garden",
            "location_label": "Regent Park, Toronto",
            "address_line": "40 Oak Street, Toronto, ON M5A 2C6",
            "locality": "Regent Park",
            "city": "Toronto",
            "postcode": "M5A 2C6",
            "latitude": 43.6617,
            "longitude": -79.3667,
            "starts_at": datetime(2026, 8, 18, 14, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 18, 16, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "active",
            "minimum_age": 18,
            "capacity": 12,
            "cause": "planting",
            "is_accessible": False,
            "accessibility": "Garden work may involve uneven outdoor surfaces; request accommodations during application.",
            "training_required": True,
            "training_commitment": "Commit to the three-month cohort, Tuesdays and Thursdays from 10 a.m. to noon.",
            "screening_required": True,
            "screening_steps": "Interview, police record check, orientation, and role training are required.",
            "source": "Volunteer Toronto · Fred Victor",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1092234&view=2",
            "source_date": datetime(2026, 6, 13, tzinfo=UTC),
            "time_commitment_minutes": 240,
            "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Habitat for Humanity GTA",
            "slug": "habitat-gta",
            "title": "Etobicoke ReStore Volunteer",
            "description": "Take flexible four-hour shifts at Habitat GTA’s Etobicoke ReStore, posted 23 July 2026.",
            "impact_statement": "Give donated home goods a second life while supporting affordable home ownership.",
            "tasks": "Welcome customers, organize merchandise, help with e-commerce photos, price products, and assist with displays.",
            "meeting_point": "Etobicoke ReStore volunteer desk",
            "location_label": "Etobicoke, Toronto",
            "address_line": "700 Kipling Avenue, Etobicoke, ON M8Z 5G3",
            "locality": "Etobicoke",
            "city": "Toronto",
            "postcode": "M8Z 5G3",
            "latitude": 43.6250,
            "longitude": -79.5290,
            "starts_at": datetime(2026, 8, 8, 14, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 8, 18, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "active",
            "minimum_age": 16,
            "capacity": 20,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Habitat GTA welcomes accommodation requests; some tasks involve lifting and standing.",
            "training_required": True,
            "training_commitment": "Complete an online orientation before self-scheduling a first shift.",
            "qualifications": "CSA-approved safety shoes are required; loaners may be available.",
            "source": "Volunteer Toronto · Habitat for Humanity GTA",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=834214&view=2",
            "source_date": datetime(2026, 7, 23, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Youth for Change",
            "slug": "youth-for-change",
            "title": "North York Event Photographer",
            "description": "Photograph Youth for Change events at Mel Lastman Square in September and October 2026.",
            "impact_statement": "Document community celebrations and help a youth organization share its work.",
            "tasks": "Plan compositions, photograph speakers and activities, edit images, and deliver event photo sets.",
            "meeting_point": "Mel Lastman Square event check-in",
            "location_label": "North York, Toronto",
            "address_line": "5100 Yonge Street, North York, ON M2N 5V7",
            "locality": "North York",
            "city": "Toronto",
            "postcode": "M2N 5V7",
            "latitude": 43.7678,
            "longitude": -79.4127,
            "starts_at": datetime(2026, 9, 20, 13, tzinfo=UTC),
            "ends_at": datetime(2026, 9, 20, 21, tzinfo=UTC),
            "recurrence": Recurrence.one_off,
            "effort": "active",
            "minimum_age": 18,
            "capacity": 2,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Public square beside North York Centre station; confirm event-specific accommodations with the host.",
            "qualifications": "Event photography and photo-editing experience; portfolio may be requested.",
            "source": "Volunteer Toronto · Youth for Change",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1090712&view=2",
            "source_date": datetime(2026, 7, 20, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Better Living Health and Community Services",
            "slug": "better-living",
            "title": "Adult Day Program Assistant",
            "description": "Support weekday adult day programming for older adults in North York through flexible four-hour shifts.",
            "impact_statement": "Help older adults take part in meals, activities, and meaningful social connection.",
            "tasks": "Set up activities, assist program leaders, serve meals and snacks, socialize, and help reset the space.",
            "meeting_point": "Better Living reception",
            "location_label": "Don Mills, North York",
            "address_line": "1 Overland Drive, North York, ON M3C 2C3",
            "locality": "Don Mills",
            "city": "Toronto",
            "postcode": "M3C 2C3",
            "latitude": 43.7206,
            "longitude": -79.3370,
            "starts_at": datetime(2026, 8, 4, 12, 30, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 4, 16, 30, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "moderate",
            "minimum_age": 18,
            "capacity": 8,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Accessible building and washrooms; transit and free parking are available.",
            "training_required": True,
            "training_commitment": "Complete agency orientation and on-the-job shadowing before volunteering independently.",
            "source": "Volunteer Toronto · Better Living",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1084161&view=2",
            "source_date": datetime(2026, 7, 7, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Dixon Hall",
            "slug": "dixon-hall",
            "title": "Urgent Meals on Wheels Driver",
            "description": "Deliver hot lunches to homebound community members on a recurring weekday or Sunday route.",
            "impact_statement": "Support nutrition, wellness, and independence for isolated neighbours.",
            "tasks": "Drive an assigned route, transport a delivery partner, help carry meal bags, and return route materials.",
            "meeting_point": "Dixon Hall Meals on Wheels office",
            "location_label": "Cabbagetown, Toronto",
            "address_line": "192 Carlton Street, Toronto, ON M5A 2K8",
            "locality": "Cabbagetown",
            "city": "Toronto",
            "postcode": "M5A 2K8",
            "latitude": 43.6635,
            "longitude": -79.3685,
            "starts_at": datetime(2026, 8, 3, 15, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 3, 17, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "moderate",
            "minimum_age": 25,
            "capacity": 10,
            "cause": "community",
            "is_accessible": False,
            "accessibility": "Driving and carrying meal bags are core duties; contact Dixon Hall about role accommodations.",
            "training_required": True,
            "training_commitment": "Attend onboarding and complete on-the-job training with an experienced volunteer.",
            "qualifications": "Valid Ontario driver’s licence and safe driving record; insurance requirements apply.",
            "source": "Volunteer Toronto · Dixon Hall",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=447540&view=2",
            "source_date": datetime(2026, 7, 13, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "SE Health - Saint Elizabeth Foundation",
            "slug": "se-health",
            "title": "Let’s Chat Virtual Phone Volunteer",
            "description": "Make a scheduled weekly phone call to provide conversation and social connection from home.",
            "impact_statement": "Reduce loneliness through dependable, respectful conversation.",
            "tasks": "Call an assigned participant, listen actively, maintain confidentiality, and report concerns appropriately.",
            "meeting_point": "Virtual opportunity — volunteer from home",
            "location_label": "Virtual · Greater Toronto Area",
            "address_line": "Remote within the Greater Toronto Area",
            "locality": "Greater Toronto Area",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 6, 22, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 6, 23, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "light",
            "minimum_age": 18,
            "capacity": 20,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Remote phone role completed from home; basic telephone access is required.",
            "training_required": True,
            "training_commitment": "Complete onboarding covering communication, confidentiality, boundaries, and reporting.",
            "screening_required": True,
            "screening_steps": "Clear vulnerable-sector and criminal-record checks are required.",
            "source": "Volunteer Toronto · SE Health",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1093095&view=2",
            "source_date": datetime(2026, 7, 27, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Youth Assisting Youth",
            "slug": "youth-assisting-youth",
            "title": "Peer Youth Mentor",
            "description": "Young adults ages 16–29 mentor children and youth across Toronto through weekly activities.",
            "impact_statement": "Give an at-risk or newcomer child a consistent positive role model.",
            "tasks": "Meet weekly with a matched young person for social, recreational, or academic activities.",
            "meeting_point": "Location arranged after mentor match",
            "location_label": "Multiple Toronto neighbourhoods",
            "address_line": "Toronto, Ontario",
            "locality": "Toronto",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 9, 17, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 9, 19, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "light",
            "minimum_age": 16,
            "capacity": 25,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Meeting format and location are arranged with each mentor match.",
            "eligibility_notes": "Applicants must be ages 16–29 and able to commit weekly for one year.",
            "source": "Volunteer Toronto · Youth Assisting Youth",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=242680&view=2",
            "source_date": datetime(2026, 7, 3, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Jamii",
            "slug": "jamii",
            "title": "Jamii Outdoor Event Volunteer",
            "description": "Join Jamii’s volunteer community supporting outdoor arts and neighbourhood events on The Esplanade.",
            "impact_statement": "Help free public arts events feel welcoming, organized, and connected.",
            "tasks": "Welcome visitors, support event setup, share directions, and assist the event team as assigned.",
            "meeting_point": "The Jamii Hub",
            "location_label": "St. Lawrence, Toronto",
            "address_line": "264 The Esplanade, Toronto, ON M5A 4J6",
            "locality": "St. Lawrence",
            "city": "Toronto",
            "postcode": "M5A 4J6",
            "latitude": 43.6508,
            "longitude": -79.3642,
            "starts_at": datetime(2026, 10, 10, 18, tzinfo=UTC),
            "ends_at": datetime(2026, 10, 10, 21, tzinfo=UTC),
            "recurrence": Recurrence.one_off,
            "effort": "moderate",
            "minimum_age": 16,
            "capacity": 20,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Outdoor event role; contact Jamii to arrange specific accommodations.",
            "training_required": True,
            "training_commitment": "Attend Jamii’s volunteer mingling and role briefing before selecting shifts.",
            "source": "Jamii official volunteer page",
            "url": "https://www.jamii.ca/getinvolved/volunteers",
            "source_date": checked_at,
            "image_url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "United Way Greater Toronto",
            "slug": "united-way-greater-toronto",
            "title": "ClimbUP 2026 Event Volunteer",
            "description": "Support United Way Greater Toronto’s ClimbUP fundraising event at the CN Tower on 14–15 November 2026.",
            "impact_statement": "Help deliver a major community fundraiser supporting people across the GTA.",
            "tasks": "Support participant flow, welcome climbers, provide directions, and assist event operations as assigned.",
            "meeting_point": "CN Tower event volunteer check-in",
            "location_label": "Downtown Toronto",
            "address_line": "301 Front Street West, Toronto, ON M5V 2T6",
            "locality": "Downtown Toronto",
            "city": "Toronto",
            "postcode": "M5V 2T6",
            "latitude": 43.6426,
            "longitude": -79.3871,
            "starts_at": datetime(2026, 11, 14, 13, tzinfo=UTC),
            "ends_at": datetime(2026, 11, 14, 19, tzinfo=UTC),
            "recurrence": Recurrence.one_off,
            "effort": "active",
            "minimum_age": 16,
            "capacity": 80,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Event roles vary; request an accessible assignment from United Way.",
            "source": "United Way Greater Toronto official volunteer page",
            "url": "https://www.unitedwaygt.org/get-involved/volunteer-with-united-way/",
            "source_date": checked_at,
            "image_url": "https://images.unsplash.com/photo-1517090504586-fde19ea6066f?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Evergreen",
            "slug": "evergreen",
            "title": "Evergreen Garden Circle Volunteer",
            "description": "Join Evergreen gardeners at the Brick Works on Tuesday mornings through fall 2026.",
            "impact_statement": "Care for regenerative landscapes while learning practical urban ecology skills.",
            "tasks": "Plant, weed, mulch, remove invasive plants, collect litter, and learn plant identification with staff.",
            "meeting_point": "Evergreen Brick Works welcome centre",
            "location_label": "Don Valley, Toronto",
            "address_line": "550 Bayview Avenue, Toronto, ON M4W 3X8",
            "locality": "Don Valley",
            "city": "Toronto",
            "postcode": "M4W 3X8",
            "latitude": 43.6847,
            "longitude": -79.3650,
            "starts_at": datetime(2026, 8, 11, 13, 30, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 11, 16, tzinfo=UTC),
            "recurrence": Recurrence.monthly,
            "effort": "active",
            "minimum_age": 15,
            "capacity": 20,
            "cause": "planting",
            "is_accessible": True,
            "accessibility": "Evergreen provides accommodations on request; outdoor terrain varies by task.",
            "training_required": True,
            "training_commitment": "Complete Evergreen onboarding and an on-site role briefing.",
            "source": "Volunteer Toronto · Evergreen",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1086421&view=2",
            "source_date": datetime(2026, 5, 4, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Youth for Change",
            "slug": "youth-for-change",
            "title": "Community Events Outreach Coordinator",
            "description": "Support outreach and partnerships for two Toronto cultural events through November 2026.",
            "impact_statement": "Connect community partners, artists, and attendees with free cultural programming.",
            "tasks": "Research partners, conduct outreach, answer inquiries, maintain contacts, and support event promotion.",
            "meeting_point": "Virtual opportunity with occasional GTA event visits",
            "location_label": "Virtual · Greater Toronto Area",
            "address_line": "Remote within the Greater Toronto Area",
            "locality": "Greater Toronto Area",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 10, 17, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 10, 22, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "light",
            "minimum_age": 18,
            "capacity": 3,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Primarily remote and flexible; some optional GTA event visits may be in person.",
            "qualifications": "Strong written and spoken communication; marketing or sales experience is helpful.",
            "source": "Volunteer Toronto · Youth for Change",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1090711&view=2",
            "source_date": datetime(2026, 7, 20, tzinfo=UTC),
            "time_commitment_minutes": 300,
            "image_url": "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Community Share Food Bank",
            "slug": "community-share-food-bank",
            "title": "Volunteer Board Operations Lead",
            "description": "Provide volunteer governance and operational oversight to a Don Mills community food bank.",
            "impact_statement": "Strengthen the systems that keep emergency food support dependable and responsive.",
            "tasks": "Support staff, monitor operational continuity, coordinate onboarding, and report to the board.",
            "meeting_point": "Virtual role serving Don Mills",
            "location_label": "Virtual · Don Mills, Toronto",
            "address_line": "Don Mills, Toronto, Ontario",
            "locality": "Don Mills",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.7448,
            "longitude": -79.3457,
            "starts_at": datetime(2026, 8, 12, 22, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 13, 0, tzinfo=UTC),
            "recurrence": Recurrence.monthly,
            "effort": "light",
            "minimum_age": 21,
            "capacity": 1,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Virtual flexible-schedule board role; accommodations can be discussed with the organization.",
            "training_required": True,
            "training_commitment": "Complete board and operational onboarding with the chair and staff.",
            "qualifications": "Governance, nonprofit operations, people leadership, or facilities experience is preferred.",
            "source": "Volunteer Toronto · Community Share Food Bank",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1085427&view=2",
            "source_date": datetime(2026, 7, 8, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "St. John Ambulance Toronto Region",
            "slug": "st-john-ambulance-toronto",
            "title": "Virtual Museum Website Administrator",
            "description": "Help maintain and expand St. John Ambulance Toronto Region’s online museum.",
            "impact_statement": "Make more than 140 years of Ontario volunteer history accessible online.",
            "tasks": "Maintain website content, organize digital exhibits, improve accessibility, and support online storytelling.",
            "meeting_point": "Virtual opportunity",
            "location_label": "Virtual · Toronto",
            "address_line": "Remote within Ontario",
            "locality": "Toronto",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 15, 17, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 15, 20, tzinfo=UTC),
            "recurrence": Recurrence.monthly,
            "effort": "light",
            "minimum_age": 18,
            "capacity": 2,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Remote flexible-schedule role using online collaboration tools.",
            "qualifications": "Website administration, digital archives, content management, or accessibility experience is helpful.",
            "source": "Volunteer Toronto · St. John Ambulance",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1094335&view=2",
            "source_date": datetime(2026, 7, 10, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "St. John Ambulance Toronto Region",
            "slug": "st-john-ambulance-toronto",
            "title": "Tails on Trails Planning Committee",
            "description": "Help plan Toronto’s inaugural Tails on Trails fundraising walk for 25 October 2026.",
            "impact_statement": "Build a welcoming fundraiser for therapy dogs, youth programs, and first-aid education.",
            "tasks": "Support outreach, logistics, volunteer coordination, sponsorship, and event-day planning.",
            "meeting_point": "Hybrid planning meetings in Toronto",
            "location_label": "Hybrid · Toronto",
            "address_line": "Toronto, Ontario",
            "locality": "Toronto",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 16, 18, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 16, 20, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "light",
            "minimum_age": 18,
            "capacity": 10,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Hybrid planning role; ask the organizer about accessible meeting options and event assignments.",
            "training_required": True,
            "training_commitment": "Attend committee onboarding and recurring planning meetings through the event.",
            "source": "Volunteer Toronto · St. John Ambulance",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=1094251&view=2",
            "source_date": datetime(2026, 7, 21, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "WoodGreen Community Services",
            "slug": "woodgreen",
            "title": "Newcomer Professional Mentor",
            "description": "Mentor newcomer professionals entering engineering, construction, planning, or design careers.",
            "impact_statement": "Help newcomers understand Canadian workplaces and build useful professional networks.",
            "tasks": "Share sector guidance, review career goals, practise networking, and suggest professional resources.",
            "meeting_point": "Hybrid meetings arranged with the mentorship program",
            "location_label": "Hybrid · Toronto",
            "address_line": "Toronto, Ontario",
            "locality": "Toronto",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.6532,
            "longitude": -79.3832,
            "starts_at": datetime(2026, 8, 18, 22, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 19, 0, tzinfo=UTC),
            "recurrence": Recurrence.monthly,
            "effort": "light",
            "minimum_age": 21,
            "capacity": 15,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Hybrid flexible-schedule role; meeting format is arranged with the mentee.",
            "qualifications": "Current or recent professional experience in engineering, construction, planning, or design.",
            "source": "Volunteer Toronto · WoodGreen Community Services",
            "url": "https://www.volunteertoronto.ca/networking/apply_now.aspx?id=949228&view=2",
            "source_date": datetime(2026, 6, 8, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Dusk Dances",
            "slug": "dusk-dances",
            "title": "Dusk Dances Festival Volunteer",
            "description": "Support Dusk Dances as Toronto parks become stages for outdoor dance performances.",
            "impact_statement": "Help make free site-specific dance welcoming and accessible to local audiences.",
            "tasks": "Assist setup, welcome guests, provide directions, support performance sites, and help with front-of-house needs.",
            "meeting_point": "Withrow Park festival check-in",
            "location_label": "Riverdale, Toronto",
            "address_line": "725 Logan Avenue, Toronto, ON M4K 3C6",
            "locality": "Riverdale",
            "city": "Toronto",
            "postcode": "M4K 3C6",
            "latitude": 43.6789,
            "longitude": -79.3467,
            "starts_at": datetime(2026, 8, 7, 21, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 8, 2, tzinfo=UTC),
            "recurrence": Recurrence.one_off,
            "effort": "moderate",
            "minimum_age": 16,
            "capacity": 97,
            "cause": "community",
            "is_accessible": True,
            "accessibility": "Outdoor park setting; contact Dusk Dances for an assignment matching specific access needs.",
            "training_required": True,
            "training_commitment": "Attend a role briefing and commit to at least two four-to-five-hour shifts.",
            "source": "Volunteer Success · Dusk Dances",
            "url": "https://volunteersuccess.com/opportunities/festival-volunteer-dusk-dances-2026-07-14-10.48.23",
            "source_date": datetime(2026, 8, 1, tzinfo=UTC),
            "image_url": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "host": "Nankind",
            "slug": "nankind",
            "title": "In-home Childcare Volunteer Angel",
            "description": "Provide weekly in-home childcare for a North York family affected by a parent’s cancer.",
            "impact_statement": "Give children stability and parents time for treatment, appointments, and recovery.",
            "tasks": "Plan safe activities, provide psychosocial support, build coping skills, and offer dependable weekly care.",
            "meeting_point": "Matched family home after screening",
            "location_label": "North York, Toronto",
            "address_line": "North York, Toronto, Ontario",
            "locality": "North York",
            "city": "Toronto",
            "postcode": None,
            "latitude": 43.7615,
            "longitude": -79.4111,
            "starts_at": datetime(2026, 8, 9, 17, tzinfo=UTC),
            "ends_at": datetime(2026, 8, 9, 21, tzinfo=UTC),
            "recurrence": Recurrence.weekly,
            "effort": "moderate",
            "minimum_age": 18,
            "capacity": 15,
            "cause": "community",
            "is_accessible": False,
            "accessibility": "The role takes place in a matched family home; discuss mobility and accommodation needs before matching.",
            "training_required": True,
            "training_commitment": "Complete Nankind’s specialized childcare and family-support training.",
            "screening_required": True,
            "screening_steps": "References and a vulnerable-sector or police record check are required.",
            "qualifications": "At least one year of professional childcare experience and a six-month weekly commitment.",
            "source": "Volunteer Success · Nankind",
            "url": "https://www.volunteersuccess.com/opportunities/cancer-support-in-home-childcare-volunteer-nankind-2026-06-16-04.37.56",
            "source_date": datetime(2026, 6, 29, tzinfo=UTC),
            "time_commitment_minutes": 240,
            "image_url": "https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=1200&q=85",
        },
    ]

    for listing in listings:
        values = dict(listing)
        url = str(values.pop("url"))
        host = str(values.pop("host"))
        slug = str(values.pop("slug"))
        cause_slug = str(values.pop("cause"))
        source = str(values.pop("source"))
        source_date = values.pop("source_date")
        assert isinstance(source_date, datetime)
        organisation = source_organisation(db, host, slug)
        starts_at = values["starts_at"]
        ends_at = values["ends_at"]
        assert isinstance(starts_at, datetime)
        assert isinstance(ends_at, datetime)
        default_minutes = round((ends_at - starts_at).total_seconds() / 60)
        time_commitment = values.pop("time_commitment_minutes", default_minutes)
        assert isinstance(time_commitment, int)
        qualifications = str(
            values.pop(
                "qualifications",
                "No prior qualifications listed; review the source before applying.",
            )
        )
        payload = {
            "organisation": organisation,
            "listing_source": source,
            "listing_source_url": url,
            "listing_verification_status": "verified",
            "source_updated_at": source_date,
            "source_checked_at": checked_at,
            "application_mode": "external",
            "external_application_url": url,
            "country_code": "CA",
            "location_visibility": "approximate",
            "time_commitment_minutes": time_commitment,
            "transportation_info": "Confirm travel and exact check-in details with the source organization.",
            "qualifications": qualifications,
            "safety_notes": "Follow the source organization’s onboarding and safety instructions.",
            "status": OpportunityStatus.published,
            **values,
        }
        event = db.scalar(select(Opportunity).where(Opportunity.listing_source_url == url))
        if event:
            for field, value in payload.items():
                setattr(event, field, value)
            event.causes = [causes[cause_slug]]
        else:
            db.add(Opportunity(causes=[causes[cause_slug]], **payload))
    db.commit()


def source_organisation(db: Session, name: str, slug: str) -> Organisation:
    """Create a deterministic read-only host for an externally sourced listing."""
    profile_id = uuid.uuid5(uuid.NAMESPACE_URL, f"https://givehub.local/source/{slug}")
    profile = db.get(Profile, profile_id)
    if profile and profile.organisation:
        return profile.organisation
    profile = Profile(
        id=profile_id,
        role=Role.organiser,
        display_name=name,
        email=f"source-{slug}@givehub.invalid",
        search_location_label="Greater Toronto Area",
        search_latitude=43.6532,
        search_longitude=-79.3832,
        search_radius_km=50,
    )
    organisation = Organisation(
        owner=profile,
        name=name,
        verification_status=VerificationStatus.approved,
        notify_new_applications=False,
    )
    db.add_all([profile, organisation])
    db.flush()
    return organisation


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
