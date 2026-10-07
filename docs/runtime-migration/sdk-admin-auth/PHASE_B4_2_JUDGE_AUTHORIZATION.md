# Phase B.4.2 — Additive Event-Scoped Judge Authorization

**Date:** 2026-07-30

## Outcome

Phase B.4.2 adds the event-scoped judge authorization substrate without
changing judge authentication, pages, APIs, Viby policy, or the running
application.

- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `3a9a32340b0da4d9d71792ffc995c2368f4b891c`
- Implementation HEAD before the documentation commit:
  `7047a69404f71b5fb16302740b9adf1160035817`

## Commit sequence

1. `b250121` — `auth: add event-scoped judge authorization schema`
2. `3e158e8` — `auth: add judge authorization repository`
3. `6497470` — `auth: resolve optional event-scoped judge role`
4. `c53d834` — `ops: add explicit judge authorization tooling`
5. `199fa0b` — `test: qualify judge authorization substrate`
6. `7047a69` — `auth: preserve judge authorizations on migration rerun`
7. Documentation commits record this report without changing implementation.

## Event-model findings

The canonical event identifier is `events.id`. The inspected canonical
database contains one event:

- ID: `evt_vibe_2025`
- slug: `vibe-hackathon-2026`
- active: true

`submissions.event_id` references `events.id` with `ON DELETE SET NULL`. The
schema can hold multiple events, but the current application is active-event
oriented. `getActiveEvent()` selects an active row, otherwise the newest row,
and creates the default only when no event exists. It does not enforce one
active row.

Judge authorization therefore always requires an explicit event ID. The
repository and operator tool never infer or synthesize one.

Canonical read-only integrity results:

- events: 1;
- active events: 1;
- submissions: 6;
- submissions without an event: 0;
- judge profiles: 3;
- assignments: 15;
- scores: 12;
- orphaned assignments: 0;
- orphaned scores: 0;
- duplicate assignment pairs: 0;
- duplicate score pairs: 0;
- assignments without an event: 0;
- scores without an event: 0;
- judges assigned across multiple events: 0;
- foreign-key violations: 0.

Every assignment and score resolves through its submission to
`evt_vibe_2025`.

## Judge authorization schema

The additive `judge_authorizations` table separates future Better Auth
identity from the existing judge profile, event scope, assignments, and score
ownership.

Fields:

- `id`;
- `user_id`;
- `judge_id`;
- `event_id`;
- `status`;
- `grant_provenance`;
- `granted_by_user_id`;
- `invited_at`;
- `accepted_at`;
- `revoked_at`;
- `revocation_reason`;
- `created_at`;
- `updated_at`.

Lifecycle statuses are `invited`, `active`, and `revoked`. Invitation behavior
is not implemented in B.4.2, but its schema state is explicit and constrained.
Current explicit grants create `active` rows with `accepted_at` populated.
Revocation preserves the row and populates `revoked_at`.

The lifecycle check requires:

- invited: `invited_at` present, no acceptance or revocation;
- active: `accepted_at` present, no revocation;
- revoked: `revoked_at` present.

## Foreign keys and deletion

- `user_id → users.id`: `ON DELETE RESTRICT`;
- `judge_id → judges.id`: `ON DELETE RESTRICT`;
- `event_id → events.id`: `ON DELETE RESTRICT`;
- `granted_by_user_id → users.id`: `ON DELETE SET NULL`.

The authorization subject, profile, and event cannot be deleted while
authorization history exists. The granting operator is set null if deleted so
authorization history survives without blocking unrelated account lifecycle.

Revocation never deletes judge profiles, assignments, scores, or audit events.

## Uniqueness and indexes

Partial unique indexes enforce:

- one active judge mapping per Better Auth user and event;
- one active Better Auth user per judge profile and event.

The repository also loads up to two active records and fails closed if
ambiguity exists despite expected database constraints.

Indexes:

- `judge_authorizations_user_idx`;
- `judge_authorizations_judge_idx`;
- `judge_authorizations_event_idx`;
- `judge_authorizations_status_idx`;
- `judge_authorizations_user_event_idx`;
- `judge_authorizations_judge_event_idx`;
- `judge_authorizations_status_event_idx`;
- `judge_authorizations_active_user_event_unique`;
- `judge_authorizations_active_judge_event_unique`.

The duplicate preflight passed, so additive logical uniqueness indexes were
also added:

- `judge_assignments_judge_submission_unique`;
- `human_scores_judge_submission_unique`.

Migration refuses duplicates and never deletes or merges ownership records.

## Repository

`lib/judge-authorizations.ts` provides:

- `inspectJudgeAuthorizationState()`;
- `resolveActiveJudgeAuthorization()`;
- `previewJudgeAuthorizationGrant()`;
- `grantJudgeAuthorization()`;
- `revokeJudgeAuthorization()`;
- `recordJudgeAuthorizationInspection()`.

Resolution requires an explicit Better Auth user ID and event ID, joins the
referenced judge profile, returns revoked/absent state as no authorization,
and fails closed on ambiguity. It performs no authentication, Viby work,
session creation, assignment creation, or score mutation.

