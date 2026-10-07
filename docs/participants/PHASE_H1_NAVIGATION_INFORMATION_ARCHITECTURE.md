# Phase H.1 — Navigation / Information Architecture Cleanup

Date: 2026-08-10 (America/New_York)
Disposition: **GO — H.1 NAVIGATION / IA READY FOR PRODUCT REVIEW**

Recommendation: **RECOMMEND DEPLOYING H.1 TO PRODUCTION**

H.1 is a bounded participant-navigation and information-architecture pass. It
does not change routes, roles, submission policy, team membership, judging,
publication, Chatto, or Viby. Production was not deployed or mutated.

**Schema determination:** H.1 requires no schema migration. The navigation
projection uses the existing event deadline/freeze fields, the existing D.4
`publication_releases` row, and existing bounded unread-count projections.

## 1. Production baseline and boundary

The production baseline remained the H.0/G.5 baseline: host `paui`, branch
`phase-vh-m6-viby-better-auth-session`, repository HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735`, release
`/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`, PID
`3250791`, restart count `0`, local/public HTTP 200, and canonical database
SHA-256 `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`.
Integrity/FK remained clean, the production event remained unfrozen with no
configured submission or judging deadline, the authoritative publication
release remained calculated/unpublished, and the standing Kentucky Vibes,
Chatto, and Viby deployments were left unchanged.

No production project, roster, invitation, message, submission, deadline,
freeze, result, or publication state was changed.

## 2. Navigation implementation audit

Before H.1, `components/Nav.tsx` rendered the public participant destinations
as one flat row: Status, Projects, People, Messages, Community, AI Evals,
Winners, Start a submission, and (when signed in) My Projects, with role links
alongside them. The same JSX was reused for the desktop row and the mobile
drawer. `components/NavPublic.tsx` resolved the event, branding, application
principal, unread DM/community counts, and audience-voting state. The account
menu contained Account, an admin People & Access shortcut for administrators,
and Log out.

The project shell (`SubmissionWorkspaceShell`) supplied a return link to My
Projects and local tabs for Overview, Team, Team Chat, Preview, Submit,
Activity, and Results. It still used the global navigation at the top of every
workspace page. Admin and judge variants had independent link sets and remain
independent after H.1.

Active state continues to be derived from the pathname. `/projects` also
recognizes public `/project/:id` pages; submit, admin, judge, and account paths
retain their existing compatibility behavior. The desktop row remains
expanded at `xl`; below that breakpoint the existing accessible menu button
opens the mobile navigation. No new realtime connection or global project/chat
query was added.

## 3. Canonical participant IA

H.1 makes the conceptual hierarchy explicit:

```text
YOUR WORK
  My Projects
  active project workspace (Overview, Team, Team Chat, Preview, Submit)

EVENT
  Projects
  Explore → Status, People, AI Evals, Results when published

PEOPLE & COMMUNITY
  Community
  Messages (always visible when signed in so unread attention is not buried)

PERSONAL
  account menu → Profile, Account, role-specific People & Access, Log out
