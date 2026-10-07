# Phase B.4.1 — Shared Application Principal Foundation

**Date:** 2026-07-30

## Outcome

Phase B.4.1 introduces a role-neutral application-principal boundary while
preserving all existing administrator and judge behavior.

Starting branch and HEAD:

- `phase-vh-m6-viby-better-auth-session`
- `4e5d301574a11b95382edba168abdf91b7cb2a02`

Implementation HEAD before this documentation commit:

- `393fe3d62caff2abe65a8473998bb3e62c397ded`

No deployment, live database migration, service restart, Viby change, identity
mutation, authorization mutation, or protected-backup access occurred.

## Shared principal design

`lib/application-principal.ts` now owns Better Auth interactive-principal
resolution:

1. Resolve the current session through `auth.api.getSession()`.
2. Validate the minimum user and session shape and session expiration.
3. Resolve authentication provenance through the role-neutral provenance API.
4. Reject malformed provenance and sessions tied to revoked Viby identities.
5. Resolve all current active administrator authorizations for the user.
6. Fail closed if more than one active authorization is returned.
7. Return a sanitized application principal with:
   - Better Auth user identity;
   - token-free session metadata;
   - normalized authentication method;
   - safe linked-Viby display metadata where applicable;
   - live application-owned authorizations;
   - `isAdmin` derived only from the live authorization;
   - `isJudge: false` for B.4.1.

The resolver creates no sessions, links, grants, or roles and performs no Viby
redemption. It never reads `vibe_judge_session`.

The resolver is dependency-injectable for focused tests. Production uses the
Better Auth, provenance, and authorization repositories directly.

## Administrator compatibility

`resolveAdminPrincipal()` is now a compatibility view over
`resolveApplicationPrincipal()` for Better Auth sessions. It maps the shared
principal into the unchanged `AdminPrincipal` shape used by existing pages,
APIs, audit logs, and identity presentation.

The bounded legacy `vibe_admin_session` path remains isolated in the admin
wrapper. It continues to:

- validate the signed legacy session;
- resolve the active Viby identity link;
- require the same centralized live administrator authorization;
- reject conflicting simultaneous authorized session identities.

`isAuthorizedAdminVibyUser()` no longer treats the historical identity-link
`role` field as authorization. It resolves exactly one active, bound,
application-scoped identity and calls the shared live administrator
authorization repository. This preserves rollback behavior while making the
role column explicitly non-authoritative.

Existing redirect, unauthorized, password login, Viby login, navigation,
logout, identity-card, linking, and replay behavior is unchanged.

## Role-neutral session provenance

`lib/interactive-session-provenance.ts` is the only application service that
knows the historical `admin_session_provenance` storage name.

It provides:

- `getInteractiveSessionProvenance()`;
- `recordInteractiveSessionProvenance()`;
- `recordInteractiveSessionProvenanceInTransaction()`;
- role-neutral provenance and authentication-method types.

The table and all existing data remain unchanged. A database without the
additive provenance table is treated as provenance-absent for Phase A
compatibility. A present but malformed provenance record fails closed.

Viby session creation and interactive linking now record provenance through
this boundary. Provenance describes authentication only and never grants an
application role.

## Global account-control naming

The global account-control prop and presentation type are now role-neutral:

- `authenticatedAccount`;
- `AuthenticatedAccountDisplay`;
- `applicationHeaderAccount()`.

The rendered desktop and mobile UI remains:

- display name;
- `Log out`.

The existing `/admin/logout` action is intentionally unchanged in B.4.1. No
provenance subtitle was added to the header, and the detailed administrator
identity card remains unchanged.

## Judge isolation

The following remain unchanged from the starting HEAD:

- `/judge` login UI;
- `POST /api/judge/session`;
- `vibe_judge_session`;
- `requireAuthorizedJudgePage()`;
- `withJudgeApi()`;
- judge logout;
- judge pages and dashboard authorization;
- judge tokens and profile storage;
- judge assignments;
- score ownership and mutation behavior.

The shared resolver ignores the legacy judge cookie, so it cannot create an
application role.

## Tests added and updated

Focused application-principal tests cover:

- signed-out resolution with no authorization lookup;
- authenticated user with no role;
- active administrator authorization;
- inactive/revoked administrator authorization;
- conflicting active administrator authorization;
- Viby-backed provenance;
- provider-neutral and missing provenance;
- malformed provenance;
- revoked linked Viby identity;
- historical identity-link role non-authority;
- legacy judge-cookie isolation.

Boundary tests verify:

- administrator delegation to the shared principal;
- provenance storage-name containment;
- absence of judge-stack dependencies;
- role-neutral global account-control names;
- preservation of the legacy judge implementation.

Existing Phase B browser tests were updated only for the role-neutral test IDs.

## Validation results

- Focused principal/authentication tests: **32 passed**
- Full unit suite: **196 passed across 24 files**
- Phase B desktop Chromium: **6 passed**
- Phase B mobile Chromium: **6 passed**
- Existing administrator Playwright suite: **23 passed**
- Standalone TypeScript: **passed**
- Next.js 16.2.12 production build: **passed**
- B.4.1 modules and tests ESLint: **0 errors**
- `git diff --check`: **passed**
- Secret scan over changed files: **passed**
- Attribution scan over changed files: **passed**
- Legacy judge-file diff: **empty**

Expected test-only warnings:

- Better Auth reports absent GitHub test credentials in isolated test/build
  environments.
- Negative migration and conflict fixtures intentionally print their rejected
  operations while the tests pass.
- `components/Nav.tsx` retains two pre-existing `no-img-element` warnings.

Repository lint baseline:

- The changed dashboard page has six pre-existing `prefer-const` errors and one
  pre-existing unused-variable warning at the starting SHA.
- B.4.1 changes only that file's account helper import and prop name.
- The errors were reproduced by linting the exact starting-SHA version.
- They were not modified because they are unrelated to authentication B.4.1.

## Remaining risks

- `admin_session_provenance` remains the physical table name until a later
  additive migration; consumers are now insulated from that name.
- The legacy administrator cookie remains supported as the separately bounded
  rollback path.
- Identity-link schema still contains historical `role="admin"` semantics.
  Authorization no longer depends on that value, but schema neutralization is
  intentionally deferred.
- Judge authentication remains the separate credential/cookie architecture
  until B.4.3.
- No live browser or deployment qualification was performed because B.4.1
  explicitly prohibits deployment.

## Exact B.4.2 gate

B.4.2 may proceed only as an additive judge-authorization data phase:

1. Introduce event-scoped `judge_authorizations`.
2. Preserve all judge profiles, 15 assignments, and 12 scores.
3. Preflight and enforce uniqueness for assignment and score ownership without
   deleting or merging data.
4. Validate tables, columns, foreign keys, indexes, checks, and migration
   idempotence using disposable databases.
5. Provide dry-run inspection and explicit ID-based mapping tooling.
6. Do not infer a Better Auth user from judge email or name.
7. Do not migrate judge pages, APIs, cookies, or Viby operations in B.4.2.
8. Require an operator-approved user ID, judge ID, and event ID before any live
   qualification mapping.

## Recommendation

GO FOR B.4.2
