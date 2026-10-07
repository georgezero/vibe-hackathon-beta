# Phase H.0 — End-to-End Participant Experience Audit

Date: 2026-08-10 (America/New_York)

Disposition: **GO FOR H.1 — Navigation / Information Architecture Cleanup**

This was a read-only/product audit. No production business data, participant
project, invitation, chat, submission, deadline, freeze, result, Chatto, or
Viby state was changed. The only changes in this phase are audit tooling,
documentation, and synthetic screenshots.

## 1. Production baseline

| Check | Observed value |
| --- | --- |
| Host | `paui` |
| Repository | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon` |
| Branch / HEAD | `phase-vh-m6-viby-better-auth-session` / `a70edc28326108dfc84a69af303f680ceaa7f735` |
| Qualified source fingerprint | `382066543663bec47af2077addbfd50d592ee5c5912b4321c94aa91919b55cda` |
| Release | `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z` |
| Build ID | `9W3icbIj4Yv__36P3sKQm` |
| Process | PID `3250791`, started `2026-08-10 00:08:56 EDT`, restart count `0` |
| Health | Local and public `/api/health`: HTTP 200; database health reported OK |
| Canonical DB | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`, mode 0600, 1,380,352 bytes |
| Canonical DB SHA-256 | `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994` |
| Integrity / FK | `PRAGMA integrity_check = ok`; `PRAGMA foreign_key_check = []` |
| Event | `evt_vibe_2025`, slug `vibe-hackathon-2026`, not frozen |
| Submission / judging deadlines | No deadline configured in the current production event |
| Publication | `pr_evt_vibe_2025`, status `calculated`, `published_at = NULL`; results remain unpublished |
| Kentucky Vibes | Standing `https://kentucky-vibes-f0b.ggg.ad` health HTTP 200; left active and unchanged |
| Chatto / Viby | No H.0 changes; both integrations remain unchanged |

The event row contains an older non-null `winners_published_at` compatibility
value, but the authoritative publication release remains calculated and
unpublished. Participant result projection continued to use the publication
release, not that legacy field. This is recorded as a terminology/data-model
cleanup candidate, not a participant-data leak.

Production counts at audit time:

| Table / concept | Count |
| --- | ---: |
| Users | 11 |
| Profiles | 3 |
| Submissions | 10 (5 draft, 5 finalized) |
| Submission owners | 2 |
| Submission memberships | 5 |
| Team roster rows | 28 |
| Team Chat rooms / messages / read states | 1 / 6 / 2 |
| Direct-message conversations / messages | 0 / 0 |
| Community channels / messages | 4 / 0 |
| Judges / assignments / scores | 5 / 17 / 14 |
| Publication rows | 1 |

The worktree was already dirty from the accumulated G-phase implementation
and qualification work. H.0 did not modify those product files.

## 2. Current participant architecture

The participant path is now split into a coherent project lifecycle and
secondary social surfaces:

```text
Public discovery
  / → /projects → /project/:id
  /start → private draft → /submit/:token/start

Private project
  /submit/:token → /submit/:token/team → /submit/:token/preview
  /submit/:token/preview → confirmation → /submit/:token/done

Authenticated project
  /login → /account/projects → /projects/:submissionId/*
  workspace tabs: Overview, Team, Team Chat, Preview, Submit, Activity, Results

Participant community
  /account/profile, /people, /messages, /community
```

The guest editor and authenticated owner editor converge on the same private
form. Team formation remains a separate surface rather than being duplicated
inside the form. Preview, readiness, finalization, receipt, and My Projects
consume the same centralized project/readiness concepts.

## 3. Personas and current assessment

