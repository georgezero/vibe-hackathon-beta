# Phase B.4.4 — Judge Viby Login and Role-Neutral Identity Linking

Date: 2026-07-30  
Host: `paui`  
Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`  
Branch: `phase-vh-m6-viby-better-auth-session`

## Decision

The implementation and local qualification are complete. Deployment remains
blocked on an explicitly approved Viby test identity for the live returning
and first-link qualification. No production application, database, or Viby
Runtime change was made.

## 1. Starting HEAD

`e3249c08bd150811ed823118da6184852a30fcb8`

## 2. Implementation HEAD

`0f654d8` is the tested implementation-and-tests HEAD before this report
commit. The exact repository HEAD containing this report must be recorded at
the deployment gate.

## 3. Commit sequence

1. `bbc4a20 auth: add role-neutral Viby judge login`
2. `0f654d8 test: qualify Viby judge authentication`
3. Documentation closeout: this report

No push, merge, deployment, service restart, or canonical database mutation
was performed.

## 4. `judge_login` implementation

`lib/viby-login-policy.ts` defines a closed operation enum:

- `admin_login`
- `judge_login`

Each operation owns its callback, entry route, link route, return-path
allow-list, Runtime mode, freshness policy, and remembered-login policy.
Arbitrary operations and cross-role return paths fail closed.

Judge login uses the Runtime application's registered `admin` mode because
that is the authoritative human host-application assertion mode. The
application's internal operation is independently bound as `judge_login`;
Runtime mode does not grant an application role.

The judge entry route is:

`/api/viby/start?flow=judge`

The callback is:

`/judge/viby/callback`

The callback reuses confidential, one-time assertion redemption and the
existing Better Auth compatibility plugin. It never creates a judge cookie or
judge authorization.

## 5. Returning flow

A returning linked judge uses:

- `forceIdentityCheck=false`;
- no `freshIdentity=1`;
- a one-time `judge_login` callback transaction;
- confidential assertion redemption;
- the existing role-neutral identity link;
- the pinned Better Auth session-creation plugin;
- `resolveJudgePrincipal()` and the live event-scoped judge authorization.

Remembered and fresh Runtime assertions are both accepted for this returning
path. Browser qualification verified that the result is a normal Better Auth
session and that no `vibe_judge_session` cookie is created.

## 6. First-time linking

A remembered assertion may identify a returning linked user, but it cannot
create a link. If the Runtime subject is unlinked, the consumed routine
transaction is followed by a new server-created forced-fresh transaction:

`/api/viby/start?flow=judge&link=1`

Only current authoritative fresh evidence can create the pending link. The
user must then authenticate an existing Better Auth account and explicitly
confirm the link. The confirmation states that linking grants neither judge
nor administrator access.

Link success continues through the existing Better Auth session and the live
judge-authorization resolver. An authenticated user without an active
authorization receives the existing authenticated-but-unauthorized outcome.

## 7. Transaction account locking

Pending identity-link transactions now include their exact operation.
Operation checks are enforced during create, prepare, confirm, cancel, and
callback consumption.

The first recently authenticated Better Auth account to render confirmation
is recorded in `expected_user_id`. Confirmation requires:

- the same token digest;
- the same browser-binding digest;
- `operation=judge_login`;
- the same Better Auth user;
- a pending, unconsumed, unexpired transaction.

Changing the Better Auth account marks the transaction failed with
`account_changed`. The invalid-state route clears both pending-link cookies.
No identity link is created.

## 8. Browser binding

The callback retains the server-generated login browser-binding cookie and
digest comparison. The pending link retains its separate server-generated
browser-binding cookie and digest comparison. Raw tokens are not persisted.

Wrong-browser prepare, confirmation, cancellation, and callback attempts
cannot consume a valid transaction. Existing browser-binding tests remain
green.

## 9. Account-switch protection

Desktop and mobile Chromium both exercised an account switch after the first
account was displayed. Both resulted in:

- failed pending transaction;
- `failure_code=account_changed`;
- cleared pending-link browser state;
- zero identity links for the test subject.

No relink, transfer, merge, or email lookup occurs.

## 10. Role-neutral identity links

The historical `role=admin` field remains unchanged for schema compatibility
and is explicitly non-authoritative. A new additive `link_scope` field
distinguishes:

- `legacy_admin` for historical rows;
- `identity` for newly created role-neutral links.

New interactive links use `link_scope=identity`. Authorization never derives
from `role` or `link_scope`; both admin and judge access remain live
application authorization decisions.

## 11. Historical compatibility

Historical `role=admin` links remain readable and usable as identity links.
They do not set `isAdmin` or `isJudge`. Existing legacy unbound identity claims
remain supported and preserve original creation provenance.

Existing session-provenance rows are preserved. Their operation safely
defaults to `admin_login`; historical verification kind and timestamp remain
null rather than being invented.

## 12. Authorization behavior

Viby authentication and identity linking do not insert or update:

- `admin_authorizations`;
- `judge_authorizations`;
- judge assignments.

Judge access still requires one active authorization for
`evt_vibe_2025`. Admin authorization remains independent. An identity-linked
user with no role remains authenticated but unauthorized.

## 13. Assignment preservation

No judge page, API, assignment query, or assignment row was changed by this
phase. The existing chain remains:

Better Auth user → active event authorization → judge profile → assignment.

The disposable current-database rehearsal retained all 15 assignments.

## 14. Score ownership preservation

Score identity remains the server-resolved judge profile from
`resolveJudgePrincipal()`. Browser-supplied judge IDs remain non-authoritative.
Same-origin, assignment, and event-freeze checks remain unchanged.

The disposable current-database rehearsal retained all 12 scores. No score
content or ownership was changed.

## 15. Hybrid behavior

The intended deployment mode remains `hybrid`:

- Better Auth password login remains available;
- Better Auth Viby login is now available;
- the visibly labeled legacy credential fallback remains available.

A valid Better Auth identity takes precedence. A legacy cookie cannot override
or merge with a Better Auth identity.

## 16. Password regression

The full unit suite and Phase B administrator browser suite passed. Existing
Better Auth password login for administrators and judges remains unchanged.

## 17. Legacy regression

Legacy judge credential routes, token storage, custom-cookie creation, and
legacy-mode guards were not changed. Hybrid fallback remains visible and
isolated. No token-to-user conversion or email mapping was introduced.

## 18. Logout behavior

Judge logout continues through the shared Better Auth logout. It clears:

- Better Auth application session;
- defensive legacy judge cookie;
- legacy admin cookie;
- callback transaction cookie;
- login browser binding;
- session handoff;
- pending-link token and browser binding.

Desktop and mobile tests verified that the protected judge dashboard is denied
after logout. Runtime global SSO is intentionally not terminated.

## 19. Zero-length legacy cookie cleanup

Deferred. The existing qualified logout deliberately expires the legacy judge
cookie using `Max-Age=0`. Changing its emission mechanics was not necessary for
B.4.4 and would add risk without changing authorization behavior.

## 20. Audit events

Added safe event types:

- `judge_viby_login_started`;
- `judge_viby_login_succeeded`;
- `judge_viby_login_cancelled`;
- `judge_viby_login_denied`;
- `judge_viby_link_started`;
- `judge_viby_link_succeeded`;
- `judge_viby_link_conflict`;
- `judge_viby_fresh_required`;
- `judge_viby_remembered_login`.

Audit metadata is restricted to existing safe string identifiers, route,
reason, event/correlation identifiers, and user/link IDs where appropriate.
No password, assertion, Runtime token, cookie, callback state, or biometric
material is logged.

## 21. Focused tests

Focused policy, migration, principal, callback-boundary, and regression group:

- 73 tests passed during the focused qualification run.
- B.4.4 policy and migration files add 7 direct tests.
- Current fresh evidence, remembered evidence, stale evidence, destination
  allow-listing, operation locking, account locking, role-neutral links,
  idempotent migration, FK integrity, and preserved boundaries are covered.

## 22. Full unit suite

`npm test`

Result:

- 33 test files passed;
- 239 tests passed;
- zero failures.

Expected negative-path subprocess output appeared for conflict and migration
confirmation tests; those tests passed.

## 23. Browser tests

Judge B.4.4 matrix:

- desktop Chromium: 4/4 passed;
- mobile Chromium: 4/4 passed.

Covered returning remembered login, forced-fresh first linking, explicit
confirmation, no implicit authorization, cancellation, replay rejection,
logout, and Better Auth account switching.

Administrator Phase B regression:

- desktop Chromium: 6/6 passed;
- mobile Chromium: 6/6 passed.

One earlier desktop admin-link run was timing-sensitive at the password form;
the isolated case passed immediately and the final complete 12-test
desktop/mobile rerun passed.

WebKit was attempted and could not launch because the host still lacks:

- `libmanette-0.2.so.0`;
- `libhyphen.so.0`.

No application test executed under WebKit.

## 24. TypeScript

`npx tsc --noEmit`

Passed with zero errors.

## 25. Production build

`npm run build`

Passed. Next.js 16.2.12 compiled, type-checked, generated all pages, and
included the new judge Viby and link routes.

The only build warning was the expected local qualification warning that the
GitHub test provider has no client ID/secret.

## 26. ESLint

Changed-file ESLint passed with zero errors and zero warnings after cleanup.

## 27. Secret scan

Changed production source was scanned for private-key material, hard-coded
password assignments, sensitive console output, assertion/cookie/token
logging, and raw-subject audit logging. No finding was returned.

Test-only fixed passwords remain confined to disposable browser fixtures.

## 28. Sensitive-output and attribution scan

No raw assertion, Runtime token, cookie, session token, password, password
hash, or Viby subject was written to retained validation output. Audit code
hashes the Viby subject and uses non-secret correlation IDs.

The changed diff contains no generated attribution, co-author, or sign-off
trail.

## 29. Production unchanged

After implementation and qualification:

- deployed release remained
  `a03986974ad5ab03453990f7b7f3444e29773b3c`;
- Vibe Hackathon PID remained `2307060`;
- `NRestarts` remained `0`;
- service remained active;
- canonical `local.db` modification time remained
  `2026-07-28 19:54:37.363388871 -0400`;
- the canonical database was not migrated or mutated;
- Viby was not modified, restarted, or redeployed.

The migration was run twice only on temporary databases. The live-shape
online copy retained:

- judges: 3;
- assignments: 15;
- scores: 12;
- judge authorizations: 1;
- foreign-key violations: 0.

The temporary database was removed.

## 30. Remaining risks

1. Live production Runtime qualification requires an operator-approved Viby
   test identity and explicit mapping intent. No identity may be inferred from
   email, name, judge token, or Runtime profile.
2. WebKit coverage remains unavailable on this Linux host.
3. The migration rebuilds the two short-lived login/handoff tables to broaden
   their operation checks. Deployment must use the established database
   backup and maintenance procedure.
4. Historical provenance rows intentionally have null verification kind/time.
   New rows record operation, fresh/remembered kind, and verification time.
5. The legacy credential fallback remains temporary technical debt for the
   later removal phase.

## 31. B.4.4 deployment plan

Do not proceed until an operator approves:

- one returning linked Viby judge identity, or an explicit link target;
- one first-link test identity if first-link live qualification is required;
- the exact Better Auth account involved;
- confirmation that no email/name inference is permitted.

Deployment sequence:

1. Record release, PID, start time, modes, canonical database path and
   timestamp, health, and row counts.
2. Create the established protected timestamped database backup.
3. Run the B.4.4 migration against the explicit canonical path:

   ```bash
   DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
   VIBE_PHASE_B44_MIGRATION_CONFIRM="MIGRATE VIBY JUDGE LOGIN DATABASE /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db" \
   npm run db:migrate:viby-judge-login
   ```

4. Run the identical command a second time.
5. Verify `PRAGMA foreign_key_check`, 3 judge profiles, 15 assignments, 12
   scores, and the expected judge-authorization count.
6. Build an immutable release from the exact approved HEAD.
7. Keep:
   - `VIBE_JUDGE_AUTH_MODE=hybrid`;
   - `VIBE_VIBY_SESSION_MODE=better-auth`;
   - existing production Runtime configuration.
8. Restart only the Vibe Hackathon user service.
9. Verify exact release, PID/start time, zero crash loop, compatibility guard,
   local health, and public health.
10. With the approved identity, qualify returning remembered login, forced
    fresh first linking where approved, explicit confirmation, unauthorized
    and authorized outcomes, replay, cancellation, account switching,
    assignments, score ownership, same-origin, freeze, logout, password
    regression, admin regression, and hybrid legacy fallback.
11. Do not create Ben or Cleo mappings and do not change Ada's judge
    authorization without separate approval.
12. If qualification fails, restore the prior immutable release and preserve
    additive schema and valid identity/authorization history. Do not modify
    Viby.

## Gate

The code is suitable for deployment review, but live qualification cannot be
completed safely until the operator names the approved Viby identity and its
explicit Better Auth account/link intent.

CONDITIONAL — APPROVED VIBY TEST IDENTITY REQUIRED
