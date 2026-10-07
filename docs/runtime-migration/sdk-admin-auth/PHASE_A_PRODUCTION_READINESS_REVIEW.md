# Phase A Production-Readiness Review

## Executive summary

**Original review recommendation: NO-GO**

Resolution note: the browser-origin false positive, neutral Better Auth
provenance, and local SQLite migration-target/schema validation findings have
since been corrected on the Phase A branch. This document remains the original
review record; current validation results belong to the correction report.

The architecture is directionally sound: Better Auth owns password sessions,
Vibe Hackathon owns authorization, live role checks provide immediate
revocation, and the qualified Viby path remains structurally separate.

However, the branch is not ready to merge or deploy because the required
browser regression suite currently fails:

- 17 browser tests run
- 7 passed
- 10 failed

More importantly, the new password-login browser test does not actually
validate invalid credentials. Better Auth rejects the test origin as invalid,
and the test passes by accepting the generic “temporarily unavailable”
response. This creates false confidence in the primary new feature.

No implementation source files were modified during this review. The generated
browser-test results were removed afterward. The protected database backup
remains untouched.

## Critical issues

### High — Browser qualification is failing and the password test is a false positive

Files:

- `playwright.config.ts`
- `tests/playwright/viby-admin-auth.spec.ts`

Evidence:

- Better Auth logged: `Invalid origin: http://localhost:3200`.
- The invalid-password test still passed because it accepts the generic
  authentication-service failure message.
- Ten browser tests failed, including:
  - Viby launch
  - successful Viby login
  - non-allowlisted Viby denial
  - Viby callback-state scenarios
  - logout
  - expired/wrong-audience assertion handling
  - agent-attribution success and rejection

Several failures are stale selectors—such as expecting `Confirm with Viby`
instead of the new dual-login label, and expecting logout to be a link. Others
return `invalid_callback_state`, so the browser regression run does not
presently prove that the qualified Viby flow survived intact.

Required correction:

1. Give the Playwright server an explicit Better Auth URL matching the browser
   origin.
2. Make the password test assert a real invalid-credentials response, not an
   availability fallback.
3. Update obsolete UI selectors.
4. Repair the Viby test setup so callback state is generated through the
   supported launch flow.
5. Require the complete browser suite to pass against a disposable database.

This is a testing/configuration correction, not an architectural redesign.

## High-priority improvements

### Better Auth sessions are incorrectly labeled as email/password sessions

File:

- `lib/admin-principal.ts`

Every Better Auth session is reported as:

```text
identity_method: email_password
```

But the same Better Auth instance still supports GitHub OAuth. An explicitly
authorized user could therefore enter through GitHub while audit/UI data claims
password authentication.

This does not grant admin privileges solely through GitHub—an explicit active
admin grant is still required—but it misrepresents authentication provenance
and broadens the meaning of “password admin.”

Recommended correction:

- Use a neutral value such as `better_auth_session`, or
- derive the provider using a supported Better Auth mechanism.

Do not inspect private Better Auth internals.

### Production rate-limit identity is not explicitly bound to the trusted Cloudflare client-IP header

File:

- `lib/auth.ts`

Better Auth rate limiting is enabled in production, but the configuration does
not define the trusted IP header or trusted proxy behavior. Behind Cloudflare,
the default forwarded-IP handling can collapse requests into a shared bucket
when the forwarded chain is not accepted.

That is fail-restrictive for brute force but can cause login availability
problems and misleading enforcement.

Before deployment:

- configure the documented trusted client-IP header for the actual Cloudflare
  topology;
- verify spoofed headers are ignored at the application boundary;
- test the password endpoint’s normal and 429 behavior.

References:

- Better Auth rate limiting:
  `https://better-auth.com/docs/concepts/rate-limit`
- Better Auth security guidance:
  `https://better-auth.com/docs/reference/security`

### Migration can create a new empty database for a mistyped target

File:

- `scripts/migrate-admin-auth.ts`

`new Database(target)` opens the configured path before verifying that the
intended database exists. With a mistyped path, SQLite can create an empty file
before the migration fails.

It would not mutate the actual operator database, but it can create a misleading
artifact and complicate recovery.

Required correction:

- require the target to exist and be a regular non-symlink file before opening;
- verify the expected Better Auth schema is present;
- validate the final table columns, constraints, and indexes rather than
  assuming `CREATE IF NOT EXISTS` proves readiness.

### Missing production-representative browser coverage

The current tests do not meaningfully demonstrate:

- valid password-admin browser login;
- valid Better Auth session plus active admin grant;
- authenticated user without a grant;
- live role revocation blocking both page and API;
- password-admin logout;
- login as a second password account;
- stale Better Auth cookie;
- conflicting Better Auth and Viby identities;
- revoke CLI behavior.

