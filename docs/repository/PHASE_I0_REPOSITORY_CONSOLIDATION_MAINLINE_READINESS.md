# I.0 — Repository Consolidation / Mainline Readiness Audit

## Executive summary

The qualified H.5B application is recoverable from the current cumulative
worktree, and the worktree is materially ahead of the checked-out Git history.
The H.5B immutable release is healthy in production and its application source
is byte-equivalent to the current worktree source after excluding expected
runtime, local-configuration, and post-release documentation artifacts. No
unexplained application-source divergence or live secret candidate was found.

There is one bounded reproducibility gap to repair in I.1 before claiming a
fresh clone is migration-reproducible: migration scripts are distributed as
manual commands without a canonical ordered bootstrap, generated Drizzle SQL
history is not tracked, and `package.json` exposes
`db:migrate:viby-links` although the source file is named
`migrate-viby-identity-links.ts`. This is a repository-provenance problem, not
a production product defect. The exact repair is identified below; it was not
performed during I.0.

**GO FOR I.1 — REPOSITORY CONSOLIDATION**

I.1 must begin with the migration/bootstrap repair and artifact-exclusion gates
below. I.0 did not stage, commit, merge, rebase, reset, clean, switch branches,
or deploy.

## 1. Git/worktree topology

- Repository root: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- `.git`: ordinary directory, not a gitfile; repository is non-bare and not
  shallow (`rev-parse --is-inside-work-tree=true`, `--is-bare-repository=false`,
  `--is-shallow-repository=false`).
- Current worktree: the primary checkout at the repository root.
- Current branch: `phase-vh-m6-viby-better-auth-session`
- Current HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Tracking reference: `origin/main`; the current branch is 82 commits ahead.
- Local `main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`.
- `origin/main`: the same `36d42eb153c767f0935213acd8d4f4e100acfbe5`.
- Merge-base: local `main` itself. `main` has zero commits not reachable from
  the current branch; the current branch has 82 commits not in `main`.
- `main` is not checked out in another worktree.

Other worktrees are intentionally present and were not touched:

- `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon-direct-viby` on
  `phase-vh-m5-direct-viby-integration` at `65615e5d...`;
- detached release worktree
  `/opt/vibe-hackathon/releases/122a2ac1b86b2bb34a067656bf42acbd01d124a2` at
  `122a2ac1...`.

The topology supports a later normal fast-forward of `main` after the current
branch is consolidated and qualified. No merge is needed to preserve an
independent `main` line today.

## 2. Current Git state

Read-only status captured during I.0:

- staged files: `0`;
- modified tracked files: `77`;
- tracked deletions: `0`;
- conflicted paths: `0`;
- untracked entries in ordinary `git status --short` output: `148` (directory
  entries are collapsed by Git);
- expanded untracked files: `638`;
- ignored top-level/runtime entries: `10`.

The worktree contains the only convenient editable representation of the
qualified product. It was not reset, cleaned, stashed, checked out, or otherwise
mutated by this audit.

The 82 committed changes unique to the current branch are primarily the
Better Auth/Viby, role, security, and runtime-conformance history through the
M6 Chatto evaluation. The uncommitted cumulative tree adds the later judging,
publication, participant, social, observability, navigation, empty-state,
universal-messaging, and H.5 documentation/help layers.

## 3. H.5B deployed reference

The production-qualified reference is:

`/opt/vibe-hackathon/releases/h5-documentation-help-20260817T225617Z`

Release provenance:

- repository HEAD recorded: `a70edc28326108dfc84a69af303f680ceaa7f735`;
- source-tree fingerprint:
  `5399b036e417c5c6fdcd7ac66173377fcdc79756af0ca4373502563758fb787a`;
- build ID: `gzcfMR2AG4rnTt0BP45zu`;
- build timestamp: `2026-08-17T22:57:37.890Z`;
- `migrationRequired=false`;
- release metadata: `RELEASE_METADATA.json`;
- release manifest: `RELEASE_MANIFEST.txt`;
- publication authority recorded as D.4 `publication_releases`.

