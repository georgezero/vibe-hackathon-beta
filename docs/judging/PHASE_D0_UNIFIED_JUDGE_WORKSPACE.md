# Phase D.0 — Unified Judge Workspace

## Disposition

GO — UNIFIED JUDGE WORKSPACE DEPLOYED AND QUALIFIED

## Baseline

- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Production release before deployment: `a70edc28326108dfc84a69af303f680ceaa7f735-c6-participant-experience-20260802T013000Z`
- Deployed release: `a70edc28326108dfc84a69af303f680ceaa7f735-d0-unified-judge-workspace-20260802T172935Z`
- Deployed application commit: `a70edc28326108dfc84a69af303f680ceaa7f735` (repository HEAD remained unchanged; the release contains the qualified worktree build).
- Deployed PID: `1623967`; start `2026-08-02 13:29:35 EDT`; restart count 0.
- Production health: local and public `/api/health` HTTP 200; database `ok`.
- Canonical database and native-chat allowlist were not changed by this phase.
- Native chat remains limited to `sub_QUPapzbr`.

The existing participant workspace was the visual and interaction baseline. Chatto
and Viby were not modified.

## Before and after

Previously, judges entered `/judge/dashboard` and then a standalone
`/judge/submissions/:submissionId` scorecard. Participant project routes already
used the shared project shell under `/projects/:submissionId`.

The new judge entry is assignment-scoped:

```text
/judge/dashboard
    ↓ exact judge assignment
/judge/projects/:submissionId
    Overview · Team · Activity · Preview · Submission · Evaluation
```

The participant shell remains:

```text
/projects/:submissionId
    Overview · Team · Messages · Activity · Preview · Submission
```

The old `/judge/submissions/:submissionId` route remains available for
compatibility. Dashboard actions now lead to the unified workspace; the
Evaluation tab embeds the existing scorecard rather than duplicating it.

## Authorization boundary

Judge access is not derived from participant membership and does not grant team
chat access.

Every judge workspace route calls `requireJudgeWorkspace()` in
`lib/judge-workspace.ts`. That resolver:

1. resolves the Better Auth application principal through the existing
   `resolveJudgePrincipal()` event-scoped authorization path;
2. verifies an exact `judge_assignments` row for the current judge and
   submission;
3. verifies the submission belongs to the current judging event;
4. loads only the existing participant-safe workspace data.

The presentation membership object used by the shared shell is explicitly
synthetic context, never a database authorization row. No `submission_memberships`
row is created for a judge. Admin and judge roles do not authorize private team
messages, SSE, polling, unread state, or participant membership operations.

Participants cannot reach Evaluation through the participant shell. Judges have
no Messages tab and no judge workspace message route; direct participant chat
routes still enforce active explicit submission membership.

Generic login return destinations now allow `/judge/projects/:submissionId/*`
through the existing internal-path allowlist. External URLs remain rejected.

## Reused components and data

- `components/SubmissionWorkspaceShell.tsx` now renders participant and judge
  tab sets from one shell. The header, spacing, responsive tab strip, role/state
  badges, and navigation treatment remain shared.
- `lib/submission-workspace.ts` exposes
  `loadSubmissionWorkspaceContext()` so participant and assignment-scoped judge
  pages share readiness, roster, event, deadline, and participant-safe activity
  loading.
- `components/JudgeWorkspaceViews.tsx` supplies judge read-only views for
  Overview, Team, Activity, Preview, and Submission.
- `app/judge/projects/:submissionId/evaluation/page.tsx` embeds the existing
  `ScoringClient` and its current score/keyboard/save behavior.
- Private judge notes continue to use the existing `human_scores.private_notes`
  field. No second notes table, sharing policy, or score model was introduced.

## Judge workspace surfaces

### Overview

Shows project context, team, institution, assignment state, submission state,
existing readiness checks, recent participant-safe activity, and a direct
Evaluation action. It never shows private chat or audit payloads.

### Team

Read-only roster and authenticated-account summaries. Badge information is
represented only as completion state; badge numbers, email addresses, invitation
tokens, and membership controls are not shown.

### Activity

Reuses the participant-safe activity projection and timeline treatment. Login,
authorization, chat, and low-level audit events remain excluded.

### Preview

Reuses the hosted submission fields and artifact links without an Edit-token URL.

### Submission

Renames the participant Status tab and provides a judge-specific read-only
summary of completion, readiness, submission state, assignment, evaluation, and
deadline. The legacy `/status` route remains as a compatibility path while the
canonical shell link is `/submission`.

### Evaluation

The existing eight-category scorecard, recommendation, save/complete actions,
dirty-navigation protection, keyboard shortcuts, and private notes remain the
source of truth. The page adds only workspace framing and keeps notes explicitly
private to the current judge record. Its small Evaluation history panel reports
the existing current score record and last-saved timestamp; no historical score
revision model exists in the current schema, so no new history table was added.

## Assigned Projects

`app/judge/dashboard/page.tsx` keeps the existing assignment query and score
calculations, but cards now offer:

- `Review project` — opens the unified read-only workspace;
- `Start evaluation` / `Continue evaluation` — opens the scorecard tab;
- existing demo, GitHub, and AI-review links.

The existing keyboard selection behavior is preserved and now opens the unified
workspace route.

## Design review

This is an Operate surface inside the established Vibe Hackathon visual world:
the same semantic CSS variables, headline typography, panel spacing, badges,
timeline, responsive tab behavior, and mobile touch targets are retained.
Judge-specific meaning is carried by restrained `Assigned project`, `Read-only`,
and evaluation-state badges rather than a separate visual language. The
Evaluation heading uses the existing workspace surface, with no new color system,
chat visual language, or nested navigation shell.

Mobile behavior inherits the shared horizontally scrollable workspace tabs and
single-column panels. Team controls are absent for judges, and the evaluation
scorecard retains its existing responsive layout.

## Validation

Completed during implementation:

- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed (`npm run build`), including the new judge routes.
- Changed-file ESLint: passed with the two existing scorecard warnings (React
  hook dependency and Next image optimization); no errors.
- Impeccable detector: returned no deterministic findings.
- Unit suite: 237 tests passed across 40 files. The suite emitted unrelated
  pre-existing migration/operator warnings but completed successfully.
- Dedicated authenticated D0 fixture: 4/4 Chromium tests passed (desktop and
  mobile). It covered assignment-only dashboard results, all six judge tabs,
  private-note save/reload, legacy redirect, server-side denial of another
  judge's project and score API, participant Evaluation denial, admin-only
  denial, and Judge B isolation. The disposable fixture used `.invalid`
  identities and did not touch the canonical database.
- Native-chat regression: 4/4 Chromium tests passed (desktop and mobile); the
  judge shell never exposed Team Chat.
- C.1 onboarding regression: 4/4 Chromium tests passed (desktop and mobile).
- Phase B Chromium qualification: 28/28 tests passed (desktop and mobile).
- WebKit remains unavailable on this host because `libmanette-0.2.so.0` and
  `libhyphen.so.0` are missing, matching the existing documented limitation.
- `git diff --check`: run as part of the release gate.

The operator confirmed the final live qualification disposition. No production
judge credentials were created or recorded by this deployment. Unauthenticated
production route probes correctly redirect to the existing judge/login guards.

## Future-ready boundaries (not implemented)

The workspace leaves room for AI-assisted judging, submission comparison,
side-by-side review, judge discussion, consensus scoring, and conflict-of-
interest handling. None of those capabilities or data paths were added here.

## Explicit status

Chatto was unchanged.

Viby was unchanged.
