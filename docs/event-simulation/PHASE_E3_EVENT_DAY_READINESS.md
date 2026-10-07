# Phase E.3 — Event-day readiness and operations

Date: 2026-08-08 11:10 EDT
Environment: isolated Kentucky Vibes only; production remained read-only
Disposition: **CONDITIONAL GO — human operator rehearsal remains required**

## Scope and safety boundary

E.3 audited the application as an event-day operating surface. It did not add
a new judging, results, publication, chat, authentication, or Viby feature.
The qualification target was a fresh writable clone of the synthetic Kentucky
Vibes environment. No production assignment, score, note, user, membership,
publication state, or Viby identity was changed. Chatto and Viby were not
modified.

The isolated service used HTTPS loopback:

| item | value |
| --- | --- |
| service | `kentucky-vibes-e3.service` |
| application | port 3033 |
| HTTPS qualification proxy | port 3443 |
| active event | `evt_kentucky_vibes` / `kentucky-vibes` |
| source | E2 qualified synthetic database clone |
| writable database | `/opt/vibe-hackathon/instances/kentucky-vibes-e3-20260808T143700Z/data/active.sqlite` |
| post-qualification snapshot | `/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3-event-day-final-20260808T151200Z.sqlite` |
| snapshot SHA-256 | `a546c5c2cc1903771c0fcdf1a2c0d3827b7fd7eaae38464963eb2beefde5137e` |

The E3 clone intentionally started from the richer E2 synthetic fixture rather
than the smaller immutable E1 artifact. This gave the walkthrough working
personas and operational cases while remaining synthetic and isolated.

## Baseline

Repository baseline:

- host: `paui`;
- repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`;
- branch: `phase-vh-m6-viby-better-auth-session`;
- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`;
- production release before E3: `a70edc28326108dfc84a69af303f680ceaa7f735-e2r-login-20260808T142000Z`;
- production PID: `1606838`, restart count `0`, HTTP 200;
- production database: `local.db`, mode `0600`, SHA-256
  `939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`;
- production SQLite integrity: `ok`; foreign-key violations: `0`; journal
  mode: WAL;
- production D.4 release state: `calculated`; qualification gate disabled and
  allowlist empty.

Read-only production counts at the beginning of the audit were 8 users, 8
Better Auth accounts, 26 sessions, 5 judges, 3 judge authorizations, 17
assignments, 14 scores, 2 identity links, 1 chat room, 6 chat messages, and
12 private-note-bearing score rows. The event remains `evt_vibe_2025`; the
application health endpoint reports its configured display branding as RSNA
2026. No E3 operation targeted this database.

The fresh E3 clone passed the additive migrations twice, integrity, foreign-key,
duplicate ownership/membership/assignment checks, and startup health. Its
pre-walkthrough scale was 85 submissions, 161 users, 35 judges, 282
assignments, 264 scores, 50 chat rooms, and 231 messages. The synthetic event
publication release remained `calculated` and no participant result was
published.

## Operating model and capability matrix

The following was verified against code and the isolated browser, rather than
assumed from roadmap documentation.

| lifecycle area | operator UI | server boundary/audit | recovery or escape hatch | E3 assessment |
| --- | --- | --- | --- | --- |
| event settings/freeze | `/admin/dashboard/event-settings` | admin session, same-origin admin API, audit | database snapshot/restore only for emergency | usable |
| people/access | `/admin/people` | Better Auth principal + admin authorization; account/invitation audits | account management API | usable; now has admin navigation |
| readiness | Dashboard `Readiness` / `/admin/dashboard/submission-readiness` | admin-only read model | edit-token workflow remains participant-owned | usable for inspection; no admin editing by design |
| judging health | `/admin/judging` | `withAdminApi`, event/assignment validation, lifecycle audits | immutable E3 snapshot | usable after P0 inspector fix |
| assignment operations | Judging assignment inspector | freeze/reopen/remove/conflict/reassign APIs, server actor ID, audit | reopen/reassign from UI | P0 actions exposed in UI |
| results/rankings | `/admin/results` | admin-only results API and ranking projection | publication remains separate | usable; tie review remains a separate screen |
| calibration/consensus | `/admin/calibration` and detail pages | admin-only API, reasoned consensus audits | reopen/flag with reason | usable |
| publication | `/admin/publication` and participant preview | admin-only lifecycle API; sanitized participant projection | withdraw/archive/revision; DB restore only for emergency | usable; global release remains calculated |
| event activity | Judging audit panel plus existing audit-backed pages | safe human-readable subset; no note/message body | database audit rows retained | partial; no unified event timeline yet |
| database backup/restore | no routine admin UI | operator scripts with typed confirmation | `npm run event:restore:current` | intentionally shell-only emergency path |
| Chatto/Viby | outside event operations | separate systems/configuration | do not operate from this app | unchanged |

