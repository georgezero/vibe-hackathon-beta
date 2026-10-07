# Viby Admin Integration

**Phase:** B1 — Admin Identity Confirmation
**Date:** 2026-06-07

## Purpose

This integration adds a Vibe-owned admin session created from a verified Viby
identity assertion.

Core rule:

```text
Viby asserts identity.
Vibe decides authorization.
```

Viby does not grant admin access. Vibe verifies the Viby assertion, checks the
Viby user ID against `VIBE_ADMIN_VIBY_USER_IDS`, and then creates a signed
`vibe_admin_session` cookie.

## Environment Variables

```bash
VIBY_BASE_URL=http://localhost:3001
VIBY_APP_SLUG=vibe-hackathon
VIBE_ADMIN_VIBY_USER_IDS=
VIBE_STAFF_VIBY_USER_IDS=
VIBE_ADMIN_SESSION_TTL_SECONDS=43200
VIBE_HACKATHON_BASE_URL=
VIBE_ADMIN_SESSION_SECRET=
VIBE_JUDGE_SESSION_SECRET=
```

Optional:

```bash
VIBE_ENABLE_ADMIN_DEV_FALLBACK=false
VIBE_SHOW_ADMIN_ASSERTION_BRIDGE=false
VIBE_ADMIN_COOKIE_SECURE=
```

`VIBE_ADMIN_SESSION_SECRET` signs the admin session cookie and is required in
production-safe runtime modes. It must be an independent value of at least 32
characters. Admin APIs fail closed when it, the exact admin Viby allowlist, or
the HTTPS canonical base URL is missing or unsafe. Only exact
`NODE_ENV=development` may use `BETTER_AUTH_SECRET`; test and unknown runtime
values use production-safe rules. There is no token or literal signing-secret
fallback.

Judge authentication is a separate boundary. `VIBE_JUDGE_SESSION_SECRET` must
be an independent server-only value and is never derived from the admin,
Better Auth, or Viby configuration. See `docs/JUDGE_AUTHENTICATION.md`.

`VIBE_ENABLE_ADMIN_DEV_FALLBACK=true` enables the local development token
fallback on `/admin` only when `NODE_ENV=development`. Leave it disabled
outside local development. `/api/admin/seed` follows the same exact runtime
gate.
The synthetic `dev_fallback` identity must also be explicitly included in
`VIBE_ADMIN_VIBY_USER_IDS` for its API requests to pass the same per-request
allowlist check.

When enabled, `/admin` shows a development-only token panel below the Viby
identity flow. The displayed token can be clicked to fill the token field. This
panel is hidden when `VIBE_ENABLE_ADMIN_DEV_FALLBACK` is unset or false, and the
token is not serialized into the admin page in the normal path.

`VIBE_SHOW_ADMIN_ASSERTION_BRIDGE=true` shows the legacy assertion ID paste
field for diagnostics. Leave it disabled for the normal callback flow.

`VIBE_ADMIN_COOKIE_SECURE` can force secure-cookie behavior. When unset, secure
cookies are used if `VIBE_HACKATHON_BASE_URL` starts with `https://`.

## Setup

1. Run Viby locally.

```bash
cd /home/george/Downloads/src/ai/faceblur/viby-dev/web
npm run build
npm run start -- -p 3001
```

2. Configure Vibe Hackathon.

```bash
cd /home/george/Downloads/src/ai/agentpacs/vibe-hackathon-viby
cat >> .env.local <<'ENV'
VIBY_BASE_URL=http://localhost:3001
VIBY_APP_SLUG=vibe-hackathon
VIBE_ADMIN_VIBY_USER_IDS=<comma-or-space-separated-viby-user-ids>
VIBE_ADMIN_SESSION_TTL_SECONDS=43200
ENV
```

3. Restart Vibe Hackathon.

## Finding a Viby User ID

For local testing, identify or create the admin user in Viby, then inspect the
identity card or assertion payload. The relevant value is:

```json
{
  "user_id": "..."
}
```

Add that value to:

