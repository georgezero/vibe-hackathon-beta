# Room and membership model

## Proposed mappings

```text
Vibe submission (claimed)
  -> chat_rooms(submission_id, provider, external_room_id, status,
                created_at, archived_at)
  -> one private Chatto room (`universal=false`)
```

The mapping is unique per submission/provider and idempotently created by a
Vibe server-side job or request. Chatto room IDs are opaque external IDs and
must not be inferred from submission IDs.

## Eligible members for the pilot

- the explicit claimed submission owner;
- later, explicitly claimed teammates with active membership records;
- optionally, an explicitly assigned organizer-support identity.

Not eligible by default: judges, unrelated administrators, unclaimed roster
entries, or users whose email happens to match team metadata.

For the eventual multi-user model, add a Vibe-owned table such as:

```text
submission_chat_members
  submission_id
  user_id
  role                 owner | teammate | support
  status               active | revoked
  granted_at / revoked_at
  granted_by_user_id
```

Use restrictive foreign keys, a unique active membership per submission/user,
and an append-preserving audit trail. Membership changes are authoritative on
the Vibe side; Chatto is a projection.

## Provisioning sequence

1. Vibe confirms the current Better Auth session and explicit submission
   ownership/membership.
2. Vibe idempotently provisions or resolves the mapped Chatto user.
3. Vibe idempotently creates the private room mapping.
4. Vibe grants the exact Chatto member ID.
5. Vibe hands the user to Chatto through the approved OAuth/session handoff.
6. On revoke/disable, Vibe removes membership and records the result.

No step uses an email match, edit token, judge assignment, or roster overlap.

## Access and revocation tests required in C.2B

- non-members cannot discover, read, or receive realtime events for the room;
- removal prevents new reads and WebSocket events;
- a removed member's existing browser/session cannot retain access;
- a second owner/member cannot be accidentally added by an idempotent retry;
- archived submissions stop room writes without deleting message history;
- Chatto outage leaves the submission and judging paths healthy.

The C.2 pilot intentionally excludes attachments, calls, DMs, public rooms,
judge rooms, bots, and notifications.
