# Phase C.5 — Team Workspace Predeployment Gate

## Disposition

`CONDITIONAL — No explicitly approved real submission and operator deployment approval supplied.`

This report covers the local implementation and qualification of the project
workspace. Production remains on the C.4R synthetic pilot release. No C.5
canonical migration, release, restart, or real-submission allowlist change has
been performed.

## Baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Final source HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` (C.5 remains in the
  uncommitted working tree pending approval.)
- Production release: `a70edc...-c4r-native-chat-pilot-20260801T203600Z`
- Production PID/start: `2187506`, `Sat 2026-08-01 16:36:06 EDT`
- Local/public health: HTTP 200
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Current production flags: `VIBE_NATIVE_TEAM_CHAT_ENABLED=true`,
  `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr`
- Synthetic pilot: `sub_QUPapzbr`, one active owner membership, historical
  revoked teammate rows, one room, six messages, and two read states.
- Existing C4 protected backup remains at
  `/opt/vibe-hackathon/backups/local.db.pre-c4-native-chat.20260801T201456Z.sqlite`.

The production database currently reports 5 users, 9 submissions, 1 owner,
4 membership rows, 3 invitations, 1 room, 6 messages, 2 read states, 3 judges,
15 assignments, and 12 scores. Integrity is `ok` and foreign-key violations are
empty. Chatto and Viby are unchanged.

## Workspace architecture

The authenticated shell is `/projects/:submissionId` with child routes:

- `/projects/:submissionId` — Overview
- `/projects/:submissionId/team` — formal roster and explicit account membership
- `/projects/:submissionId/messages` — existing native text room
- `/projects/:submissionId/activity` — safe project activity projection
- `/projects/:submissionId/preview` — read-only hosted preview
- `/projects/:submissionId/status` — readiness, eligibility, and judging state

Every route resolves Better Auth, an application principal, the exact
submission, and an active owner/teammate membership. Admin and judge roles,
roster email matches, Submission IDs, and Edit tokens do not grant workspace
access. Guest Edit-token routes remain unchanged.

The shared `SubmissionWorkspaceShell` keeps project context, role, readiness,
event, and responsive tabs consistent. Activity uses allowlisted audit events
through `lib/project-activity.ts`; no new table or migration is required for
this bounded projection. Messages remain conversational and are not copied into
Activity.

## Team and invitation UX

Team distinguishes formal roster records from authenticated workspace members.
Owners can create/revoke expiring, hashed teammate invitations. Teammate account
joining remains explicit and grants only project membership. Ownership transfer,
automatic roster matching, and account creation from roster data remain out of
scope. Outbound email is not implied; the owner copies the private link.

## Messages and rollout behavior

The existing SSE/polling native room, read state, idempotent client message IDs,
and revocation checks are preserved. Allowlisted projects receive the normal
room. Non-allowlisted projects receive a participant-facing “not enabled yet”
state and do not create a room. The synthetic C.4R allowlist remains the only
production activation until approval.

## Preview, status, and My Projects

Authenticated Preview is read-only and contains no Edit token URL. Status reuses
existing readiness and judging data without changing finalization semantics. My
Projects now uses “Open workspace” as the primary action, shows owner/teammate
status and unread counts, and preserves owner-only edit actions.

## Privacy and retention

Rooms are private to active members; judges and administrators are not implicit
members. The UI warns users not to share patient information, passwords, private
Edit tokens, or API keys. Messages are plain text, retained under the existing
event/post-event policy, and tombstones preserve deletion history. No
end-to-end-encryption claim is made. Operators may access infrastructure and
backups under the existing incident/support policy.

## Local qualification

- Full unit suite: **237 passed** (40 files).
- Native-chat/workspace desktop/mobile Chromium: **4 passed**, including owner
  workspace-tab checks, invitation/join, two-browser messaging, unread state,
  revocation, and private-room denial copy.
- TypeScript/build: passed (`npm run build`).
- Changed-file ESLint: passed for all C.5 source files.
- `git diff --check`: passed.
- Migration and database tests remain isolated; canonical database was not
  written by qualification.
- WebKit: not run; host dependencies are unavailable and remain non-blocking.
- Repository-wide baseline ESLint issues are unrelated technical debt.

## Migration and expected data changes

C.5 adds no schema migration: it projects existing audit events and reuses the
C.2/C.3 membership, room, message, invitation, and read-state tables. A future
real pilot must still run the already-qualified additive migrations twice on a
verified backup, then validate foreign keys and integrity. No teammate rows are
created from roster emails.

## Proposed limited real pilot

No real submission has been supplied with explicit owner and operator approval.
Therefore the allowlist must remain exactly `sub_QUPapzbr` for now. A future
candidate must have one explicit claimed owner, owner consent to pilot status,
synthetic initial messages, deliberate teammate invitation, and no sensitive
content. The operator must record the Submission ID, owner user ID, active owner
membership, and approvals without recording tokens.

## Deployment gate and rollback

After explicit approval only:

1. Back up the canonical database and record release/PID/health/fingerprint.
2. Run the additive migrations twice and validate integrity/foreign keys.
3. Build an immutable release.
4. Set `VIBE_NATIVE_TEAM_CHAT_ENABLED=true` and an exact comma-separated
   `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS` list.
5. Restart only Vibe Hackathon and verify local/public HTTP 200.
6. Run synthetic regression, then the approved owner/teammate/revocation and
   unauthorized matrix.

Rollback removes real IDs from the allowlist and disables the flag; if needed,
restore the prior immutable release. Preserve additive chat/membership history.
No Chatto or Viby rollback is involved.

## Manual checklist after approval

- Owner opens all six tabs and sends synthetic text.
- Owner creates a teammate invitation; the recipient joins with a distinct
  account.
- Teammate sees the workspace, but not owner-only controls.
- Owner revocation yields HTTP denial on history/post/unread/reconnect/hard
  refresh and no new SSE events within five seconds.
- Unrelated, roster-email, admin-only, and judge-only accounts are denied.
- Messages-unavailable state leaves login, editing, My Projects, admin, judge,
  and public project routes healthy.

`CONDITIONAL — No explicitly approved real submission and operator deployment approval supplied.`
