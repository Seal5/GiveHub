"""Public share landing pages.

A shared GiveHub link has to work for someone who does not have the app yet, so
these routes are unauthenticated and return a small HTML page with Open Graph
metadata for the messaging app preview plus a deep link into the native app.
"""

import uuid
from html import escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from givehub.config import Settings, get_settings
from givehub.database import get_db
from givehub.formatting import format_starts_at
from givehub.models import Opportunity, OpportunityStatus
from givehub.services import opportunity_query

router = APIRouter(include_in_schema=False)

APP_SCHEME = "givehub"


def _page(*, title: str, description: str, image_url: str | None, deep_link: str, heading: str, body: str, meta_line: str = "") -> str:
    safe_title = escape(title)
    safe_description = escape(description)
    image_tag = f'<meta property="og:image" content="{escape(image_url)}" />' if image_url else ""
    hero = f'<img class="hero" src="{escape(image_url)}" alt="" />' if image_url else ""
    meta_html = f'<p class="meta">{escape(meta_line)}</p>' if meta_line else ""
    return f"""<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{safe_title} · GiveHub</title>
<meta name="description" content="{safe_description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="GiveHub" />
<meta property="og:title" content="{safe_title}" />
<meta property="og:description" content="{safe_description}" />
{image_tag}
<meta name="twitter:card" content="summary_large_image" />
<style>
  :root {{ color-scheme: light dark; --bg:#F6F6F0; --fg:#17221A; --muted:#657166; --card:#FFFEFA; --border:#E8E8E2; --primary:#2A8D58; --on-primary:#F8FFF8; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg:#101A14; --fg:#EDF4EC; --muted:#9BAC9F; --card:#17241C; --border:#2B372F; --primary:#8BD19F; --on-primary:#0C1810; }} }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.5; }}
  .wrap {{ max-width:34rem; margin:0 auto; padding:2rem 1.25rem 3rem; }}
  .brand {{ display:flex; align-items:center; gap:.6rem; font-weight:700; margin-bottom:1.75rem; }}
  .dot {{ width:1.75rem; height:1.75rem; border-radius:.55rem; background:var(--primary); }}
  .card {{ background:var(--card); border:1px solid var(--border); border-radius:1rem; overflow:hidden; }}
  .hero {{ width:100%; height:13rem; object-fit:cover; display:block; }}
  .card-body {{ padding:1.25rem; }}
  h1 {{ font-size:1.6rem; line-height:1.25; margin:0 0 .6rem; letter-spacing:-.02em; }}
  p {{ margin:0 0 .75rem; }}
  .meta {{ color:var(--muted); font-size:.9rem; }}
  .cta {{ display:block; margin-top:1.5rem; padding:.95rem 1.25rem; border-radius:.85rem; background:var(--primary); color:var(--on-primary); text-align:center; text-decoration:none; font-weight:700; }}
  .note {{ margin-top:1rem; text-align:center; color:var(--muted); font-size:.85rem; }}
</style>
</head>
<body>
  <main class="wrap">
    <div class="brand"><span class="dot"></span><span>GiveHub</span></div>
    <article class="card">
      {hero}
      <div class="card-body">
        <h1>{escape(heading)}</h1>
        {meta_html}
        <p>{escape(body)}</p>
      </div>
    </article>
    <a class="cta" href="{escape(deep_link)}">Open in GiveHub</a>
    <p class="note">Don’t have GiveHub yet? Install the app, then open this link again.</p>
  </main>
</body>
</html>"""


@router.get("/o/{opportunity_id}", response_class=HTMLResponse)
def opportunity_share_page(
    opportunity_id: uuid.UUID,
    db: Session = Depends(get_db),
    _settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    item = db.scalar(opportunity_query().where(Opportunity.id == opportunity_id))
    if item is None or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    return HTMLResponse(
        _page(
            title=item.title,
            description=item.impact_statement,
            image_url=item.image_url,
            deep_link=f"{APP_SCHEME}://opportunity/{item.id}",
            heading=item.title,
            body=item.impact_statement,
            meta_line=f"{item.organisation.name} · {format_starts_at(item.starts_at)} · {item.location_label}",
        )
    )
