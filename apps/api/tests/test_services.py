
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from givehub.models import Application, ApplicationStatus, Opportunity, Profile, Role
from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID
from givehub.services import change_application_status, haversine_km


def test_haversine_between_wellington_suburbs(db: Session) -> None:
    volunteer = db.get(Profile, DEMO_VOLUNTEER_ID)
    assert volunteer and volunteer.suburb
    karori = db.query(Opportunity).filter(Opportunity.title.ilike("%Karori%")).one().suburb
    distance = haversine_km(volunteer.suburb, karori)
    assert 3 < distance < 6


def test_capacity_prevents_extra_confirmation(db: Session) -> None:
    opportunity = db.query(Opportunity).first()
    assert opportunity
    opportunity.capacity = 1
    volunteer = db.get(Profile, DEMO_VOLUNTEER_ID)
    assert volunteer
    first = Application(
        opportunity=opportunity,
        volunteer=volunteer,
        note="First valid application note.",
        status=ApplicationStatus.confirmed,
    )
    other = Profile(
        id=__import__("uuid").uuid4(),
        role=Role.volunteer,
        display_name="Another volunteer",
        email="another@example.com",
    )
    second = Application(
        opportunity=opportunity,
        volunteer=other,
        note="Second valid application note.",
    )
    db.add_all([first, other, second])
    db.commit()
    with pytest.raises(HTTPException) as caught:
        change_application_status(
            db, second, ApplicationStatus.confirmed, DEMO_ORGANISER_ID, second.version
        )
    assert caught.value.status_code == 409

