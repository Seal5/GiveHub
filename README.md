# GiveHub

GiveHub is a Wellington-focused volunteer discovery and coordination beta. It pairs an Expo/React Native mobile app with a FastAPI domain API and Supabase for PostgreSQL, authentication, and image storage. Volunteers can use their foreground location or search for an address, then choose a 5–100 km travel radius.

## Repository

- `apps/mobile` — Expo SDK 57, Expo Router, NativeWind, React Query, Supabase Auth.
- `apps/api` — FastAPI, SQLAlchemy, Alembic, Supabase JWT verification and Storage.
- `.maestro` — volunteer and organiser device smoke journeys.
- `.github/workflows/ci.yml` — API, mobile, migration, and container checks.

## Local setup

1. Copy `.env.example` to `.env` for the API and `apps/mobile/.env.example` to `apps/mobile/.env` for Expo. Add the same Supabase project values to both files. Add `GOOGLE_PLACES_API_KEY` only to the root API `.env`.
2. Enable pnpm with `corepack enable`, then run `pnpm install`.
3. Install [uv](https://docs.astral.sh/uv/) and run `uv sync --group dev` from `apps/api`.
4. Start PostgreSQL and the API with `docker compose up db api`, or run `uv run fastapi dev givehub/main.py` from `apps/api`.
5. Run `pnpm --filter @givehub/mobile start` and open an Expo development build.

Demo mode is explicit. Set `EXPO_PUBLIC_DEMO_MODE=true` in `apps/mobile/.env` only when you intentionally want in-memory fixtures. In normal connected development it must be `false`; missing API or Supabase values then produce a configuration error instead of silently switching to demo data.

### Physical Android device

1. Connect the phone by USB, enable Developer options and USB debugging, then confirm it appears under `adb devices`.
2. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the computer's LAN address, for example `http://192.168.1.100:8000`. A phone cannot reach the computer through `localhost`.
3. Start the connected API with `docker compose up db api`. The API container already listens on `0.0.0.0:8000`; allow port 8000 through Windows Firewall on private networks.
4. Install the development client once with `npx expo run:android --device` from `apps/mobile`.
5. For later sessions, run `npx expo start --dev-client --lan` from `apps/mobile` and open GiveHub on the phone.

On iPhone, Windows cannot create a local iOS build. Use the EAS `development` or `preview` profile and install the resulting internal build on the device.

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
