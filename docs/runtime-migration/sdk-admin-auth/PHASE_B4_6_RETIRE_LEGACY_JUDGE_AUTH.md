# Phase B.4.6 — Retire Legacy Judge Authentication

Date: 2026-07-31

## Repository state

- Host: `paui`.
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
- Branch: `phase-vh-m6-viby-better-auth-session`.
- Starting repository HEAD: `c7f9b3c55bfd12893935cd7dcd441c97589e18e6`.
- Deployable application commit: `4c039de76bccc67d591749134c408afbd4874421`.
- Starting deployed release: `aa2ac45e98ad1c2f74f9e642a55d10ef0b0d3545`.
- Starting PID: `1942408`, started `2026-07-31 10:13:29 EDT`.
- Starting health: local and public HTTP 200.
- Merge base with `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`.
- The unrelated existing edit to `PHASE_B4_5B_INVITATIONS_AND_PEOPLE.md`
  and protected untracked files were not included.

## Authentication architecture: before and after

Before B.4.6, protected judge requests preferred the shared Better Auth
principal but could still fall back to a private judge credential, an
HMAC-signed `vibe_judge_session`, and `legacy` / `hybrid` mode branches.
Judge logout had role-specific page and API endpoints.

After B.4.6, Better Auth is the only interactive application session:

```text
Viby or password
  -> Better Auth user
  -> Better Auth session
  -> resolveApplicationPrincipal()
  -> resolveJudgePrincipal(event)
  -> live judge_authorizations
  -> assignments
  -> score ownership
```

Viby verifies identity and may establish a Better Auth session through the
qualified shared callback. It does not authorize. Identity links do not
authorize. Administrator and judge access remain independently derived from
`admin_authorizations` and event-scoped `judge_authorizations`.

## Removed legacy components

Deleted executable components:

- `app/api/judge/session/route.ts` — private credential exchange;
- `app/api/judge/logout/route.ts` — custom-cookie logout;
- `app/judge/JudgeLoginForm.tsx` — private credential UI;
- `app/judge/logout/route.ts` — judge-specific application logout;
- `app/admin/logout/route.ts` — administrator-specific application logout;
- `lib/judge-session.ts` — HMAC cookie creation and verification;
- `lib/judge-auth-mode.ts` — legacy/unified/hybrid branching;
- `lib/judge-auth-store.ts` — plaintext token verification;
- `playwright.b43.config.ts` and the legacy-cookie browser suite;
- obsolete legacy credential, session, mode, and hybrid-precedence unit tests.

The `POST /api/judge/session`, `POST /api/judge/logout`, `/judge/logout`, and
`/admin/logout` production routes no longer exist and return HTTP 404.

The production systemd `VIBE_JUDGE_AUTH_MODE=hybrid` override and the shared
`VIBE_JUDGE_SESSION_SECRET` entry were removed. Their values were not printed.

## Shared guards, sign-in, and logout

`requireAuthorizedJudgePage()` remains as a stable thin page boundary, but it
now unconditionally calls `resolveJudgePrincipal()` for the canonical event.
`withJudgeApi()` remains the centralized API boundary for judge data and score
mutations, but has no credential-cookie or mode branch. Signed-out requests are
401, authenticated unauthorized requests are 403, malformed principal state
fails closed, and same-origin enforcement remains after authentication and
authorization.

Administrator and judge sign-in pages now share:

- `AuthenticationIntro`;
- `InteractiveSignInCard`;
- `PasswordSignInForm`.

Both pages have the same spacing, typography, icon language, error hierarchy,
Viby primary action, password secondary action, loading/error states, and
responsive structure. Only role-specific title, access copy, flow operation,
and callback destination differ. The legacy private-credential card is gone.

`POST /logout` is the single global application logout. It uses the existing
qualified Better Auth invalidation helper, clears application-owned transient
state, redirects to the public application, and records role-appropriate audit
events. The global desktop and mobile account controls both use it.

## Account switching and identity linking

Phase B.4.5C behavior is unchanged:

- `Continue with Viby` invalidates the current Better Auth session before a new
  fresh server-owned transaction is created;
- administrator and judge operations remain explicit and transaction-derived;
- `Link identity` preserves and locks the current Better Auth account;
- callback browser binding, account locking, expiry, cancellation, replay
  rejection, safe destinations, and authoritative freshness remain intact;
- neither authentication nor linking creates authorization.

## Database and compatibility

