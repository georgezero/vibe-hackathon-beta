# Phase G.4 — Team Formation / Invitations Experience

Status: `GO — G.4 TEAM FORMATION / INVITATIONS READY FOR PRODUCT REVIEW`

Recommendation: `RECOMMEND DEPLOYING G.4 TO PRODUCTION`

Qualification was performed in a disposable open-event Kentucky Vibes clone.
Production, the standing Kentucky Vibes review instance, Chatto, Viby, and
real participant data were not changed.

No database schema migration was required. G.4 adds a participant-safe
projection and presentation layer, plus bounded authorization/deadline checks
on existing routes; it does not add tables or change production schema.

## 1. Existing team architecture

The current domain intentionally keeps two records separate:

- `team_members` is the submitted roster (the people listed on a project).
- `submission_memberships` is authenticated private project access.

The first roster row is the Team lead. Teammate access is created only when a
signed-in participant accepts an invitation. Email matching, profile identity,
or being listed on the roster never grants workspace access.

Invitation links contain a random bearer token. Only its SHA-256 digest is
stored. Links expire after seven days, are single-use, and can be revoked by
the Team lead. There is no outbound email transport; the UI creates a link for
the lead to copy and send privately.

Routes audited:

- `/submit/:token/team` — private edit-token roster and access management;
- `/projects/:submissionId/team` — authenticated workspace Team view;
- `/projects/join/:token` and `/projects/join` — invitation landing and
  cookie-bound confirmation;
- `/api/submission-memberships/invitations` — owner-only create/list;
- `/api/submission-memberships/invitations/:invitationId` — owner-only revoke;
- `/api/submission-memberships/invitations/accept` — authenticated accept;
- `/api/submission-memberships/:membershipId` — owner-only access revoke;
- `PATCH /api/v1/submissions/:id/team` — edit-token, replace-style roster.

Team Chat authorization is membership-based and emits a revocation event. A
roster replacement does not silently create or remove authenticated access.
This is deliberate: a lead can remove a listed row and separately revoke
private project access.

## 2. Participant mental model

The participant vocabulary is now:

- **Team lead** — the person who started and controls the project;
- **Teammates** — people listed on the project team;
- **Project access** — an account that has accepted an invitation and can open
  the private workspace and Team Chat.

Backend terms such as owner records, roster-only rows, membership rows, and
account principals remain implementation details.

## 3. Team page

Both team surfaces now separate the page into:

1. Team lead;
2. Teammates;
3. Invite teammates;
4. Invitation history;
5. Project access;
6. Team eligibility.

The authenticated page uses `projectTeamFormation` in `lib/team-formation.ts`
as its participant-safe projection. It reports a concise state for each listed
teammate without exposing email, badge, token, or account identifiers.

The lead sees the team size as `1 Team lead + teammates`, not as a count of
access rows. A listed teammate without access remains visibly listed and is not
silently treated as absent.

## 4. Teammate-state projection

The central projection supports:

- Listed on team;
- Invitation ready;
- Invitation link ready / pending;
- Invitation expired;
- Invitation revoked;
- Project access active;
- Project access revoked.

Expired pending links are transitioned to expired during safe inspection. The
projection does not claim an email was sent: all invitations are manually
shared links.

## 5. Invitation creation

The lead selects a listed teammate in a centered, responsive dialog or mobile
sheet and chooses **Create invitation link**. The first view contains no raw
token. The success state says **Invitation link ready**, gives a copy action,
shows the human expiry, and explains that the link must be sent privately.

The raw URL is available only under an explicit `Show private link` disclosure
for recovery/operator use. It is never written to audit metadata or generic
logs. The dialog has focus transfer, a focus trap, Escape/outside close, copy
feedback, and a clipboard fallback.

The API still accepts an unlinked invitation for backwards compatibility, but
the participant UI requires a listed teammate. This prevents the ordinary flow
from creating an invitation whose recipient cannot be explained on the Team
page.

## 6. Invitation security, expiry, and regeneration

The link is a bearer credential: anyone who possesses it can request access to
the project. The UI says this plainly without exposing token internals. The
cookie is HttpOnly, short-lived, same-site, no-store, and is cleared after
acceptance.

The server uses authoritative time for the seven-day expiry. A revoked or
expired link displays an actionable unavailable state and cannot be silently
reactivated. Creating a replacement link after revocation is explicit; the old
link remains unusable.

Invitation creation is limited to ten attempts per owner/project per hour;
acceptance attempts are limited to ten per signed-in participant per fifteen
minutes. This is deliberately bounded and does not add email delivery or
CAPTCHA friction.

## 7. Authentication bridge and wrong-account behavior

An unauthenticated recipient lands on the invitation explanation and chooses
the normal sign-in flow. The short-lived invitation cookie survives the login
return to `/projects/join`; no session or account is injected by the invite.

The current domain is claim-on-accept, not pre-bound to an account. The
confirmation page therefore shows the signed-in identity and says that joining
will add access to that account. It tells a recipient to sign out before
continuing if the identity is wrong. It does not silently merge, transfer, or
infer identity from email. This is the actual existing policy and is now made
visible rather than pretending that a delivery email was sent to a bound user.

