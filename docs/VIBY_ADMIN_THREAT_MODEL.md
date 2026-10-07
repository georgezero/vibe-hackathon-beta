# Viby Admin Threat Model

**Date:** 2026-06-07
**Scope:** Phase B1/B1.5 Viby admin identity confirmation for Vibe Hackathon.

## Security Boundary

Viby proves identity. It can say that a Viby assertion belongs to a Viby user,
was created for a specific audience, came from a specific identity method, and
has not expired.

Vibe decides authorization. Admin access is granted only after Vibe verifies the
assertion and checks the stable Viby user ID against
`VIBE_ADMIN_VIBY_USER_IDS`.

Viby assertions are not roles. Vibe must never treat a Viby payload field,
display name, email, tag, affiliation, or client query parameter as admin
authorization.

## Callback Risks

`/admin/viby/callback` accepts only an opaque assertion ID. Every other
security decision is server-side:

- fetch the assertion from `VIBY_BASE_URL`
- require audience `VIBY_APP_SLUG`
- require a non-expired assertion
- require a valid Viby user ID and display name
- require a valid identity method and confidence value
- reject non-admin assertion context when context is present
- check `VIBE_ADMIN_VIBY_USER_IDS` exactly

Network errors, missing assertions, malformed JSON, wrong audience, expired
assertions, bad payloads, and non-allowlisted users fail closed.

## Replay Risks

Phase B1 does not mark Viby assertions as consumed. A valid assertion can be
replayed until it expires. The Vibe admin session cookie is short-lived, but the
assertion itself should eventually become one-time-use on the Viby side.

Current mitigation:

- assertion expiration is verified
- admin session has its own expiration
- allowlist is checked on every callback

Recommended next hardening:

- Viby should add one-time assertion consumption
- Vibe should reject assertions older than a tighter admin-specific max age
- callback should use a Vibe-generated nonce/state when Viby supports it

## Cookie and Session Risks

`vibe_admin_session` is a Vibe-owned cookie. It contains only public-safe admin
session fields:

- Viby user ID
- display name
- role `admin`
- issued/expires timestamps
- identity method/confidence

It does not contain embeddings, portraits, raw Viby metadata, or cookies from
Viby.

The cookie is HMAC-signed, `httpOnly`, `sameSite=lax`, path `/`, and expires
with `VIBE_ADMIN_SESSION_TTL_SECONDS`. Invalid signatures and expired sessions
fail closed. In HTTPS deployments, the cookie must be `secure`.

## Allowlist Risks

The Phase B1 authorization source is `VIBE_ADMIN_VIBY_USER_IDS`. The comparison
is exact and an empty allowlist denies everyone.

Risks:

- copying the wrong Viby user ID locks out the intended admin
- reusing dev/test Viby IDs in production can grant access to the wrong person
- display names and emails can change and must not be used as the primary admin
  authorization source

Recommended next hardening:

- move allowlist to a reviewed Vibe-owned admin table
- include display notes for operators, but authorize by stable Viby user ID
- audit every allowlist change

## Dev Login Risks

`/admin/dev-login` bypasses Viby and creates the same admin session cookie from
`ADMIN_TOKEN`. It only works when `VIBE_ENABLE_ADMIN_DEV_FALLBACK=true`.

This is intentionally unavailable unless `NODE_ENV` is exactly `development`
and the fallback flag is explicitly enabled. Test, production, and
missing/empty/unknown runtime values use production-safe behavior.

## Production Deployment Risks

Production needs explicit configuration:

- `VIBY_BASE_URL`
- `VIBY_APP_SLUG`
- `VIBE_ADMIN_VIBY_USER_IDS`
- independent `VIBE_ADMIN_SESSION_SECRET` of at least 32 characters
- HTTPS origin-only `VIBE_HACKATHON_BASE_URL`
- HTTPS and secure cookies
- `VIBE_ENABLE_ADMIN_DEV_FALLBACK=false`

Missing or unsafe admin configuration fails closed in every production-safe
runtime mode. Better Auth secrets are not admin-session signing fallbacks
outside exact development.

## Admin API and CSRF Risks

All `/api/admin/*` handlers use `withAdminApi()` and re-check the current
allowlist. Cookie-authenticated mutations require an exact serialized `Origin`
matching the canonical application origin and require
`Sec-Fetch-Site: same-origin` when the header is present.

Evaluation tokens are separate submission-scoped bearer credentials. They can
access only `/api/v1/ai-eval/external/*` for their submission and never satisfy
the organizer-session boundary.

## Public Route Privacy Risks

Phase B1 must not change public presentation, status, project, or submission
behavior. Public routes should remain accessible without `vibe_admin_session`,
and they should not render admin identity, Viby assertion details, or session
state.

The Playwright regression suite checks that `/`, `/projects`, `/status`, and
`/presentation` remain public.

## Judge Authentication Boundary

Judge sessions are cryptographically and semantically separate from organizer
sessions. A judge submits an individual credential only to
`POST /api/judge/session`; the server verifies it against the durable judge
record and returns a signed `vibe_judge_session` cookie. The browser never
receives the configured credential, another judge's credential, or a signing
secret.

`withJudgeApi()` derives identity from that cookie, re-checks the current judge
record, and protects judge reads, scoring, and logout. Assignment checks remain
server-side. A body or query parameter cannot override the session judge ID.
Judge mutations require the same strict serialized-Origin rules as admin
mutations.

Existing judge credentials remain plaintext in the database for compatibility.
They are no longer serialized into pages, client bundles, URLs, admin dashboard
props, or event-bundle exports. Hash-at-rest migration and distributed login
rate limiting remain follow-up hardening items.
