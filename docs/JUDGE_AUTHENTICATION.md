# Judge Authentication and Operations

## Security Model

Judges have individual durable identities in the `judges` table and
submission-level authorization in `judge_assignments`. The existing judge
credential is submitted only to `POST /api/judge/session`. It is verified on
the server and exchanged for a signed `vibe_judge_session` cookie.

The cookie contains the stable judge ID, display name, judge role, and
issued/expiry timestamps. It is HttpOnly, SameSite=Lax, path `/`, and Secure in
every production-safe runtime. The default lifetime is 43,200 seconds
(12 hours).

Judge identity is never accepted from a URL, query string, bearer header,
request body, local storage, or session storage. Every protected judge API
derives identity from the verified cookie and re-checks that the judge record
still exists. Submission reads and score writes also verify the current
judge-to-submission assignment.

## Required Environment

```bash
VIBE_HACKATHON_BASE_URL=https://your-deployment.example.com
VIBE_JUDGE_SESSION_SECRET=an-independent-random-value-at-least-32-characters
VIBE_JUDGE_SESSION_TTL_SECONDS=43200
```

`VIBE_JUDGE_SESSION_SECRET` must be independent from
`VIBE_ADMIN_SESSION_SECRET`, `BETTER_AUTH_SECRET`, Viby credentials, and
participant edit-token material. It has no fallback.

Production, test, missing, empty, and unknown `NODE_ENV` values use
production-safe behavior. They require an HTTPS origin-only base URL and Secure
cookies. Only exact `NODE_ENV=development` may use an HTTP localhost origin;
it still requires the dedicated judge secret.

Missing or unsafe configuration makes judge APIs return a non-sensitive 503.

## Login, Scoring, and Logout

1. A judge opens `/judge` and enters the individual credential supplied by an
   organizer through a private channel.
2. Successful login redirects to `/judge/dashboard`.
3. Assigned scorecards are at `/judge/submissions/:submissionId`.
4. Score saves use the judge cookie. The submitted body cannot select a
   different judge.
5. Log out from the judge navigation. Logout expires the judge cookie.

All judge mutations require an exact serialized `Origin` equal to
`VIBE_HACKATHON_BASE_URL`. Missing, null, malformed, credential-bearing,
path-bearing, query-bearing, fragment-bearing, trailing-slash, cross-origin,
and same-site/different-origin values are rejected. When `Sec-Fetch-Site` is
present it must be `same-origin`.

Legacy `/judge/:token` links no longer authenticate. An existing credential is
still accepted when entered at `/judge`, preserving current judge records,
assignments, and scores without a database migration.

## Credential Rotation and Recovery

There is no credential-management UI in this slice. To rotate one judge's
credential, an authorized operator must:

1. Generate a new high-entropy credential using an approved secret generator.
2. During a maintenance window, replace only that judge's `judges.token` value
   using the trusted database administration workflow.
3. Deliver the new credential privately to the named judge.
4. Ask the judge to log out and log back in.

Rotating a database credential does not revoke an already-issued signed
session. Sessions expire after the configured TTL. For immediate global judge
session revocation, rotate `VIBE_JUDGE_SESSION_SECRET` and restart the
application; all judges must then log in again. Do not rotate the admin secret
as a substitute.

If a judge loses access, verify their identity through the event's approved
out-of-band process, rotate that judge's credential, and privately deliver the
replacement. Never send credentials in public chat, issue trackers, URLs, or
browser screenshots.

## Compatibility and Known Risks

The current schema stores judge credentials plaintext. P0.2 keeps that durable
format to preserve existing event data and avoid an unexecuted production
migration, but verification is server-only and constant-time across candidate
records. A later migration should store a password hash and support
transactional credential rotation.

Login throttling and lockout are not implemented because the repository has no
shared rate-limit store. Deployments should apply edge rate limiting to
`POST /api/judge/session` until application-level distributed throttling is
added.

Event-bundle exports omit judge credentials. Backups therefore preserve judge
identities, assignments, and scores but not reusable login credentials.
