# Phase G.0 — Participant Journey Audit

**Audit date:** 2026-08-09
**Scope:** read-only product, route, architecture, and UX audit
**Reviewed environment:** [Kentucky Vibes](https://kentucky-vibes-f0b.ggg.ad)
**Production impact:** none

This audit follows one participant from first discovery through team formation,
project completion, collaboration, submission, and post-submission use. It uses
the current application code plus browser-driven walkthroughs of synthetic
Kentucky Vibes accounts. No application code, database row, Kentucky fixture,
Chatto service, or Viby service was changed.

## Executive finding

The platform is capable and coherent after sign-in. A participant can discover
the event, create a private draft, choose a manual or agent-assisted path, enter
a project workspace, collaborate in Team Chat/DMs/Community, preview, and submit.
The strongest surfaces are My Projects, the workspace readiness panel, and the
F.0–F.3 collaboration loop.

The weak point is the handoff into that experience. The anonymous start flow
still exposes a token-and-recovery model before it explains the durable value of
an account. Team formation exposes backend distinctions, and the workspace has
more tabs than a first-time participant can comfortably hold in mind. These are
not safety blockers, but they create avoidable uncertainty for solo builders,
late teammates, and participants who are not already comfortable with API/agent
workflows.

The smallest high-value next phase is a bounded **Start / Onboarding redesign**:
keep submission-first and optional claiming, but make the first-run promise,
save/recover path, team model, manual/agent choice, and return-to-workspace path
much clearer.

## 1. Current participant architecture

The current product has four related but distinct surfaces:

| Surface | Participant-facing purpose | Authority boundary |
| --- | --- | --- |
| Public event | Discover the event, projects, status, AI evaluations, and winners | Public-safe projections |
| Submission draft | Start and complete a project before authentication | Submission ID + private edit token |
| Account workspace | Durable identity, claimed projects, profile, People, DMs, Community | Better Auth session and event participation |
| Project workspace | Work on one project with its team | Owner/teammate membership and edit policy |

Communication is intentionally separated:

- **Team Chat** — private conversation for one project team.
- **Messages** — private person-to-person conversations.
- **Community** — event-scoped shared channels.

The separation is technically sound and was preserved during this audit. The
remaining issue is teaching it once, at the moment it matters, instead of
requiring a participant to infer it from several navigation labels.

### Route map observed in code and browser

```text
Anonymous visitor
  /
  ├─ /status                event state
  ├─ /projects              public project gallery
  ├─ /project/:id           public project
  ├─ /winners               published results (when available)
  ├─ /ai-evals              public evaluation material
  ├─ /start                 participant entry / closed-state gate
  ├─ /start/resume          recover a draft with ID + edit token
  ├─ /register-team         team registration form
  ├─ /submit/instructions   submission guidance
  ├─ /login                 Better Auth/Viby/password login
  └─ /people/:handle        public profile (when public)

Submission-first path
  /start → register team lead → private draft
  ├─ /submit/:token/start       choose manual or AI-agent completion
  ├─ /submit/:token             edit project
  ├─ /submit/:token/team        manage roster and eligibility fields
  ├─ /submit/:token/preview     private draft preview
  ├─ /submit/:token/done        post-finalization receipt
  └─ /claim /claim/confirm      optionally attach draft to an account

Authenticated participant
  /account
  ├─ /account/projects           My Projects
  ├─ /account/profile            durable identity editor
  ├─ /account/profile/preview    public-safe private preview
  ├─ /people                     event-scoped People directory
  ├─ /messages                   direct-message inbox
  └─ /community                 event community channels

Claimed project workspace
  /projects/:submissionId
  ├─ /team                       roster and workspace access
  ├─ /messages                   project Team Chat
  ├─ /activity                   project activity
  ├─ /preview                    workspace preview
  ├─ /submission                 submission detail/readiness
  └─ /results                    participant results state
```

There are also invitation/join routes (`/invite/accept`, `/projects/join`),
account recovery (`/recover`), and privileged admin/judge routes. The latter
were checked only as boundaries and are not part of the participant IA.

## 2. Persona walkthroughs

### A. Solo builder

**Observed path:** `/` → `/start` → team lead form → private draft →
`/submit/:token/start` → manual or agent path → edit → preview → finalize.

This is the shortest successful path and it does not require an account. The
trade-off is that the first durable artifact is a Submission ID and private edit
token. The participant must understand that the token is a credential, save it
outside the browser, and later decide whether to claim the draft. Account value
arrives after the hardest recovery decision.

**Assessment:** works for a technically confident solo builder; needs work for a
first-time participant. The product should explain the benefit of claiming
without making login a gate.

### B. Existing team lead

The lead registers an owner-only draft, opens Manage Team, adds teammates, and
then completes the project manually or with an agent. The current roster flow
supports prize eligibility, degrees, affiliation, and trainee status, but copy
such as “Ownership type: Badge owner”, “roster”, and “workspace members” makes
the participant learn internal distinctions before they can focus on the build.

The agent path is useful here: the current prompt switcher supports initial
setup, current-roster revision, and a deliberately destructive Reset Roster
confirmation. That is a strong capability, but the decision screen is dense.

**Assessment:** functionally strong; P1 terminology and CTA hierarchy issue.

### C. Teammate invited later

The teammate arrives through an invitation or join link, signs in or creates the
intended account, confirms the join, and then finds the project through My
Projects. Invitation copy correctly prevents silent account switching and
account merging, but “Sign out before accepting” and the distinction between
an invitation, a roster entry, and active workspace access are high-friction
moments.

**Assessment:** safe and explicit; needs a clearer “what happens next” bridge and
less implementation vocabulary.

### D. Returning participant

The returning participant signs in, lands in Account, and can navigate to My
Projects, profile, People, Messages, or Community. Existing projects are easy
to find once My Projects is open. The current post-login destination is account-
centric rather than work-centric.

**Assessment:** My Projects is the better participant home; Account should remain
the settings/identity hub.

### E. Community/discovery-first participant

An anonymous visitor can open a public profile, but `/people` is authenticated-
only. After login, People → public profile → Message is a natural loop, and
Community links back to People. A participant without active event-participation
evidence cannot use event-scoped Community, which is correct but not obvious
until access is denied.

**Assessment:** F.0–F.3 is coherent after authentication. Add a restrained
account-value bridge; do not add a forced product tour.

### F. Anonymous participant who claims later

The participant creates a draft, chooses “Claim later”, and later uses the claim
flow to attach it to an account. This is privacy-safe and preserves the
submission-first promise, but the flow crosses `/submit/:token/start`, `/claim`,
`/claim/confirm`, cookies, and a possible `claim=expired` recovery state.

**Assessment:** valuable policy; too many concepts are exposed at once. Keep the
capability, simplify its explanation and make the return destination explicit.

## 3. Authentication timing and account value

### Policy assessment

The current submission-first policy remains the best compromise for this event:

- Requiring login before draft creation would add friction before a participant
  has experienced the product value.
- Fully guest-only completion makes recovery and collaboration unnecessarily
  fragile.
- Early account creation is useful, but should be an invitation with benefits,
  not a blocking gate.

**Recommendation for G.1:** continue allowing guest draft creation; offer an
optional “Save this project to your account” moment immediately after draft
creation and again when the participant enters the workspace. Explain that an
account unlocks My Projects, teammate collaboration, profile/project history,
People, Messages, and Community. Do not require profile completion or account
claiming to submit.

### Account value currently communicated

The value is present in My Projects (“Your project workspaces, readiness,
teammates, and conversations in one place”) and in Claim Draft (“find it from
any device without re-entering the Edit token”). It is not present early enough
in `/start`, where the participant is mainly told to keep a private credential.

Suggested concise promise for a future start/claim surface:

> Save your project to My Projects, collaborate with your team, and build a
> participant profile you can carry across hackathons.

This is more motivating and more honest than “Create an account to continue.”

## 4. `/start`, team formation, and agent handoff

### `/start` audit

The page is understandable at a basic level: “Start your submission”, team
name, team lead name, contact email, and owner badge number. In the current
Kentucky Vibes fixture the event is closed, so `/start` correctly shows the
closed-state gate rather than the form; the open-state copy was inspected in
code and prior qualification.

The following details are technically accurate but implementation-forward:

- “Submission ID” and “Private Edit token” are the first durable nouns after
  registration.
- “The Edit token is the private credential for this draft” is security-correct
  but not participant-motivating.
- “Outbound email is not available” explains an infrastructure limitation.
- `/register-team` explains badge/email ownership and recovery, but that reason
  is not integrated into the shorter `/start` story.

**Recommendation:** keep collection of the current fields and the private-token
security model, but phrase it as “Your private project link” first. Put the
technical ID/token details under a copyable “Recovery details” section.

### Manual versus agent path

The explicit choice is still valuable and distinctive. The two paths are
functionally equal, and users can return to the choice or use prompts later.
However, “Complete with AI Agent”, API Spec, REST API, MCP, `vibe.json`, and
provider names appear together. That makes the agent path look like a developer
integration rather than a guided way to prepare the project.

**Recommendation:** preserve the explicit choice, rename the cards toward the
outcome (“Fill out the project form” / “Use a coding agent to prepare it”), and
explain the agent path in three steps:

1. Copy the private prompt.
2. Give it to Codex, Claude Code, Cursor, or another coding agent.
3. Return to review the preview and finalize in Vibe Hackathon.

Keep API/MCP documentation available as a secondary link. Never remove the
agent workflow.

### Team vocabulary

Use a simple participant model in primary copy:

- **Team lead** — the person who registered and controls the project draft.
- **Teammates** — people listed on the project team.
- **Project access** — the people who can use the private workspace.

Retain owner/teammate permissions in badges and authorization logic, but avoid
leading with “ownership type”, “roster member”, “active membership”, or “email
matches never grant access”. The latter belongs in a short security explanation,
not the main team task.

## 5. My Projects and workspace IA

### My Projects

My Projects is currently the strongest candidate for the signed-in participant
home. The audited page has a clear title, one profile prompt, useful project
cards, readiness percentages, role labels, unread messages, and appropriate
empty states. It does not feel like an admin dashboard.

Recommended minimal participant home model:

1. Active project cards and their next action.
2. One profile/account-value prompt, only when relevant.
3. A quiet collaboration summary (team chat/unread state).
4. Lifecycle state: draft, ready, submitted, results pending, or results
   published.

Do not add all Community, People, or account security details to this page.

### Project workspace

The current desktop structure is clear: Overview, Team, Messages, Activity,
Preview, Submission, Results, with readiness and next actions in Overview. The
mobile implementation has no horizontal overflow, but the tab strip is wider
than 390px and only the first four tabs are initially visible. The existing
horizontal scrolling works, yet there is no obvious cue that Preview,
Submission, and Results are off-screen.

**P1 recommendation:** make the workspace information architecture more
scannable in G.1. The smallest option is to rename the project tab “Messages” to
“Team Chat” and add a bounded mobile continuation cue. A later information-
architecture option is to group tabs as:

```text
Work:       Overview · Submission · Preview
Team:       Team · Team Chat
Progress:   Activity · Results
```

Do not change authorization or route compatibility to achieve this.

### Preview and finalization

There are several valid previews:

- **Private draft preview** — token-based owner review before finalization.
- **Workspace preview** — authenticated project view of current hosted state.
- **Public project** — public presentation after publication/eligibility.
- **Public profile preview** — what an audience sees of a participant identity.

The implementation is safe, but repeating “Preview” without an audience label
creates ambiguity. Use audience-first labels in a future copy pass: “Draft
preview”, “Workspace preview”, and “Public project”.

Readiness is a strength: the workspace percentage/checklist and next actions
make missing work visible. The finalization boundary should additionally say,
in one place, what judges will see, what becomes locked, and which deadline
applies. The post-submit receipt currently emphasizes the edit token and “queue”
language; it should lead with the participant outcome and retain recovery
details as secondary information.

## 6. Communication and discovery surfaces

The three-way distinction is correct but currently distributed across nav and
workspace tabs:

| Label | Recommended one-line explanation |
| --- | --- |
| Team Chat | Private conversation with your project team |
| Messages | Private conversations with individual participants |
| Community | Event-wide channels for questions and collaboration |

The profile → Message flow is natural. Community → People → profile → Message
also works. People is authenticated-only by design; an anonymous click from the
top navigation goes to login, so the login state should explain that signing in
unlocks participant discovery rather than appearing to be a dead end.

New participants do not yet receive a strong reason to visit People or
Community. A single post-claim or My Projects card such as “Meet participants,
find collaborators, and share what you are building” is sufficient. Do not add a
tour, modal, or repeated prompt.

Profile timing should remain soft: after account claim or basic project setup,
offer profile completion and discovery as an optional identity step. Never make
profile completeness a prerequisite for project submission, team access,
judging, or awards.

## 7. Results and lifecycle language

The participant lifecycle should be expressed as one simple sequence:

```text
Draft → Ready to submit → Submitted → Judging in progress
      → Results pending → Results published
```

Before results are published, participant pages should say that results are
pending or withheld without exposing private judge state. After publication,
show results and publication-safe awards. My Projects and the workspace should
use the same lifecycle vocabulary.

The Kentucky Vibes fixture contained a finalized workspace that displayed
“RESULTS AVAILABLE” while the public winners page still indicated winners were
not published, and the token done page displayed historical 2025 dates. These
are synthetic fixture/lifecycle inconsistencies, not evidence of a production
data change. They are still useful audit findings: a shared participant results
state and current event dates should be used before the next major onboarding
work. Production remained unchanged and results remain unpublished.

## 8. Navigation audit

### Anonymous

The anonymous header exposes Status, Projects, People, AI Evals, Winners, Start
a submission, and Log in. This is complete and has no measured horizontal
overflow, but People is not available without authentication and Start can lead
to a closed-state page. Contextual copy should set expectations rather than
removing useful discovery links.

### Authenticated

The authenticated header adds Messages, Community, and My Projects. At 1440,
1280, 1024, 768, and 390px the measured document width matched the viewport;
the navigation collapses before it clips. This is a qualified responsive
baseline.

The hierarchy is nevertheless crowded. A future navigation model should make
the primary participant destinations visually dominant:

```text
Primary:    Projects · People · Community
Personal:   My Projects · Messages · Account
Event info: Status · AI Evals · Winners
Action:     Start a submission (only prominent while open)
```

This is a recommendation, not a G.0 implementation. Start a submission and My
Projects can remain separate: one is an acquisition/action CTA, the other is a
participant home. Their labels and visual weight should make that distinction
obvious.

## 9. Canonical participant vocabulary

The audit found these terms in participant-visible UI:

| Prefer | Use carefully or explain |
| --- | --- |
| Project | Submission when referring to the formal judging act/state |
| Team lead | Owner, where permission semantics must be precise |
| Teammate | Member, roster member, active membership |
| Project workspace | Draft edit link/token |
| Draft preview | Preview without an audience qualifier |
| Submit project | Finalize, when the action is the irreversible boundary |
| Save/recover project | Claim, when explaining account value |
| Team Chat | Messages in a project workspace |

“Submission” should remain in the formal checklist, API, and judging context;
“Project” should be the participant-facing object. “Finalize” should be paired
with a short explanation of what locks and what happens next.

## 10. Error and recovery UX

Current behavior is secure and mostly actionable, but the user-facing model is
more technical than necessary.

| Situation | Current route/copy | Audit assessment | Future remedy |
| --- | --- | --- | --- |
| Lost edit token | `/start/resume`, ID + token | Safe, but credential-heavy | Offer account claim/save earlier; call it private recovery details |
| Invalid token | “Draft not found / Check the private link” | Clear enough | Add one next action: restart or recover |
| Claim expired | `claim=expired` path | Safe but opaque | Explain that the browser claim handoff expired and restart claim |
| Account already claimed | claim/invite boundary | Correctly prevents takeover | Say which account to use without exposing another identity |
| Invitation accepted while signed in | asks user to sign out | Safe, but surprising | Explain account-switch risk before the action |
| Teammate removed/revoked | access boundary | Correct authorization | Explain workspace access ended and link to team lead/support |
| Finalization blocked | readiness checklist | Strong foundation | Say “Fix these project items before submitting” and show deadline |
| Profile handle conflict | actual server validation | Appropriate | Preserve candidate and show a next valid choice |
| DM unavailable | neutral messaging state | Privacy-safe | Explain only “Messaging is unavailable” and offer People/back |
| Community inaccessible | participant/event gate | Correct but abrupt | Show event-participation explanation and a return link |
| Session expired | login redirect | Normal | Preserve return destination and describe why sign-in is needed |

No P0 recovery blocker was found. The priority is translation and next-action
copy, not changing security boundaries.

## 11. Mobile journey

At approximately 390×844, the following authenticated and workspace routes were
walked end-to-end with no horizontal overflow: Account, My Projects, Profile,
People, Messages, Community, Community channel, project Overview, Team, Team
Chat, Activity, Preview, and Submission routes. Landing, start, login, and
public pages were also checked at mobile widths.

Strengths:

- forms stack cleanly;
- My Projects cards remain readable;
- workspace readiness and next actions stack naturally;
- Community and Messages intentionally become single-column experiences;
- navigation collapses without clipping.

Needs work:

- workspace tabs require horizontal scrolling and hide three important
  destinations without an affordance;
- token-based draft pages are long and expose many fields before a participant
  has established a mental model;
- the Account page is very long because recent sign-ins are displayed inline;
- mobile forms should keep the primary save/preview/finalize action visible as
  the participant progresses.

These are P1/P2 IA and continuity findings, not current overflow failures.

## 12. Kentucky Vibes browser walkthrough evidence

Synthetic-only walkthroughs used the standing environment and existing F.2/F.3
fixtures. No project, profile, community, DM, or production data was mutated.

### Anonymous route checks

`/`, `/status`, `/projects`, `/winners`, `/ai-evals`, `/submit`, `/start`,
`/start/resume`, `/register-team`, `/submit/instructions`, `/login`,
`/people`, `/people/alex-chen`, and `/project/kv_submission_0001` were checked.
Public routes loaded; `/people` correctly required authentication; public
profile/project routes remained public-safe. In the closed synthetic event,
`/submit` and `/start` showed the event-closed state rather than accepting a
new draft.

### Authenticated route checks

Using synthetic Maya Rivera credentials, Account, Profile, Profile Preview, My
Projects, People, Messages, Community, a Community channel, project Overview,
Team, Team Chat, Activity, Preview, Submission, Status, and Results loaded.
The People → profile → Message path and the Community channel path were both
reachable. No unexpected authorization escalation was observed.

### Token draft checks

An existing synthetic draft was inspected read-only at its start, edit, team,
preview, and done routes. The flow is complete, but the visible `Token:
edit_…`, repeated “Copy Agent Prompt” controls, roster eligibility wording,
and historical fixture dates support the onboarding findings above. No token was
copied into this document and no draft was changed.

### Responsive checks

Document scroll width matched viewport width at 1440, 1280, 1024, 768, and
390px navigation widths. At 390px the audited participant/workspace routes had
no horizontal overflow. The only deliberate wider element was the scrollable
workspace tab strip; its discoverability is the issue, not overflow.

## 13. Impeccable Design audit

The visual system is product-specific and consistent: dark professional event
surfaces, semantic CSS variables, orange action hierarchy, restrained cards,
and shared participant identity components. My Projects and the workspace have
good visual hierarchy; Account is more operationally dense.

The bundled static detector was run against representative Start, submission,
workspace, Account Projects, Community, and People UI targets and returned no
deterministic anti-pattern findings (`[]`). A URL detector pass could not run in
this environment because its optional Puppeteer dependency is not installed;
the visual/browser conclusions below therefore come from Playwright walkthrough
and screenshot review, not a claimed browser-detector result.

| Dimension | Score (0–4) | Evidence |
| --- | ---: | --- |
| Product-specific visual system | 3 | Consistent tokens, identity, and event language |
| Information hierarchy | 2 | Strong in workspace/My Projects; crowded start/workspace handoffs |
| Accessibility spot check | 3 | Named controls, visible labels, keyboard-safe navigation; not a full WCAG audit |
| Responsive behavior | 3 | No overflow at tested widths; hidden workspace tabs need a cue |
| Performance/continuity | 3 | Routes loaded at Kentucky scale; Account/session density and token flow add cognitive cost |
| **Overall** | **14/20** | Good foundation; onboarding and IA deserve the next bounded slice |

## 14. Journey scorecard

| Stage | Score | Evidence |
| --- | --- | --- |
| Discovery | Strong | Public landing, projects, status, AI evals, profiles, and winners are reachable |
| Starting | Needs work | `/start`, `/register-team`, `/submit`, and closed-state behavior create competing concepts |
| Authentication | Acceptable | Optional guest path is flexible; account value is explained too late |
| Team formation | Needs work | Secure but exposes owner/roster/access implementation distinctions |
| Project setup | Acceptable | Form is complete; breadth and token framing are demanding |
| Agent handoff | Needs work | Distinctive and safe, but expert-centric copy and dense secondary links |
| Workspace | Needs work | Strong Overview/readiness; seven tabs and mobile hidden destinations |
| Collaboration | Strong | Team Chat, DMs, Community, People, and profile loop are coherent after login |
| Finalization | Acceptable | Readiness is strong; judge-visible/locked/deadline explanation can improve |
| Post-submission | Acceptable | Receipt and workspace exist; recovery and queue language are technical |
| Results | Needs work | Shared lifecycle vocabulary needed; synthetic fixture states conflict |

## 15. Prioritized findings

### P0 — none

No finding prevents safe participation, leaks private data, or grants an
unauthorized role. Auth, profile privacy, event Community access, token checks,
and workspace boundaries remained intact during the audit.

### P1 — address in G.1

1. **Onboarding starts with mechanics instead of value.** The first-time
   participant receives a Submission ID/edit token before learning why an
   account, My Projects, collaboration, and profile are useful. Affects solo
   builders and anonymous-then-claim participants. Remedy: benefit-led account
   invitation and a simpler recovery-details explanation. Scope: bounded start,
   claim, and return-path copy/IA.
2. **Team formation terminology is too internal.** “Ownership type”, roster,
   workspace members, and active membership make the team model harder than it
   is. Affects team leads and late teammates. Remedy: Team lead, Teammates, and
   Project access in primary copy; preserve precise permissions underneath.
3. **Workspace navigation is wider than the participant mental model.** Seven
   tabs are coherent on desktop but conceal Preview/Submission/Results on
   mobile. Remedy: rename the project chat tab and add a bounded continuation
   cue or grouped IA; preserve routes. Scope: small workspace navigation slice.
4. **Manual/agent handoff needs an outcome-first bridge.** The current agent
   flow is powerful but assumes API vocabulary. Remedy: three-step agent
   explanation and a clear browser return checkpoint. Scope: copy/layout only.

### P2 — follow after G.1

- Use one shared participant results/lifecycle component and current event dates.
- Clarify audience for draft, workspace, and public previews.
- Add a single post-claim/My Projects discovery moment for People and Community.
- Make finalization explain judge-visible fields, lock behavior, and deadline.
- Reduce Account’s inline recent-session dominance, or move session detail into
  the Security section.
- Improve token/invitation/session-expiry recovery next actions.

### P3 — future

- Event-aware anonymous CTA wording when submissions are closed.
- Rebalance anonymous/authenticated navigation after observing use.
- Add richer post-submission feedback only after the results lifecycle is
  stable.
- Consider a more unified account/project home after usage evidence, not before.

## 16. Recommended G.1 scope

### G.1 — Start / Onboarding Redesign

Keep the current safe policy and implement the smallest coherent bridge:

1. Make `/start` the canonical participant entry and explain that it creates a
   private project draft/team, while resolving or clearly redirecting duplicate
   `/submit`/`/register-team` entry concepts.
2. Keep guest creation, but offer optional account save/claim immediately with
   benefit-led copy.
3. Reframe ID/edit-token details as private recovery details and make the next
   browser return path explicit.
4. Simplify Team lead/Teammates language while retaining backend roster and
   workspace authorization boundaries.
5. Keep manual versus agent completion explicit, with an outcome-first three-
   step agent handoff and a clear return-to-preview checkpoint.
6. Add the smallest workspace continuity fix: distinguish Team Chat from
   Messages and make mobile workspace tabs discoverable.

This is intentionally not a new participant subsystem, not a forced login, and
not a profile/community redesign. It is the bridge that lets the existing F.0–
F.3 capabilities feel like one product from first click to submitted project.

## Audit disposition

No production, application, database, Kentucky fixture, Chatto, or Viby changes
were made. The Kentucky Vibes demo remains active for review.

**GO FOR G.1 — START / ONBOARDING REDESIGN**

## G.1 implementation handoff

The bounded G.1 redesign was implemented in the isolated Kentucky Vibes
environment without changing the guest-first policy, account security, or
production. The follow-up implementation provides:

- a “Start your project” first-run story with Project and Team lead field
  groups and participant-language badge guidance;
- an optional “Save this project to My Projects” bridge immediately after draft
  creation, while keeping “Continue without an account” equally available;
- Recovery details disclosure with a copyable private project link and explicit
  warning that anyone with the link can edit;
- “Resume a project” wording for the Project ID/edit-token recovery route;
- Team lead, Teammates, Project access, and Team eligibility terminology across
  project setup and authenticated workspaces;
- outcome-first “Fill out the project form” and “Use a coding agent” choices;
- a three-step agent handoff, advanced prompt disclosure, and a visible
  return-to-preview checkpoint;
- My Projects as the ordinary signed-in landing page, with lifecycle-aware
  actions and Team Chat distinction;
- a mobile workspace tab order that keeps Team, Team Chat, Preview, and Submit
  in the first visible row, with a continuation cue;
- clearer preview, submission, receipt, invitation, and closed-event copy.

The positive guest-create and account-claim mutations were not run against the
review fixture because Kentucky Vibes is currently past its submission
deadline. Existing synthetic drafts were used to qualify the project-created,
manual/agent handoff, team, preview, resume, and workspace paths. An open-event
browser pass remains the final human check before production release.

## G.1A and G.1B closure

The open-event positive-path qualification was completed in the disposable
clone documented in
[`PHASE_G1A_OPEN_EVENT_QUALIFICATION.md`](PHASE_G1A_OPEN_EVENT_QUALIFICATION.md):
guest creation, recovery, manual editing, hosted agent update, optional claim,
cross-device My Projects return, wrong-account denial, and finalization all
passed. The bounded anonymous claim-routing defect was fixed and regression
tested.

G.1B deployed the application-only onboarding redesign to production after a
verified backup. No schema migration or production project/account/claim
mutation was required; `/start`, `/start/resume`, safe claim return routing,
and mobile overflow passed production smoke. Business-table hashes remained
unchanged. The remaining product recommendation is **G.2 — Participant Home /
My Projects refinement**, to be informed by real usage rather than started
automatically.
# G.2 follow-up

The participant-home recommendation from this audit was implemented and
qualified in [`PHASE_G2_PARTICIPANT_HOME_MY_PROJECTS.md`](./PHASE_G2_PARTICIPANT_HOME_MY_PROJECTS.md).
`/account/projects` now uses one lifecycle vocabulary, surfaces
participant-actionable attention, chooses one next action per project, sorts
urgent work first, and keeps profile/People/Community prompts secondary.

## G.2B production closure

G.2 was deployed and qualified in production with no schema migration and no
change to submission, membership, Team Chat, judging, publication, Chatto, or
Viby data. The remaining bounded participant friction is the submission
boundary: readiness, judge-visible preview, lock/deadline explanation, and the
post-submit receipt. The recommended next phase is **G.3 — Submission
Readiness / Finalization Experience**; it should not start automatically.

## G.3 follow-up

The submission-boundary work is documented in
[`PHASE_G3_SUBMISSION_READINESS_FINALIZATION.md`](PHASE_G3_SUBMISSION_READINESS_FINALIZATION.md).
It keeps project completeness, prize eligibility, and finalization separate;
clarifies the judge-facing Preview; and makes deadline and retry behavior
explicit without changing production business policy.

## G.3B production closure

G.3 was deployed and qualified with no schema migration or production business
mutation. The participant path now has server-owned readiness checks,
publication-safe judge boundaries, exact deadline enforcement, and
idempotent finalization. The remaining strongest participant friction is team
formation/invitation clarity; the next recommended bounded phase is **G.4 —
Team Formation / Invitations Experience**. See
[`PHASE_G3B_PRODUCTION_DEPLOYMENT.md`](PHASE_G3B_PRODUCTION_DEPLOYMENT.md).

## G.4 follow-up

G.4 was implemented and qualified in the isolated clone documented in
[`PHASE_G4_TEAM_FORMATION_INVITATIONS.md`](PHASE_G4_TEAM_FORMATION_INVITATIONS.md).
The Team lead/Teammates model, invitation handoff, claim-on-accept account
warning, roster-versus-access distinction, expiry/revocation copy, mobile
dialog, and Team Chat access revocation all passed bounded qualification. The
standing review environment and production remained unchanged. G.4 is ready
for product review with a recommendation to deploy.

## G.4B production closure

G.4 was deployed and qualified with no schema migration, no production team or
invitation mutation, and no change to roster/access, Team Chat, judging,
publication, Chatto, or Viby state. The next strongest bounded participant
friction is the project editing form itself; recommend **G.5 — Project Editing /
Submission Form UX** after product review.

## G.5 follow-up

G.5 reshaped `/submit/:token` around a project story, authoritative required /
optional metadata, section completion, partial draft saves, readiness links,
and a readable submitted/deadline-closed state. A migration-free edit
fingerprint protects a stale browser after a hosted agent update. The isolated
Kentucky Vibes clone passed the G.5 browser and regression qualification; see
[`PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md`](PHASE_G5_PROJECT_EDITING_SUBMISSION_FORM_UX.md).
Production remained on G.4B and was not deployed by this phase.

## G.5B journey update

G.1 through G.5 are now deployed and qualified across onboarding, participant
home, readiness/finalization, team formation, and editing. Production G.5B
preservation and read-only smoke passed without business-data mutation. The
next recommended work is **H.0 — End-to-End Participant Experience Audit** to
reassess remaining participant friction before another feature phase.
