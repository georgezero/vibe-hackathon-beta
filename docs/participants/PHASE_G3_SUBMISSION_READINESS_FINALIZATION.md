# Phase G.3 — Submission Readiness / Finalization Experience

Status: **GO — G.3 SUBMISSION EXPERIENCE READY FOR PRODUCT REVIEW**

Recommendation: **RECOMMEND DEPLOYING G.3 TO PRODUCTION**

G.3 was implemented and qualified in the disposable Kentucky Vibes clone at
`http://localhost:3073` (HTTPS proxy `https://localhost:3473`). Production was
not deployed or mutated. The standing Kentucky Vibes review service, production,
Chatto, Viby, and publication data were left outside this qualification.

## 1. Existing submission architecture

The participant path remains:

```text
My Projects → workspace/edit form → judge-facing Preview → confirmation
             → POST /api/v1/submissions/:id/finalize → receipt → My Projects
```

The private edit token remains the bearer credential for the guest edit form,
Preview, team updates, agent updates, and finalization. Better Auth and project
membership are still required for the authenticated workspace. No new
authorization model or persistence table was introduced.

The authoritative writes are:

- `PATCH /api/v1/submissions/:id` for project content;
- `PATCH /api/v1/submissions/:id/team` for the complete team roster;
- `POST /api/v1/submissions/:id/finalize` for submission for judging.

**G.3 requires no schema migration.** The existing `license`, timestamp,
status, roster, audit, publication, and judging columns/tables already support
the projection and UX changes.

`assertEventNotFrozen`, the submission deadline, the edit credential, and
server-side readiness checks remain authoritative. The UI never makes a draft
submittable by itself.

## 2. Completeness, eligibility, and finalization

These are deliberately separate:

| Concept | Meaning | Participant result |
| --- | --- | --- |
| Project completeness | Ten required project/team fields are present | `Ready to submit` or `Needs attention` |
| Prize eligibility | Every listed team member has a badge number | `Eligible for prizes` or a separate warning |
| Finalization | The participant intentionally sends the current version for judging | `Submitted for judging` |

The readiness projection in `lib/submission-readiness.ts` now exposes
`requiredItems`, `optionalItems`, `missingRequiredItems`, `completenessState`,
`canSubmit`, and `teamEligibility`. Badge completion is visible but does not
block submission under the existing Team Registration v1 policy. A team can
therefore be complete and submittable while still ineligible for prizes.

The required participant fields are team name, contact email, project title,
problem statement (minimum 30 characters), demo URL, GitHub URL, screenshot,
license, AGENTS.md URL, and sample-data notes (minimum 20 characters). The
previous form did not expose the already-authoritative License requirement;
G.3 adds that field to the participant form without changing the requirement.

The existing repository validator still produces an advisory validation score
and AI-review input. It is not used to invent additional participant blockers;
for example, the schema has no participant-facing run-command field.

## 3. Readiness and Preview

Private Preview is now labeled **Judge-facing preview** and explains that the
participant is reviewing the project details and team information that the
organizers and judges will use after submission. It contains:

- a prominent `Submission readiness` banner;
- the required-item count and actionable missing-item labels;
- a distinct `Prize eligibility` section;
- the project title, problem statement, target users, links/media, and team;
- no edit token, private profile fields, judge assignments, scores, or notes.

The participant and judge projections share the same core submission and safe
team fields. They are not the same complete page: participant-only readiness,
agent tooling, private team controls, and judge-only evaluation data remain
outside the judge projection. The copy says “same core project/team fields,”
not that every visual element is byte-for-byte identical.

Incomplete state says exactly what is missing and links back to the relevant
editing/team surface. Ready state says `Everything required for judging is
complete.` Optional/recommended AI-evaluation evidence remains visually
secondary and does not masquerade as a blocker.

## 4. Submit interaction and consequences

Preview and the edit form use a focused in-page confirmation panel rather than
an opaque browser prompt. It has a heading, dialog semantics, focus transfer,
Cancel, and one primary commit action. The copy is intentionally accurate:

> This marks the current project version for judging. You can update and
> submit again while the event deadline remains open.

The current domain policy is not an immutable snapshot at first submission.
`submitted`/`finalized` projects may be updated and re-submitted before the
deadline; only `locked` is a hard participant write boundary. The UI therefore
does not claim that every submission is permanently locked. At a passed
deadline, the server denies both project edits and finalization. Event freeze
continues to deny mutation through the existing freeze guard.

Team Chat, DMs, and Community remain separate communication surfaces. G.3 does
not alter their authorization or availability; the existing membership policy
continues to determine Team Chat access after submission. No participant withdrawal or
participant-facing reopen workflow exists. There is no submission admin reopen
endpoint in the current domain; this remains a product limitation rather than
an invented UI promise.

## 5. Finalization API and idempotency

`POST /api/v1/submissions/:id/finalize` now:

1. authenticates the edit bearer token;
2. enforces event freeze and the exact server-side deadline;
3. rejects missing required items with `READINESS_INCOMPLETE` and safe labels;
4. preserves the original receipt timestamp on re-submission;
5. records `finalizedAt` for newer rows;
6. accepts an `Idempotency-Key` and returns `alreadyProcessed` on retry;
7. uses a deterministic audit-event ID so two concurrent requests with the
   same key cannot create duplicate finalization audit records;
8. keeps AI review generation non-fatal and does not let it silently finalize.

The UI disables the commit button while pending. The server remains the source
of truth for retries, two tabs, and network replay.

## 6. Receipt and post-submit state

`/submit/:token/done` is a durable receipt with:

- `Project submitted` heading;
- submitted project/team;
- authoritative submitted timestamp;
- separate prize-eligibility status (without revealing badge numbers);
- status and judging schedule;
- `Review submitted project`, `My Projects`, and public-page actions;
- account-save/recovery guidance without making the token the primary story.

The submitted edit view uses a visible `Submitted` state. Before the deadline
it explains that a new version can be submitted; after the deadline the server
returns a safe closed state. A hard-locked project instead says that changes
are closed and remains viewable.

## 7. Agent boundary

The G.1 agent contract remains unchanged. Prompts include the hosted edit
credential and preview URL, require complete-roster replacement semantics, and
explicitly tell the agent not to finalize without a human instruction. An
agent using the edit credential after the deadline is denied by the same server
boundary as a browser edit; a hard-locked project is also denied. The agent
does not see judge scores, notes, or private communication.

## 8. Membership, invitations, and judging

Team lead, teammates, listed roster, and project-access semantics remain those
qualified in G.1/G.1A. Team mutation is still replace-style and remains
allowed before the deadline under the existing API policy. Pending invitations
have no new finalization behavior in G.3; their UX is documented as a remaining
G.4 team/invitation candidate.

Judge access is assignment-based and now explicitly rejects a draft before it
can enter judge-visible work. Submitted/finalized/locked submissions remain
available to assigned judges. Participant Preview excludes private chat/DM/
Community data and all judge evaluation data.

Finalization does not publish results. Participant result labels continue to
come from the authoritative publication release; the clone was set to an
unpublished calculated release for qualification.

## 9. Deadline and freeze qualification

The disposable event was exercised before the deadline, during the final day,
and after the deadline. A deadline-race attempt (Preview opened before the
deadline, commit after it) returned `403 DEADLINE_PASSED`; the project stayed
safe. The deadline helper was corrected to compare exact server time before
using rounded “close today” copy. Browser clocks are never authoritative.

The clone also exercised a submitted project after the deadline: a project
PATCH returned `403 DEADLINE_PASSED`. Event freeze remains a separate mutation
guard. Reopened-submission UX was not qualified because the current product has
no participant-safe reopen operation; no misleading “changes requested” state
was invented.

## 10. Kentucky Vibes qualification fixture

Clone architecture:

- source snapshot: G1A qualified SQLite snapshot;
- database: `/opt/vibe-hackathon/instances/kentucky-vibes-g3-qualification-20260809T175500Z/data/active.sqlite`;
- app port: `3073`;
- disposable HTTPS proxy: `3473`;
- separate `BETTER_AUTH_URL`/base URL and cookies;
- no production credentials, Viby links, Chatto process, or production DB.

Synthetic cases included incomplete/ready/eligibility-warning/submitted and
deadline-closed drafts. The event deadline was temporarily moved forward for
open-path runs and then moved into the past for deadline qualification. The
clone publication release was set to calculated/unpublished so results remained
`Results pending`, not publicly available. Existing standing Kentucky Vibes
fixtures were not changed.

The stopped qualification snapshot is
`/opt/vibe-hackathon/instances/kentucky-vibes-g3-qualification-20260809T175500Z/snapshots/g3-qualified-final-20260809T1838.sqlite`
(mode `0600`, SHA-256
`94182f54e855db1232baf3af3f48a948ca0bc29b0921a07ca09ec7ed13dff0ec`).

The snapshot contains 13 clone-only `G3` submission rows (11 drafts and two
submitted qualification projects), 12 new synthetic roster rows, and the
bounded finalization/audit records generated by the runs. These counts are
clone provenance, not production data.

Browser evidence is in `docs/participants/screenshots/g3/`:

- desktop incomplete/eligibility/ready/readiness;
- judge-facing Preview;
- submit confirmation;
- receipt;
- submitted workspace state;
- deadline-closed state;
- mobile readiness, confirmation, and receipt.

## 11. Browser journeys

Completed in the isolated clone with synthetic identities:

- incomplete project → Preview → precise readiness state;
- complete project with a missing badge → separate prize warning;
- complete + eligible project → Preview → confirmation → submitted receipt;
- concurrent same-key finalization → one normal success and one
  `alreadyProcessed` response;
- submitted project after deadline → safe edit denial;
- deadline-race finalization → `DEADLINE_PASSED` denial;
- mobile readiness/confirmation/receipt at 390×844 with no horizontal overflow.