Normal event operation requires no shell, SQLite, or hand-built API request in
the qualified participant/judge/admin flows. Shell remains an explicit
emergency escape hatch for database restore, service isolation, and artifact
inspection; it is not a routine event-day action.

## P0 changes implemented

### 1. Administrator navigation

The dashboard and People page previously rendered the public navigation variant,
so an organizer who landed on `/admin/dashboard` could not reach Judging,
Results, Calibration, Publication, or Settings without knowing deep links.
`NavPublic` now accepts a bounded `variant` prop and these admin surfaces render
the existing admin navigation. Desktop and mobile menus show the same links.

### 2. Judging assignment operations

The server already supported `set_conflict` and `reassign`, but the command
center inspector did not expose them. The inspector now provides:

- conflict status (`clear`, `declared`, `recused`, `withdrawn`,
  `replacement_required`);
- replacement judge selection;
- deliberate replacement confirmation;
- direct `Open` links from attention items;
- query-scoped inspector selection for a submission/judge.

Recused/withdrawn/replacement-required assignments remain visible historically
but no longer count as active judging coverage or completion denominators. Their
records, scores, notes, and audit history are preserved.

## Event health model

The current command center health state is deterministic and conservative:

1. `Blocked` if any submission has no active clear assignment or an unresolved
   conflict.
2. `Complete` if every active clear assignment is submitted/frozen.
3. `Attention needed` if active clear assignments remain incomplete while the
   event is frozen or another outstanding condition exists.
4. `Healthy` when coverage exists and no outstanding condition is present.

The command center displays the denominators for required evaluations,
submitted/frozen evaluations, completion percentage, missing evaluations, judge
remaining work, and average evaluation time. Results, calibration, and
publication screens provide their own explainable summaries and remain separate
decision surfaces.

The E3 fixture correctly reported `Blocked`: 75 submissions, 260 active clear
assignments after recusal/replacement handling, 8 not-started, 7 draft, 223
submitted, 22 frozen, 15 missing, and 60 fully evaluated submissions. The
attention queue identified unresolved conflicts, under-covered submissions, and
judges with remaining work.

## Attention queue rules

Current rules are intentionally small and actionable:

- no judges assigned → danger;
- conflict/recusal/replacement required → danger;
- missing evaluations → warning;
- judge has remaining work and has not started → informational;
- each item names the project/judge and links back to a scoped command-center
  view.

The queue does not yet claim stale-draft, unresolved-tie, consensus, or
publication-blocker coverage. Those are documented P1 extensions rather than
invented alerts.

## Event-day simulation

Four deterministic artifacts were generated from the immutable synthetic base
with seed `20260802`; each passed integrity, foreign-key, duplicate-record, and
unpublished-state checks:

| scenario | artifact SHA-256 |
| --- | --- |
| healthy-event | `2278ea16a14aa8f5fd60e601b779dfb836d2507f850fb4a66754e1128f98b5ae` |
| operations-stress | `5d14c2b1f34dd61b1bb639cccfc8f4ac36bff91ace87b0e43b1f5fc313eac1e6` |
| calibration-challenge | `be96b4770425899bd02bf170a46cdecdbb620083965fcbdfd5bb7f00b894ca1e` |
| publication-rehearsal | `c22f015cc80d313185abfec55ea777c0c3930d0935ca4e1b0a693c0633a9bb45` |