```bash
VIBE_ADMIN_VIBY_USER_IDS=usr_abc123
```

Multiple admins can be separated by commas or whitespace.

Authorization is exact-match and based on stable Viby user IDs. An empty
allowlist denies everyone.

## Expected Flow

```text
/admin
-> Confirm with Viby
-> Viby opens /apps/vibe-hackathon/start?mode=admin&callbackUrl=<vibe callback>
-> Viby creates an assertion with audience vibe-hackathon
-> Viby redirects to /admin/viby/callback?assertionId=<id>&viby_status=allowed
-> Vibe fetches assertion from Viby server-side
-> Vibe verifies audience == VIBY_APP_SLUG
-> Vibe verifies assertion expiration
-> Vibe extracts Viby user identity
-> Vibe checks VIBE_ADMIN_VIBY_USER_IDS
-> Vibe creates signed vibe_admin_session cookie
-> /admin/dashboard opens
```

## Agent Attribution Demo Flow

Vibe Hackathon also includes a safe demo for Viby agent attribution:

```text
/admin/agent-attribution-demo
```

This is separate from admin identity confirmation. It demonstrates how Vibe can
consume a Viby agent assertion for attribution text such as:

```text
Demo Agent G1 performed an agent attribution demo action.
Owned by George One.
```

The launch URL uses a different Viby mode:

```text
/apps/vibe-hackathon/start
  ?mode=agent-attribution
  &callbackUrl=<vibe>/admin/viby/agent-callback
```

The callback verifies server-side:

- `audience === vibe-hackathon`
- `context.mode === agent-attribution`
- `subject_type === agent`
- assertion is not expired
- agent and owner fields are present

The agent attribution callback does **not** create `vibe_admin_session`, does
not grant admin access, does not replace edit tokens, and does not change
project authorization. It only displays a demo attribution result.

On success, Vibe displays:

- `Agent action attributed`
- agent display name
- owner display name
- actor type `agent`
- assertion status `Allowed`
- action attribution sentence

Viby confirms agent ownership/delegation. Vibe Hackathon still decides what the
actor is allowed to do.

Admin mode remains human-only:

```text
/apps/vibe-hackathon/start?mode=admin
```

The admin dashboard displays:

```text
Admin identity
<display name>
Confirmed with Viby

Method: <method>
Confidence: <score>
Expires: <time>
```

The logout link clears the admin session cookie and returns to `/admin`.

## Automatic Callback

The current admin path is first-class same-tab callback transport:

```text
Browser
  -> Vibe /admin
  -> same tab navigates to Viby /apps/vibe-hackathon/start
  -> Viby creates scoped assertion
  -> Vibe /admin/viby/callback?assertionId=...
  -> Vibe verifies assertion
  -> Vibe creates signed admin session
  -> Vibe /admin/dashboard
```

Viby success callbacks send:

```text
assertionId
viby_status=allowed
```

It does not send display name, Viby user ID, confidence, method, session ID, or
authorization data through the browser. Vibe retrieves those server-side from
Viby during assertion verification.

Viby deny callbacks send:

```text
viby_status=denied
reason=user_denied
```

Vibe shows a friendly message and does not create an admin session.

Viby error callbacks send:

```text
viby_status=error
reason=<safe_reason>
```

Vibe displays a safe reason such as `expired_request`, `session_required`, or
`assertion_failed`. Raw Viby internals are not shown.

The primary **Confirm with Viby** control does not open a new tab. The browser
leaves Vibe, confirms identity in Viby, then returns to the Vibe dashboard in
the same tab. New-tab/manual assertion handling was only for early development
and diagnostics.

## Pending Host-App Request Flow

When the browser reaches Viby without an active Viby identity session, Viby
preserves the host-app intent for the browser session and sends the user through
Identify Me.

```text
Browser
  -> Vibe /admin
  -> Viby /apps/vibe-hackathon/start?callbackUrl=...
  -> Viby stores pending host-app request in sessionStorage
  -> Viby /identify?continueHostApp=1
  -> user identifies
  -> Viby creates scoped assertion for vibe-hackathon
  -> Viby clears pending request
  -> Vibe /admin/viby/callback?assertionId=...
  -> Vibe verifies assertion and allowlist
  -> Vibe /admin/dashboard
```

