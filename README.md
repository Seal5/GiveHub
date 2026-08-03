# GiveHub

GiveHub is a Greater Toronto Area volunteer discovery and coordination MVP. It helps people find, assess, and sign up for local opportunities while allowing organisations to publish listings and manage applicants. The product follows the hybrid model presented in MSE 401: aggregate public and organiser listings, standardise their details, personalise discovery, and support either GiveHub-hosted applications or verified external forms.

## Current status

As of 2 August 2026:

- The application code is merged into the repository's default `initial-skeleton` branch and CI is passing.
- A free Supabase PostgreSQL database is running in Canada Central with the latest Alembic migration (`0006_source_refresh`). Its initial dataset contains 30 published opportunities, 17 organisations, and 18 profiles.
- The source-refresh pipeline is installed as a nightly GitHub Actions workflow. New scraped records enter a review queue instead of being published automatically; the first hosted refresh produced 33 pending candidates.
- A public static demo is available at [alvaropran.github.io/givehub-demo](https://alvaropran.github.io/givehub-demo/). It runs in explicit demo mode, so its accounts and changes remain in that browser and do not use the hosted database.
- The FastAPI service is not publicly hosted yet. Until it is deployed and the web build is pointed at its URL, the public demo is not a shared production application.

The database is intentionally not exposed directly to clients. In connected mode, the Expo app talks to FastAPI, and FastAPI applies authorization and domain rules before reading or writing PostgreSQL.

## MSE 401 MVP promise

The prototype presentation committed to a tested hybrid discovery MVP, not a replacement for organisations' volunteer-management systems. Its core commitments are represented in the codebase:

1. **Aggregate listings** from public and organiser sources.
2. **Standardise details** such as schedule, location, tasks, accessibility, qualifications, screening, training, source, and verification.
3. **Personalise discovery** using distance, date, cause, commitment, accessibility, eligibility, training, and application-type filters.
4. **Route sign-up flexibly** through a GiveHub application or an organisation-controlled external form.
5. **Give volunteers control** with application status tracking and withdrawal.
6. **Improve trust** with source links, last-checked dates, verification state, and a review queue for scraped records.

Fair ranking across large and small organisations, production pilot outreach, and a hosted end-to-end deployment remain open MVP work.

## Implemented capabilities

### Volunteers

- Role-specific onboarding and account flows.
- GTA address search through the free Photon service, with optional Google Places support, plus foreground device location.
- Configurable 5-100 km travel radius.
- Search and filtering by location, date, cause, time commitment, accessibility, age/eligibility, training, screening, and internal or external application mode.
- Opportunity details containing schedules, tasks, transportation, qualifications, safety information, source, freshness, and verification.
- Saved opportunities and native sharing.
- Internal applications with personal notes, relevant experience, availability, waiver acceptance, status tracking, editing, and withdrawal.
- External applications that clearly identify and open the organisation-controlled destination without storing external form responses.
- Activities, attendance history, contributed hours, and impact summaries.

### Organisers

- Opportunity creation and editing with required/optional field labels and GTA address autocomplete.
- Draft and published listing states, capacity, waitlists, accessibility, screening, training, and application-mode controls.
- Applicant pipeline, status updates, applicant filtering, CSV export, and optional email notifications.
- Versioned waiver publishing and guardian-consent support for volunteers under 18.
- Event attendance and contributed-hours recording.
- Posting funnel analytics.

### Platform

- Public share pages with Open Graph metadata and app deep links.
- Source freshness checks, expiry handling, bounded public-source discovery, and a pending review queue.
- A social-tab prototype populated with demo activity. Social networking, messaging, and comments do not yet have a shared backend.
- WCAG-oriented labels, visible states, keyboard-operable web controls, and test coverage for core domain flows.

## Repository structure

- `apps/mobile` - Expo SDK 57, Expo Router, NativeWind, React Query, and Supabase Auth.
- `apps/api` - FastAPI, SQLAlchemy, Alembic, Supabase JWT verification, Storage integration, email, and source refresh.
- `.maestro` - volunteer and organiser device smoke journeys.
- `.github/workflows/ci.yml` - API, mobile, migration, generated-client, and container checks.
- `.github/workflows/source-refresh.yml` - nightly opportunity discovery and freshness checks.
- `docker-compose.yml` - local PostGIS and FastAPI services.

## Architecture

```text
Expo / React Native / Web
          |
          | HTTPS + Supabase JWT
          v
       FastAPI
       /     \
      v       v
PostgreSQL   Supabase Storage
 (Supabase)   + Auth
```

All domain reads and writes go through FastAPI. The mobile Supabase client is used for authentication only. FastAPI validates Supabase JWTs through JWKS and issues scoped Storage upload tokens for organiser-owned opportunities. Address autocomplete is proxied through FastAPI so a Google Places key, when used, is never shipped in the app. PostgreSQL uses PostGIS for radius filtering; local SQLite tests use a Haversine fallback. GiveHub requests foreground location only and does not track users in the background.

## Local setup

### Prerequisites

- Node.js 20.19.4 or newer
- pnpm 10.13.1
- Python 3.13 and [uv](https://docs.astral.sh/uv/)
- Docker Desktop for the connected local PostgreSQL setup

### Install and run

1. Copy `.env.example` to `.env` and `apps/mobile/.env.example` to `apps/mobile/.env`.
2. Add the same Supabase project URL and publishable key to both files. Keep the Supabase secret key in the API `.env` only.
3. Run `corepack enable` and `pnpm install` from the repository root.
4. Run `uv sync --group dev` from `apps/api`.
5. Start PostgreSQL and FastAPI with `docker compose up db api`.
6. Start Expo with `pnpm --filter @givehub/mobile start`.

### Runtime modes

GiveHub does not silently fall back to fixtures.

- **Static demo:** set `EXPO_PUBLIC_DEMO_MODE=true`. Data is stored only in the running browser/app session.
- **Persistent local development:** set `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_LOCAL_AUTH=true`, and `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`. This uses seeded development identities and stores domain data in the API database.
- **Connected authentication:** set both demo flags to `false`, configure Supabase values, and point `EXPO_PUBLIC_API_URL` at a running FastAPI service.

Local development identities are accepted only outside production:

- Volunteer: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000020`
- Organiser: `Authorization: Bearer dev:00000000-0000-4000-8000-000000000010`

### Physical devices

For Android over USB, set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`, then run:

```text
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
```

Install the development client once with `npx expo run:android --device` from `apps/mobile`. For later sessions, repeat the port forwarding and run `npx expo start --dev-client --localhost`.

For wireless development, use the computer's LAN address instead of `127.0.0.1`, start Expo with `--lan`, and keep both devices on the same network. Windows cannot create a local iOS build; use an EAS development or preview profile for a physical iPhone.

## Supabase

The hosted development database uses Supabase PostgreSQL in Canada Central. For another environment:

1. Create a Supabase project in a region close to the intended users.
2. Configure asymmetric JWT signing.
3. Set `DATABASE_URL` to a direct or session-pooler PostgreSQL URL and run `alembic upgrade head` from `apps/api`.
4. Create an `opportunity-images` bucket with a 10 MB object limit and JPEG, PNG, and WebP MIME types.
5. Put the publishable key in the client; keep the Supabase secret key and database URL on the API service only.

The free Supabase tier is appropriate for the MVP but can pause after inactivity and does not provide production-grade uptime or backups.

## Opportunity source refresh

External opportunities retain their original source and application link. The refresh job:

- checks supported source pages and unpublishes expired or missing one-off listings;
- discovers GTA opportunities from a bounded number of public result pages;
- stores incomplete discoveries in `source_candidates` with `pending` review status;
- skips protected sources such as Volunteer Toronto until an authorised feed is available;
- reports pending candidates in the GitHub Actions job summary.

Run it manually from `apps/api`:

```text
uv run python -m givehub.source_refresh
uv run python -m givehub.source_refresh --list-pending
```

The repository secret `GIVEHUB_DATABASE_URL` enables `.github/workflows/source-refresh.yml`. The workflow is scheduled for 10:15 UTC each day. Candidates must be reviewed before being promoted to complete, published opportunities.

## Email and optional services

Transactional email is optional in local development. Set `RESEND_API_KEY` and `EMAIL_FROM` to notify organisers about new applications and volunteers about status changes. Applications continue safely when email is unconfigured or temporarily unavailable.

Google Places is optional. Without `GOOGLE_PLACES_API_KEY`, address search uses the free Photon fallback restricted to the Greater Toronto Area.

## Deployment

### Current deployment state

- **Static web demo:** live on GitHub Pages in demo mode.
- **PostgreSQL:** live on Supabase Free.
- **FastAPI:** not yet publicly deployed.
- **Production authentication, Storage, email, and address-provider secrets:** not yet fully configured for the public web build.

`railway.json` can build `apps/api/Dockerfile`, run `alembic upgrade head`, and check `/ready`. A free Render web service is another suitable MVP host, but no public API host has been connected yet. After deploying FastAPI, rebuild the web app with `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_LOCAL_AUTH=false`, and `EXPO_PUBLIC_API_URL` set to the public HTTPS API URL.

EAS profiles include development, internal preview, and production builds for iOS and Android.

## Verification

Run the same core checks used by CI:

```text
pnpm --filter @givehub/mobile typecheck
pnpm --filter @givehub/mobile test
uv run ruff check .
uv run mypy givehub
uv run pytest
uv run alembic upgrade head
docker build -f apps/api/Dockerfile -t givehub-api .
```

The current suite contains 21 mobile tests and 41 API tests. CI also confirms that the generated OpenAPI client matches the FastAPI schema.

## Deferred and remaining work

- Publicly deploy FastAPI and rebuild the GitHub Pages app against it.
- Configure production Supabase Auth, Storage, email, and web CORS values.
- Add an organiser/admin interface for reviewing and promoting scraped candidates.
- Implement explicit fairness rotation so smaller organisations are not consistently outranked.
- Conduct and document pilot outreach with GTA organisations.
- Replace the demo-only social feed with a privacy-reviewed shared activity model, if it remains in scope.
- Configure production universal links, push notifications, app-store submission, monitoring, and backups.
- Update GitHub Actions dependencies that currently emit a Node 20 deprecation warning.

GiveHub does not provide legal advice. The default waiver is a starting point that organisations should have reviewed before relying on it.

## Universal links

Shared links use `EXPO_PUBLIC_SHARE_BASE_URL`, falling back to `EXPO_PUBLIC_API_URL`. The example `https://givehub.nz` value is a placeholder and is not the current public deployment domain. For production, point the variable at the selected app/marketing domain, route `/o/*` to FastAPI, match the domain in `app.json`, and serve the required Apple and Android association files from `/.well-known/`.
