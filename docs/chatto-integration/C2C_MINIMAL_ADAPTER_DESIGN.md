# Phase C.2C — Minimal Chat Adapter Design

Architecture only. No implementation, migration, service change, deployment,
Chatto modification, Viby change, or production integration is included.

## Decision summary

Vibe needs only a narrow server-to-server control plane for an owner-only pilot:

1. Resolve or create the mapped Chatto user.
2. Resolve or create the mapped private room.
3. Grant the explicit owner membership.
4. Revoke that membership.

Those four operations are sufficient for the first single-owner room workflow,
but not forever. A production adapter also needs read/reconcile operations,
health, session-handoff status, and explicit disable/revocation coordination.
It must never expose Chatto’s operator socket, arbitrary Chatto admin APIs,
NATS, message content, roles, passwords, backups, or user deletion.

The smallest safe deployment shape is a **Chatto-hosted local adapter daemon**
with a narrowly authenticated private interface from Vibe. That recommendation
is conditional: with the current Chatto 0.4.12 contract the daemon would still
need the root-equivalent operator socket for provisioning. It is not acceptable
for production until Chatto supplies a scoped capability/service API or the
operator explicitly approves a separately isolated bridge with equivalent
controls. A native Vibe chat remains the fallback if that upstream gate is not
resolved.

## 1. Source and boundary assumptions

This design uses the evidence in:

- `docs/chatto-integration/CHATTO_SOURCE_ARCHITECTURE_REVIEW.md`;
- `docs/chatto-integration/C2B_DISPOSABLE_INTEGRATION_SPIKE.md`;
- `docs/chatto-integration/CHATTO_INTEGRATION_EVALUATION.md`.

The reviewed deployment is Chatto 0.4.12, image digest
`sha256:ddb1c5079c9fb2544f582c59a8d85b3bf754c24d3f1f19e15bec0647db377bd`.
The current instance has no configured external identity provider, and its
provisioning surface is `/tmp/chatto/operator.sock`, mode `0600`,
root-equivalent. These facts are design constraints, not permissions to use the
socket from Vibe.

## 2. Minimal architecture

```text
Browser
  |  Better Auth session; no Chatto secret and no operator credential
  v
Vibe Hackathon (authoritative owner/membership policy)
  |  private mTLS/service identity; signed, short-lived intent
  v
Chat Adapter (Chatto host, deny-by-default control plane)
  |  approved capability API (required)
  |  current fallback would be local operator socket (not production-safe)
  v
Chatto 0.4.12
  |-- user/external-identity store
  |-- private room and membership service
  |-- OAuth/OIDC session flow
  `-- NATS/JetStream, realtime, timeline, backups (Chatto-owned)
