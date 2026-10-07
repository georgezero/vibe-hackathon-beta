# Phase F.2 — Participant Messaging

Status: qualified in the isolated Kentucky Vibes participant environment. Production was intentionally not migrated or deployed.

## Architecture decision

F.2 keeps native submission/team chat unchanged and adds a separate direct-conversation domain. A direct conversation is an explicit, durable pair of users represented by `direct_conversations`, two `direct_conversation_members` rows, `direct_messages`, `direct_message_events`, and `direct_message_read_states`. Submission chat rooms are never reused for direct messages and no nullable submission identifier is introduced.

The two participant IDs are stored in canonical lexical order and the database has a unique pair index plus a distinct/order invariant. The domain creates both member rows in one transaction. Concurrent starts therefore converge on one conversation. F.2 does not support group conversations.

Conversation identity is durable across events. Initiation is platform-social:
the sender must be an authenticated active account, the recipient must have an
active account and an explicitly public + discoverable profile, and neither
side may have blocked the other. Current-event submission ownership or
membership is not required. Existing conversations remain readable and
sendable after a recipient removes directory discoverability; a private profile
simply falls back to the minimum existing-conversation identity.
Disabled/deactivated participants remain as neutral historical “Former
participant” identities and cannot send or receive new delivery.

## Messaging policy and safety

`participant_messaging_preferences` is retained as additive compatibility
storage for historical `participants` / `none` values. H.4R.1 no longer
consults it for initiation, delivery, or read access: a visible non-self
People record is messageable. A public/discoverable profile remains the
directory discovery boundary. Profile visibility, discoverability, team
membership, judging authorization, administrator authorization, Viby linking,
and chat access remain independent concerns; blocks are the communication
safety control.

`participant_blocks` is directional storage with symmetric communication effect. A block immediately denies sends in both directions and causes the direct SSE stream to close on its next authorization poll; it does not disclose the block to the other participant. Unblock restores the normal eligibility checks. `direct_message_reports` records only the reporter, conversation, bounded category/reason, status, and time. It does not ban, email, or copy message content into audit metadata; organizer review is a follow-up phase.

All mutations use the Better Auth application principal and same-origin mutation checks. The server derives the sender from the session; no API accepts a sender ID. Message bodies are plain text, normalized, and bounded to 4,000 characters. Client message IDs are validated and unique per conversation/sender for retry idempotency. Message bodies are never placed in URLs or audit metadata. Start, send, SSE, and report operations have bounded process-local rate limits.

## APIs

- `GET /api/direct-messages/conversations` — authenticated inbox projection.
- `POST /api/direct-messages/conversations` with `{handle}` — find or create the canonical pair.
- `GET /api/direct-messages/conversations/:id` — authorized, bounded message history.
- `POST /api/direct-messages/conversations/:id` — send a plain-text message.
- `POST /api/direct-messages/conversations/:id/read` — durable read cursor.
- `GET /api/direct-messages/conversations/:id/events` — SSE delivery with authorization re-checks and polling fallback in the client.
- `POST` / `DELETE /api/direct-messages/conversations/:id/block` — block/unblock the other member.
- `POST /api/direct-messages/conversations/:id/report` — bounded participant report.
- `GET` / `PATCH /api/account/messaging-preferences` — deprecated self-only
  compatibility endpoint; stored values have no messaging-authority effect.

Participant projections contain display name, initials, optional public handle/headline/affiliation, and neutral former-participant state. They never contain email, user/account IDs, roles, badges, Viby data, tokens, notes, scores, chat metadata, or private project data.

## UI

`/people/:handle` shows a `Message` action for every discoverable other profile
when the viewer is authenticated; the server remains authoritative for self,
block, and account-state safety. Active current-event submission
ownership/membership is not required for global People or Direct Messages. The
action opens `/messages/:conversationId`; self profiles keep the existing Edit
action.

## H.4R global social-access supersession

H.4R explicitly broadened the global social policy: an authenticated active
account may browse discoverable People, open eligible profiles, initiate a
permitted one-to-one DM, and use event-scoped Community without owning or
joining a submission in the current event. Profile discoverability,
self-message protection, blocks, and disabled-account handling remain
authoritative; the legacy messaging preference is ignored by H.4R.1. Project
workspaces and Team Chat remain submission-membership scoped. See
[`PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md`](PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md).

`/messages` is a participant inbox. The desktop layout uses a restrained two-column conversation ledger; `/messages/:conversationId` is a focused conversation view. At mobile widths the list and conversation are intentionally separate views rather than a squeezed desktop split pane. The header includes People and Messages for authenticated participants, with a bounded unread badge. Conversation headers reuse the safe participant identity model and offer View profile, Block/Unblock, and Report. Team Chat remains project-scoped and is not renamed or merged.

