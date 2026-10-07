# Phase B.4.3 — Judge Guards on Better Auth

Date: 2026-07-30  
Implementation baseline: `47f041287326371aad6984e1c42ce073270e1fce`  
Implementation HEAD before this documentation commit:
`d02d7beb9c35a250310c29a82b12d61d0f86413c`  
Deployment status: **not deployed; explicit approval required**

## 1. Baseline reconfirmation

- Host: `paui`
- Repository:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `47f041287326371aad6984e1c42ce073270e1fce`
- Merge base with `origin/main`:
  `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- Starting tracked worktree: clean
- Protected untracked backup: present and never opened, copied, modified, or
  staged
- Deployed release:
  `767e4fd1c4d704402973a60c76465eee2813709f`
- User service: active/running, PID `809697`, zero restarts
- Service start time: `2026-07-29 22:35:40 EDT`
- Effective deployed application mode: `better-auth`
- Canonical database:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Canonical database modification time:
  `2026-07-28 19:54:37.363388871 -0400`
- Local health: HTTP `200`
- Public health: HTTP `200`
- Canonical event: `evt_vibe_2025`
- Canonical data: 3 judge profiles, 15 assignments, 12 scores, zero deployed
  judge authorizations, one Better Auth user

The canonical database remains on the pre-B.4.2 deployed schema. No canonical
migration, authorization grant, service restart, release switch, or Viby
operation occurred.

## 2. Commit sequence

1. `347c717` — `auth: add event-scoped judge principal`
2. `cbc9cfb` — `auth: migrate judge guards to Better Auth`
3. `f3dbb37` — `auth: unify judge logout and role navigation`
4. `f4af2ab` — `auth: add role-neutral password user provisioning`
5. `d02d7be` — `test: qualify unified judge authentication`

The documentation commit follows these implementation commits.

## 3. Disposable migration and approved mapping

The exact canonical database was copied to a newly created disposable
directory. Only that disposable copy was modified.

Migration run one:

- schema valid;
- 3 judge profiles;
- 15 assignments;
- 12 scores;
- zero judge authorizations;
- zero automatic authorizations created;
- foreign-key check passed.

Migration run two returned the same result and proved idempotence.

All eleven B.4.2 indexes were present, including the two active-authorization
partial unique indexes and the assignment/score ownership unique indexes.
Duplicate assignment and score pairs remained zero.

The operator approved the Ada qualification mapping in the follow-up message:

- disposable Better Auth user ID: `b43_ada_XtwDOCT_2t1B`
- account email: `judgeada@fff.ad`
- judge profile ID: `judge_media_ada`
- event ID: `evt_vibe_2025`
- authorization ID: `QkU9nZ0BYyHU8uF38TAYb`
- grant provenance: `operator_approved_b4_3_qualification`
- approval source: explicit operator follow-up in this task

The credential was created with Better Auth password hashing and verified at
the authentication boundary. The supplied password is not recorded in this
report, source control, retained logs, or a retained database.

The explicit B.4.2 tool returned `ready` for dry-run and `granted` for the
confirmed apply. Validation proved one judge authorization and zero
administrator authorizations for the disposable user. No profile, assignment,
or score changed. The disposable database and WAL/SHM files were deleted.

Ben and Cleo were approved as future accounts but were not mapped in this
phase. The B.4.3 gate calls for exactly one qualification mapping before live
deployment.

## 4. Judge principal design

`lib/judge-principal.ts` implements `resolveJudgePrincipal(headers, {
eventId })` strictly over `resolveApplicationPrincipal()`.

It requires:

1. a valid Better Auth session;
2. explicit event context;
3. exactly one active authorization for the Better Auth user and event;
4. a valid referenced judge profile;
5. a single active event record matching the explicit event.

It returns the shared application principal, exact judge authorization, exact
existing judge profile, and safe event metadata. It never reads:

- `vibe_judge_session`;
- plaintext judge tokens;
- request-supplied judge IDs;
- Better Auth or judge-profile email as a mapping key;
- Viby assertions or identity-link roles.

Resolution distinguishes signed out, authenticated but unauthorized, revoked,
event mismatch, malformed/conflicting authorization, unavailable state, and
valid active judge.

`resolveActiveJudgeAuthorization()` now preserves a distinct `revoked` result
and includes the authorization ID required for audit attribution. A missing
referenced judge profile and multiple active matches fail closed.

## 5. Active-event resolution

`lib/judging-event.ts` centralizes the explicit judging event:

- environment override: `VIBE_JUDGE_EVENT_ID`;
- behavior-preserving default: `evt_vibe_2025`;
- lookup: exact event ID;
- requirement: one active matching event.

`resolveApplicationPrincipal()` does not guess an event. Judge callers always
pass explicit event context.

The authorization chain is:

```text
Better Auth user
  -> active authorization for evt_vibe_2025
  -> existing judge profile
  -> requested event submission
  -> judge assignment
  -> score ownership
