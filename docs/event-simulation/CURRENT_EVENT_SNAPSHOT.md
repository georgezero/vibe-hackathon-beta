# Current event snapshot

Baseline was captured on host `paui`, branch `phase-vh-m6-viby-better-auth-session`, HEAD `a70edc28326108dfc84a69af303f680ceaa7f735`. The managed user service was healthy on port 3000 (PID 2987399, restart count 0); the public health endpoint returned HTTP 200.

Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`.

- size: 835,584 bytes;
- mode/owner: `0600 george:george`;
- checksum at baseline: `939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`;
- journal mode: WAL;
- SQLite: 3.53.2;
- integrity: `ok`;
- foreign keys: empty result.

The current event is `evt_vibe_2025` / `vibe-hackathon-2026`. Baseline counts
include 8 users, 8 Better Auth accounts, 26 sessions, 2 identity links, 10
submissions, 2 owners, 5 memberships, 3 invitations, 5 judges, 3 judge
authorizations, 17 assignments, 14 human score rows, 17 evaluation states, 14
private-note rows, 1 chat room, 6 messages, and 2 read states. Of those,
12 scores and 12 private notes are real competition records. The preserved snapshot also preserves the synthetic D.4
qualification fixture exactly as it existed at capture time.

Event selection is database-backed: participant, public, and administrator
flows call `getActiveEvent()` and use the single row with `events.is_active=1`.
Judge APIs additionally require the active event ID selected by
`VIBE_JUDGE_EVENT_ID` (defaulting to `evt_vibe_2025`); there is no route-level
event selector. A simulation instance therefore deactivates the real event in
its clone and sets the judge override to `evt_kentucky_vibes`.

## Snapshot method

`npm run db:event:snapshot` uses better-sqlite3's SQLite online backup API while
the application remains available. The destination is checkpointed and changed
to DELETE journaling before it is mode `0440`, so no WAL/SHM sidecar is needed
to read the immutable artifact. Metadata and a SHA-256 sidecar are written
beside the file. Existing artifacts are never overwritten.

The snapshot was restored to a temporary database, checked for integrity and
foreign keys, and booted in an isolated Next.js process on port 3331. That
process returned health 200 and was terminated. The canonical service stayed
on PID 2987399 throughout.

Chatto and Viby were unchanged. Real results remain unpublished.