No schema migration was introduced and no destructive database change was
made. The existing `judges.token` column remains inert historical schema data;
no production code reads or verifies it. The literal historical cookie name
`vibe_judge_session` remains only as a defensive logout tombstone so a cookie
issued by an older release is explicitly expired. It is never decoded or used
for authentication. These are the only intentional compatibility remnants.

Canonical counts before qualification:

- users/accounts/sessions: `2` / `2` / `9`;
- administrator/judge authorizations: `1` / `1`;
- Viby identity links: `2`;
- judge profiles/assignments/scores: `3` / `15` / `12`;
- audit events: `221`.

Canonical content SHA-256 before and after automated qualification:
`65547db69c0e7b74dee7e727c70b50b5ee3e5c3e5e882b95b2ab9f94f9ab6476`.
The file modification time and size were unchanged. Integrity was `ok` and
foreign-key violations were `0`.

The latest additive migration was run twice on a disposable canonical-shape
copy. Both runs reported zero automatic rows and passed foreign-key checks.
Profiles/assignments/scores remained `3` / `15` / `12`.

## Automated validation

- Focused retirement/authentication tests: `55/55` passed across 9 files.
- Full unit suite: `224/224` passed across 35 files.
  The prior raw total included 45 tests for the deleted legacy credential,
  HMAC session, and hybrid modes. They were intentionally removed rather than
  silently skipped; new retirement tests prove those entry points are absent.
- Phase B Chromium desktop/mobile: `28/28` passed.
- Administrator Chromium: `24/24` passed.
- Focused unified judge desktop/mobile visual check: `2/2` passed.
- TypeScript: passed.
- Changed-file ESLint: passed with no errors; the two existing `Nav` remote
  image advisories remain warnings.
- Production build: passed; the route manifest contains no retired endpoints.
- `git diff --check`: passed.
- Test-database isolation: missing configuration rejected; disposable audit
  write succeeded; canonical database unchanged.
- Impeccable detector: zero findings.
- Desktop/mobile visual review: passed after removing duplicated recovery copy.
- Legacy executable scan: zero findings.
- Sensitive-data and attribution scans: no committed secret or live credential.
- WebKit: attempted, but the browser cannot launch because the host lacks
  `libmanette-0.2.so.0` and `libhyphen.so.0`. No test reached application code;
  this remains a documented non-blocking host limitation.
- Immutable `npm ci` reported 9 existing dependency advisories: 5 moderate and
  4 high. No unsafe automatic dependency rewrite was performed in this phase.

## Deployment

- Backup:
  `/opt/vibe-hackathon/backups/local.db.pre-b46-20260731T212939Z.sqlite`.
- Backup mode: `0600`; size: `487424` bytes; SHA-256 matches the canonical
  predeployment database fingerprint.
- Immutable release:
  `/opt/vibe-hackathon/releases/4c039de76bccc67d591749134c408afbd4874421`.
- `.release-commit` exactly matches the deployable application commit.
- Only `vibe-hackathon.service` was restarted; Viby and unrelated services were
  not restarted.
- Final PID: `2976538`.
- Final start time: `2026-07-31 17:32:06 EDT`.
- Restart count: `0`.
- Ready: `197ms`.
- Final listener: PID `2976538` on port 3000; the prior listener is gone.
- Final local health: HTTP 200, database `ok`.
- Final public health: HTTP 200, database `ok`.

The first probe immediately after the final restart ran before Next bound the
listener and briefly observed local 000/public 502. The service reached Ready
in 197 ms and the bounded retry returned HTTP 200 locally and publicly; there
was no crash or restart.

Rollback remains the prior immutable release
`aa2ac45e98ad1c2f74f9e642a55d10ef0b0d3545`. The additive database state does
not require rollback.

## Live qualification

Production-safe smoke checks completed:

- intended immutable commit is the active listener;
- local/public health are HTTP 200;
- retired credential and logout endpoints return HTTP 404;
- no judge authentication mode or HMAC secret remains in the running service;
- database schema, counts, integrity, assignments, scores, authorizations, and
  identity links are unchanged.

Human live qualification was completed successfully by the operator after
deployment. Judge and administrator password/Viby flows, logout, account
switching, unauthorized-role handling, and the identity-link boundary behaved
as designed. The operator confirmed that the retired legacy judge flow was not
needed and that the new Better Auth-only judge path works in production.
No unapproved dual-role authorization was created merely to exercise the
dual-role case; automated principal and navigation coverage remains the
qualification evidence for that case.

## Viby status

Viby was not modified.

## Final disposition

GO — PHASE B.4.6 Legacy Judge Authentication Retired
