# Phase G.1A — Open-Event Guest Creation and Account-Claim Qualification

Date: 2026-08-09

Status: **GO — G.1 Start / Onboarding ready for production deployment**

Recommendation: **RECOMMEND DEPLOYING G.1 TO PRODUCTION**

This was an isolated positive-path qualification. Production was not deployed
or modified. The standing Kentucky Vibes review environment remains active at
[`https://kentucky-vibes-f0b.ggg.ad`](https://kentucky-vibes-f0b.ggg.ad).

## 1. Scope and design review

The complete G.0 audit and G.1 redesign were read before this qualification.
The Impeccable onboarding guidance was applied as a review lens: get a new
participant to a useful first value quickly, keep account creation optional,
use benefit-led copy, and progressively disclose technical recovery details.
The qualification therefore tested the participant story rather than treating
the edit token as the primary product object.

The standing Kentucky Vibes event is closed. It was not changed. A fresh
writable clone was used so that the normal open-event rules could be exercised
without a test bypass.

## 2. Disposable clone architecture

| Item | Qualification value |
| --- | --- |
| Instance | `/opt/vibe-hackathon/instances/kentucky-vibes-g1a-open-20260809T161033Z` |
| Browser origin | `https://localhost:3471` (local HTTPS proxy) |
| App port | `3071` |
| Database | `.../data/active.sqlite` (separate from standing and production DBs) |
| Event | `evt_kentucky_vibes` / `kentucky-vibes` |
| Event state | open only in this clone |
| Original deadline | `1785585600` |
| Temporary deadline | `1786465397` |
| Auth origin | `https://localhost:3471`, with clone-only Better Auth secrets/cookies |
| External dependencies | no Viby link, no production credentials, no Chatto change |

The temporary event change was limited to `events.submission_deadline` in the
clone. `is_frozen` remained false. The standing database retained its original
deadline (`1785585600`) and has zero `@g1a.example.invalid` submissions.

The clone service and local proxy were stopped after qualification. A verified,
mode-0600 evidence snapshot is retained outside the repository at:

`/opt/vibe-hackathon/instances/kentucky-vibes-g1a-open-20260809T161033Z/snapshots/g1a-qualified-20260809T1650.sqlite`

Snapshot SHA-256 (after account cleanup):

`9824552f5ed87fb82ae05c73ff84344fabd6d1096ddf985a828b1bea8b543d40`

## 3. Baseline and data provenance

The final clean clone was checked after stopping the app, checkpointing WAL,
and rebuilding indexes. Integrity and foreign-key checks both passed.

| Table/area | Baseline | Final | Qualification change |
| --- | ---: | ---: | --- |
| Better Auth users | 178 | 180 | two synthetic participant accounts |
| Better Auth accounts | 174 | 176 | two synthetic password accounts |
| submissions / teams | 85 / 85 | 89 / 89 | four qualified synthetic projects |
| team members | 289 | 294 | five synthetic roster rows, including Taylor Kim |
| submission owners | 77 | 78 | one explicit claim |
| active memberships | 276 | 277 | one claimed owner membership |
| user profiles | 161 | 161 | no synthetic profile was made public or discoverable |
| Community channels/messages | 5 / 93 | 5 / 93 | unchanged fixture |
| Community read states/reports | 8 / 1 | 8 / 1 | unchanged fixture |
| direct conversations/messages | 27 / 137 | 27 / 137 | unchanged |
| participant blocks | 2 | 2 | unchanged |
| Viby identity links | 2 | 2 | unchanged |

Qualified synthetic projects:

- `Bluegrass Signal Lab` — anonymous guest/manual path, draft;
- `Bluegrass Signal Lab Mobile` — independent anonymous resume path, draft;
- `Derby Workflow Works` — hosted agent update followed by browser submission;
- `Cumberland Imaging Crew` — anonymous claim path, available in My Projects.

The agent project is the only synthetic finalized/submitted project. It remains
unpublished. The claim account and wrong-account safety account had no admin,
judge, Viby, or project authorization beyond the explicit claim membership.

Several early harness retries created disposable duplicate team rows. The clean
evidence copy removed only the exact eight orphan retry teams and two orphan
retry roster rows; the four qualified projects above were retained. No standing
or production row was involved. Four synthetic claim transactions remain
pending as bounded transaction history and one is confirmed for the claim
project.

## 4. Journey A — anonymous guest creation

Using a fresh unauthenticated browser context:

`/` → `Start a submission` → `/start` → team-lead form → `Create project`

Synthetic data used: Bluegrass Signal Lab / Rowan Mercer /
`rowan-mercer@g1a.example.invalid` / `G1A-ROWAN-001`.

Verified:

- `Start your project` is the first-run heading;
- Project and Team lead sections are distinct;
- badge helper text explains participation/prize eligibility;
- no account is required to begin;
- the primary action is `Create project`;
- technical token language does not dominate the first viewport.

The resulting page leads with `Your project is ready`, then presents:

1. optional `Save this project to My Projects`;
2. `Continue without an account` and the manual/agent paths;
3. team eligibility;
4. the three-step agent handoff;
5. expandable Recovery details.

The private project link was copied through the UI and opened in a second clean
anonymous context. It resumed the same project, without creating a duplicate.
The recovery warning states that anyone with the private link can edit the
project. Credentials were redacted from the evidence screenshot.

## 5. Manual path

The guest chose `Fill out the project form`, immediately reached the edit
surface, changed a synthetic project title, saved, and opened Preview. Preview
showed the saved value. No account was required and the draft was not finalized
during this path.

## 6. Agent path and hosted update

A second anonymous project used Derby Workflow Works / Casey Monroe /
`casey-monroe@g1a.example.invalid` / `G1A-CASEY-002`.

The human-facing flow showed exactly:

1. Copy the private prompt.
2. Give it to a coding agent.
3. Return here to review and submit.

The full prompt was hidden behind the advanced disclosure initially. The copied
synthetic prompt was checked for the qualified contract without retaining its
bearer credential in logs or documentation. It contained the project ID,
hosted base/edit/preview URLs, bearer authorization guidance, complete-roster
replace semantics, no-invented-teammates guidance, no-finalization instruction,
and a return-to-preview instruction.

The qualification harness then performed the actual hosted API update (not a
local-file simulation): project fields were updated and Taylor Kim was added
using the complete intended roster. Browser Preview reflected the update, the
owner remained Casey Monroe, the team count was two, and the project remained a
draft until the explicit later browser submission.

## 7. Save to My Projects / claim

A third project used Cumberland Imaging Crew / Morgan Ellis /
`morgan-ellis@g1a.example.invalid` / `G1A-MORGAN-004`.

From `Your project is ready`, `Save this project to My Projects` used the
normal claim transaction and login flow. A synthetic Better Auth participant
account was provisioned through the supported password-user operator command;
no session or ownership row was injected manually.

The anonymous claim redirect exposed a bounded routing defect: it sent an
anonymous transaction directly to `/claim/confirm`, where authentication is
required. The smallest fix now sends anonymous claimers through
`/login?returnTo=%2Fclaim%2Fconfirm`; authenticated claimers still go directly
to confirmation. Login's safe return-target allowlist now explicitly accepts
`/claim/confirm`. This preserves the bound claim cookie/transaction and does
not weaken authorization.

The confirmation copy was `Save this project?`. After confirmation:

- the project appeared exactly once in `/account/projects`;
- the participant landed in the work-centric project destination rather than
  generic Account;
- the project workspace opened;
- the profile remained optional/private;
- no admin, judge, or Viby access was granted.

## 8. Returning participant and cross-device paths

After logout and a normal login with no `returnTo`, the synthetic participant
landed on `/account/projects`. The claimed project was visible without entering
Project ID or edit token. A second clean browser context reproduced the same
My Projects availability, demonstrating the promised account return path.

An attempted claim from the second synthetic account failed closed with the
neutral participant message `This submission is already claimed.` It did not
move ownership, merge accounts, or expose claim internals.

`/start/resume` accepted the unclaimed Project ID/edit-token pair and returned
to the intended private project flow. Its My Projects guidance remained
visible for already-claimed projects.

## 9. Team terminology

The agent-updated project was reviewed through Team. Participant copy uses:

- Team lead;
- Teammates;
- Listed on team;
- Project access where applicable;
- plain-language eligibility and “still needed” explanations.

It does not expose roster-only, submission-owner, active-membership, or badge-
owner implementation terminology in the primary story.

Invitation acceptance was not repeated in G.1A because the invitation positive
path was already qualified in G.1 and its backend semantics did not change.

## 10. Finalization and receipt

The agent-updated synthetic project was reviewed in Preview, submitted through
the browser with the explicit `Submit for judging` confirmation, and reached
the `Project submitted` receipt. The receipt clearly states that the project is
ready for judging and provides review/preview/return actions. Results were not
published.

## 11. Mobile qualification

At approximately 390×844, the following were checked: `/start`, the project
handoff, `/start/resume`, `/account/projects`, `/projects/:submissionId`, and
the submission receipt. Every checked route reported `scrollWidth ===
innerWidth` (no horizontal overflow). Primary actions remained reachable;
Recovery details stayed secondary; the agent prompt was not shown as a giant
first-viewport block; and workspace core tabs remained accessible.

## 12. Screenshots

The focused, synthetic, credential-safe screenshot set is in
[`docs/participants/screenshots/g1a/`](screenshots/g1a/):

- desktop Start and Team lead form;
- project-ready handoff;
- manual/agent choice and three-step agent guidance;
- recovery details with Project ID/edit token redacted;
- claim confirmation;
- My Projects after claim;
- submitted receipt;
- mobile Start, handoff, agent choice, My Projects, workspace, and receipt.

No screenshot in the repository contains a password, edit token, recovery URL,
cookie, email credential, or raw API response.

## 13. Security verification

- Guest edit-token bearer security remained the authority for unclaimed drafts.
- Private links were only exercised in isolated browser contexts and were not
  copied to retained documentation or generic logs.
- Claim used the existing bound browser transaction/cookie flow.
- CSRF, Better Auth, and safe login return-target behavior remained intact.
- Wrong-account claiming failed closed.
- The coding agent updated the hosted project but did not finalize it without
  the later explicit human action.
- Teammate roster updates did not grant admin/judge privileges.
- No qualification account created a public or discoverable profile.
- No Viby link, Chatto mutation, Team Chat message, community message, DM,
  judging record, or publication record was created by G.1A.
- Temporary password files and token-bearing evidence files were securely
  removed after session revocation.

## 14. Regression and qualification checks

- focused G.1 onboarding/login tests: **9 passed**;
- full unit suite: **294 passed across 57 files**;
- TypeScript: passed;
- production build: passed;
- changed-file ESLint (`ClaimClient`, login, G.1 tests): passed;
- `git diff --check`: passed;
- desktop and mobile Chromium journeys: passed;
- hosted agent contract/update: passed;
- claim, cross-device, wrong-account, resume, and receipt checks: passed;
- final disposable snapshot: `PRAGMA integrity_check = ok`, foreign-key check
  empty;
- standing Kentucky health: HTTP 200, deadline unchanged, zero G1A rows;
- production: untouched.

The full suite emits known pre-existing Better Auth/migration warning output in
some isolated tests; the suite itself is green. No unrelated repository-wide
lint cleanup was included.

## 15. Cleanup and final state

Both synthetic accounts were signed in only through the normal UI and then had
all sessions revoked through `POST /api/account/sessions` with `revoke_all`
(HTTP 200, `signedOut: true`). Password files were shredded. The disposable
app and HTTPS proxy were stopped. The two exact synthetic accounts were then
disabled through the supported `setAccountEnabled` account-management policy;
the final snapshot reports zero remaining sessions for them. The clean
mode-0600 snapshot is retained for bounded evidence; the standing Kentucky
Vibes service and tunnel were not stopped or changed.

## 16. Production recommendation

The two previously missing positive paths now pass: anonymous guest project
creation while open, and optional account claim with My Projects/cross-device
return. Hosted agent completion, manual editing, recovery, wrong-account
safety, finalization, and mobile behavior also pass.

**GO — G.1 START / ONBOARDING READY FOR PRODUCTION DEPLOYMENT**

**RECOMMEND DEPLOYING G.1 TO PRODUCTION.** Production deployment remains a
separate approved phase; G.1A itself did not touch production, Chatto, Viby,
or the standing Kentucky Vibes review environment.

## 17. G.1B production follow-up

The approved G.1B release subsequently deployed the qualified onboarding
application and the anonymous claim-routing fix to production. It required no
schema migration and created no production project, account, claim, invitation,
or finalization record. Production `/start`, `/start/resume`, safe login return
routing, and mobile layout passed bounded smoke checks; the full deployment
evidence is in [`PHASE_G1B_PRODUCTION_DEPLOYMENT.md`](PHASE_G1B_PRODUCTION_DEPLOYMENT.md).

The isolated open-event clone described here remains the evidence for positive
guest creation, hosted-agent update, claim, My Projects return, and finalization
paths. The standing Kentucky Vibes environment remains unchanged and active.
