# E3C agent-operated event-day rehearsal

Date: 2026-08-08
Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Final HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Application release: `a70edc28326108dfc84a69af303f680ceaa7f735-e3b-assignment-routing-20260808T200508Z`

## Environment

The rehearsal used a fresh writable clone of the preserved E3B artifact:

`/opt/vibe-hackathon/instances/kentucky-vibes-e3b-20260808T181500Z/data/active-fresh.sqlite`

Source E3B SHA: `8578e6f578425f489423f21bba84a9f0fe4a5a60c11a102dc0486381c05741d4`
Final E3C snapshot:
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3c-agent-rehearsal-20260808T210301Z.sqlite`
Final E3C SHA: `e6aa09d091663bd971341284918f5906399e65651ebf59e710f26251b20497f4`

The isolated app used port `3040` and loopback TLS `https://localhost:3450`.
The event was `evt_kentucky_vibes` / `kentucky-vibes`; publication remained
`calculated`, with `winners_published_at` null. Migrations were rerun twice,
integrity passed, and foreign keys were empty. Final snapshot counts were 85
submissions, 35 judges, 287 assignments, 264 scores, 50 chat rooms, 231 chat
messages, and 34 event-scoped judge authorizations.

This was an agent-operated browser rehearsal, not an independent human
usability study. No human confusion or support burden is inferred.

## Browser operator workflow

Normal `/login` authentication succeeded with a synthetic administrator. The
browser then completed the following through visible UI navigation:

1. Event Health: `Blocked`, `Judging complete`, initially 95 attention items;
   `Required evaluation missing` was the top item.
2. Highest-priority drill-down opened the affected submission and assignment
   inspector.
3. Two synthetic replacement-judge operations were completed through the UI.
   Exact assignment links opened the intended conflicted records. The queue
   correctly retained new missing work created by replacements.
4. A repeated duplicate reassignment returned visible HTTP 409:
   `That judge already has an assignment for this submission.` No duplicate
   active assignment was created.
5. Judging workload displayed remaining work, assignments, and evaluation
   states.
6. Submission Readiness displayed incomplete/problematic submissions without
   requiring raw IDs.
7. Results displayed current leaders, 56 ranked submissions, 19 incomplete
   submissions, ties, and explainable score fields.
8. Calibration displayed 244 completed evaluations, variance `78.52`, 55
   high-disagreement projects, 19 consensus reviews pending, and judge
   calibration signals.
9. Publication displayed `Private · calculated`, `Ready to publish: No`, and
   `Published: 0`.
10. Participant Preview was opened through a visible `Preview` link. The page
    showed the `Participant Preview` banner and pending state. No private-note
    sentinel, judge identity, individual score, or internal discussion content
    was present; explanatory security copy mentioning omitted internal fields
    is not a data leak.
11. Returning to Event Health showed the remaining missing-evaluation work and
    a consistent blocked state.

Routine browser operation required zero shell commands, SQLite queries, direct
API calls, or undocumented hand-typed URLs. Shell was used only for isolated
database preparation, service control, credential rotation, and post-test
validation.

## Authorization rehearsal

- synthetic participant: admin, judging, results, calibration, publication, and
  judge routes denied; `/admin` displayed the explicit non-administrator state;
- synthetic judge: admin routes displayed the explicit non-administrator state;
- assigned judge evaluation loaded successfully;
- an unassigned evaluation returned HTTP 404;
- judge-side Team Chat was absent.

Role credentials were created only in the isolated database through supported
provisioning/authorization tools. Repeated login attempts were rate-limited as
designed; rate limiting was not weakened. New role accounts required an
isolated service restart before the running Better Auth process observed them.

## Mobile rehearsal

Mobile Chromium at 390px navigated through Dashboard, exact Judging inspector,
Results, and Publication. Every route had `scrollWidth === 390` and no
horizontal overflow. The mobile navigation intentionally hides desktop links;
visible dashboard action cards and browser back navigation remained usable.

## Findings

- BLOCKER: none.
- HIGH: none. The prior exact-assignment routing defect was already fixed and
  remained correct.
- MEDIUM: automation needed an href-based locator for the wrapped
  `Open Submissions →` accessible label, and browser back/visible cards for
  mobile navigation. These are automation ergonomics, not an event-day shell
  escape hatch or observed human confusion.
- POLISH: none required for launch.

No application code changes were needed in E3C. The E3B release remained the
production release; no redeployment occurred.

## Cleanup and production boundary

Kentucky Vibes services and proxy were stopped. Synthetic admin, participant,
and judge authorizations were revoked, synthetic sessions were removed, and
all temporary password files were securely removed. The final artifact passed
isolated restore validation with integrity `ok` and no foreign-key rows.

Production remained PID `2501204`, restart count `0`, release
`…-e3b-assignment-routing-20260808T200508Z`, and HTTP 200 locally and publicly.
Its canonical SHA remained
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; ordered
business-table hashes matched baseline and only `audit_events` differed as
expected. Real publication remained calculated/private.

Chatto was unchanged. Viby was unchanged.

## Automated regression

- full isolated unit suite: **261 passed**;
- TypeScript: passed;
- changed-file ESLint: passed;
- production build: already passed for the deployed E3B release;
- desktop and mobile browser rehearsal: passed;
- `git diff --check`: passed.

The independent-human gate is waived by the E3C operator decision. Remaining
work is normal event preparation, not a launch-blocking engineering gate.

**GO — EVENT-DAY OPERATIONS QUALIFIED FOR LAUNCH**