These were explicit Phase A requirements and should be added before deployment.

## Nice-to-have improvements

### Audit context for authorization denial

An authenticated Better Auth user without an admin grant produces a sanitized
denial event, but the resolver discards its candidate identifier. The audit
trail therefore cannot reliably correlate repeated authorization denials by the
same authenticated user.

Add a derived, non-reversible audit identifier without logging email, session
tokens, or cookies.

### Provisioning password-file lifecycle

The provisioning workflow correctly requires a regular, non-symlink,
owner-controlled file with restrictive permissions. The operator must still
remove that plaintext password file manually.

The documentation should make post-success destruction a mandatory, verified
step.

### Revoke CLI integration coverage

Role revocation is enforced live and appears correct, but the actual operator
revoke command lacks real command-level integration coverage. Add idempotence,
unknown-user, already-revoked, and immediate page/API denial tests.

## Architecture assessment

The core separation is correct:

- Better Auth authenticates password users and owns their session.
- `admin_authorizations` grants the application-owned admin role.
- Role checks are live on protected pages and APIs.
- Viby continues to authenticate through the qualified custom session.
- Simultaneously authorized Better Auth and Viby sessions fail closed.
- Agent and artifact callbacks remain provenance flows and do not create Better
  Auth sessions.
- Judge and team-owner authorization domains remain separate.

The central resolver is a good transitional boundary. It avoids deriving admin
authority from email, Better Auth account existence, GitHub ownership, or team
ownership.

## Security assessment

### Authentication

- Password hashing: owned by Better Auth.
- Signup: disabled.
- Password length: 12–128.
- Account-enumeration resistance: UI errors are generic.
- Session creation/logout: supported Better Auth APIs are used.
- Session fixation: no custom password session is created, but an explicit
  browser test is missing.
- Brute-force controls: enabled but proxy/IP configuration needs correction.
- Concurrent sessions: allowed by Better Auth; live role revocation blocks all
  from admin access.
- Conflicting Viby and Better Auth principals: denied safely.

### Authorization

- Explicit durable grant required.
- Unique grant per Better Auth user.
- Active/revoked lifecycle is represented.
- Live revocation applies to pages and APIs.
- GitHub/team ownership does not imply admin authority.
- User deletion cascades through the configured foreign keys.

### Database

- Additive migration.
- Unique admin grant per user.
- Unique credential account per user.
- Foreign-key cascade from user deletion is intentional.
- Migration is transactionally applied locally.
- Target-file existence and existing-schema validation need hardening.

### Privacy

No password, password hash, session cookie, assertion, or credential leakage
was found in the changed diff. The secret and attribution scans passed.

## Dependency risk disposition

Production audit result: **8 affected package labels, representing 5 distinct
advisories**.

| Package/path | Severity | Production reachability | Disposition |
|---|---:|---|---|
| `esbuild@0.18.20` through deprecated `@esbuild-kit/*` / Drizzle Kit | Moderate | Development/devOptional tooling; esbuild development server is not exposed | Accepted temporarily; remove deprecated loader path in dependency-hardening phase |
| `postcss@8.4.31` under Next | High | Production dependency, but the application does not process attacker-controlled CSS | Accepted temporarily with explicit reachability assessment; remediate when Next supports a compatible fixed PostCSS |
| `sharp@0.34.5` under Next | High | Installed, but no `next/image` or direct Sharp processing path was found; project images use ordinary `<img>` rendering | Accepted temporarily; prohibit adding untrusted image optimization until patched |
| `better-auth` audit label | Moderate | Aggregated from its optional Drizzle Kit and Next paths; no separate Better Auth advisory identified | Track the underlying package findings |
| `next` audit label | High | Aggregated from PostCSS and Sharp; no additional distinct advisory in this audit result | Track the underlying package findings |

Official advisories:

- esbuild development-server advisory:
  `https://github.com/advisories/GHSA-67mh-4wv8-2f99`
- PostCSS line-return XSS:
  `https://github.com/advisories/GHSA-qx2v-qp2m-jg93`
- PostCSS source-map file disclosure:
  `https://github.com/advisories/GHSA-6g55-p6wh-862q`
- PostCSS source-map path traversal:
  `https://github.com/advisories/GHSA-r28c-9q8g-f849`
- Sharp image-processing advisory:
  `https://github.com/advisories/GHSA-f88m-g3jw-g9cj`

None appears exploitable through the application’s currently implemented
production paths. They require explicit owner acceptance and a bounded
follow-up dependency phase, but they are not the reason for the current NO-GO.

## Validation results

