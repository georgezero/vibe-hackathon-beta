# E3B operator rehearsal and launch readiness

Date: 2026-08-08
Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Final repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` (the bounded
source change and qualification reports remain in the working tree)
Application release deployed after qualification: `a70edc28326108dfc84a69af303f680ceaa7f735-e3b-assignment-routing-20260808T200508Z`

## Qualification boundary

This was an isolated Kentucky Vibes rehearsal. It used a fresh writable clone
of the E3A artifact, not the canonical event database:

`/opt/vibe-hackathon/instances/kentucky-vibes-e3b-20260808T181500Z/data/active-fresh.sqlite`

The final post-rehearsal snapshot is:

`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3b-operator-rehearsal-20260808T200339Z.sqlite`

SHA-256: `8578e6f578425f489423f21bba84a9f0fe4a5a60c11a102dc0486381c05741d4`
Integrity: `ok`
Foreign keys: empty result
Event: `evt_kentucky_vibes` / `kentucky-vibes`
Publication state: `calculated` (unpublished)

The browser rehearsal was agent-operated automation, not an independent human
operator session. It validates navigation, authorization, state transitions,
and responsive behavior; it does not establish human comprehension, support
burden, or the 30-second time-to-first-blocker target.

## Environment and persona

- isolated app: `kentucky-vibes-e3b.service`, port `3040`;
- isolated loopback TLS proxy: port `3450`;
- synthetic administrator: `E3B Synthetic Operator` (the `.example.invalid`
  address is intentionally omitted here);
- credentials were held in mode-0600 files outside the repository and securely
  removed after the run;
- no Viby link, production account, or production credential was used.

## Tasks 1–10

| task | result |
| --- | --- |
| 1. Determine health | Passed. Normal landing/login reached Admin Dashboard; Event Health showed `Blocked`, phase `Judging complete`, 95 attention items, and `Required evaluation missing` as the top item. |
| 2. Resolve coverage problem | Passed in the clean clone. Conflict links now carry the exact assignment ID. Reassignment through the UI returned 200 and created a replacement; the original conflict root disappeared. Replacement work correctly remained visible as missing work. |
| 3. Find judge with remaining work | Passed. Judging workload rows expose assigned, not-started, draft, submitted, frozen, remaining, and status values. Highest remaining workload was visible without SQL. |
| 4. Find problematic submission | Passed. Dashboard → Readiness opened the submission-readiness view; it showed finalized, incomplete, ready-to-finalize, prize-eligible, and completion metrics. |
| 5. Determine whether judging is complete | Passed. Dashboard/Judging showed active judges, outstanding evaluations, missing coverage, conflicts, and a blocked overall state. No manual arithmetic was required. |
| 6. Find disagreement | Passed. Results exposed tie/incomplete work; Calibration exposed high-disagreement projects, variance, consensus pending, and judges outside the expected range. Private notes were not shown. |
| 7. Inspect leaders | Passed. Results showed ranked versus incomplete rows, rank, score, finalist state, and an explainable result detail. |
| 8. Determine publication readiness | Passed. Publication showed `Ready to publish: No`, private results, calculated lifecycle, finalists, awards, feedback, and pending-review counts. The UI distinguished ready from published. |
| 9. Open participant preview | Passed. Preview displayed the `Participant Preview` banner and pending/private state. Private-note content, judge identity, individual scores, consensus, calibration, and audit data were absent. |
| 10. Return to health | Passed. The resolved assignment no longer appeared as the original conflict root; remaining missing-evaluation work stayed visible and the overall state remained correctly blocked. |

The scripted browser flow used zero shell, SQLite, manual API, or undocumented
URL steps during the event tasks. Setup, service control, and snapshot capture
were deliberate operator-only lifecycle actions.

## Bounded remediation

The first rehearsal exposed a HIGH operational defect: a conflict attention link
scoped only by judge could open that judge's first active assignment rather than
the conflicted assignment. A reassignment could therefore be applied to the
wrong record. The fix is intentionally narrow:

- attention items use `/admin/judging?assignment=<exact-id>`;
- the Judging client prioritizes an exact active assignment ID over submission
  or judge fallback parameters;
- a regression test locks the exact-link contract.

The duplicate-reassignment recovery drill was also exercised. Selecting a
judge who already had an assignment for the same submission returned HTTP 409
with `That judge already has an assignment for this submission.`; the error was
visible in the UI and no assignment changed.

## Responsive and security checks

At a 390px mobile viewport, Dashboard, exact assignment inspector, Results, and
Publication each had `scrollWidth === innerWidth` (390px). The mobile flow used
visible dashboard cards/action links; hidden desktop navigation was not relied
upon. Desktop routes were exercised in the same authenticated session.

The event-health API remained administrator-only. No private notes or chat
content appeared in the health projection, and no credentials, tokens, or
browser actor IDs were exposed. The isolated event remained unpublished.

## Automated qualification

- full unit suite: **261 passed** across 49 files;
- focused event-health tests: 7 passed;
- TypeScript: passed;
- changed-file ESLint: passed;
- production build: passed;
- `git diff --check`: passed;
- desktop/mobile targeted browser checks: passed;
- isolated database integrity and foreign-key checks: passed.

## Production deployment and preservation

The bounded release was deployed by atomically updating the existing release
symlink and restarting only `vibe-hackathon.service`:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-e3b-assignment-routing-20260808T200508Z`

After deployment: PID `2501204`, started `2026-08-08 16:06:51 EDT`, restart
count `0`, local and public health HTTP 200. The canonical database SHA remained
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; integrity
was `ok` and foreign-key check was empty. The release has no schema migration
or business-data change. The preserved current-event snapshot remains the
rollback target.

An ordered table-content comparison between that snapshot and the post-deploy
canonical file found exactly one changed table: `audit_events`, reflecting the
expected authorization-rejection audit row. All other table hashes matched.

The baseline snapshot and canonical file contain 5 judges, 17 assignments, 14
scores, and 14 private notes (the earlier operational summary's 3/15/12 values
were not the current file shape); those counts and the one expected prior
audit-only authorization event were preserved. The D4 publication release for
the real event remains `calculated` with no published timestamp; no real result
or feedback was exposed. The legacy D2 compatibility row in
`result_publication_states` is not the D4 publication authority: the dashboard,
preview, and participant projection use `publication_releases`, which remains
calculated/private.

Chatto was unchanged. Viby was unchanged.

## E3C disposition

The operator explicitly waived the independent-human rehearsal gate and
approved an agent-operated browser rehearsal against a fresh Kentucky Vibes
clone. E3C completed the administrator workflow, role-denial checks, duplicate
reassignment conflict check, participant-preview privacy check, and mobile
navigation check with zero routine shell, SQLite, API, or undocumented-route
escape hatches. See
`docs/event-simulation/PHASE_E3C_AGENT_OPERATOR_REHEARSAL.md` for the evidence.

This was an agent-operated browser rehearsal, not an independent human
usability study; it does not claim human terminology or support-burden
observations. It removes the engineering launch gate for event-day operation.
Remaining work is ordinary event preparation and operator training.

**GO — EVENT-DAY OPERATIONS QUALIFIED FOR LAUNCH**
