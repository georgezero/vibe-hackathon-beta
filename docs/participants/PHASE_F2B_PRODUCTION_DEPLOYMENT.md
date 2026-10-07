# Phase F.2B — Production Deployment of Participant Profiles, Discovery, and Messaging

## Disposition

The qualified F.0–F.2 participant foundation was deployed to the Vibe
Hackathon production service on 2026-08-09. The deployment was additive and
started production with an empty profile, discovery, and direct-message data
set.

The Kentucky Vibes review environment remains isolated and active at
`https://kentucky-vibes-f0b.ggg.ad`.

## Release and baseline

- Starting repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`.
- The repository was a qualified F.0–F.2 working-tree overlay; the release
  was built from that exact qualified state.
- Starting production release:
  `a70edc28326108dfc84a69af303f680ceaa7f735-e3b-assignment-routing-20260808T200508Z`.
- Rollback release: the same E3B release.
- Starting canonical database SHA-256:
  `939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`.
- Active event: `evt_vibe_2025` (`RSNA 2026`).
- D.4 `publication_releases` remained `calculated` with `published_at = null`.
  The legacy D.2 compatibility row remains `published` by design and is not
  the authoritative D.4 publication source; no result winners were published.

## Backup and disposable migration

A fresh SQLite online backup was created before any production migration:

- Path: `/opt/vibe-hackathon/backups/production-pre-f2b-20260809T042612Z.sqlite`.
- Mode: `0600`.
- Size: `1,114,112` bytes.
- SHA-256: `d586f11ae7d70177fc0102cffa9937b40ad88871ef9f3ca3e5bed56d69200a64`.
- Restored-copy integrity: `ok`.
- Restored-copy foreign-key check: passed.

The canonical database was cloned to a disposable file and both migrations
were run twice. The first run and rerun passed with no automatic rows. The
pre-existing business-table counts and stable row hashes matched exactly
between the source and disposable clone.

## Migration set and production result

The exact additive sequence was:

1. `scripts/migrate-user-profiles.ts` (run twice).
2. `scripts/migrate-direct-messaging.ts` (run twice).

Both commands used their explicit absolute database path and typed migration
confirmation. The resulting schema contains `user_profiles` (including the
`discoverable` preference), direct conversations/members/messages/read state,
message events, participant blocks, reports, and messaging preferences.

Production post-migration state:

| Table/domain | Rows |
| --- | ---: |
| user profiles | 0 |
| public profiles | 0 |
| discoverable profiles | 0 |
| handles | 0 |
| direct conversations | 0 |
| direct messages | 0 |
| blocks | 0 |
| reports | 0 |
| messaging preferences | 0 |

`PRAGMA integrity_check` returned `ok` and `PRAGMA foreign_key_check` returned
no rows. All 22 pre-existing business-table hashes (users, accounts, Viby
links, submissions, owners, memberships, roster, judges, authorizations,
assignments, scores, Team Chat, publication, and event records) remained
unchanged. The post-migration canonical SHA is
`0d4b9c492b27a4ae9cc5f9f2585efb4fe39bf8031d5174b1a26e8890f149120f`; the
change is the expected additive schema/WAL checkpoint effect.

## Application deployment

The immutable release is:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-f2b-participant-foundation-20260809T043133Z`

The `current` symlink was switched atomically from E3B and only
`vibe-hackathon.service` was started. Post-deployment:

- PID: `3817485`.
- Start time: `2026-08-09 00:32:42 EDT`.
- Restart count: `0`.
- Local health: HTTP 200.
- Public health: HTTP 200.
- Active event: `evt_vibe_2025`.
- Release rollback target remains the E3B release above.

TypeScript, production build, the 53-file unit suite (279 tests), changed-file
ESLint, and `git diff --check` passed. Whole-repository ESLint still reports
the previously documented unrelated React-purity baseline errors; no F.0–F.2
changed-file errors were introduced.

## Production safety checks

- `GET /people/random-synthetic-handle` returns a generic, private-cache 404;
  `HEAD` also returns 404.
- Anonymous `/people` and `/messages` redirect to login.
- Unauthenticated profile, messaging-preference, and direct-message APIs
  return 401.
- No production profile, handle, discoverability, conversation, message,
  block, or report was created.
- No password, session, token, badge, Viby assertion, private-note material,
  or direct-message body was emitted by the deployment checks.
- D.4 publication state, judging, submissions, native Team Chat, and Viby
  links remain unchanged.

The follow-on F.2C smoke used one approved synthetic production account and is
documented in `PHASE_F2C_PRODUCTION_AUTHENTICATED_SMOKE.md`. It was disabled
through the supported account-management domain after logout and session
revocation; its private profile remains only as a referentially safe synthetic
tombstone.

## Kentucky Vibes demo

The named Kentucky Vibes service and tunnel were not restarted or torn down.
`https://kentucky-vibes-f0b.ggg.ad` remains healthy on its isolated database,
event `evt_kentucky_vibes`, with populated synthetic profiles, People results,
projects, direct-message conversations, unread state, block/report fixtures,
and protected credentials. Production and Kentucky cookies, origins, services,
and databases are separate.

## Rollback

For an application-only rollback, atomically point `current` back to the E3B
release and restart only `vibe-hackathon.service`; the additive tables can
remain in place because the older release does not depend on them. Restore the
verified database backup only for integrity failure or unexplained business
data mutation. Do not delete participant-created profile or message data as a
routine rollback action.

## Next step

Do not start F.3 channels automatically. Observe participant profile,
discovery, and messaging use first.
