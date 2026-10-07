# Phase F.0 — Participant Identity and Profile Architecture Audit

**Disposition:** read-only architecture and product audit; no application,
schema, database, service, Chatto, or Viby changes were made.

**Audit date:** 2026-08-08
**Repository:** `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
**HEAD inspected:** `a70edc28326108dfc84a69af303f680ceaa7f735`
**Production boundary:** canonical production remained healthy, unpublished,
and untouched. Kentucky Vibes was used only as an existing read-only scale
reference.

## Executive recommendation

Proceed with **F.0A — Durable Participant Profile Domain** as a small,
additive, fail-closed foundation. Do not add a global role column, public
directory, social search, native image upload, Viby portrait import, or event
participation migration in the first slice.

The current system already has a sound identity boundary:

```text
Better Auth user/account/session
        ↓ authentication only
application principal
        ↓ live authorization checks
event-scoped membership / judge authorization / admin authorization
        ↓
submission, judging, chat, results, and publication records
```

F.0 should add only a durable, user-owned profile record below the Better Auth
user and above event-specific records. The first implementation should contain
`user_id`, a normalized unique handle, display name, headline, bio, affiliation,
degrees, optional validated links, and an explicit `visibility` defaulting to
`private`. Avatar presentation should use initials and the existing Better Auth
`users.image` only when it is already a safe provider image; native uploads are
deferred.

The existing `users.name` remains the authentication/account display fallback.
The new profile is the public identity source when present. A profile must
never grant access, change a judge mapping, change ownership, or rewrite a
historical roster snapshot.

## 1. Current user and account architecture

### Better Auth tables

The canonical Drizzle schema is in `lib/db/schema.ts` and is passed to Better
Auth in `lib/auth.ts` through `@better-auth/drizzle-adapter`.

| Table | Important columns | Ownership / purpose |
| --- | --- | --- |
| `users` | `id` PK, `email` unique/not-null, `name`, `image`, `github_id` unique, `github_username`, timestamps, `email_verified` | Better Auth user identity and provider-facing display fallback. No event role. |
| `accounts` | `id`, `account_id`, `provider_id`, `user_id` FK, provider tokens, `password`, timestamps | Better Auth credentials/provider accounts. Password and tokens are authentication data, never profile data. |
| `sessions` | `id`, `token` unique, `user_id` FK, expiry, IP, user agent, timestamps | Better Auth interactive sessions. Session data is never public. |
| `verifications` | identifier, value, expiry, timestamps | Better Auth verification state. |
| `user_account_controls` | `user_id` PK, active/disabled status, password-change policy, disable actor/timestamps | Application account lifecycle. It is not a profile and does not grant roles. |

`lib/auth.ts` configures password login, optional GitHub OAuth, account-control
session hooks, rate limiting, and the Viby authentication plugin. Better Auth
remains the only interactive application session.

### Current user-facing account experience

`app/account/page.tsx` resolves the Better Auth-backed application principal and
loads `getAccountOverview()` from `lib/account-directory.ts`. It renders
`app/account/AccountSettingsClient.tsx` with `app/account/account.css`.

The current page contains:

- **Project workspaces** — active owner/teammate memberships and links to
  `/projects/:submissionId`;
- **Profile** — editable display name only, persisted by
  `PATCH /api/account/profile` and `updateOwnName()`;
- **Password** — password creation/change, separate from Viby linking;
- **Recent sign-ins** — session inventory and revocation;
- **Linked identity** — only a safe Viby display label/status;
- **Access** — derived participant, administrator, and current-event judge
  states;
- no public profile URL, handle, bio, affiliation editor, or public profile.

`components/Nav.tsx` exposes an account menu with Account, People & Access for
admins, and logout. The avatar is an initials circle derived from the display
name; `users.image` is not rendered by the current global account control.

### Application principal

`lib/application-principal.ts` creates the server-owned principal. It returns:

- Better Auth user ID/name/email/image;
- Better Auth session ID and timestamps;
- account-control state;
- session provenance and optional role-neutral linked Viby identity;
- live active administrator authorization;
- live event-scoped judge authorization;
- derived `roles.isAdmin` and `roles.isJudge`.

It deliberately does not return a profile, a global role, or a public identity
claim. `lib/judge-principal.ts` additionally resolves the event, existing judge
profile, and assignment authority. `lib/admin-principal.ts` protects admin
operations. This is the correct boundary for F.0: profile reads may enrich a
principal or presentation, but profile data must never enter authorization
resolution.

### Viby identity linking

`viby_identity_links` is defined in `lib/db/schema.ts` and migrated by
`scripts/migrate-viby-identity-links.ts`, `scripts/migrate-viby-better-auth.ts`,
and related Viby migrations. It stores provider subject, application ID,
status, link scope, environment/provenance, verification timestamps, and a
non-authoritative `display_name`. `local_user_id` is nullable for legacy
compatibility and is the only local binding key.

The schema retains a historical `role = 'admin'` value, but current code treats
`link_scope` and application-owned authorizations as the authority. The link
does not grant participant, judge, or administrator access. `lib/viby.ts`,
`lib/viby-interactive-linking.ts`, and `lib/viby-unified-callback.ts` ensure
provider subjects, assertions, sessions, and identity links remain server-side.

**F.0 rule:** never copy Viby assertion payloads, provider subjects, identity
session IDs, verification metadata, portraits, or Viby display labels into a
public profile automatically. A user may deliberately type profile content or
choose a separately approved avatar source later.

### Existing People directory

`app/admin/people/page.tsx`, `PeopleAccessClient.tsx`, and
`lib/account-directory.ts` provide an administrator-only People & Access
directory. `PersonDirectoryRow` contains email, authentication methods,
session count, disabled state, password policy, live admin access, current
event judge authorization, invitation state, and recent account audit events.
It intentionally exposes operational access to administrators, not public
profiles. F.0 must not reuse this response for a public People directory.

### Existing public person routes and media

There is no `/people`, `/users`, or public account route. Public project routes
are `/projects`, `/project/:id`, `/submission/:id` compatibility, `/winners`,
`/presentation`, and status/project projections. No profile-specific avatar
upload or image storage infrastructure exists. The application stores URL
fields for project artifacts and provider metadata in `users.image`, but there
is no native upload pipeline, MIME validation service, image resize service, or
safe remote-image proxy.

## 2. Event and participation records today

### Event model

`events` has a unique slug and an `is_active` flag, deadlines, freeze state,
branding, voting settings, winner publication timestamp, and experimental AI
settings. `lib/events.ts::getActiveEvent()` selects an active event and falls
back to the newest event; `lib/judging-event.ts` selects the judging event from
`VIBE_JUDGE_EVENT_ID` (default `evt_vibe_2025`). Many public and participant
routes call `getActiveEvent()` directly. Admin/results/calibration/publication
queries generally accept or derive an event ID, but the UI is still presented as
one current event.

### Submission and team tables

`submissions` stores event ID, project/team snapshot fields, contact email,
status, artifacts, and the private edit token. `teams` stores event ID, team
name, contact email, affiliation, and description. `team_owners` is the older
GitHub ownership record with user ID, GitHub fields, badge number, and
verification status.

`submission_owners` explicitly maps one submission to one Better Auth user. Its
unique index enforces one owner per submission and its user index powers
recovery. `submission_memberships` explicitly maps a Better Auth user to a
submission with `owner`/`teammate` role and `invited`/`active`/`revoked` status.
The active-owner and active-user/submission unique indexes enforce access.

`submission_membership_invitations` stores only token hashes and explicit
inviter/intended roster references. `lib/submission-memberships.ts` is the
authorization source for workspace, team, and native chat access. Email matches
and roster rows never grant account access.

`team_members` is an event/submission roster snapshot. It stores name, email,
badge number, badge verification status, affiliation, degrees, student/trainee
status, role text, and ordering. It is rendered through `lib/team-display.ts`:
public projections omit email and badge fields; admin projections include them.
The same roster feeds public project/presentation pages, judge previews, admin
readiness, exports, and prize eligibility.

### Judge and administrator records

`judges` is a separate profile/contact table (`id`, unique legacy token, name,
email, created timestamp). `judge_authorizations` maps a Better Auth user to an
existing judge profile and an explicit event, with grant provenance and a
revocable lifecycle. It has active user/event and active judge/event uniqueness
constraints.

`admin_authorizations` maps a Better Auth user to an active/revoked organizer
authorization. There is no global role column. `judge_assignments`, assignment
state, evaluation state, scores, calibration, results, publication, and audit
records retain judge/profile IDs separately from Better Auth user IDs.

### Chat, audit, and results attribution

Native chat stores room → submission, message → room/author user, read state →
user, and event actors. Active submission membership is required for access.
`audit_events` uses free-form entity/actor identifiers and deliberately does
not foreign-key actors so that history can survive account lifecycle changes.
Results/finalists/winners/publication actor fields use `SET NULL`; judge score
rows use judge profile IDs, not display names.

### User-ID usage map

| Surface | Current identifier and join |
| --- | --- |
| Projects / My Projects | `submission_owners.user_id` and active `submission_memberships.user_id` → `users.id`; project rows join `submissions.id`. |
| Team roster | `team_members` is a snapshot and does not carry `user_id`; it must not be used to infer identity. |
| Native chat | `chat_messages.author_user_id`, `chat_read_states.user_id`, and `chat_events.actor_user_id` → `users.id`; access is resolved from active submission membership. |
| Judging | `judge_authorizations.user_id` maps a Better Auth user to `judges.id` for an event; assignments and `human_scores` use `judge_id`, never email. |
| Audit | `audit_events.actor_id` is an attribution string/ID with no FK by design; actor category is recorded separately. |
| Results/calibration/publication | decision actor fields reference `users.id` with `SET NULL`; score provenance continues to use `judge_id` and submission/event IDs. |
| Viby | `viby_identity_links.local_user_id` binds an external subject to `users.id`; provider subject/session/assertion values remain server-only. |

Observed read-only canonical database shape at audit time was 8 users, 8
accounts, 26 sessions, 10 submissions, 5 judge profiles, 3 active/event
judge authorizations, 17 assignments, 14 human scores, 28 roster rows, 5
active submission memberships, 2 Viby links, 1 publication release, 1 active
publication award, and 386 audit events. These are observations only; no rows
were changed. The realistic Kentucky Vibes scale assessment appears in
Section 16.

## 3. Single-event assumptions audit

| Area | Current assumption | F.0 classification | Recommendation |
| --- | --- | --- | --- |
| Public navigation/branding | `NavPublic`, status, gallery, winners, and branding call `getActiveEvent()` | Safe for a profile foundation; multi-event public context is not yet explicit | Keep profile route event-independent. Do not add a directory to active-event navigation in F.0. |
| Account page | Uses `VIBE_JUDGE_EVENT_ID` and one event name for judge access | Safe now; needs an event-access projection later | Profile editing must not depend on the current event. Keep access summary event-scoped. |
| My Projects | Queries memberships/owners without an event filter and displays one aggregate list | Safe while submission IDs are globally unique; needs event grouping for multi-event UX | F.0 profile history must join `submissions.event_id` and group by event. Do not rewrite My Projects now. |
| Team role | Membership role is submission-scoped; admin/judge badges are current-event/current-config derived | Safe and already aligned with direction | Never add a global participant/judge role. |
| Judge access | `VIBE_JUDGE_EVENT_ID` plus `judge_authorizations(event_id)` | Safe for current operations; explicit future event context required | Judge profile remains separate in F.0. |
| Admin access | Global active `admin_authorizations` | Intentional organizer authorization today; not a participant profile field | Public “Organizer” badge requires deliberate event metadata later, never raw authorization. |
| Roster identity | `team_members` stores event/submission snapshot and may duplicate user name/affiliation/degrees | Safe if treated as snapshot; dangerous if synchronized silently | Define one-way optional prefill only; no backfill or live rewrite. |
| Project/public visibility | Public project routes and publication are event-oriented; `/project/:id` loads by globally unique submission ID | Needs an explicit profile projection query | F.0 profile history must enforce event + published/public policy and avoid direct source-row reuse. |
| Publication | D.4 `publication_releases(event_id)` and participant projection are event-scoped; qualification gate is submission-scoped | Safe | Use `buildParticipantPublicationProjection`/published award queries as the source of profile-visible recognition. |
| Viby | Link records and login transactions are application/provider scoped, but the UI still has one application/event | Safe for F.0 | Profile must not import Viby metadata automatically. |
| Seeds/simulation | Kentucky Vibes switches an active event and uses environment event selection | Safe in isolated databases only | Use it for scale validation; never make profile migration depend on active event. |
| API defaults | Several routes call active-event helpers and have compatibility defaults | Defer full event-context refactor | F.0A repository methods should require explicit user/profile IDs and explicit event IDs for history. |

The principal architectural gap is not a missing global role. It is the lack of
a durable profile and an explicit, privacy-aware projection from event records
to that profile.

## 4. Proposed durable profile domain

### Smallest useful F.0A schema

Add an additive `user_profiles` table with one row per Better Auth user:

| Field | Type / constraint | Owner | Recommendation |
| --- | --- | --- | --- |
| `id` | opaque text PK | application | Separate profile ID prevents public URLs from exposing Better Auth user IDs. |
| `user_id` | text NOT NULL FK → `users.id` ON DELETE RESTRICT, unique | application | One durable profile per account. Restrict prevents accidental history deletion. |
| `handle` | normalized ASCII text, unique, nullable during migration | user/application | Public URL key; generated only when explicitly opted into public profile or via reserved private handle allocation. |
| `display_name` | text NOT NULL, 2–100 chars | user | Durable public/self display value; seed from `users.name` only when non-empty, otherwise require user choice. |
| `avatar_url` | validated HTTPS URL, nullable | user/application | Optional later; do not import Viby images. Initial UI uses initials. |
| `headline` | text nullable, max 160 | user | Short professional descriptor. |
| `bio` | text nullable, max 2,000 | user | Plain text or a tightly sanitized Markdown subset; no raw HTML. |
| `affiliation` | text nullable, max 160 | user | Durable self-described affiliation; not badge verification. |
| `degrees` | text nullable, max 120 | user | Durable self-described credentials; roster remains authoritative for an event snapshot. |
| `website_url` | validated HTTPS/HTTP URL, nullable | user | Optional external link; display as safe outbound link. |
| `github_url` | validated GitHub URL, nullable | user | Store a canonical URL, not OAuth token or provider account secret. |
| `linkedin_url` | validated LinkedIn URL, nullable | user | Optional, validated host. |
| `interests` | JSON array of short strings or normalized child table | user | For F.0 use bounded JSON (max 12, each max 40); index/search later in F.1. |
| `visibility` | `private` / `public`, default `private` | user/application | Do not add `event_only` until event-scoped directory semantics are implemented. |
| `created_at`, `updated_at` | timestamps | application | Standard audit fields. |
| `deactivated_at` | nullable timestamp | user/application | Hides the profile while retaining attribution/history. |

Recommended constraints:

- `CHECK(length(trim(display_name)) BETWEEN 2 AND 100)`;
- `CHECK(visibility IN ('private','public'))`;
- unique index on `lower(handle)` after normalization, with a nullable handle
  allowed for private/unmigrated rows;
- handle is never an email, Better Auth ID, Viby subject, badge number, or
  invitation token;
- no profile fields are used in authentication or authorization predicates.

Do not add `role`, `event_id`, `judge_id`, `submission_id`, `email`,
`badge_number`, `viby_subject`, or `session_id` to `user_profiles`.

### Ownership boundaries

| Domain | Source of truth | Profile relationship |
| --- | --- | --- |
| Authentication | Better Auth `users`, `accounts`, `sessions` | Profile references `user_id`; profile cannot change credentials. |
| Durable identity | `user_profiles` | Self-managed display/portfolio data with explicit visibility. |
| Event participation | future `event_participations` or existing event-scoped membership/authorization rows | Derived relationship; not copied into a global role. |
| Submission roster | `team_members` | Explicit event/submission snapshot. Optional one-time profile prefill; never live synchronization. |
| Workspace access | `submission_memberships` / `submission_owners` | Authorization remains unchanged. |
| Judge identity | `judges` + `judge_authorizations` | Judge-specific profile remains separate; user profile can be a safe display fallback only after deliberate mapping. |
| Administrator access | `admin_authorizations` | Never displayed as a global role by profile code. |
| Viby identity | `viby_identity_links` | Identity assurance/link metadata only; no automatic profile import. |

## 5. Handle and profile URL strategy

### Recommendation

Use `/people/:handle` for public profiles. Do not use email addresses or Better
Auth IDs in URLs. Do not use `/@:handle`; it complicates route parsing and
sharing without adding useful meaning.

Handle policy for F.0:

- lowercase ASCII `a-z`, `0-9`, and single hyphens;
- 3–30 characters;
- must start and end with alphanumeric;
- no consecutive hyphens;
- normalize input with Unicode NFKC, trim, lowercase, then reject non-ASCII
  rather than transliterating silently;
- reserve route words (`admin`, `account`, `login`, `people`, `projects`,
  `judge`, `settings`, `api`, `health`, `status`, `winners`, `start`, `submit`,
  `recover`, `logout`, `favicon`, and future reserved words);
- enforce a case-insensitive unique index and server-side collision checks;
- never derive a handle from email local parts unless the user confirms it;
- do not place a handle in a session, authorization, or Viby link.

### Handle lifecycle

- Existing users receive no public profile and no public handle automatically.
- A private shell may have a nullable internal profile ID without a handle.
- When a user first enables `public`, require handle selection or offer a
  clearly previewed generated suggestion from the confirmed display name.
- Handle changes are explicit, rate-limited profile mutations. Keep a small
  `profile_handle_history` table or redirect alias only if SEO/share continuity
  is required; otherwise return a safe 404 for the old handle and document it.
- Do not allow a new owner to immediately claim a recently released handle;
  retain a bounded tombstone/reservation period.
- Deactivated profiles return a generic not-found/private response and do not
  reveal whether a matching account exists.

This route is readable, future-directory friendly, and decoupled from account
email changes. It should be `noindex` while profile visibility is private or
until a later public-directory decision. Public profiles may opt into indexing
later; do not make that an implicit side effect of enabling visibility.

## 6. Visibility and privacy model

### F.0 choice: private/public only

Implement only:

- **Private** — visible to the owner in Account/Profile. The application may
  show the minimum display name needed in an authorized private workspace or
  judge/admin context, but profile fields are not exposed through public routes.
- **Public** — visible without authentication at `/people/:handle`, subject to
  deactivation and field-level public projection.

Do not implement `event_only` in F.0. It sounds attractive, but its semantics
require an event-participation relation and careful treatment of judges,
organizers, inactive memberships, and cross-event discovery. Add it only with
the future F.1 People & Discovery design.

### Field visibility matrix

| Field / record | Self | Authorized private workspace | Public profile | Never public |
| --- | --- | --- | --- | --- |
| Display name, handle, avatar, headline, bio, affiliation, degrees, links, interests | yes | only where product context needs it | only if `public` and field is enabled | — |
| Project title/team | yes | active member/judge/admin according to existing route | only when the project is public/published and profile participation is explicit | unpublished/private projects |
| Event name and event year | yes | authorized event users | with a published project/award | internal event IDs |
| Published award | yes | authorized users | yes, event/project attributed | removed/unpublished award |
| Finalist/winner internal state | yes as applicable | admins/results tools | no unless represented by published award/finalist policy | raw selection/audit rationale |
| Email | yes | existing authorized private/admin views only | no F.0 public email field | never public by default |
| Badge number/verification | self only where existing workflow requires | admin roster only | no | always public-prohibited |
| Better Auth IDs/session data | no UI need | server-only | no | always |
| Viby subject/assertion/session/link IDs | no | server-only/link-management context | no | always |
| Team chat/activity/private judge notes | authorized existing context | existing scope only | no | always |

A public profile with no published project history should render a concise
portfolio identity and omit empty “Projects” or “Awards” sections rather than
showing database-style empty states. A private profile must not be discoverable
through handle search, sitemap, or `HEAD` enumeration.

## 7. Profile content recommendation

### F.0

Ship only the fields that make a credible professional identity without turning
Account into a social network:

- display name;
- handle (only when public or explicitly reserved);
- initials avatar;
- headline;
- short bio;
- affiliation;
- degrees/title;
- website, GitHub, LinkedIn links with host validation;
- up to 12 interests/skills as bounded tags;
- visibility toggle with a plain-language preview.

### Defer

- native image upload;
- location (can reveal sensitive geography and is not required for identity);
- availability for teams, mentoring, or recruitment;
- social handles beyond the three links;
- endorsements/followers/comments;
- full-text directory search;
- event-only visibility;
- public role badges;
- profile analytics, view counts, or notifications;
- Viby-provided photo or identity-verification imagery.

Initial avatar strategy: use existing `users.image` only if it is already a
trusted provider URL and the user explicitly opts to display it; otherwise use
stable initials from the profile display name. F.0 should not add remote image
proxying, image fetches, or uploads. If upload is later approved, require
server-side MIME sniffing, byte/size limits, image decoding/resizing, EXIF
stripping, object access controls, and no executable content.

## 8. Project-history projection

### Source relation

A profile’s project history must be computed from explicit relations:

1. `submission_memberships(status='active')` and `submission_owners` identify
   current participation;
2. historical participation is retained by a dedicated immutable
   `profile_project_attributions` snapshot or by a carefully versioned
   membership history query; do not infer from `team_members.email`;
3. `submissions.event_id` joins the event;
4. project visibility requires the existing publication/public-project policy;
5. profile participation is shown only when the account relation is explicit.

For F.0C, use a read-only repository projection that returns:

```text
profile handle
  → active or historical explicit user membership
  → submission + event
  → public project projection
  → published award projection
