# Judge guide

This is the concise entry point for the current judge workflow. The phase
reports in this directory contain qualification evidence and historical detail;
they are not a substitute for the rules below.

## Start a judging session

1. Open `/judge` and submit the credential supplied privately by the organizer.
2. The application creates a signed, time-limited judge session and redirects
   to `/judge/dashboard`.
3. Open an assigned submission and use its scorecard. Judge identity comes from
   the session and the current event-scoped assignment; it is never selected by
   a URL, query string, or request body.
4. Save scores and private notes as you work. Submit the scorecard when the
   review is complete, then log out when finished.

## What judges can see

Judges can inspect assigned project material and submit their own evaluations.
Assignments, conflicts, and event authorization are checked server-side on
every protected read and write. A judge role does not grant access to private
project editing, Team Chat, administrator tools, private organizer notes, or
another judge's work.

Participant **Messages** and event **Community** are separate from the judge
workspace. A judge who also has an ordinary active account may use global social
surfaces under the normal account policy, but that does not grant project or
scoring privileges.

## Results and publication

Scores and AI review data remain organizer-controlled. Rankings are computed
from the authoritative judging data. Participant-safe results and feedback are
not visible until the organizer publishes the current D.4 release. Do not
describe calculated or reviewed results as published.

## Security reminders

Never share judge credentials, put them in URLs, or copy private notes into
participant-facing channels. If a credential is lost, ask an authorized
operator to rotate it through the documented credential-recovery procedure.

For the security contract and API details, see
[`docs/JUDGE_AUTHENTICATION.md`](../JUDGE_AUTHENTICATION.md). For the unified
workspace and qualification evidence, see
[`PHASE_D0_UNIFIED_JUDGE_WORKSPACE.md`](PHASE_D0_UNIFIED_JUDGE_WORKSPACE.md)
and the later phase reports in this directory.
