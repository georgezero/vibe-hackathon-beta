# E3A operator rehearsal findings

Date: 2026-08-08
Environment: Kentucky Vibes synthetic clone only
Service: `kentucky-vibes-e3a.service` (3035) with loopback HTTPS proxy (3445)

The agent-operated qualification service was stopped after the final snapshot.
The post-walkthrough artifact is
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3a-operator-rehearsal-20260808T175500Z.sqlite`
(SHA-256
`6d65ce07a7cd51baf2d4c35055352950628153640965c25d65cf95f7cef3d089`).
Temporary credentials were removed; a human rehearsal requires fresh synthetic
credentials.

## Qualification record

The walkthrough used the normal login flow and an approved synthetic
administrator account. No real account or production record was used. The
administrator reached the dashboard, saw Event Health, followed queue links,
and opened the existing specialist screens. The event remained calculated and
unpublished.

The scripted/agent-operated rehearsal verified:

| goal | result |
| --- | --- |
| determine overall health | passed — Blocked state and explanation visible in the first dashboard viewport |
| find highest-priority problem | passed — first blocker is shown in “Most important” |
| understand why | passed — every row includes impact and recommended action |
| navigate to affected record | passed — queue link targets Judging with a scoped judge/submission query |
| inspect judging coverage | passed — synthetic replacement/conflict rows appear in the queue |
| find remaining judge work | passed — Judging domain shows active judges and missing evaluations |
| inspect incomplete submissions | passed — Submissions domain links to readiness |
| determine ranking completeness | passed — Results domain shows ranked/unranked counts |
| find tie/variance/consensus work | passed — Results and Calibration counts/links are visible |
| determine publication safety | passed — Publication reads “Private · calculated” and no result is public |
| open participant preview safely | passed in the existing D.4 qualification; no private notes or judge identities exposed |
| verify health after correction | passed in isolated E3 action qualification; fresh clone was used for this rehearsal |

Routine operator escape hatches for this read-only rehearsal: **zero shell
commands, zero SQLite queries, zero manually constructed API calls, zero
undocumented URLs**. Snapshot creation, service start/stop, and credential
rotation remain deliberate operator setup/teardown actions, not event-day
workflow requirements.

## Security and role checks

- Event-health API: signed out 401, participant 403, administrator 200.
- Participant admin route: non-authorized admin entry.
- Judge/admin separation and assignment authorization were requalified in E3;
  no new path changes those boundaries.
- No private-note contents, private chat contents, credentials, tokens, or
  actor IDs appear in the event-health projection.
- Production event/session/database was not used by the rehearsal.

## UX findings

| severity | finding | recovery | disposition |
| --- | --- | --- | --- |
| High | No independent human operator has yet completed the task list. | Not applicable | run one approved human session before launch |
| Medium | A realistic fixture can produce dozens of valid action items. | The panel caps visible rows at 20 and reports the remainder; specialist tools remain the complete queue. | monitor during human rehearsal |
| Medium | Dense admin specialist tables remain primarily desktop-oriented. | Event Health itself collapses cleanly at 390px with no overflow. | retain existing E3 mobile backlog |
| Polish | “Judging complete” is derived from the authoritative deadline helper, while publication may still be calculated. | Publication card explicitly says results remain private and shows release state. | retain wording; validate with operator |

No security, data-integrity, publication-leak, or repeated core-route failure was
observed. No human support-burden count can be claimed until an independent
operator participates.

## Human gate

No independent human operator session was available during this qualification.
The normal read-only workflow was completed by an agent-operated browser and
required no shell, SQLite, hand-built API, or undocumented URL intervention.
This proves the route and authorization wiring but does not prove human
terminology comprehension, time-to-first-blocker, or support burden. The gate
is therefore specifically an approved human rehearsal, not another code or
database change.

## Recommended next phase

Run the independent human rehearsal first. If the operator completes the task
list without routine escape hatches, proceed to event content/configuration. If
they repeatedly ask where work belongs or cannot distinguish readiness from
publication, prioritize UX/copy remediation. Do not begin AI assistance until
the operational workflow is stable.

## E3B follow-up

An additional isolated run used a fresh writable clone and the exact-URL
remediation for conflict work. The original HIGH finding is closed: each
conflict item now opens the exact assignment (`/admin/judging?assignment=...`),
and the client selects that assignment before applying judge/submission
fallbacks. A duplicate replacement attempt failed safely with HTTP 409 and a
human-readable error.

The E3B browser run passed the ten operational tasks, desktop/mobile checks,
and no-leak checks, but it was still agent-operated. It measured no human
questions, wrong turns, or support burden.

## E3C superseding qualification

The operator waived the independent-human gate and authorized a complete
agent-operated browser rehearsal on a fresh Kentucky Vibes clone. The E3C run
completed the administrator health, attention, reassignment, judging, results,
calibration, publication-preview, return-to-health, role-denial, and mobile
checks. Routine operation required zero shell, SQLite, direct API, or
undocumented-route escape hatches. Duplicate reassignment failed safely with
HTTP 409, and participant preview contained no private notes, judge identities,
or internal scoring data.

This was an agent-operated browser rehearsal, not an independent human
usability study; no human terminology or support-burden findings are inferred.
The engineering launch gate is closed by the operator decision. See
`PHASE_E3C_AGENT_OPERATOR_REHEARSAL.md` for the full record.

**GO — EVENT-DAY OPERATIONS QUALIFIED FOR LAUNCH**
