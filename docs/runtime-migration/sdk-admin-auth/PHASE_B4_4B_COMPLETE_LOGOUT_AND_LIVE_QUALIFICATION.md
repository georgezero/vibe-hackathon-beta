# Phase B.4.4B — Complete Logout and Live Qualification

Status: human Viby qualification in progress.

## Repository and deployment state

- Host: `paui`.
- Repository:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
- Branch: `phase-vh-m6-viby-better-auth-session`.
- Starting repository HEAD:
  `da5d1ed6bb9a4ace8a1867486fd8cd3a10079778`.
- Application commits:
  - `e06d6096fe1f380a3deb6244baafc70075c237bc`
    (`auth: complete logout and account switching`);
  - `e03f726143d5cf2436d13fbd7fa4d99c53b16988`
    (`auth: require fresh Viby login for signed-out judges`).
- Previous production release:
  `a5d66540b8099fa5ec1cf0d2332a979e9a768693`.
- Previous PID and start:
  `21832`, `2026-07-30 21:29:23 EDT`.
- Deployed release directory:
  `/opt/vibe-hackathon/releases/e03f726143d5cf2436d13fbd7fa4d99c53b16988`.
- Current production PID and start:
  `225509`, `2026-07-30 22:46:51 EDT`.
- Startup: Next.js `16.2.12`, `Ready in 185ms`, restart count `0`.
- Effective modes: judge `hybrid`; administrator `better-auth`.
- Rollback release:
  `a5d66540b8099fa5ec1cf0d2332a979e9a768693`.

The source worktree was clean except for the protected untracked
`local.db.pre-p0-4.bak` before packaging. The protected backup was not read,
modified, staged, or included.

## Defect reproduction and root cause

The observed sequence was:

1. an administrator held a valid Better Auth application session;
2. the visible logout was selected;
3. a routine judge Viby login was started;
4. Runtime remembered SSO returned the previously selected Viby identity;
5. the role-neutral link resolved that identity to the administrator's Better
   Auth user;
6. the callback created a new normal Better Auth session for that user;
7. the live event-scoped judge lookup correctly denied the administrator.

The denial was therefore security-correct. The confusing stale-account
appearance was primarily upstream remembered identity reuse followed by a new
application session, rather than authorization leakage. The previous logout
implementation also spread cookie cleanup across several routes and relied on
Better Auth's response plus incomplete route-specific deletions, making it
hard to prove that every application-owned transient and legacy cookie was
cleared.

Application and Runtime sessions are deliberately separate. Live testing made
clear that allowing remembered Runtime SSO after application logout was
technically correct but unintuitive: the previous Runtime identity immediately
created a new Better Auth session. The final policy therefore requires fresh
Viby verification whenever signed-out access to the protected judge flow is
started. Deliberate account switching uses the same freshness boundary through
a distinct server-owned transaction.

## Implementation

### Better Auth invalidation and cookies

`lib/application-logout.ts` is now the common application logout boundary for
administrator and unified judge logout routes. It:

- calls `auth.api.signOut()` to invalidate the current server-side Better Auth
  session;
- forwards Better Auth's exact `Set-Cookie` response;
- expires the production and development Better Auth cookie variants owned by
  this application, including session-data/account-data chunks found on the
  request;
- clears the bounded legacy administrator and judge cookies;
- clears application callback, browser-binding, handoff, and interactive-link
  cookies;
- uses root path, epoch expiry, and `Max-Age=0`, with `Secure` retained for
  `__Secure-` cookies;
- emits private, non-cacheable logout responses;
- leaves unrelated origin cookies untouched;
- is idempotent.

The common boundary is used by:

- `POST /admin/logout`;
- `POST /judge/logout`;
- the Better Auth branch of `POST /api/judge/logout`;
- the new account-switch route.

### Fresh account switching

`POST /judge/switch-account`:

- requires the existing strict same-origin check;
- creates a `judge_login` transaction with `freshness_required=true`;
- records `account_switch` as sanitized application audit intent;
- uses the registered Runtime callback `/admin/viby/callback`;
- uses source `vibe_admin_confirmation` and mode `admin`;
- invalidates the old Better Auth application session;
- clears old application authentication state while preserving only the newly
  issued browser-binding cookie;
- redirects with HTTP 303 so a form POST reaches Runtime as a GET.

The transaction, not browser parameters, owns operation, freshness, return
destination, browser binding, and post-callback judge policy. The former
browser-controlled `link=1` step-up signal was removed. Remembered evidence
cannot satisfy the signed-out judge transaction or create an identity link.

Signed-out judge login, account switching, and first-link verification all use
`forceIdentityCheck=true`. A valid Better Auth session with live judge
authorization navigates directly without any Runtime request. Viby callback,
source, and mode contracts are unchanged.

### UI and cache behavior

The authenticated-but-unauthorized judge page now presents one explanation
and a clear `Use another account` action. It no longer renders two equivalent
warning boxes. Logout redirects are non-cacheable, and the next server request
resolves the application principal from the invalidated Better Auth session.
The shared account control remains role-neutral; after logout it is absent.

### Role boundaries

The change creates no identity link, administrator authorization, judge
authorization, assignment, or score. Administrator and judge authorization
remain independent and live. Callback operation is still exclusively loaded
from the opaque one-time transaction. Browser input cannot select role,
operation, event, freshness, or authorization target.

## Automated qualification

