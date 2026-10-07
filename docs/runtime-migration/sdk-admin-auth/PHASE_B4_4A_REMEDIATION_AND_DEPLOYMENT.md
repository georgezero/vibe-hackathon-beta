# Phase B.4.4A-R / B.4.4B — Remediation and Deployment

Status: remediation in progress; deployment not yet authorized by gates

## Repository state before remediation

- Host: `paui`
- Repository:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting repository HEAD:
  `568958875a117606cf4b94e9cc5fb7762fc5ff63`
- Deployable B.4.4A application HEAD before isolation hardening:
  `2d7c6eca724292ae9f9fb5394f358b125cabd802`
- Running release:
  `a03986974ad5ab03453990f7b7f3444e29773b3c`
- Running user service: active/running, PID `3760751`, start time
  `2026-07-30 18:27:14 EDT`, restart count `0`
- Modes: judge `hybrid`; administrator `better-auth`
- Local/public health before remediation: HTTP `200` / HTTP `200`

The protected untracked `local.db.pre-p0-4.bak` was not accessed or modified.
Viby was not modified or restarted.

## Incident evidence recorded before deletion

The exact synthetic row is:

| Field | Value |
| --- | --- |
| Primary key | `onCS5IpEJG-nySyX3cgAJ` |
| Entity type | `judge_access` |
| Entity ID | `judge` |
| Action | `judge_access_denied` |
| Actor type | `judge` |
| Actor ID | null |
| Created epoch | `1785451311` |
| Created local time | `2026-07-30 18:41:51 EDT` |
| Event ID | `evt_vibe_2025` |
| Route | `GET /api/judge/data` |
| Reason | `missing_judge_profile` |
| Correlation/request ID | none recorded |
| User/judge identifier | none recorded |
| Source/test identity | unscoped `judge-api-authorization` unit run |

The complete sanitized metadata payload was:

```json
{"eventId":"evt_vibe_2025","route":"GET /api/judge/data","reason":"missing_judge_profile"}
```

It is conclusively the qualification artifact because:

1. its immutable primary key occurs exactly once;
2. it is the only audit row in the incident window
   `1785451200..1785451400`;
3. it was the maximum audit row at the exact timestamp recorded during the
   initially unscoped `npm test`;
4. the route and failure reason exactly match the mocked
   `judge-api-authorization` test request;
5. that test mocked the judge store but, before commit `2d7c6ec`, did not mock
   `logJudgeAudit`;
6. commit `2d7c6ec` added that missing audit mock after the incident.

The primary key, exact timestamp, and complete metadata identify one row
without a broad predicate or approximate cleanup range.

## Pre-remediation canonical state

- audit events: `145`
- Better Auth users: `2`
- Better Auth accounts: `2`
- Better Auth sessions: `8`
- administrator authorizations: `1`
- judge authorizations: `1`
- judge profiles: `3`
- assignments: `15`
- scores: `12`
- Viby identity links: `1`
- Viby identity-link transactions: `3`
- Viby login transactions: `5`
- Viby session handoffs: `0`
- maximum audit row: `onCS5IpEJG-nySyX3cgAJ` at `1785451311`
- SQLite integrity check: `ok`
- foreign-key violations: `0`

The incident did not change identity links, authorizations, profiles,
assignments, scores, Better Auth users/accounts/sessions, or handoffs. Only
the single audit row was added.

## Test-isolation root cause and corrective design

The old database initializer used:

```text
DB_FILE_NAME ?? "local.db"
```

Vitest did not have a mandatory setup guard and `npm test` invoked Vitest
directly. Therefore an unscoped test importing the real audit repository
could silently open the repository's canonical `local.db`.

The corrective implementation:

- makes `npm test` create a unique `mkdtemp` database root;
- explicitly supplies both `DB_FILE_NAME` and
  `VIBE_TEST_DATABASE_ROOT`;
- strips inherited `DATABASE_URL`, database auth, and production database
  configuration;
- requires the database to be an absolute child of the explicit disposable
  root;
- requires that root to be inside the operating-system temporary directory;
- rejects the canonical database and protected backup paths;
- runs a mandatory Vitest setup guard, including directly invoked Vitest;
- applies the same guard in the application database initializer;
- deterministically removes the unique temporary root after the run;
- includes an executable proof that missing configuration fails, an audit
  write reaches only a disposable database, and the canonical checksum is
  unchanged.

