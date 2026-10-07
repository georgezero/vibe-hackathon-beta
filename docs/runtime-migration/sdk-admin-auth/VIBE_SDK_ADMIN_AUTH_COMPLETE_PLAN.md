# Vibe Hackathon Viby SDK and Admin Authentication Modernization — Complete Planning Package

This single-file package combines the complete audit and implementation plan from `docs/runtime-migration/sdk-admin-auth/` for review in an external chat. The individual source documents remain authoritative and unchanged.

## Contents

- [Viby SDK and Admin Authentication Modernization Plan](#viby-sdk-and-admin-authentication-modernization-plan)
- [Current Vibe Hackathon Authentication Architecture](#current-vibe-hackathon-authentication-architecture)
- [ri0 Reference Audit](#ri0-reference-audit)
- [Deployed Runtime SDK Audit](#deployed-runtime-sdk-audit)
- [Target Authentication Architecture](#target-authentication-architecture)
- [Account Linking Design](#account-linking-design)
- [Admin Session Migration](#admin-session-migration)
- [Agent and Artifact Callback Boundary](#agent-and-artifact-callback-boundary)
- [Database Migration Plan](#database-migration-plan)
- [Security and Privacy Requirements](#security-and-privacy-requirements)
- [Implementation Phases](#implementation-phases)
- [Test Plan](#test-plan)
- [Deployment and Rollback](#deployment-and-rollback)
- [Open Decisions](#open-decisions)

---

<!-- Source: README.md -->

# Viby SDK and Admin Authentication Modernization Plan

Status: audit and planning only

Audit date: 2026-07-28

Decision: **CONDITIONAL GO**

This package describes how Vibe Hackathon can move from its custom Viby admin
cookie and hand-written assertion client to a Better Auth application session
with a linked Viby identity. It does not authorize implementation, a database
migration, Runtime changes, credential provisioning, or deployment.

## Frozen audit baselines

| Component | Audited baseline |
| --- | --- |
| Vibe Hackathon canonical source | `main` at `65615e5d638f7fba0a81b12d5e3d74503d1c3d8e` |
| Vibe Hackathon deployed behavior | release `1cc6394713aaef32425d763772f1e4b75857bdcc`; later canonical changes are documentation and a judge test typing correction |
| Vibe Hackathon production origin | `https://vibe-hackathon-dev.ggg.ad` |
| Shared Runtime | `https://viby.keit.ai` |
| Runtime deployed source | `phase-9-runtime-connected-apps` at `172963e82110fad2d5336e2d73847f429906beb9` |
| Runtime service | `viby-runtime-keit-ai.service` on moofi; inspected read-only |
| ri0 reference | `main` at `6890ff4439827328acc229350cae0d68d9f6d8b0` on doro |
| Better Auth in Vibe | `1.6.25` |

At audit time the public Vibe health endpoint returned HTTP 200, the shared
Runtime root returned HTTP 200, and neither service was changed.

The Vibe repository also contained the pre-existing untracked protected backup
`local.db.pre-p0-4.bak`. It was not opened or changed. Its retention and secure
disposal must be resolved operationally before any authentication schema
migration.

## Principal conclusion

The target responsibility boundary is sound:

- Viby verifies identities, issues assertions, enforces assertion expiry and
  single redemption, and performs fresh verification.
- Vibe Hackathon owns Better Auth users and sessions, application roles,
  identity links, admin authorization, judge authorization, agent attribution,
  and artifact provenance.

The current Runtime SDK cannot yet be adopted directly. The deployed SDK sends
the wrong JSON field to the deployed redemption route, parses a response shape
the route does not return, does not compare callback state with the caller's
stored state, lacks fresh-verification launch options, and models only a human
payload. The current `vibe-hackathon` Runtime registration also has no active
confidential client credential. These are pre-implementation gates.

## Documents

- [CURRENT_AUTH_ARCHITECTURE.md](CURRENT_AUTH_ARCHITECTURE.md)
- [RI0_REFERENCE_AUDIT.md](RI0_REFERENCE_AUDIT.md)
- [RUNTIME_SDK_AUDIT.md](RUNTIME_SDK_AUDIT.md)
- [TARGET_AUTH_ARCHITECTURE.md](TARGET_AUTH_ARCHITECTURE.md)
- [ACCOUNT_LINKING_DESIGN.md](ACCOUNT_LINKING_DESIGN.md)
- [ADMIN_SESSION_MIGRATION.md](ADMIN_SESSION_MIGRATION.md)
- [AGENT_AND_ARTIFACT_CALLBACK_BOUNDARY.md](AGENT_AND_ARTIFACT_CALLBACK_BOUNDARY.md)
- [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md)
- [SECURITY_AND_PRIVACY_REQUIREMENTS.md](SECURITY_AND_PRIVACY_REQUIREMENTS.md)
- [IMPLEMENTATION_PHASES.md](IMPLEMENTATION_PHASES.md)
- [TEST_PLAN.md](TEST_PLAN.md)
- [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md)
- [OPEN_DECISIONS.md](OPEN_DECISIONS.md)

Recommended implementation branch after all prerequisite decisions are
approved: `phase-vh-m5-sdk-admin-auth`.

---

<!-- Source: CURRENT_AUTH_ARCHITECTURE.md -->

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

---

<!-- Source: RI0_REFERENCE_AUDIT.md -->

# ri0 Reference Audit

Audited read-only on doro:

- repository: `/home/george/Downloads/src/ai/ri0/ri0-dev`
- branch: `main`
- commit: `6890ff4439827328acc229350cae0d68d9f6d8b0`
- subject: `doro-ri0: require fresh Viby verification for author login`
- committed tree: clean

The checkout had unrelated untracked local assets. Only committed files at the
audited commit informed this review.

## Reusable concepts

### Dual-login presentation

`app/login/page.tsx`, `components/reader/VibyVerifyButton.tsx`,
`components/auth/AuthDivider.tsx`, and
`components/auth/EmailPasswordSignInForm.tsx` present Viby as the primary
identity option and Better Auth email/password as the other login option.

Vibe can reuse the concept, not the styling or provider choice. Vibe currently
has GitHub OAuth rather than email/password.

### Linked-returning-user flow

`app/api/viby/author-callback/route.ts` redeems a Viby identity and queries
`author_identity_links`. A linked identity enters the application; an unlinked
identity gets a short-lived pending-link record and is redirected to
`/login/link-viby`.

`app/login/link-viby/actions.ts` requires a successful Better Auth
email/password login before inserting the Viby identity link. This is the right
high-level ownership proof: a Viby identity alone must not select an arbitrary
local account.

### Local logout plus fresh Viby re-entry

`components/layout/AppShell.tsx` signs out of Better Auth and marks the next
Viby login as fresh. `app/login/page.tsx` consumes the marker and starts Viby
with fresh verification.

Vibe should retain the distinction between local application logout and
Runtime identity logout, but should not depend on localStorage for a security
property.

## ri0 implementation details not to copy

### Private Better Auth session creation

`lib/author-viby-session.ts` reaches into `(auth as any).$context`, calls
`internalAdapter.createSession()`, reimplements Better Auth's cookie signature,
and writes the cookie itself. This is coupled to Better Auth internals and must
not be copied.

Vibe should implement a supported Better Auth plugin/endpoint extension using
the versioned exported API, or obtain an upstream-supported custom-provider
path. Better Auth 1.6.25 exports `createAuthEndpoint` and cookie helpers, but a
small compatibility spike and tests are required before choosing the exact
mechanism.

### Hand-written Runtime protocol

`lib/viby.ts` and `app/api/viby/start/route.ts` use the legacy GET protocol.
ri0 does not import the deployed Runtime SDK at this audited commit.

### Pending-link cookie

`lib/pending-viby.ts` stores identity data in a signed cookie and falls back to
the literal `dev-secret` when two environment secrets are absent. It is not a
durable, one-time, server-consumed transaction and the fallback is not suitable
for Vibe's fail-closed runtime model.

### Incomplete link invariants

`lib/db/schema.ts` gives `author_identity_links` uniqueness on provider and
provider user ID. It does not enforce one Viby identity per local author, and
`app/login/link-viby/actions.ts` performs a read followed by an insert without
an explicit transaction.

If another account already owns the Viby identity, the action does not report a
conflict and the newly signed-in user continues without owning that link.
Vibe needs atomic conflict handling and explicit user feedback.

### Callback state

The ri0 start route generates a `request_id` in the callback URL, but the
audited callback does not validate or consume that request ID. This is not a
model for callback CSRF protection.

## Better Auth reference

`lib/auth.ts` uses Better Auth 1.6.17, Drizzle, `nextCookies()`, and
email/password. `lib/auth-guard.ts` protects author pages by calling
`auth.api.getSession()`. Application middleware is not the primary auth guard.

The most valuable lesson is separation:

- Better Auth owns the local user session.
- A provider identity link selects the existing local user.
- Application page guards consume the Better Auth session.

The unsafe part is the private method used to manufacture that session.

## ri0 tests

Relevant tests are:

- `tests/e2e/author-login.spec.ts`
- `tests/e2e/viby-callback.spec.ts`
- `tests/e2e/viby-author-consent.spec.ts`
- `tests/e2e/logout.spec.ts`
- `tests/unit/viby-log-privacy.test.ts`

They demonstrate the intended user journey but do not cover atomic duplicate
linking, concurrent linking, pending-link replay, or public-API compatibility
for the session-creation mechanism.

## Applicability to Vibe

Conceptually reusable:

- two explicit login choices;
- pending-link confirmation by an already authenticated local user;
- direct return for an existing link;
- local logout followed by an explicit fresh-verification choice.

Application-specific or unsuitable:

- ri0 email/password UI;
- ri0 author schema and route names;
- private Better Auth session construction;
- signed pending-link cookie;
- legacy Runtime client;
- localStorage as the freshness control.

---

<!-- Source: RUNTIME_SDK_AUDIT.md -->

# Deployed Runtime SDK Audit

## Deployed source

The production Runtime was inspected read-only on moofi.

- service: `viby-runtime-keit-ai.service`
- source root: `/home/george/Downloads/src/ai/faceblur/viby-runtime-apps`
- working directory: `web`
- branch: `phase-9-runtime-connected-apps`
- commit: `172963e82110fad2d5336e2d73847f429906beb9`
- subject: `viby-runtime: document dual-protocol compatibility`
- Runtime web version: `0.1.0`
- source SDK: `web/lib/viby-client/index.ts`

The SDK is source code inside the Runtime repository. It is not a versioned npm
dependency consumed by Vibe or ri0.

## Public surface at the deployed commit

`web/lib/viby-client/index.ts` exports:

- `VibyClient`
- `createVibyClient()`
- `createVibyClientFromEnv()`
- `beginLogin()`
- `validateCallbackParams()`
- `redeemAssertion()`
- `logoutUrl()`
- `createLoginState()`
- `verifyLoginState()`
- `parseVibyEnvVars()`
- `validateVibyClientConfig()`

Configuration uses `VIBY_BASE_URL`, `VIBY_CLIENT_ID`,
`VIBY_CLIENT_SECRET`, and `CALLBACK_URL` or `APP_URL`.

The SDK is server-only, uses a confidential Basic-auth client credential,
limits redemption responses, and disables automatic redirect following.

## Runtime-owned behavior

The deployed Runtime's `web/lib/identity/assertion-redemption.ts`:

- validates assertion identifier syntax;
- binds the assertion to the registered application and audience;
- validates mode and callback registration;
- checks expiry;
- atomically sets `consumed_at`;
- returns 409 for replay;
- returns 410 for expiry;
- emits a non-secret audit event.

`web/lib/identity/client-credentials.ts` generates 256-bit random client
secrets, stores a peppered HMAC digest and hint, supports expiry/revocation, and
uses constant-time digest comparison.

Fresh verification is supported by the Runtime start page through
`freshIdentity=1` and equivalent launch flags. It is not represented in the
SDK's `BeginLoginOptions`.

## Blocking compatibility defects

### Request field mismatch

The SDK's `redeemAssertion()` sends:

```json
{ "assertionId": "..." }
```

The deployed route `web/app/api/identity/assertions/redeem/route.ts` accepts
only:

```json
{ "assertion_id": "..." }
```

The SDK therefore receives `400 invalid_assertion_id`.

### Response-shape mismatch

The deployed route returns a nested envelope containing `assertion`, `user`,
`identity`, and `payload`. The SDK looks for top-level `user_id`, `mode`,
`issued_at`, and related fields. Even after correcting the request field, the
SDK would return `missing_user_id`.

### State comparison defect

`validateCallbackParams(params, expectedState)` does not compare the incoming
state to `expectedState`. It only checks that the incoming state has a valid
HMAC under the client secret. A different previously generated state can pass.

The SDK state is also stateless: it has no expiry field, server-side
transaction record, or atomic consumed marker.

### Runtime-mode fail-open default

SDK HTTPS enforcement defaults to `NODE_ENV === "production"`. A missing or
unknown runtime value therefore disables the default HTTPS requirement. Vibe
must pass an explicit production-safe setting, and a corrected SDK should adopt
an explicit fail-closed runtime policy.

### Missing Vibe launch and payload capabilities

`BeginLoginOptions` cannot express:

- `freshIdentity`;
- launch context;
- preferred actor;
- explicit agent selection.

`AssertionPayload` models a human at top level and does not model the deployed
agent-attribution payload. It cannot safely replace
`verifyVibyAgentAttributionAssertion()` as written.

### Logout helper mismatch

`logoutUrl()` returns `/identity/logout`. No such deployed route was found.
The Runtime has an interactive `/logout` page whose behavior is client-side and
does not implement the SDK's `return_to` contract.

## Test quality

`web/scripts/check-connected-app-dx.ts` checks that SDK symbols and documentation
strings exist. It does not execute request serialization, response parsing,
state equality, expiry, or logout routing.

`web/scripts/check-assertion-protocol-compatibility.ts` tests the Runtime
redemption core directly, not the SDK client against the route. This explains
why the client/route mismatch can coexist with passing Runtime checks.

No behavioral SDK unit test was found for the incompatible paths above.

## Registration compatibility

The live `vibe-hackathon` registration is active and retains the qualified
legacy flow:

- modes: `admin`, `agent-attribution`;
- production callbacks:
  `/admin/viby/callback`, `/admin/viby/agent-callback`,
  `/admin/viby/artifact-callback`;
- legacy GET enabled;
- modern POST disabled by the qualified registration contract.

At audit time it had zero active confidential client credentials. Modern SDK
redemption therefore cannot authenticate even after SDK code corrections.

## Required Runtime-owned prerequisite

Before Vibe adopts this SDK, the Runtime owner should produce a versioned,
tested client artifact or an immutable vendored source revision that:

1. uses the deployed request and response contract;
2. compares exact callback state and supports durable caller consumption;
3. exposes fresh-verification and launch-context options;
4. returns a typed human/agent assertion union without weakening audience,
   mode, actor, or delegation checks;
5. defines a real logout route contract;
6. fails closed for HTTPS under missing/unknown runtime configuration;
7. has route-level integration tests;
8. is deployed compatibly before Vibe switches protocols.

The Runtime registration must then receive a Vibe-specific confidential
credential and explicitly permit the modern redemption protocol. That is a
coordinated Runtime operation, not an application migration side effect.

---

<!-- Source: TARGET_AUTH_ARCHITECTURE.md -->

# Target Authentication Architecture

## Boundary

The modernization must preserve this boundary:

| Runtime owns | Vibe Hackathon owns |
| --- | --- |
| Face/identity verification | Better Auth users and sessions |
| Assertion issuance and expiry | Identity links |
| Single-use assertion redemption | Admin and judge roles |
| Fresh identity verification | Page and API authorization |
| Registered audience, mode, callback | Team/submission ownership |
| Runtime identity-session lifecycle | Agent action meaning |
| Confidential connected-app credential verification | Artifact provenance and persistence |

Vibe must not reproduce face verification, Runtime session state, or assertion
replay protection. Runtime must not decide who is a Vibe admin, judge, team
owner, or submission editor.

## Target components

### Runtime client adapter

A thin server-only module should wrap the corrected, versioned Runtime SDK. It
should expose application-oriented operations without reimplementing protocol:

- begin admin verification;
- begin agent attribution;
- begin artifact attribution;
- validate callback transport and exact application transaction;
- redeem a human or agent assertion once;
- map Runtime error categories to non-sensitive application outcomes.

It must not know Vibe roles or create Better Auth sessions.

### Callback transaction store

Replace the single signed callback cookie with database-backed one-time
transactions. Store only a digest of a 256-bit random browser nonce.

Each record binds:

- flow and callback path;
- safe relative return path;
- expected Runtime mode and actor policy;
- initiating Better Auth user/session when present;
- project and artifact type when relevant;
- creation, expiry, and consumed timestamps;
- outcome category, without assertion or credential values.

The browser cookie carries only the opaque nonce and a transaction identifier.
Consumption must be atomic and must occur in the same application operation
that accepts the callback result.

### Better Auth principal

The Better Auth session identifies the local user. It does not imply admin
authorization.

A central `AdminPrincipal` resolver should:

1. obtain the Better Auth session through `auth.api.getSession()`;
2. load the active application role;
3. load the active Viby identity link and its current status;
4. enforce any required recent Viby verification;
5. return a normalized principal used by both server pages and `withAdminApi()`.

The existing centralized admin route policy registry, Origin checks, and audit
behavior remain in place.

### Identity link

An identity link maps the stable Runtime provider subject to one Better Auth
user. Authorization is a separate application role decision.

The target must not rely on display name, tag, email, client-supplied local user
ID, or request query data for the link.

### Admin role

Admin access remains explicitly application-owned and revocable. The existing
environment allowlist may bootstrap a reviewed link during a bounded migration,
but it must not remain an alternative permanent authorization plane.

## Login paths

### Better Auth first

The user signs in through the existing GitHub Better Auth flow. A user with an
active admin role can use the application. If policy requires a recent Viby
verification, the application redirects to the step-up flow.

### Viby first

The user verifies with Viby.

- Existing active link: issue a Better Auth session for the linked user through
  a supported Better Auth extension, then evaluate the application role.
- No link: create a short-lived pending-link transaction and require Better
  Auth GitHub sign-in before an explicit link confirmation.
- Revoked/conflicting link: deny without identifying the account that owns it.

### Logged-in account linking

An authenticated Better Auth user explicitly starts “Link Viby.” The callback
transaction is bound to that user and current session. A successful fresh Viby
assertion creates the link atomically if no conflicting link exists.

## Better Auth integration surface

Better Auth 1.6.25 exports `createAuthEndpoint` and cookie helpers, and its
first-party plugins create sessions inside registered endpoints. It does not
expose a simple public `auth.api.createSessionForUser()` method in the installed
version.

Implementation must begin with a small compatibility proof using a supported
custom Better Auth plugin/endpoint. It must not:

- use `(auth as any).$context`;
- duplicate Better Auth cookie signing;
- write the session token cookie manually;
- invoke a private route from a browser with a user ID.

If the installed version cannot support a versioned custom provider/endpoint
without private APIs, stop and coordinate an isolated Better Auth upgrade or
upstream provider adapter. Do not copy ri0's workaround.

## Fresh verification

Fresh verification is a Runtime operation. Vibe should:

- request it for admin login and sensitive step-up;
- bind that request to a one-time callback transaction;
- accept Runtime evidence only from a redeemed assertion for the expected mode;
- record `lastFreshVerifiedAt` or equivalent application assurance metadata;
- enforce a separately approved maximum age for sensitive actions.

Vibe should not infer freshness from a display value, browser flag, or the mere
existence of a Viby link.

## Logout

Provide two explicit operations:

- **Sign out of Vibe Hackathon:** revoke the current Better Auth session, clear
  legacy admin and callback cookies, and remain independent of Runtime.
- **Sign out of Vibe and Viby:** perform local logout, then use a verified
  Runtime logout contract when one exists.

The Runtime SDK's current logout helper is not deployable and must not be used
until the Runtime supplies a real, validated route.

## Request flow

```text
Browser
  -> Vibe begin endpoint
     -> durable callback transaction
     -> Runtime start URL
  -> Runtime verification and consent
  -> Vibe callback with opaque assertion ID + state
     -> consume exact callback transaction
     -> corrected SDK redemption (server to server)
     -> resolve/create identity link
     -> supported Better Auth session endpoint
     -> central AdminPrincipal authorization
  -> protected Vibe page/API
```

---

<!-- Source: ACCOUNT_LINKING_DESIGN.md -->

# Account Linking Design

## Invariants

1. A Runtime subject maps to at most one local Better Auth user.
2. A local user maps to at most one active Viby identity unless an explicit
   multi-identity policy is approved.
3. A link alone grants no role.
4. A request body, query string, display name, email, or browser state never
   selects the local user.
5. Link creation and conflict checks are one database transaction.
6. Revocation immediately prevents Viby-first login and admin authorization.
7. Link recovery is an audited organizer operation, not an automatic overwrite.

## First-time Viby-first flow

1. Browser starts a Viby login transaction.
2. Runtime performs the requested verification and returns an assertion.
3. Vibe atomically consumes its callback transaction and redeems the assertion.
4. Vibe looks up `(provider=viby, subject_id)`.
5. If no link exists, Vibe creates a short-lived server-side pending-link row
   containing the provider subject, verification metadata, transaction
   identifier, and expiry. Store no assertion or client credential.
6. Vibe redirects to the Better Auth GitHub sign-in flow.
7. After Better Auth returns, Vibe requires explicit “Link this Viby identity
   to this account” confirmation.
8. A transaction rechecks the pending link, Better Auth session, provider
   uniqueness, local-user uniqueness, expiry, and role eligibility.
9. Vibe creates the link, consumes the pending record, and records an audit
   event.
10. Admin access is granted only if the local user has an active admin role.

The pending-link transaction must be bound to the Better Auth flow state after
GitHub sign-in starts. An attacker must not be able to sign in separately and
claim another browser's pending identity.

## Returning linked user

1. Redeem a fresh Runtime assertion.
2. Resolve the one active link.
3. Reject missing, revoked, or conflicting data.
4. Create a Better Auth session through the approved extension.
5. Rotate away any pre-existing anonymous or lower-assurance application
   session to prevent fixation.
6. Evaluate the application role.

A linked non-admin may sign in to application features their local account is
authorized to use, but must receive no admin access.

## Logged-in Better Auth user linking Viby

1. Require a current Better Auth session.
2. Start a fresh Viby flow bound to the user ID and session token digest.
3. Redeem and verify the callback.
4. In one transaction, reject:
   - a subject linked to another user;
   - another active subject linked to this user when one-per-provider applies;
   - an expired/consumed callback transaction;
   - a changed or revoked Better Auth session.
5. Create the link and update assurance metadata.

The UI must display only the verified display label and make clear that linking
does not itself grant organizer privileges.

## Unauthorized user

An identity absent from the bootstrap allowlist and without an active admin role
may link to its own Better Auth account only if general account linking is an
approved feature. It must not gain admin access.

For a narrowly admin-only launch, the safer first release is:

- allow linking only for users already assigned an admin role, or
- allow a reviewed bootstrap subject to create the initial link and role in a
  one-time audited migration operation.

Do not persist a new durable admin role merely because a subject appeared in an
environment allowlist during a normal login.

## Duplicate and conflicting links

| Condition | Result |
| --- | --- |
| Same subject, same user, active | Idempotent success |
| Same subject, different user | Conflict; no identifying detail |
| Different subject, same user | Conflict unless multi-identity policy approved |
| Existing revoked link | Recovery required; never silently reactivate |
| Pending link consumed/expired | Restart linking |
| Two concurrent creates | Unique constraint selects one winner; loser gets conflict |

No “last write wins” behavior is permitted.

## Recovery

Recovery requires an authenticated, authorized admin who is not modifying their
only active recovery path, or an offline operator procedure.

The runbook should support:

- inspect non-secret link and role metadata;
- revoke a link;
- assign a replacement pending link;
- invalidate related Better Auth sessions;
- record actor, target, reason, timestamp, and outcome;
- preserve a rollback record without preserving Runtime assertions.

Display-name changes are profile updates, not identity changes.

## ri0 comparison

ri0 implements the useful Viby-first → Better Auth login → link sequence in
`app/api/viby/author-callback/route.ts` and
`app/login/link-viby/actions.ts`. It does not solve transactional conflicts,
one-link-per-user, durable pending state, or supported Better Auth session
creation. Those gaps are explicit requirements here.

---

<!-- Source: ADMIN_SESSION_MIGRATION.md -->

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

---

<!-- Source: AGENT_AND_ARTIFACT_CALLBACK_BOUNDARY.md -->

# Agent and Artifact Callback Boundary

## Classification

| Callback | Purpose | Better Auth session creation |
| --- | --- | --- |
| `/admin/viby/callback` | Human admin authentication/step-up | Yes, only after link and role checks |
| `/admin/viby/agent-callback` | Attribute an action to a registered human-owned agent | Never |
| `/admin/viby/artifact-callback` | Produce provenance for a specific project artifact | Never |

Agent and artifact callbacks are not alternate login endpoints.

## Runtime responsibilities

For both provenance callbacks, Runtime must establish:

- application audience;
- `agent-attribution` mode;
- agent subject type;
- agent identifier;
- verified owner identifier;
- approved delegation relationship;
- assertion issue/expiry;
- single redemption and replay rejection.

The corrected SDK should expose a typed agent result. Vibe should not reconstruct
the Runtime protocol envelope.

## Vibe responsibilities

Vibe must establish:

- the callback transaction was initiated by the correct application flow;
- the initiating Better Auth admin session is still valid where required;
- the project and artifact type came from server-side transaction state;
- the action is permitted by Vibe policy;
- the project exists and is in an eligible state;
- the resulting audit/provenance record contains only intended public fields.

The Runtime owner's identity does not automatically receive a Vibe role.

## Browser versus machine callbacks

The current flows are browser-mediated. The launch starts from a protected admin
page and returns to a browser callback. Better Auth may be required to initiate
and view the result, but the callback's proof is state plus Runtime redemption.

If a future machine callback is required, it needs a separate authenticated
API contract. Do not reuse browser cookies, query-state cookies, or admin
callback endpoints.

## Artifact storage

The current implementation signs a short-lived artifact payload into an
HttpOnly cookie scoped to `/admin/verified-agent-artifacts`.

Modernization should decide whether this is merely a preview or a durable
provenance record:

- Preview: keep it short-lived, clear on completion, and do not claim durable
  provenance.
- Durable record: store an application-owned record with project, action,
  agent/owner stable identifiers, Runtime assertion metadata needed for audit,
  hash, timestamp, and revocation semantics. Never store the assertion ID,
  client secret, callback state, cookie, or portrait/biometric data.

The artifact signing key should be independent of a retired admin-session HMAC
secret.

## Required validation

- human payload rejected by agent callback;
- agent payload rejected by admin callback;
- wrong mode or audience rejected;
- wrong project or artifact transaction rejected;
- replay rejected at Runtime and as an already-consumed Vibe transaction;
- expired assertion rejected;
- callback cannot redirect outside the canonical application origin;
- agent callback does not establish or elevate a Better Auth session;
- logs contain no assertion IDs, credentials, state tokens, cookies, or
  sensitive identity payloads.

---

<!-- Source: DATABASE_MIGRATION_PLAN.md -->

# Database Migration Plan

This is a schema plan, not an executable migration.

## Current relevant tables

- Better Auth: `users`, `sessions`, `accounts`, `verifications`.
- Runtime authorization: `viby_identity_links`.
- Admin auditing: current audit storage used by `lib/admin-audit.ts`.

The existing link table mixes provider identity, role, profile display, and
nullable local account identity.

## Recommended target records

### `identity_links`

If renaming the existing table would create unnecessary operational risk, the
same shape may be introduced additively in `viby_identity_links`.

Required fields:

- `id`
- `provider` (`viby`)
- `provider_subject_id`
- `user_id` non-null FK to Better Auth `users`
- `status` (`active`, `revoked`, `conflict_hold`)
- `display_name` as non-authoritative profile metadata
- `linked_at`
- `last_verified_at`
- `last_fresh_verified_at`
- `revoked_at`
- `created_at`, `updated_at`

Constraints:

- unique provider plus provider subject;
- unique active provider plus user if one Viby identity per user is approved;
- no role column as the sole authorization source;
- indexed user and active-status lookups.

SQLite and libSQL must use equivalent constraints. If a cross-provider partial
unique index is not portable enough, model active status so a normal composite
unique index can enforce the invariant.

### `user_roles`

Required fields:

- `id`
- `user_id`
- `role` (`admin`; future roles only by explicit migration)
- `status`
- `granted_by`
- `granted_at`
- `revoked_by`, `revoked_at`
- `created_at`, `updated_at`

Unique user plus role prevents duplicate active authorization records. If the
project elects to keep role in the existing link table for the first bounded
release, document that this couples role recovery to provider recovery and
retain a later separation milestone.

### `auth_callback_transactions`

Required fields:

- `id`
- `nonce_hash`
- `flow`
- `callback_path`
- `return_path`
- `expected_mode`
- `expected_actor`
- initiating `user_id` and session binding when present
- optional project and artifact type
- `created_at`, `expires_at`, `consumed_at`
- `outcome`

Use 256-bit random nonces and a one-way digest. Uniqueness on the nonce digest
and an atomic `consumed_at IS NULL` update enforce one-time behavior.

### `pending_identity_links`

Required fields:

- `id`
- provider and provider subject
- originating callback transaction
- verified display metadata
- expected Better Auth flow binding
- `created_at`, `expires_at`, `consumed_at`

Do not store assertion IDs or Runtime credentials.

## Data conversion

1. Back up the exact target using the established protected-backup procedure.
2. Add target tables/columns and constraints without removing current records.
3. Resolve every active `viby_identity_links.local_user_id IS NULL` row:
   - match only through explicit operator-reviewed mapping;
   - never match by display name or email;
   - keep unresolved rows in legacy authorization state during compatibility.
4. Create or confirm the local admin role separately.
5. Validate uniqueness before adding final unique constraints.
6. Enable dual-read, new-write behavior.
7. After the compatibility window, require non-null local user IDs for active
   links and retire legacy authorization rows.

The environment allowlist is an input to an operator-reviewed bootstrap report,
not an automatic local-user matching mechanism.

## Deployment compatibility matrix

| Code | Old schema | Additive schema | Final schema |
| --- | --- | --- | --- |
| Current code | Works | Works if existing columns preserved | Must not be used |
| Dual-read code | Must fail readiness or run without new issuance | Works | Works if compatibility fields retained |
| Final code | Must fail readiness | Works after completed mappings | Works |

Use additive schema first. Do not deploy final code before all required mappings
and constraints validate.

## Migration command requirements

The current identity-link migration script uses a direct
`NODE_ENV === "production"` confirmation check. Its replacement must:

- use the central fail-closed runtime policy;
- require an explicit absolute database target;
- display and bind confirmation to a sanitized target identity;
- distinguish local SQLite from remote libSQL;
- create and verify a protected rollback backup;
- be idempotent and stage-aware;
- never print identity or secret values;
- test real SQLite transaction and interruption behavior.

Do not activate the separate P0.4 credential migration as part of this work.
The pre-existing P0.4 backup must be handled under its own runbook.

## Rollback data behavior

Additive tables can remain if application rollback occurs. Rollback should:

- stop issuing Better Auth sessions from Viby;
- restore legacy principal resolution only during the approved window;
- preserve new link and role rows for investigation;
- revoke sessions created by the failed release if their semantics are in
  doubt;
- never restore a consumed Runtime assertion or pending callback transaction.

---

<!-- Source: SECURITY_AND_PRIVACY_REQUIREMENTS.md -->

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

---

<!-- Source: IMPLEMENTATION_PHASES.md -->

# Implementation Phases

Every phase stops for review. A defect produces a bounded correction and a new
candidate; it does not broaden the live qualification run.

## Phase 1 — Audit and design

Deliverables:

- this reviewed plan;
- approved account-link and role policy;
- approved local-versus-Runtime logout behavior;
- approved fresh-verification maximum age;
- disposition plan for the protected P0.4 backup.

Exit: all decisions in `OPEN_DECISIONS.md` that affect schema or protocol are
resolved.

## Phase 2 — Runtime SDK compatibility gate

Runtime-owned, separately reviewed:

- correct request and response contracts;
- exact state comparison;
- typed human and agent results;
- fresh launch options;
- tested logout contract or explicit omission;
- behavioral route integration tests;
- immutable/versioned SDK delivery mechanism.

No registration or production deployment occurs automatically.

Exit: a deployed Runtime version remains backward compatible with the current
legacy application and passes SDK contract tests.

## Phase 3 — Better Auth foundation

Application-owned:

- prove a supported Better Auth custom provider/plugin endpoint;
- add central application principal and admin role resolution;
- protect both admin pages and APIs through the same resolver;
- preserve existing admin policy registry, Origin enforcement, judge auth, and
  team ownership.

Exit: Better Auth session issuance tests pass without private APIs or manual
cookie signing.

## Phase 4 — Identity-link schema and transactions

- additive identity-link and role schema;
- durable callback transactions;
- pending-link records;
- database uniqueness and concurrency tests;
- explicit, protected migration command;
- operator-reviewed mapping of existing admins.

Exit: old code remains compatible and all mappings are validated.

## Phase 5 — Runtime SDK integration

- add the reviewed SDK artifact;
- implement server-only adapter;
- retain legacy protocol behind a disabled-by-default rollback flag;
- add confidential credential configuration checks;
- do not yet issue Better Auth admin sessions in production.

Exit: local/disposable modern redemption tests cover human and agent assertions.

## Phase 6 — Dual-login and account linking

- Better Auth GitHub and Viby login choices;
- linked returning-user flow;
- authenticated link flow;
- unlinked pending flow;
- explicit conflicts, recovery, and logout.

Exit: full first-time and returning-user matrix passes.

## Phase 7 — Fresh verification and step-up

- request Runtime fresh verification;
- record session-bound assurance metadata;
- enforce approved age for admin entry and selected sensitive operations;
- test expired, reused, and non-fresh evidence.

Exit: Runtime owner and application owner approve evidence semantics.

## Phase 8 — Agent and artifact callback migration

- adopt typed SDK redemption without Better Auth session creation;
- preserve mode, actor, delegation, project, and artifact boundaries;
- decide preview versus durable artifact storage;
- separate artifact signing from legacy admin secret if still needed.

Exit: human/agent cross-use and replay tests pass.

## Phase 9 — Legacy admin-session retirement

- dual-read, new-write compatibility window;
- observe and clear legacy sessions;
- stop legacy acceptance;
- remove custom HMAC implementation and secret;
- retain rollback limits and audit history.

Exit: no legacy cookie issuance/use and no direct legacy Runtime redemption.

## Phase 10 — Qualification

- isolated disposable database;
- clean immutable release;
- automated security and integration matrix;
- guided human Viby and GitHub linking;
- multi-browser and multi-tab testing;
- privacy/log review;
- production non-interference review.

Exit: explicit GO with exact source and Runtime baselines.

## Phase 11 — Deployment

An additional deployment phase is justified because Runtime and application
changes have separate ownership.

1. deploy backward-compatible Runtime SDK/route correction;
2. provision/validate Vibe confidential credential and modern registration;
3. apply additive application schema in a maintenance window if required;
4. deploy application dual-read release;
5. enable new issuance;
6. retire legacy sessions after the compatibility deadline.

Exit: stable service, successful end-to-end flows, retained-log review, and
rollback window closure.

---

<!-- Source: TEST_PLAN.md -->

# Test Plan

## Runtime SDK contract

- exact `assertion_id` request serialization;
- Basic-auth credential handling without logging;
- deployed nested response parsing;
- human and agent typed payloads;
- exact expected-state equality;
- malformed and noncanonical state;
- expiry and replay statuses;
- wrong application/audience/mode;
- response size and redirect limits;
- fresh-verification launch parameters;
- logout route and return-path validation if supported.

Tests must execute the SDK against the real route orchestration, not inspect
source strings.

## Better Auth extension

- creates a session only for a server-resolved user;
- uses Better Auth's supported cookie writer;
- rotates an existing session;
- cannot be called with a browser-supplied user ID;
- rejects missing/expired/consumed provider proof;
- sign-out revokes the session and clears correct cookie scope;
- remains compatible with GitHub team-owner sessions;
- leaves judge sessions unchanged.

## Identity linking

- Viby-first existing link;
- Viby-first unlinked identity;
- logged-in Better Auth user linking;
- unauthorized user;
- same subject/same user idempotence;
- same subject/different user conflict;
- different subject/same user conflict;
- revoked link;
- expired pending link;
- callback and pending-link replay;
- concurrent link attempts on real SQLite and libSQL-compatible path;
- transaction rollback on every insert/update failure;
- request-supplied user identity ignored.

## Admin authorization

- Better Auth session without role: 403;
- role without active link under policy: 403;
- active link and role: allowed;
- revoked role/link: immediate denial on page and API;
- missing/invalid/expired session: 401 or login redirect;
- strict Origin tests unchanged;
- every admin route remains registered with `withAdminApi()`;
- server pages use the same principal resolver;
- no custom cookie claims can override the local user or role.

## Callback transactions

- exact flow/path/mode/actor binding;
- safe relative return path;
- missing and cross-tab state;
- multiple simultaneous tabs;
- atomic one-time consumption;
- timeout boundary with controlled clock;
- wrong initiating Better Auth session;
- project/artifact context cannot be overridden by query/body;
- ambiguous redemption network failure does not duplicate processing.

## Fresh verification

- fresh admin verification succeeds;
- a normal Runtime assertion cannot satisfy a fresh requirement;
- assurance expiry boundary;
- assurance bound to user and session;
- link/role/session revocation invalidates assurance;
- agent attribution remains non-fresh as registered;
- client flags cannot claim freshness.

## Agent and artifact

- agent assertion accepted for correct flow;
- human assertion rejected;
- wrong owner/delegation/mode/audience rejected;
- Runtime replay and application transaction replay rejected;
- agent callback creates no Better Auth session;
- artifact project/type from server state only;
- invalid project denied;
- artifact hash stable;
- exports and public pages omit private identifiers.

## Migration

- empty database;
- existing allowlisted admin with no local user;
- reviewed mapped admin;
- conflicting mappings;
- duplicate provider subject;
- interruption and idempotent rerun;
- backup creation/refusal/rollback;
- unknown runtime fails closed;
- local SQLite real-driver tests;
- remote libSQL path explicitly tested or explicitly refused.

## Security scans

- client and server bundles for secrets and provider identifiers;
- source maps;
- callback URLs and logs for assertions/state;
- event exports;
- secret scan;
- attribution scan;
- dependency audit for any SDK delivery change.

## Full validation

- focused auth and callback unit/integration tests;
- admin and judge route inventory;
- full unit suite;
- focused ESLint;
- clean standalone TypeScript check;
- production build;
- clean install;
- non-mutating local startup and health;
- guided browser matrix for GitHub-first, Viby-first, linking, logout, replay,
  fresh verification, agent attribution, and artifact provenance.

Do not run browser configuration that executes `db:push` against an operator
database.

---

<!-- Source: DEPLOYMENT_AND_ROLLBACK.md -->

# Deployment and Rollback

## Preconditions

- Exact application and Runtime commits reviewed.
- Corrected Runtime SDK/route behavior deployed backward compatibly.
- Current legacy Vibe flow still passes before cutover.
- Vibe-specific confidential credential created, stored only in application
  secret configuration, and tested.
- Additive schema migration validated on a production copy.
- Every legacy admin identity has an approved local-account mapping or an
  explicit no-access outcome.
- Protected database and environment backups verified.
- The pre-existing `local.db.pre-p0-4.bak` has an approved secure disposition;
  it is not bundled into a release.

## Immutable release sequence

1. Capture current application and Runtime baselines.
2. Create a clean immutable application release from the approved commit.
3. Run clean install, tests, and production build outside the mutable worktree.
4. Enter the documented application maintenance window for schema work.
5. Back up and apply only the approved additive application migration.
6. Validate schema, mappings, and rollback backup.
7. Atomically switch the application release.
8. Restart only the Vibe application service.
9. Verify local and public health before enabling new session issuance.
10. Run one reviewed account-link and admin login.
11. Monitor sanitized logs and restart count.

Do not restart Runtime during the application deployment.

## Protocol transition

Runtime protocol changes must be backward compatible:

- current legacy GET continues while the dual-read application is qualified;
- modern POST is enabled only for the Vibe registration after credential
  provisioning;
- application switches to modern redemption;
- legacy GET is disabled for Vibe only after the application compatibility
  window and rollback decision.

Do not enable modern POST and disable legacy GET in one irreversible step.

## Credential rotation

1. Create a second active Vibe client credential.
2. install it in application secret configuration without command-line or log
   exposure;
3. restart only the application and verify redemption;
4. revoke the old Runtime credential;
5. verify old credential rejection and new credential success.

## Rollback triggers

- callback state mismatch for valid flows;
- inability to redeem through the corrected SDK;
- Better Auth session not established or wrong cookie scope;
- link conflict or duplicate not handled atomically;
- role revocation not immediate;
- agent/artifact cross-use;
- unexpected login failures in the compatibility cohort;
- secret or assertion material in logs;
- build/startup/health regression.

## Rollback procedure

1. Stop new application access if database consistency is in doubt.
2. Disable new Better Auth session issuance through the reviewed feature gate.
3. Restore the previous immutable Vibe release.
4. Restore application environment metadata if it changed.
5. Restart only Vibe.
6. Keep the corrected Runtime deployed if it is backward compatible.
7. Re-enable legacy application redemption only while Runtime legacy GET remains
   allowed.
8. Revoke sessions or client credentials created by the failed release if
   their integrity is uncertain.
9. Restore the application database only when the additive migration itself
   caused corruption; otherwise preserve it for diagnosis.

Do not delete new identity-link data automatically, reactivate revoked links,
or resurrect expired legacy cookies.

## Final retirement

After at least one full legacy-cookie TTL and the approved observation window:

- verify no legacy-cookie use;
- remove legacy acceptance;
- remove `VIBE_ADMIN_SESSION_SECRET`;
- disable Runtime legacy GET for Vibe;
- destroy rollback backups according to retention policy;
- update the canonical authentication and operations documentation.

---

<!-- Source: OPEN_DECISIONS.md -->

# Open Decisions

These decisions block or materially shape implementation.

## Runtime owner

1. What versioned delivery mechanism will make the Runtime SDK consumable by
   connected applications: package, workspace artifact, or reviewed vendored
   source?
2. Will the deployed SDK be corrected for `assertion_id`, nested response
   parsing, exact state comparison, typed agent payloads, and fresh launch
   options?
3. What is the supported Runtime logout route and return URL contract?
4. Will the `vibe-hackathon` registration enable modern POST while retaining
   legacy GET during transition?
5. Who provisions and rotates the dedicated Vibe client credential?
6. What Runtime assertion fields authoritatively prove freshness and issue
   time?

## Application owner

1. Must every admin own a Better Auth GitHub account, or is another Better Auth
   local provider required?
2. May one local user link more than one Viby identity?
3. May a non-admin link Viby for future non-admin use, or is linking admin-only
   in the first release?
4. Is the environment allowlist retained only for bootstrap, and what is its
   removal date?
5. Is admin role a separate `user_roles` record or retained temporarily on the
   identity link?
6. What fresh-verification age is required for:
   - initial admin entry;
   - destructive organizer actions;
   - role/link recovery?
7. Should local logout also sign out from Runtime, or should the UI offer two
   explicit choices?
8. Are verified artifacts previews or durable provenance records?

## Better Auth

1. Can Better Auth 1.6.25 support the required custom Viby provider/session
   endpoint entirely through exported, versioned APIs?
2. If not, is a bounded Better Auth update acceptable, or should an upstream
   provider plugin be produced first?
3. How should GitHub OAuth behave when it is optional under badge-mode team
   ownership but required for admin linking?
4. Should admin sessions have the same TTL as team-owner sessions or a shorter
   policy?

## Operations

1. What is the compatibility-window duration?
2. Which operator approves the mapping from current Viby admin subjects to
   Better Auth user IDs?
3. What is the rollback retention window for the schema and environment
   backups?
4. When will `local.db.pre-p0-4.bak` be securely retained or destroyed under
   its existing runbook?
5. Is production local SQLite or remote libSQL the long-term supported target
   for this migration?

## Recommended decisions

- Require an existing Better Auth GitHub account for first-release admin
  linking; do not create users silently from Viby profile data.
- Enforce one active Viby identity per Better Auth user and one user per Viby
  identity.
- Separate roles from identity links.
- Retain the environment allowlist for one reviewed bootstrap migration only.
- Make Vibe logout and Runtime logout explicit separate choices.
- Treat artifacts as preview-only until durable provenance retention is
  separately approved.
- Stop implementation if a supported Better Auth extension or corrected SDK is
  unavailable.

---
