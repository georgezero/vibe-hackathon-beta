# Phase H.2B — Production Deployment of Observability / Participant Feedback

**Disposition: GO — H.2 OBSERVABILITY / PARTICIPANT FEEDBACK DEPLOYED AND QUALIFIED**

**Next direction: HOLD — OBSERVE REAL PARTICIPANT USE BEFORE DEFINING H.3**

H.2 is an observation layer, not a product-authority layer. It records bounded,
event-scoped journey signals and optional participant feedback. It does not
decide readiness, deadlines, membership, communication access, judging,
publication, or identity.

## 1. Production baseline

Deployment host: `paui`
Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
Branch: `phase-vh-m6-viby-better-auth-session`
HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Qualified source fingerprint: `c8eebc29ef95e54729c383e538d18bbf80fd025201010aae5823b8ba2c4a4575`
Git status: dirty shared phase worktree; the H.2 files and prior participant phases are intentionally present. No unrelated cleanup was included in the release.

Before deployment the service was H.1 at
`/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`, PID `1295`,
started `2026-08-10 14:09:06 EDT`, restart count `0`. Local and public health
were HTTP 200. The canonical DB was `local.db`, SHA-256
`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`, with
`integrity_check=ok` and an empty foreign-key check.

The active event is `evt_vibe_2025` / `vibe-hackathon-2026` (`RSNA 2026`),
unfrozen, with submission and judging deadlines unset. The authoritative
publication release is `pr_evt_vibe_2025`, status `calculated`,
`published_at=NULL`; results remain unpublished. Chatto and Viby were not
modified.

Pre-deployment counts were: users 11, accounts 11, profiles 3, submissions 10
(5 draft and 5 finalized), owners 2, memberships 5 (2 active and 3 revoked),
team roster rows 28, invitations 3 (all revoked), Team Chat 1 room / 6
messages / 2 read states, DMs 0 conversations / 0 messages, Community 4
channels / 0 messages, judges 5, assignments 17, human scores 14, publication
rows 1, and Viby identity links 2. H.2 tables did not exist.

Rollback release: `/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`
(also retained at `current.previous-h2b-20260810T205800Z`).

## 2. Qualification gates

The full isolated repository suite passed **63 files / 332 tests** with
serialized execution (`--pool=threads --maxWorkers=1 --no-file-parallelism`).
The expected Viby child-process diagnostic about refusing conflicting/revoked
subject-link replacement is asserted by the Viby migration-policy test; the
test passes and no Viby behavior changed. The earlier shared-schema profile
collision was a test-fixture cleanup issue: H.2 now removes only the temporary
core tables/rows it creates after its tests. No assertions were weakened, and
H.2, profile, and Viby-adjacent tests are green.

The H.2 focused file passed 7/7. TypeScript, production build, changed-file
ESLint, `git diff --check`, the prior H.2 Impeccable detector check, and the
G.1–G.5/H.1 focused regressions passed. The Kentucky positive qualification
clone remained the source for authenticated journeys and synthetic dashboard
data.

## 3. Kentucky Vibes 530 disposition

The standing review hostname returned Cloudflare HTTP 530 / error 1033. Its
read-only diagnosis found `/home/george/.cloudflared/vibe-hackathon-f0b.yml`
configured for `https://127.0.0.1:3455` with no TLS verification, no process or
listener on port 3455, and no active Kentucky service. Historical cloudflared
logs show the old f0b connector terminating followed by tunnel/DNS timeout
errors. This is an unrelated standing demo origin/tunnel drift, not an H.2,
production, Chatto, or Viby failure. No standing Kentucky DB or service was
changed. The qualified H.2 snapshot remains at
`/opt/vibe-hackathon/instances/kentucky-vibes-h2-qualification-20260810T153500Z/data/h2-qualified.sqlite`.

## 4. Backup

A fresh verified backup was created before migration:

`/opt/vibe-hackathon/backups/h2b-production-pre-migration-20260810T203941Z.sqlite`