Production database behavior remains unchanged because the guard activates
only for an explicitly declared test process and still requires independent
path configuration rather than trusting test mode alone.

## Targeted remediation

An online SQLite backup was created before mutation:

- path:
  `/opt/vibe-hackathon/backups/local.db.pre-b4-4a-remediation.20260730T211407-0400.bak`
- size: `479232` bytes
- timestamp: `2026-07-30 21:14:18 EDT`
- SHA-256:
  `5cb4d2f4cf7ac995fe4790956397a4857bc905419bc0fa1f27b040974fc88569`
- backup integrity: `ok`
- backup foreign-key violations: `0`
- exact incident row present in backup: yes

The deletion used the immutable primary key
`onCS5IpEJG-nySyX3cgAJ`. Inside one `BEGIN IMMEDIATE` transaction, the
operator script:

1. selected that primary key;
2. asserted exactly one row;
3. asserted every recorded field and the complete metadata payload;
4. deleted with `WHERE id = ?`;
5. required SQLite `changes = 1`;
6. required the same identifier to return zero rows;
7. required the total audit count to change from `145` to `144`;
8. committed only after every assertion passed.

Post-remediation:

- affected rows: exactly `1`;
- incident row remaining: `0`;
- audit events: `144`;
- new maximum audit row: `CayajWjLDwTb4cUNkkvCp` at `1785450595`;
- SQLite integrity: `ok`;
- foreign-key violations: `0`;
- users/accounts/sessions: `2` / `2` / `8`;
- administrator/judge authorizations: `1` / `1`;
- judge profiles/assignments/scores: `3` / `15` / `12`;
- Viby identity links: `1`;
- identity-link/login/handoff transactions: `3` / `5` / `0`.

No unrelated audit row or application-domain row was removed or modified.

## Canonical immutability proof

The logical fingerprint hashes the complete ordered SQLite schema and every
row in every application table. Before qualification:

- logical SHA-256:
  `a80e8649b28b2e6945688a0bb38bd086825b0c135528da5467747e2b047e160b`;
- audit rows: `144`;
- maximum audit row: `CayajWjLDwTb4cUNkkvCp` at `1785450595`;
- users/accounts/sessions: `2` / `2` / `8`;
- administrator/judge authorizations: `1` / `1`;
- profiles/assignments/scores: `3` / `15` / `12`;
- identity links: `1`;
- foreign-key violations: `0`;
- integrity: `ok`.

After the complete unit, focused, migration, browser, TypeScript, lint, build,
and scan qualification, every value above and the logical SHA-256 were
identical. No test process opened or changed the canonical database.

## Local qualification

- executable isolation proof: passed;
  - missing database configuration rejected;
  - one audit write reached the disposable database;
  - canonical checksum unchanged;
- full unit suite: **245/245 passed** across 34 files;
- focused principal, callback, judge, and Phase B set:
  **60/60 passed** across 7 files;
- disposable B.4.4 migration first run: passed;
- identical migration rerun: passed;
- disposable profiles/assignments/scores: `3` / `15` / `12`;
- disposable judge authorizations: `1`;
- disposable duplicate assignment/score pairs: `0` / `0`;
- disposable integrity: `ok`;
- disposable foreign-key violations: `0`;
- Phase B desktop Chromium: **10/10 passed**;
- Phase B mobile Chromium: **10/10 passed**;
- dedicated administrator Chromium: **23/23 passed**;
- standalone TypeScript: passed;
- changed-file ESLint: passed;
- Next.js 16.2.12 production build: passed, 38 application pages generated;
- `git diff --check`: passed;
- private-key, credential, attribution, and sensitive-output scans: passed.

WebKit was not run. The host still lacks `libmanette-0.2.so.0` and
`libhyphen.so.0`; the libraries were not installed on this production host.
This remains an explicit platform limitation, not a pass.

The production-exact Runtime contract remains:

```text
callback: /admin/viby/callback
source: vibe_admin_confirmation
mode: admin
```

Administrator and judge behavior remain separately selected by the opaque,
one-time server transaction. Browser input cannot select operation, policy,
authorization role, event scope, callback destination, or freshness policy.

## Application commit and immutable release

Test-isolation hardening was committed as:

```text
a5d66540b8099fa5ec1cf0d2332a979e9a768693
test: harden database isolation
```

This commit contains the previously qualified B.4.4A correction at
`2d7c6eca724292ae9f9fb5394f358b125cabd802` plus the fail-closed test
controls. The documentation report is not part of the application artifact.

