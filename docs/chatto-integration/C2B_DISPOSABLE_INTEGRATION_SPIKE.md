# Phase C.2B — Disposable Chatto SSO, Provisioning, and Revocation Spike

**Disposition: NO-GO — the mandatory SSO/provisioning gates cannot be
qualified safely against the deployed Chatto instance.**

This report records the bounded spike attempt. It is intentionally a fail-closed
result, not a partial production integration. No Vibe code, Vibe database,
Chatto configuration, Chatto database, container, deployment, Viby system, or
production participant data was changed.

## 1. Baselines

### Vibe Hackathon

| Item | Result |
|---|---|
| Host | `paui` |
| Repository | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon` |
| Branch | `phase-vh-m6-viby-better-auth-session` |
| HEAD | `a70edc28326108dfc84a69af303f680ceaa7f735` |
| Local health | `GET http://localhost:3000/api/health` returned HTTP 200, database `ok`, active event `evt_vibe_2025` |
| Deployed/source release reference | Prior C.2A evaluation records deployed application `0ec33b1ae6cf862112987198a91ff19abbfa662b`; this spike made no application deployment |
| Worktree | Pre-existing unrelated modifications/untracked files were preserved; no application files were changed |

### Chatto

| Item | Result |
|---|---|
| Host | `horo` |
| Repository checkout | `/home/george/Downloads/src/ai/agentpacs/chatto` |
| Branch / HEAD | `main` / `a4e2e9f91285632af180df8d4d2c7e1280593c41` |
| Deployed image | `ghcr.io/chattocorp/chatto:latest` with OCI version `0.4.12` |
| Deployed image digest | `sha256:ddb1c5079c9fb2544f582c59a8d85b3bf754c24d3f1f19e15bec0647db377bd` |
| Deployed source relationship | Prior evaluation identified source `70fe404126f39a541d47bdebb0c346c9d27cfa77`, a descendant of `v0.4.12`; review checkout is newer and was not used as a deployment target |
| Chatto container | `dockercompose-chatto-1`, running, restart count 0 |
| NATS | `dockercompose-nats-1`, running/healthy, restart count 0 |
| LiveKit | `dockercompose-livekit-1`, running/healthy, restart count 0 |
| Listener | `0.0.0.0:4000`; public URL `https://chatto.elvie.ad/chat/-/overview` |
| Health | `/healthz` returned `{"status":"ok"}`; `/readyz` returned `{"status":"ready"}` |
| Operator socket | Inside Chatto container: `/tmp/chatto/operator.sock`, mode `0600`, owner `chatto:chatto` |

All baseline inspection was read-only. The deployed source/image was close
enough to the reviewed lineage to make the configuration conclusion
trustworthy. No real account, submission, token, API key, or project data was
used.

## 2. Spike isolation and stop condition

The intended namespace was `c2b-spike-<random-suffix>`. No namespace objects
were created because the first mandatory gate failed. Consequently there is no
disposable Better Auth user, submission, Chatto user, room, membership,
message, mapping row, backup, or test process to clean up.

This was the required stop condition: the deployed instance has no configured
external identity provider and its only user-provisioning surface is a
container-local root-equivalent operator socket. Creating a Vibe-facing
adapter would expose or depend on privileged authority, which the phase
explicitly forbids.

## 3. Exact deployed authentication contract

The unauthenticated discovery RPC was called directly:

```text
POST /api/connect/chatto.discovery.v1.ServerDiscoveryService/GetServer
{}

{"profile":{"name":"Chatto","version":"0.4.12"},
 "login":{"authorizeUrl":"/oauth/authorize"}}
```

No external provider was advertised. Container configuration inspection
confirmed:

```text
CHATTO_AUTH_DIRECT_REGISTRATION=false
CHATTO_OPERATOR_API_ENABLED=true
CHATTO_OPERATOR_API_SOCKET_PATH=/tmp/chatto/operator.sock
CHATTO_WEBSERVER_URL=https://chatto.elvie.ad
CHATTO_LIVEKIT_ENABLED=true
```