| Persona | Assessment | Evidence |
| --- | --- | --- |
| First-time solo builder | Strong | Start is account-optional, creates a private draft, and gives a direct browser/agent handoff. |
| First-time team lead | Acceptable | Team page separates listed roster, invitations, access, and eligibility; desktop nav still presents too many equal-weight destinations. |
| Invited teammate | Acceptable | Private invitation, normal login bridge, signed-in identity copy, and wrong-account warning were exercised in the clone. |
| Returning team lead | Strong | Ordinary login lands at My Projects; cards expose lifecycle, attention, role, unread chat, and one primary next action. |
| Returning teammate | Acceptable | Workspace access is explicit and Team lead controls are withheld; multiple social/project destinations compete for attention. |
| Community participant | Acceptable | People, Messages, and Community have understandable empty states in the qualified clone; production has almost no social content. |
| Near-submission participant | Strong | Editor progress, judge-facing Preview, actionable readiness, explicit confirmation, and durable receipt form a clear sequence. |
| Submitted participant | Strong | Receipt and My Projects show Submitted; G.3/G.5 qualified resubmittable versus hard-locked states. |
| Results-available participant | Acceptable | Publication gating is safe and the results surface is participant-safe; no currently published production result was available for a live positive run. |

## 4. Current-state route and redirect map

| Surface | Actual behavior |
| --- | --- |
| `/` | Public landing. |
| `/projects` | Public finalized-project gallery. Canonical showcase links prefer `/project/:id`; compatibility `/submission/:id` remains. |
| `/project/:id` | Public project page with participant-safe roster fields. |
| `/people/:handle` | Public profile only when the profile is public/discoverable. |
| `/start` | Creates a private draft in-place, then exposes a handoff link to `/submit/:token/start`. |
| `/start/resume` | Private recovery form requiring Project ID and edit token. |
| `/submit/:token/start` | Private project handoff: browser form, agent prompt, team summary, and optional My Projects claim. |
| `/submit/:token` | Guest/private project editor. Partial saves are allowed; readiness gates submission. |
| `/submit/:token/team` | Guest/private roster and eligibility editor. |
| `/submit/:token/preview` | Judge-facing private preview, readiness, and Submit confirmation. |
| `/submit/:token/done` | Durable submitted receipt. |
| `/login` | Normal password/Viby/GitHub options as configured; safe `returnTo` preserves claim and invitation bridges. Ordinary authenticated login lands at `/account/projects`. |
| `/claim/confirm` | Explicit “Save this project?” confirmation after the account bridge. |
| `/projects/join/:token` | Stores the short-lived invitation context and redirects to `/projects/join`; the token is not rendered as generic page data. |
| `/projects/join` | Sign-in-required invitation landing or signed-in confirmation. Claim-on-accept is stated plainly. |
| `/account/projects` | Authenticated participant home; anonymous view offers sign-in rather than project data. |
| `/projects/:submissionId/*` | Authenticated workspace. Unauthorized access is denied or sent through normal login. |
| `/people`, `/messages`, `/community` | Authenticated participant destinations; anonymous production requests returned HTTP 307 to login. |
| `/winners`, `/ai-evals`, `/status` | Public event destinations; publication and event state remain server-authoritative. |

Observed safe production checks: `/`, `/start`, `/start/resume`, `/projects`,
and `/login` returned HTTP 200; anonymous `/account/projects` rendered a sign-in
state; `/people`, `/messages`, and `/community` returned HTTP 307; an invalid
private preview rendered “Project preview not found”; a known production team
GET without a bearer credential returned HTTP 401 `Authorization required`.

## 5. Browser journeys and friction

All positive/mutating checks below used a disposable open-event Kentucky clone
with a separate SQLite database, origin, cookies, service, and ports. No
production project or invitation was used.

