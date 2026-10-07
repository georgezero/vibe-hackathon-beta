# Phase C.4R — Synthetic Native Chat Production Pilot

Status: **GO — SYNTHETIC NATIVE CHAT PILOT DEPLOYED AND QUALIFIED**

This was a bounded development-environment pilot. No real participant account,
submission, edit token, assignment, score, Chatto instance, or Viby deployment
was used.

## Baseline and pilot identity

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting and final repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- The worktree already contained the reviewed C.1/C.2/native-chat changes and
  remains uncommitted. The deployed artifact also includes a small
  reverse-proxy correction that makes invitation redirects use the configured
  public base URL (`getBaseUrl()`), rather than an internal `0.0.0.0:3000`
  origin.
- Previous release: `0ec33b1`; previous PID: `970405`; previous start:
  `2026-08-01 09:34:55 EDT`.
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`.
- Pilot namespace: `native-chat-pilot-c4r20260801x`.
- Synthetic submission: `sub_QUPapzbr` (draft, `Native Chat Pilot Project`).
- Synthetic users:
  - `native_chat_pilot_owner_c4r20260801x`
  - `native_chat_pilot_teammate_c4r20260801x`
  - `native_chat_pilot_unrelated_c4r20260801x`

Passwords, the edit token, and invitation tokens were held only in mode-0600
temporary files during qualification. Those files were removed after testing.
No secret appears in this report.

The prior proposed submission `sub_Cl7jUPZ5` was not used because it had no
explicit claimed owner or approved teammate. Its native-chat endpoint remains
outside the allowlist.

## Backup, migration, and release

The protected pre-pilot backup was preserved unchanged:

`/opt/vibe-hackathon/backups/local.db.pre-c4-native-chat.20260801T201456Z.sqlite`

A second pre-mutation backup was also preserved:

`/opt/vibe-hackathon/backups/local.db.pre-c4r-native-chat.20260801T202000Z.sqlite`

Both passed SQLite integrity and foreign-key checks. A post-qualification
backup was created at:

`/opt/vibe-hackathon/backups/local.db.post-c4r-native-chat-20260801T204000Z.sqlite`

It has SHA-256
`fb8d198d97dad6093dcca7265dcfa443b20d628b27e90a9ddca11abd990fed6b` and
passed `integrity_check` and `foreign_key_check`.

The additive migrations were run twice:

```text
scripts/migrate-submission-memberships.ts
scripts/migrate-native-chat.ts
```

Both second runs were idempotent. Owner reconciliation produced exactly one
active owner membership and native-chat migration produced zero rooms before
the first room access. No teammate membership was created from roster email.

Deployed artifact:

`a70edc28326108dfc84a69af303f680ceaa7f735-c4r-native-chat-pilot-20260801T203600Z`

The release contains source marker `a70edc28326108dfc84a69af303f680ceaa7f735`,
the production build, and the required native-chat routes. The release excludes
the canonical database, `.env.local`, and test artifacts.

## Pilot configuration and deployment

The shared service environment was backed up before the pilot and then set to:

```text
VIBE_NATIVE_TEAM_CHAT_ENABLED=true
VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr
```

No other submission is enabled. The Vibe Hackathon user service was switched
atomically to the immutable release and restarted; Chatto and Viby were not
restarted or changed.

After restart:

- PID: `2187506`
- start: `2026-08-01 16:36:06 EDT`
- `NRestarts=0`
- process working directory: the C4R immutable release above
- local health: HTTP 200
- public health: HTTP 200
- database health: `ok`

The non-allowlisted `sub_Cl7jUPZ5` chat endpoint returned HTTP 503, while the
application health endpoint remained HTTP 200.

## Owner qualification

The synthetic owner signed in through the ordinary email/password flow, saw the
synthetic project in My Projects, and opened `/projects/sub_QUPapzbr/messages`.
The private room was lazily created once (`room_LnaQoi4iEvh5wMqu`), showed the
private-room warning, and persisted synthetic messages across refreshes. A
repeat request with the same client message ID returned the existing message
without duplication. The owner remained able to post after teammate revocation.

No edit token appeared in page source, browser console/network evidence, or
audit metadata. The existing C.3 browser suite additionally covered escaped
HTML and conflicting client-message-ID reuse.

## Teammate qualification

The owner created invitations through the normal team-management flow. The
database stored only token digests, and invitation audit metadata contained no
raw token. After the public-origin redirect correction, a separate browser
opened the invitation URL, signed in as the synthetic teammate, displayed the
explicit join confirmation, and accepted it.

The teammate appeared in My Projects as a teammate, entered the same private
room, and exchanged synthetic messages with the owner over SSE. Unread state
was observed before opening the room and was cleared on viewing. Regrant after
revocation restored access to the existing room without creating a duplicate
room or active membership.

Final pilot state has one active owner membership and the teammate membership
revoked. Three invitation lifecycle rows and three preserved revoked teammate
membership rows are expected pilot history.

## Revocation SLA

With the teammate room open and SSE active, the owner revoked the active
teammate membership.

- DELETE commit latency: 46 ms in the final qualification run.
- teammate post: HTTP 403
- history: HTTP 403
- unread: HTTP 403
- mark-read: HTTP 403
- polling/events request: HTTP 403
- reconnect: HTTP 403
- hard reload: private-room denial
- SSE UI: `Access revoked` within the bounded window
- observed revocation window: approximately 2.7 seconds
- a post-revocation owner message was not delivered to the open teammate
  client in the dedicated revocation qualification

This is within the required five-second limit. Previously rendered content
remained in local browser memory, as expected; no claim is made that a browser
can remotely erase already-rendered content. Repeating revoke was idempotent.

## Authorization and failure isolation

The following checks were denied as required:

- signed-out pilot chat: HTTP 401;
- synthetic unrelated authenticated user: HTTP 403;
- non-allowlisted submission: HTTP 503;
- teammate after revocation: HTTP 403 for reads, writes, read state, polling,
  SSE reconnect, and hard reload.

The disposable C.3 negative matrix also covered matching roster email,
admin-only, judge-only, different-submission, Submission-ID-only, and
Edit-token-only attempts. No synthetic account received administrator or judge
authorization, and no real admin or judge account was mutated for this pilot.

The allowlist gate keeps messaging failure scoped to Messages. Health, login,
`/start`, submission editing, My Projects, Account, administration, judging,
and public project routes remain independent of the chat tables and delivery
stream. A non-allowlisted chat request returned the bounded unavailable response
without affecting application health.

## Database and audit verification

Expected post-pilot counts are:

| Data | Count |
| --- | ---: |
| Better Auth users | 5 (2 existing + 3 synthetic) |
| submissions | 9 (8 existing + 1 synthetic) |
| submission owners | 1 synthetic |
| active owner memberships | 1 |
| active teammate memberships | 0 (three revoked history rows) |
| pilot chat rooms | 1 |
| pilot messages | 6 |
| pilot read states | 2 |
| pilot delivery events | 9 |
| pilot invitations | 3, all revoked after use |
| judges | 3, unchanged |
| assignments | 15, unchanged |
| scores | 12, unchanged |
| admin authorizations | 1, unchanged |
| judge authorizations | 1, unchanged |
| Viby identity links | 2, unchanged |

SQLite integrity and foreign-key checks passed after deployment. Audit records
show only expected synthetic claim, room, membership, invitation, message, and
revocation activity. An audit scan found no raw invitation or edit token.

The full unit suite remained green at **237/237** across 40 files. Test
isolation passed (`missingConfiguration: rejected`, one disposable audit row,
canonical database unchanged). The production build, TypeScript, changed-file
ESLint, migration reruns, `git diff --check`, and the existing C.1/C.3/Phase B
browser qualifications passed. WebKit remains unavailable solely because the
host lacks `libmanette-0.2.so.0` and `libhyphen.so.0`.

## Cleanup and rollback

The synthetic records are intentionally retained for operator choice. Option A
is to retain the clearly marked pilot, keep the allowlist limited to
`sub_QUPapzbr`, and leave the teammate revoked. Option B is to set the feature
flag false, revoke sessions/memberships, and remove only the exact synthetic
IDs after a fresh backup; broad email-domain or timestamp deletion is not
permitted. Temporary passwords, edit material, invitation material, and the
temporary credential directory were removed.

Rollback is ready: set `VIBE_NATIVE_TEAM_CHAT_ENABLED=false` (or restore the
previous immutable release) and restart only `vibe-hackathon.service`. Additive
chat and membership tables and audit history should remain; no Chatto or Viby
rollback is involved.

**Chatto was unchanged.**

**Viby was unchanged.**

GO — SYNTHETIC NATIVE CHAT PILOT DEPLOYED AND QUALIFIED
