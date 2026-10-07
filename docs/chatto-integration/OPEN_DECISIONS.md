# Open decisions and blockers

## Required before a retry of C.2B

1. **Identity handoff:** choose configured Chatto OAuth/OIDC versus another
   supported mechanism. Current discovery advertises `/oauth/authorize` but no
   provider is configured.
2. **Provisioning:** obtain a supported scoped service-account/API or build a
   narrowly isolated Chatto-side adapter. Do not expose root-equivalent
   operator Unix-socket APIs to Vibe.
3. **C.1 membership:** decide whether the spike is owner-only or first adds an
   explicit `submission_memberships` model. Roster email is not sufficient.
4. **Revocation semantics:** confirm whether `RemoveMember` invalidates existing
   sessions, cached history, and WebSocket subscriptions immediately.
5. **Retention/deletion:** document message, asset, and audit retention,
   deletion, and legal hold behavior.
6. **Moderation:** define whether organizer support can see private rooms and
   how access is audited.
7. **Monitoring:** define a machine-readable health probe and alert ownership.
8. **Licensing:** obtain AGPL integration/distribution review before any
   customized frontend or linked service is shipped.

## C.2B spike result

The attempted disposable spike stopped before creating any test objects. The
deployed Chatto 0.4.12 discovery response advertised only `/oauth/authorize`,
with no configured external provider. Direct registration is disabled, and
the only user-provisioning API is the container-local `0600` root-equivalent
operator socket. Exposing that authority through Vibe would violate the phase
boundary, so SSO, owner provisioning, room creation, and live revocation were
not qualified.

Required retry prerequisites:

- configure/approve a supported OIDC/OAuth provider and strict redirect
  allowlist on an isolated pinned Chatto copy, or obtain a scoped provisioning
  API/service account;
- qualify the owner-only handoff and room mapping without shared cookies;
- run the existing-session/WebSocket removal test and outage isolation test;
- run encrypted backup/isolated restore and clean all disposable state.

## Deferred product choices

- standalone Chatto is the recommended first UX; branded/native UI is deferred;
- attachments, calls, DMs, public/community rooms, bots, AI agents, and
  notifications are out of scope;
- no production room or user should be provisioned until all gates pass.

## Final recommendation

**NO-GO — retry C.2B only after the deployed-contract SSO and least-privilege
provisioning gates are resolved.**
