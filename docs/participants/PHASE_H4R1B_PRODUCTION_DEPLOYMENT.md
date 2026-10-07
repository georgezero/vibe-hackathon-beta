# Phase H.4R.1B — Universal People Messaging Production Deployment

## Disposition

**GO — H.4R.1 UNIVERSAL PEOPLE MESSAGING DEPLOYED AND QUALIFIED**

**HOLD — CORE PARTICIPANT EXPERIENCE SUFFICIENTLY MATURE**

H.4R.1 was deployed as an application-only release. No production accounts,
DMs, messages, Community posts, memberships, projects, or feedback were
created for qualification.

## Production baseline

Baseline was captured on host `paui` at `2026-08-11T10:06:10Z`.

- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Previous release: `/opt/vibe-hackathon/releases/h4-communication-continuity-20260811T023047Z`
- Previous PID: `437949` (started `2026-08-10 22:37:57 EDT`)
- Restart count: `0`
- Canonical DB: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- DB size/mode: `1,429,504` bytes / `0600`
- Predeploy DB SHA-256: `22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`
- Integrity: `ok`
- Foreign keys: passed
- Event: `evt_vibe_2025` / `vibe-hackathon-2026`
- Event frozen: `false`
- Submission deadline: unset
- Judging deadline: unset
- D.4 publication: `pr_evt_vibe_2025`, `calculated`, `published_at = NULL`
- H.2 rows: 5 journey events, 0 feedback rows
- Production and public health: HTTP 200

Authoritative baseline counts included 11 users/accounts, 3 profiles, 10
submissions, 2 owners, 5 memberships, 0 DM conversations/messages, four
Community channels with 0 messages, 3 judge authorizations, 17 assignments,
14 human scores, 5 AI reviews, one publication release/award, and two Viby
links.

## Backup

Fresh online backup:

`/opt/vibe-hackathon/backups/h4r1b-production-predeploy-20260811T095754Z.sqlite`

- Source SHA-256: `22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`
- Backup SHA-256: `57895ccaac0f0c0f079a2513ec44229ec5cc0c57a8b16b02c98db9de1dcde359`
- Size: `1,429,504` bytes
- Mode: `0600`
- Backup integrity: `ok`
- Backup foreign-key check: passed

The online backup has a different SQLite page-layout SHA, so preservation was
verified with row-level deterministic comparison against the backup as well as
the canonical file SHA.

## Migration determination

H.4R.1 required **no schema migration**. The qualified schema and migration
script matched the deployed H.4 release. No table, index, or migration change
was run against production.

## Qualified source and package

The exact qualified working tree was packaged as:

`/opt/vibe-hackathon/releases/h4r1-universal-people-messaging-20260811T100205Z`

- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Source-tree fingerprint: `46bfecd10acd453f078c4fcaa336581e8a45c23665b730022795fe54c5a8ef43`
- Build ID: `kEIucpc04EiAneYr93oiB`
- `migrationRequired = false`
- Runtime dependencies, Next executable, build output, static assets, and
  server entrypoint verified
- `.env`, `.env.local`, databases/WAL files, browser state, and credentials
  excluded

The candidate was booted on alternate port 3088 using a disposable copy of the
verified backup. `/api/health` returned HTTP 200/database ok and signed-out
routes `/`, `/projects`, `/winners`, `/start`, `/start/resume`, `/login`,
`/people`, `/community`, and `/messages` all rendered or redirected normally.
The candidate was stopped after qualification.

## Regression gate

The qualified source passed:

- Full suite: 348 tests across 66 files
- H.4R.1 focused and adjacent H.4R/H.4/People/Profile/DM/Community tests
- H.1 navigation, H.2 observability, H.3 empty-state, G.1–G.5, Team Chat,
  Better Auth, Viby, judging/publication regressions
- TypeScript
- Production build
- Changed-file ESLint
- Impeccable detector
- `git diff --check`

