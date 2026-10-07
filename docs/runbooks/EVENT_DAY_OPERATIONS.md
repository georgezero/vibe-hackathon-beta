# Event-day operations runbook

This is the operator-facing path for a real Vibe Hackathon. Use the
administrator UI for normal work. The shell/database commands below are
emergency recovery procedures only.

## Before opening

1. Sign in through the normal administrator entry, open **Admin Dashboard**,
   and check **Event Health** first. Confirm the phase, overall state,
   “What should I do next?” summary, and whether results are explicitly still
   private.
2. Follow the highest-priority Attention Queue item before opening specialist
   tools. Use its explanation, affected record, and direct action link to
   resolve or deliberately watch the issue. One conflict/reassignment root
   cause should not be treated as three separate ranking alerts.
   Conflict links open the exact assignment under review; confirm the project
   and judge in the inspector before reassigning.
3. Confirm the event name, active event, and environment. Then open `Dashboard`
   `Readiness` to confirm the finalized count, incomplete teams, badge/readiness
   gaps, and deadline state.
4. Open `People`. Confirm administrator, judge, and participant access is
   scoped to the active event. Resolve invitations or password-change states
   there.
5. Open `Judging`. Confirm the event is Open, expected assignments exist, and
   no conflict/no-coverage item is unexplained.
6. Open `Results`, `Calibration`, and `Publication`. Confirm results are
   calculated/private, consensus and tie queues are understood, and the
   publication release is not Published.
7. Verify the latest database snapshot and the local/public health endpoint.
   Do not overwrite an immutable snapshot.

## During submissions

1. Use `Dashboard → Readiness` as the first triage screen.
2. Open a row to inspect readiness and the private team roster. Use `Contact
   Team` only when an organizer-approved contact is appropriate.
3. For access problems, use `People` and the account/invitation controls. Do
   not infer access from email matching; active membership and server-side
   authorization are authoritative.
4. For team collaboration, use the participant workspace Team and Messages
   screens. Chat is private to active team members; never paste passwords,
   tokens, PHI, or API keys.
5. Finalization is the participant/submission workflow. Administrators inspect
   and verify; they do not bypass the edit-token boundary with SQLite.

## Before judging

1. Confirm finalized/eligible submissions and readiness gaps.
2. Open `Judging`; filter/search the attention queue and use each `Open` link.
3. For every submission without coverage, select the assignment inspector,
   declare/record a conflict where applicable, or use `Replacement judge` →
   `Reassign`. The old assignment remains historical; the replacement starts
   at Not started.
4. Confirm no judge is assigned to a team they own or belong to.
5. Confirm the judging deadline and event freeze policy in Settings.

## During judging

1. Monitor `Required evaluations`, `Not started`, `Draft`, `Submitted`,
   `Frozen`, `Missing`, `Fully evaluated`, and `Judges with remaining work`.
2. Use the queue links for no coverage, conflict/replacement, missing review,
   and judge-not-started items.
3. Select an assignment card to inspect last save, private-note presence,
   conflict state, and evaluation state. Private-note contents are never shown
   in the command center.
4. Freeze a submitted evaluation only when the operator intends to lock it.
   Reopen requires the explicit reason and creates an audit event. The judge
   must resubmit after reopening.
5. For a recusal, set the conflict state first, then reassign. Recused work is
   excluded from active coverage; scores and notes remain preserved.
6. Never expose Team Chat to judges or use a judge URL as an authorization
   shortcut.

## Before results

1. Open `Results`. Confirm every ranked row is complete under the documented
   ranking denominator; identify unranked submissions.
2. Review tie groups and high-variance signals. A tie is reviewed, not silently
   broken.
3. Open `Calibration` for outliers and consensus-required projects. Record a
   bounded discussion note and complete/reopen consensus with a reason.
4. Mark finalists and awards deliberately. Rankings never publish themselves.
5. Export only through authenticated administrator controls and confirm private
   notes, judge identities, and internal calibration data are absent from
   participant-safe exports.

## Before publication

1. Open `Publication` and confirm the lifecycle is `calculated`, `reviewed`, or
   `approved`, never Published by accident.
2. Check awards, finalist state, score/criterion visibility, releasable
   feedback, administrator summary, and announcement.
3. Open the `Participant preview` and verify it matches the sanitized
   participant projection. It must not contain private notes, judge names,
   individual scores, consensus notes, calibration metrics, or audit history.
4. Mark reviewed, approve, and publish only after explicit confirmation by the
   event owner. Keep the real event unpublished during rehearsal.
5. If an operator mistake occurs, withdraw/republish/archive through the
   publication UI and preserve revision history.

## Emergency response

Stop the affected workflow and preserve evidence for:

- cross-role or private-note exposure;
- assignment access leakage;
- accidental publication;
- data-integrity failure;
- repeated core-route 500s;
- session crossover.

For an application-only failure, restore the previous immutable application
release and restart only `vibe-hackathon.service`. For a migration/integrity
failure, restore the verified current-event snapshot using the already-qualified
typed-confirmation workflow:

```sh
npm run db:event:inspect -- current
npm run event:restore:current
```

The restore command displays the source checksum/event, creates a pre-restore
backup, stops only Vibe Hackathon, replaces the database atomically, restarts,
and verifies health/counts. Never use a generic `yes`, never target Chatto or
Viby, and never restore a Kentucky Vibes artifact over production.

## End-of-day checks

1. Confirm the active event and publication state.
2. Capture a verified snapshot before any maintenance.
3. Review the attention queue and audit activity.
4. Record unresolved P1/P2 work in the event log.
5. Verify health, PID/restart count, database integrity, and foreign keys.

## Operator boundaries

Routine event work is UI-only. Shell/SQLite is reserved for backup, isolated
simulation, service health, and emergency restore. Do not mutate Chatto or
Viby from this runbook, and do not publish real results while qualifying.

## E3C qualification note

The agent-operated Kentucky Vibes browser rehearsal completed the normal
administrator workflow with zero routine shell, SQLite, direct-API, or
undocumented-route escape hatches. It was not an independent human usability
study; use the UI and this runbook for event preparation and training. The
engineering event-day qualification is recorded in
`docs/event-simulation/PHASE_E3C_AGENT_OPERATOR_REHEARSAL.md`.