```

## 6. Protected page migration

These pages still call the stable `requireAuthorizedJudgePage()` boundary:

- `/judge/dashboard`
- `/judge/submissions/:submissionId`
- `/judge/submissions/:submissionId/ai`

The boundary is now auth-mode aware:

- `legacy`: preserves the existing HMAC cookie flow;
- `unified`: requires the Better Auth judge principal;
- `hybrid`: prefers Better Auth and falls back to legacy only when Better Auth
  is genuinely signed out.

An authenticated but unauthorized, revoked, malformed, or conflicting Better
Auth state never falls through to a legacy cookie.

Signed-out unified page access redirects to `/judge?reason=session_required`.
Authenticated unauthorized access redirects to
`/judge?reason=not_authorized`. No Viby flow starts.

## 7. Protected API migration

The centralized `withJudgeApi()` guard now protects:

- `GET /api/judge/data`
- `POST /api/scores`
- `POST /api/judge/logout`

Unified resolution supplies only the server-resolved judge profile ID, event
ID, Better Auth user ID, and authorization ID required by handlers and audit
events.

Outcomes remain stable:

- signed out: HTTP `401`;
- authenticated but forbidden: HTTP `403`;
- unavailable or invalid configuration: HTTP `503`;
- authorized: handler executes.

`POST /api/judge/session` remains available in `legacy` and `hybrid`, and
returns HTTP `410` in `unified`.

## 8. Scoring, assignment, origin, and freeze preservation

- Dashboard rows are filtered to assigned submissions in the authorized event.
- Submission and AI-review pages require the exact server-resolved judge
  assignment.
- `GET /api/judge/data` requires the assignment and exact event.
- `POST /api/scores` ignores browser-supplied `judgeId`.
- Score reads and writes use the mapped existing judge profile ID.
- Existing scores are not rewritten.
- Same-origin checks remain in the centralized API wrapper.
- Cross-origin mutation is rejected.
- `assertEventNotFrozen()` still executes before any score database mutation.
- A new regression test proves freeze denial creates no read/write side effect
  after the freeze decision.
- The displayed judging deadline remains informational and was not converted
  into an authorization boundary.

Revocation denies the next request without deleting the Better Auth session,
judge profile, assignment, or score.

## 9. Judge sign-in page

`/judge` is mode-aware:

- `legacy`: existing private credential UI and behavior;
- `unified`: Better Auth password sign-in only;
- `hybrid`: Better Auth first, plus a visibly labeled temporary legacy
  fallback.

Copy states that judge access requires an active event authorization.
Authentication alone does not create access.

An already authenticated authorized judge redirects to `/judge/dashboard`.
An authenticated unauthorized account receives a clear outcome and remains
authenticated. Invalid or conflicting unified state offers a safe session
clear action and cannot fall through to legacy.

Viby judge login was not added.

## 10. Authentication modes and legacy isolation

`VIBE_JUDGE_AUTH_MODE` accepts exactly:

- `legacy`;
- `unified`;
- `hybrid`.

It defaults to `legacy` so applying the code without an explicit mode change is
behavior preserving.

Hybrid policy:

1. authorized Better Auth judge wins;
2. simultaneous legacy cookie is ignored and audited;
3. authenticated but unauthorized Better Auth is denied;
4. malformed, revoked, conflicting, or unavailable Better Auth is denied;
5. legacy fallback is considered only when Better Auth is signed out.

There is no email merge, token conversion, or automatic authorization.

## 11. Password-based judge access

A role-neutral provisioning command was added:

```text
npm run auth:provision-password-user
```

It requires:

- an explicit absolute database path;
- explicit user ID, name, and email;
- an operator-owned mode-0600 password file;
- an exact target-bound confirmation string.

It creates only a complete Better Auth user and credential account. It never
creates an administrator or judge authorization. Exact reruns retain the
existing complete credential; conflicting user IDs, emails, or incomplete
credential state fail closed.

This was necessary because the existing password-administrator provisioning
tool intentionally creates an administrator grant and therefore cannot be used
for a judge-only account.

## 12. Logout and navigation

Unified judge pages reuse the global compact account control:

```text
Display name
Log out
```

`POST /judge/logout`:

- calls Better Auth sign-out;
- clears `vibe_judge_session`;
- clears the rollback admin cookie;
- clears application callback, browser-binding, handoff, and link state;
- redirects safely to `/judge?reason=logged_out`.

The API logout also clears the legacy judge cookie defensively and signs out
Better Auth when the request used unified authentication.

Role-aware navigation uses server-resolved application roles:

- admin only: Admin available, Judge absent;
- judge only: Judge available, Admin absent;
- both: both available under one Better Auth session;
- neither: no protected role destination.

Protected routes remain authoritative regardless of navigation visibility.

## 13. Audit events

The safe judge audit boundary supports:

- `judge_password_login_succeeded`;
- `judge_access_denied`;
- `judge_logout`;
- `judge_score_created`;
- `judge_score_updated`;
- `legacy_judge_login_used`;
- `judge_auth_mode_conflict`.

Attribution may contain Better Auth user ID, judge profile ID, authorization
ID, event ID, submission ID, route, mode, and a sanitized reason. Passwords,
hashes, judge credentials, cookies, Better Auth tokens, Runtime assertions,
and callback state are never accepted by the audit function.

Audit persistence failure never broadens access.

## 14. Data preservation

Disposable live-shape counts before and after migration and qualification:

| Data | Before | After |
|---|---:|---:|
| Judge profiles | 3 | 3 |
| Assignments | 15 | 15 |
| Scores | 12 | 12 |
| Automatic judge authorizations | 0 | 0 |

The one approved authorization was created only by the explicit confirmed
operator tool. No assignment, score, judge profile, ownership row, identity
link, or admin authorization was rewritten.

## 15. Automated validation

- Focused B.4.3 principal/mode/API/boundary suite: passed.
- Role-neutral password provisioning tests: passed.
- Full unit suite: **232 passed across 31 files**.
- B.4.2 migration and authorization regression: passed.
- B.4.1 shared-principal regression: passed.
- Complete Phase B administrator desktop Chromium: **6 passed**.
- Complete Phase B administrator mobile Chromium:
  - initial run: 5 passed, one existing linking-screen timeout;
  - isolated rerun of the timed-out test: passed.
- B.4.3 desktop Chromium: **4 passed**.
- B.4.3 mobile Chromium: **4 passed**.
- WebKit: attempted; browser could not launch because the host lacks
  `libmanette-0.2.so.0` and `libhyphen.so.0`.
- Standalone TypeScript: passed.
- Next.js 16.2.12 production build: passed.
- Changed-file ESLint: zero errors; two pre-existing `Nav` `<img>` optimization
  warnings.
- `git diff --check`: passed.
- Secret scan: passed.
- Attribution-boundary scan: passed; agent and artifact callback files are
  unchanged.
- Browser bundle value scan: passed. The upstream Better Auth client bundle
  contains the generic environment-variable identifier `BETTER_AUTH_SECRET`
  but no configured secret value.
- Sensitive-output scan: passed.

Expected non-failing warnings:

- test/build environments have no GitHub OAuth client configuration;
- negative security fixtures intentionally emit rejected-operation messages;
- WebKit host libraries are unavailable.

## 16. Proposed production deployment

Proposed initial judge auth mode:

```text
VIBE_JUDGE_AUTH_MODE=hybrid
VIBE_JUDGE_EVENT_ID=evt_vibe_2025
```

Rollback release:

```text
767e4fd1c4d704402973a60c76465eee2813709f
```

Rollback mode:

```text
VIBE_JUDGE_AUTH_MODE=legacy
```

Expected database changes after approval:

1. additive `judge_authorizations` table and indexes;
2. unique assignment and score ownership indexes;
3. one complete Ada Better Auth user/credential;
4. exactly one active Ada judge authorization;
5. audit rows for explicit provisioning/authorization and qualified use.

No existing profile, assignment, score, judge token, admin authorization,
identity link, or Viby record is removed or rewritten.

## 17. Exact production migration command

Run only after recording service/database state and creating the established
protected backup:

```bash
DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM="MIGRATE JUDGE AUTHORIZATIONS DATABASE /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db" \
npm run --silent db:migrate:judge-authorizations
```

Run the identical command a second time, then validate counts, duplicates, and
foreign keys.

## 18. Exact Ada account provisioning command

The operator must place the already approved password in a temporary
operator-owned mode-0600 file outside the repository. The password must not
appear on the command line or in this report.

```bash
DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
VIBE_PASSWORD_USER_PROVISION_CONFIRM="PROVISION_PASSWORD_USER:/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db:judge_user_ada:judgeada@fff.ad" \
npm run --silent auth:provision-password-user -- \
  --user-id judge_user_ada \
  --name "Ada Patel" \
  --email judgeada@fff.ad \
  --password-file /run/user/1000/vibe-judgeada-password
