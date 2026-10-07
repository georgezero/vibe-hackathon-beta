# Phase C.5D — Team Workspace Deployment

## Disposition

`CONDITIONAL GO — Post-restart authenticated synthetic workspace walkthrough remains pending; retained pilot credentials were intentionally not recreated or exposed.`

The approved workspace release is deployed. Native chat remains synthetic-pilot
only and the production allowlist was not expanded.

## Baseline and approvals

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Source HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` (working tree release)
- Previous release: `a70edc...-c4r-native-chat-pilot-20260801T203600Z`
- Previous PID/start: `2187506`, `Sat 2026-08-01 16:36:06 EDT`
- Previous restart count: `0`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deploy fingerprint: `d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03`
- Operator approvals: workspace/activity deployment and additive migration
  approved; no real chat submission approved.

The only production chat allowlist entry before and after deployment is
`sub_QUPapzbr`. No real participant submission or team was created or inferred.

## Backup

A new online SQLite backup was created without overwriting prior backups:

`/opt/vibe-hackathon/backups/local.db.pre-c5d-workspace.20260801T231207Z.sqlite`

- mode: `0600`
- SHA-256: `fb8d198d97dad6093dcca7265dcfa443b20d628b27e90a9ddca11abd990fed6b`
- `integrity_check`: passed
- `foreign_key_check`: passed

## Migration

The additive membership and native-chat migrations were applied to the explicit
canonical database and each was run twice:

```text
VIBE_C2A_MIGRATION_CONFIRM="MIGRATE SUBMISSION MEMBERSHIPS DATABASE /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db" DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db npm run db:migrate:submission-memberships
VIBE_C2B_MIGRATION_CONFIRM="MIGRATE NATIVE CHAT DATABASE /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db" DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db npm run db:migrate:native-chat
```

All four runs reported idempotent success and foreign-key validation. The
database fingerprint remained unchanged, confirming that the C.5 workspace
activity projection requires no new schema migration.

Post-migration counts:

| Data | Count |
| --- | ---: |
| Users | 5 |
| Submissions | 9 |
| Submission owners | 1 |
| Membership rows | 4 |
| Invitations | 3 |
| Chat rooms | 1 |
| Messages | 6 |
| Read states | 2 |
| Judges | 3 |
| Assignments | 15 |
| Human scores | 12 |
| Admin authorizations | 1 |
| Judge authorizations | 1 |
| Viby identity links | 2 |

The one room is for `sub_QUPapzbr`; no non-pilot room exists. Integrity passed,
foreign-key violations were empty, and the pilot retains one active owner plus
its prior revoked teammate history. Assignments, scores, authorizations,
identity links, and real submission ownership were unchanged.

## Release and service

Immutable artifact:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-c5-team-workspace-20260801T231500Z`

The artifact contains the workspace routes and excludes databases, environment
files, test results, and local credentials. The symlink was switched atomically
and only `vibe-hackathon.service` was restarted.

- Deployed commit marker: `a70edc28326108dfc84a69af303f680ceaa7f735`
- New PID: `2656772`
- Start: `Sat 2026-08-01 19:14:33 EDT`
- Restart count: `0`
- Next.js ready evidence: `Ready in 197ms`
- Local health: HTTP 200
- Public health: HTTP 200
- Listening port: `3000`

Chatto and Viby were not restarted or modified.

## Feature configuration

The shared production environment remains exactly:

```text
VIBE_NATIVE_TEAM_CHAT_ENABLED=true
VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr
```

No other submission ID was appended. Non-allowlisted messages are still gated
by the existing participant-facing “Team messages are not enabled for this
project yet” branch and do not create rooms. There was no claimed non-chat
submission available in the database for an authenticated comparison test;
none was fabricated for this deployment.

## Workspace and regression qualification

Local desktop/mobile Chromium qualification passed 4/4, including workspace
tab checks, Team/invitation flow, two-browser messaging, unread state, SSE
revocation, and signed-out/private-room denial. Unit tests remain 237 passed;
TypeScript, production build, changed-file ESLint, and `git diff --check` passed.
WebKit remains unavailable because host libraries are missing.

Post-deploy public smoke checks confirmed:

- `/api/health` local/public: HTTP 200;
- signed-out `/projects/sub_QUPapzbr`: generic sign-in state;
- signed-out `/projects/sub_QUPapzbr/messages`: generic message sign-in state;
- release route files and markers present;
- no artifact database, environment file, test result, or credential present.

The prior C4R production report remains the authoritative authenticated
synthetic owner/teammate, unread, message, and revocation qualification. A
post-restart authenticated walkthrough of the newly added Overview, Team,
Activity, Preview, Status, and Account workspace views is still required once
the retained synthetic pilot credentials are made available through the normal
operator process. No credentials were recreated during this deployment.

## Role and privacy boundary

Workspace access continues to require Better Auth plus explicit active owner or
teammate membership. Admin, judge, roster-email, Submission ID, and Edit-token
possession do not grant private workspace access. Activity is a sanitized
allowlisted projection and contains no tokens, sessions, assertions, raw audit
payloads, or message bodies. Chat remains text-only and synthetic-pilot only.

## Rollback readiness

Primary rollback is to restore the previous immutable release and restart only
Vibe Hackathon. Configuration rollback removes any future real IDs from the
allowlist or disables native chat; additive tables and history remain intact.
Database restore is reserved for migration/integrity failure. No Chatto or Viby
rollback exists.

## Follow-up

1. Perform the authenticated synthetic workspace walkthrough with an approved
   temporary credential mechanism.
2. Review minor desktop/mobile polish items without broad redesign.
3. Keep the allowlist synthetic-only until a separate real-submission approval.

Chatto was unchanged.

Viby was unchanged.

`CONDITIONAL GO — Post-restart authenticated synthetic workspace walkthrough remains pending; retained pilot credentials were intentionally not recreated or exposed.`