| Journey | Observed path | Steps / meaningful friction | Finding |
| --- | --- | --- | --- |
| A — Solo/manual | Landing → Start → create draft → handoff → editor → save → Preview → confirmation → receipt → login → My Projects | 8 visible page/state steps; 1 authentication transition; 1 confirmation; 0 manual token recovery actions | Strong. Account is optional until the participant chooses My Projects. |
| A2 — Guest claim | Handoff → Save to My Projects → login bridge → claim confirmation | 1 explicit claim confirmation; no automatic session injection | The route and copy are clear; the final positive claim was already qualified in G.1 and the H.0 clone retained the handoff evidence. |
| B — Solo/agent | Handoff → agent prompt disclosure → hosted update → refresh → Preview | Advanced prompt is deliberately secondary; stale browser behavior is 409/reload rather than silent overwrite | Acceptable. G.5 qualification confirms hosted agent PATCH remains supported and human finalization is explicit. |
| C — Team lead | My Projects/workspace → Team → listed teammate → Invite teammate → dialog → private link ready | 1 modal, 1 teammate selection, 1 manual copy/send action | Acceptable. The no-email policy is accurately stated; the desktop authenticated nav is the larger friction. |
| D — Teammate | Private invitation → normal login → join confirmation → project workspace → Team Chat | Positive acceptance/idempotency was qualified in G.4; H.0 exercised invitation creation and the login/confirmation bridge | Acceptable. No account-specific prebinding is falsely claimed. |
| E — Wrong account | Invitation → wrong signed-in identity → identity warning → sign out path | 1 warning before commitment; no silent transfer | Strong safety behavior. |
| F — Returning participant | Login → My Projects → card primary action → workspace/editor | 1 login transition; no Account detour | Strong. |
| G — Community discovery | My Projects → People → Profile/People empty state → Messages → Community → My Projects | 3–5 navigation steps depending on return path; no social content in production | Acceptable, but social destinations have more nav weight than their current event value. |
| H — Deadline | Editor/Submit opened before deadline → authoritative close | G.3/G.5 isolated qualification covered deadline race and exact server time; H.0 did not mutate a live deadline | Strong correctness evidence; no production deadline exists to exercise. |
| I — Post-submit | Receipt → submitted project → My Projects → Team Chat/results pending | 1 return action plus normal workspace tabs | Strong. Submitted is distinct from Results available. |
| J — Results | Synthetic publication-qualified result → My Projects → results/public project | Prior G.3/G.5 publication qualification; production is intentionally unpublished | Safe but not fully live-positive in this audit. |

The only intentionally meaningful friction is the finalization confirmation
and the invitation's explicit manual copy. Both add safety and are not
recommended for removal.

## 6. First-run comprehension

The first viewport communicates “Vibe.Hackathon,” a clear Start CTA, event
context, and account-optional private draft creation. The Start form says that
no account is required and asks for only the team lead's initial details.
Project creation then offers two paths: browser editing or a coding agent.

The remaining first-run terminology drift is visible across the handoff:
“Project created,” “private project,” and agent copy referring to a “submission”
are all technically defensible but not one canonical story. This is P2
terminology polish, not a participation blocker.

## 7. Returning-participant comprehension

My Projects is correctly the first authenticated destination. The clone showed
the “My Projects / Pick up where you left off” hierarchy, lifecycle state,
progress, role, team size, unread Team Chat affordance, and a single primary
next action. People and Community are below project work on the page.

The main remaining issue is not My Projects itself; it is that the global
authenticated desktop navigation gives many secondary destinations the same
visual weight as My Projects and project work.

## 8. Editing, Team, Preview, and submission continuity

The editor keeps the project title and section story visible, allows free
section movement, and exposes Preview/Review & submit as the next progression.
The Team tab is a separate, understandable boundary: the form has a concise
team/eligibility summary while Team owns roster, invitations, and access.

Preview consistently says what judges will see, shares core safe project/team
fields with the judge projection, and keeps chat, scores, notes, and assignment
data out. The same missing-item model flows through editor progress, Preview,
and finalization.

The submitted receipt is durable and unambiguous. My Projects reflects the
submitted state without requiring a browser Back action.

## 9. Manual / agent continuity

The handoff and editor both present the coding-agent path as an advanced,
optional continuation. The prompt is not expanded by default. The qualified
G.5 stale-edit contract remains coherent:

```text
private GET → editVersion
browser PATCH(expectedEditVersion) → 409 STALE_PROJECT_EDIT on mismatch
agent/API PATCH without a browser snapshot → supported hosted update
```

The browser retains entered values and asks the participant to reload/review;
it does not silently overwrite hosted agent work. The agent prompt continues to
say that finalization requires explicit human instruction. A small P2 remains:
the advanced prompt still uses internal “submission”/“token” language in its
full disclosure, which is appropriate for an agent but can be simplified in a
future information-architecture pass.

## 10. Team continuity

The Team screenshot and browser run show separate sections for Team lead,
Teammates, invitation history, Project access, and About project access. The
copy explicitly explains that a listed teammate does not automatically have
private workspace or Team Chat access. The invitation dialog is centered,
focusable as a `role=dialog`, escapable, and does not claim email delivery.

Team Chat is private to active submission members. The G.4 clone measured
revocation at 49 ms; H.0 did not revoke a real production membership.

The Team page is operationally dense but not confusing. It is a P2 candidate
for a future compact summary if event teams become larger; no G.4 correctness
defect was found.

## 11. Navigation and information architecture

The authenticated desktop navigation currently gives equal or near-equal weight
to Status, Projects, People, Messages, Community, AI Evals, Winners, Start a
submission, and My Projects, with role links added for judges/admins. On a
390px viewport the menu collapses successfully and does not overflow, but the
desktop hierarchy still asks returning participants to choose between too many
destinations before reaching work.

Recommendations for H.1 (not implemented here):

- make My Projects and current project work the participant primary;
- group People, Messages, Community, and Account as personal/community
  destinations;
- keep AI Evals and Winners discoverable but lifecycle-aware rather than equal
  to active project work;
- make “Start a project” contextual for authenticated users and submission
  lifecycle;
- preserve role-aware admin/judge landing and all existing routes.

This is the strongest remaining participant friction and is the selected H.1.

## 12. Terminology audit

| Concept | Preferred participant term | Internal/backend term | Finding |
| --- | --- | --- | --- |
| Work item | Project | Submission row | Use Project in participant navigation/cards; retain Submission in API/admin contexts. |
| Person who started/controls a project | Team lead | Submission owner / owner membership | G1–G4 are consistent in participant surfaces; legacy Account/admin copy still says owner. |
| Listed people | Teammates / Team lead | `team_members` | Keep role terms; do not expose roster-table language. |
| Private collaboration permission | Project access | `submission_memberships` | G4 is clear and should remain canonical. |
| Editable private link | Private project link / recovery details | Edit token | Keep token behind Recovery details; avoid token-first framing for signed-in participants. |
| Review surface | Judge-facing Preview | Preview projection | Canonical in G3–G5; workspace preview intentionally uses “Workspace preview.” |
| Commitment | Submit for judging | Finalize/finalization | Use Submit in participant CTAs; reserve Finalize for admin/internal contexts. |
| Post-submit lifecycle | Submitted, Judging, Results pending, Results available | `draft`, `finalized`, `locked`, publication rows | G2/G3 projection is strong; public gallery still renders lowercase “finalized.” |
| Account handoff | Save to My Projects / Claim project | Claim transaction | Claim copy is understandable; recovery form necessarily names Project ID and private edit token. |

Remaining drift is concentrated in compatibility/public gallery code and agent
prompts, not the primary participant path.

## 13. Visual continuity and density review

The contact sheet in `docs/participants/screenshots/h0/` was reviewed as one
family using the Impeccable Design audit lens. The landing, Start, handoff,
editor, Team, Preview, receipt, My Projects, People, Messages, and Community
surfaces share the dark surface system, warm accent, typography, card borders,
button hierarchy, and compact workspace shell.

Observed strengths:

- the project story editor feels materially shorter than its field count;
- Preview/Submit use a calm green readiness treatment rather than alarm-red
  warnings;
