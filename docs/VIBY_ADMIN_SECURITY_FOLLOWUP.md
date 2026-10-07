# Viby Admin Security Follow-up

**Updated:** 2026-07-26
**Scope:** P0.1 centralized admin API authorization.

## Admin API Boundary

Every handler under `/api/admin/*`, including GET exports, is registered in
`ADMIN_API_POLICIES` and exported through `withAdminApi()`. Route inventory
tests fail when a route is missing a policy, has a stale policy, or bypasses the
wrapper.

The boundary performs, in order:

1. development-only route enforcement
2. production-safe configuration validation
3. signed and unexpired `vibe_admin_session` validation
4. current exact Viby user-ID allowlist validation
5. strict same-origin validation for cookie-authenticated mutations
6. automatic mutation audit logging

Anonymous or invalid sessions receive `401`. Valid identities removed from the
allowlist receive `403`. Missing or unsafe production-safe configuration
receives a non-sensitive `503`.

`POST /api/admin/seed` is the only development-only admin API. It exists only
when `NODE_ENV` is exactly `development`, and still requires an authenticated,
allowlisted organizer session and an exact Origin. It has no bearer-token or
browser-local-storage authorization path.

## Runtime Modes

Only exact `NODE_ENV=development` enables development behavior. Production,
test, and missing, empty, malformed, or unknown values use production-safe
rules. Test mode is deliberately production-safe; tests provide explicit
configuration.

Production-safe modes require:

- `VIBE_ADMIN_SESSION_SECRET`, at least 32 characters and independent from
  Better Auth
- a nonempty exact `VIBE_ADMIN_VIBY_USER_IDS` allowlist
- `VIBE_HACKATHON_BASE_URL` as an HTTPS origin URL
- secure admin cookies
- the development fallback to be disabled

`ADMIN_TOKEN`, Better Auth secrets, and literal development values are never
used as admin-session signing fallbacks in production-safe modes.

## CSRF and Origin Rules

All `/api/admin/*` mutations require an `Origin` header serialized exactly as a
web origin, such as `https://event.example.com`. Paths, query strings,
fragments, credentials, `null`, malformed values, and a trailing slash in the
request header are rejected. The origin must exactly match the canonical
`VIBE_HACKATHON_BASE_URL` origin. When `Sec-Fetch-Site` is present, it must be
`same-origin`.

The configured base URL may include one trailing slash; it is canonicalized
once to its origin. It may not contain credentials, a non-root path, a query,
or a fragment.

## External AI Evaluation

Public packet and prompt downloads remain credential-free and read-only:

```text
GET /api/v1/ai-eval/packet/:submissionId
GET /api/v1/ai-eval/prompt/:submissionId
```

They never create, update, or expose evaluation tokens.

An allowlisted organizer issues a submission-scoped credential with:

```text
POST /api/admin/ai-runs/token/:submissionId
```

Token issuance is POST-only and therefore requires the organizer session and
exact Origin. The response points external automation to:

```text
GET  /api/v1/ai-eval/external/packet/:submissionId
GET  /api/v1/ai-eval/external/prompt/:submissionId
POST /api/v1/ai-eval/external/import/:submissionId
Authorization: Bearer <submission-scoped-evaluation-token>
```

The token cannot authorize any `/api/admin/*` route and cannot operate on a
different submission. Read-only external GETs validate without updating token
state. A successful scoped import updates `lastUsedAt`.

## Remaining Follow-up

- Add one-time Viby assertion consumption when Viby supports it.
- Add a Vibe-generated callback state/nonce.
- Move organizer allowlisting to a reviewed Vibe-owned role store if
  environment-based allowlisting becomes operationally limiting.
- Add an organizer-facing audit-log viewer; audit storage already exists.
