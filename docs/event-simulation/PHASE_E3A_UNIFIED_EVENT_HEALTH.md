# Phase E.3A — Unified Event Health and Attention Queue

Date: 2026-08-08 14:00 EDT
Status: deployed and isolated qualification complete; independent human
operator rehearsal remains pending.

## Purpose and boundary

E.3A adds one read-only event operations summary to the existing administrator
dashboard. It composes the existing submission-readiness, judging, results,
calibration, and publication projections. It does not create a competing event
lifecycle, change ranking formulas, change judging authorization, or add
infrastructure monitoring. Chatto and Viby are outside the change.

The dashboard remains administrator-only. The new read model and
`GET /api/admin/event-health` use the centralized administrator API wrapper;
participants, judges, signed-out requests, and untrusted clients do not receive
the data.

## Baseline and P1 disposition

Starting repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` on
`phase-vh-m6-viby-better-auth-session`. The E3 production release was
`a70edc...-e3-ops-20260808T151500Z`, with production database SHA
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`.

Recorded E3 P1 findings were classified as follows:

| finding | E.3A decision | evidence |
| --- | --- | --- |
| unified health across readiness, judging, results/calibration, publication | required and implemented | dashboard panel and server read model |
| actionable queue rules for stale drafts, ties, consensus, incomplete submissions, publication blockers | required and implemented | deterministic queue items with links and severity |
| unified event-level activity timeline | defer | existing safe audit panels remain; no new surveillance surface was needed for this bounded slice |
| assignment search/pagination beyond first 24 cards | defer | direct query-scoped inspector links remain available; broader pagination is a separate P1 slice |
| explicit submission judging freeze/unfreeze semantics | defer | existing D.1 action semantics and audit behavior are unchanged |
| safe recent-failure summary | defer | no reliable non-sensitive application failure source exists yet |
| workload trends/presence, configurable thresholds, unified exports, infrastructure monitoring | defer to P2/post-event | outside the event-health decision surface |

## Event phase

The authoritative `eventPhase()` helper remains the source of phase context:
submissions open, judging in progress, judging complete, or winners published.
The health panel combines that phase with the D.4 publication release state so
operators see “Results under review”, “Ready for publication”, “Published”, or
“Archived” without introducing another lifecycle.

## Health rules

The resolver evaluates rules in this order:

1. **Blocked** — an ownership problem, finalized submission without valid
   judging coverage, incomplete rankable results after judging closes, or an
   explicit publication blocker.
2. **Attention needed** — replacement work, stale drafts, missing evaluations,
   incomplete submissions, pending ties, pending consensus, or high variance.
3. **Ready to publish** — ranking is complete, tie/consensus review is clear,
   publication content is ready, and the event release is still private.
4. **Healthy** — no blocking or actionable condition is present.

The resolver is deterministic and receives only database-derived counts. It
does not infer presence, predict completion, normalize scores, or use AI.

Domains shown in the dashboard:

- **Submissions:** total, finalized, readiness gaps, and ownership problems.
- **Judging:** active judges, active assignments, completion, missing reviews,
  conflicts, and coverage.
- **Results:** ranked/unranked submissions, pending ties, and consensus count.
- **Publication:** finalists, awards, feedback, release state, and whether
  results are private or public.

Each domain has a short explanation and a link to the existing specialized
screen. Detailed tables remain in Judging, Results, Calibration, and
Publication.

## Attention queue

The queue uses three severities: **Blocker**, **Action required**, and **Watch**.
Every item contains a reason, affected project or judge, why it matters,
recommended action, age where available, and a direct navigation link.

Root-cause deduplication uses a stable issue key. A conflict/reassignment item
links to the affected judge’s inspector rather than asking an operator to search
through unrelated assignments. Consequence signals (unranked, tie, or
consensus) do not create another item when the same submission already has a
coverage root cause. Items are sorted by severity and operational category;
the panel shows the 20 highest-priority items and reports the exact remaining
count so a large synthetic event does not become an unreadable wall of alerts.

The “What should I do next?” summary is derived from the same sorted queue. It
shows total, blocker/action/watch counts, and the first item as “Most important”.

## UI review

The panel was added at the top of the existing admin dashboard overview, above
legacy metrics and quick links. It uses the incumbent dark professional token
system, semantic status color plus text (never color alone), compact domain
cards, deliberate links, visible focus rings, and responsive structural
collapse. At 1440px the four domains form a scan-friendly row; at 390px they
become stacked cards and the attention rows remain actionable without horizontal
scrolling.

Screenshots reviewed:

- [desktop event health](screenshots/e3a-admin-health-desktop.png)
- [mobile event health](screenshots/e3a-admin-health-mobile.png)

The panel intentionally preserves the existing dashboard rather than replacing
the established specialist tools. This follows the Impeccable Design Operate
guidance: scanability, consistent controls, semantic state language, keyboard
focus, and responsive structure outrank decorative density.

## Automated qualification

- event-health rule tests: blocked coverage, recusal/replacement attention,
  incomplete results, ties/variance/consensus, ready-to-publish, deduplication
  and severity order — passed;