```

The adapter is not a message proxy. Chatto remains the message and realtime
engine. The browser navigates to standalone Chatto after the server-side
control plane has reconciled identity, room, and membership.

## 3. Operations exposed by the adapter

The public adapter API should contain only typed, versioned operations. Every
operation requires an authenticated Vibe service caller and a Vibe-owned
correlation/request ID.

### Required control operations

| Operation | Purpose | Idempotency and constraints |
|---|---|---|
| `GetOrCreateIdentity` | Resolve one Chatto user for one Better Auth user/provider subject | Unique `(provider, vibe_user_id)` and `(provider, external_subject)`; never email-match; never accept a browser-selected Chatto ID. |
| `GetOrCreateRoom` | Resolve one private Chatto room for one claimed submission | Unique `(provider, submission_id)`; private/non-universal only; adapter reconciles uncertain creates before retry. |
| `EnsureOwnerMembership` | Add exactly the claimed owner to the mapped room | One active owner membership; no roster/email/admin/judge inference; retry-safe. |
| `RevokeMembership` | Remove the owner or explicitly revoked member | Idempotent absent result; records reason and timestamp; does not delete Vibe ownership or Chatto history. |

### Required read/reconcile operations

The four mutations are not sufficient for reliable operations. The adapter also
needs non-secret, bounded reads:

- `GetIdentityMapping`;
- `GetRoomMapping`;
- `GetMembershipState`;
- `CheckChattoReadiness`;
- `GetOperationStatus` for asynchronous/retry reconciliation.

These reads must return only mapped external IDs, lifecycle state, timestamps,
and safe error codes. They must not return message bodies, arbitrary Chatto
users, room discovery, tokens, passwords, or operator data.

### Session handoff

`BeginSessionHandoff` may be added only after the exact Chatto OIDC/OAuth
contract is configured and qualified. It should return a short-lived,
single-use, server-generated Chatto authorization URL or handoff reference. It
must never return a Chatto password, long-lived bearer token, Better Auth
cookie, or operator credential. The final browser redirect remains to Chatto’s
standalone frontend.

### Operations that must remain impossible

The adapter must reject or have no route for:

- arbitrary user creation/deletion or password setting;
- role assignment/revocation, admin promotion, or judge promotion;
- arbitrary room creation, public/universal rooms, DMs, or room discovery;
- message read/write proxying, exports, moderation search, or content access;
- NATS publish/subscribe, JetStream administration, and direct event injection;
- backup/restore and encryption-key access;
- arbitrary Chatto API forwarding;
- ownership transfer and teammate membership inferred from roster/email;
- changing Vibe authorization or event scope.

## 4. Are four operations sufficient forever?

No. They are the smallest **owner-only MVP mutation set**. A durable adapter
also needs:

1. mapping reads and reconciliation status;
2. Chatto readiness and version checks;
3. account disablement propagation (revoke all mapped memberships);
4. session-handoff initiation and cancellation;
5. room archive handling when a submission is deleted/finalized under policy;
6. retry/dead-letter inspection;
7. operation audit lookup by safe correlation ID.

Future teammate rooms would need explicit `EnsureMemberMembership` and
`RevokeMemberMembership`, but only after Vibe has a claimed teammate-membership
model. Judges, administrators, support users, DMs, attachments, bots, and
community rooms are intentionally not part of this adapter.

## 5. Adapter placement options

| Option | Assessment |
|---|---|
| A. Operator CLI | Safe for one-off provisioning only. Poor for retries, session handoff, audit correlation, and revocation SLA. Cannot support a participant-facing workflow. |
| B. Chatto-hosted local daemon | Preferred shape. Keeps Chatto authority on `horo`, allows a deny-by-default API, and isolates failure. Still unsafe with the current root-equivalent socket unless the daemon boundary is explicitly approved or Chatto adds scoped capabilities. |
| C. Internal authenticated HTTP service | Only acceptable if private-network/mTLS and strict allowlists are equivalent to B. A public or broadly reachable service would turn operator authority into an application attack surface. |
| D. Background worker | Good for asynchronous reconciliation/outbox, not sufficient alone for interactive session handoff. Pair with B or a scoped upstream API. |
| E. Chatto plugin/NATS extension | Not a public extension contract. Trusted NATS (`svc.chatto_ext.>`) is too powerful for a remote Vibe integration and requires Chatto-side trust. |

### Recommendation

Use **B plus a small Vibe outbox/worker** only after Chatto provides a scoped
capability API. Until then, an operator CLI may be used for a disposable
qualification environment but must not be called from Vibe or a browser.

## 6. Authentication between Vibe and adapter

The adapter must authenticate Vibe as a service, not end users as a browser
credential.

Preferred transport and identity:

- private network path or WireGuard between `paui` and `horo`;
- mutual TLS with a dedicated adapter server certificate and Vibe client
  certificate, or an equivalent workload identity system;
- certificate audience restricted to the adapter service;
- short-lived signed request assertions containing operation, Vibe service
  identity, request ID, issued-at, expiry, and body digest;
- replay cache keyed by request ID and bounded expiry;
- no Better Auth cookie forwarding and no browser-to-adapter direct calls.

The Vibe server resolves the authenticated Better Auth principal and explicit
submission ownership first. It sends the adapter only the minimum stable
identifiers: Vibe user ID, provider/subject namespace, submission ID, and an
explicit operation. Email, edit tokens, judge IDs, admin flags, and raw session
tokens never cross this interface.

The adapter independently validates namespace, operation, lifecycle, room
policy, and request authorization. It does not decide whether a Vibe user is a
submission owner; it enforces that only the Vibe service can request a mapped
owner operation.

## 7. Trust boundaries

```text
Boundary 1: Browser -> Vibe
  Better Auth, CSRF/same-origin, explicit owner checks.

Boundary 2: Vibe -> Adapter
  Private mTLS/workload identity, signed requests, replay protection,
  allowlisted operations, no browser credentials.

Boundary 3: Adapter -> Chatto
  Scoped Chatto capability (required); current operator socket is a
  root-equivalent temporary risk and must not be exposed beyond the daemon.

Boundary 4: Chatto -> NATS/JetStream
  Chatto-owned internal event/storage boundary; adapter cannot access NATS.

Boundary 5: Browser -> standalone Chatto
  Chatto’s own OAuth/OIDC/session contract; no shared cookies or iframe.
