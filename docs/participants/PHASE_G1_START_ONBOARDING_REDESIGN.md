# Phase G.1 — Start / Onboarding Redesign

Status: qualified for product review in the isolated Kentucky Vibes
environment. Production was not changed.

Review URL: <https://kentucky-vibes-f0b.ggg.ad>

## 1. Starting state

G.0 found no P0 participant blockers and identified four P1 friction areas:

1. the first screen led with Submission ID/edit-token mechanics;
2. team terminology exposed ownership/roster distinctions;
3. the agent handoff assumed API knowledge;
4. workspace tabs were difficult to discover on mobile.

G.1 keeps the existing submission-first policy. A participant can create a
guest project draft, save the private recovery details, continue manually or
with a coding agent, and optionally claim the project to an account. No account
or profile is mandatory for creating or submitting a project.

## 2. Route and transition map

| Surface | Participant story | Result / gate |
| --- | --- | --- |
| `/` | Start your project | Public landing; CTA goes to `/start` |
| `/submit` | Compatibility entry | Server redirect to `/start` |
| `/start` | Start your project | Open event: short Team lead form; closed event: closed-state explanation with Explore, Resume, and Status links |
| `/start/resume` | Resume a project | Project ID + private edit token; successful resume returns to the private project-start route |
| `/register-team` | Start your project | Authenticated/GitHub ownership variant; same Team lead language; closed-state gate |
| `/submit/:token/start` | Your project is ready | Optional Save to My Projects, manual form, coding-agent setup, team eligibility, recovery via the private URL |
| `/submit/:token` | Project form | Private edit form; Recovery details disclosure; Save, Preview, and Submit for judging actions |
| `/submit/:token/team` | Your team | Team lead, Teammates, invitations, Project access, and eligibility summary |
| `/submit/:token/preview` | Project preview | Private review of project/team details, readiness, evidence, and Submit for judging confirmation |
| `/submit/:token/done` | Project submitted | Receipt, judging-next-steps, Review project, public-page/browse links, optional account save, and secondary recovery details |
| `/claim` | Save an existing project | Enter private project details; starts the account-claim transaction |
| `/claim/confirm` | Save this project? | Explicit confirmation; success returns to My Projects |
| `/login` | Sign in | Safe `returnTo`; ordinary authenticated users land on `/account/projects`, while admin/judge routing remains role-aware |
| `/account/projects` | My Projects | Work-oriented home: readiness, team role, Team Chat, next actions, and secondary profile prompt |
| `/projects/:submissionId` | Project workspace | Overview, Team, Team Chat, Preview, Submit, Activity, and Results routes with explicit project access |
| `/projects/join` | Join a project | Invitation-aware sign-in/confirmation; explains Team lead and private project access without backend terminology |
| `/people`, `/messages`, `/community` | Discover and collaborate | Existing F.1–F.3 participant surfaces remain optional, contextual destinations |

The existing edit-token route remains the security authority. G.1 changes the
way it is explained, not what it authorizes.

## 3. Canonical participant vocabulary

- **Project**: the participant's work in progress.
- **Submission**: the act/state of sending a project for judging; retained in
  readiness and receipt contexts where it is precise.
- **Team lead**: the person who registered and initially controls the private
  project draft.
- **Teammates**: the people listed on the project team.
- **Project access**: an account that has accepted an invitation and can open
  the authenticated project workspace.
- **My Projects**: the signed-in participant's work-oriented home.
- **Preview**: the private review of what project details and team information
  organizers/judges will use after submission.
- **Submit for judging**: the primary final action; submitting locks the
  project according to the existing policy.

Backend names such as `submission_owners`, roster rows, and membership roles
remain in the domain and APIs. They are not the primary participant story.

## 4. `/start` and draft-created transition

The open-event `/start` form now says **Start your project** and groups fields
into **Project** and **Team lead**. Badge guidance is participant-facing:
“Used to verify event participation and prize eligibility.” The primary action
is **Create project**. The form still explicitly says that no account is
required to begin.

After creation, the first-run page says **Your project is ready** and explains
that a private draft was created. The order is:

1. **Save this project to My Projects** — optional, benefit-led account bridge;
2. **How would you like to continue?** — browser form or coding agent;
3. team eligibility;
4. three-step agent handoff and prompt controls;
5. Recovery details.