```

The labels remain participant language. “My Projects” is not renamed to
Dashboard, Team Chat is not promoted into global navigation, and public
Projects remains visibly distinct from private My Projects.

## 4. Top-level decisions

| Destination | H.1 treatment | Reason |
| --- | --- | --- |
| My Projects | First authenticated item, stronger selected state | Primary participant home and return point. |
| Projects | Direct item | Event-wide public gallery remains easy to discover. |
| Community | Direct authenticated item with bounded unread badge | Event-wide conversation is useful, but follows project work. |
| Messages | Direct authenticated secondary item with bounded unread badge | A DM is personal attention; unread messages must not disappear into a deep menu. |
| Explore | Compact grouped menu | Status, People, AI Evals, and event results are important but less frequent than project work. |
| Start a project | Restrained accent action, only while submissions are open and the event is not frozen | Keeps creation available without competing with existing work or presenting a closed action. |
| Results | Appears as Explore → Results only when the D.4 release is `published` or `archived` | Prevents unpublished result implications and does not use legacy `winnersPublishedAt` as authority. |
| Profile / Account | Account menu | Personal settings do not compete with the project lifecycle. |
| Team Chat | Project-local tab only | Distinguishes team collaboration from person-to-person Messages. |
| Admin / Judge | Existing role-specific branches | No privileged destination is mixed into participant IA. |

Anonymous visitors see Projects, an event-aware Start action, Explore for
public event information (Status, AI Evals, and published Results), and Log in.
Private People/Community destinations are not presented as anonymous dead-end
links. Authenticated active accounts see People in Explore and Community
directly, including when My Projects is empty.

## 5. Event-aware visibility

`lib/participant-navigation.ts` contains a small pure projection used by the
server navigation wrapper. It evaluates exact server time for the existing
submission deadline and freeze state. It also treats only D.4 release statuses
`published` and `archived` as participant-visible results. The projection is
presentation-only; save, finalization, roster, judging, freeze, and publication
authorization remain in their existing server/domain operations.

The public wrapper performs one bounded publication-release lookup for the
active event. It does not query every project, chat room, channel, or message.
With no deadline configured, Start remains available; with a passed deadline or
freeze, it is omitted. Before publication, Results is not placed in Explore;
after publication, it is labeled Results rather than implying a legacy Winners
compatibility field.

## 6. Active project context

The workspace now marks the global shell with `data-nav-scope="project-workspace"`
and a quieter secondary treatment. The project title, role, status, and
`← My Projects` return link remain the dominant context. Local tabs retain all
existing deep links and order: Overview, Team, Team Chat, Preview, Submit,
Activity, Results. H.1 does not hide or delete Activity/Results routes; they
remain available for compatibility and direct links while the core work tabs
stay first.

This produces the intended hierarchy without a second global navigation system:

```text
Vibe Hackathon → Derby Signal Studio → Overview / Team / Team Chat / Preview / Submit
```

## 7. Account menu and labels

The account menu now offers Profile and Account as separate, clear destinations,
keeps admin People & Access only for administrators, and retains Log out. My
Projects is not duplicated there because it already has the strongest global
position and the workspace return link.

Canonical participant labels are now: My Projects, Projects, People, Messages,
Community, Status, AI Evals, Results, Start a project, Profile, Account, Team,
Team Chat, Preview, and Submit. “Start a submission” is removed from this
participant navigation surface; the `/start` route remains compatible.

## 8. Responsive behavior

At 1440px and 1280px the primary participant row remains calm and compact. At
1024px it collapses before labels collide, retaining the account identity and
theme controls beside the menu trigger. At approximately 390px the mobile
drawer presents the same hierarchy in a single column: My Projects, Projects,
Community, Messages, Explore, Start a project, then Profile/Account/Log out.
The Explore panel becomes an inline, full-width panel rather than an upper-left
or clipped popover. No horizontal overflow was observed in the captured mobile
journeys.

The account menu and Explore menu use semantic buttons, `aria-haspopup`,
`aria-expanded`, menu roles, descriptive labels, Escape-to-close, and focus
return to the trigger. Unread badges have text labels and are not color-only.
Mobile touch targets retain the existing 44px-scale controls. The project
workspace tabs remain horizontally scrollable within their local frame rather
than competing with the global drawer.

## 9. Kentucky Vibes qualification fixtures

A disposable derivative was created at:

`/opt/vibe-hackathon/instances/kentucky-vibes-h1-qualification-20260810T020000Z`

It used separate SQLite files, authentication origin/cookies, ports, and
credentials. The clone was based on the qualified Kentucky fixture and received
only the disposable user-profile, direct-messaging, and community table
migrations needed to render authenticated navigation. The three checkpoints
passed integrity and FK checks:

| Fixture | Purpose | SHA-256 |
| --- | --- | --- |
| `data/h1-open.sqlite` | submissions open, release calculated | `e96f79f19724f2b88a3ec56ae500648261d667f391c3264b277d8132ba680fac` |
| `data/h1-closed.sqlite` | deadline passed, release calculated | `e40371b1816e083ac9728d1b7e6e40ea2bf3f12e8d05c19648bfbfa7c37024dd` |
| `data/h1-published.sqlite` | D.4 release published | `0f3bf95d555d1247a4f83f53ce3a2fbade3fcf92969935f4e3dbc96a229c83df` |

Synthetic owner `kv_user_0001` and the existing synthetic Kentucky projects
were used for positive authenticated screenshots. Temporary app/proxy
processes were stopped after capture. The standing Kentucky Vibes deployment
was not replaced.

## 10. Browser qualification

The following journeys were exercised in the isolated clone:

- anonymous landing, Projects, Start, and Explore;
- owner login → My Projects → account menu;
- My Projects → active project → Team Chat;
- authenticated People and Community empty states;
- 1024px collapsed navigation;
- authenticated 390px My Projects, menu, active workspace, and Team Chat;
- closed-event fixture with no prominent Start action;
- published-release fixture with Results in Explore.

The project workspace retained an obvious My Projects return link and local
tabs. Global navigation did not contain a Team Chat route. The account menu
contained Profile, Account, and Log out. Results appeared only after the
synthetic D.4 release was marked published.

## 11. Screenshot review

The product-review set is in [screenshots/h1](screenshots/h1/), including the
desktop/mobile surfaces, 1024px collapse, open/closed/published event states,
account menu, active workspace, and a consolidated contact sheet. No retained
image contains a production credential, invitation token, private roster field,
judge data, or result secret.

Cross-screen review found consistent dark-professional tokens, accent action
hierarchy, header geometry, menu treatment, and workspace context. The primary
remaining density is the existing project workspace content itself rather than
global navigation; it remains within the scoped G.5/G.4 work and was not
redesigned here.

## 12. Accessibility and privacy

- Global and mobile navigation use semantic nav landmarks and labeled controls.
- Explore/account menus expose expanded state and close on Escape with focus
  returned to the trigger.
- Selected pages use `aria-current`; unread counts have descriptive labels.
- The project context is announced by visible title, role, status, and return
  link, not by hidden implementation IDs.
- No edit token, recovery URL, Better Auth ID, Viby assertion, judge ID, score,
  private note, Team Chat payload, DM, or Community message was added to the
  navigation projection.
- The only new server query is the bounded event publication-release status
  lookup; no global realtime subscription was added.

## 13. Tests and quality gates

Focused H.1 tests are in `tests/h1-navigation.test.ts` and cover exact
deadline/freeze boundaries, published/archived result visibility, bounded
unread values, canonical labels, workspace scope, and preservation of admin /
judge branches. The focused suite passed: **7 tests**.

Additional checks passed:

- TypeScript (`npx tsc --noEmit`);
- production build (`npm run build`);
- changed-file ESLint (existing Next image warnings only; no errors);
- Impeccable detector on changed navigation/workspace files (clean `[]`);
- desktop/mobile Chromium screenshot qualification;
- `git diff --check`.

The broader G.1–G.5, F.0–F.3, authentication, messaging, community, judge,
and publication suites remain the qualified regression baseline and were not
changed in their domain behavior by H.1.

The repository-wide aggregate was subsequently rerun in a clean isolated
runner with `--pool=threads --maxWorkers=1 --no-file-parallelism` and passed:
**325 tests across 62 files**. The Viby fixture still emits the expected
`manage-viby-admin-link.ts` conflict stack trace to stderr while its parent
asserts the refusal and passes; the same `6/6` test result reproduces on the
unchanged G.5B release. This is an intentional migration-policy diagnostic,
not a failing test or an H.1 regression.

## 14. Before / after comparison

Before H.1, an authenticated desktop participant saw roughly nine peer-weight
global destinations, including low-content social and unpublished Winners,
alongside My Projects. After H.1, My Projects is first and strongly selected;
Projects is direct; Community and Messages remain discoverable; less frequent
event destinations are grouped under Explore; Start is a restrained state-aware
action; and Results is publication-aware. At 1024px the row collapses before
collision rather than presenting cramped labels. On mobile the same hierarchy
is one drawer, with project-local tabs remaining separate inside a workspace.

This is not a click-count optimization: Messages remains direct specifically
because unread personal attention matters, Projects remains direct because
event discovery matters, and People remains one level away rather than hidden.

## 15. Remaining limitations

- Messages and Community unread values still use the existing bounded server
  projections; H.1 does not add notifications or realtime nav updates.
- Results is intentionally absent until a D.4 release is published. The legacy
  `/winners` route remains directly bookmarkable and compatible.
- The account menu is still desktop-only while the existing mobile drawer
  supplies its equivalent personal actions; this matches the current shell and
  avoids a duplicate menu.
- No new bottom navigation, search, mega-menu, or route deprecation was added.
- Public/participant copy outside navigation still contains documented legacy
  “submission/finalized” terminology candidates from H.0.

## 16. Production recommendation

H.1 has no P0 security/correctness finding. Participant work remains reachable,
role boundaries are preserved, private data is not exposed, and the isolated
open/closed/published event journeys pass. The strongest H.0 friction is
addressed without a schema migration or production data mutation.

**GO — H.1 NAVIGATION / IA READY FOR PRODUCT REVIEW**
**RECOMMEND DEPLOYING H.1 TO PRODUCTION**

Production deployment was completed separately in H.1B. See
`PHASE_H1B_PRODUCTION_DEPLOYMENT.md` for the immutable release, backup,
production-safe navigation smoke, data-preservation evidence, and rollback
pointer.

## 17. H.1B deployment handoff

H.1B deployed `/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`
with source fingerprint
`02cf279ef2a6be045bd2970ae28c026143ce94458060d4143fee01aec657de7f`.
Production remains unfrozen with submissions open, and the authoritative D.4
publication release remains calculated/unpublished, so Results is correctly
absent from participant Explore. The canonical database SHA remains
`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`.

Disposition: **GO — H.1 NAVIGATION / IA DEPLOYED AND QUALIFIED**. The next
direction is **HOLD — observe real participant use**.

The only production smoke was anonymous/read-only: `/api/health` and `/`
returned HTTP 200 with the expected active event and unfrozen state. No
participant credential, project workspace, team action, invitation, chat post,
submission, or publication operation was attempted.

## H.3 empty-state integration

H.3 retained the H.1 hierarchy while making low-data states explainable. My
Projects remains the primary participant action; Projects remains public
discovery; Community and Messages remain visible but secondary; Explore and
Results retain H.1 event-aware visibility. Community channel guidance is
presentation-only and does not create messages. New participants do not bypass
private project or Team Chat authorization merely because Community is empty;
H.4R separately makes global social Community available to active accounts.

See `PHASE_H3_PRE_EVENT_ACTIVATION_EMPTY_STATES.md` for the inventory,
fixtures, screenshots, responsive review, and tests. No H.1 production release
was changed during H.3.

## H.4R social-access update

H.4R retains the H.1 hierarchy and direct Community placement, but changes the
eligibility projection behind that placement. Community is visible to an
authenticated active account even when My Projects is empty and the account
has no current-event submission relationship. People and Messages follow the
same global-social model. Navigation remains presentation only: Community
pages and APIs authorize independently, while project workspace and Team Chat
links remain project-scoped.
