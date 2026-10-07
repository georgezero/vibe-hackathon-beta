# Phase B.4.7A — Fresh Generic Viby Login

Date: 2026-08-01
Host: paui
Branch: `phase-vh-m6-viby-better-auth-session`

## Repository and deployment state

- Starting repository HEAD: `78772e39bd384b5cf9543bcbd0ab68532d7705ab`
- Deployable application commit: `97fc1af35d544e697d43722e79361bf4373cf9cc`
- Production release before cutover: `e59c2140ddf69a5a382f3008c302373897ecbc05`
- Production release after cutover: `97fc1af35d544e697d43722e79361bf4373cf9cc`
- Previous PID: `3249941`
- New PID: `3459351`
- New process start: `Fri 2026-07-31 21:03:51 EDT`
- Service: `vibe-hackathon.service`, active/running
- Administrator mode: `better-auth`
- Judge mode: `hybrid`
- Runtime: `https://viby.keit.ai`
- Runtime status: unchanged
- Backup: `/opt/vibe-hackathon/backups/local.db.pre-b47-20260731T231839Z.sqlite`
- Backup SHA-256: `65547db69c0e7b74dee7e727c70b50b5ee3e5c3e5e882b95b2ab9f94f9ab6476`

Local and public health returned HTTP 200 after cutover. The release directory
`/opt/vibe-hackathon/releases/97fc1af35d544e697d43722e79361bf4373cf9cc` contains
the exact deployable commit in `.release-commit`.

## Root cause

`application_login` was treated as a routine remembered-login operation. Its
policy allowed remembered Runtime SSO and the generic start helper only marked
freshness when a caller explicitly supplied an optional flag. A normal
Continue with Viby submission therefore launched without the authoritative
fresh-verification requirement, allowing Runtime to reuse the previously
remembered profile after application logout.

## Corrected transaction policy

`application_login` is now an explicit, server-owned fresh-authentication
operation:

- `routineFreshnessRequired: true`
- `rememberedLoginAllowed: false`
- callback: `/admin/viby/callback`
- mode: `admin`
- source: `vibe_admin_confirmation`
- return destinations remain allowlisted and transaction-owned
- browser binding, expiration, opaque state, and one-time consumption remain
  unchanged

The generic start helper cannot downgrade this policy. Every launch sets
`forceIdentityCheck=true` in the Runtime context and `freshIdentity=1` in the
Runtime start URL. The callback rejects a stale generic transaction whose
server-owned freshness flag is false and requires fresh assertion evidence at
confidential redemption. No remembered-session fallback was added.

## Viby operation policies

| Operation | Fresh required | Remembered allowed | Authorization |
| --- | --- | --- | --- |
| `application_login` | yes | no | none at authentication time |
| `admin_login` | yes (existing qualified policy) | no | live admin authorization |
| `judge_login` | yes (existing qualified policy) | no | live event-scoped judge authorization |
| identity linking | yes | no | current Better Auth account is preserved and locked |

Returning authenticated navigation still uses the existing Better Auth
session and does not invoke Viby. Linking remains distinct from sign-in: it
preserves the current account, requires fresh evidence, and grants no role.

## Security and callback behavior

The shared callback remains the only interactive assertion handler. Operation
dispatch is loaded from the opaque server-side transaction; callback URL,
Runtime source, query parameters, and browser input cannot select a role or
operation. Existing checks remain in force for audience, effective mode,
freshness, verification kind, timestamps, Runtime identity session, browser
binding, expiry, replay, cancellation, account locking, safe destinations,
identity-link conflicts, and live authorization.

Application logout continues to invalidate Better Auth server-side, clear
application-owned cookies and pending transaction state, clear legacy judge
state defensively, and leave an anonymous application principal. It does not
attempt to delete arbitrary Viby cookies; fresh Runtime verification is the
identity-selection boundary.

## Automated qualification

- Full unit suite: **230 tests passed** across 36 files.
- Focused fresh-policy and Runtime-contract tests: **20/20 passed**.
- Generic-login browser suite: **4/4 passed** (desktop and mobile Chromium).
- Phase B browser suite: **14/14 desktop Chromium** and **14/14 mobile Chromium**.
- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed with the production environment loaded; immutable
  artifact contains the exact deployable commit.
- Changed-file ESLint: passed (no errors; only existing `Nav.tsx` image
  warnings appear in broader lint output).
- `git diff --check`: passed.
- Test isolation regression: passed; missing test DB configuration is rejected,
  disposable audit writes stay disposable, and the canonical database is
  unchanged.
- Disposable migration: first run succeeded and second run was idempotent.
- Disposable foreign-key validation: passed with no rows.
- Production launch smoke: an origin-checked POST to `/api/viby/start` produced
  the shared callback, `source=vibe_admin_confirmation`, `mode=admin`,
  `forceIdentityCheck=true`, and `freshIdentity=1`. No assertion was redeemed
  and no identity link was created by this smoke check.

WebKit was not run; the host remains subject to the previously documented
missing WebKit libraries. Chromium desktop/mobile are the available browser
gates.

## Database and audit preservation

Canonical counts before and after deployment remained:

| Data | Before | After |
| --- | ---: | ---: |
| Judge profiles | 3 | 3 |
| Assignments | 15 | 15 |
| Scores | 12 | 12 |
| Judge authorizations | 1 | 1 |
| Administrator authorizations | 1 | 1 |
| Viby identity links | 2 | 2 |
| Better Auth users | 2 | 2 |

`PRAGMA foreign_key_check` returned no rows. No scores, assignments,
authorizations, profiles, users, or identity links changed during automated
qualification or deployment. The production smoke created no assertion,
authorization, or identity link.

## Human live qualification

The operator completed the live browser check and confirmed that signing out,
returning to `/login`, selecting Continue with Viby, and completing the fresh
Viby verification/profile-selection flow established the intended account and
worked as expected. This was performed through the real Runtime interaction;
no remembered assertion was substituted and no identity link was created by
SQL or operator tooling.

## Deployment and Viby status

Only `vibe-hackathon.service` was restarted. The old PID was replaced by
`3459351`; the service is active and local/public health are HTTP 200. The
rollback release is `e59c2140ddf69a5a382f3008c302373897ecbc05`.

**Viby was unchanged.** It was not modified, restarted, redeployed, or
reconfigured.

## Final disposition

GO — PHASE B.4.7A FRESH GENERIC VIBY LOGIN DEPLOYED
