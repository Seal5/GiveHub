import calendar
from datetime import date
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from givehub.formatting import as_utc
from givehub.models import Opportunity, Recurrence


def session_date_for(item: Opportunity, selected: date | None) -> date:
    first = as_utc(item.starts_at).astimezone(ZoneInfo("America/Toronto")).date()
    selected = selected or first
    if selected < first:
        raise HTTPException(422, "Session date cannot precede the first event")
    if item.recurrence == Recurrence.one_off and selected != first:
        raise HTTPException(422, "This opportunity has only one session")
    if item.recurrence == Recurrence.weekly and (selected - first).days % 7:
        raise HTTPException(422, "Choose a date on this opportunity's weekly schedule")
    if item.recurrence == Recurrence.monthly and selected.day != min(
        first.day, calendar.monthrange(selected.year, selected.month)[1]
    ):
        raise HTTPException(422, "Choose a date on this opportunity's monthly schedule")
    return selected
