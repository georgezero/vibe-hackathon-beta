# Phase D.4 — Awards, Participant Feedback, and Results Publication

## Purpose

D.4 is the explicit release boundary between internal judging and participant-visible
outcomes. Ranking, calibration, consensus, scorecards, private notes, and judge
identity remain internal systems. A score or winner record never becomes visible by
itself.

The administrator control plane is `/admin/publication`. An active workspace member
uses `/projects/:submissionId/results` to see the result for that submission. The
participant route is protected by the same Better Auth session and explicit active
submission membership resolver used by the rest of the workspace.

## Publication lifecycle

Each active event has one `publication_releases` row:

```text
calculated → reviewed → approved → published → archived
```

Every transition is an administrator-only, same-origin API operation and creates a
safe audit record. There is no automatic transition. Withdrawal returns a published
or archived release to `reviewed`, clears the event's public-winner timestamp, and
creates an audit event. Archive is a terminal presentation state for the current
release; a later release requires an explicit operational decision.

The migration is additive and idempotent. Existing D.2 publication state remains in
its original table, and active D.2 winners are copied into publication awards as
private preparation data. Every new D.4 release starts in `calculated`, even when a
legacy event timestamp or D.2 state says published: an administrator must explicitly
review, approve, and publish the D.4 participant projection. No score, assignment,
note, ownership, authorization, or chat row is deleted or rewritten.

`publication_revisions` records each participant-visible payload revision (release
state, mode, score visibility, actor, reason, and timestamp). Changing visibility
options after publication requires an explicit confirmation and creates a new
revision. The administrator preview and participant results both consume the same
sanitized projection function; private notes and judge-specific data are never part
of that projection.

The release is intentionally event-scoped in D.4. D.4R adds a separate,
server-owned qualification boundary for one exact synthetic submission. The
qualification release and revisions are submission-scoped and cannot update the
event release or `events.winners_published_at`. Qualification is disabled by
default, rejects malformed/empty/wildcard allowlists, and never treats a browser
submission ID as authorization. With the gate disabled, qualification fixtures are
excluded from normal ranking/publication data and their authorized members see the
existing Pending result state. With the gate enabled, only the exact allowlisted
fixture is included.

## Visibility matrix

| Data | Calculated / reviewed / approved | Published / archived |
| --- | --- | --- |
| Project identity and workspace | Existing workspace policy | Existing workspace policy |
| Awards and finalist status | Administrator preview only | Active workspace members |
| Overall and criterion averages | Administrator preview only | Only when `show_scores` is enabled |
| Releasable comments | Administrator preview only | Only after feedback is released and the mode permits feedback |
| Administrator summary | Administrator preview only | Only after feedback is released and the mode permits feedback |
| Private judge notes | Never | Never |
| Judge identities and judge-specific scores | Never | Never |
| Calibration, consensus, and audit details | Never | Never |
| Announcement | Draft administrator preview | Only after announcement status is published |

The administrator preview route renders the participant shape and applies the same
mode, score, feedback, and announcement gates. It is intentionally not a raw admin
detail view.

## Publication modes

The release mode is one of:

- `awards_only` — awards/finalist result only;
- `awards_feedback` — awards, configured score visibility, and released feedback;
- `feedback_later` — publish the result now and release feedback independently later;
- `everything` — awards, configured score visibility, and released feedback.

`show_scores` is an independent administrator choice. Feedback release is still
blocked until the release itself is published. Releasing a feedback record also
releases its participant-safe comments; withdrawing feedback withdraws those comments
without touching private judge notes.

## Award model

`publication_awards` stores explicit, auditable event awards. Supported labels are
Grand Prize, Runner-up, Honorable Mention, Innovation Award, Clinical Impact Award,
Technical Excellence, People's Choice, and a bounded Custom category. Active category
and event/submission/category uniqueness prevents duplicate active awards. Removing an
award is a status transition, not a destructive delete.

Awards are independent of publication. An administrator can prepare, review, and
preview awards before the release is approved. Publication is the only point at which
participants can see them.

## Feedback model

Private judge notes remain in the existing judging storage and are never copied into
D.4. Participant-safe feedback consists of an optional administrator summary and
bounded releasable comments. Comments have their own draft/released/withdrawn state,
but the normal release operation keeps the parent feedback state authoritative. Text
is rendered as escaped paragraphs; no raw HTML or markdown execution is allowed.

## Announcements and exports

One event announcement can be drafted, published, or withdrawn. Qualification uses a
separate `(event, submission)` announcement row, so the synthetic workflow never
mutates the real event announcement. Participant rendering strips tags and treats
paragraphs as text. Admin CSV and JSON exports include only published release rows,
awards, scores allowed by the release, and feedback-release status. They never
include private notes, judge identities, invitation tokens, edit tokens, session
data, or audit payloads. Qualification fixtures are excluded when the gate is off.

## Authorization and audit

All publication mutations use `withAdminApi` and the reviewed admin API policy. The
server derives the actor from the signed organizer session, validates the active
event and submission, and rejects unsupported lifecycle transitions. Participant
results require an active owner or teammate membership. Judges, unrelated users, and
signed-out visitors cannot access the participant result route without that workspace
authorization.

Audited operations include publication review/approval/release/withdrawal/archive,
mode changes, award assignment/removal, feedback release/withdrawal, and announcement
updates. Audit metadata is allow-listed and contains identifiers, states, bounded
reasons, and timestamps only; message bodies, private notes, secrets, cookies, and
assertions are excluded.

## Future hooks

D.5 may add AI-assisted summaries, participant coaching, project summaries, or award
citations as separately reviewed projections. Those hooks must consume only released,
participant-safe data and must never score, normalize, or publish autonomously.