```

## 8. Sequence diagrams

### Open team room

```text
Browser       Vibe                 Adapter              Chatto
  |             |                    |                    |
  |--open room->|                    |                    |
  |             |--resolve session->|                    |
  |             |--owner check------|                    |
  |             |--GetOrCreateIdentity--------------->  |
  |             |                    |--scoped call------>|
  |             |                    |<--Chatto user ID---|
  |             |--GetOrCreateRoom-------------------->  |
  |             |                    |<--room ID----------|
  |             |--EnsureOwnerMembership-------------->  |
  |             |                    |<--active-----------|
  |             |--BeginSessionHandoff---------------->  |
  |             |<--one-time Chatto URL/reference-------|
  |<--redirect to standalone Chatto----------------------|
  |             |                    |                    |
```

The adapter must reconcile an uncertain `CreateRoom` response by checking its
Vibe mapping before retrying. A room name is never the identity key.

### Revoke membership

```text
Admin/Vibe job       Vibe                 Adapter              Chatto
      |                |                    |                    |
      |--revoke------->|                    |                    |
      |                |--policy/owner----->|                    |
      |                |--RevokeMembership--------------------->|
      |                |                    |--RemoveMember----->|
      |                |                    |<--accepted/event---|
      |                |<--correlation/status|                    |
      |                |                    |                    |
      |                |--poll status/reconcile--------------->  |
```

The product SLA must be defined around Chatto projection completion. The
adapter cannot claim that an already-open browser loses rendered history; it
must verify no new authorized reads, writes, reconnects, or realtime events.

### Retry and failure recovery

```text
Vibe request -> durable outbox (idempotency key)
                   |
                   v
              Adapter call
              /       \
       success        timeout/unknown
          |                 |
    mark applied      Get mapping/status
                            |
                   retry only if absent/pending
                   dead-letter after bounded attempts
```

No Vibe database transaction should span Chatto. The outbox/mapping state is
the source of reconciliation truth.

## 9. Idempotency model

Every mutation receives a Vibe-generated idempotency key derived from a random
request ID and operation intent, not from email or room name. The adapter
stores a bounded result ledger keyed by `(operation, mapping key,
idempotency_key)`.

Rules:

- `GetOrCreateIdentity`: unique provider/subject and Vibe-user mapping; a
  conflicting active mapping fails closed.
- `GetOrCreateRoom`: read Vibe mapping first; if Chatto creation times out,
  reconcile by mapping and a tightly scoped disposable name/correlation only;
  never create a second room blindly.
- `EnsureOwnerMembership`: repeated add returns the same active membership.
- `RevokeMembership`: repeated removal returns already-revoked/not-present and
  never deletes history.
- Any ambiguous duplicate mapping is an operator-visible conflict, not an
  arbitrary selection.

## 10. Audit design

Both Vibe and the adapter write safe audit events with the same correlation ID.
Minimum fields:

- operation and result;
- Vibe user ID and submission ID;
- mapped Chatto user/room/membership IDs;
- adapter version and Chatto version;
- issued-at/completed-at timestamps;
- retry count and failure category.

Never log passwords, Chatto bearer tokens, Better Auth cookies, edit tokens,
Viby assertions, private keys, message bodies, or raw mTLS material. Audit
records are append-only, access-controlled, and retained according to the
Vibe/Chatto privacy policy.

## 11. Security model and threat table

| Threat | Control | Residual risk |
|---|---|---|
| Compromised browser requests arbitrary room | Vibe derives owner/submission from Better Auth and explicit ownership; adapter accepts only signed service requests | Vibe compromise can request allowed owner actions; contain with mapping scope and revocation. |
| Adapter credential theft | mTLS key in restricted secret store, rotation, private network, no browser exposure | Adapter still has high impact; current operator-socket bridge is not production-approved. |
| Replay | request ID, body digest, issued/expiry window, adapter replay cache | Clock/key rotation must be operated correctly. |
| Email collision | issuer/subject and durable Vibe mapping only | Bad upstream identity mapping must fail closed. |
| Room-name collision | Vibe mapping and external room ID; no name-based authority | Uncertain Chatto create needs reconciliation. |
| Privilege escalation | no role/password/admin/NATS/message routes; fixed private-room policy | Root-equivalent Chatto socket remains unacceptable until replaced. |
| Stale membership | RemoveMember, session/membership reconciliation, periodic revocation worker | Existing WebSocket behavior requires live SLA qualification. |
| Chatto outage | outbox, bounded retries, circuit breaker, messaging-only degradation | Pending provisioning can require operator reconciliation. |
| Sensitive content leakage | no message proxy; explicit user warning; Chatto encryption/key policy | Chatto operators/backups with keys may access content. |
| Supply-chain/API drift | pin Chatto image digest, adapter contract tests, upgrade rehearsal | Chatto pre-1.0 APIs can change. |

## 12. Failure and operational model

### Normal operation

Vibe remains authoritative for account, claimed submission, membership, and
event scope. Adapter calls are synchronous for an open-room request when
already provisioned; first provisioning may be asynchronous with a bounded
“Preparing your room” state. Chatto’s `/readyz` is checked by the adapter, not
by browser code.

### Failure handling

- Chatto unavailable: return a retryable messaging-only error; `/start`,
  editing, account, admin, judge, and public project routes remain independent.
- Timeout after room creation: reconcile mapping before retrying.
- Membership conflict: fail closed and create an operator-visible conflict;
  never choose one row arbitrarily.
- Adapter unavailable: no Chatto change; Vibe keeps ownership state and queues
  bounded work in its outbox.
- Vibe unavailable: Chatto may continue its own session until normal Chatto
  logout/expiry, but Vibe must revoke mapped memberships when it returns.
- Account disablement: enqueue revocation for every mapped membership and
  prevent new handoffs immediately in Vibe.

### Observability

Expose adapter health separately from Chatto `/healthz` and `/readyz`. Metrics
should include latency/error/retry counts by operation, pending outbox count,
mapping conflicts, and revocation age—not user emails or message data.

## 13. Deployment diagram

```text
                 private network / mTLS
  Vibe Hackathon ------------------------------> Adapter daemon
  (paui)          only server-to-server requests       (horo)
    |                                                   |
    | Better Auth / ownership DB                        | restricted local
    |                                                   | Chatto capability
    v                                                   v
  Browser -- standalone redirect/session ----------> Chatto 0.4.12
                                                        |
                                                        v
                                                  NATS/JetStream

  Viby is outside this diagram and remains unchanged.
  Browser never reaches the adapter control API and never sees its secret.