The release includes runtime/build output and dependencies for deployment, but
those are not canonical source. Environment files, databases, credentials,
cookies, and session state are not candidate Git content. The release also
contains local `.claude`, `.codex`, and `.impeccable` configuration/cache files;
these are not application source and should be excluded by the I.1 packaging
and repository rules.

## 4. Cumulative qualified product layers

The candidate tree accounts for the deployed layers rather than only the most
recent H.5 report:

- Better Auth application sessions, account controls, Viby identity links and
  judge/admin boundaries;
- event/project lifecycle, submission onboarding, claiming and recovery;
- participant Start, My Projects, editor, Preview, readiness and finalization;
- teams, roster, invitations, memberships and project workspace access;
- profiles, People, Direct Messages, blocking/reporting and offline durability;
- Community channels, moderation, event-scoped content and organizer-only
  announcements;
- project-local Team Chat and activity;
- judging workspace, AI evaluations, calibration, results and D.4 publication;
- admin/event operations, exports and event health;
- H.2 participant observability and optional feedback;
- H.1 navigation/IA, H.3 empty-state activation, H.4 continuity,
  H.4R/H.4R.1 open social access and universal People messaging;
- H.5 role documentation, participant getting-started guidance and bounded Start
  orientation.

Historical phase reports and screenshots describe this evolution and were not
rewritten as part of I.0.

## 5. Four-state comparison

The comparison was performed at file content level while excluding generated
build/dependency output, runtime databases, test-result output, and screenshot
trees.

### Working tree vs H.5B release

Before adding this I.0 report, the shared source set contained 740 files in
both locations and had **zero differing shared files**. Working-tree-only
paths were:

- `.env.example` — canonical configuration template, intentionally not copied
  into the immutable runtime package;
- `.env.local` — ignored local secret/configuration file, never commit;
- `docs/participants/PHASE_H5B_PRODUCTION_DEPLOYMENT.md` — durable deployment
  evidence created after the H.5B package was built.

The release-only paths were its three release metadata/fingerprint files. This
I.0 report is likewise post-release audit evidence and is intentionally not
claimed as part of the H.5B deployed application source.

There were no post-H.5B application, component, library, schema, test, or
configuration content changes detected in the shared source set.

### Git HEAD vs H.5B release

- HEAD tracked files: `424`;
- H.5B release source/runtime file set reviewed: `743` before excluding local
  release metadata;
- release-only qualified paths absent from HEAD: `322`, primarily cumulative
  app routes/components/libraries, tests, migrations, durable docs and evidence;
- HEAD-only paths: `3` (the environment template and two historical screenshot
  paths);
- differing paths present in both: `76`, representing cumulative qualified
  changes to tracked files.

This is expected dirty-history divergence, not unexplained H.5B drift.

### `main` vs current branch

`main` is an ancestor of the current branch with no independent main-only
commits. The current branch’s 82 committed commits plus the dirty cumulative
worktree represent the product that was actually qualified and deployed.

## 6. File disposition inventory

The expanded path inventory is summarized below. Counts include modified
tracked and untracked files where applicable and are intended as an audit
index, not as permission to stage anything during I.0.

| Disposition | Approximate inventory | Examples / decision |
|---|---:|---|
| **COMMIT** canonical source/config | 199 | `app/`, `components/`, `lib/`, schema, package/config, durable API/domain code, `.env.example` |
| **COMMIT** tests | 39 | focused G/H tests, migration/domain tests, browser qualification specs |
| **COMMIT** durable documentation | 106 | README, role guides, runbooks, phase reports, architecture/security records |
| **COMMIT or deliberately archive** evidence | 325 | phase screenshots/contact sheets; repository convention currently retains this evidence |
| **COMMIT** migration/qualification scripts | 28 | additive migrations, event fixture tools, durable qualification helpers |
| **COMMIT** fixture/config support | 7 | Kentucky seed and phase Playwright configs |
| **REVIEW** script provenance | 4 | `scripts/c6-https-proxy.mjs` is environment-specific; seed/cleanup scripts need explicit I.1 purpose review |
| **EXCLUDE / delete later** runtime/database/test output | 5 | `cloneDB*`, `local.db.pre-p0-4.bak`, `test-results/.last-run.json` |
| **EXCLUDE** local operator configuration | 2 | `.claude/settings.local.json`, `.codex/hooks.json` |
| **NEVER COMMIT** secret/config | 1 | ignored `.env.local`; values were not printed |

