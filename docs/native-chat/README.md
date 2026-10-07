# Native team chat

Phase C.2 establishes application-owned private team communication. Better
Auth identity, explicit submission membership, room eligibility, messages,
unread state, and authorization all remain inside Vibe Hackathon.

Chatto integration was not pursued because the deployed version lacked a
least-privilege provisioning/session integration boundary. Chatto remains a
separate system and architectural reference.

The implementation is feature-gated with `VIBE_NATIVE_TEAM_CHAT_ENABLED` and
optional `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS`. No production chat pilot is
enabled by this change.

Disposable C.3 qualification passed desktop/mobile Chromium, invitations,
two-browser messaging, authorization-negative, and revocation checks. The
synthetic C.4R pilot is deployed only for `sub_QUPapzbr`; all other submissions
remain disabled. The pilot report records the owner, teammate, revocation,
rollback, and database evidence.

Phase C.5 adds a membership-gated project workspace at `/projects/:submissionId`
with Overview, Team, Messages, Activity, Preview, and Status tabs. Activity is a
safe projection of participant-facing audit events; it does not expose the
generic audit log or message bodies. The C.5 implementation was qualified
locally; C.5D deployed the workspace without expanding the chat allowlist or
activating a real team.

Phase C.5D deployed the workspace while preserving the synthetic-only chat pilot
for `sub_QUPapzbr`. No real submission was added to the allowlist. See the
[deployment report](./PHASE_C5_TEAM_WORKSPACE_DEPLOYMENT.md).

## Documents

- [Membership](./PHASE_C2_SUBMISSION_MEMBERSHIP.md)
- [Native chat](./PHASE_C3_NATIVE_TEAM_CHAT.md)
- [Security and privacy](./SECURITY_AND_PRIVACY.md)
- [Realtime and revocation](./REALTIME_AND_REVOCATION.md)
- [Operations and rollback](./OPERATIONS_AND_ROLLBACK.md)
- [C.3 disposable qualification](./PHASE_C3_DISPOSABLE_QUALIFICATION.md)
- [C.4R synthetic production pilot](./PHASE_C4_SYNTHETIC_PRODUCTION_PILOT.md)
- [C.5 predeployment gate](./PHASE_C5_TEAM_WORKSPACE_PREDEPLOYMENT.md)
- [C.5 workspace implementation](./PHASE_C5_TEAM_WORKSPACE.md)
- [C.5D deployment](./PHASE_C5_TEAM_WORKSPACE_DEPLOYMENT.md)
