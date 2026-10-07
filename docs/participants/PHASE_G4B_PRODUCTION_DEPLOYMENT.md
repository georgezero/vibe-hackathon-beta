# Phase G.4B — Production Deployment of Team Formation / Invitations

Status: **GO — G.4 TEAM FORMATION / INVITATIONS DEPLOYED AND QUALIFIED**
Production: <https://vibe-hackathon-dev.ggg.ad>
Kentucky Vibes review: <https://kentucky-vibes-f0b.ggg.ad>

G.4 was deployed as an application-only immutable release. The deployment
preserved roster, project-access, invitation, submission, deadline, judging,
publication, authentication, Team Chat, DMs, Community, Chatto, and Viby
policies. No production team, invitation, membership, submission, or result was
created or changed for qualification.

## 1. Production baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Starting release: `/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-g3-submission-readiness-20260809T235610Z`
- Starting PID/start/restarts: `2588190` / `2026-08-09 19:56:28 EDT` / `0`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Starting database SHA-256: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Integrity/FK: `ok` / no violations
- Active event: `evt_vibe_2025`, slug `vibe-hackathon-2026`
- Event freeze: `false`
- Submission and judging deadlines: unset (the authoritative windows remain
  open)
- Publication: one `calculated` release, `published_at = null`; no published
  winners

Baseline business counts were 10 submissions (5 draft, 5 finalized), 10 teams,
2 owners, 28 roster rows, 5 active/revoked membership rows, 3 revoked
invitation rows, 5 judges, 3 authorizations, 17 assignments, 14 human scores,
5 AI reviews, one Team Chat room with 6 messages and 2 read states, zero DMs,
four Community channels with zero messages, 11 users/accounts, 3 private
profiles, one publication release, one publication award row, and 2 Viby links.

## 2. Backup and migration

Fresh online backup:

`/opt/vibe-hackathon/backups/production-pre-g4b-20260810T014127Z.sqlite`

- UTC: `2026-08-10T01:41:27Z`
- Size: `1,380,352` bytes; mode `0600`
- Backup SHA-256: `498bfd83fde92c39548b1808bf67a93729900fac1cb9f4be16c430d74d204689`
- Source SHA: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- `PRAGMA integrity_check`: `ok`
- `PRAGMA foreign_key_check`: passed

**G.4 requires no canonical schema migration.** No G.4 migration or schema
delta was present. Existing roster, invitation, membership, chat, audit,
deadline, judging, and publication columns support the release.

## 3. Build and immutable release

The qualified source tree fingerprint is:

`d39c18a37779822b19d646fa41fa5b4e57497125137ab6215c158e7739c52997`

The immutable release is:

`/opt/vibe-hackathon/releases/g4b-team-formation-20260810T014826Z`

It records HEAD, source fingerprint, build timestamp, and `databaseMigration:
false` in `RELEASE_METADATA.json`. It contains no `.env.local` or canonical
database. Build ID: `9w11c7CH8W5bTZZG7Mklt`.

Passed before deployment:

- G.4 focused tests: 4/4;
- complete unit suite: **311 tests across 60 files passed**;
- TypeScript;
- production build;
- scoped changed-file ESLint;
- `git diff --check`;
- Impeccable detector on changed UI files.

The full suite retains its expected guarded Viby migration-policy stderr; it did
not fail a test or touch the canonical production database.

## 4. Deployment

The `current` symlink was atomically switched from G.3 to the release above.
Only `vibe-hackathon.service` was restarted. Chatto, Viby, Kentucky Vibes, and
unrelated services were not restarted.

- New PID: `2898274`
- Process start: `2026-08-09 21:54:25 EDT`
- Final restart counter: `0`
- Active state: `active/running`
- Local/public health: HTTP 200
- Rollback pointer: `/opt/vibe-hackathon/current.previous-g4b-20260810T014826Z`

An initial packaging attempt was rejected by systemd with `203/EXEC` because
the copied release had an empty dependency directory. The service was stopped,
the already-qualified dependency tree was copied from G.3, and the release was
started cleanly. The transient start attempts caused no listener, request, or
database mutation; the final unit was reset and started with restart counter 0.

