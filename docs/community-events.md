# Community events in GiveHub

Community events add invitations and RSVP coordination to GiveHub's existing Expo client and FastAPI service. Organizers use their existing accounts and approval status. Volunteers discover events in **Community** and see account-linked responses in **Activities**. Guests can open `/g/<id>` and RSVP without a GiveHub account.

This replaces the volunteer Social screen's sample activity with database-backed community events. Volunteer applications, agreements, attendance and impact totals remain separate workflows; an RSVP alone does not award volunteer hours.

Community screens use a single phone-width column, including in wide browser previews. Invitations have a persistent bottom RSVP action that jumps to the response form; the plan and guest list follow the form. Creation/editing uses three short steps (details, style, guests) with bottom navigation. Host guest details and decisions open in a sheet. Cards, type and host counts are sized for phone screens, with horizontal guest filters and no desktop side panes.

## Included

- Organizer **Events** tab, Home entry points and volunteer **Community** tab.
- Draft creation, editing, publication, cancellation and optimistic version checks.
- Four invitation themes, optional cover upload, date/time with explicit IANA timezone, description and location.
- Listed and unlisted invitations, public share landing pages, native deep routes and calendar downloads.
- Going/Maybe/Can't go responses, additional guests, capacity, approval, a FIFO waitlist, private host questions and CSV export.
- Guest editing through a random private capability saved in browser storage or native SecureStore. The database stores only its hash. A guest can copy the private edit link; the fragment is removed from browser history on entry and is never sent in the URL to the API. Anyone holding that private link can edit that RSVP.
- Account-linked RSVPs when responding while signed into GiveHub. A different email alone cannot claim or edit an existing response.
- Guest-list visibility and location disclosure after confirmation, enforced by API serializers as well as the UI.
- Host announcements on the invitation, opt-in email jobs, 24-hour reminders, local delivery previews and cancellation of pending jobs when plans change.
- Account export includes the member's own RSVP data without edit hashes. Account removal deletes linked guest records and delivery jobs, cancels hosted events, clears hosted announcements, and removes event details.

Capacity includes plus-ones. When a confirmed party leaves, the earliest waiting party is promoted if its whole party fits. Smaller parties do not skip an earlier party. A host cannot force a Maybe/Can't go guest into Going.

## Run and deploy

Apply the additive migration before releasing the API:

```bash
cd apps/api
uv sync --locked --group dev
uv run alembic upgrade head
```

The schema head is `0013_community_events`. Existing opportunities and applications are preserved. New organizers can save community drafts but must be approved before publication. Rejecting an organizer hides their published community events and cancels queued deliveries.

Use the existing API/web configuration from [pilot-readiness.md](pilot-readiness.md). `PUBLIC_WEB_URL` must be the web app's public origin for browser fallback links; `EXPO_PUBLIC_SHARE_BASE_URL` defaults to the API landing-page origin. Static exports must serve `/g/<id>` through SPA fallback. Community functions require a connected API: the isolated GitHub Pages demo explains this requirement instead of simulating shared guest data.

`COMMUNITY_UPLOAD_DIR` defaults to `apps/api/data/community-covers` when running from `apps/api`. Mount it on persistent storage and include it in backups. Cover uploads accept JPG, PNG and WebP up to 3 MB. For multiple API instances, use shared persistent storage or adapt this endpoint to object storage; local files are not automatically replicated. Orphan-image cleanup and media retention need operational handling.

Run the delivery worker alongside the API:

```bash
uv run python -m givehub.community_worker
```

Or run `uv run python -m givehub.community_worker --once` from a scheduler. The worker checks durable jobs every 30 seconds; restarting it resumes queued jobs. Worker and API must use the same `DATABASE_URL`.

With `RESEND_API_KEY` and a verified `EMAIL_FROM` configured, opted-in guests whose authenticated identity matches their email can receive delivery. Anonymous and local-development guest emails remain unverified, so their jobs become **preview** instead of sending actual mail. The host can inspect content and state in **Updates & reminders → Delivery inbox**. A preview is not proof of delivery. A failed/interrupted send stays failed/sending for provider reconciliation; it is not blindly retried because acceptance may be uncertain. Processing an event's inbox only handles that event's due jobs.

## Test manually

1. Sign in as an organizer. Open **Events → Create community event**. Complete the details, style and guest steps. Set a title, description, future date and location, choose a theme and optionally add a private guest question. Save the draft and publish it.
2. Copy the invite link and open it in a separate browser session. RSVP Going, optionally with another guest. Save the private edit link. Reload and change the response.
3. Return to the host workspace. Select the guest, verify their private answer and export the CSV. With approval enabled, confirm the pending guest and check that the hidden location becomes visible to that guest.
4. Fill the event, RSVP from another guest session and verify waitlisting. Withdraw the confirmed party and check promotion without overbooking.
5. Opt a guest into updates, post an announcement, and process due messages. Without real delivery configuration, verify **Local preview · not sent**. Change the schedule and check that obsolete queued reminders are replaced. Cancel and check that RSVP submissions close.
6. Sign in as a volunteer and RSVP to another event. Confirm it appears under **Activities → Your community RSVPs**.

The workspace preview uses the existing development role identities: choose organizer or volunteer and sign in with a valid-format email and an 8+ character password. These are shared seeded accounts, not separate real users. Use a signed-out second browser for independent guest testing.

## Automated validation

```bash
cd apps/api
uv run pytest
uv run ruff check givehub tests
uv run mypy givehub
```

From the repository root:

```bash
pnpm typecheck
pnpm test:mobile
GIVEHUB_E2E_API_URL=http://127.0.0.1:8787 pnpm test:browser
```

The browser tests expect a running local-auth web export at `http://localhost:8081` and an isolated development API with seeded identities. Set `GIVEHUB_E2E_WEB_URL` to override the web origin and ensure that origin is allowed by API CORS. Set `CHROME_PATH` if Chrome is elsewhere. They run full host/guest flows and discovery layout checks at 360, 390 and 430 pixels with touch/mobile emulation, plus a wide browser preview. Coverage includes the step editor, persistent RSVP button and jump, guest sheet, reload/editing, CSV download, a single card column and horizontal overflow. Created test events are cancelled afterward. Native-device and Safari validation are separate. Never point development bearer-token tests at production.

API regressions cover privacy, ownership, duplicates, private edit keys, required questions, capacity and a real concurrent final-slot race, approval, waitlist promotion, lifecycle integration, unlisted events, calendar metadata, local delivery previews, cancellation and DST validation. Hosted PostgreSQL concurrency, native devices, live provider delivery and deployment/load testing remain unverified.

Date polling, co-hosts, comments/reactions, photo albums, paid tickets, SMS and a friends graph are later features. REA was used to observe Partiful's public editor; this implementation uses GiveHub's own interface, API, data model and identity rules.
