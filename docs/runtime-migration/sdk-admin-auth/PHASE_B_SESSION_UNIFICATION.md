# Phase B — Viby-to-Better Auth session unification

## Decision and containment

Phase B makes successful human Viby administrator login create the same Better
Auth session used by Phase A password login. Viby proves identity, Better Auth
owns the application session, and `admin_authorizations` remains authoritative.

## Phase B.1 authoritative freshness and rollback hardening

Human administrator login requires the additive authoritative Viby redemption
contract from `phase-viby-authoritative-freshness`. Application context,
`freshIdentity`, and `context.forceIdentityCheck` request freshness but never
prove it.

The application requires a human `host_app_entry` assertion, matching
application audience, registered `admin` effective mode, exact callback state,
server-owned identity session ID, `issued_at`, `expires_at`, and authoritative
`verifiedAt`, `freshVerification`, and `verificationKind` claims. Fresh
authentication is accepted only when `freshVerification` is true,
`verificationKind` is `fresh`, and `verifiedAt` is no more than five minutes
old. Assertion expiry governs redemption; `verifiedAt` governs maximum
authentication age.

Legacy mode changes only the session mechanism. It requires the same active
identity link and live `admin_authorizations` lookup as Better Auth mode. An
allowlist entry or identity link never grants administrator authorization.

Identity links with dependent Viby session provenance cannot be deleted because
the provenance foreign key is restrictive. Operators revoke links instead.
Revocation immediately blocks linked sessions through the principal resolver.

The migration validates Phase B tables, columns, uniqueness, indexes, foreign
keys, operation checks, defaults, and the restrictive provenance relationship.
Structurally incompatible tables stop migration. The Better Auth plugin checks
the pinned version, required adapter methods, and cookie helper during
initialization. Sanitized callback diagnostics use transaction correlation IDs
without logging assertions, state, cookies, or credentials.

## Phase B.2 interactive account linking

Operator-provisioned links remain the preferred controlled workflow. When a
freshly verified Viby subject has no link, the browser may now complete an
interactive link:

1. Phase B.1 validates Viby’s authoritative fresh-verification contract.
2. The application creates a ten-minute, one-time pending-link transaction
   bound to the Viby session, application environment, callback correlation,
   and an HttpOnly browser-binding cookie.
3. The user authenticates an existing Better Auth account through the normal
   password or GitHub flow.
4. Authentication must be no more than ten minutes old.
5. A confirmation page names the authenticated account and shows only a
   redacted Viby identity label.
6. A same-origin POST atomically consumes the transaction and creates the
   one-to-one identity link.

Email addresses, display names, team ownership, GitHub ownership, existing
cookies, and administrator roles are never used to infer a link. The browser
never supplies a Better Auth user ID.

Subject conflicts, user conflicts, expired or replayed transactions, browser
binding mismatches, account changes, and revoked links fail closed. Identical
active links are idempotent. Revoked links require the operator workflow and
cannot be reactivated interactively. Cancellation creates neither a link nor an
authorization.

**Linking a Viby identity to a Better Auth account does not grant administrator
access.** After linking, the existing Better Auth session continues and the
central principal resolver performs its normal live `admin_authorizations`
lookup. A linked user without a grant receives the authenticated-but-
unauthorized result.

The additive `viby_identity_link_transactions` table contains only token and
browser-binding digests plus server-owned link evidence. Expired rows can be
removed with a bounded operator cleanup after the audit-retention period:
`DELETE FROM viby_identity_link_transactions WHERE expires_at < ? AND status !=
'pending'`. Rollback keeps the additive table and disables the interactive path
by returning the deployment to legacy mode or the previous application release.

The first attempt stopped because Better Auth 1.6.25 has no top-level
`createSessionForUser` API. Better Auth's own SIWE and magic-link plugins show
the framework-integrated pattern: a `createAuthEndpoint` handler calls
`ctx.context.internalAdapter.createSession`, then the exported
`setSessionCookie` helper. The project accepts that single version-pinned seam.