Source supports OAuth authorization-code + PKCE in
`cli/internal/http_server/oauth.go` and
`cli/internal/core/auth_codes.go`, and configured OIDC/external providers in
`cli/internal/http_server/oidc.go` and `cli/internal/config/auth.go`. Those
paths require provider configuration and redirect-origin allowlisting; they
cannot be exercised against the current deployment without changing Chatto
configuration.

The supported OAuth properties identified in source remain:

- authorization-code flow at `/oauth/authorize` and `/oauth/token`;
- PKCE `S256`, state, configured redirect origins;
- five-minute, single-use authorization codes;
- server-side auth generations and session termination on logout;
- no Better Auth cookie sharing and no Chatto password bridge.

Those are source capabilities, not a qualified Vibe handoff for this deployed
instance.

## 4. Provisioning gate

The prior concern is confirmed rather than resolved.

- `proto/chatto/operator/v1/users.proto` and
  `cli/internal/connectapi/operator_user_management.go` expose user creation,
  password, role, and deletion operations through `chatto.operator.v1`.
- `docs/fdr/FDR-028-operator-api-and-cli.md` defines that API as a local Unix
  socket, default `/tmp/chatto/operator.sock`, mode `0600`, root-equivalent,
  with no public listener, bearer, or scoped service-account boundary.
- `proto/chatto/admin/v1/members.proto` is authenticated Chatto-admin RBAC,
  not a server-to-server least-privilege provisioning API.
- External identity auto-provisioning in `external_identities.go` would be the
  preferred production direction, but no provider is configured in the exact
  deployed instance.

Therefore:

1. A Vibe-authenticated user cannot currently be handed into Chatto through a
   configured external provider.
2. No supported scoped API was found for create/get user, create/get private
   room, membership changes, and short-lived handoff.
3. A local operator script could create synthetic users, but that would only
   qualify privileged operator provisioning; it would not qualify the required
   SSO handoff and is intentionally not a production design.
4. No operator script was created or run.

## 5. Mapping and room model (not instantiated)

The proposed disposable Vibe mappings remain valid as a design, but were not
added to the application or a database because the spike stopped before
provisioning:

```text
chat_identities
  provider, user_id, external_user_id, status,
  provisioned_at, revoked_at, created_at, updated_at

chat_rooms
  provider, submission_id, external_room_id, status,
  created_at, archived_at, updated_at

chat_room_memberships
  chat_room_id, user_id, role, status,
  granted_at, revoked_at, created_at, updated_at
```

The required constraints remain: restrictive foreign keys; unique provider
and external-user mapping; one active provider/submission room mapping; one
active owner membership; explicit active/revoked lifecycle; idempotent
reconciliation; no email or roster inference.

Chatto source evidence supports a private non-universal room and explicit
`RoomService.AddMember`/`RemoveMember` operations in
`proto/chatto/api/v1/rooms.proto`, `cli/internal/connectapi/rooms.go`, and
`cli/internal/core/room_membership.go`. `CreateRoom` generates its own opaque
room ID and has no caller-supplied idempotency key, so Vibe must own a mapping
and reconcile uncertain create responses before retrying.

No room, membership, message, or mapping was created in this phase.

## 6. Revocation gate

No live owner WebSocket test was run because no isolated owner session could be
created without crossing the provisioning gate.

Source indicates:

- direct timeline/message operations re-check membership;
- `StreamMyEvents` filters room events by a membership cache;
- `UserLeftRoom`, `RoomMemberRemoved`, and `RoomMemberBanned` remove a room
  from that cache;
- logout/session termination publishes `SessionTerminatedEvent` and closes
  the realtime stream.

Source does not prove that an already-open client socket closes immediately or
that already-rendered local history disappears. C.2B remains blocked on the
required live test: remove membership from a second actor, then measure history
read, post, future event delivery, reconnect, hard reload, presence, and stale
token behavior. The proposed bound remains no new server-authorized reads,
writes, or room events within five seconds after projection completion.