The screenshot disposition should be decided deliberately in I.1 (commit as
historical qualification evidence, or archive outside Git); it must not be
globally ignored without considering the phase reports that reference it.

## 7. Secret and sensitive-artifact audit

No `gitleaks`, `trufflehog`, or `detect-secrets` executable is installed on the
host, so the audit used read-only Git/path inspection plus a conservative
static scan that did not print values.

Findings:

- no private-key, GitHub-token, OpenAI/Anthropic-key, Slack-token, or Cloudflare
  credential pattern was found in current candidate content;
- no tracked `.env`, `.env.local`, credential, cookie, session, or private-key
  file was found;
- no matching high-risk secret blob was found across Git history;
- `.env.local` exists only as an ignored local file and is not a candidate;
- token/password-looking route names are application routes, not credentials;
- no `Co-authored-by`, generated-by-AI, Codex, Claude, OpenAI, or Anthropic
  authorship metadata was found in candidate files or commit metadata. Ordinary
  product references to Anthropic/OpenAI functionality are legitimate content.

The local `.claude`, `.codex`, and `.impeccable` files are operator/tool state,
not secrets found by the scan, but they remain excluded from canonical Git.

## 8. `.gitignore` findings

The current `.gitignore` correctly excludes `node_modules`, `.next`, `out`,
`build`, `.env*` (while allowing `.env.example`), `local.db`, SQLite WAL/SHM,
`drizzle/`, coverage, debug logs and TypeScript build state.

It does not currently exclude several observed local artifacts:

- `cloneDB`, `cloneDB-wal`, `cloneDB-shm`;
- `*.bak` backups such as `local.db.pre-p0-4.bak`;
- `test-results/` and browser output;
- `.claude/`, `.codex/`, `.impeccable/` local tool state;
- operator backup/release directories when they are ever materialized under a
  checkout.

I.1 should add narrow, documented patterns for these artifacts without
ignoring durable `docs/**` screenshots or seed fixtures. No ignore rule was
changed during I.0.

## 9. Migration completeness

The current schema declaration contains 72 SQLite tables, and the canonical
production database contains the same 72 tables with no schema-only or
database-only table names. The deployed H.5B phase itself requires no new
migration.

The repository nevertheless does not yet provide a single reproducible
bootstrap path for the cumulative schema:

1. Historical additive migrations are individual `scripts/migrate-*.ts` files,
   many of which are currently untracked and therefore absent from `main`.
2. `drizzle/` is ignored and contains only a local journal; no generated SQL
   migration history is tracked.
3. `npm run db:migrate` delegates to `drizzle-kit migrate`, but there is no
   committed ordered SQL migration set for a fresh clone.
4. `npm run db:push` can establish schema shape but is not a safe substitute
   for an explicit production migration history.
5. `package.json` exposes `db:migrate:viby-links`, while the source file is
   `scripts/migrate-viby-identity-links.ts`; the referenced
   `scripts/migrate-viby-links.ts` does not exist. The file/command inventory
   therefore has one mismatch.
6. Individual scripts have different explicit-target and confirmation
   conventions, and there is no committed ordered manifest declaring the
   baseline-to-H.5B sequence.

Therefore a fresh clone cannot yet be called migration-reproducible through a
single repository-controlled procedure. This is the main I.1 gate. The
production database is intact and the gap is bounded: I.1 can add the ordered
manifest/orchestrator, correct the Viby command naming, preserve the existing
idempotent scripts, and qualify the full sequence on a disposable fresh
database before any main merge.

