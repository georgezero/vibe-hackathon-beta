# Current Vibe Hackathon Authentication Architecture

This audit describes canonical source
`65615e5d638f7fba0a81b12d5e3d74503d1c3d8e`. Production runs release
`1cc6394713aaef32425d763772f1e4b75857bdcc`; the commits between that release
and canonical `main` modify only Viby documentation and judge-test typing.

## Authentication domains

Vibe currently has three independent application authentication domains.

| Domain | Mechanism | Authority |
| --- | --- | --- |
| Team owner/recovery | Better Auth GitHub OAuth | Better Auth session plus submission ownership records |
| Organizer/admin | Viby assertion followed by custom HMAC cookie | Viby identity plus Vibe allowlist/role link |
| Judge | Dedicated signed judge session | Vibe judge credential and assignment data |

The proposed work changes only organizer/admin authentication and shared
identity linking. Judge authentication remains independent.

## Better Auth today

`lib/auth.ts` configures Better Auth 1.6.25 with the Drizzle adapter, GitHub as
the only social provider, and `nextCookies()`. Its tables are declared in
`lib/db/schema.ts`: `users`, `sessions`, `accounts`, and `verifications`.

`lib/team-auth.ts` calls `auth.api.getSession()` and uses the GitHub account for
team registration and recovery. The catch-all handler is
`app/api/auth/[...all]/route.ts`. There is no application-wide authentication
middleware; protected flows use server-side guards.

Better Auth does not currently establish or authorize an admin session.

## Current admin login

1. `app/admin/page.tsx` links to `/api/viby/start?flow=admin`.
2. `app/api/viby/start/route.ts` creates a signed callback-state cookie, builds
   `/apps/vibe-hackathon/start`, requests mode `admin`, and sets
   `freshIdentity=1`.
3. Viby redirects to `app/admin/viby/callback/route.ts` with an opaque assertion
   ID and status.
4. The callback compares the query state to the signed cookie state.
5. `lib/viby.ts` redeems the assertion through the legacy unauthenticated GET
   endpoint `/api/identity/assertions/:id`.
6. The callback verifies audience, expiry, identity fields, and admin context.
7. `lib/viby-identity-links.ts` authorizes either a bootstrap environment
   allowlist entry or an active `viby_identity_links` admin row.
8. The callback upserts the Viby role link and creates `vibe_admin_session`.
9. The browser enters `/admin/dashboard`.

The Runtime consumes the assertion during the legacy GET, so assertion replay
is rejected by Runtime even though the application calls a GET endpoint.

## Custom admin session

`lib/admin-session.ts` owns `vibe_admin_session`.

- Payload: Viby subject, display name, fixed `admin` role, issue/expiry times,
  identity method, and identity confidence.
- Signature: HMAC-SHA-256 with `VIBE_ADMIN_SESSION_SECRET`.
- Default lifetime: 12 hours.
- Cookie: HttpOnly, SameSite=Lax, Path=/, Secure in production-safe runtime.
- Revocation: expiry or signing-secret rotation; API authorization also
  rechecks the Vibe admin authorization record.

`requireAdminSession()` checks only cookie authenticity and expiry. In
particular, the server-rendered dashboard calls this guard but does not recheck
the active admin role link. By contrast, `withAdminApi()` in
`lib/admin-api.ts` rechecks `isAuthorizedAdminVibyUser()` for every protected
admin API request. The target design must use one principal resolver for both
pages and APIs so role revocation is immediate everywhere.

`app/admin/logout/route.ts` clears only the custom Vibe admin cookie. It does
not clear a Better Auth session or the Viby identity session.

## Current identity-link record

`lib/db/schema.ts` defines `viby_identity_links` with:

- `provider_id`
- `subject_id`
- role `admin`
- nullable `local_user_id`
- display name and last verification time
- revocation and audit timestamps
- uniqueness on provider, subject, and role

`local_user_id` is never populated by the current callback. The table is
therefore a Viby-subject-to-role authorization record, not a link to a Better
Auth account.

`lib/viby-identity-links.ts` has two transitional behaviors that should not
survive the migration:

- a bootstrap environment allowlist can authorize directly;
- schema and upsert failures are caught and suppressed.

An allowlisted subject also bypasses a revoked database link, and a successful
login upsert clears `revoked_at`. Revoking such an admin therefore requires
removing the environment allowlist entry as well as changing the database.
That split authorization plane must be collapsed during migration.

The additive migration is `scripts/migrate-viby-identity-links.ts`, covered by
`tests/viby-identity-link-migration.test.ts`. It requires an absolute database
path, but its production confirmation uses a direct
`NODE_ENV === "production"` decision rather than the central fail-closed
runtime helper.

## Callback state

`lib/viby-callback-state.ts` stores one signed state object in the
`vibe_viby_callback_state` cookie for ten minutes. It binds:

- random state
- flow
- callback path
- return path
- source
- project/artifact context when applicable

The callback requires exact state, flow, and path. It then clears the cookie.
The state is not recorded or atomically consumed server-side. One cookie also
means concurrent tabs or concurrent Viby flows can overwrite each other.
Runtime assertion consumption limits replay impact, but the target should use
durable one-time callback transactions.

## Assertion client

`lib/viby.ts` is a hand-written adapter for the deployed legacy protocol. It:

- performs an unauthenticated GET to the Runtime;
- validates both assertion and payload audiences;
- validates expiry and context;
- maps human assertions to `VibyIdentityAssertion`;
- separately maps agent assertions to `VibyAgentAssertion`;
- requires `subject_type=agent` and `owner_registered` delegation for agent
  attribution.

This duplicates transport and response-shape responsibilities that belong in a
Runtime-owned SDK. Its application-specific authorization checks should remain
in Vibe.

## Agent and artifact callbacks

`app/admin/viby/agent-callback/route.ts` validates one-time Runtime assertion
consumption and logs a demo attribution. It does not create an admin session.

`app/admin/viby/artifact-callback/route.ts` validates the project from state,
validates an agent assertion, creates a signed artifact description, and stores
it temporarily in a scoped HttpOnly cookie. It does not create an admin
session. Unlike `lib/admin-session.ts`, its local Secure-cookie helper accepts
`VIBE_ADMIN_COOKIE_SECURE=false` without consulting the fail-closed runtime
policy; the target should use one production-safe cookie policy.

Both callbacks are browser-mediated provenance flows, not Better Auth login
flows. Their protected start pages require an admin session, while callbacks
rely on state plus the scoped Runtime assertion.

## Existing security controls

- Fail-closed runtime classification in `lib/runtime-mode.ts`.
- Strict same-origin mutation protection in `lib/same-origin.ts`.
- Central admin API policy registry and `withAdminApi()` enforcement.
- Runtime audience, expiry, context, actor, and delegation checks.
- HttpOnly, Secure, SameSite cookies.
- Sanitized admin audit events in `lib/admin-audit.ts`.
- Route inventory and authorization tests.

## Existing tests

Relevant coverage includes:

- `tests/viby-admin-security.test.ts`
- `tests/viby-callback-state.test.ts`
- `tests/viby-identity-link-migration.test.ts`
- `tests/admin-api-authorization.test.ts`
- `tests/admin-api-route-integration.test.ts`
- `tests/admin-api-route-inventory.test.ts`
- `tests/verified-agent-artifact.test.ts`
- `tests/playwright/viby-admin-auth.spec.ts`
- `tests/playwright/viby-admin-dev-fallback.spec.ts`
- `tests/runtime-mode.test.ts`

The current Playwright configuration can execute database setup and must not be
used against an operator database.
