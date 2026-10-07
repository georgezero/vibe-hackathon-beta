# I.2 Remote Main / Canonical Release Finalization

Date: 2026-08-18 (UTC)

Disposition: **GO — REMOTE MAIN IS CANONICAL AND QUALIFIED**

This record finalizes the repository-only provenance boundary after I.1. It
does not deploy, restart, or mutate production. The canonical tag and release
candidate described here identify the already-qualified H.5 application; they
do not represent a new product feature.

## Starting topology and final-main qualification

The repository is `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
Before this documentation-only follow-up:

- primary checkout: `phase-vh-m6-viby-better-auth-session`;
- local `main`: `7ea307fe239eba78fe4d1360a13abc631abd3938`;
- `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`;
- feature branch and local `main` were equal;
- `origin/main` was a strict ancestor of local `main` (85 commits behind);
- `origin/main` had no independent commits (`git ls-remote` agreed);
- the primary checkout had only the deliberately excluded untracked
  `scripts/c6-https-proxy.mjs`.

The dedicated clean main worktree was empty before qualification. Its final
pre-push gate passed:

- full suite: **353 tests across 68 files**;
- TypeScript: passed;
- production build: passed;
- fresh bootstrap: **72 tables**;
- ordered canonical migration: **19 entries**;
- second migration rerun: passed and idempotent;
- SQLite integrity and foreign-key checks: passed;
- application boot against the disposable database: `/api/health`, `/`,
  `/start`, `/start/resume`, `/projects`, `/login`, `/winners`, and `/status`
  returned HTTP 200.

The final local/main tip is the report-containing documentation-only follow-up
commit recorded by the refs at completion of this phase. Its exact full SHA,
tree SHA, parent, author and timestamp are recorded by `git show` and in the
final disposition below; no application behavior changed relative to the I.1
qualified tip.

## Final source and secret gate

The candidate was checked from the clean main worktree before any remote
mutation. No `.env`, `.env.local`, database, SQLite WAL/SHM, backup,
`node_modules`, `.next`, test-results, browser state, local tool state,
credentials, cookies, private keys, or operator credential files are tracked.
The environment-specific `scripts/c6-https-proxy.mjs` remains excluded and
uncommitted in the primary checkout. No AI authorship/co-author metadata was
introduced. Product references to AI providers remain ordinary application
documentation.

## Remote fast-forward and canonical tag

After the final main qualification, local `main` was pushed with a normal
non-forced fast-forward from the verified old remote tip
`36d42eb153c767f0935213acd8d4f4e100acfbe5`. The push was followed by a fetch
and both local and `git ls-remote` verification that `origin/main` equals the
qualified local main tip.

The annotated tag `vibe-hackathon-canonical-h5` was created on that exact
qualified main tip and pushed with a targeted tag push. Its message identifies
the H.5B production reference and states that it marks canonicalization of
already-qualified functionality, not a new feature. The tag target was read
back from the remote and equals `origin/main`.

## Clean remote-main qualification

A new clean worktree was created from `origin/main` outside the primary
checkout. It contained no inherited environment, dependency, build, database,
Drizzle journal, or tool-state files. From the committed lockfile it completed:

- clean dependency installation;
- full test suite and TypeScript check;
- production build;
- fresh 72-table bootstrap;
- ordered 19-entry migration and idempotent rerun;
- integrity/FK checks;
- read-only application boot and `/api/health` verification.

The worktree remained clean after qualification. Representative public and
protected routes were checked, including Landing, Start, Projects, Login,
Results/unpublished state, Status, AI Evals, People, Messages and Community.
No authorization or publication boundary changed.

## Main-built release candidate

An immutable comparison release was built directly from remote-canonical main:

`/opt/vibe-hackathon/releases/main-canonical-20260818T013500Z`

The candidate records the canonical main SHA, the tag, source-tree fingerprint,
build ID/timestamp, manifest, and `migrationRequired=false`. It includes the
runtime dependencies, Next build/server manifests, static assets and durable
source needed by the existing release process, and excludes databases,
environment files, credentials, session material and qualification state.

The release was booted on an alternate local port against a disposable
current-schema database. Health was HTTP 200/database ok. Landing, Start,
Projects, Login, Results, Status and AI Evals rendered; signed-out account,
People, Messages, Community, judge and admin boundaries remained protected.
The Results route remained unpublished according to authoritative D.4 state.

## Comparison with H.5B

Reference production release:

`/opt/vibe-hackathon/releases/h5-documentation-help-20260817T225617Z`

The comparison found no unexplained participant, admin, judge, authorization,
publication or route behavior difference. Intentional differences are limited
to I.1/I.2 repository provenance and hygiene: the explicit migration manifest
and orchestrator, corrected Viby migration alias, schema-check provenance,
`.gitignore`, migration documentation, repository phase evidence and the
canonical release metadata. Generated build IDs/timestamps are expected to
differ. H.5B application behavior remains the reference product behavior.

## Production decision and preservation

**NO PRODUCTION REDEPLOY REQUIRED.** H.5B is healthy, and the main-built
candidate is behavior-equivalent; I.2 adds repository canonicality rather than
a production product fix. Production was not restarted, its database was not
opened for mutation, and its authoritative data/publication state remained
unchanged. The H.5B release remains the rollback target until a separately
approved canonical-release deployment.

At the I.2 reference check, production remained on
`h5-documentation-help-20260817T225617Z`, PID `2663645`, with local/public
HTTP 200, database SHA
`22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`, D.4
`pr_evt_vibe_2025` calculated/unpublished, and H.2 at 11 journey rows and 0
feedback rows. Kentucky remained HTTP 200 and unchanged; Chatto and Viby were
not touched.

## Branches and worktrees

The historical feature branch `phase-vh-m6-viby-better-auth-session` remains
at the qualified main tip and is fully reachable from `main`. It is retained
temporarily for provenance and is not deleted in I.2. The primary checkout
also remains on that branch because of the intentionally excluded C6 proxy.
A fresh main development worktree is the safer future default; switching or
deleting the primary checkout is deferred.

Existing direct-Viby, detached release, and I.1 qualification worktrees were
not removed. The I.2 remote-main qualification worktree is a disposable
qualification artifact that may be cleaned up later after evidence archival;
no historical worktree is treated as the canonical source.

## Recovery and next direction

Repository rollback remains independent of production rollback: the prior
qualified branch and immutable H.5B release remain reachable. No database
restore is appropriate for this repository-only operation. Remote main is now
the canonical branch, and `vibe-hackathon-canonical-h5` is the canonical
release marker.

The next bounded step is **I.2B — canonical main release production
deployment**, only if separately approved. Otherwise feature freeze remains in
effect; do not start a new product phase.

## Final disposition

**GO — REMOTE MAIN IS CANONICAL AND QUALIFIED**

**NO PRODUCTION REDEPLOY REQUIRED**