```

Securely remove the temporary password file immediately after successful
provisioning and authentication verification.

## 19. Exact explicit mapping commands

Dry run:

```bash
npm run --silent db:judge-authorizations -- \
  --database /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
  --action grant \
  --user-id judge_user_ada \
  --judge-id judge_media_ada \
  --event-id evt_vibe_2025 \
  --provenance operator_approved_b4_3_qualification \
  --dry-run
```

Confirmed apply:

```bash
npm run --silent db:judge-authorizations -- \
  --database /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
  --action grant \
  --user-id judge_user_ada \
  --judge-id judge_media_ada \
  --event-id evt_vibe_2025 \
  --provenance operator_approved_b4_3_qualification \
  --apply \
  --confirm "GRANT JUDGE AUTHORIZATION judge_user_ada judge_media_ada evt_vibe_2025 ON /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db"
```

Inspect afterward and verify exactly one new active mapping. Do not infer or
create Ben/Cleo mappings during this one-mapping deployment gate.

## 20. Manual live qualification checklist

After explicit approval, migration, mapping, immutable release construction,
and initial `hybrid` restart:

1. Verify exact release, PID, start time, mode, logs, local health, and public
   health.
2. Sign in to `/judge` using the approved Ada Better Auth password account.
3. Verify `/judge/dashboard` shows Ada's existing profile and assignments.
4. Verify an assigned submission loads.
5. Verify an unassigned submission is denied.
6. Create/update a disposable score and confirm ownership remains
   `judge_media_ada`.
7. Attempt a browser-supplied alternate `judgeId` and confirm it is ignored.
8. Confirm cross-origin score mutation is denied.
9. Confirm current event-freeze behavior.
10. Verify judge-only access cannot open the admin dashboard.
11. Verify an admin-only account cannot open the judge dashboard.
12. If using an approved combined-role account, switch between admin and judge
    under one Better Auth session.
13. Verify authenticated unauthorized behavior for a no-role account.
14. Verify the legacy fallback remains visibly marked and usable only in
    `hybrid`.
15. Verify unified Better Auth takes precedence over a stale legacy cookie.
16. Log out and confirm both admin and judge protected routes are denied.
17. Revoke the test judge authorization through the explicit tool; verify
    immediate denial and preserved assignments/scores; restore only through an
    explicit approved grant if qualification requires it.
18. Confirm no email matching, Viby judge flow, new admin grant, identity link,
    or custom unified judge cookie was created.

## 21. Rollback

Application rollback:

1. set `VIBE_JUDGE_AUTH_MODE=legacy`;
2. restore immutable release
   `767e4fd1c4d704402973a60c76465eee2813709f`;
3. restart only the Vibe Hackathon user service;
4. verify PID, logs, local health, and public health.

The additive authorization schema and explicit authorization history may
remain. Do not delete judge authorizations, profiles, assignments, scores,
Better Auth sessions, identity links, or audit records merely to roll back the
application.

Database restore is not normally required. Retain the verified predeployment
backup and use it only if the additive migration itself is proven unsafe.
Viby remains untouched.

## 22. Gate for B.4.4 Judge Viby Login

B.4.4 may begin only after:

1. explicit B.4.3 deployment approval;
2. canonical migration twice with foreign-key/count validation;
3. one explicit Ada user/profile/event authorization;
4. successful hybrid live qualification;
5. Better Auth password judge access, scoring ownership, logout, role
   switching, revocation, and legacy fallback all pass;
6. the final B.4.3 mode and rollback state are recorded;
7. no Viby changes or application-side Runtime workarounds are introduced.

This report is a pre-deployment approval packet. It does not authorize or
perform production changes.

`READY FOR B.4.3 DEPLOYMENT APPROVAL`