`lib/auth/viby-authentication-plugin.ts` is the only module allowed to call the
adapter method. It accepts no browser user ID, consumes a random one-time
server-bound handoff, confirms the linked user, creates the session, records
provenance, and uses `setSessionCookie`. No session row, token, signature, or
Better Auth cookie is manually constructed. The adapter preserves configured
expiry, request IP/user-agent extraction, database hooks, and storage behavior.

Better Auth and its Drizzle adapter are pinned to exactly `1.6.25`. Better Auth
upgrades are security-sensitive integration changes and must not be performed
by routine dependency automation without Phase B requalification.

## ri0 comparison

The audited ri0 baseline on doro was `main` at
`6890ff4439827328acc229350cae0d68d9f6d8b0`, using Better Auth 1.6.17.
`lib/author-viby-session.ts` reaches through `(auth as any).$context`, invokes
`internalAdapter.createSession`, manually reproduces Better Auth's HMAC cookie,
and writes it with `NextResponse`. Its author callback uses legacy assertion
GET, and its link page can link a pending Viby identity after password login.

Phase B reuses only the adapter/session insight. It uses a first-class plugin,
the exported cookie helper, confidential redemption, durable one-time
transactions, and operator-only linking.

## Protocol and durable state

Unified mode POSTs `{"assertion_id":"…"}` to
`/api/identity/assertions/redeem` with the server-only Viby client credential
and parses the deployed `assertion`, `user`, `identity`, and `payload` envelope.
It validates audience, human admin operation, expiration, subject, fresh
verification evidence, and application ownership. Agent and artifact callbacks
remain independent provenance flows and cannot invoke the session plugin.

The additive migration extends `viby_identity_links` with application, status,
link provenance, and last-authenticated fields. It adds:

- `viby_login_transactions`, containing state and browser-binding hashes,
  operation, destination, audience, freshness, expiry, and atomic consumption;
- `viby_session_handoffs`, containing a short-lived token hash bound to the
  transaction, identity link, user, operation, and destination;
- `admin_session_provenance`, binding a Better Auth session ID to
  `better_auth_viby`, its identity link, and a subject digest.

Database uniqueness makes Viby-subject and Better Auth-user mappings
unambiguous within the application. No link is inferred from email.

## Operator workflows

The migration requires an existing canonical local SQLite target and exact:

```text
MIGRATE VIBY BETTER AUTH DATABASE /absolute/path/database.sqlite
```

`npm run admin:manage-viby-link` requires an exact subject, exact Better Auth
user ID, and target-bound `LINK VIBY ADMIN …` confirmation. Revocation requires
target-bound `REVOKE VIBY ADMIN …` confirmation. Identical active links are
idempotent; conflicts and revoked links are never replaced or reactivated
silently.

## Transition, authorization, and logout

`VIBE_VIBY_SESSION_MODE` supports `legacy` (default), `better-auth`, and
`disabled`. Unified success creates no `vibe_admin_session` and clears a stale
one. Logout revokes Better Auth through its API and clears legacy and transient
cookies. Independent simultaneous identities continue to fail closed.

Link revocation immediately prevents new Viby login and blocks a Better Auth
session carrying that link's Viby provenance. Password/GitHub sessions remain
independent. An active `admin_authorizations` grant is still required on every
protected page and API request.

## Deployment and rollback

Before deployment: provision a dedicated Viby confidential credential; ensure
the registration permits confidential redemption without changing callbacks or
modes; back up the explicit database; run and rerun the additive migration;
create the exact operator link; and deploy an immutable release in `legacy`
mode. After password and legacy checks, switch to `better-auth` in a maintenance
window and qualify login, logout, role/link revocation, replay, agent, and
artifact paths.

Rollback sets the mode to `legacy` and restores the prior immutable release.
The old release ignores the additive schema, so database restore is not normally
needed; retain the verified predeployment backup.

