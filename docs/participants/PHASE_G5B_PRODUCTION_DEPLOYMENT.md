# Phase G.5B — Production Deployment: Project Editing / Submission Form UX

## Disposition

**GO — G.5 PROJECT EDITING UX DEPLOYED AND QUALIFIED**

G.5 was deployed as an application-only release. The production service is
healthy, the read-only production smoke is clean, and the canonical database
is byte-for-byte unchanged. No project, roster, agent, submission, or
finalization mutation was used for qualification.

## Production baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Current service: `vibe-hackathon.service`
- Previous release: `/opt/vibe-hackathon/releases/g4b-team-formation-20260810T014826Z`
- Previous PID/start/restarts: `2898274` / `2026-08-09 21:54:25 EDT` / `0`
- Local and public health: HTTP 200, database `ok`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Baseline database SHA-256: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Integrity: `ok`
- Foreign-key check: `[]`
- Active event: `evt_vibe_2025` / `vibe-hackathon-2026` (Vibe Hackathon 2026)
- Freeze: off (`is_frozen=0`)
- Submission deadline: not configured (`NULL`)
- Judging deadline: not configured (`NULL`)
- Publication: release `pr_evt_vibe_2025`, `calculated`, `published_at=NULL`; results remain unpublished.

Baseline business counts were 10 submissions (5 draft, 5 finalized), 28
roster rows, 2 owners, 5 memberships (2 active, 3 revoked), 1 Team Chat room,
6 Team Chat messages, 2 read states, 11 users, 11 accounts, 5 judges, 17
assignments, 5 AI reviews, 4 Community channels, 0 Community messages, 1
publication row, and 2 Viby identity links. There is no standalone `profiles`,
DM conversation, or score table in this canonical schema; profile/account and
DM state are represented by the existing tables/routes.

## Backup and migration decision

Fresh verified backup:

- Path: `/opt/vibe-hackathon/backups/g5b-production-predeploy-20260810T035500Z.sqlite`
- UTC timestamp: `2026-08-10T03:55:00Z` (timestamped backup name)
- Size: `1,380,352` bytes
- Mode: `0600`
- SHA-256: `498bfd83fde92c39548b1808bf67a93729900fac1cb9f4be16c430d74d204689`
- Source database SHA: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Source release: G.4B release above
- Source HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Backup integrity: `ok`
- Backup foreign-key check: `[]`

**G.5 requires no canonical schema migration.** The `lib/db/schema.ts` file is
identical between G.4B and G.5, and there is no Drizzle schema or migration
delta. Existing dirty schema/migration files in the shared worktree belong to
earlier phases and were not changed by G.5.

## Packaging and release

The exact qualified source tree was packaged at:

`/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`

- Source-tree fingerprint: `382066543663bec47af2077addbfd50d592ee5c5912b4321c94aa91919b55cda`
- Build ID: `9W3icbIj4Yv__36P3sKQm`
- Metadata: `RELEASE_METADATA.json`, `RELEASE_MANIFEST.txt`, and `SOURCE_TREE_SHA256`
- Runtime dependency entries: 401
- Next executable: present at `node_modules/.bin/next`
- Production build/server manifest: present
- Static assets: 84 files
- `.env.local`, `.env`, canonical databases, clone databases, and test-result
  databases: excluded
- Candidate alternate-port boot: passed on `127.0.0.1:3076` against a copy of
  the verified backup; `/api/health` returned database `ok`.

Build and regression evidence:

- G.5 focused suite: 7 passed
- Full unit suite: 318 tests across 61 files passed. The repository's default
  5-second timeout is too short for five existing migration/provisioning tests
  on this host; the same suite passed with the repository-supported
  `--testTimeout=30000` allowance. No G.5 test failed.
- TypeScript: passed
- Production build: passed
- Changed-file ESLint: 0 errors, 2 existing `next/image` advisory warnings
- `git diff --check`: passed

## Deployment

