# Phase B.4.7 — Generic Login, Role-Aware Landing, and Unified Authentication Entry

Date: 2026-07-31  
Host: paui  
Branch: `phase-vh-m6-viby-better-auth-session`

## Repository and deployment state

- Starting repository HEAD: `de392c36b30fc89ff41f4f0742c14b83a58ece99`
- Deployable application commit: `e59c2140ddf69a5a382f3008c302373897ecbc05`
- Final repository HEAD: `8d4bb83bcd40052839232e3c31c6251c735b6c90`
- Previous release: `4c039de76bccc67d591749134c408afbd4874421`
- Previous PID: `2976538`
- Deployed release: `e59c2140ddf69a5a382f3008c302373897ecbc05`
- Final PID: `3249941`
- Final process start: `2026-07-31 19:21:39 EDT`
- Service: `vibe-hackathon.service`, active/running
- Effective administrator mode: `better-auth`
- Runtime: `https://viby.keit.ai` (unchanged)
- Backup: `/opt/vibe-hackathon/backups/local.db.pre-b47-20260731T231839Z.sqlite`
- Backup SHA-256: `65547db69c0e7b74dee7e727c70b50b5ee3e5c3e5e882b95b2ab9f94f9ab6476`

Local and public health both returned HTTP 200 and `{"status":"ok","database":"ok"}` after cutover. The immutable release directory is `/opt/vibe-hackathon/releases/e59c214` and its `.release-commit` matches the deployed commit.

## Information architecture and design

The Impeccable Design skill was applied before implementation. The existing Vibe visual language was retained: the new `/login` surface is a centered, quiet authentication card with one obvious primary action, a secondary password path, and a small contextual banner only when a protected destination requires it. Admin and judge entry routes are thin guards rather than duplicate forms. The Account page remains the neutral authenticated home.

This keeps the cognitive model simple:

1. Authenticate once as the application user.
2. Resolve live roles after authentication.
3. Land at the authorized destination, or use Account when no single role destination is obvious.

No new visual role selector or authentication terminology was introduced. The existing global account control remains display name plus Log out. Desktop and mobile use the same navigation component and account control.

## Authentication flow before and after

Before this phase, authentication began from role-specific `/admin` and `/judge` pages. After this phase:

```
/login
  ├─ Continue with Viby → application_login transaction → Better Auth session
  └─ email/password     → Better Auth session
                              ↓
                       application principal
                              ↓
                live admin/judge authorization
```

`application_login` is an explicit server-owned transaction operation alongside `admin_login` and `judge_login`. It uses the already registered Runtime contract: callback `/admin/viby/callback`, source `vibe_admin_confirmation`, and mode `admin`. The browser cannot select the operation, role, authorization, event, or return destination.

Returning generic Viby login allows remembered Runtime SSO. An unlinked remembered identity is restarted with authoritative fresh verification before the role-neutral link can be created. Linking preserves the current Better Auth account and grants no role.

## Navigation changes

Signed-out public navigation contains Status, Projects, AI Evals, Winners, Submit, and Log in. Authenticated public navigation contains the same public links, the compact account control, and role links only when live authorization resolves that role. Authentication alone never exposes Admin or Judge navigation.

`/admin` and `/judge` now act as protected entry points:

- anonymous users are sent to `/login?returnTo=...`;
- authorized users go directly to their dashboard;
- authenticated-but-unauthorized users receive the existing denial outcome and a clear Use another account path.

The Account page’s signed-out action now points to the generic login entry.

## Landing decisions

`landingForPrincipal()` applies these rules:

- administrator only → `/admin/dashboard`;
- judge only → `/judge/dashboard`;
- administrator + judge → `/account`;
- authenticated user with neither role → `/account`.

An allowlist-backed `safeLoginReturnTo()` accepts only internal account, admin, judge, and login paths (including protected dashboard/submission descendants). External URLs, protocol-relative URLs, unknown routes, and malformed values fall back to `/account` or `/login` as appropriate.