- admin API route inventory updated for the new protected GET handler — passed;
- full unit suite: **260 tests passed**;
- TypeScript: passed;
- production build: passed;
- new event-health handler ESLint: passed;
- `git diff --check`: passed;
- isolated source projection: 75 synthetic submissions, 260 active coverage
  assignments, 16 missing evaluations, 15 ties, 19 consensus signals, and a
  blocked overall state;
- event-health API: administrator 200; signed-out 401; participant 403;
- participant `/admin/dashboard`: redirected to the non-authorized admin entry;
- mobile Chromium at 390px: `scrollWidth === innerWidth`;
- source private notes are represented only as counts in this read model.

## Kentucky Vibes operator rehearsal environment

A fresh writable clone was created from the immutable E3 snapshot:

`/opt/vibe-hackathon/instances/kentucky-vibes-e3a-20260808T174000Z/data/active.sqlite`

Source and clone SHA-256 before rehearsal:
`a546c5c2cc1903771c0fcdf1a2c0d3827b7fd7eaae38464963eb2beefde5137e`.
The clone was mode 0600, regular, non-symlinked, migrated twice with explicit
path-bound confirmations, and passed integrity, foreign-key, event identity,
duplicate ownership/membership/assignment, and unpublished-state checks.

The isolated service used application port 3035 and HTTPS loopback proxy 3445.
It used a separate Better Auth URL, host-only secure cookie, session namespace,
database, runtime configuration, and synthetic administrator. Production was
not stopped or restarted.

The operator walkthrough started at the normal login and admin dashboard. The
operator could see Event Health, identify the first blocker, follow an action
link to Judging, inspect the assignment context, and navigate through the
existing Results, Calibration, and Publication screens. No shell, SQLite query,
hand-built API request, or undocumented direct URL was required for the normal
read-only path. A synthetic assignment replacement was exercised through the
existing Judging UI; the isolated clone only was mutated.

The rehearsal was agent-operated rather than an independent external human
session. Human perception and support-burden findings therefore remain an
explicit launch gate; see `E3A_OPERATOR_REHEARSAL_FINDINGS.md`.

The final isolated database was checkpointed after the walkthrough and saved
as the immutable artifact
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3a-operator-rehearsal-20260808T175500Z.sqlite`.
Its SHA-256 is
`6d65ce07a7cd51baf2d4c35055352950628153640965c25d65cf95f7cef3d089`.
The artifact passed SQLite integrity and foreign-key checks. The E3A services
were stopped after capture and temporary E3A credential files were removed; a
future human session must regenerate a fresh synthetic admin credential.

## Production boundary and rollback

Production remained on the E3 release during isolated qualification. No
production database migration or data mutation is required by E.3A. If the
bounded application release is deployed, take a fresh verified database backup,
atomically publish the immutable release, restart only `vibe-hackathon.service`,
and verify the same canonical SHA, event identity, counts, integrity, foreign
keys, and HTTP 200. Application rollback points the active release back to the
E3 immutable release and restarts only Vibe Hackathon; it does not erase the
additive schema or audit history.

Chatto was unchanged. Viby was unchanged.

The bounded release was subsequently deployed without a schema migration:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-e3a-unified-health-20260808T175000Z`

Only `vibe-hackathon.service` was restarted. Before cutover the service was
PID `1760434`, restart count `0`, and the canonical SHA was
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`. After
cutover it is PID `2213115`, started `2026-08-08 13:54:04 EDT`, restart count
`0`; local and public health both returned HTTP 200. The signed-out event-health
API returned `401`, and the unauthenticated admin dashboard retained its
existing redirect. The canonical SHA, active event, real counts, integrity,
and foreign-key result were unchanged. The post-deploy signed-out
authorization checks intentionally produced one `admin_session_rejected` audit
event (audit rows 385 → 386); no user, submission, assignment, score, note,
publication, or authorization record changed. The E3 ops release remains the
application rollback target; rollback is an atomic symlink change followed by a
Vibe-only restart and health check.

## Remaining launch gates

- independent human operator rehearsal using the temporary Kentucky Vibes
  admin persona;
- decide whether assignment pagination, event activity timeline, and safe
  failure summary are needed before opening the real event;
- capture live event-day support burden and perceived latency.

## E3B bounded follow-up

E3B repeated the operator workflow against a fresh Kentucky Vibes clone and
found one HIGH safety issue: conflict attention links could be scoped only by
judge and open the wrong assignment. The queue now links to the exact active
assignment ID, and the Judging client gives that ID precedence over submission
or judge fallback filters. The fix passed the full 261-test suite, TypeScript,
ESLint, production build, and targeted desktop/mobile browser checks. A
duplicate reassignment returned a visible 409 without mutation.

The bounded release was deployed as
`a70edc28326108dfc84a69af303f680ceaa7f735-e3b-assignment-routing-20260808T200508Z`;
production restarted only Vibe Hackathon and retained canonical SHA
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`.
The post-rehearsal Kentucky artifact is
`kentucky-vibes-e3b-operator-rehearsal-20260808T200339Z.sqlite` with SHA
`8578e6f578425f489423f21bba84a9f0fe4a5a60c11a102dc0486381c05741d4`.

This was still agent-operated browser automation, not the approved
independent-human session. The human gate therefore remains open.
