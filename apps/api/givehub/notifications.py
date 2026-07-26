"""Transactional email content.

Each builder returns a ready-to-send message so the API layer only has to decide
*when* to notify, not *what* the notification says.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from html import escape

from givehub.email import Attachment
from givehub.formatting import format_event_window, format_starts_at
from givehub.models import Application, ApplicationStatus, Opportunity

BRAND = "#2A8D58"


@dataclass(frozen=True)
class Message:
    subject: str
    text: str
    html: str
    attachments: tuple[Attachment, ...] = field(default=())
    reply_to: str | None = None


def _layout(*, heading: str, intro: str, rows: list[tuple[str, str]], outro: str, footer: str) -> str:
    row_html = "".join(
        f'<tr><td style="padding:6px 0;color:#657166;font-size:13px;width:38%;vertical-align:top">{escape(label)}</td>'
        f'<td style="padding:6px 0;color:#17221A;font-size:14px;font-weight:600">{escape(value)}</td></tr>'
        for label, value in rows
    )
    details = (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;'
        f'border-top:1px solid #E8E8E2;border-bottom:1px solid #E8E8E2">{row_html}</table>'
        if rows
        else ""
    )
    return f"""<!doctype html>
<html><body style="margin:0;background:#F6F6F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F6F6F0;padding:28px 12px">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFEFA;border:1px solid #E8E8E2;border-radius:16px;overflow:hidden">
<tr><td style="padding:22px 24px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><div style="width:26px;height:26px;border-radius:8px;background:{BRAND}"></div></td>
    <td style="padding-left:10px;font-size:17px;font-weight:700;color:#17221A">GiveHub</td>
  </tr></table>
</td></tr>
<tr><td style="padding:20px 24px 26px">
  <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#17221A">{escape(heading)}</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#3C4A40">{escape(intro)}</p>
  {details}
  <p style="margin:0;font-size:15px;line-height:1.6;color:#3C4A40">{escape(outro)}</p>