## 10. Build and package reproducibility

The source includes `package.json`, `package-lock.json` (lockfile v3),
`drizzle.config.ts`, Next/TypeScript/ESLint/Vitest/Playwright configuration,
and the build/start scripts used by H.5B. The H.5B exact source passed the full
351-test suite, TypeScript, production build, ESLint, `git diff --check`, and
Impeccable detector.

The remaining reproducibility dependencies are repository state, not missing
runtime packages:

- the cumulative application source/tests/docs are not represented by the
  current HEAD;
- migration scripts are not all tracked and have no canonical order;
- local operator/tool state was present in the release packaging and needs to be
  excluded by I.1 packaging hygiene;
- a clean clone must use a documented local SQLite bootstrap rather than
  relying on `/opt/vibe-hackathon`, a dirty worktree, or a pre-existing DB.

No claim is made that a fresh `main` clone can reproduce H.5B until these gates
are completed and tested from committed source.

## 11. Candidate canonical source set vs H.5B

The intended candidate set is:

- application source, components, libraries, schema and configuration;
- tests and required browser qualification configurations;
- all additive migrations and durable event/qualification scripts;
- README, current role guides, runbooks, architecture/security docs and
  intentionally retained historical qualification evidence;
- `.env.example`, lockfile and bootstrap/config templates.

It explicitly excludes `.env.local`, databases/backups/WAL/SHM, dependencies,
`.next`, test output, local tool state, tunnel credentials, cookies/session
state, and generated release metadata.

Compared with H.5B, the candidate has no unexplained application-source
difference. The expected differences are documentation created after package
build (`PHASE_H5B...` and this I.0 report), the Git-only `.env.example` template,
and excluded packaging/runtime files. This supports a truthful reconstruction
of the H.5B product once the migration/bootstrap gap is repaired.

## 12. Recommended consolidation strategy

Recommend **Strategy A: one truthful consolidation commit**, not artificial
phase-by-phase history reconstruction.

The later phases are cross-cutting and internally coupled: splitting app routes,
schema, auth, migrations, tests, docs and evidence into guessed intermediate
states would create commits that were never independently qualified. A single
consolidation commit can preserve the actual qualified state and then be tested
as a unit.

Proposed commit subject (no AI attribution):

`chore: consolidate qualified application through H.5`

That commit should include the migration/bootstrap repair and targeted ignore
rules as part of the same coherent reproducibility change, followed by a full
test/build from the committed tree. Local tool state, databases, backups,
credentials and ambiguous tunnel helpers remain out.

## 13. Proposed main merge strategy

Because local `main` has no commits absent from the current branch, the safe
sequence is:

1. preserve a filesystem backup or independent worktree of the dirty state;
2. perform the migration/ignore repair and candidate classification;
3. stage only the reviewed candidate set;
4. make the single consolidation commit on the current branch;
5. run the full qualification from that committed branch;
6. fast-forward `main` normally once the committed source is green;
7. create a fresh worktree/checkout of `main` and repeat install, migration,
   test, typecheck, lint and production build;
8. compare the fresh-build source/provenance with the H.5B release.

No merge, branch switch, staging, commit, rebase, reset, or deployment was
performed in I.0.

## 14. Exact I.1 procedure

I.1 should be separately approved and should proceed in this order:

1. Snapshot the worktree and preserve the current H.5B release/rollback
   pointer; do not discard any untracked evidence.
2. Add a canonical migration manifest/orchestrator covering the existing
   baseline-to-current sequence, with explicit absolute-target, regular-file,
   backup, idempotency, integrity/FK, and no-remote-database checks.
3. Correct the `viby-links` / `viby-identity-links` package-command mismatch
   without deleting compatibility behavior.
4. Decide and document whether manual additive scripts or committed Drizzle SQL
   migrations are the source of truth; do not leave both ambiguous.
5. Add narrow `.gitignore` rules for observed local runtime/tool artifacts.
6. Classify screenshots and historical reports explicitly, then stage only the
   candidate source/tests/docs/fixtures/migrations.
