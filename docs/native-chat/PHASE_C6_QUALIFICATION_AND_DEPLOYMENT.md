# Phase C.6Q — Qualification and Deployment

## Disposition

`CONDITIONAL GO — post-deployment authenticated walkthrough requires an approved synthetic credential handoff`.

The C.6 release is deployed and healthy. The remaining gate is operational:
the retained synthetic pilot passwords were intentionally removed after C.4R,
so a production authenticated walkthrough requires an operator-approved
credential handoff or fresh synthetic provisioning through the existing
supported tooling. No credential was guessed, reset implicitly, or written to
the report.

## Baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` (working tree C.6 UX changes)
- Previous release: `/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-c5-team-workspace-20260801T231500Z`
- Previous PID/start: `2656772`, `2026-08-01 19:14:33 EDT`
- Previous restart count: `0`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deploy SHA-256: `d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03`
- Feature flags: `VIBE_NATIVE_TEAM_CHAT_ENABLED=true`,
  `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr`
- Chatto and Viby were healthy and untouched.

## Host blocker and remediation

The prior hang was caused by orphaned qualification processes from the old C.6
dev harness:

| PID | Parent | Process | Working directory | Action |
|---:|---:|---|---|---|
| 2722087 | 1 | Next.js 16.2.12 dev server, port 3240 | repository | stopped |
| 2722638 | 2722087 | dev build worker | repository | stopped |

Production PID `2656772`, other Next services on ports 3001/3100, Cloudflare
tunnels, Chatto, and Viby processes were preserved. The stale repository
`.next` directory was removed as a generated artifact only. No source,
canonical database, backup, or production release was removed.

The qualification harness now starts the completed production build on port
3241 behind a disposable HTTPS loopback proxy on 3240. HTTPS is required by
the production base-URL guard; the proxy uses a one-day localhost certificate
and is isolated to the disposable test process.

## Build

`npm run build` completed normally:

- Next.js 16.2.12 Turbopack compilation: passed (27–28 seconds).
- TypeScript: passed.
- Static page generation: 55/55.
- Route optimization: passed.
- Build artifact: `.next/BUILD_ID` present.

## Automated qualification

- Unit suite: **237 passed / 237** across 40 files.
- Authenticated Chromium: **4 passed / 4** (desktop and mobile).
- Changed-file ESLint: passed.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- WebKit: non-blocking; required host libraries are unavailable.

The Chromium suite covered workspace navigation, Team roster, invitation and
join, private text messages, unread state, SSE delivery, revocation, regrant,
mobile layout, and signed-out denial. It used a disposable database and
synthetic C3 identities only.

## Screenshot review

Deterministic screenshots are stored under
`docs/native-chat/screenshots/` and linked from
[PHASE_C6_PARTICIPANT_EXPERIENCE.md](PHASE_C6_PARTICIPANT_EXPERIENCE.md).
Desktop and mobile review found:

- clear project identity and status hierarchy;
- readable readiness checklist and next actions;
- distinct formal roster versus authenticated membership;
- consistent human/system message styling;
- timeline grouping without audit terminology;
- no horizontal overflow or clipped workspace controls;
- mobile tabs scroll intentionally and the composer remains touch/keyboard safe.

No bounded polish correction was required after screenshot review.

## Backup and release

A fresh verified backup was created before deployment:

`/opt/vibe-hackathon/backups/local.db.pre-c6-participant.20260802T012900Z.sqlite`

- mode `0600`;
- SQLite integrity: `ok`;
- foreign-key check: empty;
- SHA-256: `fb8d198d97dad6093dcca7265dcfa443b20d628b27e90a9ddca11abd990fed6b`.

Immutable release:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-c6-participant-experience-20260802T013000Z`

The artifact excludes the canonical database, env files, test results, local
credentials, and `.next/dev`; it includes the completed build and the existing
qualified dependency tree. The symlink was switched atomically and only the
Vibe Hackathon user service was restarted.

## Post-deployment state

- Application PID: `3062501`
- Start: `2026-08-01 21:32:43 EDT`
- Restart count: `0`
- Local health: HTTP 200
- Public health: HTTP 200 at `https://vibe-hackathon-dev.ggg.ad/api/health`
- Active release: the C.6 release above
- Native chat allowlist: exactly `sub_QUPapzbr`
- Chatto: unchanged
- Viby: unchanged

Database remained unchanged by qualification and deployment:

| Data | Count |
|---|---:|
| Users | 5 |
| Submissions | 9 |
| Submission owners | 1 |
| Membership rows | 4 |
| Invitations | 3 |
| Chat rooms | 1 |
| Messages | 6 |
| Read states | 2 |
| Judges | 3 |
| Assignments | 15 |
| Human scores | 12 |
| Admin authorizations | 1 |
| Judge authorizations | 1 |
| Viby identity links | 2 |

Integrity is `ok`, foreign-key violations are empty, and the canonical SHA
remains `d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03`.

## Rollback

Rollback is ready: restore the previous immutable release and restart only
Vibe Hackathon, or disable native chat while preserving the additive schema and
pilot history. No Chatto or Viby rollback exists.

## Remaining human gate

The disposable browser qualification is complete. A post-deployment
authenticated walkthrough of My Projects, Overview, Team, Messages, Activity,
Preview, Status, Account, logout, and login requires an approved temporary
synthetic credential handoff. The retained C4R passwords were intentionally
destroyed; no production credential was recreated implicitly.

Chatto was unchanged.

Viby was unchanged.

CONDITIONAL GO — post-deployment authenticated walkthrough requires an approved synthetic credential handoff