The account bridge says a participant can save the project, collaborate with
the team, and return from any device. It never implies that claiming submits a
project or grants privileged access.

## 5. Recovery model

`/start/resume` uses **Resume a project**, **Project ID**, and **Edit token**.
The private token is described as a credential: anyone with it can edit the
project, so it must be kept safe. A participant who already saved a project is
directed to **My Projects**.

The project-created and receipt screens place the Project ID, token, and
copyable private project link under **Recovery details**. The UI does not ask a
participant to construct a URL manually. No email-recovery promise was added;
the participant is told exactly what to save instead.

## 6. Team formation and invitations

The private team editor and authenticated workspace now use:

- **Team lead** for the registered person;
- **Teammates** for additional listed people;
- **Listed on team** when a person has no project-access account;
- **Project access** and **Access active/Access revoked** for invitation-backed
  accounts.

The eligibility summary translates the authoritative checks into team size,
badge details, prize eligibility, and a specific “Still needed” explanation.
Maximum team size, badge completeness, trainee status, and replace-style roster
semantics are unchanged.

Invitation copy explains that the team lead can send a private, expiring link.
Joining grants private project access; it does not grant admin or judge access.
The UI does not attempt to merge accounts or silently change the listed team.

## 7. Manual and coding-agent paths

The explicit choice remains, but the cards use outcomes:

- **Fill out the project form** — complete the project in the browser and add
  teammates there;
- **Use a coding agent** — give Codex, Claude Code, Cursor, OpenCode, or another
  coding agent a private prompt that can prepare the hosted project.

The agent card has a direct **Copy agent prompt** link to the setup section.
The setup section teaches three steps:

1. Copy the private prompt.
2. Give it to the coding agent.
3. Return here to review and submit.

The full prompt is behind **View the prompt contents (advanced)**. Copying it
still preserves the qualified hosted API contract: submission/project ID,
bearer edit credential, base/edit/preview URLs, replace-style complete roster,
no invented teammates, no finalization without explicit human instruction,
and a safe preview URL on return. The prompt continues to warn that the token
must not be shared or logged.

Manual editing and agent-assisted updates remain switchable. The agent cannot
finalize merely because the prompt was copied.

## 8. My Projects and workspace IA

Ordinary login now lands on `/account/projects`. My Projects remains work-first,
not an admin dashboard. Each card shows project/team, lifecycle state (Draft,
Ready to submit, or Submitted), readiness, team role, Team Chat/unread state,
and a next action such as Open workspace, Continue editing, Preview, or Team
Chat. Profile/People prompts remain secondary.

The project workspace tab order is now:

`Overview · Team · Team Chat · Preview · Submit · Activity · Results`

The `messages` route is unchanged; its participant-facing label is **Team
Chat**. At mobile widths the first row exposes the core Team, Team Chat,
Preview, and Submit actions with compact spacing and a visible “Swipe for more
project sections” cue. No route or authorization boundary changed.

Communication surfaces retain distinct descriptions:

- Team Chat — private conversation with the project team;
- Messages — private person-to-person conversations;
- Community — event-wide discussion.

## 9. Preview, finalization, receipt, and closed states

Private preview copy now says participants are reviewing the project details
and team information organizers and judges will use after submission. The
primary action is **Submit for judging**. Confirmation explains that submission
sends the project for judging and locks it for edits.

The receipt says **Project submitted**, explains that the project is ready for
judging, and offers Review project, View public page (when applicable), Browse
projects, and optional account save. The private project link is secondary
Recovery details.

When the event is closed, `/start` no longer presents a disabled registration
form. It says **Submissions are closed**, links to Explore projects and event
status, and—because existing drafts remain resumable under current policy—also
offers Resume a project.

## 10. Browser qualification in Kentucky Vibes

The named tunnel and isolated database remained active:

`https://kentucky-vibes-f0b.ggg.ad`

The event is currently past its submission deadline. Therefore no new draft,
claim transaction, invitation, or finalization mutation was created. Existing
synthetic draft/workspace data was used for browser qualification.

Verified journeys and observations:

- closed-event `/start` state: clear closed explanation, Explore, Resume, and
  Status actions;
- `/start/resume`: Project ID/edit-token form, safe error copy, My Projects
  return path;
- existing draft → project-ready handoff: Save card, browser/agent choice,
  team eligibility, three-step return guidance, advanced prompt disclosure;