The full-suite stderr contained only asserted Viby guard-rail conditions; no
test failure was accepted or weakened.

## Deployment

Rollback pointer created:

`/opt/vibe-hackathon/releases/rollback-h4r1b-20260811T100610Z`

The `current` symlink was atomically switched from H.4 to the immutable H.4R.1
release. Only the user-scoped `vibe-hackathon.service` was restarted.

- New PID: `913466`
- Process start: `2026-08-11 06:06:34 EDT`
- Restart count: `0`
- Listener: `0.0.0.0:3000`
- Service working directory: exact H.4R.1 release
- Local health: HTTP 200, database ok
- Public health: HTTP 200, database ok

Chatto, Viby, Kentucky Vibes, and unrelated services were not restarted.

## Production smoke

Read-only public checks returned HTTP 200 for `/`, `/projects`, `/login`,
`/winners`, `/status`, `/ai-evals`, `/people`, `/messages`, `/community`, and
`/api/health`. The direct participant Results surface said **“Results aren’t
published yet.”** and did not expose D.4 internal state, scores, rankings, or
judge notes.

At 390×844, `/`, `/projects`, `/winners`, `/status`, and `/ai-evals` had no
horizontal overflow (`scrollWidth === innerWidth`).

No production authenticated positive mutation smoke was performed. The exact
candidate’s isolated H.4R.1 evidence remains the positive proof for:

- every discoverable non-self People card and profile having Message;
- `allowIncoming = none` not blocking initiation;
- a signed-out/offline recipient receiving a durable message after later login;
- conversation reuse/concurrent idempotency;
- zero-project Community access;
- private project and Team Chat denial.

## H.4R.1 policy verification

Deployed source confirms:

- People renders Message for every non-self discoverable card.
- Profile renders Message for every discoverable other person.
- New DM initiation does not consult event/project membership, `allowIncoming`,
  session existence, presence, or online state.
- Self, disabled/deactivated, and block protections remain authoritative.
- Existing one-to-one conversations use the canonical idempotent path.
- Legacy `allowIncoming` storage/API compatibility remains, but its participant
  setting was removed and it is not an initiation gate.
- Authenticated active accounts can access event-scoped Community without
  project ownership or membership.
- Private project workspace and Team Chat remain project-authorized.

The recipient does not need a login session. Only the sender must be
authenticated when initiating/sending; durable unread delivery remains the
authority.

## Privacy

Public/denied responses were checked for tokens, Better Auth/Viby identifiers,
private emails, private roster fields, DM/Community bodies, judge notes/scores,
and unpublished awards. No forbidden production data was exposed. Landing-page
edit-token strings are documentation placeholders (`edit_xxxxxxxxxxxxxxxx`),
not live credentials.

## Business-data preservation

Post-deployment canonical DB SHA remained:

`22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`

Post-deployment integrity was `ok`; foreign-key check passed. H.2 remained at 5
journey events and 0 feedback rows. A row-by-row comparison against the fresh
verified backup reported zero differences across users/accounts, profiles,
submissions, owners, memberships, DMs, blocks/reports, Community, judging,
publication, Viby links, and H.2 tables. Counts remained unchanged, including
0 production DM conversations/messages and 0 Community messages.

## Kentucky Vibes

Standing Kentucky Vibes remained unchanged:

- PID `444998`
- listener `127.0.0.1:3050`
- public health HTTP 200
- no DB, service, or release mutation

No synthetic H.4R.1 activity was copied into Kentucky or production.

## Rollback

H.4R.1 is application-only. If a presentation, messaging, Community,
authorization, startup, or packaging regression appears, atomically restore the
rollback pointer and restart only `vibe-hackathon.service`. Do not restore the
DB merely to undo application behavior. A DB restore is reserved for corruption,
failed integrity/FK checks, or unexplained authoritative business mutation.

## Final recommendation

H.4R.1 is deployed and qualified. Do not begin H.5 automatically; hold the core
participant experience while observing real use.
