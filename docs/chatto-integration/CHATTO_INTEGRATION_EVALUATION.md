# Vibe Hackathon × Chatto Integration Evaluation

## Executive decision

**CONDITIONAL GO — Chatto is a viable external messaging engine for a
reversible C.2B integration spike, after the identity handoff, user
provisioning, membership/revocation, retention, and isolated backup gates are
qualified.**

This is a read-only evaluation. No Chatto configuration, process, database, or
production data was changed. Vibe Hackathon was not modified or deployed. No
real participant account, submission secret, edit token, API key, or private
project data was used.

## Scope and authority

Vibe Hackathon remains authoritative for:

- Better Auth identity and application sessions;
- submission ownership and team membership;
- administrator and judge authorization;
- event scope and room eligibility.

Chatto would provide messaging, room storage, realtime delivery, and room-level
membership enforcement after Vibe provisions an exact membership.

Chatto must never decide whether a person is an owner, teammate,
administrator, judge, or eligible for an event.

## Vibe Hackathon baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- HEAD: `17c8bd0b3edf208511c733474f8f4724d2465f6b`
- Deployed release: `0ec33b1ae6cf862112987198a91ff19abbfa662b`
- Local and public health: HTTP 200
- Better Auth is the canonical interactive application session.
- Viby remains the identity provider and was unchanged.

C.1 provides guest draft creation, secure Submission ID + private Edit token
resume, optional explicit ownership claiming, and My Projects. It does not
yet provide explicit Better Auth teammate membership, invited/pending teammate
state, active/revoked membership history, or teammate roles.

Therefore a single claimed-owner pilot is possible. Multi-user team rooms
require a small explicit membership phase first. Roster names and emails are
metadata, not authorization.

## Chatto deployment baseline

Inspection was performed read-only on host `horo`.

| Item | Finding |
| --- | --- |
| Public URL | `https://chatto.elvie.ad/chat/-/overview` |
| Version | Chatto `0.4.12` |
| Image digest | `sha256:ddb1c5079c9fb2544f582c59a8d85b3bf754c24d3f1f19e15bec0647db377bd` |
| Source commit | `70fe404126f39a541d47bdebb0c346c9d27cfa77` |
| Repository | `/home/george/Downloads/src/ai/agentpacs/chatto` |
| Deployment | Docker Compose project `dockercompose` |
| Container | `dockercompose-chatto-1` |
| Listener | `0.0.0.0:4000` |
| Storage | External NATS JetStream volume; no Chatto container data mount |
| Public transport | Cloudflare Tunnel; no tunnel configuration was changed |
| License | `AGPL-3.0-or-later` |

The stack includes Chatto, NATS, and LiveKit. Chatto’s public root returns HTTP
200. `/health` currently returns the SPA shell rather than a machine-readable
health response; `/api/health` is unavailable. A monitored health probe must be
defined before production integration.

The live discovery call reports Chatto `0.4.12` and `/oauth/authorize`, but no
external login provider. Direct registration is disabled. Secrets and private
configuration values were not printed or retained.

The logs show repeated LiveKit TLS handshake failures. Text messaging may be
independent, but calls/voice are not suitable for the pilot.

## Product fit

Confirmed from Chatto APIs and source/protocol definitions:

- private rooms;
- explicit add/remove membership;
- text messages and room timelines;
- unread/read state;
- threads;
- reactions;
- presence and realtime WebSockets;
- moderation, bans, roles, and event logging;
- asset uploads and attachments (deferred from pilot);
- encrypted backup/restore tooling.

Not yet live-qualified with disposable accounts:

- private-room discovery isolation;
- immediate access loss after removal;
- WebSocket revocation behavior;
- mobile/responsive usability;
- account switching and coordinated logout;
- backup restore into an isolated copy;
- message and asset retention behavior.

## Recommended identity and session architecture

```text
Better Auth user
  ↓
Vibe application principal
  ↓
explicit submission membership
  ↓
server-side Chatto provisioning
  ↓
exact Chatto user and private-room membership
  ↓
Chatto messaging session
```

Vibe should add a durable mapping similar to:

```text
chat_identities
  user_id
  provider = chatto
  external_user_id
  status = active | revoked
  provisioned_at
  revoked_at
  created_at / updated_at
```

Use unique `(provider, user_id)` and `(provider, external_user_id)` constraints.
Provision by Better Auth user ID only. Never match by email, display name,
roster overlap, judge identity, or edit token.

Chatto documents:

1. external providers including OIDC, GitHub, GitLab, Google, and Discord;
2. OAuth authorization code + PKCE for cross-origin clients;
3. short-lived authorization codes exchanged for opaque delegated bearer tokens;
4. cookie and bearer sessions with revocation.

The preferred future handoff is configured OAuth/OIDC or an equivalent supported
external-identity flow. Do not share Better Auth cookies, broaden cookie
domains, or let Chatto read Vibe cookies. Do not use Chatto passwords as a
production bridge.

The current public Chatto API does not expose a clearly scoped provisioning
endpoint. Operator user creation is through a local Unix socket and is
root-equivalent. Admin user APIs are capability/RBAC protected. Before C.2B,
obtain a supported service-account/provisioning API or create a narrowly
isolated Chatto-side adapter. Never expose the operator socket through Vibe.

