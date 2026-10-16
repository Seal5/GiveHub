"""Development-only community fixtures, created once rather than reset on startup."""
import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from givehub.community_models import Gathering
from givehub.seed import DEMO_ORGANISER_ID


def seed_community(db: Session) -> None:
    samples = [
        ("community-supper", "Good food. Better company.", "citrus", "A community supper for the people making Toronto a little better. Bring a story, meet your neighbours, and share a meal after a week of giving back.\n\nWe’ll take care of dinner. You bring yourself. Please tell us about any dietary needs when you RSVP.", "Community kitchen · 124 Ossington Avenue, Toronto", 7, 24),
        ("community-picnic", "A little green. A lot of good.", "moss", "Let’s turn a Sunday in the park into something good. A short neighbourhood cleanup, then a very unhurried picnic.\n\nBring a snack to share, a reusable bottle, and a blanket. Friends and first-timers are welcome. This is a social gathering; volunteer hours are recorded separately through opportunities.", "Trinity Bellwoods Park · meet by the white gates", 10, 40),
        ("community-welcome", "New faces, familiar purpose.", "rose", "An easygoing evening for anyone curious about volunteering. Meet local hosts, swap ideas, and find your people.\n\nNo experience needed. Come as you are, leave with a few new connections.", "GiveHub community space · Downtown Toronto", 14, None),
    ]
    for slug, title, theme, description, location, days, capacity in samples:
        event_id = uuid.uuid5(uuid.NAMESPACE_URL, f"https://givehub.local/{slug}")
        if db.get(Gathering, event_id):
            continue
        start = (datetime.now(UTC).astimezone(ZoneInfo("America/Toronto")) + timedelta(days=days)).replace(hour=18, minute=0, second=0, microsecond=0)
        db.add(Gathering(id=event_id, host_id=DEMO_ORGANISER_ID, status="published", starts_at=start.astimezone(UTC), ends_at=(start + timedelta(hours=3)).astimezone(UTC), data={
            "title": title, "description": description, "location": location, "timezone": "America/Toronto",
            "starts_local": start.strftime("%Y-%m-%dT%H:%M"), "ends_local": (start + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M"),
            "theme": theme, "cover_url": "", "capacity": capacity, "max_plus_ones": 1, "approval_required": False,
            "guest_list_visible": True, "address_after_rsvp": False, "listed": True, "reminder_enabled": True,
            "questions": [{"id": "diet", "label": "Any dietary needs we should know about?", "required": False}],
        }))
    db.commit()