The healthy scenario was generated twice with the same seed and produced the
same SHA-256 `2278ea16a14aa8f5fd60e601b779dfb836d2507f850fb4a66754e1128f98b5ae`.
The publication rehearsal created only calculated, synthetic qualification
records and awards; it did not publish the event.

## Authenticated qualification

On the E3 HTTPS origin, synthetic personas completed these checks:

- administrator reached the normal landing page and navigated through
  Dashboard, Projects, People, Judging, Results, Calibration, Publication, and
  Settings from the UI;
- participant owner opened My Projects, workspace, Team, Messages, Activity,
  Preview, Submission, and pending Results; `/admin/judging` redirected to the
  non-authorized admin entry;
- high-workload judge opened assignments and Evaluation; Team Chat was absent,
  and an unassigned project returned a safe 404/denial;
- participant and judge admin mutations returned 403;
- an untrusted-origin admin mutation returned 403;
- invalid freeze of a non-submitted evaluation returned 409;
- freeze → reopen changed only the synthetic evaluation state and emitted safe
  audit activity;
- conflict → replacement required → replacement judge preserved the old
  assignment and created a new not-started assignment; audit activity appeared;
- direct attention links selected the relevant command-center submission and
  mobile width stayed at 390px with no horizontal overflow;
- mobile dashboard menu exposed all administrator sections.

Existing E0/E1/E2 Chromium coverage also covers native chat, 10 concurrent SSE
connections, exports, publication safety, and the broader D0–D4 regression
surface. The E3 browser pass used desktop and mobile Chromium against the
isolated HTTPS instance and captured representative screenshots under `/tmp`;
the retained synthetic-only examples are
[`admin navigation`](screenshots/e3-admin-navigation.png) and
[`mobile judging`](screenshots/e3-mobile-judging.png). No credentials or
private notes were retained in documentation.

## Performance and mobile findings

The existing realistic-scale E1 measurements remain the representative server
sample: participant routes 179–450 ms, judge routes 227–338 ms, admin routes
268–577 ms, exports HTTP 200, and SSE first frames 72–189 ms. No route exceeded
the initial local budgets, and E3 added no index/query change without measured
need. The E3 desktop and mobile pass found no horizontal overflow at 1440px or
390px. Compact admin controls below the ideal 44px touch target remain a P1
polish item. No human-event latency sample exists yet; the approved human
rehearsal must collect real perceived-delay and support-burden observations.

## Recovery and failure drills

- repeated freeze/reopen operations were state-checked and auditable;
- duplicate/replacement selection was server-validated (same judge and
  duplicate active assignment are rejected);
- stale/invalid freeze failed closed with 409;
- untrusted Origin failed closed with 403;
- participant/judge attempts to perform admin mutations failed with 403;
- the E3 database was stopped, WAL checkpointed through the online backup path,
  snapshotted, and independently validated before service shutdown.

The event service and TLS proxy are stopped after qualification. The current
production service was not stopped or restarted during synthetic qualification;
the separate documented application cutover occurred only after all isolated
checks passed.

## Findings and remaining gaps

### P0 complete

- admin landing navigation;
- UI access to conflict and replacement operations;
- recused coverage denominator correctness;
- direct attention links.

### P1 — fix before a broad human rehearsal or real event

- add a unified event-health summary that joins submission readiness, judging,
  results/calibration, and publication blockers in one view;
- extend the attention queue with explicit stale drafts, unresolved ties,
  pending consensus, incomplete submissions, and publication blockers, each
  with a tested rule and direct action;
- add a unified event-level activity timeline that humanizes existing safe audit
  events across teams, judges, results, and publication;
- add a bounded assignment search/pagination control beyond the first 24
  inspector cards;
- make submission-level judging freeze/unfreeze semantics and labels explicit;
- add an operator-facing recent-failure summary if a safe, non-sensitive source
  is available.

### P2 / post-event

- richer workload trends and presence signals;
- operator-configurable queue thresholds;
- one-click exports from the unified health view;
- infrastructure monitoring unrelated to event decisions.

## Qualification commands and results

- `npm test`: **254 passed**;
- `npx tsc --noEmit`: passed;
- changed-file ESLint: passed;
- `npm run build`: passed;
- `git diff --check`: passed;
- scenario validation: all four artifacts passed;
- same-seed determinism: passed;
- desktop Chromium: passed on admin, judge, and participant paths;
- mobile Chromium: passed with no horizontal page overflow on representative
  admin, judge, participant, results, and chat screens;