| Validation | Result |
|---|---|
| Branch/HEAD | Correct |
| Base `main` / `origin/main` | `65615e5d...` |
| Protected backup | Present and untouched |
| Unit suite | **156/156 passed** |
| Production build | Passed |
| Build TypeScript phase | Passed |
| Clean standalone TypeScript | Passed during implementation qualification |
| Focused lint | Changed files passed; unrelated dashboard lint remains |
| `git diff --check` | Passed |
| Secret scan | Passed |
| Attribution scan | Passed |
| Browser suite | **Failed: 7 passed, 10 failed** |
| Password invalid-credential browser proof | Invalid; exercised origin rejection instead |
| Working tree after review | Only protected untracked backup remains before this report was saved |

No deployment, migration, merge, push, or production modification occurred.

## Deployment checklist

After the corrections pass review:

1. Freeze the exact candidate SHA.
2. Stop application access for the migration window.
3. Record production release, service state, listener, database path, and
   database digest.
4. Create a timestamped, protected SQLite backup.
5. Verify the explicit database target exists and matches the recorded operator
   database.
6. Run the additive admin-auth migration with the exact target-bound
   confirmation.
7. Validate tables, indexes, foreign keys, and duplicate-account checks.
8. Provision the intended password user through the operator workflow.
9. Verify credential account creation without exposing the password.
10. Grant the explicit application admin authorization.
11. Securely destroy the password input file.
12. Build an immutable release from the merged commit.
13. Atomically switch the release symlink.
14. Restart only the application service.
15. Verify startup, health, listener ownership, logs, and restart stability.
16. Run password, Viby, logout, conflict, revocation, agent, and artifact
    checks.
17. Retain the prior release and database backup through the rollback window.

## Manual production qualification

### Password login

- Valid authorized admin reaches the dashboard.
- Valid user without an admin grant is denied.
- Invalid password returns a generic error.
- Unknown email is indistinguishable from a wrong password.
- Revoked admin grant blocks the next page and API request.
- Logout terminates the Better Auth session.
- Refresh and browser Back do not restore dashboard access.
- A second account can log in cleanly after logout.
- Expired/stale Better Auth cookies do not authorize.

### Viby login

- Existing allowlisted Viby admin still reaches the dashboard.
- Viby logout clears the application session.
- Viby callbacks retain state, replay, audience, and mode validation.
- Viby logout does not globally log the user out of shared Viby.

### Mixed sessions

- Better Auth alone works.
- Viby alone works.
- Two simultaneously authorized, unlinked identities are denied.
- Logout clears both application session types.
- Stale Viby plus valid Better Auth behaves deterministically.
- Stale Better Auth plus valid Viby behaves deterministically.
- Role revocation remains immediate across refresh and browser restart.

### Callbacks

- Agent attribution succeeds.
- Human/wrong-mode agent assertion is rejected.
- Replay is rejected.
- Artifact attribution succeeds.
- Wrong audience/origin/state is rejected.
- Neither callback creates a Better Auth admin session.

### Operations

- Migration rerun is idempotent.
- Duplicate grants and credential accounts are rejected.
- Provisioning rerun reports retained state safely.
- Revocation rerun is idempotent.
- No password file remains after provisioning.
- Database backup and rollback instructions are verified.

### Recovery

- Previous release remains available.
- Migration backup passes SQLite integrity checks.
- Restoring the old database and old release is rehearsed.
- Old release compatibility with the additive schema is confirmed.
- A failed first login does not trigger ad hoc database changes.

## Merge recommendation

Do not merge yet.

After the bounded corrections:

- retain the existing six commits;
- add focused correction commits for browser qualification, proxy-aware rate
  limiting, authentication provenance, and migration target validation;
- do not reorder or squash until review is complete.

For final integration, a normal merge preserving the phase-oriented history is
preferable. Squashing is unnecessary unless repository policy explicitly
requires it.

## Scores

| Area | Score |
|---|---:|
| Architecture | 8.0 |
| Security | 7.0 |
| Authentication | 6.5 |
| Authorization | 8.5 |
| Migration | 6.5 |
| Testing | 5.5 |
| Documentation | 8.0 |
| Deployment | 7.0 |
| Rollback | 7.5 |
| Maintainability | 7.5 |
| **Overall production readiness** | **6.8** |

## Remaining future phases

- Viby SDK adoption.
- Viby-to-Better-Auth identity linking.
- Unified Viby and Better Auth sessions.
- Retirement of `vibe_admin_session`.
- Password recovery/invitation lifecycle.
- Dependency remediation for the accepted PostCSS, Sharp, and deprecated
  loader paths.

## Final decision

**NO-GO**

The implementation needs a small, bounded correction pass. The main blocker is
unreliable browser qualification—not an architectural failure.