The Account/Profile editor no longer exposes an incoming-message preference. The
legacy `participant_messaging_preferences` table and compatibility endpoint may
retain historical values, but H.4R.1 ignores them for initiation and delivery;
blocks are the participant safety control. Existing profile
visibility/discoverability controls remain separate. No social feed, group DM,
attachments, edits, deletes, reactions, typing indicators, presence, or public
channels were added.

## H.4R.1 universal People messaging supersession

The H.4R.1 policy is intentionally simpler:

    visible in People + viewer is not the owner
        → Message is shown

People already applies the authoritative public, discoverable, active-profile
projection. It no longer performs a second per-card messaging eligibility
projection. A signed-in sender can start a durable DM with any other visible
person, including a recipient whose stored legacy `allowIncoming` value is
`none` and a recipient with zero active sessions. The DM authority still checks
sender/recipient account state, self-targeting, canonical pair uniqueness, and
either-direction blocks. Project membership is not required for global social
features; private workspaces and Team Chat remain project-authorized.

## Migration

`scripts/migrate-direct-messaging.ts` is an additive, explicit-path, mode-safe migration. It creates the nine direct-messaging/block/report/preference tables and indexes, enables foreign keys, checks them, and is idempotent. The package command is `npm run db:migrate:direct-messaging`; it requires `VIBE_F2_MIGRATION_CONFIRM` for the exact target path. It creates no conversations, messages, blocks, reports, or preferences automatically. Existing team-chat tables and rows are not changed.

## Kentucky Vibes qualification

The standing isolated environment is `https://kentucky-vibes-f0b.ggg.ad`, backed by `/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`. The fixture started with 21 synthetic direct conversations and 81 synthetic messages, a read/unread mix, one block, one report, an existing conversation with a disabled synthetic participant, and public/discoverability cases. Browser qualification added one synthetic conversation and six synthetic messages; the final writable database contains 22 conversations, 87 messages, one block, and one report. Two additional synthetic browser personas (`f2-browser-a`, `f2-browser-b`) were provisioned only in this isolated database and used for browser qualification.

The active database passed integrity and foreign-key checks after fixture creation. The preserved F.0B/Kentucky artifacts remain unchanged; the active writable database is disposable.

## Qualification results

- Focused migration/domain tests: 4 passed.
- Full repository suite: **279 tests passed across 53 files**.
- TypeScript: passed.
- Production build: passed and includes `/messages`, direct-message APIs, and profile Message action.
- Changed-file ESLint: passed with only the existing `Nav` image optimization warnings.
- Desktop browser: authenticated People → public profile → Message → conversation; sent a message; inbox row and unread state rendered; second synthetic session replied and the first session received the reply through SSE.
- Blocking: browser block removed the composer for the blocker and closed the other session’s send path within the bounded SSE poll window; unblock restored sending.
- Unauthorized access: a participant session received HTTP 403 for another pair’s conversation; report endpoint denied the same unauthorized access.
- Mobile Chromium at 390px: inbox and conversation had `scrollWidth === clientWidth === 390`, with usable back navigation, composer, and touch controls.
- Existing native Team Chat code and routes were not modified.

The browser exercise was agent-operated qualification, not an independent human usability study. Realtime revocation was observed within approximately one polling interval (about two seconds in the browser check); immediate HTTP authorization denial remains the authoritative guarantee.

## Performance and accessibility notes

Inbox and history queries are bounded. Conversation summaries batch participant identities, latest messages, read states, blocks, and preferences rather than loading every conversation’s history separately. Message history is limited to 50 rows. SSE polls once per second for a bounded 25-second stream and the client falls back to five-second history polling after a stream error. At the Kentucky Vibes fixture scale this produced no visible N+1 behavior.

The composer has a real label, visible focus, plain-text length feedback, keyboard submission, and accessible block/report controls. Unread state is textual as well as color-coded. Mobile targets use the existing button system and no horizontal overflow was observed.

## Pre-F.2B production disposition

Before the approved F.2B rollout, F.2 remained isolated. The production PID,
release, database checksum, business data, Chatto, and Viby were intentionally
left unchanged while the F.2A review completed.

## F.2B deployment

F.0–F.2 are now deployed through the additive, verified procedure documented
in `PHASE_F2B_PRODUCTION_DEPLOYMENT.md`. Production begins empty and private:
no profile shells, handles, discoverability opt-ins, conversations, messages,
blocks, or reports were generated by migration. The Kentucky Vibes fixture
remains the populated messaging demo.
