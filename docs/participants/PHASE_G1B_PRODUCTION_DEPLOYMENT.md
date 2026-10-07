# Phase G.1B — Production Deployment of Start / Onboarding Redesign

Status: **GO — G.1 Start / Onboarding deployed and qualified**
Date: 2026-08-09
Production: `https://vibe-hackathon-dev.ggg.ad`

G.1B deployed the qualified onboarding application release. It did not change
the submission, claim, authentication, invitation, agent, judging, or
publication security models. No schema migration was required.

## 1. Baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Worktree: intentionally contains the previously qualified F0–F3/G1 overlay;
  no unrelated changes were added by deployment.
- Previous release: `a70edc28326108dfc84a69af303f680ceaa7f735-f3b-community-20260809T142500Z`
- Baseline PID: `1112475`; start `2026-08-09 10:24:42 EDT`; restart count `0`
- Local/public health before release: HTTP 200
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-release database SHA-256: `b78b0bb1a5d503a7b3bf60218abf174a0367414a080322284faa83845fe3cdc5`
- Database mode/owner: `0600 george:george`; integrity `ok`; foreign-key check empty
- Active event: `evt_vibe_2025` / `vibe-hackathon-2026`; deadline is open (`null`),
  not frozen.
- Publication state was inspected and was not changed by this release. No new
  result or award was published.

Baseline counts were: users 10, accounts 10, sessions 26, submissions 10,
teams 10, submission owners 2, active memberships 5, team roster rows 28,
claim transactions 1, profiles 2, public profiles 0, discoverable profiles 0,
Team Chat 1 room/6 messages, direct conversations/messages 0/0, Community 4
channels/0 messages/0 read states/0 reports, judges 3, assignments 17, and
human scores 14.

## 2. Backup and migration determination

A fresh verified backup was created before the release change:

`/opt/vibe-hackathon/backups/production-pre-g1b-20260809T171000Z.sqlite`

It is mode `0600`, 1,380,352 bytes, SHA-256
`b1822262ecc0a214e215d6be7d8b13601c12fb5b370b4f5240dc06e09450e4e1`. The
source canonical SHA was the baseline SHA above. The backup passed SQLite
integrity and foreign-key checks.

G.1 changed application routes/components/tests and did not add a migration.
The F0–F3 schema files in the production release and qualified worktree match;
therefore **G.1 requires no canonical schema migration**. No disposable or
production migration was run, and no database rows were provisioned.

## 3. Build and release

The exact qualified tree passed:

- focused G.1/G.1A onboarding and login-routing tests;
- full unit suite: **294 tests passed across 57 files**;
- Better Auth, claims, guest submission, resume, team, agent contract,
  finalization, F0–F3, Team Chat, DMs, Community, and authorization coverage;
- TypeScript, production build, changed-file ESLint, and `git diff --check`.

Changed-file lint was the release gate. The repository-wide lint command still
has the unrelated pre-existing failures documented in the qualification notes;
G.1B did not broaden scope into that cleanup.

The immutable release is:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-g1-start-onboarding-20260809T171600Z`

Build ID: `XPbWPEnj5JRyqJR3tiZOl`. The release excludes canonical databases,
clone databases, environment secrets, and credentials. Its build-local
`.next/node_modules` external-module symlink was retained so the production
runtime resolves `better-sqlite3` correctly.

## 4. Deployment and rollback evidence

The first package attempt was rejected by the health gate because that build
local symlink had been excluded. It returned local and public health 500 with
no database mutation. The service was immediately rolled back to F3B (PID
`1585383`), health returned to 200, and the package was corrected. This was an
application packaging rollback only; the database was never restored.

The corrected atomic deployment switched from F3B PID `1585383` to PID
`1588618`, started `2026-08-09 13:20:31 EDT`. The service is active/running with
`NRestarts=0`, a Ready log, and local/public health HTTP 200. Chatto, Viby, and
unrelated services were not restarted.

Application rollback remains the F3B immutable release above; schema/database
restore is not required for a copy or navigation rollback.

## 5. Anonymous production smoke

With a clean unauthenticated browser and the production event still open:

- `/` — 200;
- `/start` — 200, showing **Start your project**, Project and Team lead groups,
  badge helper text, **No account is required to begin**, and **Create project**;
- `/start/resume` — 200, showing Project ID, Edit token, private-link warning,
  and My Projects guidance;
- `/login?returnTo=%2Fclaim%2Fconfirm` — 200 and the normal Viby/password sign-in
  screen;
- `/messages` and `/community` — routed to the normal login boundary;
- anonymous `/account/projects` — work-first sign-in state, without project or
  account data exposure.

No production project, claim transaction, account, team membership, invitation,
or finalization was created. An invalid synthetic resume submission returned
HTTP 403 with the generic participant message “We could not verify those
submission details.” It added one bounded `submission_resume_failed` audit row
for the synthetic ID `sub_g1b_nonexistent`; no business table changed.

## 6. Claim-routing and participant regressions

The deployed code and focused regression coverage verify the G.1A fix:

```text
anonymous Save to My Projects → /login?returnTo=%2Fclaim%2Fconfirm
authenticated Save to My Projects → /claim/confirm
```

The login return-target allowlist accepts only the intended internal claim route.
No claim cookie or transaction was created during this production smoke.

No approved production participant credential was available for a mutation-safe
workspace pass, so no synthetic production account or project was created.
G.1A already qualified login, claim, My Projects, cross-device return, Team,
Team Chat, Preview, Submit, receipt, and mobile workspace behavior end to end
in the isolated open-event clone. The deployed build preserves that code path.

The agent prompt generator, complete-roster contract, hosted-update requirement,
no-agent-finalization rule, invitation safety, and finalization/receipt behavior
were covered by the release tests and G.1A hosted qualification; no production
draft was created merely to repeat them.

## 7. Mobile and privacy checks

At a 390×844 production viewport, `/start`, `/start/resume`, and the claim-login
route had `scrollWidth === clientWidth`; primary actions were reachable and
technical recovery details remained secondary. Production responses contained
no edit token, password, session cookie, Viby assertion, participant email, or
Better Auth identifier. Post-deploy service output contained only the known
Better Auth warning that GitHub client credentials are not configured; no
onboarding secret or project credential was logged.

## 8. Database preservation

Post-deploy canonical SHA-256 remained
`b78b0bb1a5d503a7b3bf60218abf174a0367414a080322284faa83845fe3cdc5`. Integrity
was `ok` and the foreign-key check was empty. Hashes and counts for submissions,
owners, memberships, roster, judges, assignments, scores, publication records,
Team Chat, DMs, Community, profiles, and Viby links are identical to the
verified pre-release backup. The only expected database delta is the one bounded
anonymous invalid-resume audit event described above.

The standing Kentucky Vibes review environment remains active and healthy at
`https://kentucky-vibes-f0b.ggg.ad`; its event, database, fixture, and tunnel
were not changed. No result-publication action occurred in G.1B; the existing
publication fixture state was preserved. Chatto and Viby remain unchanged.

## 9. Final disposition and next step

**GO — G.1 START / ONBOARDING DEPLOYED AND QUALIFIED.**

The positive guest-create, claim, hosted-agent, recovery, and workspace paths
were qualified in G.1A; the production release now serves the redesigned
participant entry and safe claim routing without changing business data.

**RECOMMEND G.2 — PARTICIPANT HOME / MY PROJECTS REFINEMENT.** Observe G.1
usage first, then refine the work-first home and lifecycle/readiness guidance
only if real participant behavior confirms the remaining G.0 friction.