## 7. Messaging, outage, and operational checks

Because no disposable principal or room existed, text messaging, unread/read,
thread, reaction, logout/reconnect, room discovery, and revocation were not
executed. No assertions are made about those behaviors beyond the source
review.

The deployed service remained healthy during read-only inspection. Recent logs
continue to show repeated LiveKit TLS handshake failures while Chatto’s call
model lists rooms. Text isolation is plausible from the optional runtime-unit
design, but a fault-isolation test was not run and calls remain out of scope.

The required outage qualification remains:

- point only a disposable Vibe messaging client/configuration at an unreachable
  endpoint;
- confirm Vibe login, `/start`, editing, My Projects, admin, judge, and public
  projects remain healthy;
- confirm only messaging shows a bounded retryable state;
- do not couple Chatto mutation to a Vibe database transaction.

Use Chatto `/healthz` for liveness and `/readyz` for NATS/readiness, separately
from Vibe `/api/health`, with a short timeout and circuit breaker.

## 8. Backup/restore gate

No backup was created because no spike data existed. Source and prior operations
review confirm the supported procedure is `chatto backup` with encryption;
`--include-keys` is sensitive, and external-NATS restore requires Chatto to be
stopped in the isolated target. The next attempt must pin the exact image digest
and NATS version, restore into an isolated copy, verify user/room/membership/
message/revoked state, then delete backup material and keys.

## 9. Privacy, retention, and licensing

No messages were sent. Any future pilot must set a short retention/cleanup date,
delete encrypted backup artifacts and keys according to policy, and warn:

> Do not share patient information, passwords, private edit tokens, or API keys
> in chat.

The pilot should remain standalone Chatto with no iframe, no fork, and no
modified server. Chatto’s root/server license is AGPL-3.0-or-later with
documented Apache-2.0 exceptions for selected frontend/API packages. Legal
review remains required before a real participant deployment or any modified
server/adapter distribution.

## 10. Cleanup and rollback

No disposable objects were created, so cleanup was a verified no-op. Production
Chatto remained running, with no restart, configuration change, data mutation,
new listener, token, or background process. There is no database rollback to
perform.

## 11. Gate results

| Gate | Result |
|---|---|
| Supported OAuth/OIDC handoff | **FAIL / blocked** — no provider configured or advertised in deployed 0.4.12 |
| Passwordless Chatto access without shared cookies | **Source-supported conditionally; not qualified** |
| Safe disposable user provisioning | **FAIL / blocked** — only root-equivalent operator socket available |
| Safe private-room provisioning | **Not run** — requires a provisioned isolated user |
| Idempotent Vibe mappings | **Not run** — no schema/data changes made |
| Exact owner membership | **Not run** |
| Existing-session/WebSocket revocation | **Not run; source caveat remains** |
| Chatto outage isolation | **Not run; health endpoints confirmed** |
| Encrypted backup/isolated restore | **Not run; no spike data** |
| Cleanup/rollback | **Pass as no-op; no objects created** |

## 12. Required next step

Do not proceed to C.2C. Before another spike attempt, obtain one of:

1. Operator-approved configuration of the exact deployed Chatto version with a
   supported OIDC provider and strict redirect allowlist, plus an approved
   server-side provisioning path that is not exposed to Vibe; or
2. A Chatto-supported scoped service/API account for identity and room
   provisioning; or
3. An isolated disposable Chatto copy (pinned 0.4.12 image and NATS) where
   provider configuration and operator-only qualification can occur without
   touching the live instance.

Then rerun the owner-only spike with the five-second revocation test, outage
isolation, encrypted backup/restore, and complete cleanup.

**NO-GO — deployed Chatto has no configured external-auth provider and no least-privilege provisioning path; SSO and owner-room revocation cannot be qualified safely**
