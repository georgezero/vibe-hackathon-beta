# Phase C.2 predeployment gate

Status: superseded by `PHASE_C3_DISPOSABLE_QUALIFICATION.md`. No canonical
migration, production deployment, feature-flag activation, or Chatto change
has occurred.

## Baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting/final local HEAD for this slice: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Current worktree: pre-existing unrelated dirty files plus this uncommitted
  native-chat implementation; no commit or deployment was performed.
- Current local health: `/api/health` returned HTTP 200 with database `ok`,
  active event `evt_vibe_2025`, and `eventFrozen: false`.
- Current local SQLite counts before migration: 8 submissions, 2 users,
  0 explicit submission owners; the new membership and chat tables are not
  present because canonical migration was intentionally not run.
- Existing C.1 production release: `0ec33b1ae1cf862112987198a91ff19abbfa662b`.
- Chatto remains separate and unchanged.

## Delivered boundary

### C.2A

- Additive `submission_membership_invitations` and `submission_memberships`
  schema with restrictive foreign keys and partial uniqueness checks.
- Existing explicit owners reconcile to one active owner membership. No roster
  email or historical teammate becomes an account membership.
- Claim confirmation creates owner and owner membership in one transaction.
- Owner-created teammate links are expiring, single-use, digest-only, and
  require authenticated explicit confirmation. Revocation preserves history
  and emits a room revocation event when a room exists.

### C.2B–C.2D foundation

- Additive room/message/read-state/event schema and two explicit migration
  scripts. Lazy room creation is one active private room per submission.
- Plain-text messages are length-bounded and client-idempotent. System events
  are allowlisted and never human-authored.
- Every operation resolves the Better Auth principal and active membership.
- Authenticated SSE is bounded to a 25-second stream with membership checks and
  polling fallback. The five-second revocation SLA remains a live pilot gate.
- `VIBE_NATIVE_TEAM_CHAT_ENABLED=false` is the default. An optional
  `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS` allowlist limits a controlled pilot.

## Qualification evidence

- TypeScript: passed.
- ESLint: passed.
- Production build: passed; native chat routes were included in the build.
- `npm run test:isolation`: passed (`missingConfiguration: rejected`,
  disposable audit writes only, canonical database unchanged).
- Focused migration tests: 3/3 passed (membership reconciliation and native
  chat idempotence/FK checks on disposable SQLite files).
- Full unit suite: 237/237 passed. Existing migration-management warnings were
  emitted by the suite's intentionally exercised fail-closed scripts; the test
  process exited successfully.
- C.1 Chromium: 4/4 passed across desktop and mobile.
- Phase B Chromium regression: 28/28 passed across desktop and mobile.
- WebKit: unavailable on this host because `libmanette-0.2.so.0` and
  `libhyphen.so.0` are missing; no WebKit pass is claimed.
- `git diff --check`: passed.

## Historical gates

The first four local gates are closed by the C.3 disposable qualification.
Only explicit approval for a designated pilot submission and two test accounts
remains before any canonical migration or feature-flag activation.

## Rollback

Before a pilot, preserve the current immutable release and canonical backup.
If the application gate fails, leave the flag disabled or restore the prior
release. Additive membership/message tables remain; do not delete messages or
memberships as an application rollback step. Chatto has no role in rollback.

## Disposition

This slice is not deployed. It is `CONDITIONAL` until the controlled
predeployment gates above are closed and the operator approves a pilot.
