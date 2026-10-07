# Phase F.0A — Durable Participant Profile Domain

**Disposition:** domain implemented and qualified; no public profile UI or
production deployment in this slice.

**Starting HEAD:** `a70edc28326108dfc84a69af303f680ceaa7f735`
**Repository:** `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
**Qualification date:** 2026-08-08
**Production boundary:** no production database, service, publication state,
Chatto, or Viby record was changed.

## What shipped

F.0A adds a small `user_profiles` domain below Better Auth and above
event-specific records. It intentionally does not add `/people/:handle`, an
editor UI, a directory, search, event-only visibility, an avatar upload, or
any role mapping.

The implementation is in [lib/user-profiles.ts](../../lib/user-profiles.ts),
the Drizzle schema is in [lib/db/schema.ts](../../lib/db/schema.ts), and the
additive migration is [scripts/migrate-user-profiles.ts](../../scripts/migrate-user-profiles.ts).

## Schema and migration

`user_profiles` contains:

| Column | Policy |
| --- | --- |
| `id` | Opaque application profile ID. |
| `user_id` | Unique, non-null FK to `users.id`, `ON DELETE RESTRICT`. |
| `handle` | Nullable normalized ASCII public key with a partial unique index. |
| `display_name` | Nullable only for a safe incomplete private shell; 2–100 characters when present. |
| `headline`, `bio`, `affiliation`, `degrees` | Bounded durable self-described text. |
| `website_url`, `github_url`, `linkedin_url` | Stored only after scheme/host validation; no remote fetch. |
| `interests` | Bounded JSON string array (maximum 12 items, 40 characters each). |
| `visibility` | `private` or `public`, default `private`. |
| `deactivated_at` | Hides public identity while preserving event history. |
| `created_at`, `updated_at` | Application timestamps. |

There is no email, badge number, event ID, role, judge ID, Viby subject, or
session field. The table and indexes are created additively and validated on
every run. Existing profile rows are never rewritten. The migration requires an
absolute, regular, non-symlink target and an exact confirmation:

```text
MIGRATE USER PROFILES DATABASE <absolute-target>
```

Run twice with:

```bash
DB_FILE_NAME=/absolute/disposable.sqlite \
VIBE_USER_PROFILES_MIGRATION_CONFIRM="MIGRATE USER PROFILES DATABASE /absolute/disposable.sqlite" \
npm run db:migrate:user-profiles
```

The package script is intentionally not run against the canonical database in
F.0A. A later deployment must use the established backup, migration, and
rollback procedure.

## Lazy profile behavior

`ensureOwnProfile(userId)` verifies the Better Auth user, then creates one
private profile shell only when profile functionality is used. It copies a
non-empty `users.name` and nothing else. An empty Better Auth name remains
`NULL`; it is never synthesized from email, roster, judge, or Viby data.

`getOwnProfile` is a self-only repository read. `updateOwnProfile` is a domain
boundary for F.0B and is not exposed by a new route in this slice. Public
visibility requires both a valid handle and a display name. Profile
deactivation is explicit and does not delete attribution records.

## Handle policy

Handles are normalized with Unicode NFKC, trim, and lowercase, then must match:

```text
[a-z0-9]+(?:-[a-z0-9]+)*
```

They are 3–30 characters, ASCII-only, cannot begin/end with `-`, and cannot
contain `--`. Unsupported Unicode is rejected rather than transliterated.
The centralized reserved set covers existing and planned application routes,
including `admin`, `account`, `people`, `projects`, `judge`, `api`, `health`,
`status`, `results`, `calibration`, `publication`, `presentation`, `submit`,
`recover`, `winners`, `register-team`, `submission`, `audience`, and
`ai-evals`. The database partial unique index is the final collision boundary;
the domain maps a concurrent conflict to `handle_taken`, not an HTTP 500.

F.0C may use `/people/:handle`. Existing users receive no handles during
migration, and private handles are not publicly resolvable.

## Visibility and public projection

Only `private` and `public` exist in F.0A. Private is the default and no action
(profile creation, Viby linking, team joining, judge authorization, admin
authorization, or project publication) changes it. There is no `event_only`
mode until event participation semantics are designed.

`getPublicProfileByHandle` returns a dedicated `PublicParticipantProfile`, never
a raw row. It selects only the handle, display identity, initials, profile
content, validated links, and interests. It never returns user IDs, email,
Better Auth metadata, sessions, Viby identifiers, authorization state, tokens,
badge data, private chat, judge notes, scores, or audit metadata. Invalid,
private, deactivated, and disabled accounts all resolve to the same `null`
result to prevent enumeration.

## Project and award projections

`listPublicProfileProjects(userId)` and `listPublicProfileAwards(userId)` are
event-aware repository seams for F.0C. They use only explicit
`submission_owners` and active `submission_memberships`; a `team_members` email
or name match can never create project history. Queries join `submissions` to
its explicit `events` row and do not call `getActiveEvent()`.

For this conservative first slice, a project or award is returned only when the
event's D.4 `publication_releases` state is `published` or `archived`. Draft,
incomplete, withdrawn, finalized-but-unpublished, unpublished award, ranking,
calibration, consensus, feedback, chat, and audit data is excluded. Active
published `publication_awards` provide recognition; raw result winner/finalist
rows are not public profile sources.

This narrow boundary is intentional until the application has one unified
public-project policy. It prevents profile history from widening the existing
publication surface. The returned project/award shapes expose event slug/name,
not internal event IDs.

## Roster, judge, admin, and Viby boundaries

`user_profiles` is durable self-managed identity. `team_members` remains an
event/submission roster snapshot. No profile edit updates a roster, and no
roster edit updates a profile; finalized historical submissions are untouched.
An eventual “prefill from profile” action must be explicit and draft-only.

`judges`, `judge_authorizations`, `admin_authorizations`, and all native-chat
authorization code are unchanged. A profile cannot grant participant, judge,
administrator, workspace, assignment, or chat access. No `users.role` column and
no `judges.user_id` mapping were added.

Viby is unchanged. No Viby display name, portrait, assertion, subject, session,
or link metadata is copied into a profile, and profile visibility does not
affect Viby authorization.

## Qualification evidence

### Disposable domain and migration

The focused profile suite covers:

- first-run and second-run migration, integrity, foreign keys, exact schema and
  no backfill;
- lazy private shells and safe Better Auth name seeding;
- strict handle normalization, reserved words, Unicode rejection, length and
  collision behavior;
- bounded interests and profile completeness for public visibility;
- generic public not-found behavior for private, deactivated, and disabled
  accounts;
- safe projection shape with no user/email/judge/Viby fields;
- owner, active teammate, revoked teammate, roster-only, and dual-role
  participation behavior;
- published project/award inclusion and unpublished state exclusion.

Focused result: **9 tests passed**. The full isolated unit suite completed with
**270 tests passed**. TypeScript, changed-file ESLint, `git diff --check`, and
the production build passed.

### Kentucky Vibes clone

The preserved E.3C artifact was copied to a disposable regular file (source
SHA-256 `e6aa09d091663bd971341284918f5906399e65651ebf59e710f26251b20497f4`),
then migrated twice. Both runs reported zero automatic profile rows,
`idempotent: true`, and passed foreign-key validation. The clone retained the
Kentucky Vibes active event (`evt_kentucky_vibes`, slug `kentucky-vibes`), 166
users, integrity `ok`, and an empty profile table. The immutable source was not
opened for writing.

The domain query shape is indexed by unique handle/user and explicit
membership/owner relationships; it never scans roster email, chat, audit, or
all users for one profile. A second writable clone exercised deterministic
domain fixtures for 25 users (7 public, 18 private, 141 without a profile),
including handle assignment and safe project/award queries; unpublished
Kentucky Vibes results correctly produced no public history. Authenticated
profile UI belongs to F.0B/F.0C qualification, not this domain-only slice.

## Production disposition and rollback

No production migration was applied. The canonical database, users, accounts,
sessions, Viby links, submissions, memberships, team roster, judges,
authorizations, assignments, scores, publication records, chat, and audit
business data remain unchanged. Chatto and Viby remain unchanged.

Rollback for the eventual deployment is simple: restore the pre-migration
immutable database backup using the existing qualified database restore command;
the additive `user_profiles` table may also remain safely in an application
rollback because older code ignores it.

## F.0B follow-up

F.0B adds the self-only editor at `/account/profile`, the private/public
visibility control, safe preview, profile completeness signal, and the
self-only `PATCH /api/account/profile` mutation. It deliberately does not add
the public `/people/:handle` route; F.0C owns that surface. The editor uses the
F.0A validation/projection boundaries and leaves roster, judge, administrator,
Viby, and publication records unchanged.

## Next slices

**F.0B — Profile Editing:** authenticated self-only editor, CSRF/origin
protection, field validation, visibility preview, and profile audit events.

**F.0C — Profile Page (qualified in isolated Kentucky Vibes):**
`/people/:handle`, public projection rendering, published projects/awards,
deactivated behavior, safe metadata, accessibility, and mobile qualification.
See `PHASE_F0C_PUBLIC_PARTICIPANT_PROFILES.md`; production migration remains a
separate deployment gate.

**F.0D — Workspace integration:** explicit profile links and opt-in draft roster
prefill only. F.1 owns directory/search and event-only visibility.

**GO FOR F.0D — PROFILE / PROJECT INTEGRATION**