- Team invitation uses the same centered dialog language as finalization;
- mobile screenshots remain single-column and readable;
- empty People/Messages/Community states explain the next action.

Observed drift:

- authenticated navigation is visually busier than page content;
- the public legacy gallery uses `finalized` while participant cards use
  Submitted/Judging/Results pending;
- Team Chat, Community, and Messages each retain their own empty-state
  framing; they are individually good but could share a single personal/social
  pattern in H.1;
- the guest handoff and private start page repeat some continuation choices.

No detector finding was returned by:

```text
npx impeccable detect --json components/Nav.tsx components/NavPublic.tsx
  app/start/StartClient.tsx app/account/projects/page.tsx
  app/submit/[token]/page.tsx app/submit/[token]/preview/page.tsx
  app/projects/[submissionId]/team/page.tsx app/people/page.tsx
  app/messages/page.tsx app/community/page.tsx
```

The detector result was `[]`; this is a technical signal, not a substitute for
human usability testing.

## 14. Mobile end-to-end

At 390×844, the H.0 clone covered landing, Start, project handoff, editor,
Team, Preview, Submit/confirmation, receipt, Messages, and Community. Every
captured route reported `document.documentElement.scrollWidth <= innerWidth`.

The mobile menu is discoverable and actions remain visible. The Team invitation
dialog switches into a usable narrow layout. The editor keeps textareas and
long URLs inside the viewport. No sticky control covered the captured content.

The remaining mobile opportunity is scroll efficiency on the long Team and
editor surfaces, not a broken layout.

## 15. Error and recovery journeys

| Failure | Observed behavior |
| --- | --- |
| Invalid public/private token | Clear “Project preview not found” / invalid-link copy; no project fields returned. |
| Anonymous My Projects | Sign-in explanation, no private project data. |
| Anonymous People/Messages/Community | Normal HTTP 307 authentication boundary. |
| Invalid private Team GET | Known production submission returned HTTP 401 without a bearer credential. |
| Wrong invitation account | Clone rendered signed-in identity and “Joining adds project access to this account” copy before acceptance. |
| Expired/revoked invitation | G4 qualified state says invitation expired/revoked and directs the lead to create a new link. |
| Stale editor | G5 qualified `409 STALE_PROJECT_EDIT`; browser values are preserved and no false Saved state is shown. |
| Save/network failure | G5 focused tests cover retained values and retry; no production mutation was attempted. |
| Deadline/freeze | G3/G5 qualified authoritative server-time denial and readable closed state; production has no configured deadline to mutate. |
| Revoked Team Chat access | G4 qualified workspace/API denial and measured native-chat revocation. |

No participant-facing error encountered in the audited path spoke in raw
SQLite, parser, authorization-key, judge-assignment, or score language.

## 16. Identity and guest/account boundaries

Generic login preserves safe `returnTo` for claim and invitation flows; role
aware admin/judge destinations remain separate. The invitation bridge does not
inject a session and explicitly tells the participant to check the signed-in
account. Fresh Viby behavior was not changed or bypassed.

Guest editing is coherent: the private link is important, but Account is
optional. Once a participant is authenticated, My Projects is the recovery
home and token mechanics are not shown in the normal card flow. Recovery details
remain available for guests and are intentionally disclosed, not silently
embedded in public pages.

## 17. Community, social, and empty states

The clone screenshots show useful empty states for People, Messages, and
Community rather than blank screens. Production currently has three public
profiles, zero direct-message conversations/messages, and zero community
messages. Anonymous users are correctly sent to login for private social
surfaces, so no fake production content was seeded.

The product opportunity is lifecycle-aware prominence: when an event has no
published results and little social content, project work should remain the
obvious center. This supports the H.1 navigation recommendation; it does not
justify new social features.

## 18. Event lifecycle and judge boundary

The current production event has no submission or judging deadline and remains
unfrozen. The clone used an open synthetic deadline for route/timing evidence;
G3/G5 controlled clones covered near-deadline, race, freeze, submitted, and
hard-lock states without relying on a browser clock.

