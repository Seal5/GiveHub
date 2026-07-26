import base64
import logging
from dataclasses import dataclass

import httpx

from givehub.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Attachment:
    filename: str
    content: bytes
    content_type: str = "text/calendar"


def send_email(
    settings: Settings,
    *,
    recipient: str,
    subject: str,
    text: str,
    html: str | None = None,
    attachments: tuple[Attachment, ...] = (),
    reply_to: str | None = None,
) -> bool:
    """Send a transactional email when configured, without blocking the core workflow."""
    if not settings.resend_api_key:
        logger.info("Email skipped because RESEND_API_KEY is not configured: %s", subject)
        return False
    payload: dict[str, object] = {
        "from": settings.email_from,
        "to": [recipient],
        "subject": subject,
        "text": text,
    }
    if html:
        payload["html"] = html
    if reply_to:
        payload["reply_to"] = reply_to
    if attachments:
        payload["attachments"] = [
            {
                "filename": attachment.filename,
                "content": base64.b64encode(attachment.content).decode("ascii"),
                "content_type": attachment.content_type,
            }
            for attachment in attachments
        ]
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "authorization": f"Bearer {settings.resend_api_key}",
                "content-type": "application/json",
            },
            json=payload,
            timeout=8,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("GiveHub could not send transactional email")
        return False
    return True
