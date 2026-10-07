# Phase B.4.4A — Judge Viby Runtime Contract Conformance

Status: implementation complete; deployment gate withheld pending operator
disposition of one test-generated audit row

## Preimplementation contract note

Baseline recorded on `paui`:

- repository:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- branch: `phase-vh-m6-viby-better-auth-session`
- starting HEAD: `0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`
- merge base with `origin/main`:
  `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- production release:
  `/opt/vibe-hackathon/releases/a03986974ad5ab03453990f7b7f3444e29773b3c`
- production PID: `3760751`
- production start time: `2026-07-30 18:27:14 EDT`
- restart count: `0`
- service: active/running
- local/public health: HTTP `200`
- judge mode: `hybrid`
- administrator mode: `better-auth`

The protected untracked `local.db.pre-p0-4.bak` was not accessed or modified.
The uncommitted B.4.4 production qualification report was preserved.

### 1. Runtime launch construction

`app/api/viby/start/route.ts` creates a database-backed login transaction and
then constructs:

```text
https://viby.keit.ai/apps/vibe-hackathon/start
```

with `mode`, `callbackUrl`, `context`, and, for fresh flows,
`freshIdentity=1`. The callback carries only opaque state. The browser binding
is a separate HTTP-only application cookie.

### 2. Current callback policy

`lib/viby-login-policy.ts` currently assigns:

| Operation | Callback | Runtime mode | Runtime source |
| --- | --- | --- | --- |
| `admin_login` | `/admin/viby/callback` | `admin` | `vibe_admin_confirmation` |
| `judge_login` | `/judge/viby/callback` | `admin` | `vibe_judge_login` |

The judge callback and source are not in the production Runtime contract.

### 3. Server-owned transaction distinction

`viby_login_transactions` stores:

- unique SHA-256 state digest, never raw state;
- browser-binding digest;
- enum-constrained `operation` (`admin_login` or `judge_login`);
- normalized return destination;
- expected audience;
- freshness requirement;
- creation, expiry, consumption, and failure state.

The operation is stored in the database, not encoded in callback state.

### 4. Qualified Runtime contract

The qualified administrator launch uses:

- callback: `/admin/viby/callback`;
- mode: `admin`;
- source: `vibe_admin_confirmation`;
- application/audience: `vibe-hackathon`.

Production Runtime accepts that exact origin/path/mode/source combination.

### 5. Existing administrator callback

`app/admin/viby/callback/route.ts` is the registered application callback.
In Better Auth mode it currently calls the shared callback implementation
with `operation: "admin_login"` hard-coded.

### 6. Safe operation dispatch feasibility

The Runtime callback contains sufficient state for safe role-neutral
dispatch:

1. hash the opaque returned state;
2. resolve the unique server-created transaction;
3. match the independent browser-binding digest;
4. atomically consume the transaction once;
5. validate its enum-constrained operation;
6. select the explicit application operation policy.

Neither callback URL nor Runtime source is needed to infer the application
role.

### 7. Operation ownership

Operation is authoritative only in the server transaction. The current
application does not send operation as a standalone Runtime or browser query
parameter.

### 8. State and replay

State is 32 random bytes encoded as base64url. Only its SHA-256 digest is
stored. Consumption is conditional on state digest, browser-binding digest,
unconsumed state, and unexpired state. A second consumption fails.

### 9. Return destinations

Return destinations are normalized through the operation policy before
storage:

- admin destinations are confined to `/admin`;
- judge destinations are confined to `/judge`;
- invalid, cross-role, absolute, and scheme-relative values become the
  operation default.

Downstream handoff and linking transactions normalize and preserve the same
server-owned operation-specific destination.

### 10. Browser-controlled values

The application currently trusts none of these browser values for role
selection:

- user ID;
- judge ID;
- identity-link ID;
- Runtime subject;
- operation;
- role.

The initiating `flow` query selects which server transaction to create, but
the current callback incorrectly re-selects operation from the route
implementation instead of resolving it from the transaction. Runtime mode and
source are launch-contract values, not authorization inputs. Return
destinations are browser-supplied only as candidates and are allow-listed
before persistence.

## Preimplementation decision

Proceed with one authoritative Runtime callback at
`/admin/viby/callback`, using the existing Runtime-compatible
`admin`/`vibe_admin_confirmation` contract for both operations. Refactor
callback processing to load and atomically consume the server transaction
before operation dispatch. Keep explicit and separate admin/judge application
policies for freshness, destinations, linking, auditing, and post-auth
authorization.

GO FOR IMPLEMENTATION

## Final implementation report

### 1–4. Revisions and production rollback baseline

1. Starting HEAD:
   `0b0cce4c73fb457d85d3187b3aa6a245f660a4f3`.
2. Final application implementation HEAD and proposed immutable release:
   `2d7c6eca724292ae9f9fb5394f358b125cabd802`.
3. Commit sequence:
   - `a4d795f` — `docs: record B.4.4 production rollback`
   - `3f67943` — `auth: conform judge Viby login to Runtime callback contract`
   - `2d7c6ec` — `test: enforce Viby Runtime contract conformance`
   - this report is a documentation-only closeout after the application
     release commit.
4. Production remained on the rollback application release
   `a03986974ad5ab03453990f7b7f3444e29773b3c`, with PID `3760751`,
   `hybrid` judge mode, `better-auth` administrator mode, zero restarts, and
   local/public HTTP `200`.

### 5–9. Contract correction

5. Root cause was confirmed: B.4.4 sent
   `/judge/viby/callback` and source `vibe_judge_login`, neither of which is
   part of the production Runtime registration. Runtime rejected the callback
   path as `invalid_path` before identity authentication.
6. The registered interactive callback contract is:
   `https://vibe-hackathon-dev.ggg.ad/admin/viby/callback`.