- production health/fingerprint before and after: unchanged.

## Production deployment and boundary

Starting and final repository HEAD are both
`a70edc28326108dfc84a69af303f680ceaa7f735` (the repository retains the
pre-existing dirty/untracked Phase D–E working tree; no source commit was
created during this audit).

After isolated qualification, the bounded navigation/inspector fix was deployed
as an immutable application overlay. No schema migration was required. The
release is:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-e3-ops-20260808T151500Z`

The rollback release is the prior E2R release:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-e2r-login-20260808T142000Z`

A fresh predeploy backup was created at
`/opt/vibe-hackathon/database-snapshots/current-event-e3-predeploy-20260808T151500Z.sqlite`.
Its normalized SHA-256 is
`175d642962b10edb4d6f0ca3602b35a9b4fbeaa90f39dabff014a13a5fd4d7c0`; integrity
was `ok` and foreign-key violations were `0`.

Only `vibe-hackathon.service` was restarted. The post-deploy PID is `1760434`,
restart count `0`, start time `2026-08-08 11:10:34 EDT`, and local/public
health is HTTP 200. Chatto, Viby, Cloudflare, and the Kentucky Vibes service
were not restarted by the production cutover.

The production database remains at SHA-256
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`, with PID
`1760434`, restart count `0`, and HTTP 200 after deployment. Read-only post-
deploy counts remain 8 users, 17 assignments, 14 scores, 10 submissions, 1
publication release in `calculated`, 1 chat room, and 6 chat messages. One
expected `admin_session_rejected` audit event was created by the post-deploy
signed-out authorization check, so audit rows are 386 (baseline 385); no
business record changed. Integrity is `ok` and the foreign-key check is empty.
The verified E2R snapshot remains the database rollback artifact; database restore is only
for a proven migration/integrity failure.

E3 does not publish real results and does not change the event publication
release. Kentucky Vibes remains a stopped, synthetic-only qualification
environment with its post-event snapshot preserved.

Application rollback is: atomically point `/opt/vibe-hackathon/current` back to
the E2R release, restart only `vibe-hackathon.service`, and verify local/public
HTTP 200 plus the same database fingerprint. Do not restore the database for an
application-only rollback.

## E.3A handoff

E.3A adds the unified Event Health panel and queue described in
`PHASE_E3A_UNIFIED_EVENT_HEALTH.md`. It combines existing projections without
changing lifecycle, score, authorization, Chatto, or Viby behavior. The fresh
Kentucky Vibes rehearsal clone used for this handoff was isolated on ports 3035
and 3445, with source SHA `a546c5c2cc1903771c0fcdf1a2c0d3827b7fd7eaae38464963eb2beefde5137e`.
The panel had no mobile overflow; event-health authorization returned 200 for
the synthetic administrator, 401 signed out, and 403 for a participant.

The independent human rehearsal remains pending. The agent-operated rehearsal
found zero routine shell/SQLite/API escape hatches but cannot substitute for
human support-burden and terminology observation.

E.3A was deployed as release
`a70edc28326108dfc84a69af303f680ceaa7f735-e3a-unified-health-20260808T175000Z`.
Post-deploy production PID is `2213115`, restart count `0`, and local/public
health is HTTP 200. The canonical database SHA remains
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; no real
event data changed. The isolated operator clone was stopped and preserved at
`kentucky-vibes-e3a-operator-rehearsal-20260808T175500Z.sqlite` with SHA
`6d65ce07a7cd51baf2d4c35055352950628153640965c25d65cf95f7cef3d089`.

## Disposition

The application can support a knowledgeable operator through the core event-day
flows without routine shell/SQLite/API intervention, and the bounded P0 gaps
found in that path are fixed and qualified. A real launch should still receive
an approved human event-day rehearsal and the P1 operational visibility work
above before being called fully event-ready.

**CONDITIONAL GO — human operator rehearsal remains pending; E.3A unified event health and actionable attention work are qualified in isolation.**