All tests ran against explicitly disposable databases:

- test-isolation executable: passed; missing configuration rejected,
  disposable audit write isolated, canonical database unchanged;
- full unit suite: **249/249 passed** across 35 files;
- focused authentication suite: **64/64 passed** across 8 files;
- Phase B desktop/mobile Chromium: **22/22 passed**;
- dedicated administrator Chromium: **23/23 passed**;
- new browser regression covers admin-only sign-in, unauthorized judge state,
  server-session deletion, fresh Runtime launch, judge identity replacement,
  role separation, logout, account-control disappearance, and protected-route
  denial;
- standalone TypeScript: passed;
- changed-file ESLint: passed;
- Next.js production build: passed, including `/judge/switch-account`;
- `git diff --check`: passed;
- private-key, credential-pattern, sensitive-output, and attribution scans:
  passed;
- WebKit: not run because the host still lacks
  `libmanette-0.2.so.0` and `libhyphen.so.0`; this is untested, not passed.

The B.4.4 migration ran twice on an online disposable canonical-shape copy.
Both runs passed. Disposable validation:

- profiles / assignments / scores: `3` / `15` / `12`;
- judge authorizations: `1`;
- duplicate assignment pairs: `0`;
- duplicate score pairs: `0`;
- SQLite integrity: `ok`;
- foreign-key violations: `0`.

Before and after the complete local qualification, the canonical logical
SHA-256 was exactly:

`87367240ead74e3350ff0151668fbd417883b59efb115817fb41c892bcf7f8c6`

The matching content fingerprint included the complete ordered schema and
every row in every application table. Canonical counts were:

- audit events: `164`;
- users / accounts / sessions: `2` / `2` / `9`;
- identity links: `1`;
- administrator / judge authorizations: `1` / `1`;
- profiles / assignments / scores: `3` / `15` / `12`;
- foreign-key violations: `0`;
- integrity: `ok`.

No test process changed the canonical database.

## Backup and deployment

A fresh online backup was created before cutover:

- path:
  `/opt/vibe-hackathon/backups/local.db.pre-b44b-20260731T021900Z.sqlite`;
- mode: `0600`;
- size: `479232` bytes;
- SHA-256:
  `b74648cf97e7f54dabf5c8f86a1268595095368c0057a9eced5b88b6e537f507`.

After Ada's valid live link and before the final freshness-policy cutover, a
second online backup preserved that durable state:

- path:
  `/opt/vibe-hackathon/backups/local.db.pre-b44b-fresh-policy-20260731T024700Z.sqlite`;
- mode: `0600`;
- size: `479232` bytes;
- SHA-256:
  `c42dbd80b469d276cb289c631137722aa85bbc9916c276f485d1ef83dae70c76`.

The final application artifact was built from a clean `git archive` of
`e03f726143d5cf2436d13fbd7fa4d99c53b16988`, after a clean `npm ci`. Its
embedded `.release-commit` matches that exact commit. The existing dependency
audit result remains 5 moderate and 12 high advisories.

Only `vibe-hackathon.service` was restarted. After cutover:

- selected release:
  `e03f726143d5cf2436d13fbd7fa4d99c53b16988`;
- listener PID: `225509`;
- intermediate PID `157939` and original PID `21832`: no longer running;
- service: active/running;
- local/public health: HTTP `200` / HTTP `200`;
- judge/admin modes: `hybrid` / `better-auth`;
- canonical database path unchanged.

Anonymous production smoke checks passed:

- `/admin/dashboard` redirects to administrator sign-in;
- `/judge/dashboard` redirects to judge sign-in;
- `/judge` returns HTTP 200 and shows Viby, password, and visibly legacy
  options;
- no legacy judge session is created.

The anonymous administrator protected-route request intentionally produced one
`admin_session_rejected` audit event. It was not a unit-test event. No identity,
link, authorization, profile, assignment, or score count changed.

## Human live qualification

Completed:

- application logout removed the active Better Auth session; a subsequent
  protected administrator request was rejected;
- a routine remembered Runtime login was conclusively identified as the source
  of the immediately recreated George One Better Auth session;
- `Use another account` initiated fresh Viby verification and selected Ada;
- the explicit role-neutral Ada identity-link confirmation was displayed;
- Ada's Viby identity was linked successfully without creating authorization.

The human result motivated the final policy simplification: every signed-out
judge Viby launch is now fresh by default, while a valid authorized Better Auth
session navigates directly without Runtime.

Still pending operator execution against the final policy release:

- signed-out `/judge` using ordinary `Continue with Viby` must show fresh
  verification/profile selection without the recovery button;
- the linked Ada identity must reach the event-scoped judge dashboard;
- judge logout and direct-route denial;
- fresh return to the administrator identity;
- production-safe cancellation, replay, and browser-binding checks.

No GO disposition will be recorded until this sequence is completed without
stale-session reuse.

## Database and audit validation

Final post-human counts and audit review are pending. The expected invariant is
that profiles remain `3`, assignments remain `15`, scores remain `12`,
administrator authorizations remain `1`, and judge authorizations remain `1`.
Only intentional authentication, logout, denial, and callback audit events may
be added. No synthetic test event may enter the canonical database.

## Viby status

Viby was unchanged.

## Final disposition

NO-GO — FINAL SIGNED-OUT FRESH JUDGE AND ADMINISTRATOR RETURN LIVE QUALIFICATION PENDING