7. The registered Runtime source is `vibe_admin_confirmation`.
8. The registered Runtime mode is `admin`.
9. Both `admin_login` and `judge_login` now launch:

   ```text
   callback path: /admin/viby/callback
   mode: admin
   source: vibe_admin_confirmation
   ```

   A non-mutating request to the unchanged production Runtime returned HTTP
   `200` without `Invalid host-app callback URL` or `Host app request could
   not continue`. It stopped before identity interaction and created no
   assertion or application link.

### 10–13. Shared callback and operation dispatch

10. `/admin/viby/callback` is now the only authoritative interactive human
    assertion callback handler. The former
    `/judge/viby/callback` handler was removed.
11. The callback hashes opaque state, resolves the unique server transaction,
    verifies the independent browser binding, atomically consumes the
    transaction, validates its enum-constrained operation, and then selects
    the explicit admin or judge application policy.
12. Callback URL does not determine role. Both operations use the same URL.
13. Runtime mode/source do not determine role. Both operations use the same
    registered Runtime values; only the server transaction operation selects
    post-auth behavior. Browser `operation`, `source`, and `role` parameters
    are not read.

The operation registry explicitly defines, per operation:

- initiating and denial entry;
- callback and linking path;
- destination allow-list and default;
- Runtime mode/source;
- fresh/remembered policy;
- linking permission;
- authorization kind;
- audit namespace and event names.

### 14–20. Policy and security preservation

14. Administrator policy remains fresh-only, returns only under `/admin`,
    uses existing interactive linking, creates the same Better Auth session,
    and relies on live `admin_authorizations`.
15. Judge policy remains remembered-capable for returning links, fresh-only
    for creating a link, returns only under `/judge`, and relies on live
    event-scoped `judge_authorizations`.
16. First-time linking still requires current authoritative fresh evidence,
    Better Auth authentication, and explicit confirmation. Linking grants no
    role.
17. Pending linking remains locked to the exact authenticated Better Auth
    user and session. Account changes fail with `account_changed`.
18. Login and link transactions retain independent SHA-256 browser-binding
    digests. Raw binding values are HTTP-only cookies and are not logged.
19. Callback transaction consumption remains atomic and one-time. Replays,
    expired rows, consumed rows, missing rows, malformed operations, and
    browser mismatches fail closed.
20. Linking cancellation remains one-time, creates no link, clears temporary
    cookies, and preserves independent Better Auth authentication.

Return candidates remain normalized before persistence:

- admin only under `/admin`;
- judge only under `/judge`;
- cross-role, absolute, malformed, and scheme-relative values fall back to
  the operation default.

### 21. Audit behavior

Judge intent remains sanitized at application level:

- `judge_viby_login_started`;
- judge-specific denial, fresh-step-up, link, success, remembered-login, and
  cancellation events after server-side operation dispatch.

The Runtime launch uses the compatible admin source only as protocol context;
it does not change audit attribution or grant administrator access. No audit
event includes raw assertion IDs, callback state, cookies, Runtime subjects,
tokens, passwords, or biometric information.

### 22–30. Automated validation

22. Final focused contract/security set: **34 passed across 4 files**.
    The narrower B.4.4A/operation-policy set passed **13/13**.
23. Full unit suite against an explicitly disposable database:
    **245 passed across 34 files**.
24. Desktop Chromium:
    - complete Phase B matrix: **10 passed**;
    - B.4.4 judge subset: **4 passed**.
25. Mobile Chromium:
    - complete Phase B matrix: **10 passed**;
    - B.4.4 judge subset: **4 passed**.
26. Administrator regression:
    - Better Auth Phase B desktop/mobile flows passed;
    - dedicated legacy/admin Chromium suite passed **23/23**;
    - password, Runtime, linking, replay, logout, agent attribution, and
      public-route boundaries passed.
