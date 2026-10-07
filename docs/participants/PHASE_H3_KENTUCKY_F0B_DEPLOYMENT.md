# H.3 Kentucky Vibes F0B Deployment

Date: 2026-08-10 (UTC)

## Disposition

GO — the H.3 pre-event activation / empty-state release is running on the
standing Kentucky Vibes hostname:

https://kentucky-vibes-f0b.ggg.ad

This deployment used the existing seeded Kentucky Vibes test database. It did
not touch `vibe-hackathon-dev.ggg.ad`, Chatto, or Viby.

## Release and services

- Release: `/opt/vibe-hackathon/releases/h3-pre-event-activation-kentucky-20260810T233915Z`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Source-tree fingerprint: `25071fc862c05c4070507becc718222d3482e430f428fe0051c2063ce817b4d0`
- Build ID: `z5Ve6DwPw09B_WnvwOIcF`
- App PID: `237488`
- HTTPS proxy PID: `237489`
- Cloudflare tunnel PID: `237491`
- All three Kentucky services are active; restart count is zero for this
  deployment.

The app is an immutable H.3 release. The local TLS proxy and the dedicated
`vibe-hackathon-f0b` Cloudflare tunnel serve the public hostname.

## Seeded data and database safety

Target database:

`/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`

The existing Kentucky fixture contains 85 submissions, 85 teams, 289 team
members, 199 invitations, 161 profiles, 5 Community channels, 93 Community
messages, 27 DM conversations, 50 Team Chat rooms, 231 Team Chat messages, 35
judges, 287 assignments, and published Kentucky results.

H.2's additive participant-experience tables were absent from this older
fixture, so the already-qualified idempotent H.2 migration was applied twice.
Both runs succeeded. No synthetic H.2 events or feedback were seeded. Read-only
smoke generated three bounded anonymous Start guardrail signals; feedback
remains at zero.

Pre-deployment backup:

- `/opt/vibe-hackathon/backups/kentucky-vibes-f0b-pre-h3-20260810T233529Z.sqlite`
- mode `0600`
- SHA-256 `b11cafa3ece309848d637d872b183b4cb7c3fa87e0162d6a7e9898caf186dc58`

Final database SHA-256 is
`c386afd7f3c1dc6e240793eb82bfc79ee08a31a207382db6d3d85d1999fa4e41`.
Integrity and foreign-key checks pass. Hashes and counts for all critical
business tables (users/accounts/profiles, submissions, teams/roster,
invitations, Team Chat, DMs, Community, judges/assignments/scores,
publication, and Viby links) match the pre-migration backup. Only the additive
H.2 tables and the three read-only smoke signals changed.

## Seeded event state

The fixture is not an open pre-event snapshot: its authoritative Kentucky D.4
publication is published, and its configured submission and judging deadlines
have passed. Consequently the deployed site correctly presents closed
submissions and published Kentucky results. This is expected seeded-fixture
state, not a production event-state change.

## Qualification

- Local `/api/health`: HTTP 200, database ok.
- Public `/api/health`: HTTP 200, database ok.
- Public `/`, `/start`, `/start/resume`, `/projects`, `/login`, `/winners`,
  `/status`, `/ai-evals`, and `/api/v1/status/live`: HTTP 200.
- Unauthenticated `/admin/participant-experience`: authorization redirect
  (HTTP 307).
- Mobile Chromium checks at 390×844 passed for `/`, `/projects`, `/winners`,
  `/status`, and `/ai-evals`; no horizontal overflow was observed.
- H.3/H.1 focused regression tests passed after the seeded-data compatibility
  fix (15 tests), with TypeScript, production build, changed-file ESLint, and
  `git diff --check` passing. The qualified H.3 baseline remains 339 tests
  across 64 files.

During the first seeded-data smoke, `/status` exposed a compatibility defect:
the published D.4 release had `published_at` but no legacy
`events.winners_published_at`, and activity sorting attempted to call
`getTime()` on the missing legacy value. The release includes the smallest
fix: status activity uses D.4 `published_at` first and falls back to the legacy
timestamp only when needed. The focused regression covers this case.

## Production boundary

The production host `vibe-hackathon-dev.ggg.ad` remains on its existing H.3B
release and database. No production project, participant, invitation, message,
feedback, deadline, publication, Chatto service, or Viby service was changed.
