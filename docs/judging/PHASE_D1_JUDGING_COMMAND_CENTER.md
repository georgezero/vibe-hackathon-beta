# Phase D.1 — Judging Operations Command Center

## Disposition

GO — JUDGING COMMAND CENTER DEPLOYED AND QUALIFIED

## Purpose

`/admin/judging` is the organizer cockpit for the active event. It reuses the
existing assignment, score, judge, submission, and audit records. It does not
change rubric criteria, score calculation, participant authorization, judge
authorization, or native chat.

## Architecture

The page is an authenticated admin-only server route:

```text
Better Auth / existing organizer session
            ↓
     requireAdminSession()
            ↓
  /admin/judging server page
            ↓
  getJudgingCommandCenterData()
            ↓
  JudgingCommandCenterClient
```

The data projection is intentionally read-only from the page. Mutations use
`POST /api/admin/judging`, protected by `withAdminApi("POST /api/admin/judging")`
and the existing strict same-origin policy.

The additive migration `scripts/migrate-judging-operations.ts` creates:

- `judging_assignment_states`: active, superseded, removed, and conflict state;
- `judging_evaluation_states`: not started, draft, submitted, frozen, and
  reopened state.

Historical assignments are retained. Reassignment creates a new assignment and
marks the prior assignment superseded. Historical scores and private notes are
never deleted.

## Organizer workflows

The command center provides:

- summary metrics and completion progress;
- open/frozen event context and deadline;
- judge workload rows with completed, draft, remaining, and activity state;
- submission review coverage and missing evaluations;
- a needs-attention queue;
- searchable/filterable submission coverage;
- an assignment inspector with safe private-note presence (never note text);
- freeze evaluation, reopen with a reason, remove assignment, and conflict
  state operations;
- a safe human-readable judging activity stream.

The event-wide freeze remains the existing Event Settings control. The current
`freeze_submission` operation freezes the active evaluation rows for the
submission; a separate durable submission-judging-freeze record and atomic
bulk-unfreeze operation remain future hardening work.

## Authorization and audit

Only an authorized administrator can load `/admin/judging` or call its mutation
API. Judges and participants do not receive this route through navigation and
are denied server-side by the existing admin principal resolver.

Every operation is recorded through `logAdminAudit` using safe identifiers:

- `admin_judging_evaluation_frozen`;
- `admin_judging_evaluation_reopened`;
- `admin_judging_assignment_reassigned`;
- `admin_judging_assignment_removed`;
- `admin_judging_assignment_conflict_updated`.

Reasons and entity IDs are bounded and sanitized. Score values, private note
contents, credentials, cookies, and tokens are not written to these summaries.

## Evaluation lifecycle

The operational projection uses:

```text
Not started → Draft → Submitted → Frozen
                         ↘ Reopened (admin reason required)
```

`completed` remains the source field used by existing scoring and ranking code;
the lifecycle table is an additive operational lock/state layer. A frozen
evaluation is rejected by the judge score endpoint until an administrator
explicitly reopens it.

## Responsive design

The command center uses a compact metric grid, one dominant progress card, a
needs-attention queue, and progressively disclosed tables. On narrow screens,
rows become stacked cards, filters wrap, controls retain large touch targets,
and the assignment inspector becomes a single-column panel. Status is always
communicated with text as well as color.

## Qualification

Completed locally:

- disposable migration applied twice;
- foreign-key and integrity checks passed;
- TypeScript passed;
- production build passed;
- changed-file ESLint passed with no errors;
- Impeccable detector reported no deterministic target issues.

Still required before deployment:

- disposable authenticated admin, judge, and participant browser checks;
- direct participant/judge denial checks for `/admin/judging` and its API;
- freeze/reopen/reassign audit qualification;
- canonical backup and additive migration approval;
- desktop/mobile screenshot review in the configured admin session.

Those gates were completed for the canonical migration, disposable browser
qualification, and synthetic production qualification in
`PHASE_D1_QUALIFICATION_AND_DEPLOYMENT.md` and
`PHASE_D1_SYNTHETIC_PRODUCTION_QUALIFICATION.md`. A replacement transaction
defect found during qualification was corrected before the final release: the
SQLite transaction callback is synchronous and administrator actor IDs are now
retained in safe judging-operation audit rows. No real assignment, score, or
note was changed.

## Future D.2 hooks

The projection leaves clean extension points for rankings, judge calibration,
participant feedback release, and AI-assisted judging. None are implemented in
D.1, and no ranking or score formula was changed.

Chatto and Viby are unchanged.