It is mode `0600`, size 1,380,352 bytes, backup SHA-256
`474ae6954813755c9054674106a7f8a878010e048d8c41ac740d04576e900fe9`, source
canonical SHA `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`,
and passed `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.

## 5. Migration review and disposable qualification

H.2 adds only `participant_journey_events` and `participant_feedback`, their
event/status/time indexes, bounded CHECK constraints, and restrictive event
and reviewer-user foreign keys. No authoritative table or index was altered.
The migration is local SQLite only, requires an explicit absolute regular
non-symlink target and exact confirmation, and is additive/idempotent.

A copy at
`/opt/vibe-hackathon/instances/h2b-canonical-migration-20260810T204100Z/data/canonical.sqlite`
was migrated twice. Both runs passed integrity/FK checks and left both H.2
tables at zero rows. Critical business-table counts and hashes matched the
pre-migration baseline. A separate copy at
`/opt/vibe-hackathon/instances/h2b-cleanup-qualification-20260810T204300Z/data/cleanup.sqlite`
was populated from the synthetic H.2 snapshot with old timestamps; cleanup
removed exactly 42 journey rows and 4 feedback rows and preserved integrity/FK.

## 6. Production migration

The canonical path was rechecked at the pre-migration SHA and migrated with the
guarded command, then migrated a second time. Both runs reported
`foreignKeyCheck=passed` and zero H.2 rows. A WAL checkpoint materialized the
additive schema; the post-migration canonical file SHA is
`9e9fbd1e1958ac1572e45544bb3c4a22922492f9fdea3c5970191a9e07a20ca1` before
the smoke. After the four intentional anonymous Start signals were
checkpointed, the final canonical file SHA is
`c625e70ce96a8d6e664c4fb3eed3fd7a89aa33db0ab3ce34832c9f96093de944`.

Immediately after migration, integrity was `ok`, FK check was empty, and all
pre-existing business counts/hashes matched. No synthetic journey, project,
invitation, message, agent update, or finalization was inserted.

## 7. Build, packaging, and alternate boot

The exact release is:

`/opt/vibe-hackathon/releases/h2-observability-20260810T205000Z`

It records HEAD, source fingerprint, build ID `xW_6RYbI75x-9zxZoLDDF0`,
`RELEASE_METADATA.json`, `RELEASE_MANIFEST.txt`, and
`SOURCE_TREE_SHA256`. The package contained 398 runtime dependency entries,
`node_modules/.bin/next`, Next server/build manifests, 87 static assets, and
the H.2 routes/scripts. `.env`, `.env.local`, canonical/Kentucky/test DBs,
credentials, and browser result artifacts were absent.

The candidate booted against the migrated disposable canonical copy on port
3079, reported `Ready in 163ms`, and returned `/api/health` HTTP 200/database
`ok`. The admin page compiled and unauthenticated access redirected; the
isolated admin API did not receive a session. The candidate was stopped before
the production switch.

## 8. Deployment

The immutable `current` symlink switched from H.1 to the H.2 release. Only the
actual host user unit `vibe-hackathon.service` was restarted through
`systemctl --user`; Chatto, Viby, Kentucky Vibes, and unrelated services were
not restarted.

- Old release: `/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`
- New release: `/opt/vibe-hackathon/releases/h2-observability-20260810T205000Z`
- Old PID: `1295`; old start: `2026-08-10 14:09:06 EDT`
- New PID: `118106`; new start: `2026-08-10 16:49:55 EDT`
- Service start/Ready: `2026-08-10 16:49:56 EDT`, `Ready in 169ms`
- Restart count: `0`
- Listener: `0.0.0.0:3000`
- Local/public health: HTTP 200, database `ok`

## 9. Production qualification boundary

Anonymous read-only `/`, `/start`, `/start/resume`, `/projects`, and `/login`
returned HTTP 200. The pages contained no actual token, digest, private roster,
judge, chat, DM, or Community payload. `/start` intentionally records a
null-participant `participant_start_viewed` signal; the post-smoke state was 4
such anonymous start rows and 0 feedback rows. No approved participant
credential was used, and no positive authenticated production journey was
manufactured.

Unauthenticated `/admin/participant-experience` returned a redirect (307) and
the admin API returned 401. Positive admin, participant, feedback, invitation,
agent, finalization, mobile, and dashboard journeys remain covered by the
isolated H.2 qualification evidence. Production feedback was not submitted.

## 10. Privacy and taxonomy sentinel

Production journey rows contain only the fixed H.2 columns and allowed null
anonymous fields. There are no digest-bearing rows in the bounded smoke. The
digest implementation remains SHA-256 of the event-scoped
`h2:participant:<eventId>:<userId>` value; raw IDs are not stored or projected.
The API derives the active event server-side, validates fixed enums, accepts no
arbitrary URL/content payload, and rate-limits telemetry. No project, message,
token, cookie, IP, full user-agent, Better Auth, Viby, judge, or score data was
found in journey rows. Feedback is a separate explicitly participant-submitted
admin-only table and remains empty in production.

## 11. Best-effort behavior, admin boundary, and retention

Journey writes catch failures and return without blocking the originating
participant action; feedback failure is a bounded retryable 503. Focused tests
cover invalid taxonomy, bounded payloads, rate limiting, event isolation,
feedback lifecycle, and retention cleanup. The admin surface and feedback state
mutations require explicit organizer authorization and are event-scoped; judges
and ordinary participants cannot inspect analytics or feedback.

Raw journey telemetry is retained for 90 days and feedback for 180 days. The
guarded cleanup command is manual/event-operations work; it was not scheduled
and was not run against production. It cannot delete authoritative audit,
submission, roster, membership, invitation, communication, judging, or
publication history.

Representative post-deploy anonymous timings were bounded smoke values: `/`
106 ms, `/projects` 120 ms, `/login` 95 ms, and the unauthenticated admin
redirect 111 ms. The alternate-port H.2 boot returned health in 163 ms. No
global analytics connection or unbounded participant query was added.

## 12. Business-data preservation

Post-deploy counts are unchanged for all authoritative domains: users 11,
accounts 11, profiles 3, submissions 10, owners 2, roster 28, memberships 5,
invitations 3, Team Chat 1/6/2, DMs 0/0, Community 4/0, judges 5, assignments
17, scores 14, publication 1, and Viby links 2. H.2 rows are the only additive
state: 4 anonymous Start events and 0 feedback rows. Integrity is `ok` and the
foreign-key check is empty. Results remain unpublished and the event remains
unfrozen with no deadlines configured.

## 13. Observation start and interpretation

**H.2 participant observation activated: `2026-08-10T20:49:56Z`**.

Signals before this timestamp do not exist for newly instrumented transitions.
Organizers must use Today/24h/7d/Event-to-date windows, read denominators and
event state, and compare friction with authoritative readiness/finalization
records and feedback. A low conversion is not causal evidence that a page is
bad; repeated guardrails and explicit feedback are investigation signals. Do
not identify, rank, shame, or automatically intervene on participants.

## 14. Rollback and recommendation

For an application-only regression, atomically restore
`current.previous-h2b-20260810T205800Z` (H.1), restart only
`vibe-hackathon.service`, and verify local/public health. Leave additive H.2
tables and any real observation rows in place. Restore the database only for
migration corruption, integrity/FK failure, unexpected authoritative mutation,
or data corruption.

H.2 is deployed and qualified. **HOLD — observe real participant use before
defining H.3.** The synthetic Kentucky fixture demonstrates instrumentation and
interpretation only; it is not evidence of participant behavior.