Finalized/locked participant pages and result projections remain distinct from
publication. Draft projects are denied judge-visible work by the qualified G3
authorization tests. Participant payloads and screenshots contained no judge
IDs, assignments, scores, private notes, calibration state, or admin lifecycle
data. Judge workspace code keeps Team Chat, DMs, and Community-private data out
of its projections.

## 19. Performance journey smoke

Measured in the disposable clone with production build and local HTTPS proxy;
these are bounded navigation timings, not a performance benchmark:

| Surface | Observed range |
| --- | ---: |
| Landing | 1,439–1,939 ms |
| Start | 804–1,240 ms |
| Project handoff | 780–1,235 ms |
| Editor | 800–1,207 ms |
| Preview | 828–1,384 ms |
| Team | ~1,017 ms |
| Team Chat | ~1,064 ms |
| My Projects | ~1,132 ms |
| People / Messages / Community | ~717–958 ms |

G5’s prior focused smoke measured editor initial load ~1,381 ms, save ~306 ms,
section navigation ~88 ms, and Preview ~363 ms. No H.0 trace showed a new
participant-visible N+1 or a materially slower outlier. No performance
infrastructure was added.

## 20. Accessibility and supportability

The journey review checked heading progression, visible labels, descriptive
links, dialog semantics, focusable invitation dialog, save/readiness status
copy, and mobile touch-scale controls. The invitation dialog exposes
`role=dialog`/`aria-modal`, and the editor uses label/description associations.
Mobile overflow was false on all captured routes.

Page names are supportable: “My Projects,” “Team,” “Team Chat,” “Judge-facing
Preview,” “Submit for judging,” and “Project submitted” are all visible in the
primary path. The remaining supportability improvement is reducing the number
of top-level destinations a participant must name or choose.

## 21. Obsolete/duplicate UX candidates (not removed)

- Compatibility `/submission/:id` page alongside canonical `/project/:id`.
- Public gallery lowercase `finalized` badge alongside participant lifecycle
  labels.
- Agent prompt/internal completion language using “submission” and edit-token
  terminology.
- Repeated browser/agent continuation choices across `/start` and
  `/submit/:token/start`.
- Repeated People/Community links in both My Projects and global navigation.

These are cleanup candidates for H.1, not H.0 implementation work.

## 22. Participant journey scorecard

| Stage | Rating | Evidence / next step |
| --- | --- | --- |
| Event discovery | Strong | Clear landing and public project path. |
| Starting project | Strong | Account-optional Start and concise initial form. |
| Guest recovery | Acceptable | Private-link/recovery copy is safe; token vocabulary can be softened later. |
| Account claim | Strong | Explicit Save-to-My-Projects confirmation and safe login return path. |
| My Projects | Strong | Work-first lifecycle/attention/action card hierarchy. |
| Project editing | Strong | Story structure, section progress, partial saves, and stale-write protection. |
| Team formation | Acceptable | Correct separation of roster, access, invitations, and eligibility; operational density remains. |
| Invitations | Acceptable | Secure expiring private link and wrong-account bridge; manual copy is intentional. |
| Team collaboration | Strong | Team Chat authorization and revocation were qualified; no private data leak. |
| Profile / discovery | Acceptable | Useful clone empty state; production has few discoverable profiles. |
| DMs | Acceptable | Empty state is understandable; no production conversations. |
| Community | Acceptable | Empty state is understandable; no production messages. |
| Preview | Strong | Judge-facing language, safe fields, readiness, and deep links. |
| Readiness | Strong | Centralized required/eligibility projection. |
| Submission | Strong | Consequence copy, confirmation, idempotency, server authority. |
| Post-submit | Strong | Receipt, submitted workspace, My Projects state. |
| Results | Acceptable | Publication gating is safe; positive published state remains synthetic/previously qualified. |

## 23. Prioritized findings

