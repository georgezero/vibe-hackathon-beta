# Phase B.4.3 Pre-implementation Gate

Date: 2026-07-30  
Initial decision: `CONDITIONAL — OPERATOR MAPPING REQUIRED`  
Resolved decision: `PASSED — OPERATOR MAPPING RECEIVED`

## Scope and outcome

Phase B.4.3 source implementation initially paused because its mandatory
operator-mapping gate was not satisfied. The repository and deployed baseline
matched Phase B.4.2, and the disposable migration rehearsal passed. The
operator then explicitly approved the Ada judge mapping and a non-production
Better Auth account, allowing the gate to continue without email or name
inference.

Selecting a judge profile from an email address, display name, assignment,
score, or legacy judge token is prohibited. There are three distinct judge
profiles, so the mapping cannot be inferred safely.

At the initial gate, no source code, canonical database record, running
service, deployment, or Viby configuration was changed.

## Repository baseline

- Host: `paui`
- Repository:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Required and observed HEAD:
  `47f041287326371aad6984e1c42ce073270e1fce`
- Merge base with `origin/main`:
  `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- Tracking state: 35 commits ahead of `origin/main`
- Tracked changes: none
- Protected untracked file: one pre-P0.4 database backup; it was not opened,
  copied, inspected, modified, or included in any command target.

## Deployed baseline

- Selected immutable release:
  `/opt/vibe-hackathon/releases/767e4fd1c4d704402973a60c76465eee2813709f`
- User service: `vibe-hackathon.service`
- State: active/running
- PID: `809697`
- Started: `2026-07-29 22:35:40 EDT`
- Restarts: `0`
- Effective session mode: `better-auth`
- Local health: HTTP `200`
- Public health: HTTP `200`
- Canonical database:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Canonical database modification time:
  `2026-07-28 19:54:37.363388871 -0400`

The system service namespace has no matching unit; the application is
correctly managed as a user service.

## Canonical data reconfirmation

- Canonical event ID: `evt_vibe_2025`
- Event slug: `vibe-hackathon-2026`
- Event name: `Vibe Hackathon 2026`
- Active events: one
- Judge profiles: `3`
- Judge assignments: `15`
- Human scores: `12`
- Better Auth users: `1`
- Installed canonical `judge_authorizations` table: no
- Canonical judge authorizations: `0`
- Duplicate assignment ownership pairs: `0`
- Duplicate score ownership pairs: `0`
- Foreign-key violations: `0`

The canonical database remains at the pre-B.4.2 deployed schema because B.4.2
was intentionally not deployed.

## Current judge authentication and authorization baseline

### Protected page guards

`lib/judge-page-auth.ts` implements `requireAuthorizedJudgePage()`. It calls
`requireJudgeSession()`, reads the server-verified judge ID from the custom
judge session, and reloads the corresponding judge profile. The protected
pages using it are:

- `/judge/dashboard`
- `/judge/submissions/:submissionId`
- `/judge/submissions/:submissionId/ai`

### Protected API guards

`lib/judge-api.ts` implements `withJudgeApi()`. For protected operations it:

1. reads `vibe_judge_session`;
2. verifies the HMAC and timestamps;
3. reloads the judge profile using the signed `judge_id`;
4. preserves the route policy's same-origin check for mutations.

The protected judge endpoints are:

- `GET /api/judge/data`
- `POST /api/scores`
- `POST /api/judge/logout`

`POST /api/judge/session` is intentionally public but same-origin protected so
that the private credential can be exchanged for the current custom cookie.

### Custom judge cookie

`lib/judge-session.ts` owns the `vibe_judge_session` HMAC cookie. The payload
contains a server-created judge ID, display name, role marker, issued time, and
expiration time. The current default lifetime is 12 hours. Cookie flags remain
HTTP-only, same-site `lax`, secure in the deployed HTTPS environment, and
path-wide.

### Login and logout

`/judge` currently accepts the private invitation credential. The exchange is
implemented by `POST /api/judge/session`, which validates the credential and
creates the custom judge cookie. `POST /api/judge/logout` clears that cookie.
No Better Auth judge login is active yet.

### Assignment, scoring, origin, and freeze boundaries

- Judge identity is server-derived from the verified custom cookie.
- Dashboard and submission queries filter using that resolved judge ID.
- Submission pages and APIs require an exact
  `judge_assignments(judge_id, submission_id)` row.
- Score reads and writes use the same server-resolved judge ID.
- A browser-provided judge ID does not select score ownership.
- `POST /api/scores` preserves the existing same-origin route policy.
- `POST /api/scores` calls `assertEventNotFrozen()` before mutation.
- The displayed judging deadline remains informational; the event freeze and
  assignment rules remain the mutation boundaries.

These paths were inspected only. They were not modified.

## Disposable migration rehearsal

A disposable copy of the explicit canonical database was created beneath
`/tmp`, migrated twice, inspected, validated, and deleted.

First run:

- schema: valid
- judge profiles: `3`
- assignments: `15`
- scores: `12`
- judge authorizations: `0`
- automatic authorizations created: `0`
- foreign-key check: passed

Second run:

- schema: valid
- judge profiles: `3`
- assignments: `15`
- scores: `12`
- judge authorizations: `0`
- automatic authorizations created: `0`
- foreign-key check: passed

The second run demonstrated idempotence.

Validated indexes:

- `judge_authorizations_user_idx`
- `judge_authorizations_judge_idx`
- `judge_authorizations_event_idx`
- `judge_authorizations_status_idx`
- `judge_authorizations_user_event_idx`
- `judge_authorizations_judge_event_idx`
- `judge_authorizations_status_event_idx`
- `judge_authorizations_active_user_event_unique`
- `judge_authorizations_active_judge_event_unique`
- `judge_assignments_judge_submission_unique`
- `human_scores_judge_submission_unique`

Post-migration validation found:

- duplicate assignment pairs: `0`
- duplicate score pairs: `0`
- foreign-key violations: `0`
- unexpected authorizations: `0`

The temporary database, WAL, SHM, and temporary directory were removed after
validation.

## Mapping gate

### Available Better Auth user

- User ID: `myeNSuVoDO4K2oL2RQ1CJ`
- Display name: `George One`
- Email: `george@fff.ad`

### Available judge profiles

- `judge_media_ada` — Ada Patel
- `judge_media_ben` — Ben Okafor
- `judge_media_cleo` — Cleo Stein

Each judge has five assignments and four existing scores. Those counts do not
establish identity and were not used to choose a mapping.

### Required operator decision

The operator must explicitly supply:

1. Better Auth user ID;
2. judge profile ID;
3. event ID, expected to be `evt_vibe_2025`;
4. non-empty grant provenance;
5. an approval statement identifying the selection as intentional.

No repository file or prior report contained that approval at the initial
gate. Consequently, before the follow-up operator message:

- no dry-run grant was fabricated;
- no disposable authorization was created;
- no implementation source changes were started;
- no production migration or mapping command was run.

## Operator approval and gate resolution

The operator subsequently approved:

- judge profile: `judge_media_ada`;
- non-production account email: `judgeada@fff.ad`;
- event: `evt_vibe_2025`;
- approval source: the explicit operator follow-up in this task;
- authorization provenance:
  `operator_approved_b4_3_qualification`.

The supplied password was treated as a secret. It was not echoed into this
report, committed, or retained in a database or file after the disposable
qualification.

A new disposable canonical-shape database was then migrated twice. A complete
Better Auth test credential was created for:

- disposable user ID: `b43_ada_XtwDOCT_2t1B`;
- judge profile ID: `judge_media_ada`;
- event ID: `evt_vibe_2025`.

The B.4.2 tool first returned `ready`, then created exactly one authorization:

- authorization ID: `QkU9nZ0BYyHU8uF38TAYb`;
- status: `active`;
- provenance: `operator_approved_b4_3_qualification`.

Validation proved:

- the password credential verified through Better Auth's password hashing
  boundary;
- one judge authorization existed;
- zero administrator authorizations existed for the test user;
- judge profiles remained `3`;
- assignments remained `15`;
- scores remained `12`;
- `PRAGMA foreign_key_check` returned no rows.

The disposable database and associated WAL/SHM files were deleted. Ben and
Cleo were approved as future accounts but were deliberately not mapped in this
gate because B.4.3 requires exactly one qualification mapping.

## Command after explicit approval

After the operator supplies the four required values, the next run should
recreate a disposable canonical-shape database, migrate it twice, then perform
an ID-only dry run:

```bash
npm run --silent db:judge-authorizations -- \
  --database /absolute/path/to/disposable.db \
  --action grant \
  --user-id '<APPROVED_BETTER_AUTH_USER_ID>' \
  --judge-id '<APPROVED_JUDGE_PROFILE_ID>' \
  --event-id 'evt_vibe_2025' \
  --provenance '<APPROVED_GRANT_PROVENANCE>' \
  --dry-run
```

The apply step must use the tool's exact confirmation string and must target
only the disposable database during the pre-implementation gate.

## Security conclusion

The block is intentional and security-preserving. Guessing among three judge
profiles would conflate contact metadata with identity, undermine the
event-scoped authorization model, and violate the explicit-mapping
requirement. B.4.3 can resume as soon as the operator provides the approved
IDs and provenance.

`PASSED — OPERATOR MAPPING RECEIVED`
