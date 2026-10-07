# Phase D.3 — Calibration, Consensus Review, and Score Quality

## Purpose

D.3 is an administrator-only, advisory layer over the D.1/D.2 judging records.
It makes disagreement and panel consistency visible without changing a score,
normalizing a judge, or selecting a winner automatically.

The primary route is `/admin/calibration`, with detail routes for a submission,
a judge, and a side-by-side project comparison. Judges and participants receive
the same server-side denial as other administrator routes.

## Evidence and formulas

Only evaluation records in `submitted` or `frozen` state on active, clear,
non-superseded assignments are included. Draft, removed, superseded, and
recused records are excluded. The overall score is the existing eight-criterion
human score average multiplied by ten (0–100).

- Population variance: `sum((score - mean)^2) / n`.
- Spread: `maximum - minimum`.
- Median: middle score (mean of the two middle scores for an even panel).
- Panel deviation: absolute distance from the submission's completed-panel mean.
- A high-disagreement project meets either the configured overall-variance or
  criterion-variance threshold and has the minimum panel size.
- An outlier is advisory when an overall deviation reaches the configured
  difference or a criterion's squared difference reaches the criterion
  variance threshold. It is labelled “Statistical outlier”, never “wrong”.

Default thresholds are overall variance `64` (an 8-point standard deviation),
criterion variance `4` on the 1–10 rubric, overall difference `20` points, and
minimum panel size `2`. Administrators may update these event-scoped values;
the change is audited. No threshold changes modify source scores.

Judge labels are descriptive: Well calibrated, Slightly lenient, Slightly
strict, Needs review, or Insufficient data. They are not a correction or a
ranking input.

## Consensus workflow

Consensus is independently controlled for each project:

`Not required → Suggested → In review → Consensus complete`

An administrator can flag a review or reopen a completed review with a bounded
reason. Discussion notes are capped, contain no private judge-note contents, and
are audited by length only. The detail view exposes criterion aggregates,
judge scores, timestamps, and private-note counts, never private note text.

Finalist review is a filtered view of the same evidence. “Ready for award” is
only a descriptive indicator when a finalist is complete, has consensus marked
complete, and has no unresolved tie. D.3 does not assign awards or edit scores.

## Data model and audit

`calibration_thresholds` stores event-level detection settings. The
`calibration_consensus_reviews` table stores the organizer's review state and a
bounded discussion summary. Both are additive, idempotently migrated by
`npm run db:migrate:calibration`; existing scores, assignments, notes, results,
and publication state remain the source of truth.

Audited operations include consensus start, completion, reopen, flag, note
addition, and threshold changes. Audit metadata contains safe identifiers,
state transitions, bounded reasons, and note length only. It never contains
passwords, sessions, Viby assertions, edit tokens, message bodies, or private
notes.

## Design and accessibility

The calibration surface uses the existing admin design tokens: a compact metric
rail, evidence-first tables, restrained status chips, and a calm two-column
detail view. On mobile, tables become labelled cards, filters wrap, and compare
panels stack. Keyboard focus, visible focus rings, 44px action targets, and
color-independent labels are retained. Visual signals are explanatory rather
than alarmist.

## Future D.5 hooks

The read model leaves room for future, human-reviewed assistance to summarize
evaluation evidence, disagreement, and discussion prompts. Any future AI may
summarize or highlight evidence; it must never write scores, normalize judges,
or select winners.