### P0 — none

No security or correctness blocker was found. In particular:

- no private roster or project payload leaked anonymously;
- edit-token boundaries remained intact;
- stale browser saves cannot overwrite newer hosted agent state;
- submission/deadline/freeze authority remains server-side;
- draft judge access is denied;
- publication remains unpublished;
- Team Chat remains membership-authorized.

### P1 — navigation / information architecture overload

Evidence: authenticated desktop screenshots show Status, Projects, People,
Messages, Community, AI Evals, Winners, Start a submission, and My Projects in
one primary navigation band. Persona: returning team lead and teammate.
Severity: major but bounded confusion/friction; work is still reachable and
My Projects itself is strong. Remedy: H.1 navigation grouping and lifecycle-aware
emphasis, preserving routes and role-aware admin/judge behavior. Scope: bounded
navigation/components/CSS/copy pass; no domain or schema change.

### P2 — vocabulary and compatibility drift

Evidence: public gallery uses “finalized,” agent prompt uses “submission,” and
guest recovery uses “edit token” while primary participant cards use Project,
Submitted, Team lead, and Judge-facing Preview. Remedy: canonical copy table,
public compatibility labels, and agent/recovery helper copy. Scope: small
cross-screen copy pass.

### P2 — social/community prominence in low-content events

Evidence: production has zero DMs and zero Community messages and only three
profiles, while authenticated navigation gives those destinations equal weight
to active project work. Remedy: lifecycle-aware secondary grouping and stronger
empty-state entry hierarchy. Scope: included in H.1; no new social features.

### P2 — repeated guest handoff choices

Evidence: `/start` creation state and `/submit/:token/start` both explain
browser/agent continuation. Remedy: make the first state a concise bridge and
the private start page the durable detailed handoff. Scope: optional H.1 polish.

### P3 — legacy route cleanup

Evidence: `/submission/:id` remains alongside canonical `/project/:id`. Remedy:
document canonical URLs, preserve compatibility, and later add measured
redirect/deprecation handling. Scope: future maintenance.

## 24. Production-safe boundary and cleanup

Production checks were anonymous/read-only. No production project was created,
edited, claimed, invited, messaged, submitted, reopened, or published. The H.0
clone used a copy of the Kentucky fixture plus three disposable missing-table
migrations needed for People/Messages/Community route rendering; the clone
passed integrity/FK checks before use. Temporary app/proxy processes were
stopped after the journeys. The standing Kentucky Vibes deployment was not
replaced or modified.

The audit scripts are bounded tooling only:

- `scripts/h0-browser-audit.mjs`
- `scripts/h0-team-audit.mjs`
- `scripts/h0-mobile-audit.mjs`
- `scripts/h0-submit-audit.mjs`
- `scripts/h0-claim-audit.mjs`

They must not be pointed at production credentials or a production database.

## 25. Recommended next phase

**H.1 — Navigation / Information Architecture Cleanup**

This is the single strongest remaining participant issue. It should consolidate
project work as the primary authenticated path, group social/personal
destinations, make AI Evals/Winners lifecycle-aware, and remove duplicate or
obsolete emphasis without changing routes, authorization, Chatto, Viby, judging,
publication, or project business rules.

## Final disposition

**GO FOR H.1 — Navigation / Information Architecture Cleanup**

No P0 was found, and the H.0 audit is complete. No H.0R correctness phase is
required.

## H.1 follow-up — navigation / IA cleanup

H.1 implemented and qualified the bounded remediation recommended above. The
participant navigation now gives authenticated participants a clear hierarchy:
`My Projects` first, `Projects` direct, `Community` and `Messages` visible but
secondary, and lower-frequency event destinations grouped under `Explore`.
`Start a project` is shown only while the server-authoritative event is open
and unfrozen. `Results` appears only for a published or archived D.4 release;
the legacy event `winnersPublishedAt` field is not used to imply publication.