Successful acceptance goes directly to `/projects/:submissionId?joined=1`,
where a durable success note links back to My Projects. The membership is
created once, without admin/judge authorization or profile discoverability
changes.

Repeated acceptance of the same invitation returns the already-created active
membership. A concurrent acceptance race is handled by returning the committed
membership rather than producing a duplicate-looking conflict.

## 8. Roster removal, access revocation, and regrant

The UI keeps these actions distinct:

- **Remove from the listed team** changes the replace-style roster;
- **Revoke access** changes authenticated workspace/Team Chat access;
- **Create a new invitation link** is the regrant path.

Roster editing now warns that removing a listed row does not revoke existing
project access. The lead must use the access action when both records should
change. Existing history remains governed by the current chat policy.

Revoking active access emits the existing native-chat membership event. The
workspace and chat API deny the participant immediately; the isolated smoke
measured a 49 ms denial check. No new realtime transport was added.

Team-lead transfer is not supported and was not added. Reordering the roster
does not transfer control.

## 9. Agent roster replacement and invariants

The G.1 agent contract remains replace-style: each update sends the complete
intended `owner` plus `members[]` roster. The agent cannot create an account or
membership merely by adding a roster row, and it cannot infer access from an
email address. The owner remains the top-level Team lead.

Verified invariants:

- owner remains represented as Team lead;
- team size is roster-based and capped at six people;
- active access is tied to a submission membership;
- revoked membership cannot open workspace or Team Chat;
- profile visibility does not grant access;
- roster replacement does not create membership;
- removing a roster row does not silently revoke an existing membership;
- project access never grants judge/admin rights.

## 10. Prize eligibility and team size

Prize eligibility remains separate from access. A listed teammate without a
badge produces a team-eligibility warning; accepting an invitation does not
make the team prize eligible. The existing G.3 readiness projection remains
authoritative.

The participant view reports `N people listed`, counting the Team lead and
roster teammates once. The server rejects a seventh person with the clear
message `Team size is limited to 6 people including owner`.

## 11. Finalization and pending invitations

G.4 did not invent a new finalization policy. The existing G.3 rules remain
authoritative for submitted/resubmittable projects, event freeze, and deadline
guards. A pending invitation is a project-access state, not automatically a
roster or submission-readiness blocker. A listed teammate may be shown as
listed while they have not joined the workspace.

The edit-token roster endpoint now requires its bearer token for GET as well as
PATCH; this closes a private-roster exposure found during the G.4 audit. PATCH
also applies the authoritative event deadline to roster changes, returning
`DEADLINE_PASSED` after the deadline. Production was not migrated or changed.

Invitation acceptance and access revocation remain governed by their existing
membership policy. No new post-submission membership rule was invented.

## 12. Deadline behavior

The clone was opened using its existing event configuration for positive-path
qualification, then temporarily set to a past submission deadline for a
bounded denial check and restored. A roster PATCH after the deadline returned
HTTP 403 with `DEADLINE_PASSED`; the event deadline was restored to its recorded
clone value. Browser time was never used as authorization.

The standing Kentucky Vibes environment and production deadline were not
changed.

## 13. Kentucky Vibes qualification clone

Clone root:

`/opt/vibe-hackathon/instances/kentucky-vibes-g4-qualification-20260810T001030Z`

The clone used a separate SQLite file, Better Auth secret/origin, cookie
origin, service port 3061, and local HTTPS proxy port 3443. The proxy used a
short-lived self-signed certificate solely for browser qualification. No Viby
links or production credentials were used.

The clone's authoritative event was originally recorded with submission and
judging deadlines `1785585600` and `1785758400`. For positive-path browser
qualification only, the clone was set to open values `1786580477` and
`1786666877`; the recorded original values were restored before cleanup. The
standing event and production event were never changed.

Deterministic synthetic cases were created:

- `sub_team-only` — Team lead plus listed teammate;
- `sub_active-access` — active teammate access;
- `sub_pending-invite` — pending invitation and missing badge;
- `sub_submitted-pending` — finalized project with pending invitation;
- `sub_max-team` — six-person roster;
- expired and revoked invitations generated during the smoke.

Temporary credential and baseline evidence files were mode `0600`. Exact
synthetic IDs and the clone checksum are retained in the clone evidence, not in
the application or production database. The preserved post-cleanup qualified
snapshot is mode `0600` with SHA-256
`86496ac8b93b44b0282772e4499e481eca0dfdb256df0849fcb355595c0cc0ea`.

## 14. Browser journeys

Completed on desktop Chromium and mobile Chromium:

- Team lead → Team → Invite teammate → create/copy link;
- unauthenticated invitation → normal login → confirmation → Join project →
  workspace;
- visible signed-in identity and wrong-account warning;
- revoked invitation denial;
- expired invitation denial;
- repeat/accepted invitation behavior;
- active access revoke → workspace/chat denial;
- submitted project with pending invitation;
- maximum team size denial;
- deadline-passed roster edit denial;
- replace-style roster update leaves membership semantics separate;
- mobile Team page and invitation sheet.

