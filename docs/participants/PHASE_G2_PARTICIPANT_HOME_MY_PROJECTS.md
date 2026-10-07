# Phase G.2 — Participant Home / My Projects Refinement

**Disposition:** GO — G.2 PARTICIPANT HOME READY FOR PRODUCT REVIEW
**Environment:** Kentucky Vibes isolated review only
**Review URL:** <https://kentucky-vibes-f0b.ggg.ad>

G.2 makes `/account/projects` the work-first home for an authenticated
participant. The page now answers, in the first viewport, what the participant
owns or joined, which project needs attention, and the single next action that
gets each project moving.

Production was not changed or deployed. Chatto and Viby remain unchanged.

## Starting experience

The previous page was a technically correct list of workspaces. It repeated
generic readiness badges, used database-order sorting, placed the profile card
above project work, and offered several equally weighted links. It did not
provide one participant lifecycle or a deterministic next action.

The refined header is:

> My Projects
> Pick up where you left off.

The compact summary reports only participant-relevant context, such as `4
projects · 2 needs attention`. `Start a project` stays available, but profile,
People, and Community prompts appear below project work.

## Participant-home projection

`app/account/projects/page.tsx` now builds a bounded `ParticipantProjectSummary`
for each active project. It contains only safe participant fields:

- project title and team name;
- Team lead/Teammate role;
- readiness and prize-eligibility summary;
- lifecycle, attention copy, and next action;
- team size;
- bounded Team Chat unread count;
- safe award label and latest activity timestamp.

The page does not include judge IDs, scores, private notes, admin state, or
authorization internals. Submission/member rows are fetched in batches. Latest
activity is resolved by `listLatestProjectActivityBySubmission`, and Team Chat
unread counts by `getChatUnreadCountsBySubmission`; the former per-card activity
and per-room unread loops are gone. At current scale this is one membership
pair, one submission/member pair, one event/release/award set, one activity
query, and one chat aggregate rather than N+1 work per card.

## Lifecycle projection

The pure projection in `lib/participant-project-home.ts` is shared by the page
and tests. Its participant vocabulary is:

| Authoritative state | Participant state |
| --- | --- |
| draft/legacy ready with an actionable readiness issue | Needs attention |
| draft/legacy ready with all readiness checks complete | Ready to submit |
| draft with no surfaced issue | Draft |
| submitted while submissions are still open | Submitted |
| event phase is judging | Judging |
| event phase is judging closed and results are not published | Results pending |
| participant-safe publication is published/archived | Results available |

The old fixture spelling `ready` is normalized in the projection only; the
submission domain is not renamed. Draft projects are never shown as Results
available merely because an event has a publication release.

## Attention and next action

Attention is participant-actionable only. The first missing project item wins,
with participant language such as `Demo link is still missing.` Team eligibility
is considered after project details and becomes a concrete message such as
`2 of 3 badge numbers added. Add the remaining badge number for prize
eligibility.` Internal readiness labels are not shown.

Each card has exactly one primary action:

| State | Primary action |
| --- | --- |
| Needs attention (team issue) | Complete team |
| Needs attention (project issue) | Continue project |
| Draft | Continue project |
| Ready to submit | Review & submit |
| Submitted/Judging/Results pending | View project |
| Results available | View results |

Secondary Preview, Open workspace, and Read Team Chat links remain available
only when they add context. Team Chat unread state is a restrained `Team Chat ·
5 unread` affordance and is not a realtime stream per card.

## Sorting and card design

Cards sort deterministically by participant urgency: Needs attention, Ready to
submit, Draft, Submitted, Judging, Results pending, then Results available.
Within a state, latest authoritative activity wins, followed by title and ID.

The layout uses a calm two-column desktop grid that becomes a single-column
mobile stack at 960px. Cards use a text-first lifecycle marker, a short
root-cause block, one primary CTA, and restrained facts. No status relies on
color alone, and no project card becomes one giant nested link.

The profile prompt was deliberately moved after project work. When projects
exist, a small `Explore the event` row links to People and Community. These are
secondary orientation aids, not competing dashboard tiles.

## Empty and secondary states

An account with no projects sees:

> No projects yet
> Start a project or join a team to see your work here.

The state links to Start, Save an existing project, People, and Community
without implying an account failure. Profile completion remains optional and
below the project list.

## Kentucky Vibes fixture and journeys

The standing F0B service and synthetic database were used. Existing synthetic
Maya (`f2a-demo`) provided the multi-project/results case. A temporary,
synthetic membership fixture for `f0b-participant-2` added these already-safe
Kentucky projects for visual coverage:

- `kv_submission_0074` — draft-like project needing badge attention;
- `kv_submission_0075` — draft-like project with unread Team Chat and a team
  issue;
- `kv_submission_0072` — ready-to-submit project;
- `kv_submission_0065` — finalized/results-available project.

The temporary memberships/invitations were exact-ID synthetic rows and were
removed after screenshot capture; temporary synthetic sessions and read-state
rows were revoked as well. The empty-state screenshots were captured before
adding them. No production account or real identity was used.

Browser journeys completed in desktop Chromium and 390×844 mobile Chromium:

1. Login → My Projects → identify Needs attention → Complete team.
2. Login → My Projects → Ready to submit → Review & submit → workspace.
3. Login → My Projects → Team Chat unread → project chat return path.
4. Login → My Projects → Results available → View results.
5. Empty participant → No projects yet → Start a project.

The mobile route had no horizontal overflow, full-width primary CTAs, visible
Team Chat unread treatment, and discoverable workspace return navigation.

## Screenshots

Screenshots are stored in [`screenshots/g2/`](./screenshots/g2/):

- [multiple projects — desktop](./screenshots/g2/01-my-projects-multiple-desktop.png)
- [mixed lifecycle states — desktop](./screenshots/g2/02-my-projects-states-desktop.png)
- [attention card — desktop](./screenshots/g2/03-attention-card-desktop.png)
- [ready card — desktop](./screenshots/g2/04-ready-card-desktop.png)
- [Team Chat unread card — desktop](./screenshots/g2/05-team-chat-unread-card-desktop.png)
- [empty state — desktop](./screenshots/g2/06-empty-state-desktop.png)
- [results card — desktop](./screenshots/g2/07-results-card-desktop.png)
- [multiple projects — mobile](./screenshots/g2/08-my-projects-multiple-mobile.png)
- [mixed lifecycle states — mobile](./screenshots/g2/09-my-projects-states-mobile.png)
- [workspace — desktop](./screenshots/g2/10-project-workspace-desktop.png)
- [Team Chat return — desktop](./screenshots/g2/11-team-chat-return-desktop.png)
- [empty state — mobile](./screenshots/g2/12-empty-state-mobile.png)
- [attention card — mobile](./screenshots/g2/13-attention-card-mobile.png)
- [ready card — mobile](./screenshots/g2/14-ready-card-mobile.png)
- [workspace — mobile](./screenshots/g2/15-project-workspace-mobile.png)

The screenshots contain synthetic names and project data only. No passwords,
tokens, private scores, judge notes, or private profile fields are present.

## Accessibility and privacy

- Lifecycle labels are textual and paired with a small decorative marker.
- Project headings, card actions, unread labels, and profile prompts have a
  logical reading order.
- Mobile controls meet the existing touch-target conventions.
- The projection never renders emails, badge numbers, judge state, scores,
  private notes, or Better Auth/Viby identifiers.
- Results and awards are shown only from the participant-safe publication
  projection signals; unpublished judging state is not exposed.

## Qualification

- Focused G.2 projection tests cover every lifecycle, root-cause attention,
  next-action mapping, sorting, and summary behavior.
- G.1 onboarding regressions pass.
- TypeScript, production build, changed-file ESLint, and `git diff --check`
  pass.
- The Impeccable detector is clean for the G.2 page/projection files. A scan of
  the shared stylesheet still reports the existing unrelated hero-grid and
  calibration/publication side-border patterns; no new G.2 finding was added.
- Full unit and F.0–F.3 regression suites pass: **299 tests in 58 files**.

## Product recommendation

The page now reads as a participant home rather than a record list: urgent work
rises to the top, the next step is singular, submitted work stays alive, and
social/profile discovery is intentionally secondary. The mixed-state desktop
and mobile screenshots show the intended hierarchy without introducing a new
communication primitive.

**RECOMMEND DEPLOYING G.2 TO PRODUCTION**

## G.2B production closure

G.2 was deployed to `https://vibe-hackathon-dev.ggg.ad` as the application-only
release documented in
[`PHASE_G2B_PRODUCTION_DEPLOYMENT.md`](./PHASE_G2B_PRODUCTION_DEPLOYMENT.md).
The production smoke confirmed the ordinary participant landing and empty
state at desktop and mobile widths, while the qualified Kentucky Vibes
fixtures continue to cover multi-project lifecycle, attention, unread, and
workspace-return states. No schema migration or participant business-state
change was introduced; Chatto, Viby, and publication state remain unchanged.

**GO — G.2 PARTICIPANT HOME DEPLOYED AND QUALIFIED.**

Next recommendation: **G.3 — Submission Readiness / Finalization Experience**.

## G.3 follow-up

G.3 keeps this page's lifecycle projection as the participant-home source of
truth. Readiness now maps to `Needs attention`, `Ready to submit`, or
`Submitted` using the same server-owned concepts; prize eligibility remains a
separate warning; and a successful finalization returns the participant to a
durable submitted receipt before they return to My Projects. See
[`PHASE_G3_SUBMISSION_READINESS_FINALIZATION.md`](PHASE_G3_SUBMISSION_READINESS_FINALIZATION.md).

## G.3B production closure

G.3 readiness/finalization is now deployed and qualified in production as an
application-only release. The centralized G.2 lifecycle projection remains the
source of truth: incomplete projects show `Needs attention`, ready projects
show `Ready to submit`, and finalized projects move to `Submitted` without
exposing unpublished results. See
[`PHASE_G3B_PRODUCTION_DEPLOYMENT.md`](PHASE_G3B_PRODUCTION_DEPLOYMENT.md).

The next bounded participant phase is **G.4 — Team Formation / Invitations
Experience**, focused on pending invitations and the participant-facing team
lifecycle rather than new communication primitives.