G.1A already qualified the hosted agent update and no-agent-finalization
contract. G.3 static/API checks preserve that boundary, including denial of an
edit after the deadline. The judge boundary was verified through the
assignment resolver and focused authorization coverage: drafts are rejected
before judge-visible work, and the judge projection excludes participant
private communication. No production judge credential was used. The standing
review environment remains active for further product review.

## 12. Accessibility and design review

The Impeccable Design review favored one calm readiness hierarchy over repeated
warning badges: completeness first, eligibility second, and one clear submit
action. The confirmation is an accessible dialog region with a focusable
heading; status is conveyed by text as well as color; missing-item labels are
descriptive; and mobile actions remain reachable without horizontal overflow.
The detector reported no new findings in the changed readiness/finalization
files. The existing Preview image optimization warning is unchanged.

## 13. Security and data preservation

Qualification confirmed:

- edit tokens remain bearer credentials and are not placed in retained
  screenshots or documentation;
- private recovery links remain clearly described as editable credentials;
- finalization retains authentication, token authorization, CSRF/application
  request protections, freeze/deadline checks, readiness validation, and
  idempotency;
- no participant email, Better Auth ID, Viby assertion, judge ID, score, or
  private note is added to participant projections;
- no results were published;
- no production, Chatto, or Viby data was changed.

The disposable clone passed `PRAGMA integrity_check` and
`PRAGMA foreign_key_check`. Synthetic rows are identifiable by the `G3` team
names and exact clone-only submission IDs. The clone is disposable and should
be stopped/checkpointed after review; the standing Kentucky Vibes environment
must remain running.

## 14. Tests and verification

- G.3 focused suite: passed (readiness separation, finalization boundaries,
  deterministic retry audit, deadline exact-time check, form coverage, and
  confirmation accessibility).
- Full unit suite: **307 tests in 59 files passed**. Existing Viby migration
  harness warnings/errors are expected guarded-script output; the test run
  exited successfully.
- TypeScript: passed.
- Webpack production build: passed.
- Changed-file ESLint: passed with the existing Preview `<img>` warning and no
  errors.
- `git diff --check`: passed.
- Desktop/mobile Chromium qualification: passed.
- Impeccable detector on changed files: no findings.

## 15. Remaining limitations and recommendation

The participant experience is materially clearer and safe for product review.
Two domain limitations remain visible:

1. submitted projects are editable/re-submittable before the deadline rather
   than immutable snapshots;
2. no participant-safe organizer reopen flow exists after hard lock.

Both reflect existing domain policy and are documented rather than disguised;
neither blocked the qualified participant path. If product later wants
immutable snapshots or reopen reasons, that should be a separate correctness/
product decision (G.3R/G.4), not a copy-only change.

**GO — G.3 SUBMISSION EXPERIENCE READY FOR PRODUCT REVIEW**

**RECOMMEND DEPLOYING G.3 TO PRODUCTION**

## G.3B production closure

G.3 was deployed as the application-only production release documented in
[`PHASE_G3B_PRODUCTION_DEPLOYMENT.md`](PHASE_G3B_PRODUCTION_DEPLOYMENT.md).
The deployment required no schema migration, created no production project,
and preserved submissions, judging, publication, Team Chat, DMs, Community,
Viby, and Chatto. Anonymous production checks, readiness/finalization static
regressions, deadline/idempotency tests, and business-table preservation all
passed. The next bounded participant recommendation is **G.4 — Team Formation /
Invitations Experience**.

## G.4 follow-up

G.4 addressed that remaining team-formation friction in a disposable Kentucky
Vibes clone. It centralizes participant-safe teammate states, makes invitation
creation and expiry understandable, preserves the separation between roster
identity and authenticated project access, and verifies Team Chat denial after
access revocation. It also closes private roster GET exposure and applies the
existing authoritative deadline to roster writes. See
[`PHASE_G4_TEAM_FORMATION_INVITATIONS.md`](PHASE_G4_TEAM_FORMATION_INVITATIONS.md).
No production data or event policy was changed.

## G.4B production closure

G.4 team formation/invitations was deployed and qualified in production as an
application-only release; see
[`PHASE_G4B_PRODUCTION_DEPLOYMENT.md`](PHASE_G4B_PRODUCTION_DEPLOYMENT.md).
Roster, project-access, invitation, deadline, Team Chat, judging, publication,
Chatto, and Viby business data remained unchanged. The next bounded participant
recommendation is **G.5 — Project Editing / Submission Form UX**.

## G.5 follow-up

G.5 keeps G.3 readiness and finalization authoritative while making the editor
the project-story workspace: required/optional hierarchy, partial saves,
field-level validation, Preview deep links, agent/manual parity, and safe
submitted/deadline-closed presentation. The migration-free edit fingerprint
rejects a stale browser save after another hosted update. Qualification and
remaining limitations are documented in
[`PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md`](PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md).

## G.5B follow-up

G.5B production qualification confirmed that the project editor continues to
feed the centralized G.3 readiness, Preview, deadline, lock, and finalization
boundaries. No production finalization or data mutation was performed. The
next recommended participant direction is **H.0 — End-to-End Participant
Experience Audit**.