## Recommended room model

```text
claimed Vibe submission
  ↓
chat_rooms(
  submission_id,
  provider,
  external_room_id,
  status,
  created_at,
  archived_at
)
  ↓
one private Chatto room (universal=false)
```

Room creation must be idempotent and server-owned. Eligible pilot members:

- the explicit claimed submission owner;
- later, explicitly claimed teammates;
- optionally, explicitly assigned organizer support.

Do not grant access to judges, unrelated administrators, unclaimed roster
entries, or users whose email happens to match submission metadata.

For multi-user rooms, add a Vibe-owned membership model with explicit
`owner`, `teammate`, and `support` roles and `active`/`revoked` status. Chatto
membership is a projection of that state.

Required revocation tests:

- non-members cannot discover or read the room;
- removal blocks new reads and realtime events;
- an existing browser/session cannot retain access;
- retries cannot create duplicate members;
- archived submissions stop writes without deleting history;
- Chatto failure does not affect submissions, login, judging, or administration.

## Security and privacy

Never paste the following into Chatto:

- submission Edit tokens;
- API keys or bearer credentials;
- private repository credentials or links where sensitive;
- patient or other regulated information.

Before a pilot, define controls for:

- OAuth state and PKCE, exact origin allowlists, and CSRF;
- Chatto WebSocket bearer/session authorization;
- room enumeration and private-room discovery;
- immediate membership revocation;
- disabled-user propagation;
- moderation and administrator visibility;
- message deletion and audit history;
- XSS/link sanitization;
- attachment malware/privacy handling;
- message and asset retention;
- log/token redaction;
- backup encryption and key custody.

Chatto currently sends `X-Frame-Options: DENY` and CSP `frame-ancestors
'none'`; iframe embedding is not an acceptable shortcut. Chatto should be
opened standalone for the first spike.

## Native versus standalone UX

### A. Standalone Chatto — recommended for C.2B

Smallest reversible implementation, lowest frontend and upgrade burden, and no
iframe/CSP problem. The authentication handoff and return link need careful UX.

### B. Branded Chatto frontend

Improves visual continuity but creates customization/fork and AGPL upgrade
burden.

### C. Native Vibe UI over Chatto APIs

Best visual consistency, but highest effort across realtime, accessibility,
failure states, mobile behavior, and long-term API compatibility. Defer until a
standalone pilot proves the need.

## First pilot proposal (C.2B)

Use only disposable data:

1. one disposable Better Auth test user;
2. one disposable claimed test submission;
3. one Chatto test user mapping;
4. one private Chatto room;
5. server-side room provisioning and exact membership grant;
6. text post/read and unread/read state;
7. membership removal;
8. proof that room history and realtime access disappear after revocation;
9. idempotent retry and logout tests;
10. isolated cleanup.

Exclude DMs, public channels, judge rooms, calls, attachments, bots, AI
agents, notifications, and real participant content.

Pilot gates:

- Chatto operator approves isolated test workspace and cleanup;
- OAuth/OIDC or scoped session handoff is configured;
- scoped provisioning method is available;
- Vibe `chat_identities` and `chat_rooms` mappings are additive and audited;
- explicit membership exists before adding anyone beyond the owner;
- encrypted backup and isolated restore are rehearsed;
- room and revocation tests pass;
- Chatto outage is proven not to break Vibe core workflows.

## Operations and rollback

Chatto state is in NATS JetStream. The documented backup command can archive
instance KV, event streams, room data, messages, reactions, assets, and bodies.
Encryption keys are excluded by default; including them creates sensitive
decryptable material. Restore requires Chatto to be stopped when external NATS
is used and should be rehearsed in an isolated copy.

Before any integration deployment:

- pin the image digest rather than `latest`;
- record Chatto and NATS versions;
- take an encrypted backup;
- rehearse restore and rollback;
- monitor NATS storage, JetStream lag, CPU/memory, logs, tunnel health, and API
  latency;
- use a bounded “messaging unavailable” state in Vibe.

If Chatto fails, submissions, account login, judging, administrator access,
and project browsing must remain functional. Do not couple Chatto mutations to a
Vibe database transaction.

## Exact blockers and open decisions

1. Configure and approve the Chatto OAuth/OIDC/session handoff.
2. Provide a scoped Chatto user-provisioning mechanism that is not the
   root-equivalent operator socket.
3. Decide owner-only pilot versus an explicit teammate-membership phase.
4. Verify `RemoveMember` invalidates existing sessions, history reads, and
   WebSocket subscriptions.
5. Document retention/deletion/legal-hold behavior.
6. Define organizer moderation/support visibility.
7. Define a machine-readable Chatto health probe and alert ownership.
8. Complete AGPL integration/distribution review.

## Explicit non-changes

- Chatto was not modified or restarted.
- Viby was not modified or restarted.
- Vibe Hackathon production behavior and database were not changed.
- No production users, submissions, rooms, secrets, or participant data were
  connected.

## Final recommendation

**CONDITIONAL GO — proceed to C.2B only after the identity handoff,
provisioning, membership/revocation, retention, licensing, and isolated backup
gates are explicitly approved and qualified.**