## 5. Production regression checks

Read-only anonymous checks returned HTTP 200 for `/`, `/start`,
`/start/resume`, `/projects`, `/login`, `/account/projects`, and a finalized
public project page. `/start` contains `Start your project`, `Team lead`, and
`Create project`; `/start/resume` contains safe Project ID/edit-token recovery
guidance. Signed-out `/account/projects` remains a private sign-in state.

The private roster GET boundary was explicitly checked against a real public
submission ID without using its edit credential:

- missing bearer: HTTP 401 `Authorization required`;
- invalid bearer: HTTP 403 `Invalid token`;
- no roster fields were returned on denial.

Unauthenticated invitation listing and acceptance endpoints returned HTTP 401.
The invitation handoff route remains private/no-store and the token-bearing
redirect sets HttpOnly, SameSite, short-lived context with no referrer. No
invitation URL is generated by a sitemap or public navigation.

Deployed source and focused regression checks confirm:

- roster PATCH uses authoritative server deadline checks and returns
  `DEADLINE_PASSED` after a configured deadline;
- invitation creation and acceptance limits remain 10 per owner/project/hour
  and 10 per participant/15 minutes;
- the Team lead/Teammates/Project access projection is used by Team surfaces;
- roster rows do not grant project access, and invitation acceptance alone does
  not change roster fields;
- roster replacement does not create memberships and does not silently revoke
  access when a row is removed;
- only a Team lead manages invitations/access; project access cannot grant
  judge/admin rights;
- G.1 agent prompts retain complete-roster replacement semantics and explicit
  human control over finalization;
- Team Chat, DMs, Community, judging, deadline, finalization, and publication
  authorization remain unchanged.

Positive invitation creation, normal-auth acceptance, wrong-account warning,
expiry/revocation, idempotent acceptance, access revocation, 49 ms Team Chat
denial, maximum-team, deadline, mobile, and accessibility journeys remain
covered by the isolated G.4 clone and its 311-test/browser evidence. No real
production invitation or roster was used merely to repeat those mutations.

## 6. Privacy and business-data preservation

Anonymous and denied API responses contained no badge numbers, invitation or
edit tokens, private roster emails, Better Auth/Viby identifiers, judge state,
scores, private notes, Team Chat, DM, or Community data. The release contains
no environment file or database artifact.

After deployment the canonical database SHA remained:

`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`

Critical table counts and hashes matched the verified backup for submissions,
owners, teams, roster, memberships, invitations, judges, authorizations,
assignments, human/AI scores, Team Chat, DMs, Community, publication, and Viby
links. Integrity remained `ok` and foreign-key check returned no rows. No
production project, roster, invitation, membership, finalization, or result
publication was performed.

The production publication row remains `calculated` with `published_at = null`;
results and awards remain unpublished to participants.

## 7. Kentucky Vibes and rollback

The standing review environment is still active and unchanged:
<https://kentucky-vibes-f0b.ggg.ad>. Its process remained PID `2084020`, restart
counter `0`, and health HTTP 200. The stopped G.4 qualification clone and its
mode-0600 evidence snapshot remain separate.

For an application-only rollback, atomically point `current` to
`current.previous-g4b-20260810T014826Z`, restart only `vibe-hackathon.service`,
and verify local/public health. Database restore is reserved for integrity
failure, unexpected business mutation, or corruption; it is not needed for a
UI/projection rollback.

## 8. Next participant phase

G.1–G.4 now cover start/onboarding, participant home, submission readiness, and
team/invitations. The strongest remaining bounded friction is the density and
continuity of the project editing form itself after a participant enters the
workspace. Recommend:

**G.5 — Project Editing / Submission Form UX**

Do not begin it automatically.

**GO — G.4 TEAM FORMATION / INVITATIONS DEPLOYED AND QUALIFIED**

**RECOMMEND G.5 — PROJECT EDITING / SUBMISSION FORM UX**
