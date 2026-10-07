# Phase B.4 — Unified Judge Authentication Baseline

**Date:** 2026-07-30
**Gate decision:** GO FOR B.4.1

## Repository baseline

1. Host: `paui`
2. Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
3. Branch: `phase-vh-m6-viby-better-auth-session`
4. Starting HEAD: `4e5d301574a11b95382edba168abdf91b7cb2a02`
5. Merge base with `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`
6. Git status before this report was created: clean except protected untracked
   `local.db.pre-p0-4.bak`. The current status additionally contains this
   untracked baseline report; there are no source changes.
7. Deployed application: `767e4fd1c4d704402973a60c76465eee2813709f`
8. Deployment mode: `VIBE_VIBY_SESSION_MODE=better-auth`
9. Service at the refreshed gate:
   - PID `809697`;
   - started `2026-07-29 22:35:40 EDT`;
   - `active (running)`;
   - `NRestarts=0`;
   - local health HTTP 200;
   - public health HTTP 200.
10. Canonical application database:
    `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`,
    last modified `2026-07-28 19:54:37.363388871 -0400`.
11. The audit made no source, database, service, or deployment changes.

## Existing judge architecture

Judge login uses a private credential entered at `/judge`. The credential is
the plaintext, unique `judges.token` database value. `POST
/api/judge/session` scans all judge records and compares SHA-256 digests in
constant time.

Successful credential exchange creates a separate HMAC-signed
`vibe_judge_session`. The cookie contains judge ID, display name, role, issue
time, and expiration. Its default lifetime is 12 hours. It is HttpOnly,
SameSite=Lax, scoped to `/`, and Secure in production-safe environments.
`VIBE_JUDGE_SESSION_SECRET` is present in the deployed environment.

Judge logout only clears `vibe_judge_session`. Better Auth sessions and Viby
identity links are ignored by judge routes.

There is no Next.js middleware for judges. Protection is implemented through:

- `requireAuthorizedJudgePage()` on judge pages;
- `withJudgeApi()` on judge APIs;
- live judge-record existence checks;
- live assignment checks for submission access and score writes;
- exact same-origin enforcement for judge mutations.

Protected routes include:

- `/judge/dashboard`
- `/judge/submissions/:submissionId`
- `/judge/submissions/:submissionId/ai`
- `GET /api/judge/data`
- `POST /api/scores`
- `POST /api/judge/logout`

## Judge data and authorization

The `judges` table contains:

- `id`
- plaintext unique `token`
- `name`
- `email`
- `created_at`

It has no:

- Better Auth user binding;
- event binding;
- authorization status;
- invitation status;
- acceptance timestamp;
- revocation timestamp;
- category or specialty assignment;
- lead-judge flag.

The inspected database contains three judges, 15 assignments, and 12 score
records. No duplicate assignment or score pairs currently exist, although the
schema does not enforce uniqueness for either pair.

The private credential currently serves simultaneously as invitation material,
login secret, and judge identity selector. There is no separate invitation
lifecycle.

Judge authorization is currently equivalent to “the judge row still exists.”
Deleting that row would cascade into assignments and scores, so deletion is
unsuitable as a future revocation mechanism.

`judge_assignments` provides submission-level authorization, but has no direct
event reference. Event scope is implied through the assigned submission.

The judging deadline is displayed on the dashboard but is not an authorization
gate. Score mutations enforce event freeze and assignment ownership, not the
judging deadline.

## Assignment, scoring, and audit behavior

Judge identity for score writes comes exclusively from the signed cookie. A
browser-supplied `judgeId` is ignored.

Both score reads and writes verify the current
`judge_id + submission_id` assignment. This ownership boundary should be
preserved.

A generic `audit_events` table exists, but judge login, logout, and scoring do
not currently write judge audit events. The inspected database contained zero
judge-associated audit events.

## Existing reusable infrastructure

Already qualified and reusable:

- Better Auth 1.6.25, exactly pinned;
- email/password authentication;
- GitHub authentication;
- native Better Auth sessions;
- Viby confidential assertion redemption;
- strict human assertion validation;
- authoritative freshness and remembered-session provenance;
- one-time callback transactions;
- browser binding;
- assertion replay rejection;
- Viby-to-Better Auth session plugin;
- interactive account linking;
- legacy identity claiming;
- session provenance;
- live administrator authorization;
- global account-control presentation;
- Better Auth logout.

However, these components are not yet role-neutral:

- `viby_login_transactions.operation` only permits `admin_login`;
- session handoffs only permit `admin_login`;
- return destinations only allow `/admin`;
- Viby start and callback routes are admin-specific;
- unified admin login always requests fresh verification;
- identity-link classification requires `role="admin"`;
- new identity links are created with `role="admin"`;
- `admin_session_provenance` is admin-named and admin-scoped;
- interactive linking pages and diagnostics use administrator wording;
- global account props are named `adminAccount`;
- global logout posts to `/admin/logout` and redirects to `/admin`;
- judge navigation owns a separate logout implementation.

