# Chatto Source Architecture Review

Phase C.2A source review for the existing Chatto deployment and a possible
Vibe Hackathon messaging integration. This is a read-only architecture audit;
it is not an integration, migration, configuration change, or deployment.

## Executive decision

Chatto is a credible messaging engine for the first use case (one private
room per claimed submission), and building equivalent realtime, membership,
timeline, unread, thread, reaction, and moderation behavior in Vibe would be a
larger and less reversible project. The source does **not** currently expose a
least-privilege external provisioning and session-handoff contract that Vibe
can safely use as an application integration.

Primary recommendation: **CONDITIONAL** — proceed to a narrowly scoped C.2B
integration spike only after Chatto’s supported OAuth/identity configuration,
scoped provisioning path, and membership-revocation behavior are proven in a
disposable environment. Use standalone Chatto first; do not fork it and do not
build a native frontend until the API/realtime contract is pinned and tested.

Fallback: if Chatto cannot provide a scoped provisioning/session contract
without operator-equivalent access, build a small Vibe-native text-room
system instead of exposing a privileged adapter.

## 0. Baseline and review boundary

| Item | Observed value |
|---|---|
| Host | `paui` |
| Chatto checkout | `/home/george/Downloads/src/ai/agentpacs/chatto` |
| Chatto branch | `main` |
| Chatto HEAD | `a4e2e9f91285632af180df8d4d2c7e1280593c41` |
| Chatto describe | `v0.4.8-242-ga4e2e9f9` |
| Chatto remote | `git@github.com:chattocorp/chatto.git` |
| Chatto worktree | clean at review start |
| Deployed Chatto relationship | deployed source was `70fe404126f39a541d47bdebb0c346c9d27cfa77`, a descendant of tag `v0.4.12` (`f26158d2…`); the review checkout is a newer descendant |
| Vibe checkout | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon` |
| Vibe branch | `phase-vh-m6-viby-better-auth-session` |
| Vibe HEAD | `a70edc28326108dfc84a69af303f680ceaa7f735` |

The checkout is close enough for a trustworthy architectural review: it
contains the deployed 0.4.12 source lineage and later additive changes. It is
not the exact deployed tree, so every production spike must pin the deployed
Chatto image/version and rerun contract tests against that version. Both
repositories remained read-only. No services, databases, containers,
configuration, or deployments were changed.

The Vibe worktree had unrelated pre-existing modifications/untracked files;
none were staged or changed by this review.

## 1. Architecture map

```text
HTTP/ConnectRPC (/api/connect)       WebSocket (/api/realtime)
          |                                    |
          v                                    v
   connectapi.API handlers          realtime.go + protobuf hello
          |                                    |
          +------------ operation auth -------+
                       |
                 ChattoCore
                       |
       NATS JetStream EVT event log / OCC
                       |
       read models and projections (room, timeline,
       directory, read state, threads, presence, assets)
                       |
             embedded/standalone runtime units
             (search, exporter, LiveKit/calls)