```

Recommended process isolation for a future daemon:

- dedicated OS user and filesystem namespace;
- no Docker socket, no host shell, no NATS credentials;
- only the Chatto capability endpoint/socket and outbound audit sink;
- network ACL permitting only Vibe and Chatto;
- read-only image/filesystem where practical;
- seccomp/AppArmor and resource limits;
- immutable, pinned adapter release;
- operator approval for upgrades and key rotation.

## 14. Adapter versus native chat

Estimates assume one experienced full-stack engineer, existing Vibe auth and
submission ownership, no attachments/calls/DMs, text-only owner rooms, and one
security review. They exclude waiting time for Chatto upstream changes.

| Horizon | Adapter + Chatto | Native owner-only chat |
|---|---:|---:|
| MVP | 4–8 engineer-weeks if Chatto provides scoped capabilities; 8–14 weeks if a temporary host bridge must be reviewed and hardened | 4–7 engineer-weeks for text rooms, membership, timeline, and basic polling/realtime; 6–10 weeks if production-grade WebSocket/revocation is required |
| Six months | 2–4 engineer-months for contract tests, outbox/reconciliation, upgrades, monitoring, privacy, and revocation hardening | 4–8 engineer-months for realtime hardening, moderation, retention, backups, abuse controls, mobile UX, and operational ownership |
| One year | 4–8 engineer-months including Chatto upgrade compatibility, adapter security, incident response, and licensing review | 8–14 engineer-months if threads, reactions, unread, presence, moderation, exports, and mobile parity become expected |

The adapter has lower feature duplication and better long-term messaging depth,
but its schedule is dominated by the unresolved Chatto capability contract. The
native MVP is faster only if the product remains deliberately narrow and Vibe
accepts owning all security/operations. These are planning ranges, not a fixed
commitment.

## 15. Recommendation

Do not implement the adapter against the current operator socket. The minimum
acceptable next step is an upstream/operations decision that produces a
scoped Chatto capability API for the four mutations plus bounded reads and
session handoff, followed by a disposable owner-only qualification.

If Chatto cannot provide that capability without a root-equivalent bridge,
build a native Vibe owner-only chat instead. Do not add teammate rooms, judges,
DMs, attachments, bots, or public channels until the first owner workflow and
revocation policy are proven.

**CONDITIONAL GO — a scoped Chatto capability/provisioning contract and live revocation SLA are required before implementation**
