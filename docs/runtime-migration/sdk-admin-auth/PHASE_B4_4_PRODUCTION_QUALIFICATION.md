# Phase B.4.4 Production Deployment and Qualification

Date: 2026-07-30 EDT

## Scope

This deployment adds judge Viby login to the existing hybrid judge
authentication deployment. Better Auth remains the canonical application
session, `judge_authorizations` remains authoritative for judge access, and
Viby was not modified or restarted.

## Pre-deployment record

- Branch: `phase-vh-m6-viby-better-auth-session`
- Application HEAD: `0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`
- Previous release:
  `/opt/vibe-hackathon/releases/a03986974ad5ab03453990f7b7f3444e29773b3c`
- Previous PID: `2307060`
- Previous start time: `2026-07-30 08:50:59 EDT`
- Previous restart count: `0`
- Judge authentication mode: `hybrid`
- Administrator session mode: `better-auth`
- Runtime endpoint: `https://viby.keit.ai`
- Canonical database:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deployment main database mtime:
  `2026-07-28 19:54:37.363388871 -0400`
- Pre-deployment local health: HTTP `200`
- Pre-deployment public health: HTTP `200`
- Judge profiles: `3`
- Assignments: `15`
- Scores: `12`
- Judge authorizations: `1` (`1` active)
- Exact Ada authorization: `1` active
- Ada Viby identity links: `0`
- Duplicate assignment pairs: `0`
- Duplicate score pairs: `0`
- Foreign-key violations: `0`
- Database integrity: `ok`

The worktree was at the exact approved HEAD. The only pre-existing worktree
item was the protected untracked `local.db.pre-p0-4.bak`; it was not accessed,
modified, copied, or included.

## Protected backup

- Backup:
  `/opt/vibe-hackathon/backups/local.db.pre-b4-4.20260730T164002-0400.bak`
- Created: `2026-07-30 16:40:09 EDT`
- Mode: `0600`
- Owner: `george`
- Size: `454656` bytes
- SHA-256:
  `03763d1d60924dfaf241cc2b3839a4b84bb23a11f7afafbfb12e17a76ab14612`
- SQLite integrity: `ok`
- Foreign-key violations: `0`
- Preserved counts: `3` profiles, `15` assignments, `12` scores, `1`
  authorization

The backup used SQLite's online backup API.

## Migration

The exact approved B.4.4 migration command targeted the absolute canonical
database:

```bash
DB_FILE_NAME=/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
VIBE_PHASE_B44_MIGRATION_CONFIRM="MIGRATE VIBY JUDGE LOGIN DATABASE /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db" \
npm run db:migrate:viby-judge-login
```

- First run: passed; Phase B.4.4 schema valid.
- Second identical run: passed; idempotence demonstrated.
- Database integrity after migration: `ok`
- Foreign-key violations: `0`
- Duplicate assignment pairs: `0`
- Duplicate score pairs: `0`
- Counts after migration: `3` profiles, `15` assignments, `12` scores, `1`
  active authorization
- Exact Ada authorization remained active.
- Ada Viby identity-link count remained `0`.
- No authorization or identity link was created by migration.

## Immutable build and deployment

- Release:
  `/opt/vibe-hackathon/releases/0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`
- Embedded commit: `0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`
- Build start: `2026-07-30 16:40:56 EDT`
- Build completion: `2026-07-30 16:43:35 EDT`
- Clean install: passed
- Next.js 16.2.12 production build: passed
- TypeScript in production build: passed
- Generated routes: `39`

An initial build invocation without the protected production environment
stopped during page-data collection because
`VIBE_HACKATHON_BASE_URL` was intentionally unavailable. No deployment had
occurred. The same exact source release was then built successfully with the
established service environment. The remaining warning was the existing
optional GitHub OAuth configuration warning. `npm ci` also reported existing
dependency advisories.

The release symlink was switched atomically. Only the Vibe Hackathon user
service was restarted.

## Post-deployment service

- Deployed release:
  `/opt/vibe-hackathon/releases/0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`
- PID: `3513092`
- Start time: `2026-07-30 16:43:44 EDT`
- Restart count: `0`
- Service: active/running
- Startup: Next.js Ready in `173 ms`
- Judge authentication mode: `hybrid`
- Judge event: `evt_vibe_2025`
- Administrator session mode: `better-auth`
- Runtime endpoint: `https://viby.keit.ai`
- Canonical database path: unchanged
- Local health: HTTP `200`
- Public health: HTTP `200`

The signed-out public `/judge` page returned HTTP `200` and displayed:

- `Continue with Viby`;
- authorization-dependent judge-access copy;
- the visibly marked legacy credential fallback.

It did not automatically redirect to Viby.

## Live browser qualification

