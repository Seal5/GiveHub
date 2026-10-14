# Suggested EOT report corrections

Use the following text when updating the report. It describes the pilot-readiness branch; do not claim these changes are live on the existing public site until they are merged and deployed.

## Page 6: reviewer responsibility

Replace the statement that GiveHub has no management features with:

> GiveHub's reviewer tools are integrated into the organizer client. Production access is restricted to configured reviewer email addresses. Reviewers manage imported candidates, listing reports, source permission records, host approval, and requested account removal. A dedicated reviewer role is not implemented; organizer ownership rules and reviewer authorization remain separate controls.

## Pages 7–8: current architecture and remaining implementation

> GiveHub has an Expo web/mobile client, a FastAPI authority, and a Supabase/PostgreSQL integration. The public GitHub Pages site is a session-only demonstration. A shared production application requires a publicly deployed API, a connected web build, verified authentication/email/storage configuration, monitoring, backups and support ownership. The organizer client now provides a wider desktop applicant workspace, while field attendance remains compact.

Replace “creating a web application” and “managing the database” as unfinished features with the concrete deployment and operational tasks above.

## R-02 and R-07: meaning of verification

> Source reachability and freshness are distinct from human verification. HTTP success updates the last-checked date without granting verified status. New hosts require an evidenced reviewer decision before publishing. Imported drafts retain unknown fields until an authorized reviewer supplies and confirms schedule, location, capacity, eligibility, safety and application-destination information.

## R-08: transparent recommendations

> Optional preferences reorder opportunities rather than remove alternatives. Relevant cards display the positive reasons for their ordering. Comparable hosts rotate deterministically within relevance cohorts. These mechanisms are implemented; pilot fairness, comprehension and relevance measurement remain outstanding.

## R-09: data lifecycle

> GiveHub provides access to a user's own records, account-removal requests with reviewer completion, and configurable retention for expired declined/withdrawn application details. The team must approve retention periods and operational responsibilities before enabling production deletion. Account withdrawal and data deletion are separate operations. Backup, log, storage and exported-data policies, formal privacy review and incident-response validation remain release gates.

## R-11: recurring participation

> First-session attendance and additional recurring-session attendance retain independent dates and contributed hours. Weekly and monthly cadences are supported, including shorter-month boundaries. Rescheduling/cancellation exceptions and native field validation remain outside the verified scope.

## R-12/R-13/R-14: quality and deployment claims

> Browser authentication uses platform-appropriate session storage. Shared links retain their destination across browser reloads during sign-in and provide native and browser destinations. Automated regression checks and Chromium walkthroughs verify selected behaviors. Production-provider, native-device, Safari/Firefox, accessibility, security, load, and hosted-PostgreSQL checks remain outstanding.

Keep test totals and evidence links tied to a specific reviewed commit rather than claiming that passing unit tests establishes production readiness.

## R-16 to R-20: future scope

> The social tab is a clearly labeled sample-data prototype. Shared social networking, LLM-assisted source review, recommendation notifications, guest/walk-in participation and corporate requests remain deferred. Their privacy, safety, governance and stakeholder requirements must be evaluated before implementation.
