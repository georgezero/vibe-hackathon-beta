# Viby SDK and Admin Authentication Modernization Plan

Status: Phase A deployed; Phase B session unification implemented locally

Audit date: 2026-07-28

Decision: **Phase B awaiting local qualification**

Phase B's bounded compatibility design is recorded in
[PHASE_B_SESSION_UNIFICATION.md](./PHASE_B_SESSION_UNIFICATION.md). The broader
Viby SDK migration remains deferred.

This package describes how Vibe Hackathon can move from its custom Viby admin
cookie and hand-written assertion client to a Better Auth application session
with a linked Viby identity. It does not authorize implementation, a database
migration or Runtime changes. Phase A now adds Better Auth email/password
administrators while retaining the qualified Viby adapter.

## Frozen audit baselines

| Component | Audited baseline |
| --- | --- |
| Vibe Hackathon canonical source | `main` at `65615e5d638f7fba0a81b12d5e3d74503d1c3d8e` |
| Vibe Hackathon deployed behavior | release `1cc6394713aaef32425d763772f1e4b75857bdcc`; later canonical changes are documentation and a judge test typing correction |
| Vibe Hackathon production origin | `https://vibe-hackathon-dev.ggg.ad` |
| Shared Runtime | `https://viby.keit.ai` |
| Runtime deployed source | `phase-9-runtime-connected-apps` at `172963e82110fad2d5336e2d73847f429906beb9` |
| Runtime service | `viby-runtime-keit-ai.service` on moofi; inspected read-only |
| ri0 reference | `main` at `6890ff4439827328acc229350cae0d68d9f6d8b0` on doro |
| Better Auth in Vibe | `1.6.25` |

At audit time the public Vibe health endpoint returned HTTP 200, the shared
Runtime root returned HTTP 200, and neither service was changed.

The Vibe repository also contained the pre-existing untracked protected backup
`local.db.pre-p0-4.bak`. It was not opened or changed. Its retention and secure
disposal must be resolved operationally before any authentication schema
migration.

## Principal conclusion

The target responsibility boundary is sound:

- Viby verifies identities, issues assertions, enforces assertion expiry and
  single redemption, and performs fresh verification.
- Vibe Hackathon owns Better Auth users and sessions, application roles,
  identity links, admin authorization, judge authorization, agent attribution,
  and artifact provenance.

The current Runtime SDK cannot yet be adopted directly. The deployed SDK sends
the wrong JSON field to the deployed redemption route, parses a response shape
the route does not return, does not compare callback state with the caller's
stored state, lacks fresh-verification launch options, and models only a human
payload. The current `vibe-hackathon` Runtime registration also has no active
confidential client credential. These are pre-implementation gates.

## Documents

- [CURRENT_AUTH_ARCHITECTURE.md](CURRENT_AUTH_ARCHITECTURE.md)
- [RI0_REFERENCE_AUDIT.md](RI0_REFERENCE_AUDIT.md)
- [RUNTIME_SDK_AUDIT.md](RUNTIME_SDK_AUDIT.md)
- [TARGET_AUTH_ARCHITECTURE.md](TARGET_AUTH_ARCHITECTURE.md)
- [ACCOUNT_LINKING_DESIGN.md](ACCOUNT_LINKING_DESIGN.md)
- [ADMIN_SESSION_MIGRATION.md](ADMIN_SESSION_MIGRATION.md)
- [AGENT_AND_ARTIFACT_CALLBACK_BOUNDARY.md](AGENT_AND_ARTIFACT_CALLBACK_BOUNDARY.md)
- [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md)
- [SECURITY_AND_PRIVACY_REQUIREMENTS.md](SECURITY_AND_PRIVACY_REQUIREMENTS.md)
- [IMPLEMENTATION_PHASES.md](IMPLEMENTATION_PHASES.md)
- [TEST_PLAN.md](TEST_PLAN.md)
- [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md)
- [OPEN_DECISIONS.md](OPEN_DECISIONS.md)
- [PHASE_A_IMPLEMENTATION.md](PHASE_A_IMPLEMENTATION.md)

Phase A branch: `phase-vh-m5-better-auth-admin-login`. The later SDK/identity
linking work remains separately gated.