Pending requests expire after 10 minutes. If the request is expired or the
callback URL is not allowed, Viby clears the pending request and the user must
start again from Vibe.

For `vibe-hackathon`, the callback URL must target one of the configured Vibe
callback paths:

```text
/admin/viby/callback
/admin/viby/agent-callback
/admin/viby/artifact-callback
```

The callback still carries only `assertionId`.

## Temporary Bridge Limitation

The legacy manual bridge is still available only when
`VIBE_SHOW_ADMIN_ASSERTION_BRIDGE=true` while the callback flow settles.

For the normal admin path, users should not see or paste assertion IDs.

The assertion must have audience `vibe-hackathon`. Assertions for `mock-host` or
any other audience are intentionally rejected.

Future Viby-side improvement:

```text
/apps/:slug/start?callbackUrl=<vibe callback>&state=<opaque vibe nonce>
```

The next hardening step is an opaque Vibe-generated state/nonce and one-time
assertion consumption.

## Local Dev Fallback

The old admin token flow no longer silently opens `/admin/dashboard`.

If explicitly enabled:

```bash
NODE_ENV=development
VIBE_ENABLE_ADMIN_DEV_FALLBACK=true
ADMIN_TOKEN=<local-only-random-development-token>
```

the development fallback form on `/admin` creates the same signed
`vibe_admin_session` cookie with a `development_fallback` identity method.

The fallback is below the Viby card, collapsed by default, and visually marked
as unsafe when expanded:

```text
This bypasses Viby and should stay disabled outside local development.
```

Do not enable this in hosted event environments.

## Verified Agent Artifacts Demo

Phase 8 adds an admin-only verified artifact demo:

```text
/admin/verified-agent-artifacts
```

This launches Viby with:

```text
/apps/vibe-hackathon/start?mode=agent-attribution
```

and uses the callback:

```text
/admin/viby/artifact-callback
```

The callback verifies the Viby agent assertion server-side, generates a
simulated selected artifact inside Vibe, computes a SHA-256 hash of the final
artifact text, signs the artifact payload, and renders a Viby verification mark.
Phase 8.2 routes this through the shared `lib/verifiedArtifacts.ts` framework.
It supports Project Summary, Elevator Pitch, and Presentation Summary artifact
types, and future types can be added without changing the verification pipeline.
Phase 8.3 renders all verified artifacts through the canonical
`VibyArtifactSeal` component, adds session-scoped recent artifact history,
adds `/admin/verified-agent-artifacts/[artifactId]`, and supports copy/download
export of artifact content plus the Viby seal.

This does not create an admin session, grant project permissions, replace team
tokens, or persist agent credentials. Viby confirms the agent identity and owner
relationship; Vibe owns the artifact and authorization decision.

## Admin API Authorization

Every `/api/admin/*` handler is protected by the centralized `withAdminApi()`
boundary, including GET exports. Each request validates the signed session and
current exact allowlist. Mutations additionally require an exact serialized
`Origin` matching `VIBE_HACKATHON_BASE_URL`; when `Sec-Fetch-Site` is present,
it must be `same-origin`.

Token issuance for external AI evaluation is POST-only. Scoped external
automation uses bearer credentials on `/api/v1/ai-eval/external/*`; an
evaluation token never grants access to `/api/admin/*`.

## Known Limitations

- The callback accepts a manually supplied assertion ID until Viby has a generic
  callback flow.
- Admin authorization is a Viby user ID allowlist, not a database role model.
- Staff allowlisting is configured but not used in Phase B1.
- Judge and participant linking are intentionally not implemented in this phase.

## Validation

Targeted helper tests:

```bash
npm run test
```

Authorization boundary tests:

```bash
npm run test:e2e
```

See `docs/VIBY_ADMIN_PLAYWRIGHT_TESTS.md` for the Playwright coverage.