27. WebKit was attempted but could not launch because this host lacks
    `libmanette-0.2.so.0` and `libhyphen.so.0`. This is untested, not passed.
28. Standalone TypeScript: passed with zero errors.
29. Next.js 16.2.12 production build: passed, including TypeScript and all
    **38** routes. The removed judge callback is absent from the route
    manifest. The existing optional GitHub OAuth warning remains.
30. Changed-file ESLint: passed with zero errors or warnings.

One stale administrator Playwright expectation was corrected to the already
qualified current UI text, `Sign-in is temporarily unavailable.` The
application UI was not changed.

### 31–33. Data and scan validation

31. The B.4.4 additive migration ran twice on an online disposable
    canonical-shape copy; both runs reported valid schema and demonstrated
    idempotence.
32. Disposable integrity checks:
    - SQLite integrity: `ok`;
    - foreign-key violations: `0`;
    - duplicate assignment pairs: `0`;
    - duplicate score pairs: `0`;
    - profiles: `3`;
    - assignments: `15`;
    - scores: `12`;
    - judge authorizations: `1`.
33. Validation passed:
    - `git diff --check`;
    - private-key and credential-pattern scan;
    - sensitive logging/output scan;
    - generated attribution/co-author/sign-off scan;
    - agent/artifact callback diff check;
    - scoring, assignment, same-origin, freeze, and interactive-linking
      boundary diff check.

The only scan match was the literal sanitized audit event name
`viby_admin_assertion_denied`; no raw assertion value was logged.

### 34. Production-state exception

The application release, service PID, configuration, identity links,
authorizations, profiles, assignments, scores, and sessions were unchanged.
The main database file remained unchanged and all foreign keys remained valid.

However, the first unscoped `npm test` invocation imported the default
canonical database. One existing judge API test mocked the judge store but
not the audit repository, causing exactly one sanitized test-generated
`judge_access_denied` audit row at `2026-07-30 18:41:51 EDT`, with reason
`missing_judge_profile`.

No identity, link, session, grant, profile, assignment, or score changed.
The audit row was not deleted because doing so would be another unapproved
canonical mutation. Test isolation was corrected by mocking `logJudgeAudit`,
and the entire 245-test suite was rerun with `DB_FILE_NAME` forced to a
disposable database. The canonical WAL did not advance during that rerun.

Formal confirmation that the canonical database was entirely unchanged
cannot be given until the operator explicitly accepts or directs disposition
of that one audit-only row.

### 35. Viby unchanged

Viby was not modified, restarted, or redeployed. The only direct production
Runtime check was a non-mutating host-request page load that stopped before
identity interaction.

### 36–38. Proposed deployment and live qualification

36. Proposed corrected immutable application release:
    `2d7c6eca724292ae9f9fb5394f358b125cabd802`.
37. Exact rollback release:
    `a03986974ad5ab03453990f7b7f3444e29773b3c`, retaining `hybrid`.
38. After a new explicit deployment approval and operator disposition of the
    audit row, live requalification must run in this order:

    1. signed-out `/judge`;
    2. `Continue with Viby`;
    3. verify Runtime accepts callback `/admin/viby/callback`, mode `admin`,
       and source `vibe_admin_confirmation`;
    4. cancel before linking and verify no link/session;
    5. start again with the explicitly named approved Viby profile;
    6. require fresh verification for the unlinked identity;
    7. authenticate the approved Ada Better Auth account;
    8. inspect the explicit confirmation and confirm;
    9. verify the role-neutral link and unchanged authorization count;
    10. verify active judge authorization and assigned submissions;
    11. deny an unassigned submission;
    12. log out and deny protected routes;
    13. perform returning remembered login with the same linked profile;
    14. replay the consumed callback and verify rejection;
    15. perform account-switch rejection if a second account is explicitly
        approved;
    16. test authenticated no-role denial if an approved account exists;
    17. regress administrator password login;
    18. regress administrator Viby login;
    19. test combined-role switching only if an approved combined-role
        account exists.

    Stop immediately on callback path, source, or mode rejection.

### 39. Remaining risks and gate

1. The single test-generated canonical audit row needs explicit operator
   disposition. It is non-authorizing and contains sanitized metadata only,
   but violates this phase's no-canonical-mutation boundary.
2. The corrected contract has been accepted by an unchanged production
   Runtime page and fully exercised against a production-exact registry mock,
   but real identity login remains a post-deployment qualification.
3. WebKit remains unavailable on this host.
4. The legacy judge credential path remains intentionally enabled in hybrid
   mode; B.4.5 must not begin.

The application correction itself is locally qualified. The formal
redeployment gate is withheld solely because production cannot be reported
as completely untouched after the audit-row test-isolation incident.

NO-GO