Immutable release:

- directory:
  `/opt/vibe-hackathon/releases/a5d66540b8099fa5ec1cf0d2332a979e9a768693`;
- embedded `.release-commit`:
  `a5d66540b8099fa5ec1cf0d2332a979e9a768693`;
- clean `npm ci`: passed;
- immutable production build: passed;
- existing npm dependency audit warning: 5 moderate and 12 high advisories;
- rollback release retained:
  `a03986974ad5ab03453990f7b7f3444e29773b3c`;
- rollback judge mode: `hybrid`.

No canonical migration was required for the isolation-only application
commit. The B.4.4 migration was nevertheless rerun twice successfully on an
online disposable canonical-shape copy.

## Deployment

Before cutover:

- release: `a03986974ad5ab03453990f7b7f3444e29773b3c`;
- PID: `3760751`;
- start: `2026-07-30 18:27:14 EDT`;
- restart count: `0`;
- local/public health: HTTP `200` / HTTP `200`;
- backup: present and verified;
- judge/admin modes: `hybrid` / `better-auth`.

Only the Vibe Hackathon user service was restarted. Viby was not modified or
restarted.

After cutover:

- release: `a5d66540b8099fa5ec1cf0d2332a979e9a768693`;
- PID: `21832`;
- start: `2026-07-30 21:29:23 EDT`;
- restart count: `0`;
- service: active/running;
- startup: Next.js 16.2.12, `Ready in 184ms`;
- listener on port 3000: PID `21832`;
- old PID `3760751`: no longer running;
- local/public health: HTTP `200` / HTTP `200`;
- judge/admin modes: `hybrid` / `better-auth`.

## Production-safe smoke evidence

Completed automated checks:

- anonymous `/admin/dashboard`: redirected for `session_required`;
- anonymous `/judge/dashboard`: redirected for `session_required`;
- callback with missing state: rejected as `invalid_callback_state`;
- signed-out `/judge`: HTTP `200`;
- Viby option, password option, authorization-dependent copy, and marked
  legacy fallback: present;
- obsolete `/judge/viby/callback` target: absent;
- live judge launch:
  - application redirect: HTTP `307`;
  - Runtime origin/path: `https://viby.keit.ai/apps/vibe-hackathon/start`;
  - callback origin: `https://vibe-hackathon-dev.ggg.ad`;
  - callback path: `/admin/viby/callback`;
  - opaque state: present but not recorded;
  - mode: `admin`;
  - source: `vibe_admin_confirmation`;
  - routine `forceIdentityCheck`: `false`;
  - Runtime response: HTTP `200`;
  - invalid-path/host-request rejection: absent.
- Ada Better Auth password login: passed;
- resolved judge profile: `judge_media_ada`;
- assigned `sub_media_a`: HTTP `200`;
- existing score read: passed without mutation;
- unassigned `sub_TqyBoahq`: HTTP `403`;
- administrator route for Ada: denied;
- global logout: passed;
- judge route after logout: denied.

No score or assignment was changed. Production audit rows from these checks
contain only the expected launch, password-login, denial, logout, missing
session, and invalid-callback events. No synthetic unit-test audit event was
created.

The live real-identity Viby callback, first-time link/returning login, and
administrator real-account regressions require human-controlled credentials
and biometric interaction and remain pending at the time of this report
update.

## Postdeployment database state before human Viby qualification

- audit events: `155`, all 11 additions attributable to the intentional
  deployment smoke checks;
- users/accounts/sessions: `2` / `2` / `8`;
- administrator/judge authorizations: `1` / `1`;
- judge profiles/assignments/scores: `3` / `15` / `12`;
- Viby identity links: `1`;
- identity-link transactions: `3`;
- Viby session handoffs: `0`;
- integrity: `ok`;
- foreign-key violations: `0`.

Expired Viby login transactions were removed by the normal cleanup performed
when the intentional judge launch created its new transaction. No identity,
authorization, profile, assignment, or score was created or modified.

## Viby status

Viby was unchanged.

## Final disposition

The corrected application is healthy and the Runtime accepts its launch
contract, but the human-controlled real Viby callback/linking flow and
administrator real-account regression were not completed in this
qualification turn. Deployment success is therefore not claimed.

NO-GO — HUMAN VIBY AND ADMINISTRATOR LIVE QUALIFICATION PENDING
