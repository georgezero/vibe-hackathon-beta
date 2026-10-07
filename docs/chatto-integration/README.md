# Chatto integration evaluation (Phase C.2A)

## Native-chat decision

The application will build a bounded native team-chat foundation instead of
integrating the deployed Chatto instance. Chatto remains a separate system and
architectural reference; its least-privilege provisioning/session boundary was
not sufficient for a safe Vibe integration.

Vibe Hackathon uses its native team-chat implementation. Chatto remains separate
and was not modified.

This package records a read-only evaluation of the existing Chatto deployment
as a possible external messaging engine for Vibe Hackathon. It is a planning
deliverable, not an integration or deployment.

## Scope and authority

Vibe Hackathon remains authoritative for Better Auth identity, application
authentication, submission ownership, team membership, administrator and judge
authorization, event scope, and room eligibility. Chatto would provide message
storage, room membership enforcement after provisioning, and realtime delivery.

No Vibe Hackathon code, database, or production behavior was changed. Chatto
was not modified, restarted, or provisioned with production data. No real
participant accounts, edit tokens, API keys, or private submission data were
used.

## Findings at a glance

- Chatto 0.4.12 is a credible text-room engine with ConnectRPC, WebSocket
  realtime, private rooms, membership operations, threads, reactions,
  unread/read state, presence, moderation, and encrypted backup/restore tools.
- The live instance has direct registration disabled and no external provider
  configured in its discovery response. Its current public integration surface
  is therefore not ready for Vibe-managed identity handoff.
- Chatto documents OAuth 2.0 authorization-code + PKCE for cross-origin clients,
  and supports OIDC/GitHub/GitLab/Google/Discord providers when configured. Vibe
  should not share Better Auth cookies or use Chatto passwords as a production
  bridge.
- The public API has room/member/message operations, but user provisioning is
  currently exposed through a local operator Unix socket or Chatto-admin
  capabilities. A narrowly scoped provisioning adapter or supported service
  account is required before a pilot.
- C.1 currently supports explicit submission owner claiming, but not explicit
  teammate account membership. A single-owner pilot is possible; multi-user
  team rooms require a small membership phase first.

## Recommendation

**NO-GO for the attempted C.2B spike — the deployed instance has no configured
external-auth provider and no least-privilege provisioning path.**

The source-level architecture review confirms that decision with file- and
module-level evidence: [CHATTO_SOURCE_ARCHITECTURE_REVIEW.md](./CHATTO_SOURCE_ARCHITECTURE_REVIEW.md).
The principal unresolved gates are a least-privilege user/room provisioning
path, exact OAuth/session handoff on the deployed version, and live proof that
membership removal stops an already-open realtime client within the required
bound.

The bounded spike result is documented in
[C2B_DISPOSABLE_INTEGRATION_SPIKE.md](./C2B_DISPOSABLE_INTEGRATION_SPIKE.md).
No disposable Chatto or Vibe objects were created because the first mandatory
SSO/provisioning gate failed closed.

See [OPEN_DECISIONS.md](./OPEN_DECISIONS.md) for the blockers that must be
closed before any production connection.
