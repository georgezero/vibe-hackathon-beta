# Phase C.5 — Team Workspace

The C.5 implementation makes the claimed submission the participant workspace
hub without changing the native-chat authorization model. It adds a shared
responsive shell at `/projects/:submissionId` with Overview, Team, Messages,
Activity, Preview, and Status tabs.

## Information architecture

- **Overview** answers what the project is, what is incomplete, and what to do
  next.
- **Team** distinguishes formal roster metadata from explicit authenticated
  memberships and keeps invitation controls owner-only.
- **Messages** preserves the qualified private text room, SSE/poll fallback,
  unread state, and privacy warning.
- **Activity** presents a safe projection of selected project events; it is not
  the generic security audit log.
- **Preview** renders current hosted submission state for active members without
  exposing an Edit token URL.
- **Status** separates draft/readiness, eligibility, and judging state.

## Authorization

Every workspace route uses `resolveSubmissionWorkspace`: Better Auth session →
application principal → exact submission → active explicit owner or teammate
membership. Roster email matching, admin/judge roles, Submission IDs, and Edit
tokens remain non-authorizing for workspace access. Revoked members lose every
route and chat operation on the next server check.

## Activity boundary

`lib/project-activity.ts` allowlists participant-facing audit actions such as
draft creation, claiming, teammate lifecycle, submission updates, finalization,
room creation, and preview updates. Summaries are sanitized and contain no
tokens, credentials, raw audit metadata, or message bodies. Messages remain
human conversation; selected high-value system events may be mirrored by the
existing bounded chat model, but C.5 does not flood the room with audit events.

## Design decisions

The existing Vibe Hackathon visual system is inherited rather than introducing
a separate chat product language. The shell uses established CSS tokens,
compact badges, restrained cards, a horizontally scrollable mobile tab row,
role-aware actions, and clear private-workspace empty/denial states. Messages
retain a comfortable timeline and keyboard-safe composer. Owner and teammate
controls are progressively disclosed in Team.

## Rollout

The synthetic C.4R project remains the only production allowlist entry. C.5 is
predeployment until an operator approves one or two real claimed submissions.
No canonical migration, release restart, Chatto change, or Viby change was made
by this phase.

## Deployment status

The workspace was deployed in the C.5D release while native chat remained
allowlisted only for the synthetic `sub_QUPapzbr` pilot. No real participant
submission, Chatto instance, or Viby deployment was changed. The deployment
details and remaining authenticated walkthrough gate are recorded in
[PHASE_C5_TEAM_WORKSPACE_DEPLOYMENT.md](./PHASE_C5_TEAM_WORKSPACE_DEPLOYMENT.md).