The first real `Continue with Viby` attempt stopped at Runtime before identity
selection or assertion issuance:

```text
Host app request could not continue.
Invalid host-app callback URL.
```

The application-generated request was inspected without printing callback
state:

- Runtime origin: `https://viby.keit.ai`
- Runtime path: `/apps/vibe-hackathon/start`
- Runtime mode: `admin`
- callback parameter present: yes
- callback origin:
  `https://vibe-hackathon-dev.ggg.ad`
- callback path: `/judge/viby/callback`
- callback state present: yes
- context mode: `admin`
- context source: `vibe_judge_login`
- `forceIdentityCheck`: `false`

The Runtime UI's `Callback: no` means that Runtime discarded the supplied
callback after validation; it does not mean the application omitted the
parameter.

### Exact failing comparison

Runtime validates a connected-app callback by first finding an active rule
whose path exactly equals the requested URL pathname. For the production
`vibe-hackathon` registration, the established callback paths are:

- `/admin/viby/callback`
- `/admin/viby/agent-callback`
- `/admin/viby/artifact-callback`

Requested:

```text
/judge/viby/callback
```

Allowed exact paths:

```text
/admin/viby/callback
/admin/viby/agent-callback
/admin/viby/artifact-callback
```

Therefore the exact path lookup returned no matching active rule and Runtime
rejected the request as `invalid_path`. The callback origin was correct.
Browser state did not contribute.

`mode=admin` is expected in the current application because Runtime's
authoritative human host-application assertion mode is named `admin`. It is
not evidence that application administrator authorization was requested or
granted.

There is a second contract mismatch behind the path failure: the deployed
Runtime `admin` mode uses source `vibe_admin_confirmation`, while B.4.4 sends
source `vibe_judge_login`. Adding only the callback path would therefore be
insufficient; launch-context source validation must also have an agreed
server-owned policy.

The application had created its callback transaction correctly:

- operation: `judge_login`
- browser binding: present (not printed)
- callback state: present (not printed)
- expiration: short-lived
- transactions observed during qualification/diagnosis: `3`
- consumed: `0`
- failed by application callback: `0`

Runtime rejected the launch before calling the application, so the
application could not consume or mark those transactions. They expire and are
not sessions, links, or grants.

No first-time link, returning login, remembered login, fresh verification,
confirmation, replay, cancellation, account-switch, assignment, scoring, or
logout qualification could proceed. In particular:

- `judge_viby_login_started` audits: `3`
- `judge_viby_login_succeeded` audits: `0`
- Ada Viby links: `0`
- judge authorizations: unchanged at `1`

No Viby profile was inferred or selected.

## Failure classification

This is an integration-contract defect discovered in B.4.4, not stale browser
state and not an assertion-validation failure:

1. the application introduced a new callback path and context source;
2. that path/source were not part of the deployed Runtime connected-app
   contract;
3. local B.4.4 tests did not exercise the production Runtime registry policy.

The existing allow-listed admin callback cannot simply be reused in the
deployed code: it invokes the unified callback with the operation hard-coded
to `admin_login`. A judge transaction would fail the operation binding.
Changing that behavior requires a reviewed application implementation, not a
deployment-time redirect or validation bypass.

## Rollback

The live Viby capability could not pass, so the documented rollback was
performed:

- restored release:
  `/opt/vibe-hackathon/releases/a03986974ad5ab03453990f7b7f3444e29773b3c`
- judge mode: `hybrid`
- administrator session mode: `better-auth`
- rollback PID: `3760751`
- rollback start: `2026-07-30 18:27:14 EDT`
- restart count: `0`
- startup: Ready in `247 ms`
- local health: HTTP `200`
- public health: HTTP `200`

Only the Vibe Hackathon service was restarted. Viby was not modified,
restarted, or redeployed. The additive schema was retained. The database
backup was not restored because no corruption occurred.

Post-rollback checks:

- database integrity: `ok`
- foreign-key violations: `0`
- profiles: `3`
- assignments: `15`
- scores: `12`
- judge authorizations: `1`
- Ada Viby links: `0`

## Required correction and requalification

B.4.4 needs a reviewed contract correction before another deployment. The
safe choices are:

1. add and deploy an explicit Runtime judge-login mode/source and exact judge
   callback registration; or
2. redesign the application to use an already registered, role-neutral shared
   callback that securely resolves the server-owned transaction operation
   before dispatch.

Option 2 cannot be implemented by merely changing the URL to the current admin
callback. In either case, production-registry conformance must become an
automated pre-deployment test covering exact origin, callback path, mode, and
source.

## Final gate

Phase B.4.4 production qualification failed before Viby identity
authentication. Phase B.4.5 must not begin.

NO-GO