7. Run the migration sequence on a fresh disposable SQLite file twice; compare
   schema/table counts, integrity/FK checks, and a fresh application boot.
8. Commit the coherent candidate without AI attribution.
9. Run the complete H.5B qualification gate from the commit and record the new
   fingerprint.
10. Fast-forward `main`, build/test from a fresh `main` worktree, and compare
    behavior/source provenance before considering any later deployment phase.

## 15. Production implications

Read-only I.0 checks confirm the reference product remains healthy:

- current release: `/opt/vibe-hackathon/releases/h5-documentation-help-20260817T225617Z`;
- PID: `2663645`;
- restart count: `0`;
- local/public `/api/health`: HTTP 200, database ok;
- event `evt_vibe_2025` remains unfrozen and D.4 publication remains calculated
  and unpublished;
- standing Kentucky `https://kentucky-vibes-f0b.ggg.ad`: HTTP 200, PID `920580`,
  restart count `0`;
- Chatto and Viby were not modified.

Consolidating Git history alone does not require a production redeployment if
the committed source is content-equivalent to H.5B. Any code changes required
to repair migration orchestration or packaging should be qualified first and
handled under a separately approved deployment phase; I.0 performs no deploy.

## 16. Blockers and bounded repairs

### Mainline-readiness gates for I.1

- **Migration bootstrap is not yet canonical.** Fix the command mismatch and
  provide an ordered, fresh-database-tested migration path before declaring
  reproducibility complete.
- **Ignore/package hygiene is incomplete.** Exclude local tool state, clone DBs,
  backups and test output; preserve intentional docs/screenshots.
- **Artifact classification still needs explicit staging review.** The 325
  screenshot/evidence files and four environment-specific/review scripts must
  be consciously included or archived, not swept into a bulk add.

### Not blockers

- no unexplained H.5B application-source drift;
- no live secret candidate or secret blob found;
- no main-only commit conflict;
- production/Kentucky health remains good;
- authoritative production data and publication state remain unchanged.

## 17. Final disposition

**GO FOR I.1 — REPOSITORY CONSOLIDATION**

This is a gated GO: I.1 must repair and freshly qualify migration/bootstrap
reproducibility before committing the candidate and fast-forwarding `main`.
I.0 itself made no Git or production state changes and did not begin I.1.

## I.1 completion addendum (2026-08-18)

I.1 repaired the bounded migration/bootstrap and artifact-hygiene gaps
identified above. The explicit 19-entry orchestrator in
`scripts/migrations/index.ts` and `scripts/migrate-all.ts` passed fresh 72-table
bootstrap, an upgrade from a copied pre-P0.4 database, and idempotent reruns
with integrity/FK checks. The Viby migration package alias was corrected and
the narrow `.gitignore` additions were applied. Historical screenshots and
durable qualification evidence were retained intentionally; local databases,
backups, tool state, credentials and the C6 proxy remained excluded.

The cumulative source was committed truthfully as
`6fe6bd340f3a3d23a3ecab28a0959e025da204cf` (`Consolidate qualified Vibe
Hackathon application through H.5`) and passed clean-worktree qualification:
353 tests across 68 files, TypeScript, production build, fresh bootstrap,
upgrade/rerun, application health, changed-file lint and diff-check. The
complete record is in
`docs/repository/PHASE_I1_REPOSITORY_CONSOLIDATION.md`.

Local `main` was then fast-forwarded with `--ff-only` from
`36d42eb153c767f0935213acd8d4f4e100acfbe5` to
`5ce20854c77ff8d24cf52ad263b49984449211c5`; the dedicated clean main
worktree passed the full suite on rerun (353 tests across 68 files),
TypeScript/build, fresh bootstrap and migration smoke. A final documentation-only
tip containing this completion record will be advanced to `main` without
changing application behavior. Remote `origin/main`, production, Kentucky,
Chatto and Viby remain unchanged.