```

The major source boundaries are:

| Concern | Source evidence and coupling |
|---|---|
| Core/server | `cli/internal/core/core.go`, `core_infrastructure.go`, `storage.go`, `core_services.go`; `ChattoCore` owns services, storage, event publication, and projections. |
| Event storage | `cli/internal/evtstream/publisher.go`, `subjects.go`; durable NATS JetStream `EVT` stream, optimistic concurrency and projection readiness. |
| Runtime units | `cli/internal/runtimeunit/runtimeunit.go`, `cli/cmd/run.go`; ADR-041 defines embedded/standalone units and service contracts. |
| Messages/timeline | `message_model.go`, `messages.go`, `room_timeline_read_model.go`, `room_events.go`; message operations write events and timeline projections. |
| Rooms/membership | `room_model.go`, `rooms.go`, `room_membership.go`, `operation_auth.go`; membership and room visibility are server-authorized. |
| Unread/read state | `read_state_model.go`, `read_state_index.go`, `room_unread.go`. |
| Threads/reactions | `thread_follow_model.go`, `threads.go`, message/reaction operations in `cli/internal/core`. |
| Presence | `presence_model.go`, `presence_hub.go`; presence is an in-memory/cache concern, separate from durable room authorization. |
| Voice/LiveKit | `call_model.go`, `voice.go`, runtime startup/reconciliation in `cli/cmd/run.go`; optional to text-room operation but must be fault-tested. |
| Assets/uploads | `asset_model.go`, `asset_projection.go`, `attachments.go`; public API has upload/asset services and attachment authorization. |
| Realtime | `cli/internal/http_server/realtime.go`, `my_events_model.go`; binary protobuf protocol, event filtering, session termination. |
| Frontend | `apps/frontend`, SvelteKit/Svelte, generated Connect clients and a server registry in browser storage. |
| Admin/operator | `chatto.admin.v1` is authenticated method-RBAC; `chatto.operator.v1` is a root-equivalent Unix-socket boundary. |

## 2. Authentication and external identity

### Supported paths found in source

`cli/internal/config/auth.go` defines configured provider types `oidc`,
`github`, `gitlab`, `google`, and `discord`. `cli/internal/http_server/oidc.go`
implements provider start/callback routes at `/auth/providers/:providerID`
and `/auth/providers/:providerID/callback` (with legacy OIDC aliases). The
provider callback matches an external identity by issuer/provider namespace and
subject, not by email.

For an unlinked provider identity, `external_identities.go` creates a pending
flow in `RUNTIME_STATE` and redirects to an explicit confirmation page. With
`AuthProviderConfig.AutoProvision=true`, `CreateUserForExternalIdentity` can
create a passwordless Chatto account after confirmation. `auto_provision` is
false by default. The public protocol is
`proto/chatto/auth/v1/external_identity_auth.proto`, whose capability-token
RPCs include `GetPendingExternalIdentity`, `CreateExternalIdentityAccount`,
`ConfirmExternalIdentityLink`, and `CancelExternalIdentityFlow`.

Chatto also implements an OAuth 2.0 authorization-code flow for cross-origin
clients in `cli/internal/http_server/oauth.go` and
`cli/internal/core/auth_codes.go`:

- `/oauth/authorize` requires `response_type=code`, configured redirect URI,
  PKCE `S256`, and state;
- `/oauth/token` exchanges the short-lived single-use code for an opaque
  bearer token;
- authorization codes expire after five minutes and are deleted atomically
  before validation;
- redirect origins are allowlisted by Chatto configuration;
- bearer/cookie sessions have server-side auth generations and logout/revocation
  events.

This is a real supported handoff path, not a generic OAuth assumption. Vibe
could be configured as an OAuth/OIDC client/provider only if Chatto is
configured with the matching provider and redirect origin. Better Auth cookies
must not be shared with Chatto. Chatto sessions are separate cookie or bearer
credentials.

### Answers for Vibe

**Can a Better Auth-authenticated user enter Chatto without a Chatto password?**
Yes, conditionally: use a configured OIDC provider or the Chatto OAuth
authorization-code + PKCE flow. The source supports passwordless external
identity accounts and explicit consent. The current deployed discovery result
did not advertise a configured provider, so this is not presently a production
handoff contract.

**Does this create a Vibe-controlled, deterministic Chatto identity?** Not by
itself. Chatto owns the external-identity subject namespace and creates its own
user during the pending flow. Vibe must maintain an explicit mapping after a
successful handoff; email matching is not valid.

**Are fresh verification, replay, state, and revocation protected?** Yes for
the Chatto OAuth path: PKCE/state, five-minute single-use codes, server-side
auth generation, and session-termination publication are implemented. Vibe
must still qualify logout, account switching, and cross-origin behavior against
the exact deployed version.

## 3. Provisioning and least privilege

The prior provisioning concern is confirmed.

### Operator path

`docs/fdr/FDR-028-operator-api-and-cli.md`,
`proto/chatto/operator/v1/users.proto`, and
`cli/internal/connectapi/operator_user_management.go` show that user creation,
deletion, password changes, and role operations are exposed through
`chatto.operator.v1` on a Unix socket (default `/tmp/chatto/operator.sock`,
mode 0600). The socket is local/root-equivalent; the public listener does not
serve it. The implementation calls `AdminCreateUserAs` and related operations
as `core.SystemActorID`. This is not a scoped external service account.

### Admin path

`proto/chatto/admin/v1/members.proto` and the `chatto.admin.v1` handlers expose
user/member administration to an already-authenticated Chatto administrator
with method-level RBAC. This is not a server-to-server least-privilege
provisioning API for Vibe.

### External identity auto-provision

OIDC/external identity auto-provisioning is the least-privileged supported
user-creation route because Chatto performs the creation inside its own
provider flow and requires explicit confirmation. It is suitable for just-in-
time Chatto accounts, but does not atomically create a Vibe submission room or
give Vibe a deterministic Chatto user identifier before the flow completes.

### Service account and adapter answer

No service-account mechanism was found that can be restricted to exactly
`get/create user`, `get/create private room`, membership changes, and short-
lived handoff. Trusted NATS namespaces (`svc.chatto.>` and
`svc.chatto_ext.>`) in ADR-053 are internal server/provider contracts and
require trusted NATS permissions. A narrow adapter without modifying Chatto
would therefore need either the operator socket or trusted internal NATS;
neither is least privilege for an external Vibe application.

**Provisioning gate:** before C.2B, Chatto needs either (a) a documented scoped
service API/service account, or (b) a deliberately isolated adapter with
operator-equivalent access, compensating controls, and explicit operator
approval. The recommended path is to ask for a supported scoped API rather
than silently build against the operator socket.

## 4. Rooms and membership

`proto/chatto/api/v1/rooms.proto` defines `RoomService` methods for
`CreateRoom`, `ArchiveRoom`, `JoinRoom`, `LeaveRoom`, `ListMembers`,
`AddMember`, `RemoveMember`, bans, timeline reads, and room events.
`cli/internal/connectapi/rooms.go` invokes these through `requireCaller` and
`core.RoomCommands()`.

`cli/internal/core/rooms.go` creates a new random room ID and enforces
case-insensitive room-name uniqueness with JetStream OCC. There is no
caller-supplied external room ID, metadata field, or idempotency key. Vibe
would need a durable `submission_id -> external_room_id` mapping and a
reconciliation job. Repeating `CreateRoom` is not source-proven idempotent.

`room_membership.go` makes `JoinRoom` idempotent and `RemoveMember` returns an
idempotent “not present” result. Membership mutation uses OCC, appends audit
events, and waits for projection progress. A private non-universal channel
with restricted join permissions can represent one team room per claimed
submission.

Directory visibility (`RoomDirectoryReadModel`) and timeline reads
(`RoomTimelineReadModel.GetRoomEvents`) require current membership. Message
operations also require room membership and the relevant permission. Thus the
source supports:

- private room creation;
- explicit add/remove membership;
- history/post authorization by membership;
- durable external mapping in Vibe.

The source does **not** provide a Vibe-level idempotency key or a transactional
room-plus-membership operation. Use an outbox/reconciliation ledger, retry only
after reading the mapping, and never treat a room name as the authoritative
identifier.

## 5. Realtime and revocation

`cli/internal/http_server/realtime.go` authenticates cookie or bearer sessions
before WebSocket upgrade, then expects binary protobuf hello/subscribe frames.
`my_events_model.go` implements `StreamMyEvents`: room events are filtered by a
membership cache and the stream closes on `SessionTerminatedEvent`.

When a `UserLeftRoom`, `RoomMemberRemoved`, or `RoomMemberBanned` event reaches
the stream, the cached room is removed and subsequent room events are filtered.
Direct timeline reads and message writes still re-check membership. This is a
strong source-level boundary for future reads/posts, but it is not proof of an
instant socket close or disappearance of already-rendered client data. It
depends on event publication, projection/stream processing, and client cache
handling. Presence behavior is separate and uses in-memory/cache structures.

**Judgment:** Chatto likely enforces eventual loss of history, posting, and
future realtime events after removal, but source inspection cannot certify the
product requirement “immediate loss” for an already-open browser. C.2B must
run an explicit live test: keep a member connected, remove membership from a
second actor, attempt history read, post, subscribe/reconnect, and inspect
whether events/presence stop within the agreed bound. Test session revocation
separately; logout publishes `SessionTerminatedEvent` and should close the
stream.

## 6. Public API and SDK surface

| Surface | Classification | Evidence |
|---|---|---|
| ConnectRPC `chatto.api.v1` | Public integration surface, pre-1.0 | `proto/chatto/api/v1/*.proto`, generated clients in `packages/api-types/src/chatto`, mounted by `connectapi.API.Handlers()`. |
| `chatto.auth.v1` | Public capability-token bootstrap/identity surface | `proto/chatto/auth/v1/external_identity_auth.proto`. |
| `chatto.discovery.v1` | Public pre-auth discovery | `ServerDiscoveryService`; current deployed discovery advertised OAuth authorize but no configured external provider. |
| `/oauth/authorize`, `/oauth/token` | Public HTTP OAuth protocol | `cli/internal/http_server/oauth.go`, `cli/internal/core/auth_codes.go`; PKCE and single-use codes. |
| `/api/realtime` | Public authenticated binary protobuf WebSocket | `cli/internal/http_server/realtime.go`; protocol package `chatto.realtime.v1`. |
| Generated TypeScript clients | Usable but generated/version-coupled | `packages/api-types/src/chatto/*_connect.ts`; update with pinned Chatto version and contract tests. |
| `chatto.admin.v1` | Public to authenticated Chatto admins; not an external provisioning API | method-RBAC in admin handlers. |
| `chatto.operator.v1` | Internal/root-only | Unix socket, root-equivalent; not for Vibe SaaS traffic. |
| NATS `svc.chatto_ext.>` | Internal trusted extension contract | ADR-053; not a public remote API. |
| CLI/backup/restore | Operator tooling | `cli/cmd`; not an integration SDK. |

ADR-045 explicitly classifies the v1 API as integration-oriented but
pre-1.0: additive evolution is preferred, while breaking changes remain
possible with release guidance and Buf breaking checks. A native Vibe client
would need a pinned version, generated client updates, protocol contract tests,
and a compatibility plan.

No public OpenAPI/REST resource model, generic webhook, or supported external
application-message event hook was found. The public contract is ConnectRPC
plus the versioned realtime protocol.

## 7. Frontend reuse and embedding

Chatto’s frontend is SvelteKit/Svelte (`apps/frontend`), not React. It is a
complete application with routes, server registry, auth state, and generated
API clients. `apps/frontend/src/lib/api-client/connect.ts` creates clients and
bearer headers; `apps/frontend/src/lib/state/server/registry.svelte.ts` stores
multi-server URL/token/user state in browser `localStorage` under `instances`.
`vite.config.ts` and `svelte.config.js` build a full static SPA; there is no
component-package or mount boundary intended for another host application.

The backend embeds that SPA in `cli/internal/http_server/frontend.go`. It sets
`X-Frame-Options: DENY`, a `frame-ancestors 'none'` CSP report-only policy, and
`no-store` HTML. `apps/frontend/nginx.conf` mirrors the restrictive headers.
Chatto assumes ownership of routing, session state, and server selection.

Answers:

1. React component reuse: no; the frontend is Svelte and is not exported as a
   reusable component library.
2. Light branding: possible only by maintaining the Chatto frontend/build;
   no obvious theme/plugin mount was found, so this is a source-maintenance
   commitment rather than a configuration-only extension.
3. Native Vibe UI: technically possible over ConnectRPC/generated clients and
   realtime protobuf, but couples Vibe to a pre-1.0 API and protocol.
4. API coupling: material; pin versions and write contract tests before doing
   it.
5. Safest first step: link to standalone Chatto, with a documented supported
   login handoff. Do not iframe the current frontend.

## 8. Extension points

Chatto has no general plugin registry, frontend mount API, webhook framework,
custom auth adapter interface, or public provisioning adapter in the inspected
source. Its deliberate extension point is the trusted runtime-unit/NATS
architecture in ADR-041 and ADR-053: replaceable search/exporter/provider units
communicate via versioned protobuf request/reply subjects and NATS permissions.
That boundary is server-side and trusted, not a safe external Vibe integration
surface.

Auth providers are configuration records consumed by `oidc.go`, not arbitrary
application callbacks. `authling/` is a separate experimental identity
runtime and its README does not provide OIDC or a public Chatto plugin API.

The source is best understood as a complete standalone application with
service boundaries, not as an embeddable messaging framework. A fork should be
avoided unless a required capability is accepted upstream and the resulting
maintenance/licensing cost is explicitly approved.

## 9. Activity and system messages

`proto/chatto/api/v1/messages.proto` and the message service require a real
caller, room membership, and `message.post` permission. Message creation uses
an actor ID and encrypts the body with the author identity. There is no public
system-message type, external correlation/idempotency key, or webhook for
Vibe-generated activity.

`SystemActorID` is used internally for bootstrap/maintenance, not as a safe
remote posting identity. If activity messages are needed later, provision a
dedicated Chatto service user through an approved supported mechanism, add it
explicitly to rooms, and keep an idempotency/correlation ledger in Vibe. Do not
publish directly to Chatto’s internal `EVT` subjects.

## 10. Moderation, privacy, and retention

Public/admin APIs enforce roles and membership; FDR-021 describes the admin
dashboard as metadata-oriented rather than a general private-message reader.
Message bodies are encrypted through the per-user/content-key design in
`docs/adr/ADR-007-per-user-encryption-with-crypto-shredding.md` and FDR-008.
Retraction keeps an audit/event record while hiding/tombstoning the body (see
the message retraction implementation and FDR message lifecycle docs).

This is not equivalent to “operators can never read messages.” Chatto backup
(`cli/cmd/backup.go`) includes NATS data, KV/streams, bodies, reactions, and
assets; encryption keys are excluded by default but can be included with
`--include-keys`. Key custody, operator access, restore access, retention, and
legal disclosure therefore remain Vibe product/privacy decisions.

For the team-room pilot:

- organizers should be explicit room members, not globally privileged readers;
- judges must not be added by default;
- private rooms should be separate from public/universal rooms;
- Vibe should warn users not to paste submission edit tokens, API keys, private
  repository links, or patient information;
- moderation, deletion, export, retention, and operator-read access need a
  published policy before real participant data is allowed.

## 11. Operations and failure isolation

Health endpoints are explicit in `cli/internal/http_server/health.go`:

- `GET /healthz` is liveness and returns `{"status":"ok"}`;
- `GET /readyz` checks NATS connectivity and `core.Ready`, returning 503 when
  the service cannot serve traffic.

Metrics are configured separately in `metrics.go`. Backup/restore is provided
by `cli/cmd/backup.go` and `chatto restore`; restore requires external NATS to
be stopped and encryption keys are a separate custody decision. Pin the exact
image/source version and retain an isolated restore test.

LiveKit/call reconciliation is an optional runtime concern in `run.go`,
`call_model.go`, and `voice.go`. The design should allow text rooms to remain
healthy when calls fail, but this must be fault-tested on the deployed image;
do not infer complete isolation from source alone.

Recommended Vibe probe: poll Chatto `/readyz` separately from Vibe `/api/health`,
with a short timeout and circuit breaker. If Chatto is unavailable, Vibe must
continue submission editing, account login, judging, administration, and
public project browsing; only messaging entry/actions should degrade with a
retryable status.

## 12. Licensing

The root `LICENSE` is AGPL-3.0-or-later. `REUSE.toml` applies Apache-2.0
exceptions to `apps/frontend/**`, `apps/docs-website/**`,
`packages/api-types/**`, and selected packages/docs; the CLI/server remains
AGPL by default. Package manifests and `LICENSING.md` are the authoritative
notice sources.

A proprietary Vibe frontend that consumes a public Chatto API may be separate,
but dependency notices, generated API types, authentication flow, and any
network-use obligations require legal review. Modifying/distributing the
AGPL server, maintaining a fork, or shipping a branded modified frontend may
trigger corresponding-source, notices, and license-compliance obligations.
This is not legal advice; obtain review before a fork, server modification, or
commercial distribution.

## 13. Build-versus-Chatto comparison

| Option | Engineering/security | UX/operations | Reversibility and fit |
|---|---|---|---|
| A. Native minimal chat | Small initial surface, but Vibe owns realtime, unread, membership revocation, moderation, encryption, backups, and mobile behavior. | Highest long-term operational/security burden despite low feature count. | Most control; poor fit if threads/reactions/realtime are needed soon. |
| B. Standalone Chatto | Lowest integration code; mature room/timeline/realtime surface. | Separate navigation and identity handoff; current provisioning gate remains. | Most reversible first pilot; good fit for one private room per submission. |
| C. Standalone + SSO/provisioning adapter | Preserves Chatto UX while reducing password duplication. | Safe only with scoped provisioning; otherwise adapter becomes operator-equivalent. | Recommended target after gate; reversible if mapping tables/outbox are Vibe-owned. |
| D. Native Vibe UI over Chatto APIs | Consistent UX and navigation; no iframe. | Vibe couples to pre-1.0 ConnectRPC and realtime protocol, plus auth/session details. | Viable later after pinned API contract; not the smallest first step. |
| E. Fork Chatto | Maximum control. | Permanent merge, security, licensing, and upgrade burden. | Least reversible; not justified by current use case. |

Given C.1’s current explicit owner claiming but no explicit teammate account
membership, the first pilot should be one claimed owner, one disposable room,
one Chatto identity, and membership removal tests. Multi-user team rooms need a
small Vibe membership phase before production.

## 14. Recommended next phase and exact gates

Proceed to **C.2B integration spike** only after these gates are closed in a
disposable environment:

1. Configure and verify a Chatto-supported OIDC/OAuth handoff without sharing
   Better Auth cookies or exposing Chatto passwords.
2. Decide whether Chatto external-identity auto-provision is acceptable, or
   obtain a documented scoped provisioning/service-account API. Do not use the
   root-equivalent operator socket as an unreviewed adapter.
3. Create a Vibe-owned mapping for Better Auth user ↔ Chatto user and
   submission ↔ Chatto room; make provisioning idempotent through an outbox or
   reconciliation ledger.
4. Qualify room privacy, history reads, posting, WebSocket delivery, reconnect,
   membership removal, logout/session revocation, and disabled-user behavior on
   the exact deployed Chatto version.
5. Complete the single-owner pilot before designing teammate memberships,
   organizers’ support access, judge rooms, DMs, attachments, or system bots.
6. Define privacy/moderation/retention/key-custody policy and obtain licensing
   review before real participant messages.

### Open questions that source cannot settle

- Does the deployed 0.4.12 configuration expose a usable external provider and
  OAuth redirect origin for Vibe?
- Can the operator approve a scoped provisioning path without root-equivalent
  access, or will Chatto need an upstream API addition?
- Does membership removal stop an already-open realtime client within the
  required product SLA?
- Can text remain healthy while LiveKit is unavailable on the exact deployment?
- What operator/key-custody and retention policy is acceptable for private team
  messages?

## Final recommendation

Use Chatto rather than immediately building basic native chat, but keep the
decision conditional. The messaging engine is substantially more complete than
a small bespoke implementation, while the source review confirms that identity
handoff/provisioning and hard revocation are the integration risks—not room or
message functionality. The smallest reversible next step is a disposable C.2B
standalone-link spike with an explicitly supported OIDC/OAuth path and a
Vibe-owned mapping/reconciliation layer. Do not fork Chatto and do not connect
production data until the gates above pass.

**CONDITIONAL GO — scoped provisioning/session handoff and live revocation remain unresolved gates**
