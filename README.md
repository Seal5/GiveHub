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

For a persistent local demo without Supabase Auth, set
`EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_LOCAL_AUTH=true`, and point
`EXPO_PUBLIC_API_URL` at the local FastAPI server. This uses the seeded
development identities while storing all domain data in the configured API
database. Local authentication is rejected by production deployments.

### Physical Android device

1. Connect the phone by USB, enable Developer options and USB debugging, then confirm it appears under `adb devices`.
2. Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` in `apps/mobile/.env` and start the connected API with `docker compose up db api`.
3. Forward the development ports over USB with `adb reverse tcp:8000 tcp:8000` and `adb reverse tcp:8081 tcp:8081`.
4. Install the development client once with `npx expo run:android --device` from `apps/mobile`.
5. For later sessions, repeat the two `adb reverse` commands, run `npx expo start --dev-client --localhost`, and open GiveHub on the phone.

For wireless development instead, set `EXPO_PUBLIC_API_URL` to the computer's LAN address (for example `http://192.168.1.100:8000`), start Expo with `--lan`, keep both devices on the same network, and allow ports 8000 and 8081 through Windows Firewall.

On iPhone, Windows cannot create a local iOS build. Use the EAS `development` or `preview` profile and install the resulting internal build on the device.

Expo SDK 57 requires Node.js 20.19.4 or newer. The checked workspace used an older Node 20 patch for static checks, so upgrade Node before starting Metro or producing EAS builds.

Demo API identities are accepted only outside production:

- Volunteer: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000020`
- Organiser: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000010`

Transactional email is optional in local development. Set `RESEND_API_KEY` and
`EMAIL_FROM` in the API `.env` to notify organisers about new applications and
volunteers about status changes. Applications continue safely when email is not
configured or the provider is temporarily unavailable.

## Supabase

Create a project in a region appropriate for New Zealand users and configure asymmetric JWT signing. Apply the Alembic migration using the Supabase direct database URL. Create a public `opportunity-images` bucket with a 10 MB limit and JPEG, PNG, and WebP MIME types. The API secret key must only exist on the API service; the mobile app receives the publishable key.

All domain reads and writes go through FastAPI. The mobile Supabase client is used only for authentication. FastAPI validates Supabase JWTs through JWKS and issues scoped Storage upload tokens for organiser-owned opportunities. Address autocomplete is proxied through FastAPI so the Places key is never shipped in the app. Opportunity radius filtering uses PostGIS in PostgreSQL and a Haversine fallback in local SQLite tests. GiveHub asks only for foreground location permission and does not track background location.

## Opportunity source refresh

External opportunities retain their original source link. The nightly refresh command:

- checks supported public source pages and unpublishes expired or missing one-off listings;
- discovers GTA opportunities from a bounded number of Volunteer Success result pages;
- stores new discoveries in `source_candidates` with `pending` review status instead of publishing incomplete scraped data;
- skips protected sources such as Volunteer Toronto until an authorized feed is available.

Run it locally with `cd apps/api && uv run python -m givehub.source_refresh`. Use `uv run python -m givehub.source_refresh --list-pending` for the weekly review list. In GitHub, add the production database connection as the `GIVEHUB_DATABASE_URL` repository secret to enable the scheduled workflow. Review pending candidates weekly before promoting them to complete opportunities.

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

The beta includes role-specific onboarding, address/current-location preferences,
5–100 km discovery filtering, saves, review-required applications, volunteer
status tracking, organiser opportunity publishing, per-event pipelines, applicant
filtering and CSV export, posting funnel analytics, transactional email, waitlists,
and capacity enforcement.

It also includes:

- **Signed waivers.** Versioned agreements with a per-application acceptance record
  (typed signature, timestamp, waiver version, originating IP) and guardian consent
  for volunteers under 18. Editing publishes a new version so past acceptances stay
  tied to the wording actually signed. Organisers publish their own text at
  `PUT /v1/organiser/waiver`; otherwise the GiveHub default applies.
- **Shareable links.** `GET /o/<id>` serves a public Open Graph landing page that
  deep links into the app, so a shared opportunity previews correctly in messaging
  apps and still works for someone without GiveHub installed.
- **Attendance and volunteer impact.** Organisers mark confirmed volunteers off on
  the day, which credits hours to that volunteer's own impact record
  (`GET /v1/volunteers/me/impact`).

Social features, messaging, push notifications, comments, and store submission are
intentionally deferred.

GiveHub does not provide legal advice. The default waiver is a starting point that
organisations should have reviewed before relying on it.

### Universal links

Shared links use `EXPO_PUBLIC_SHARE_BASE_URL`, falling back to `EXPO_PUBLIC_API_URL`
so links work without a marketing domain. To make `https://` links open the app
directly, point that variable at the domain configured in `app.json`
(`ios.associatedDomains` and `android.intentFilters`), route its `/o/*` path to the
API, and serve `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` from it.