</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#657166;text-align:center">{escape(footer)}</p>
</td></tr></table>
</body></html>"""


def _text(*, heading: str, intro: str, rows: list[tuple[str, str]], outro: str, footer: str) -> str:
    lines = [heading, "", intro]
    if rows:
        lines.append("")
        lines.extend(f"{label}: {value}" for label, value in rows)
    lines.extend(["", outro, "", footer])
    return "\n".join(lines)


def _ics_timestamp(value: datetime) -> str:
    aware = value if value.tzinfo else value.replace(tzinfo=UTC)
    return aware.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _ics_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", r"\;").replace(",", r"\,").replace("\n", r"\n")


def calendar_invite(opportunity: Opportunity) -> Attachment:
    """A minimal VEVENT so a confirmed volunteer can add the shift to their calendar."""
    location = ", ".join(part for part in (opportunity.meeting_point, opportunity.location_label) if part)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GiveHub//Volunteer//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{opportunity.id}@givehub.nz",
        f"DTSTAMP:{_ics_timestamp(datetime.now(UTC))}",
        f"DTSTART:{_ics_timestamp(opportunity.starts_at)}",
        f"DTEND:{_ics_timestamp(opportunity.ends_at)}",
        f"SUMMARY:{_ics_escape(opportunity.title)}",
        f"DESCRIPTION:{_ics_escape(opportunity.impact_statement)}",
        f"LOCATION:{_ics_escape(location)}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return Attachment(
        filename="givehub-event.ics",
        # CRLF line endings keep strict calendar clients happy.
        content="\r\n".join(lines).encode("utf-8"),
        content_type="text/calendar",
    )


def _event_rows(opportunity: Opportunity) -> list[tuple[str, str]]:
    return [
        ("When", format_event_window(opportunity.starts_at, opportunity.ends_at)),
        ("Meeting point", opportunity.meeting_point),
        ("Address", opportunity.location_label),
        ("Bring", opportunity.safety_notes),
    ]


def application_received_for_organiser(application: Application) -> Message:
    opportunity = application.opportunity
    heading = f"{application.volunteer.display_name} applied to help"
    intro = f"A new application is waiting for review on {opportunity.title}."
    rows = [
        ("Volunteer", application.volunteer.display_name),
        ("Email", application.volunteer.email),
        ("Availability", application.availability),
        ("When", format_event_window(opportunity.starts_at, opportunity.ends_at)),
    ]
    outro = "Open GiveHub to review the application, or export the applicant list for your team."
    footer = "You are receiving this because you host opportunities on GiveHub."
    return Message(
        subject=f"New GiveHub application: {opportunity.title}",
        text=_text(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        html=_layout(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        reply_to=application.volunteer.email,
    )


def application_received_for_volunteer(application: Application) -> Message:
    """The volunteer previously got nothing until a decision was made."""
    opportunity = application.opportunity
    heading = "Your application is in"
    intro = (
        f"Thanks for applying to {opportunity.title} with {opportunity.organisation.name}. "
        "The host reviews every application, and we will email you as soon as they decide."
    )
    rows = _event_rows(opportunity)
    outro = "You can withdraw at any time from My activities in the GiveHub app."
    footer = "You are receiving this because you applied for a volunteer opportunity on GiveHub."
    return Message(
        subject=f"Application received: {opportunity.title}",
        text=_text(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        html=_layout(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        reply_to=opportunity.organisation.owner.email,
    )


_STATUS_COPY: dict[ApplicationStatus, tuple[str, str]] = {
    ApplicationStatus.confirmed: (
        "You’re confirmed",
        "Your place is booked. Everything you need for the day is below, and a calendar invite is attached.",
    ),
    ApplicationStatus.under_review: (
        "Your application is under review",
        "The host is considering your application and will be in touch with a decision soon.",
    ),
    ApplicationStatus.waitlisted: (
        "You’re on the waitlist",
        "This activity is full for now. If a place frees up you will be the first to know, so keep the date free if you can.",
    ),
    ApplicationStatus.declined: (
        "About your application",
        "The host could not offer you a place this time. Plenty of other activities near you still need hands.",
    ),
}


def application_status_changed(application: Application) -> Message:
    opportunity = application.opportunity
    heading, intro = _STATUS_COPY.get(
        application.status,
        ("Your application was updated", f"Your application status is now {application.status.value.replace('_', ' ')}."),
    )
    confirmed = application.status == ApplicationStatus.confirmed
    rows = _event_rows(opportunity) if confirmed else [
        ("Activity", opportunity.title),
        ("Host", opportunity.organisation.name),
        ("When", format_starts_at(opportunity.starts_at)),
    ]
    if confirmed:
        rows.append(("Host contact", opportunity.organisation.owner.email))
    outro = (
        "Reply to this email to reach the host directly if anything changes."
        if confirmed
        else "Open GiveHub to see this and every other application in one place."
    )
    footer = "You are receiving this because you applied for a volunteer opportunity on GiveHub."
    return Message(
        subject=f"{opportunity.title}: {heading.lower()}",
        text=_text(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        html=_layout(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        attachments=(calendar_invite(opportunity),) if confirmed else (),
        reply_to=opportunity.organisation.owner.email,
    )


def guardian_consent_copy(application: Application, waiver_title: str, waiver_version: int) -> Message:
    """Sent to the guardian named on a minor's waiver so consent is recorded on both sides."""
    opportunity = application.opportunity
    acceptance = application.waiver_acceptance
    assert acceptance is not None
    heading = "A volunteer agreement was signed in your name"
    intro = (
        f"{application.volunteer.display_name} applied to volunteer at {opportunity.title} with "
        f"{opportunity.organisation.name}, and recorded you as their parent or guardian."
    )
    rows = [
        ("Volunteer", application.volunteer.display_name),
        ("Activity", opportunity.title),
        ("When", format_event_window(opportunity.starts_at, opportunity.ends_at)),
        ("Meeting point", opportunity.meeting_point),
        ("Agreement", f"{waiver_title} (version {waiver_version})"),
        ("Signed", format_starts_at(acceptance.accepted_at)),
    ]
    outro = (
        "If you did not agree to this, reply to this email straight away and the host will withdraw "
        "the application."
    )
    footer = "You are receiving this because you were named as a guardian on a GiveHub application."
    return Message(
        subject=f"Guardian consent recorded: {opportunity.title}",
        text=_text(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        html=_layout(heading=heading, intro=intro, rows=rows, outro=outro, footer=footer),
        reply_to=opportunity.organisation.owner.email,
    )
