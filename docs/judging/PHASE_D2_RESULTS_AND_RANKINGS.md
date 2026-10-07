# Phase D.2 — Results, Rankings, Tie Review, and Finalist Selection

## Purpose

D.2 adds an administrator-only Results surface at `/admin/results`. It is a
review and publication layer over D.1 judge evidence; it does not rewrite
scores, assignments, participant workspaces, or native chat.

## Ranking policy

The Results projection is intentionally narrower than the existing public
ranking helper:

1. Only submissions in the active event are considered.
2. An assignment counts only when its operational state is `active` and its
   conflict state is `clear`. Removed, superseded, declared, recused,
   withdrawn, and replacement-required assignments are excluded.
3. An evaluation counts only when its D.1 lifecycle is `submitted` or
   `frozen`. Draft, reopened, and not-started evaluations never contribute a
   score.
4. A submission is ranked only when every active, clear assignment has a
   complete submitted/frozen scorecard. Incomplete submissions remain visible
   but unranked.
5. Each judge's overall score is the arithmetic mean of the eight 1–10 rubric
   criteria multiplied by ten, producing a 0–100 score.
6. Submission average, median, population standard deviation, high, and low
   are calculated from those judge-level scores. Scores are rounded to two
   decimal places for display and tie comparison.
7. Rank uses competition ranking: equal rounded averages share a rank and the
   next rank skips the size of the tie group.

Every row exposes the review denominator (`completed / required`) and the
detail page exposes criterion averages, minimums, maximums, and variance. No
AI or audience-vote value is blended into this D.2 human judging table.

Summary denominators are explicit: `Ranked` is the number of complete panels,
`Incomplete` is the remainder of event submissions, `Average score` and
`Median score` use ranked submission averages, `Tie reviews` counts detected
groups without a resolved review, and `Judges completed` counts unique judges
with at least one counted submitted/frozen evaluation.

## Ties and review

Equal ranked averages create a deterministic tie key. A tie remains `pending`
until an administrator records a rationale on the dedicated `/admin/results/ties/:tieKey`
page. Resolving a tie does not alter judge scores or automatically reorder the
projects. Tie review records contain only project IDs, the comparison score,
the administrator rationale, actor, and timestamps; private notes are never
copied.

## Decisions and publication

Finalist selection, award assignment, and publication are separate operations:

`Calculated → Reviewed → Published`

- `Calculated` is the default projection state.
- Migration initializes an event with an existing `winnersPublishedAt` as
  `Published`; otherwise it starts at `Calculated`.
- `Reviewed` is an explicit administrator action after operational review.
- `Published` requires at least one explicitly assigned winner and updates the
  existing event publication timestamp. No score rank becomes public merely
  because it calculated successfully.

Finalists and winners are additive decision records. Removing one preserves
the previous row as history (`removed`). Winner categories are single-active
slots: Grand Prize, Runner-up, Honorable Mention, and a labelled Custom award.

## Authorization and audit

The page and every Results API/export are protected by the centralized
administrator principal. Judges, participants, and signed-out users receive
the existing administrator denial/redirect behavior. Mutations require the
existing same-origin protection. Actor identity comes from the verified admin
session; browser payloads cannot choose an actor.

Audited operations:

- tie reviewed;
- finalist added/removed;
- winner assigned/removed;
- results published/unpublished.

Audit metadata contains safe IDs, state, operation, reason, and actor. It never
contains private notes, score comments, passwords, cookies, Viby assertions,
edit tokens, or chat bodies.

## Export

`/api/admin/results/export?format=csv` and `format=json` are authenticated
administrator exports. They include reproducible ranking rows and decision
state only; private notes are excluded. Printable PDF remains a future
placeholder.

## UI and responsive behavior

The Results page uses the D.1 operate vocabulary: restrained surfaces, compact
metrics, clear state chips, a readable table on desktop, and stacked result
cards on mobile. Result detail keeps evidence and decision state side by side;
tie review uses a two-project comparison that collapses to one column. Status
is never communicated by color alone, controls retain visible focus states,
and mobile controls remain touch-sized.

## D.3 hooks

The decision tables leave bounded extension points for calibration, ranking
history snapshots, side-by-side comparisons, and feedback release. None of
those future capabilities can mutate the D.2 source score or bypass the
administrator boundary.

## Qualification boundary

The migration and unit qualification run against disposable databases. No
canonical migration, production deployment, participant-visible score release,
Chatto change, or Viby change is part of this phase unless separately approved.