The invitation link itself was not retained in screenshots. The raw link is
hidden behind disclosure in the UI. Mobile measured zero horizontal overflow.

## 15. Screenshots and design review

Review screenshots are in `docs/participants/screenshots/g4/`:

- desktop Team page, invitation dialog, invitation-ready state;
- invitation landing and join confirmation/success;
- wrong-account, expired, revoked-access, eligibility, and submitted-pending
  states;
- mobile Team page and invitation sheet.

Using Impeccable Design guidance, the final experience keeps the primary goal
as team understanding and readiness. Invitation creation is secondary and
contained in a centered dialog. Statuses use text plus restrained treatment,
not color alone. Destructive access actions are separated from roster editing.
On mobile, the sheet is full-width within the viewport, controls remain
reachable, and no long token is shown in the first view.

## 16. Accessibility

The invitation dialog provides a dialog name, `aria-modal`, focus return, Tab
loop, Escape close, keyboard-selectable teammate list, and live copied/status
feedback. Teammate states are text labels. Action buttons remain reachable on
mobile and do not rely on hover. Errors use alert semantics and the Team page
keeps a readable heading hierarchy.

## 17. Security matrix

Verified or retained from existing qualified coverage:

- unauthenticated invitation explanation and normal auth bridge;
- invalid, expired, and revoked tokens fail closed;
- wrong signed-in identity is shown before claim;
- duplicate acceptance is safe;
- only the Team lead can create/revoke invitations or access;
- cross-project/event and revoked membership access is denied;
- no token/hash in audit metadata or generic logs;
- no badge number, Better Auth ID, Viby subject, or recovery credential on the
  invitation page;
- no profile visibility or email match grants access;
- no admin/judge elevation;
- Team Chat denies immediately after access revoke;
- CSRF, Better Auth, and Viby behavior remain unchanged.

## 18. Tests and checks

Focused G.4 tests cover the centralized state projection, newest-invitation
selection, bearer-protected roster GET, deadline guard, and invitation rate
limits. The complete unit run finished with **311 tests across 60 files
passed**. Expected pre-existing migration-policy stderr remains from unrelated
Viby test fixtures; it did not fail the suite.

Also passed:

- TypeScript;
- production build;
- changed-file ESLint;
- `git diff --check`;
- Impeccable detector on changed UI files;
- desktop/mobile browser smoke;
- mobile overflow check;
- Team Chat revocation denial check;
- max-team and deadline negative checks;
- SQLite integrity and foreign-key checks on the clone.

## 19. Remaining limitations

- Invitations remain manually shared bearer links; there is no outbound email.
- The current domain is claim-on-accept rather than account-bound. The UI makes
  the account choice explicit, but it cannot identify an intended account from
  a token alone.
- Team-lead transfer is not supported.
- Realtime revocation relies on the existing native-chat event and authorization
  path; G.4 did not add a new stream protocol.
- Invitation discovery without the link is not implemented as a global inbox.
- Post-submission invitation policy remains the existing domain policy and is
  not broadened in this phase.

## 20. Production recommendation

The isolated qualification passed without roster/membership inconsistency,
invitation authorization failure, or Team Chat revocation failure. Production,
the standing Kentucky Vibes environment, Chatto, and Viby remain unchanged.

`GO — G.4 TEAM FORMATION / INVITATIONS READY FOR PRODUCT REVIEW`

`RECOMMEND DEPLOYING G.4 TO PRODUCTION`

## G.4B production closure

G.4 was deployed as an application-only immutable release documented in
[`PHASE_G4B_PRODUCTION_DEPLOYMENT.md`](PHASE_G4B_PRODUCTION_DEPLOYMENT.md).
No schema migration or production roster/invitation/membership mutation was
required. The private roster GET bearer boundary, roster deadline guard,
invitation rate limits, participant-safe Team projection, authentication bridge,
and privacy checks passed in production; the isolated clone remains the evidence
for positive invitation and revocation journeys. Team Chat, DMs, Community,
judging, publication, Chatto, Viby, and the standing Kentucky Vibes environment
were preserved. The next bounded recommendation is **G.5 — Project Editing /
Submission Form UX**.

## G.5 follow-up

G.5 leaves Team as the dedicated roster/invitation surface and shows only a
concise team/eligibility summary in the project editor. The project form now
organizes the existing fields around a participant story and preserves the G.4
roster/access boundary. It was qualified in a fresh isolated clone without a
schema migration or production mutation; see
[`PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md`](PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md).

**GO — G.4 TEAM FORMATION / INVITATIONS DEPLOYED AND QUALIFIED**

## G.5B follow-up

The later G.5 project-editing release was deployed without changing G.4 team,
invitation, membership, roster, or Team Chat semantics. Production preservation
checks matched the G.4B baseline. The next recommended participant direction
is **H.0 — End-to-End Participant Experience Audit**.
