# Phase G.2B — Production Deployment of Participant Home / My Projects

**Disposition:** GO — G.2 PARTICIPANT HOME DEPLOYED AND QUALIFIED
**Production:** <https://vibe-hackathon-dev.ggg.ad>
**Kentucky Vibes review:** <https://kentucky-vibes-f0b.ggg.ad>

G.2 was deployed as an application-only participant-home release. The
authoritative submission, membership, readiness, Team Chat, judging,
publication, authentication, and Viby rules were not changed.

## Baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Starting release: `a70edc28326108dfc84a69af303f680ceaa7f735-g1-start-onboarding-20260809T171600Z`
- Starting PID/start/restarts: `1588618` / `2026-08-09 13:20:31 EDT` / `0`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Starting canonical SHA: `b78b0bb1a5d503a7b3bf60218abf174a0367414a080322284faa83845fe3cdc5`
- Starting integrity/FK: `ok` / no violations
- Active event: `evt_vibe_2025`, slug `vibe-hackathon-2026`, display name `RSNA 2026`
- Event frozen: `false`; submission and judging deadlines are unset, so the
  existing deadline helpers report their windows open.
- The legacy `events.winners_published_at` compatibility field is populated,
  but the authoritative D.4 `publication_releases` row remains
  `calculated` with `published_at = null`; `result_winners = 0`. Results were
  not published.

Starting counts included 10 users/accounts, 26 sessions, 2 private profiles,
10 submissions, 2 owners, 5 memberships, 28 roster rows, 10 teams, 5 judges,
3 judge authorizations, 17 assignments, 14 scores, 1 Team Chat room, 6 Team
Chat messages, 0 direct conversations/messages/blocks/reports, 4 Community
channels with 0 messages/read states/reports, 2 Viby links, and 1 publication
release.

The working tree contained the previously qualified participant foundation
overlay. G.2 introduced no migration files. The release was assembled from
the qualified working-tree state at the HEAD above; the G.2 source files were
copied explicitly into the release candidate and local `.env`, database,
cache, and test artifacts were excluded.

## Backup and schema determination

Fresh verified backup:

`/opt/vibe-hackathon/backups/production-pre-g2b-20260809T205910Z.sqlite`

- UTC timestamp: `2026-08-09T20:59:10Z`
- Size: `1,380,352` bytes
- Mode: `0600`
- SHA-256: `0aba73d543bcc1ed0913faa583240f96ed2550398656e118c2f967dcb30f06f0`
- Source SHA: `b78b0bb1a5d503a7b3bf60218abf174a0367414a080322284faa83845fe3cdc5`
- Integrity: `ok`
- Foreign keys: passed

G.2 requires **no canonical schema migration**. The candidate-versus-current
release difference contains the participant-home page, projection and batched
query helpers, focused tests, qualification helper, stylesheet changes, and
documentation/screenshots only. No `scripts/migrate-*`, Drizzle schema, or
database table/index change was present.

## Build and release

The immutable release is:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-g2-participant-home-20260809T205910Z`

Qualified release checks:

- full suite: **299 tests across 58 files passed**;
- G.2 projection and G.1 onboarding tests passed;
- TypeScript passed;
- production build passed with the production environment guard;
- changed-file ESLint passed;
- `git diff --check` passed.

The build emitted only the existing Better Auth warning that GitHub OAuth
credentials are not configured for this password-mode deployment. No secret
was written to the release.

## Deployment

The `current` symlink was switched atomically from the G.1 release to the G.2
release. Only `vibe-hackathon.service` was restarted. Chatto, Viby, Kentucky
Vibes, and unrelated services were not restarted.

- New PID: `2145227`
- Process start: `2026-08-09 17:04:19 EDT`
- Restart count: `0`
- Active state: `active/running`
- Local health: HTTP 200
- Public health: HTTP 200
- Final release: the G.2 release above
- Rollback pointer: `/opt/vibe-hackathon/current.previous-g2b-20260809T205910Z`

## Production smoke

Anonymous checks passed for `/`, `/start`, `/start/resume`, `/projects`,
`/login`, and the public profile surface. An unknown public profile returned a
generic HTTP 404. `/account/projects` remained a private sign-in state and
did not expose project data. Unauthenticated `/people`, `/messages`, and
`/community` redirected to login; unauthenticated direct-message and Community
APIs returned 401. Admin and judge routes retained their existing anonymous
denials.

Because no approved production participant credential with projects was
available, a bounded synthetic participant account was used only for the
authenticated empty-state smoke. It logged in through the normal UI with no
cookie injection and landed at `/account/projects` without a `returnTo`.

Verified:

- `My Projects` heading and work-first empty state: `No projects yet`;
- `Start a project` action present;
- no privileged data in the rendered participant page;
- `/account`, `/people`, and `/messages` loaded normally;
- `/community` failed closed with generic 404 because the account had no active
  event participation, matching the F.3 access policy;
- desktop width `1440/1440` and mobile width `390/390`;
- disabled-account login attempt remained on `/login` with generic failure.

The positive multi-project, lifecycle, attention, sorting, unread, and
workspace-return journeys remain covered by the Kentucky Vibes qualification
fixtures and screenshots documented in the G.2 report.

## Projection and privacy checks

The deployed `ParticipantProjectSummary` remains participant-safe and batched.
It does not include judge IDs, scores, private notes, admin state,
authorization internals, Viby IDs, or private result state. Activity and Team
Chat unread data use bounded aggregate queries rather than per-card loops.

The lifecycle mapping remains:

`Needs attention → Ready to submit → Draft → Submitted → Judging → Results pending → Results available`

with deterministic next actions and urgency sorting. Drafts cannot become
`Results available` merely because a release row exists; unpublished results
remain hidden behind the authoritative publication status.

## Cleanup and preservation

The temporary account `g2b_smoke_20260809` was disabled through the supported
account-management domain after browser qualification. Two sessions were
revoked, no membership/project/DM/Community mutation was made, and the
temporary password file was shredded. The profile row is retained as a
private, undiscoverable referential tombstone (`handle = null`); sessions are
zero.

Final canonical database SHA after WAL checkpoint:

`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`

Final integrity/FK checks were `ok` / no violations. Final counts are 11
users/accounts (including the disabled synthetic account), 26 sessions, 3
private profiles, 10 submissions, 2 owners, 5 memberships, 28 roster rows,
10 teams, 5 judges, 17 assignments, 14 scores, 1 Team Chat room, 6 Team Chat
messages, 0 DMs/blocks/reports, 4 Community channels with 0 messages/read
states/reports, 2 Viby links, and 1 publication release.

All pre-existing business-table hashes remained unchanged. The only expected
post-smoke business-adjacent rows are the synthetic user/account, private
profile, account-control tombstone, and bounded audit events. Publication
remains unpublished and real results were not touched.

Kentucky Vibes remains active at
<https://kentucky-vibes-f0b.ggg.ad> with its qualified synthetic fixtures.

## Rollback

For an application-only rollback, point `current` back to
`current.previous-g2b-20260809T205910Z` and restart only
`vibe-hackathon.service`. The G.2 change is projection/UI-only, so database
restore is reserved for integrity failure, unexpected business mutation, or
database corruption.

## Next phase

The next bounded participant friction is the submission boundary: readiness,
judge-visible preview, lock/deadline explanation, and the post-submit receipt.
This is recommended as **G.3 — Submission Readiness / Finalization
Experience**. Do not begin it automatically.