The `current` symlink was atomically switched only after packaging and boot
checks, then only `vibe-hackathon.service` was restarted. Chatto, Viby,
Kentucky Vibes, and unrelated services were not restarted.

- Old release: `/opt/vibe-hackathon/releases/g4b-team-formation-20260810T014826Z`
- New release: `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`
- Old PID: `2898274`
- New PID: `3250791`
- New process start: `2026-08-10 00:08:56 EDT`
- Restart count: `0`
- Listener: `0.0.0.0:3000`
- Local health: HTTP 200 / database `ok`
- Public health: HTTP 200 / database `ok`

The user journal had no persisted entries for this unit, so no separate
`Ready` line was available; the running `next-server` command, release cwd,
listener, and both health checks provide the readiness evidence.

## Production qualification

Anonymous, read-only routes returned successfully: `/`, `/start`,
`/start/resume`, `/projects`, `/login`, and a finalized public project page.
The invalid private editor token returned no private fields; the invalid API
target did not expose submission data. No real edit token or project credential
was used.

Private editor positive states were not fabricated in production. They were
verified through the exact deployed source/bundle plus the isolated G.5
qualification evidence. The deployed code retains:

- the existing edit-token authorization boundary;
- the exact G.5 project-story sections and required/optional metadata;
- partial draft saves with server-authoritative readiness;
- `editVersion` on private GET and `expectedEditVersion` on browser PATCH;
- `409 STALE_PROJECT_EDIT` without overwriting hosted state;
- preserved stale browser values and an explicit reload/review message;
- agent PATCH compatibility without making a browser snapshot mandatory;
- deadline/freeze/lock server guards;
- G.3 Preview/readiness/finalization and G.2 My Projects integration;
- concise G.4 Team summary and a separate Manage team boundary.

The isolated G.5 clone already qualified manual editing, agent/browser
interoperation, stale-write rejection, invalid URL validation, Preview deep
links, submitted/resubmittable and hard-lock states, desktop/mobile layouts,
and no-overflow behavior. Its preserved evidence is
`/opt/vibe-hackathon/instances/kentucky-vibes-g5-qualification-20260810T030700Z/data/g5-qualified.sqlite`.

## Security and privacy

The deployed source and anonymous denial responses contain no edit token,
recovery URL, Better Auth/Viby identifier, judge ID, score, private note,
Team Chat, DM, or Community payload. The stale fingerprint is computed from
authoritative editable state and ordered roster state and explicitly excludes
the bearer edit credential. Agent prompts still require a hosted update,
complete roster semantics, return to Preview, and explicit human finalization;
agents do not finalize ordinary work.

G.1–G.4 authorization, team/access separation, private roster protection,
deadline guards, Team Chat authorization/revocation, judging boundaries, and
publication gating were covered by the 318-test suite and prior isolated
qualification. Results remain unpublished.

## Business-data preservation

After deployment the canonical database remained exactly:

`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`

Integrity remained `ok`, the foreign-key check remained empty, and the file
mtime/size were unchanged. Critical table counts and SHA-256 row hashes for
submissions, roster, owners, memberships, Chat rooms/messages/read states,
users/accounts, judges/assignments, AI reviews, Community, publication, and
Viby links matched the baseline. No project, team, invitation, membership,
agent, finalization, judging, or publication row was created or changed.

## Rollback

For a presentation or editor regression, atomically point `current` back to
`/opt/vibe-hackathon/releases/g4b-team-formation-20260810T014826Z`, restart only
`vibe-hackathon.service`, and verify local/public health. A database restore is
not required for an application-only rollback; it is reserved for integrity
failure, corruption, or an unexpected business-data mutation.

Standing Kentucky Vibes remains active at
`https://kentucky-vibes-f0b.ggg.ad` and was not replaced or modified. Chatto
and Viby remain unchanged.

## Next direction

**Recommend H.0 — End-to-End Participant Experience Audit.** The core project
lifecycle (onboarding, participant home, readiness/finalization, team
formation, and editing) is now deployed. Re-evaluate the complete journey in
production before adding another major participant feature.
