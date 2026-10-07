# C.2B integration spike plan

This is a disposable proof of concept, not production enablement.

## Scope

1. One disposable Better Auth test user.
2. One disposable claimed test submission (no production edit token).
3. One mapped Chatto test user.
4. One private Chatto room.
5. Server-side room creation and exact membership grant.
6. Text post/read, unread/read state, and logout.
7. Remove membership and prove access/realtime is denied.

Exclude DMs, public channels, judge rooms, calls, attachments, bots, AI agents,
notifications, and real participant content.

## Prerequisites / gates

- Chatto operator approves isolated test workspace/data and cleanup policy.
- A supported OAuth/OIDC or scoped Chatto session handoff is configured and
  callback origins are allowlisted.
- A narrowly scoped user-provisioning method exists; do not expose the operator
  Unix socket through Vibe.
- Vibe adds `chat_identities` and `chat_rooms` migrations plus audit events.
- C.2 membership work defines active/revoked owner/member records before adding
  anyone beyond the claimed owner.
- Encrypted backup and isolated restore are rehearsed.

## Qualification sequence

1. Provision the disposable user idempotently.
2. Claim the disposable submission through the real secure flow.
3. Create/reconcile exactly one private room.
4. Open Chatto through the approved handoff.
5. Post/read a benign test message and verify unread/read state.
6. Remove the user; test room listing, history, and WebSocket denial.
7. Repeat provisioning to prove idempotence and inspect Vibe/Chatto audit logs.
8. Destroy disposable data according to the operator-approved procedure.

Success means Vibe remains the authority, no token crosses into Chatto, room
access is exact, revocation is effective, and Chatto failure does not affect
submission or judging paths.
