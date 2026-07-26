"""Shared human-readable formatting for share pages and transactional email."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

NZ = ZoneInfo("Pacific/Auckland")

_DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def as_utc(value: datetime) -> datetime:
    """Interprets naive timestamps as UTC, matching how the database stores them."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _as_nz(value: datetime) -> datetime:
    return as_utc(value).astimezone(NZ)


def _clock(value: datetime) -> str:
    hour = value.hour % 12 or 12
    suffix = "am" if value.hour < 12 else "pm"
    return f"{hour}:{value.minute:02d}{suffix}"


def format_starts_at(value: datetime) -> str:
    """e.g. "Sat 2 Aug, 9:30am" in New Zealand local time."""
    local = _as_nz(value)
    return f"{_DAYS[local.weekday()]} {local.day} {_MONTHS[local.month - 1]}, {_clock(local)}"


def format_event_window(starts_at: datetime, ends_at: datetime) -> str:
    """e.g. "Sat 2 Aug, 9:30am – 12:30pm" collapsing the date when it does not change."""
    start_local = _as_nz(starts_at)
    end_local = _as_nz(ends_at)
    if start_local.date() == end_local.date():
        return f"{format_starts_at(starts_at)} – {_clock(end_local)}"
    return f"{format_starts_at(starts_at)} – {format_starts_at(ends_at)}"
