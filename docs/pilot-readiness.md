# Pilot readiness implementation

This branch implements the repository-side refinements identified in the report review. The public production API, real Supabase/email configuration, team policy choices, and user/device validation remain release gates.

## Implemented behavior

- Browser authentication uses Supabase browser storage; native authentication retains SecureStore. Account changes clear cached private data.
- Static-demo sharing uses the browser origin and `EXPO_PUBLIC_WEB_BASE_URL`; connected sharing uses the API's public landing page. The landing page offers both `givehub://o/<id>` and a browser fallback configured with `PUBLIC_WEB_URL`. Shared destinations survive a browser reload during sign-in for up to one hour.
- Organizer web screens expand to 1280 pixels. The applicant pipeline shows a filterable table beside the selected applicant's details and status decisions. Attendance remains compact for field use.
- New organizer registrations are pending. Configured reviewers can approve/reject hosts with a decision note; self-approval is forbidden. Rejection unpublishes the host's listings. Pending hosts can save drafts.
- Reviewers maintain permission references and enabled states for the supported source hosts. Production source refresh skips a host without an enabled permission record. Development retains fixture-friendly defaults unless an explicit policy disables a source. Source redirects are not followed automatically.
- A successful source response updates freshness without granting human verification. Imported drafts expose unknown schedule, location, capacity, age, eligibility and safety fields as empty inputs; an authorized reviewer must supply and explicitly confirm them before publication.
- Preference reasons appear on Home cards and Discover. The demo uses Toronto availability time, transportation scoring, and comparable-host rotation, matching the API's approach. Lower-fit alternatives remain visible.
- Attendance accepts `session_date`. Weekly dates follow seven-day intervals; monthly dates use the original day or the final day of a shorter month. First-session attendance keeps existing records; additional sessions retain independent hours and contribute to impact totals. Cancellation/rescheduling exceptions are outside this cadence model.
- Both roles can update their display name, export their own records, request account removal, and cancel a pending removal. Reviewers complete requests. Production removal also deletes the Supabase Auth account; it fails without configured administration or if the provider cannot be reached. Identity tombstones and nonpersonal workflow history remain to preserve references; personal application, waiver, attendance, save and reporting records are removed/anonymized.
- Retention removes personal details and waiver/attendance records from declined or withdrawn applications older than an explicitly chosen period. It defaults to a dry run and does not choose the team's policy on its behalf. Active/confirmed records, backups, object storage, service logs and exported spreadsheets require separate policy/operational handling.
- The social screen clearly labels sample activity as a prototype.

## Migration and review

Run `uv sync --locked --group dev`, then `uv run alembic upgrade head` from `apps/api`.

Migration `0011_pilot_readiness` adds review/lifecycle state and source permission records. **Legacy automatically approved organizations return to pending, and their published listings are unpublished.** Records are preserved; reviewers must approve hosts and organizers must republish listings. Existing external listings return to pending verification. Previously imported drafts receive confirmation requirements. Migration `0012_attendance_sessions` adds records for additional recurring dates without deleting first-session attendance.

Back up the pilot database before upgrading. The migration path has been exercised on fresh SQLite and the previous `0010` SQLite schema; hosted PostgreSQL needs staging verification before release.

In production, set `SOURCE_REVIEWER_EMAILS` to the verified addresses of at least two responsible reviewers. Reviewer accounts are organizer accounts with these extra permissions, not a new role. Another reviewer must approve each reviewer organization. Never configure production with development bearer identities.

## Connected deployment

Use a deployed HTTPS API and a separately hosted HTTPS Expo web app:

| API configuration | Purpose |
| --- | --- |
| `APP_ENV=production` | Disables development identities and startup fixture seeding |
| `DATABASE_URL` | PostgreSQL/PostGIS; apply migrations during release |
| `SUPABASE_URL` | Auth issuer/JWKS |
| `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Server integrations and account removal; secret stays server-side |
| `SUPABASE_STORAGE_BUCKET` | Scoped image uploads |
| `CORS_ORIGINS` | Web origins; comma-separated or JSON array |
| `PUBLIC_WEB_URL` | Web app origin that serves `/o/<id>` |
| `SOURCE_REVIEWER_EMAILS` | Reviewer addresses; comma-separated or JSON array |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verified transactional-email sender |

Build the client with `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_LOCAL_AUTH=false`, the public `EXPO_PUBLIC_API_URL`, and real Supabase publishable settings. Leave `EXPO_PUBLIC_SHARE_BASE_URL` blank to use the API landing pages, or set an actual domain serving those pages. Deploy the SPA with deep-route fallback. The Docker image installs the committed API lockfile; Railway's configuration already applies migrations and checks `/ready`.

For GitHub Pages backup demos, use `EXPO_PUBLIC_DEMO_MODE=true`, `EXPO_PUBLIC_LOCAL_AUTH=false`, `EXPO_PUBLIC_WEB_BASE_URL=/givehub-demo`, and blank API/share settings. Run `bash scripts/export-demo.sh <output-directory>` to generate the export, a matching SPA `404.html` and `.nojekyll`. Replace all exported assets together. That demo remains session-only and does not approve real hosts or close real accounts.

## Retention and operations

After the team approves a retention period:

```sh
uv run python -m givehub.lifecycle --days <approved-days>
uv run python -m givehub.lifecycle --days <approved-days> --apply
```

The repository's daily `data-retention.yml` workflow runs only when `GIVEHUB_DATABASE_URL` and the repository variable `GIVEHUB_RETENTION_DAYS` are configured. Review a dry-run result before enabling it. This workspace has not enabled a live retention job or removed production data.

Assign owners for monitoring, failed email/source refreshes, deletion requests, backups/restore checks, source permissions, and incident handling. If a listing is reported unsafe, reviewers can unpublish it while investigating. For an incident, limit affected access, preserve necessary evidence, identify affected records and recipients, and follow the team's approved response/notification procedure. Confirm these procedures with the responsible team before a real pilot.

## Validation boundaries

Automated API/client checks, strict typing, migrations, generated-client verification, web export, and Chromium walkthroughs support the implementation. They do not certify privacy compliance, accessibility, guardian authorization, production security/load, or adoption. Native-device, Safari/Firefox, real Postgres concurrency, production email/recovery and stakeholder pilot checks remain required.

Deferred features remain deferred: real social networking, LLM-assisted review, recommendation subscriptions/push, guests/walk-ins and corporate requests. Guardian fields and notification copies do not independently authenticate guardian consent.
