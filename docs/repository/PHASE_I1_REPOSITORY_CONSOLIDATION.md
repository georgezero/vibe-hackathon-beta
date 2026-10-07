# I.1 Repository Consolidation / Mainline Qualification

Date: 2026-08-18 (UTC)

Disposition: **GO — CANONICAL SOURCE CONSOLIDATED AND LOCAL MAIN QUALIFIED**

This record covers the read-only I.0 findings, the approved consolidation of
the cumulative qualified product, and clean-worktree qualification. Production
was not changed.

## Starting topology and safety snapshot

- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Repository type: normal non-bare Git repository (`.git` directory), not a
  shallow clone.
- Starting branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Starting local and `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- Starting relationship: current branch was 82 commits ahead of `main`; `main`
  had no independent commits. The merge-base was `main`.
- `main` was not checked out in another worktree.
- Existing worktrees were preserved, including the direct-Viby worktree and the
  detached historical release worktree.

Before editing, an external source-only recovery snapshot was created at
`/opt/vibe-hackathon/repository-snapshots/i1-source-20260817T235411Z/`:

- archive: `source-state.tar.gz` (mode 0600)
- archive SHA-256: `5ccda51f71aa8f10bb9cfdadb37f474f254bee680b290623eb2bd01ccf6fc40c`
- source files: 1,059
- snapshot tree manifest fingerprint:
  `38df95e9a2115ac7ddd21a4c8564f308fb611b7606e93f3f63d6b876fe92ec61`
- databases, dependencies, build output, environment files, credentials and
  tool state were excluded.

## H.5B reference and production boundary

The production-qualified reference remained:

`/opt/vibe-hackathon/releases/h5-documentation-help-20260817T225617Z`

Its recorded source fingerprint is
`5399b036e417c5c6fdcd7ac66173377fcdc79756af0ca4373502563758fb787a`, with
repository HEAD `a70edc28326108dfc84a69af303f680ceaa7f735` and no schema
migration. The committed candidate fingerprint, using the same style of
sorted SHA-256/path source manifest while excluding environment files and
screenshots, is:

`4e58c01947d9aebffce8c022704e0ba2a63c9491825bca289165057c9106e76b`

The path-level comparison found no unexplained application divergence. The
intentional differences are the repository migration/bootstrap repair,
package alias correction, schema-check provenance hardening, `.gitignore`,
durable migration documentation, and retained repository evidence. Historical
phase reports were not rewritten.

At audit time production was still on the H.5B release, PID `2663645`,
listening on port 3000, with local and public HTTP 200. The canonical database
SHA was `22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`;
SQLite integrity was `ok` and the foreign-key check was empty. The active event
was `evt_vibe_2025` / `vibe-hackathon-2026`, unfrozen, with submission and
judging deadlines unset. D.4 release `pr_evt_vibe_2025` remained
`calculated` with `published_at = NULL`. H.2 had 11 journey rows and 0
feedback rows. No production data or process was modified.

The standing Kentucky endpoint remained healthy (`evt_kentucky_vibes`); Chatto
and Viby were not touched.

## Working-tree classification and artifact policy

The pre-consolidation tree contained 83 tracked modifications and 147
untracked path groups. The candidate set was classified as follows:

- **COMMIT:** application source, domain/authorization code, schema, tests,
  migration scripts, event fixtures/scripts, README, current guides/runbooks,
  phase reports and durable qualification evidence.
- **EXCLUDE:** `node_modules`, `.next`, local SQLite files/WAL/SHM, backups,
  test-results/browser output, `.env.local`, tool state, release directories,
  and the environment-specific `scripts/c6-https-proxy.mjs`.
- **DELETE LATER:** none required for reproducibility; harmless ignored local
  artifacts may remain outside Git.
- **REVIEW:** the C6 proxy remains intentionally untracked for later operator
  review; no unclear source file was included.

The repository now narrowly ignores clone databases and WAL/SHM variants,
local database backups, test/browser output, and `.claude`, `.codex`, and
`.impeccable` tool state. `docs/**`, `screenshots/**`, `scripts/**`, and
`fixtures/**` were not broadly ignored.

Historical screenshots were retained as intentional qualification/product
review evidence. This is consistent with the phase reports' relative links;
the repository contains approximately 297 participant screenshot files and
the full durable evidence set remains available.

The staged candidate contained no private keys, provider-key formats, cookies,
session state, production database, or participant export. No AI authorship or
co-author metadata was added. Legitimate product references to AI providers
remain product documentation, not contributor attribution.

## Canonical migration/bootstrap repair

I.0 found that the old `db:migrate` command pointed at ignored Drizzle history
that a clean clone did not possess. The repair is a small explicit
repository-controlled orchestrator:

- manifest: `scripts/migrations/index.ts`
- orchestrator: `scripts/migrate-all.ts`
- runbook: `docs/runbooks/DATABASE_MIGRATIONS.md`
- package command: `npm run db:migrate`

The manifest contains 19 explicit, stable entries in dependency order:

1. Viby identity links;
2. admin/Better Auth/Viby session layers;
3. judge authorizations, then account controls, profiles, invitations and
   generic login (account controls validate the judge-authorization table);
4. submission onboarding and memberships;
5. native Team Chat, Direct Messages and Community channels;
6. judging operations;
7. results, calibration and publication;
8. H.2 participant experience telemetry/feedback.

Existing databases require an absolute, canonical non-symlink `DB_FILE_NAME`
and the explicit `VIBE_DB_MIGRATION_CONFIRM`. Fresh databases require
`--bootstrap` and a separate exact bootstrap confirmation. The orchestrator
rejects remote `DATABASE_URL` targets, the protected pre-P0.4 backup, empty
existing databases without `--bootstrap`, and unsafe paths. It runs each
historical guarded script, then verifies the expected current schema, SQLite
integrity and foreign keys. `db:push` remains development-only and is not the
production migration history.

The broken `db:migrate:viby-links` package alias was corrected to
`db:migrate:viby-identity-links`, pointing at the existing
`scripts/migrate-viby-identity-links.ts` file. Migration validators were made
format-tolerant for equivalent Drizzle-qualified SQL while retaining the
semantic checks; the current schema now explicitly carries the admin
authorization status and session-provenance operation checks.

## Migration qualification

Fresh bootstrap on a disposable database produced the current 72-table schema,
`integrity = ok`, and an empty foreign-key check. On that database:

- ordered migration run: passed, `migrationCount = 19`, 72 tables;
- second ordered run: passed with all scripts idempotent, integrity/FK passed.

An approved copy of the protected pre-P0.4 snapshot was used as a historical
upgrade fixture (the protected original was never modified). It preserved its
business rows, advanced successfully through all 19 entries, and passed a
second idempotent run with integrity/FK checks. It retains one legacy extra
table, so its final count is 73 tables versus the current 72-table schema;
the orchestrator intentionally verifies required tables while allowing
historical compatibility extras.

## Consolidation commit and clean qualification

The reviewed staged set passed `git diff --cached --check`, the secret scan,
and the staged-path audit (718 files; no database, runtime, credential, or
tool-state path). A single truthful consolidation commit was created on the
qualified feature branch:

`6fe6bd340f3a3d23a3ecab28a0959e025da204cf`

Commit message: `Consolidate qualified Vibe Hackathon application through H.5`

The commit parent is the former cumulative HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735`; no phase history was invented or
backdated.

A new clean detached worktree was created at
`/opt/vibe-hackathon/qualification/i1-committed-6fe6bd3`, with a fresh
`npm ci`, no inherited environment file, dependencies, build output, database,
or Drizzle journal. The clean worktree was empty according to
`git status --porcelain`.

Clean committed-source qualification:

- full suite: 353 tests across 68 files passed (one known shared-fixture
  ordering flake was reproduced once and passed on the immediate rerun and in
  focused isolation);
- TypeScript: passed;
- production build: passed with safe disposable build environment variables;
- fresh bootstrap: 72 tables, integrity/FK passed;
- ordered migration and second rerun: passed;
- application boot against the disposable database: `/api/health` 200/database
  ok; `/`, `/start`, `/projects`, `/login`, `/winners`, and `/status` all 200;
- changed-file ESLint: passed; the repository-wide lint command still reports
  pre-existing React purity errors in unrelated UI files, while the qualified
  H.5 gate and changed-file lint remain green;
- `git diff --check`: passed.

## Mainline qualification

Before advancing local `main`, I.0 topology was reconfirmed: local `main` and
`origin/main` still pointed at `36d42eb153c767f0935213acd8d4f4e100acfbe5`,
with no independent main commits. A dedicated clean main worktree was advanced
with `git merge --ff-only` to `5ce20854c77ff8d24cf52ad263b49984449211c5`.

Main qualification passed:

- full suite: 353 tests across 68 files passed on the rerun (the first run
  reproduced the known participant-experience shared-fixture ordering race);
- TypeScript and production build: passed;
- fresh 72-table bootstrap and ordered migration smoke/rerun: passed with
  integrity/FK checks;
- clean main worktree: `git status --porcelain` empty.

This report and the I.0 addendum are a documentation-only follow-up to the
application consolidation commit. Once that follow-up is committed, local
`main` is advanced one final fast-forward to the report-containing tip; the
application tree and qualification result are unchanged. The feature branch
remains preserved and remote `origin/main` is not pushed in I.1.

## Production and recovery implications

Production remains on the H.5B immutable release and its database remains
untouched. This is repository provenance work only; no production redeploy is
needed to make Git history canonical. If a later committed-source qualification
problem appears, the prior branch commit and external safety snapshot remain
reachable. Database restore is not part of Git consolidation.

## Recommended next direction

After local `main` is fast-forwarded and re-qualified, the next bounded phase is

**I.2 — REMOTE MAIN / CANONICAL RELEASE FINALIZATION**

I.2 may decide whether to push `main`, create a canonical tag, build from
`main`, compare that release to H.5B, and archive old branches/worktrees.
Feature development and production deployment remain frozen pending that
separate decision.

## I.2 completion addendum (2026-08-18)

I.2 re-confirmed the I.1 topology and clean-main qualification, then completed
the approved repository-only canonicalization. Local `main` was pushed to
`origin/main` with a normal fast-forward from
`36d42eb153c767f0935213acd8d4f4e100acfbe5` after the final 353-test,
TypeScript, build, fresh-bootstrap, 19-entry migration/rerun, integrity/FK and
application-health gate. The final remote ref and local `main` are equal.

The annotated tag `vibe-hackathon-canonical-h5` was created and pushed at the
same qualified main tip. A clean worktree from remote `origin/main` installed,
built, tested, bootstrapped a fresh 72-table database, reran the ordered
migrations idempotently, and passed read-only health/route checks. The
main-built comparison release is
`/opt/vibe-hackathon/releases/main-canonical-20260818T013500Z`.

The H.5B production release remains behavior-equivalent and healthy, so
**NO PRODUCTION REDEPLOY REQUIRED**. Production, its database, Kentucky,
Chatto and Viby were unchanged. The feature branch remains retained for
provenance; the C6 proxy remains excluded and uncommitted. The complete
remote/tag/release record is in
`docs/repository/PHASE_I2_REMOTE_MAIN_CANONICAL_RELEASE_FINALIZATION.md`.
