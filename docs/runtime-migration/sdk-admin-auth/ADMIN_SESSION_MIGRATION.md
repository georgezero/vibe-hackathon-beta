# Admin Session Migration

## Current state

The current `vibe_admin_session` is independently signed with
`VIBE_ADMIN_SESSION_SECRET` and defaults to twelve hours. It carries the Viby
subject and `admin` role. API requests recheck the current role link, but
server-rendered pages call `requireAdminSession()` and do not perform the same
authorization lookup.

Better Auth sessions already exist for team ownership and recovery. The target
is one application session system with separate application authorization.

## Transition strategy

### Stage 1: principal resolver

Add a central server-only resolver that can produce an `AdminPrincipal` from:

1. Better Auth session plus active local admin role and active Viby link; or
2. during the compatibility window only, a valid legacy admin cookie plus the
   current Viby admin authorization record.

Use it in:

- all admin server pages;
- `withAdminApi()`;
- admin navigation identity display;
- admin start flows;
- artifact administration pages.

The API policy registry, strict Origin validation, and status behavior stay
unchanged.

### Stage 2: issue only Better Auth sessions

After the supported Better Auth extension is proven:

- Viby callbacks stop issuing new legacy cookies;
- successful Viby-first login issues a Better Auth session for an existing
  linked user;
- linking requires an already authenticated Better Auth user;
- admin role is resolved from application data, not embedded in the cookie.

Legacy cookies remain readable for at most one existing 12-hour lifetime. Their
use is logged with non-secret telemetry.

### Stage 3: retire legacy acceptance

After the compatibility deadline:

- remove legacy-cookie acceptance from the principal resolver;
- clear the cookie on every admin response and logout;
- rotate/remove `VIBE_ADMIN_SESSION_SECRET`;
- remove the custom encoder/decoder and development fallback;
- keep historical audit records.

No compatibility window should extend by silently reissuing a legacy cookie.

## Session fixation and invalidation

- Revoke or replace an existing Better Auth session when completing a Viby-first
  login.
- Never reuse a caller-supplied session token.
- On link or role revocation, revoke all Better Auth sessions for the affected
  user when the action is intended to terminate access.
- `AdminPrincipal` must recheck role and link on each protected request so cache
  lifetime does not delay authorization revocation.
- Fresh-verification timestamps must not outlive the session that received
  them.

## Logout

The local logout endpoint should:

1. enforce same-origin POST for the state-changing operation;
2. call the supported Better Auth sign-out endpoint;
3. clear legacy admin, callback, pending-link, and artifact cookies;
4. write a sanitized audit event;
5. redirect only to an allowlisted local path.

The current GET logout should remain only during a short compatibility period
or become a non-mutating confirmation page. State-changing logout should be
POST.

Runtime logout is independent. Do not redirect to the current SDK
`/identity/logout` URL until that Runtime route exists and its return URL policy
is tested.

## Rollback

During the compatibility window, rollback can return issuance to the legacy
cookie while preserving new Better Auth data, provided the legacy signing
secret remains available and unrotated.

After HMAC retirement, rollback must not resurrect old cookies. Roll back
application code while keeping Better Auth session support, or require a new
Viby verification.

## Completion criteria

- No callback issues `vibe_admin_session`.
- No server page or API authorizes solely from cookie claims.
- All organizer access resolves a Better Auth user and active application role.
- The legacy secret is removed from runtime configuration.
- Existing judge and team-owner sessions are unaffected.
