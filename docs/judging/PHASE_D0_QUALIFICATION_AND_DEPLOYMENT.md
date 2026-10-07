# Phase D.0Q — Unified Judge Workspace Qualification and Deployment

## Disposition

GO — UNIFIED JUDGE WORKSPACE DEPLOYED AND QUALIFIED

## Baseline and scope

- Host: `paui` (the repository host; production listener is local port 3000).
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
- Branch: `phase-vh-m6-viby-better-auth-session`.
- Starting and final repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`.
- Worktree remained dirty with the previously authorized Phase C changes and
  the D.0 workspace changes; no unrelated worktree changes were discarded.
- Previous release:
  `/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-c6-participant-experience-20260802T013000Z`.
- Deployed release:
  `/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-d0-unified-judge-workspace-20260802T172935Z`.
- Deployed application commit: `a70edc28326108dfc84a69af303f680ceaa7f735`.
- Deployed PID: `1623967`; start `2026-08-02 13:29:35 EDT`; systemd user
  service restart count was 0 after the cutover.
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`.
- Pre-qualification and post-qualification SHA-256:
  `d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03`.
- Local and public `/api/health`: HTTP 200 with database `ok`.
- Active event: `evt_vibe_2025` / RSNA 2026.
- Native chat remains enabled only for `sub_QUPapzbr`.
- Chatto and Viby were unchanged.

The phase introduced no database schema or migration. The disposable browser
fixture used a separate database created from the canonical schema. Therefore no
canonical migration was run and no production data migration was required.

## Reused architecture and authorization

The judge workspace reuses `components/SubmissionWorkspaceShell.tsx` and the
existing participant-safe data loader in `lib/submission-workspace.ts`. Judge
routes are:

```text
/judge/dashboard
/judge/projects/:submissionId
/judge/projects/:submissionId/team
/judge/projects/:submissionId/activity
/judge/projects/:submissionId/preview
/judge/projects/:submissionId/submission
/judge/projects/:submissionId/evaluation
```

`lib/judge-workspace.ts` supplies `requireJudgeWorkspace()`. It resolves the
Better Auth judge principal for the current event, checks an exact
`judge_assignments` row, checks event scope, and only then loads the shared
participant-safe workspace context. A judge receives no submission membership,
no participant chat access, and no implicit administrator access.

The Evaluation route embeds the existing `ScoringClient`; its rubric, score
ranges, save/complete behavior, validation, dirty-state navigation, keyboard
shortcuts, and private notes remain the source of truth. The Team, Activity,
Preview, and Submission views are read-only. The participant shell has no
Evaluation tab, and the judge shell has no Messages tab.

## Disposable authenticated fixture

The fixture is defined in `tests/playwright/judge-workspace-d0.spec.ts` and is
run with `playwright.d0.config.ts` against
`/tmp/vibe-hackathon-d0-judge-playwright.db`. It created only `.invalid`
identities:

- Judge A and Judge B, with separate event-scoped judge authorizations;
- a participant-only account;
- an admin-only account;
- one Judge-A-only submission, one Judge-B-only submission, and one unassigned
  submission;
- one existing Judge-A score with a synthetic private note.

The fixture seed is namespace-cleaning and idempotent across desktop/mobile
projects. No fixture account, session, score, or assignment was written to the
canonical database.

## Browser qualification

Dedicated D.0Q Chromium: **4/4 passed** (desktop and mobile).

The tests verified:

- Judge A sees only Judge A's assignment on the dashboard;
- Judge B-only and unassigned projects are absent;
- all six judge workspace tabs load and refresh;
- Team, Activity, Preview, and Submission remain read-only;
- Evaluation loads the existing score and private note;
- private-note edit/save works and remains judge-scoped;
- `/judge/submissions/:submissionId` redirects to the assignment-scoped
  Evaluation route;
- another judge's project returns a generic 404 and the score API returns 403;
- participants cannot access Evaluation;
- admin-only users cannot access judge workspace routes;
- Judge B cannot access Judge A's assignment;
- Team Chat is absent from judge navigation;
- desktop and mobile screenshots contain no credentials or tokens.

Screenshots reviewed with the Impeccable Design criteria:

- [desktop assigned-project dashboard](screenshots/d0-desktop-chromium-dashboard.png)
- [desktop unified workspace](screenshots/d0-desktop-chromium-workspace.png)
- [mobile assigned-project dashboard](screenshots/d0-mobile-chromium-dashboard.png)
- [mobile unified workspace](screenshots/d0-mobile-chromium-workspace.png)

The screenshot review found one concrete mobile defect in the assignment card:
the action column compressed project text into one-word lines. The bounded fix
stacks the assignment header and actions at the mobile breakpoint. The workspace
capture was also corrected to occur on the authorized project after the negative
authorization check.

## Regression and quality results

- Full unit suite: **237/237 tests passed across 40 files**. Existing isolated
  migration/operator scripts emit expected safety warnings but the suite exits
  successfully.
- Phase B authenticated Chromium: **28/28 passed** (desktop and mobile).
- C.1 submission onboarding Chromium: **4/4 passed** (desktop and mobile).
- Native-chat Chromium: **4/4 passed** (desktop and mobile); revocation and
  participant chat behavior remain unchanged.
- TypeScript: passed.
- Production build: passed; generated manifests include all six new judge routes.
- Changed-file ESLint: 0 errors. Two existing warnings remain in the reused
  scorecard (`handleComplete` hook dependency and `<img>` optimization).
- `git diff --check`: passed.
- WebKit: unavailable on this host because `libmanette-0.2.so.0` and
  `libhyphen.so.0` are not installed. This is the documented non-blocking host
  limitation.
- Canonical database fingerprint before and after all qualification: unchanged.
- Canonical integrity check: `ok`; foreign-key violations: 0.

The production unauthenticated probes also remained correctly protected:
`/judge/dashboard` redirects to `session_required`, and direct judge workspace
routes redirect to generic login with an allowlisted return path.

## Production data and backup

The pre-deployment canonical counts were unchanged by this no-schema-change
release:

| Data | Count |
|---|---:|
| Users | 5 |
| Submissions | 9 |
| Submission owners | 1 |
| Membership rows | 4 |
| Invitations | 3 |
| Chat rooms | 1 |
| Chat messages | 6 |
| Read states | 2 |
| Judges | 3 |
| Assignments | 15 |
| Human scores | 12 |
| Admin authorizations | 1 |
| Judge authorizations | 1 |
| Viby identity links | 2 |

A new verified backup was created without touching prior backups:

`/opt/vibe-hackathon/backups/local.db.pre-d0-judge-20260802T172440Z.sqlite`

- mode `0600`;
- SQLite integrity: `ok`;
- foreign-key violations: 0;
- SHA-256:
  `d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03`.

No assignment, score, judge authorization, administrator authorization,
identity link, submission ownership, chat room, or message rows changed.

## Deployment

The release was copied from the qualified worktree using an immutable release
directory and an atomic `/opt/vibe-hackathon/current` symlink switch. The
artifact includes the completed production build and dependency tree, and
excludes env files, canonical/test databases, Playwright artifacts, and local
credential files.

Only `systemctl --user restart vibe-hackathon.service` was run. Chatto, Viby,
Cloudflare, and unrelated services were not restarted or modified.

Production configuration after cutover:

```text
VIBE_NATIVE_TEAM_CHAT_ENABLED=true
VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr
```

The active release reports HTTP 200 locally and publicly, runs PID `1623967`,
and has no restart loop. The final artifact audit confirmed that tests,
Playwright configs, env files, databases, and local credential material are
absent from the runtime release. The canonical database remains healthy.

## Live production qualification status

The operator confirmed the final live qualification disposition. No production
judge credential was printed, created, reset, or stored by this deployment, and
no production score was changed.

## Rollback

Rollback is application-only: restore the previous immutable C.6 release and
restart only `vibe-hackathon.service`. If the workspace has a blocking defect,
disable native chat while preserving its additive tables and synthetic pilot.
Database restore is reserved for migration or integrity failure; no migration
was required for D.0Q. There is no Chatto or Viby rollback.

Chatto was unchanged.

Viby was unchanged.

GO — UNIFIED JUDGE WORKSPACE DEPLOYED AND QUALIFIED
