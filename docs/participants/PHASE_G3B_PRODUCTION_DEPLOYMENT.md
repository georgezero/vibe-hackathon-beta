# Phase G.3B — Production Deployment of Submission Readiness / Finalization

Status: **GO — G.3 SUBMISSION EXPERIENCE DEPLOYED AND QUALIFIED**
Production: <https://vibe-hackathon-dev.ggg.ad>
Kentucky Vibes review: <https://kentucky-vibes-f0b.ggg.ad>

G.3 was deployed as an application-only release. No production project was
created or finalized. Chatto, Viby, judging data, Team Chat, DMs, Community,
and publication state were not changed.

## 1. Production baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Starting release: `/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-g2-participant-home-20260809T205910Z`
- Starting PID/start/restarts: `2145227` / `2026-08-09 17:04:19 EDT` / `0`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Starting database SHA-256: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Integrity/FK: `ok` / no violations
- Active event: `evt_vibe_2025`, slug `vibe-hackathon-2026`, display name `RSNA 2026`
- Event freeze: `false`
- Submission/judging deadlines: unset (the authoritative windows are open)
- Authoritative publication: one `calculated` release, `published_at = null`;
  `result_winners = 0`. The legacy event timestamp is not used as a
  participant publication signal.

Baseline business counts were 10 submissions (5 `draft`, 5 `finalized`), 10
teams, 2 owners, 5 active/revoked membership rows, 28 roster rows, 5 judges,
3 authorizations, 17 assignments, 14 human scores, one Team Chat room with six
messages and two read states, zero DMs, four Community channels with zero
messages/read states/reports, one publication release, and two Viby links.
There were 11 users/accounts (including the retained disabled qualification
tombstone), three private profiles, and zero public/discoverable profiles.

The worktree includes the previously qualified phase overlays. Because those
overlays were intentionally not rewritten into a new Git commit, the release
records both the repository HEAD above and this deterministic qualified source
tree fingerprint:

`72cb6a6a97173675160819d6cbcd9c5f101691051186a01f054d0a73dab4c139`

## 2. Backup and migration determination

Fresh verified backup:

`/opt/vibe-hackathon/backups/production-pre-g3b-20260809T235159Z.sqlite`

- UTC: `2026-08-09T23:51:59Z`
- Size: `1,380,352` bytes; mode `0600`
- Backup SHA-256: `498bfd83fde92c39548b1808bf67a93729900fac1cb9f4be16c430d74d204689`
- Canonical source SHA: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- `PRAGMA integrity_check`: `ok`
- `PRAGMA foreign_key_check`: passed

**G.3 requires no canonical schema migration.** The release comparison found
no change in `drizzle/`, `scripts/migrate-*`, or the schema relative to the
G.2 release. Existing readiness, status, roster, audit, judging, and
publication columns already support this phase.

## 3. Build and immutable release

The exact qualified tree passed:

- focused G.3 readiness/finalization tests;
- full suite: **307 tests across 59 files passed**;
- TypeScript;
- production build;
- changed-file ESLint (one existing Preview `<img>` warning, no errors);
- `git diff --check`.

The immutable release is:

`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-g3-submission-readiness-20260809T235610Z`

It contains no `.env.local` or bundled canonical database. Build ID is
`_tgSUjamHiBTC9fpto-Md`; runtime `DB_FILE_NAME` remains the canonical path in
the shared service environment.

## 4. Deployment

The `current` symlink was atomically switched from G.2 to the release above.
Only `vibe-hackathon.service` was restarted; Chatto, Viby, Kentucky Vibes, and
unrelated services were not restarted.

- New PID: `2588190`
- Process start: `2026-08-09 19:56:28 EDT`
- Restart counter: `0`
- Active state: `active`
- Local/public health: HTTP 200
- Rollback pointer: `/opt/vibe-hackathon/current.previous-g3b-20260809T235627Z`

## 5. Production regression checks

Read-only anonymous checks passed for `/`, `/start`, `/start/resume`,
`/projects`, `/login`, and a public project page. `/start` showed the G.1
project-first form (`Start your project`, `Team lead`, `Create project`);
`/start/resume` showed safe Project ID/Edit token recovery guidance. No real
project or token was used. `/account/projects` rendered the signed-out
`Sign in to view My Projects` state and contained no project data, edit
credential, judge field, or private result.

Deployed-code and focused-test checks confirmed:

- the License field remains authoritative and no new required fields were
  invented;
- finalization performs server-side readiness validation and returns safe
  `READINESS_INCOMPLETE` labels;
- `Idempotency-Key` retry/concurrency handling preserves one finalization
  audit and receipt timestamp;
- deadline checks use exact server time and remain separate from event freeze;
- participant consequence copy distinguishes resubmittable `submitted` work
  from hard-locked work;
- draft submissions are denied from judge-visible work;
- Preview and judge projection share the same safe project/team fields while
  keeping readiness and evaluation data role-specific;
- the agent prompt still requires hosted updates, complete-roster semantics,
  and an explicit human instruction before finalization;
- Team lead/Teammates, invitations, Team Chat, DMs, Community, and publication
  policies remain unchanged.

The isolated G.3 clone remains the evidence for positive readiness, successful
submission, receipt, double-submit, deadline-race, mobile, and judge-boundary
journeys. No production submission was made to reproduce those mutations.

The deployed mobile components retain the qualified checklist, confirmation,
receipt, and submitted-workspace hierarchy at approximately 390px with no
horizontal overflow. Keyboard/focus semantics, textual checklist states,
pending-submit feedback, and confirmation focus were covered by the G.3
accessibility suite and mobile browser qualification.

An unauthenticated judge-data request returned `401`, an anonymous judge
workspace request redirected to login, and an unauthenticated finalization
request returned `401`. No production target was mutated by these checks.

## 6. Privacy and preservation

Anonymous payload scans found no private readiness, edit-token, judge, score,
note, Team Chat, DM, Community, Better Auth, or Viby data. The public landing
page's agent example contains only placeholder credentials. No secret was
written to the release or retained in screenshots.

After deployment, the canonical database remained byte-for-byte unchanged:

`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`

Critical table hashes/counts for submissions, owners, memberships, roster,
teams, judges, assignments, scores, Team Chat, DMs, Community, publication,
and Viby links all matched the backup. Integrity remained `ok` and the FK check
returned no rows. No synthetic production project, finalization, invitation,
or result publication was performed.

## 7. Kentucky Vibes and rollback

The standing Kentucky Vibes environment remains active and unchanged at
<https://kentucky-vibes-f0b.ggg.ad>. The stopped G.3 qualification clone and
its evidence snapshot remain separate from production.

For an application-only rollback, atomically point `current` to
`current.previous-g3b-20260809T235627Z`, restart only `vibe-hackathon.service`,
and verify local/public health. Database restore is reserved for integrity
failure, unexpected business mutation, or corruption; it is not required for a
UI/projection rollback.

## 8. Next participant phase

The strongest remaining bounded friction is pending teammate invitations and
the participant-facing team lifecycle around finalization. Recommend:

**G.4 — Team Formation / Invitations Experience**

Do not begin it automatically.

**GO — G.3 SUBMISSION EXPERIENCE DEPLOYED AND QUALIFIED**