## Account and role-aware UX

The Account page is the neutral identity hub for users without a single destination. It continues to show identity, password, sessions, linked Viby state, and read-only access. Dual-role users can open either dashboard from Account. Authorization remains exclusively in `admin_authorizations` and `judge_authorizations`; no role is stored in Better Auth or inferred from identity links or provenance.

## Database migration and preservation

The additive generic-login migration was run twice against a disposable live-shape copy and twice against the canonical database. The second run reported the schema already current. Foreign-key checks were empty after both rehearsals and production migration.

Canonical counts before and after deployment:

| Data | Before | After |
| --- | ---: | ---: |
| Judge profiles | 3 | 3 |
| Assignments | 15 | 15 |
| Scores | 12 | 12 |
| Judge authorizations | 1 | 1 |
| Administrator authorizations | 1 | 1 |
| Viby identity links | 2 | 2 |

No assignment, score, authorization, or identity-link rows were created by the migration. `PRAGMA foreign_key_check` returned no rows.

## Validation

- Full unit suite: **229/229 tests passed** across 36 files.
- Focused generic-login/principal tests: **17/17 passed**.
- Generic-login browser suite: **4/4 passed** (desktop Chromium and mobile Chromium).
- Phase B administrator/judge/account browser suite: **14/14 desktop Chromium** and **14/14 mobile Chromium**.
- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed with the production environment loaded; the release artifact contains the exact deployable commit.
- Changed-file ESLint: passed with two pre-existing `no-img-element` warnings in `components/Nav.tsx` and no errors.
- `git diff --check`: passed.
- Disposable migration: first run succeeded; second run idempotent.
- Canonical migration: first run succeeded; second run idempotent.
- Foreign-key validation: passed.
- Secret/sensitive-output review: no credentials, password values, cookies, assertions, or Runtime tokens were added to source, tests, or this report.
- Impeccable design detector: returned no findings.

WebKit was not included in the new B.4.7 config; the repository’s existing WebKit path remains subject to the host’s previously documented missing WebKit libraries. Chromium desktop and mobile are the qualification gates for this deployment.

Screenshots captured from the deployed release:

- [Generic login — desktop](screenshots/phase-b47-login-desktop.png)
- [Generic login — mobile](screenshots/phase-b47-login-mobile.png)

## Production smoke qualification

- Anonymous `/admin` redirected to `/login?returnTo=/admin/dashboard`.
- Anonymous `/judge` redirected to `/login?returnTo=/judge/dashboard`.
- `/login` rendered the role-neutral copy and Continue with Viby action; the development “Open Viby Identity in New Tab” control was absent.
- The approved Ada Better Auth judge account (`judgeada@fff.ad`) signed in through the generic password form, reached `/judge/dashboard`, reached Account, and logged out. After logout, a direct judge dashboard request returned to generic login. The password was not recorded.
- Public and local health were HTTP 200 after restart.

Live administrator password and human Viby profile-selection checks were not repeated in this deployment because no separate approved administrator credential or human Viby test window was supplied. Existing administrator/Viby regression remains covered by the passing Phase B browser suite; a human Viby smoke pass is the remaining operational follow-up before declaring the phase fully human-qualified.

## Deployment and Viby status

Only `vibe-hackathon.service` was restarted. The prior listener PID `2976538` was replaced by PID `3249941`; startup logs show Next.js Ready. Viby was not restarted, modified, redeployed, or reconfigured.

## Remaining follow-up

1. Run an operator-led human smoke pass for one authorized administrator using password and Viby.
2. Run an operator-led human Viby identity-selection pass if required for the next release review.
3. Keep the generic application-login operation as the sole normal entry path; retain role-specific paths only as protected entry guards.

## Final disposition

NO-GO — deployment and automated qualification passed, but a separately approved human administrator/Viby live qualification was not available during this cutover.