The active project shell marks global navigation as secondary while preserving
the visible `← My Projects` return path and local Overview / Team / Team Chat /
Preview / Submit tabs. Account actions now include Profile and Account. Admin
and judge navigation branches remain separate, Team Chat remains project-local,
and unread Messages stays directly discoverable. The anonymous menu avoids
private People/Community dead ends.

H.1 used a disposable Kentucky clone with open, deadline-passed, and published
release fixtures. Desktop, 1024px, and approximately 390px mobile journeys
passed; no production data, event state, Chatto, or Viby state changed. Full
details, fixture hashes, screenshot contact sheet, focused tests, and remaining
limitations are recorded in
`docs/participants/PHASE_H1_NAVIGATION_INFORMATION_ARCHITECTURE.md`.

H.1 disposition: **GO — H.1 NAVIGATION / IA READY FOR PRODUCT REVIEW**. The
recommended next operator action is **RECOMMEND DEPLOYING H.1 TO PRODUCTION**
as a separately controlled deployment; this audit phase itself did not deploy.

## H.1B production follow-up

H.1 was deployed and qualified as an application-only immutable release. The
production navigation now uses the participant IA documented above; anonymous
read-only smoke showed Projects, Explore, Start a project, and Log in, with
publication-aware Results omitted while the D.4 release is calculated. No
participant credential or synthetic production account was created, and the
isolated H.1 authenticated, mobile, role, and event-state evidence remains the
positive-path qualification source.

The canonical production DB remains
`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`; Chatto,
Viby, publication, judging, project data, and event state were unchanged. The
full isolated suite passed 325 tests across 62 files. The expected Viby
conflict diagnostic is asserted by the migration-policy test and reproduces on
the prior G.5B release; it is not a deployment blocker.

See `PHASE_H1B_PRODUCTION_DEPLOYMENT.md` for the backup, package fingerprint,
PID/Ready evidence, privacy checks, screenshots, and rollback procedure.

H.1B disposition: **GO — H.1 NAVIGATION / IA DEPLOYED AND QUALIFIED**. Next
direction: **HOLD — observe real participant use**.

## H.2 observability follow-up

H.2 added and H.2B deployed a bounded, event-scoped participant observation
layer and optional feedback path. It intentionally excludes arbitrary
clickstream, tokens, IPs, full user agents, project/chat/message content,
Better Auth IDs, and Viby assertions. The admin-only dashboard uses fixed
journey signals, authoritative derived counts, bounded friction reasons, coarse
device class, and truthful denominators. Production activation began at
`2026-08-10T20:49:56Z`; the initial read-only smoke produced only four
anonymous Start signals and no feedback.

See `PHASE_H2B_PRODUCTION_DEPLOYMENT.md` and
`../runbooks/PARTICIPANT_EXPERIENCE_OBSERVABILITY.md`. H.2 disposition:
**GO — H.2 OBSERVABILITY / PARTICIPANT FEEDBACK DEPLOYED AND QUALIFIED**.
The recommended next direction is **HOLD — observe real participant use before
defining H.3**; synthetic Kentucky evidence must not trigger another UX phase.

## H.3 pre-event activation follow-up

Because there was no practical participant population from which to draw H.2
behavioral conclusions, H.3 addressed the separate bounded question of whether
the product feels intentional at event opening. It added shared participant-
first empty-state guidance, authoritative landing lifecycle orientation, and
truthful direct unpublished Results handling. Disposable open/sparse/active/
closed/published Kentucky snapshots and desktop/mobile journeys passed without
fake production content or a new telemetry taxonomy.

See `PHASE_H3_PRE_EVENT_ACTIVATION_EMPTY_STATES.md`. H.3 disposition:
**GO — H.3 PRE-EVENT ACTIVATION / EMPTY STATES READY FOR PRODUCT REVIEW**;
recommendation: **RECOMMEND DEPLOYING H.3 TO PRODUCTION** after operator
approval. Production remains on H.2 until a separate deployment phase.