Retiring `vibe_admin_session` requires separate approval after the compatibility
window, successful production qualification, expiry or revocation of legacy
sessions, and dedicated removal tests. A future supported Better Auth
external-session API can replace the seam. A standards-compliant Viby
OAuth/OIDC provider could later use Generic OAuth, but is outside Phase B.

## Phase B.2.1 unbound legacy identity claims

The first non-production Phase B.2 rollout failed closed because qualified
legacy Viby login had already created an active `viby_identity_links` row for
the verified subject, but that historical row had no `local_user_id`. Creating
a second row would violate subject uniqueness, while replacing or deleting the
row would discard history.

Phase B.2.1 recognizes only one narrow compatibility state: exactly one active
Viby row for `vibe-hackathon`, an unbound local user, operator creation
provenance, no binding provenance, no revocation, and no incompatible
environment metadata. The deployment database supplies the environment
boundary until a successful claim records its exact HTTPS origin. Unknown,
duplicated, transferred, differently scoped, or revoked rows remain
unclaimable.

After authoritative fresh Viby verification, the application stores a
`claim_unbound_legacy_link` pending transaction and a companion
`viby_legacy_identity_claims` record bound to the exact server-resolved link
row. Normal Better Auth authentication selects the target user. The
confirmation screen identifies the account and deployment while exposing only
a subject digest suffix.

Confirmation conditionally updates the existing row inside the same SQLite
transaction that consumes the pending request. It requires the original row to
remain active, unbound, unrevoked, and unchanged. The update preserves
`created_at` and `link_provenance`, then records the authenticated Better Auth
user, exact environment, `binding_provenance=interactive_legacy_claim`, and the
binding, verification, authentication, and update times.

Concurrent claims by different users fail closed. A second transaction is
idempotent only when the exact row is already bound to the exact same user,
subject, application, environment, and binding method. Cancellation leaves the
historical identity row unchanged.

**Claiming an unbound legacy Viby identity connects identity records only. It
does not grant administrator access.** The legacy `role=admin` value is
historical and non-authoritative. Every page and API request still requires a
live `admin_authorizations` grant through the central principal resolver.

Run the read-only live-data count inspection with explicit boundaries:

```bash
DB_FILE_NAME=/absolute/path/to/database.sqlite \
VIBE_LINK_ENVIRONMENT=https://application.example \
npm run db:inspect:viby-links
```

Deploy by retaining the previous release, applying and rerunning the Phase B
migration against the explicit existing database, validating the claimable
count, and starting in `better-auth` mode. Qualify cancellation first, then
fresh verification, Better Auth authentication, explicit claim, authorization
separation, subsequent fast path, replay rejection, and logout. Rollback
restores the prior release and `legacy` mode; additive schema and a completed
identity binding are retained for audit. Expired transactions are removed by
the existing expiration cleanup process.

## Phase B.3 closeout — GO

Phase B.3 makes authenticated Admin navigation an ordinary
`/admin/dashboard` navigation and exposes the qualified application logout in
the global account control. The Admin Identity card remains the detailed
provenance surface; the desktop and mobile global controls intentionally show
only the authenticated display name and `Log out`.

The final non-production release was qualified in `better-auth` mode. At 1024,
1280, and 1440 CSS pixels, the authenticated account control remains visible,
does not overlap the theme selector, and introduces no horizontal header
overflow. At narrower widths the same name and logout action are available in
the mobile navigation without a provenance subtitle.

Focused identity-display tests passed. The Phase B desktop and mobile Chromium
suite passed all 12 cases, including linked Viby login, password login,
ordinary repeated Admin navigation, global logout, callback replay rejection,
interactive linking, unbound legacy claiming, cancellation, and authorization
separation. Standalone TypeScript, the production build, changed-file ESLint,
and `git diff --check` also passed. Live public-origin password authentication,
repeated Admin navigation, desktop/mobile layout, logout, protected-route
denial, and local/public health were requalified after deployment.

The production Viby Runtime and authentication architecture were not modified.
The previously qualified live Viby flow remains unchanged, and its application
integration paths passed the Phase B browser regression suite. Phase B.3 is
therefore closed with a **GO** recommendation.
