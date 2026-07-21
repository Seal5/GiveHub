# GiveHub

GiveHub is a Wellington-focused volunteer discovery and coordination beta. It pairs an Expo/React Native mobile app with a FastAPI domain API and Supabase for PostgreSQL, authentication, and image storage. Volunteers can use their foreground location or search for an address, then choose a 5–100 km travel radius.

## Repository

- `apps/mobile` — Expo SDK 57, Expo Router, NativeWind, React Query, Supabase Auth.
- `apps/api` — FastAPI, SQLAlchemy, Alembic, Supabase JWT verification and Storage.
- `.maestro` — volunteer and organiser device smoke journeys.
- `.github/workflows/ci.yml` — API, mobile, migration, and container checks.

## Local setup

1. Copy `.env.example` to `.env` and add Supabase values when available. Add a server-side `GOOGLE_PLACES_API_KEY` to enable connected address autocomplete. With no `EXPO_PUBLIC_API_URL`, the mobile app intentionally runs against its in-memory demo adapter and uses bundled location suggestions.
2. Enable pnpm with `corepack enable`, then run `pnpm install`.
3. Install [uv](https://docs.astral.sh/uv/) and run `uv sync --group dev` from `apps/api`.
4. Start PostgreSQL and the API with `docker compose up db api`, or run `uv run fastapi dev givehub/main.py` from `apps/api`.
5. Run `pnpm --filter @givehub/mobile start` and open an Expo development build.

Expo SDK 57 requires Node.js 20.19.4 or newer. The checked workspace used an older Node 20 patch for static checks, so upgrade Node before starting Metro or producing EAS builds.

Demo API identities are accepted only outside production:

- Volunteer: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000020`
- Organiser: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000010`

## Supabase

Create a project in a region appropriate for New Zealand users and configure asymmetric JWT signing. Apply the Alembic migration using the Supabase direct database URL. Create a public `opportunity-images` bucket with a 10 MB limit and JPEG, PNG, and WebP MIME types. The API secret key must only exist on the API service; the mobile app receives the publishable key.

All domain reads and writes go through FastAPI. The mobile Supabase client is used only for authentication. FastAPI validates Supabase JWTs through JWKS and issues scoped Storage upload tokens for organiser-owned opportunities. Address autocomplete is proxied through FastAPI so the Places key is never shipped in the app. Opportunity radius filtering uses PostGIS in PostgreSQL and a Haversine fallback in local SQLite tests. GiveHub asks only for foreground location permission and does not track background location.

## Deployment

- Railway builds `apps/api/Dockerfile`, runs `alembic upgrade head`, and checks `/ready`.
- EAS profiles include development, internal preview, and production builds for iOS and Android.
- Required production variables are listed in `.env.example`; secrets must not be committed.

Before a preview release, run:

```text
pnpm --filter @givehub/mobile typecheck
pnpm --filter @givehub/mobile test
uv run ruff check .
uv run mypy givehub
uv run pytest
docker build -f apps/api/Dockerfile -t givehub-api .
```

## Scope

The beta includes role-specific onboarding, address/current-location preferences, 5–100 km discovery filtering, saves, review-required applications, volunteer status tracking, organiser opportunity publishing, per-event pipelines, waitlists, and capacity enforcement. Social features, messaging, attendance, push notifications, comments, and store submission are intentionally deferred.