Grant validates the user, judge, event, and optional granting user inside the
transaction. An identical active mapping is idempotent. A user/event or
judge/event collision is rejected and audited. No email, name, token,
assignment, or Viby lookup participates.

Revocation conditionally updates the existing row to `revoked`, records the
timestamp and reason, and is idempotent if already revoked.

## Application principal integration

`resolveApplicationPrincipal(headers, { eventId })` now optionally enriches
the B.4.1 principal:

- without event context, behavior is unchanged and `isJudge=false`;
- exact event plus active authorization sets `isJudge=true`;
- absent, revoked, or wrong-event authorization leaves `isJudge=false`;
- ambiguous active authorization fails closed;
- admin and judge flags remain independent.

The shared resolver still ignores `vibe_judge_session`. No current judge route
passes event context yet.

## Operator tool

Command:

```bash
npm run db:judge-authorizations -- --database /absolute/path --action inspect
```

Supported operations:

- read-only inspect;
- explicit-ID dry-run grant;
- explicitly confirmed transactional grant;
- dry-run revoke;
- explicitly confirmed history-preserving revoke.

Grant requires `--user-id`, `--judge-id`, `--event-id`, and `--provenance`.
Apply confirmation binds all three IDs and the canonical database path.
Revoke requires an authorization ID, reason, apply flag, and path-bound
confirmation.

The tool rejects unknown `--email` input. Inspection omits judge tokens,
password hashes, sessions, cookies, Runtime identifiers, and credentials.
Dry-run makes no database changes.

## Audit events

The generic `audit_events` table records sanitized:

- `judge_authorization_granted`;
- `judge_authorization_revoked`;
- `judge_authorization_conflict`;
- `judge_authorization_inspected`.

Metadata is limited to authorization/user/judge/event identifiers, status,
operator provenance, reason, and timestamp context. No authentication secret
or judge credential is recorded.

Inspection is read-only by default. The repository exposes a separate explicit
inspection-audit operation for workflows that require recorded inspection.

## Migration qualification

The migration requires:

- an explicit absolute canonical SQLite path;
- a regular non-symlink file;
- a path-bound confirmation phrase;
- the expected Vibe Hackathon judge schema;
- clean ownership and foreign-key preflight.

It validates exact columns, types, nullability, defaults, check constraints,
foreign keys, delete actions, indexes, partial uniqueness, and foreign-key
integrity. Structurally incompatible pre-existing tables are rejected before
index creation.

A disposable byte-for-byte copy of the canonical database was migrated twice.

First run:

- schema valid;
- 3 judge profiles;
- 15 assignments;
- 12 scores;
- 0 authorizations created;
- foreign-key check passed.

Second run:

- schema valid and idempotent;
- 3 judge profiles;
- 15 assignments;
- 12 scores;
- 0 authorizations created;
- foreign-key check passed.

Post-migration read-only inspection reported one Better Auth user, three judge
profiles, one event, zero judge authorizations, and no token exposure.

## Test results

- Focused B.4.2 plus B.4.1 tests: 25 passed across 4 files.
- Full unit suite: 206 passed across 26 files.
- Focused Phase B administrator regression: 93 passed across 8 files.
- Standalone TypeScript: passed.
- Next.js 16.2.12 production build: passed.
- Changed B.4.2 files ESLint: passed with zero findings.
- `git diff --check`: passed.
- Secret scan: passed.
- Attribution scan: passed.

Expected test/build warnings remain limited to missing test GitHub OAuth
credentials and intentionally rejected negative fixtures.

## Authentication and deployment boundary

The diff from the starting HEAD is empty for:

- `/judge`;
- judge page guards;
- judge API guards;
- `POST /api/judge/session`;
- `vibe_judge_session`;
- judge logout;
- score API authentication;
- judge tokens;
- Viby transactions and callbacks.

No navigation role was exposed and no mapping was applied.

The running application remains:

- release `767e4fd1c4d704402973a60c76465eee2813709f`;
- PID `809697`;
- started `2026-07-29 22:35:40 EDT`;
- active with zero restarts;
- `better-auth` mode.

The canonical database remains unchanged at modification time
`2026-07-28 19:54:37.363388871 -0400`. No service restart, deployment,
canonical migration, Viby modification, or protected-backup access occurred.

## Exact B.4.3 gate

B.4.3 may begin only after:

1. The additive migration receives a separate non-production deployment
   approval and passes twice against the explicit canonical database.
2. An operator supplies one approved Better Auth user ID, judge profile ID,
   and event ID; email and name remain prohibited for mapping.
3. The explicit tool creates and verifies that one authorization.
4. B.4.3 implements `resolveJudgePrincipal()` strictly as a view over
   `resolveApplicationPrincipal(headers, { eventId })`.
5. Judge pages and APIs preserve assignment, score ownership, same-origin, and
   event-freeze checks.
6. The legacy credential/cookie path remains feature-controlled during
   qualification and cannot bypass Better Auth once disabled.
7. No Viby judge-login changes occur until the separate B.4.4 phase.

## Recommendation

GO FOR B.4.3