```

Do not expose a draft/finalized-but-unpublished project merely because a user is
on its roster. Do not leak the submission edit token, contact email, badge
number, judge score, consensus, private chat, or audit history.

### Snapshot boundary

`team_members` is a submission-owned snapshot. On team invitation/join, the UI
may offer “prefill from your profile” for the owner/member to accept. After
write, roster fields are independent. A profile edit never updates a finalized
submission or public historical roster. A roster correction never overwrites a
profile. For a draft, an owner may explicitly choose “update this roster from
profile” as a separate action; it must be audited and must not change
membership authorization.

## 9. Award and recognition projection

Profiles may show recognition only from D.4 publication-safe data:

- active `publication_awards` whose event/submission release is published or
  archived under the documented participant policy;
- published event name/label;
- published project title;
- explicit membership/ownership at the time of that submission;
- optionally the public team name.

The profile must not read `result_winners`, unpublished finalists, raw ranking
rows, judge scores, calibration, consensus, tie rationale, or publication
revision internals directly for public output. Use a single repository method
that joins active publication projection + event + submission + explicit
participant attribution.

Suggested presentation:

```text
Awards
Grand Prize · Kentucky Vibes 2026
PACS Copilot
```

If a team member later leaves or a profile is disabled, preserve the historical
published attribution through an immutable attribution/tombstone snapshot; do
not delete the award or rewrite the public event record.

## 10. Role presentation

Do not add profile badges for “Judge” or “Organizer” in F.0. Raw authorization
is security-sensitive and current event roles are relationships, not durable
identity claims.

For future deliberate event metadata, a safe display could be:

- `Judge · Kentucky Vibes 2026` — only if a public event-role flag is explicitly
  recorded and the event is public;
- `Organizer · Vibe Hackathon 2026` — only from deliberate public metadata,
  never from `admin_authorizations`.

A user who was a judge in one event must not appear globally as a judge. A
revoked authorization must not leave a current role badge. F.0 may show role
relationships privately in the existing Account access card, but should label
them as current access (`Judge access · current event`) rather than profile
badges.

## 11. Account/Profile UX proposal

### Information architecture

Keep `/account` as the signed-in control center and add a focused
`/account/profile` route only if the existing card cannot remain legible. The
recommended F.0 structure is:

```text
Account
  Profile       Your public identity
  Projects      Your explicit project memberships
  Event access  Current participant/judge/administrator access
  Security      Password, sessions, linked Viby identity
