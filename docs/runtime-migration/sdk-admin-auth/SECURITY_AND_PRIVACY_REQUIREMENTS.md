# Security and Privacy Requirements

## Blocking prerequisites

1. Correct and behaviorally test the deployed Runtime SDK request and response
   contract.
2. Correct exact callback-state comparison.
3. Add supported fresh-verification and typed agent assertion capabilities.
4. Establish a real Runtime logout contract or explicitly exclude Runtime
   logout.
5. Provision a dedicated Vibe confidential client credential and enable modern
   redemption only after coordinated Runtime review.
6. Prove a supported Better Auth session-creation extension without private
   APIs or manual cookie signing.

## Callback and replay

- Generate at least 256 bits of callback nonce entropy.
- Store only a nonce digest server-side.
- Bind flow, callback, return path, expected mode/actor, initiating session,
  and resource context.
- Atomically consume the transaction.
- Redeem the Runtime assertion exactly once, server to server.
- Distinguish consumed, expired, wrong-app, wrong-mode, and unavailable
  internally while returning non-enumerating user errors.
- Do not retry redemption automatically after an ambiguous network response;
  reconcile safely.

Runtime replay protection and Vibe callback-transaction replay protection serve
different purposes and both are required.

## CSRF and Origin

- Preserve `withAdminApi()` strict serialized-Origin validation for mutations.
- Require same-origin POST for local logout and account-link confirmation.
- Callback endpoints authenticate through state and Runtime assertion, not
  Origin; cross-site navigation from Runtime is expected.
- Do not treat SameSite cookies as the sole CSRF defense.

## Session security

- Better Auth cookies remain HttpOnly, Secure, SameSite=Lax or stricter, and
  Path-scoped according to its canonical configuration.
- Rotate the application session at Viby login/link completion.
- Bind fresh-verification evidence to the session and local user.
- Recheck link and role on every protected page and API request.
- Revoke sessions on role/link recovery where access termination is intended.
- Do not share judge, callback, artifact, Better Auth, or legacy admin signing
  secrets.

## Identity-link security

- Stable provider subject is the only external link key.
- Display name, tag, affiliation, and email are profile fields, not keys.
- Uniqueness is database-enforced.
- Concurrent linking is transactional.
- Conflict responses do not disclose the other local account.
- Revoked links never reactivate during ordinary login.
- Admin role is application-owned and separately auditable.

## Redirects and URLs

- Use the configured canonical Vibe origin, never request Host headers.
- Persist only safe relative return paths from an allowlist.
- Require exact registered callbacks.
- Reject credentials, userinfo, path ambiguity, fragments, and unexpected
  origins in configured URLs.
- Never place Runtime client credentials, assertions, sessions, or callback
  secrets in URLs.

## Runtime configuration

- Unknown/missing runtime mode remains production-safe.
- `VIBY_BASE_URL` must be exact HTTPS outside explicit development/test.
- `VIBY_CLIENT_SECRET`, Better Auth secret, and callback secrets are server-only
  and independent.
- Credential rotation must support overlap through two active Runtime
  credentials only for a bounded deployment window, followed by old credential
  revocation.
- No secret may use `NEXT_PUBLIC_*`.

## Logging

Never log:

- Runtime client credentials or Basic Authorization;
- assertion IDs;
- callback nonce/state values;
- Better Auth session tokens or cookies;
- Viby identity-session IDs unless a one-way diagnostic correlation is
  explicitly approved;
- OAuth tokens;
- portrait, face embedding, or biometric payloads;
- full request/response bodies from auth endpoints.

Log actor category, application user ID or approved pseudonymous correlation,
flow, result category, role/link record ID, and timestamp.

Audit mutations should fail according to the approved audit durability policy.
The current best-effort behavior must be documented if retained.

## Privacy

- Store the minimum Runtime profile metadata needed for operator display.
- Do not copy biometric evidence into Vibe.
- Do not expose identity links in public APIs, exports, RSC payloads, or client
  bundles.
- Event exports must omit auth sessions, callback transactions, pending links,
  provider subjects unless explicitly required and protected, and all
  credential material.
- Define retention for expired callback and pending-link rows.

## Current findings to resolve

| Severity | Finding |
| --- | --- |
| Blocker | SDK request field and response parser do not match the deployed route |
| Blocker | SDK callback validation does not compare the expected state |
| Blocker | No active Vibe confidential client credential; modern protocol is disabled |
| High | SDK cannot express required fresh and agent-attribution flows |
| High | `requireAdminSession()` does not recheck current role/link for server pages |
| High | Vibe identity records are not linked to Better Auth users |
| High | ri0 session creation uses private Better Auth internals |
| High | Environment allowlist bypasses/reanimates a revoked database admin link |
| Medium | Vibe callback state is one cookie, not durable or multi-tab safe |
| Medium | Legacy identity-link upsert suppresses database failures |
| Medium | Current logout mutates on GET and clears only the custom cookie |
| Medium | Identity-link migration confirmation does not use fail-closed runtime mode |
| Medium | SDK HTTPS default and artifact-cookie override do not fail closed for unknown/unsafe runtime configuration |
| Low | Runtime SDK symbol-presence checks can pass while client and route disagree |