- existing draft → Team: Team lead/Teammates/eligibility language;
- existing draft → private preview: Project preview and team information;
- synthetic participant login → My Projects → project workspace → Team → Team
  Chat → Preview/Submit tabs;
- `/projects/join` unavailable state remains generic and safe;
- mobile viewport approximately 390×844: no horizontal overflow on all checked
  onboarding, project, workspace, Team Chat, Community, and My Projects routes;
- desktop viewport approximately 1440×1000: hierarchy and CTA order reviewed;
- the project-ready account-save card stacks on mobile, and the core workspace
  actions are visible in the first mobile tab row.

Screenshots are stored in
[`docs/participants/screenshots/g1/`](screenshots/g1/):

- desktop: closed Start, Resume, project-ready handoff, Team, private Preview,
  login, My Projects, workspace, Team, Team Chat, Community, and People;
- mobile: the same key handoff, Team, Preview, My Projects, workspace, Team
  Chat, and Community surfaces.

The positive open-event guest-create and account-claim mutations were qualified
after this audit in the disposable open-event clone documented in
[`PHASE_G1A_OPEN_EVENT_QUALIFICATION.md`](PHASE_G1A_OPEN_EVENT_QUALIFICATION.md).

## 11. Accessibility and security

- form labels and badge helper text remain associated with controls;
- recovery details use a native disclosure and copyable state;
- the agent prompt is not exposed in the first viewport by default;
- CTA hierarchy is not color-only, and mobile controls remain reachable;
- private edit tokens remain bearer credentials and are not placed in generic
  logs or public projections;
- claiming still uses the existing bound transaction/cookie flow;
- invitation acceptance, Better Auth, Viby fresh verification, CSRF,
  submission ownership, and project membership authorization are unchanged;
- profile/community/DM and Team Chat permissions are unchanged.

## 12. Tests and checks

- focused G.1, submission-first, and login-routing tests: **12 passed**;
- full unit suite: **294 passed across 57 files**;
- TypeScript: passed;
- production build: passed;
- changed-file ESLint: passed with only existing `<img>` advisory warnings;
- `git diff --check`: passed;
- Impeccable static detector: no new deterministic findings in the changed
  onboarding surfaces (existing global CSS advisories remain outside this
  slice);
- desktop/mobile browser screenshots and overflow checks: passed on the
  isolated tunnel.

## 13. Production recommendation

Production was not deployed or modified in G.1A. The open-event clone passed
guest creation, recovery, manual editing, hosted agent update, claim and
cross-device return, wrong-account denial, resume, finalization, and mobile
checks. No production database, Chatto, or Viby work is part of that phase.

**GO — G.1 START / ONBOARDING READY FOR PRODUCTION DEPLOYMENT.**

See the G.1A qualification document for the isolated clone details, exact
synthetic data provenance, screenshots, cleanup, and deployment recommendation.

## 14. G.1B production deployment

G.1B deployed the qualified application release to
`https://vibe-hackathon-dev.ggg.ad` on 2026-08-09. G.1 required no schema
migration. The immutable release, backup, process evidence, anonymous `/start`
and `/start/resume` smoke, safe anonymous claim-routing check, mobile overflow
check, and business-table preservation are documented in
[`PHASE_G1B_PRODUCTION_DEPLOYMENT.md`](PHASE_G1B_PRODUCTION_DEPLOYMENT.md).

No production project, claim, account, invitation, or finalization mutation was
created. The bounded invalid-resume denial produced one expected audit event;
all participant business tables and publication state were preserved. Kentucky
Vibes remains active for review, and Chatto/Viby were not changed.

**GO — G.1 START / ONBOARDING DEPLOYED AND QUALIFIED.**

## G.2 follow-up

G.2 extends the G.1 participant continuity model through a refined
`/account/projects` home. The new page keeps project work first, maps
authoritative state to Draft/Needs attention/Ready to submit/Submitted/Judging/
Results pending/Results available, and gives each card one deterministic next
action. Profile, People, and Community discovery remain secondary. See
[`PHASE_G2_PARTICIPANT_HOME_MY_PROJECTS.md`](./PHASE_G2_PARTICIPANT_HOME_MY_PROJECTS.md)
for the projection, screenshots, browser qualification, and production
recommendation.