```

For the smallest implementation, keep `/account` as the route and make Profile
an emphasized first card with a “View public profile” link. Add `/account/profile`
when the profile editor becomes multi-section; do not mix password/Viby/session
controls into the public-profile form.

Profile editor sections:

1. **Identity** — display name, handle, initials/avatar preview;
2. **About** — headline, bio, affiliation, degrees;
3. **Links and interests** — validated links and bounded tags;
4. **Visibility** — private/public explanation, public preview, save/cancel.

Use a two-column calm settings layout on desktop and one-column 44px-target
stack on mobile. Preserve the existing CSS variable theme, headline type, card
border, and restrained professional tone. Use progressive disclosure for the
handle and public preview; do not present a dense metadata table.

### Public profile experience

`/people/:handle` should feel like a compact professional portfolio:

```text
[initials]  George Shih
            Radiologist · Weill Cornell Medicine
            Building tools at the intersection of imaging and AI.
            GitHub · Website · LinkedIn

Projects                         Awards
2026 Vibe Hackathon              Grand Prize · Kentucky Vibes 2026
AI Colonoscopy Assistant         PACS Copilot
Team Atlas

About
...
```

Use a single identity header, restrained metadata, and meaningful project cards.
Omit empty sections. Do not use admin tables, authorization badges, raw IDs, or
social-feed clutter. A profile with no public history should still feel complete
through its identity header and About content. On mobile, stack the header and
use full-width project/award cards; do not shrink a desktop table.

### Accessibility and design requirements

- keyboard-accessible edit/save/cancel and visibility controls;
- visible focus states and descriptive labels;
- a text explanation beside every visibility state, never color alone;
- avatar is decorative when the display name is present and has no duplicate
  screen-reader announcement;
- bio Markdown renderer strips raw HTML, unsafe links, and embedded media;
- success/error states are announced with `role=status`/`role=alert`;
- no horizontal overflow at 390px; mobile actions have at least 44px targets;
- public profile uses stable heading hierarchy and meaningful empty-state
  omission, not “No data” cards.

## 12. Profile/judge boundary

Keep `judges` as the event’s judge profile and contact/workload record. It may
continue to own judging-specific name/email/institution fields while F.0 is
introduced. Add an explicit future `judge_profile.user_id` only after an
operator-reviewed mapping; do not map by email or display name.

Eventually:

- durable profile: preferred public name, bio, links, skills;
- judge profile: event-specific judging name, institution/contact, expertise,
  availability, conflict metadata, assignment state;
- authorization: user ↔ judge profile ↔ event, live and revocable.

A judge may also be a participant in another event or a teammate in the same
event. No profile route or editor may collapse these relations. F.0 should
provide a repository seam for a deliberate mapping, but no judge-schema change
is required for the first profile domain.

## 13. Deletion, disabling, and historical attribution

Current FK behavior makes hard user deletion unsafe:

- sessions/accounts/account controls/admin authorizations cascade;
- Viby local binding is `SET NULL`;
- submission ownership and legacy `team_owners` cascade;
- active submission memberships, judge authorizations, chat authors/read
  states, and some invitations restrict deletion;
- audit actor IDs are deliberately unconstrained;
- finalists/winners/publication actor IDs are `SET NULL`.

Therefore F.0 must not add a user-delete button. Use account disablement:

1. mark `user_account_controls.status='disabled'` and revoke sessions through
   the existing account-management path;
2. set `user_profiles.deactivated_at` and make public profile resolution return
   a generic not-found/private result;
3. preserve profile/project/award attribution through a public display snapshot
   or tombstone (`display_name`, optional handle label, deactivated marker);
4. keep submission ownership/membership and judging/audit history intact;
5. retain Viby link and authorization audit history according to existing
   retention rules; never reactivate automatically.

A later deletion policy must decide which records require legal deletion versus
historical pseudonymization. It must be an explicit, audited workflow with a
preflight report; it is not part of F.0.

## 14. Multi-event readiness

F.0 can be multi-event-ready without implementing multi-event navigation:

- profile is keyed only by `user_id`, never by event;
- project history always joins `submissions.event_id`;
- awards always join `publication_awards.event_id` and publication state;
- judge/admin relationships remain event-scoped authorization records;
- team membership remains submission-scoped;
- public profile payload contains event slug/name, not an implicit active-event
  singleton;
- repository methods accept explicit user/profile IDs and event IDs where a
  projection is event-sensitive.

Future model when multi-event UX is funded:

```text
user_profiles (one per person)
  └─ event_participations (user_id, event_id, status, public display policy)
       ├─ submission_memberships / owners
       ├─ judge_authorizations → judge profiles
       └─ deliberate public event-role metadata
