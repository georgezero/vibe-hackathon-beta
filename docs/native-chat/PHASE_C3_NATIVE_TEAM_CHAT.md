# Phase C.2B–C.2D — Native team chat foundation

## Room and message domain

`chat_rooms` is one private, active room per claimed submission. Room creation
is lazy and reconciles by the database mapping, never by a display name.
`chat_messages` supports bounded plain text, `user_message` and
`system_event` types, and a room/user/client-message uniqueness key for safe
retries. `chat_read_states` stores one last-read marker per active member.
`chat_events` is a small delivery stream for new messages and membership
revocations; message bodies are not copied into generic audit metadata.

The feature is disabled by default. When enabled for a controlled allowlist,
the native route is `/projects/<submissionId>/messages`. The current UI is a
conversational, text-only room with an explicit privacy warning and polling
fallback when SSE is unavailable. It does not implement attachments, DMs,
threads, reactions, typing, calls, moderation, or participant search.

## Authorization

Every room, history, post, read-state, unread, and SSE request resolves the
Better Auth application principal and the exact active submission membership.
Admins, judges, roster email matches, and edit tokens have no implicit room
access. Revocation emits a room event and the SSE loop rechecks membership on
each poll; the next REST request and reconnect fail closed.

## Qualification state

Disposable qualification is complete. Desktop/mobile Chromium passed owner,
teammate invitation, two-browser messaging, unread, negative authorization,
and membership-revocation checks. The revocation UI and next REST authorization
check completed within the five-second pilot SLA. See
`PHASE_C3_DISPOSABLE_QUALIFICATION.md` for the evidence.

No canonical migration, production deployment, feature-flag activation, or
live pilot has occurred. Changed-file lint is clean; repository-wide lint still
has unrelated baseline errors. Controlled pilot approval and a lint waiver or
cleanup remain required.
