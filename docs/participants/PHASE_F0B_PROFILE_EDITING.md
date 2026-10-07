# Phase F.0B — Participant Profile Editing and Preview

Date: 2026-08-08
Starting commit: `a70edc28326108dfc84a69af303f680ceaa7f735`
Production database: unchanged; no F.0A/F.0B migration was run against the canonical production file.

## Scope

F.0B adds a private, self-service profile editor and a self-only preview. It
does not add the public `/people/:handle` route, a directory, search, avatars,
event-only visibility, or roster synchronization. F.0C owns the public profile
experience.

The existing Better Auth principal remains the only identity used by the
mutation API. Profile data does not grant participant, judge, administrator,
chat, or Viby access.

## Account experience

The Account hub now leads with a participant-facing Profile card showing
initials, display name, headline, visibility, and a restrained completion
signal (`N of 6 recommended details added`). It links to `/account/profile` and
`/account/profile/preview`; password, sessions, linked Viby identity, and event
access remain separate security/access sections.

`/account/profile` is a grouped editor:

- Identity: display name, profile address, headline, initials avatar.
- About: affiliation, degrees/title, plain-text bio with a 2,000-character counter.
- Links and interests: validated website/GitHub/LinkedIn links and keyboard-friendly tags.
- Visibility: explicit Private/Public choices with consequences explained.

The layout uses the existing semantic color tokens and responsive account
patterns. The mobile layout remains single-column with 44px action targets and
no horizontal overflow.

## Mutation API

`PATCH /api/account/profile` is self-only and requires the Better Auth-backed
application principal plus the existing exact same-origin mutation check. The
server owns all normalization and validation. Handle conflicts return HTTP 409
with `That profile address is already taken.`; invalid handles, reserved words,
links, visibility, and bounded text return safe field-level messages.

The old `{ name }` payload remains a compatibility path for existing Account
clients and updates the legacy Better Auth display name. The new editor sends
`displayName` and updates only `user_profiles`; it does not create a
bidirectional synchronization loop with Better Auth `users.name`.

Structural audit actions are recorded as `profile_created`,
`profile_updated`, `profile_visibility_changed`, and
`profile_handle_changed`. Audit metadata contains changed field names or
visibility/handle transitions only; profile contents are never copied into
audit records.

## Preview boundary

`/account/profile/preview` and the inline Preview mode use the same explicit
safe presentation component. They show only profile fields plus the existing
publication-safe project and award projections. Draft/unpublished projects,
private judge data, scores, calibration, consensus, notes, chat, tokens,
authorization, email, and Better Auth/Viby identifiers are not props to the
component and cannot appear in the preview.

Private profiles can prepare a handle without becoming public. Public
visibility still requires both a valid handle and a display name; changing
visibility never changes project access, team membership, judging, admin
access, or Viby links.

## Qualification

Disposable and Kentucky Vibes qualification covered:

- lazy private shell creation and reload;
- display name, handle, headline, affiliation, degrees, bio, links, and interests;
- Enter/comma interest entry and removal;
- reserved, malformed, and duplicate handles;
- private/public selection and safe return to private;
- self-only mutation and safe conflict messaging;
- safe preview with published-history projections only;
- desktop Chromium screenshots and a 390px mobile screenshot;
- mobile `scrollWidth === innerWidth` check (passed);
- synthetic administrator and participant accounts only.

The fresh Kentucky Vibes clone was created from the preserved E.3C snapshot
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3c-agent-rehearsal-20260808T210301Z.sqlite`
(SHA-256 `e6aa09d091663bd971341284918f5906399e65651ebf59e710f26251b20497f4`).
The clone passed the profile migration twice, SQLite integrity, foreign-key
checks, and event identity checks. It began with 166 users, 85 submissions,
and zero profiles; only the isolated clone was mutated.

Focused profile tests: 10 passed. TypeScript, production build, changed-file
ESLint, and the existing F.0A regression suite passed. The complete repository
suite should be run through `npm test` before any production migration.

## Isolated test instance

The F.0B test instance is intentionally separate from production:

- URL: `https://kentucky-vibes-f0b.ggg.ad`
- Service: `kentucky-vibes-f0b.service` (port 3050)
- TLS proxy: `kentucky-vibes-f0b-https-proxy.service` (port 3455)
- Cloudflare tunnel: `vibe-hackathon-f0b` / `kentucky-vibes-f0b-cloudflared.service`
- Writable database: `/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`
- Base URL and Better Auth URL are scoped to the dedicated hostname.
- Outbound email is disabled, Viby is pointed at a safe local endpoint, and
  publication qualification is disabled.

Temporary synthetic credentials are stored outside the repository under the
instance `credentials/` directory with mode 0600. They are not recorded in
this document. The operator can reveal one named credential with the existing
persona tooling or rotate the files before sharing access.

## F.0C follow-up

F.0C is now qualified on the isolated Kentucky Vibes environment. The public
`/people/:handle` route, generic private/unknown handling, safe metadata,
published project/award presentation, explicit participant profile links, and
desktop/mobile checks are documented in
`docs/participants/PHASE_F0C_PUBLIC_PARTICIPANT_PROFILES.md`. The route reuses
the safe projection and preview boundary established here rather than
returning raw profile rows. Production migration remains an explicit later
deployment gate.

F.0D later connected this profile foundation to My Projects, the authenticated
Team tab, and public project profile links using one safe participant identity
model. The six-detail completion signal is centralized and remains informational
only; roster data and profile data are not synchronized.

## F.0B.1 polish qualification

The profile address example is now the synthetic `maya-rivera`; no real-person
name or operator identity is used as placeholder content. The address preview
updates as a valid handle is typed, falls back to `your-handle` when empty, and
keeps the last valid candidate while an invalid value is being edited. It does
not imply that a handle is reserved until the server accepts the save.

Participant-facing copy no longer mentions implementation phases. The editor
explains that a profile address can be prepared privately and that profile
changes do not rewrite information already submitted with a team.

Handle errors are now field-specific and only appear after a server validation
response. An untouched empty optional field has no error styling. Reserved,
duplicate, and malformed handles were each exercised on the isolated Kentucky
Vibes instance. The preview uses the same hierarchy, initials, links,
interests, and publication-safe project/award omissions as the editor baseline.

Desktop and 390px mobile Chromium checks passed with no horizontal overflow.
Screenshots were captured under the isolated instance's private qualification
directory. Production, Chatto, Viby, and the preserved Kentucky Vibes source
artifact were unchanged.