The Better Auth compatibility plugin itself is technically user/session
oriented and can create a normal session for any linked Better Auth user. The
hard coupling is in its admin-only transaction, provenance, return-path, and
surrounding callback infrastructure.

## Gap against Phase B.4

The following are not implemented:

- `resolveJudgePrincipal()`;
- dedicated Better Auth user-to-judge authorization;
- event-scoped judge authorization;
- judge authorization status or revocation;
- Better Auth password judge login;
- Viby judge login;
- remembered Viby SSO for judges;
- first-time Viby judge linking;
- judge session provenance;
- shared admin/judge account control;
- single-session role switching;
- judge logout through Better Auth;
- legacy credential feature flag;
- judge authentication audit history.

Current role behavior:

- An admin-only Better Auth user can administer but cannot judge without a
  separate judge token and judge session.
- A judge-only Better Auth user receives no judge access.
- A user who is both administrator and judge needs two independent cookies and
  two authentication flows.
- A Better Auth user with neither role receives no access from the Better Auth
  session alone.

## Required Phase B.4 boundary

The smallest safe implementation should:

1. Add an event-scoped `judge_authorizations` table binding:
   - Better Auth user ID;
   - existing judge ID;
   - event ID;
   - active/revoked status;
   - grant provenance;
   - creation, update, and revocation timestamps.
2. Preserve `judges`, `judge_assignments`, and `human_scores` so existing
   assignments and scoring ownership remain intact.
3. Add `resolveJudgePrincipal()` that:
   - reads the normal Better Auth session;
   - finds an active judge authorization for the relevant event;
   - verifies the judge row still exists;
   - returns the existing judge ID used by assignments and scores.
4. Replace page and API dependence on `vibe_judge_session` with that resolver.
5. Generalize existing Viby transactions and handoffs to explicit operations
   such as `admin_login` and `judge_login`, with operation-bound destinations.
6. Keep ordinary returning judge login at `forceIdentityCheck=false`.
7. Require authoritative fresh verification only when creating or changing an
   identity link. Remembered assertions must not authorize first-time linking.
8. Make identity links application-identity mappings rather than role grants.
   The current `role="admin"` assumption must be retired without changing
   administrator authorization or creating duplicate links.
9. Preserve one Better Auth session for admin-only, judge-only, and combined
   role users.
10. Generalize global account and logout presentation while preserving
    qualified administrator behavior.
11. Put private judge credential exchange behind an explicit migration flag.
    Unified mode must create no new judge cookie. Legacy issuance or
    recognition may remain only as a bounded rollback mechanism.
12. Add judge audit events for authentication, authorization denial, logout,
    and score mutation without recording credentials or assertion material.

## Migration considerations

There are no Better Auth accounts whose normalized email exactly matches a
judge email. This is informational only: email must not be used for migration
or identity linking.

Judge authorization therefore requires explicit operator-controlled binding
between an existing Better Auth user and an existing judge record.

The migration should be additive and must not delete judge records, rotate
tokens automatically, modify assignments, or rewrite scores.

The existing Viby identity-link uniqueness model is compatible with one shared
external identity per Better Auth user, but its admin-specific role semantics
must become neutral. Creating a second judge-specific identity link would
break combined-role behavior and duplicate the qualified linking system.

## B.4.1 implementation gate

The repository is suitable for the first, behavior-preserving subphase only:

- introduce `resolveApplicationPrincipal()` around the current Better Auth
  session and live application-owned authorizations;
- make the existing admin resolver a compatibility wrapper over that shared
  resolver;
- introduce a role-neutral repository/API boundary over session provenance
  without destructive table renaming;
- rename global account-control props and internal concepts from admin-specific
  to role-neutral while preserving rendered behavior;
- add principal tests for signed-out, no-role, admin-only, revoked-admin, and
  provenance-does-not-authorize cases;
- do not migrate judge routes, issue judge authorizations, alter Viby policy,
  or deploy as part of B.4.1.

This gate is safe because it does not change the current judge authentication
or scoring path. It creates the single shared identity/session resolution
boundary that later judge authorization can consume. Administrator behavior
must remain byte-for-byte equivalent at its public boundaries and be covered
by regression tests.

The later B.4.2–B.4.5 work remains gated on additive schema design, explicit
operator-approved user-to-judge mapping, role-neutral Viby operation policies,
and complete qualification. In particular, no judge may be mapped by email.

## Recommended implementation sequence

1. Additive judge authorization schema and migration validation.
2. `resolveJudgePrincipal()` with live event-scoped authorization.
3. Role-neutral Viby transaction, link, and provenance plumbing.
4. Judge password and remembered-Viby login.
5. Shared logout and global account controls.
6. Legacy credential feature flag.
7. Desktop/mobile qualification and administrator regression testing.

Production deployment should remain blocked until admin-only, judge-only,
combined-role, unauthorized, replay, cancellation, logout, assignment
ownership, and legacy rollback cases all pass.

## Gate decision

GO FOR B.4.1