```

`event_participations` should be introduced only when event-level discovery,
participant status, or event-only visibility needs it. Do not manufacture rows
for every existing user during F.0A. Existing memberships and authorizations
remain the initial participation evidence.

## 15. Additive migration strategy (F.0A)

### First run

1. Create `user_profiles` with a unique `user_id` FK, nullable handle, safe
   visibility default `private`, bounded text checks, timestamps, and
   `deactivated_at`.
2. Create indexes on `user_id`, `visibility`, and normalized handle (partial
   unique where handle is not null).
3. Create a migration/fixture marker table or migration version entry using
   the repository’s existing idempotent migration conventions.
4. Do not alter `users`, `accounts`, sessions, Viby links, submissions,
   memberships, judges, scores, publication, or Chatto tables.
5. Optionally create profile shells only for users who have already opened
   Account or explicitly opt into profile setup. If a complete shell backfill
   is desired, insert one private shell per user with no public handle and no
   copied affiliation/roster data.

### Display-name seeding

- If seeding, use `users.name` only when non-empty and normalize whitespace;
- otherwise use a non-public placeholder requiring user completion, not email;
- never copy `team_members.affiliation`, degrees, or name into a durable profile
  automatically because a user may have multiple event snapshots;
- never copy Viby display name, affiliation, tag, or image automatically;
- never set visibility to public during migration.

### Handles and collisions

- Leave handle nullable for private shells;
- generate no public route until the user deliberately enables public;
- when a handle is selected, normalize/reject according to the ASCII policy,
  check reserved words, and commit the unique value transactionally;
- conflicting source data cannot overwrite an existing handle;
- rerun is a no-op for existing profile rows and never changes visibility,
  display name, handle, or links.

### Compatibility and rollback

- old release ignores the additive table safely;
- new release can read missing shells as “profile not set” during a staged
  deployment;
- rollback leaves the additive table and rows in place; no existing table is
  rewritten;
- profile projection failures fail closed to no public profile rather than
  falling back to email or exposing a user ID.

## 16. Kentucky Vibes scale assessment

The preserved E3C qualification artifact was inspected read-only:

- 166 users/accounts in the final rehearsal snapshot, including operational
  test accounts; the realistic seed target is 150 synthetic users;
- 85 submissions/teams in the final rehearsal artifact, including inherited
  and operator additions; realistic seed target is 75;
- 35 judge profiles, 34 event-scoped authorizations;
- 287 assignments, 264 human scores;
- 266 submission memberships, 289 roster rows, 189 invitations;
- 50 native-chat rooms and 231 messages;
- two events are present in the artifact, with Kentucky Vibes as the active
  synthetic event; production remains a separate database.

This is sufficient to validate the F.0A query shape. Expected scale behavior:

- one profile lookup by unique handle is O(1) with the partial unique index;
- one user’s project history joins explicit membership/owner rows to
  submissions and events, then filters publication-safe projects;
- award history joins published releases and active awards by event/submission;
- no public query should scan all private roster/email rows or all chat/audit
  records;
- page-level projection should select only public columns, not `users.email`,
  credentials, edit tokens, roster badge fields, or judge notes.

The scale test should include owners with multiple projects, teammates with one
project, a judge who also participates, a user with no project membership, a
disabled user, and a profile with a long name/bio/affiliation. Do this in a
disposable Kentucky Vibes clone; do not mutate the current event.

## 17. Bounded implementation phases

### F.0A — Durable Profile Domain (recommended next)

- additive migration and schema/repository;
- handle normalization/reserved words/collision policy;
- private/public visibility with fail-closed reads;
- profile shell migration or lazy creation;
- project-history and published-award projection interfaces;
- no public route or broad UI required until projection tests pass.

### F.0B — Profile Editing

- Account/Profile section or `/account/profile`;
- self-only update API with same-origin/CSRF and Better Auth principal;
- field validation, link host policy, sanitized bio, visibility preview;
- no password, session, Viby, or authorization controls in the form;
- audit `profile_created`, `profile_updated`, `profile_visibility_changed`.

### F.0C — Profile Page

- `/people/:handle` public route;
- public sanitized projection only;
- `noindex` for private/unlisted responses;
- project history and published awards;
- disabled/deactivated profile behavior;
- desktop/mobile/accessibility review.

### F.0D — Project/Workspace Integration

- optional profile links from public team roster only where the member has
  explicitly public profile and explicit account membership;
- “complete your profile” incentive in My Projects/Account;
- opt-in prefill for draft roster fields;
- no finalized roster rewrite;
- no People directory/search yet.

### F.0E — Kentucky Vibes qualification and deployment

- migrate a disposable copy twice;
- deterministic profile fixture coverage at realistic scale;
- authenticated owner/teammate/judge/dual-role/empty-account checks;
- public/private/unpublished/published/disabled scans;
- desktop/mobile/keyboard checks;
- production backup, migration, health, and rollback qualification;
- deploy only after F.0A–F.0D pass and production remains unpublished.

## 18. Test plan

### Domain and migration

- migration first run and rerun are idempotent;
- incompatible profile schema fails closed;
- every existing user remains private/unlisted;
- no existing submission, membership, judge, score, publication, Viby link,
  or Chatto row changes;
- profile `user_id` uniqueness and FK behavior;
- handle normalization, reserved names, collision, length, and Unicode
  rejection;
- nullable handles do not create public routes.

### Authorization and privacy

- only the signed-in owner can edit their profile;
- participant cannot edit another profile;
- judge/admin privileges do not grant profile mutation for another user unless
  a separate, explicit support policy is added later;
- private profiles are absent from public route, search, sitemap, RSC payload,
  exports, and `HEAD` enumeration;
- public projection never contains email, badge number, Better Auth ID,
  Viby subject/link/session ID, edit token, invitation token, private chat,
  judge note, score, calibration, or audit metadata;
- disabled/deactivated profile fails closed while published project/award
  attribution remains a safe tombstone;
- dual-role user profile and event authorization remain separate;
- Viby link/revocation does not alter profile visibility or content.

### Projection and publication

- project history derives only from explicit owners/memberships;
- email matching alone never creates history;
- draft, incomplete, finalized-but-private, withdrawn, and unpublished
  submissions are hidden from public profile;
- published project appears with event attribution;
- published awards appear only from active approved publication-safe records;
- removed/unpublished awards disappear from the public projection;
- profile edits never rewrite finalized roster snapshots;
- optional draft prefill is explicit and audited.

### UX, accessibility, and scale

- Account/profile editor desktop and 390px mobile layout;
- keyboard navigation, focus, labels, status/error announcements;
- bio sanitization and unsafe-link rejection;
- long name/headline/bio wrapping and truncation behavior;
- empty project/award sections omitted;
- owner, teammate, judge-who-participates, no-project, multi-project, disabled
  profile personas on Kentucky Vibes;
- no public profile is created by seed or migration by default;
- profile route p95 and history query remain within existing application
  budgets at 150–200 users;
- no N+1 queries or unbounded roster/chat joins;
- exports and browser source scans remain clean.

## 19. Open decisions

1. **Profile shell timing:** lazy-create on first Account visit (smallest,
   avoids rows for service accounts) or private shell for every user (simpler
   joins). Recommendation: lazy-create plus a safe read fallback in F.0A.
2. **Handle reservation:** allocate only at public opt-in or allow a private
   reserved handle. Recommendation: allocate at explicit handle selection;
   keep private profiles handle-null.
3. **Public default:** must remain private. This is not optional.
4. **Event-only visibility:** defer to F.1 until event participation semantics
   are explicit.
5. **Avatar:** initials first; use existing provider image only by opt-in;
   defer uploads and Viby image import.
6. **Handle changes:** no redirect history in F.0 unless public sharing/SEO is
   a launch requirement. If added, use immutable aliases/tombstones.
7. **Historical attribution:** decide whether to add an immutable
   `profile_project_attributions` snapshot in F.0C or derive from retained
   membership history. Recommendation: add a narrow snapshot only when a
   member-removal/deactivation test proves derivation is insufficient.
8. **Judge mapping:** do not add `judges.user_id` in F.0A. Require an explicit
   future operator mapping flow if judge profile links are needed.
9. **Index/search:** indexes now; full-text name/affiliation/interests search
   belongs to F.1.
10. **Deletion policy:** disabled/tombstoned profile first; legal deletion
    workflow is a separate privacy decision.

## 20. Audit conclusion

The current architecture already separates authentication, identity linking,
application authorization, event participation, roster snapshots, judging, and
publication. The durable-profile gap can be filled additively without changing
those boundaries.

The most important safety decisions are:

- no global role column;
- no email-based identity inference;
- no automatic public migration;
- no Viby metadata/image import;
- no live profile ↔ roster synchronization;
- no public visibility for unpublished projects or awards;
- no hard user deletion in the first profile slice;
- explicit event-aware projections for project history and recognition.

No code, schema, database, service, production, Chatto, or Viby mutation was
performed in F.0. This document is the implementation plan and architecture
baseline for F.0A.

**GO FOR F.0A — DURABLE PARTICIPANT PROFILE DOMAIN**

## F.0A implementation follow-up

The read-only recommendation above was implemented as the additive,
privacy-first domain described in
[`PHASE_F0A_DURABLE_PROFILE_DOMAIN.md`](./PHASE_F0A_DURABLE_PROFILE_DOMAIN.md).
The implementation preserves every boundary in this audit: no global role,
email-based identity inference, Viby metadata import, roster synchronization,
public-by-default migration, public profile UI, Chatto change, or Viby change.

F.0A remains intentionally undeployed so the next approved slice can qualify
the self-service editor and public projection in Kentucky Vibes before a
production migration. The implementation disposition is:

The implementation keeps `display_name` nullable for a private lazy shell when
Better Auth has no safe non-empty `users.name`; F.0B must require a display name
before enabling public visibility. This is the only intentional relaxation of
the audit's recommended shape and avoids inventing identity data.

**GO FOR F.0B — PROFILE EDITING**
