# Phase E.0 pre-activation report

## Baseline

Host `paui`; repository `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`;
branch `phase-vh-m6-viby-better-auth-session`; HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735`. Production release is
`/opt/vibe-hackathon/releases/a70edc283261-d4r-publication-20260803T005500Z`;
PID 2987399; start `2026-08-02 20:54:58 EDT`; restart count 0; local/public
health HTTP 200. Canonical path, checksum, WAL mode, counts, and event identity
are recorded in `CURRENT_EVENT_SNAPSHOT.md`.

Participant/public/admin event context comes from the database's single active
`events.is_active` row. Judge APIs use the active row selected by
`VIBE_JUDGE_EVENT_ID` (currently `evt_vibe_2025`); no route-level event context
exists.

## Snapshot and restore qualification

The current database was backed up with the online SQLite backup API to
`current-event-vibe-hackathon-2026-20260803T013302Z-939852c5309e.sqlite`, SHA
`175d642962b10edb4d6f0ca3602b35a9b4fbeaa90f39dabff014a13a5fd4d7c0`.
Integrity and foreign keys passed. A temporary restore target passed exact
confirmation, automatic pre-restore backup, atomic replacement, and health
check; it was not the canonical path. The production service stayed healthy.
Selected row-set hashes (canonical and snapshot) matched for events
`26f90b087e2a69615ecb4b284504b6e6fe7ce09d79f1208bd0199290c75bbd48`,
submissions `afe661e2d1071b922207f2f47d08b6e8e60086e38e7d04834a0d690d9adc45d9`,
assignments `7e3a337ab0a31238737604d391488b4d27375f49b2c8c47cf2beef849d00aaf8`,
and human scores `5bdc837ae80954dcf6f1e0dbffe9f0f5fe9665c221ebd6b8586b05222df3cf02`.

## Kentucky Vibes artifacts

The realistic base is
`kentucky-vibes-base-realistic-20260802-20260803T022500Z.sqlite` (SHA
`097a3f47d5d5ac946472741cf622b9a237b891d31ac23491806e142ac2179122`). It has
75 synthetic submissions, 150 users, 30 judges, 265 assignments, 250 completed
evaluations, 45 private chat rooms, 225 messages, and 45 read-state rows, with
integrity/FK checks passed. Healthy, operations
stress, calibration challenge, and publication rehearsal artifacts were cloned
without mutating the base. Same-seed small fixtures produced equal IDs,
submission rows, and lifecycle distributions; a different seed changed seeded
token material. No real domains, Viby links, or published results were added.

## Application qualification

A writable clone of the healthy artifact booted on port 3332 with
`VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes`. `/api/health`, `/`, `/projects`, and
`/api/v1/status/live` returned HTTP 200. The process was stopped after the
check. No production database switch was performed.

## Tests

- unit/isolation suite: **252 passed across 47 files**;
- TypeScript: passed;
- changed event-tool ESLint: passed with no errors;
- production build: passed;
- `git diff --check`: passed;
- snapshot/restore, integrity, foreign-key, checksum, deterministic-seed,
  scenario, and isolated boot checks: passed;
- WebKit/browser load qualification: not run; no activation occurred.

## Rollback and risks

The exact restore command and automatic pre-restore rollback are documented in
`DATABASE_SWITCHING_AND_RESTORE.md`. A second service/port is safer for future
load testing than replacing the live database. Full authenticated scale and
query-plan measurements remain outstanding.

Chatto was unchanged. Viby was unchanged. Real results remain unpublished.

CONDITIONAL — explicit operator approval is still required before activating or swapping to a Kentucky Vibes database; the current production database was not replaced.
