import logging

import httpx

from givehub.config import Settings

logger = logging.getLogger(__name__)


def send_email(
    settings: Settings,
    *,
    recipient: str,
    subject: str,
    text: str,
) -> bool:
    """Send a transactional email when configured, without blocking the core workflow."""
    if not settings.resend_api_key:
        logger.info("Email skipped because RESEND_API_KEY is not configured: %s", subject)
        return False
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "authorization": f"Bearer {settings.resend_api_key}",
                "content-type": "application/json",
            },
            json={
                "from": settings.email_from,
                "to": [recipient],
                "subject": subject,
                "text": text,
            },
            timeout=8,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("GiveHub could not send transactional email")
        return False
    return True
