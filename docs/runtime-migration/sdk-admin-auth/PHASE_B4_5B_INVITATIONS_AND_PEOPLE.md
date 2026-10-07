# Phase B.4.5B — Invitations, People Management, and Authentication UX Simplification

Status: deployed and qualified
Date: 2026-07-31

## Repository state

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting repository HEAD: `38daa0718b9d8bb0c02394f4336691f0cc5ad108`
- Deployable application commit: `9d7c899de8c3729da032af8377ff183850eb2621`
- Final repository HEAD: `1c4bae4e3b4991c2c83b619e55cfc1cad256b4cf`.
  Documentation commits are `1b189ed` and `1c4bae4`; deployment intentionally
  remains pinned to the application commit above.
- Merge base with `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- Application commit: `Add invitation-based people management`
- Protected unrelated untracked paths were not accessed or committed: `.claude/`,
  `.codex/`, and `local.db.pre-p0-4.bak`.

## Information architecture and design

The Impeccable Design workflow was applied before implementation. This phase
extends the existing compact operations interface rather than introducing a
new visual language.

- The People table remains the scanning surface, with instant search and six
  single-choice filters instead of a dense query builder.
- Account creation is one focused dialog. `Create invitation link` is the
  preferred choice; a temporary password is an explicit fallback.
- Person editing remains in context in an accessible side sheet organized as
  Profile, Access, Authentication, Sessions, Audit, Invitation, Actions, and
  Account status.
- Destructive actions are separated and confirmation-gated. The sheet traps
  focus, makes the background inert, locks background scrolling, uses dynamic
  viewport height, and restores focus when closed.
- Desktop and mobile screenshots were inspected. Controls retain 44-pixel
  touch targets on mobile, dialog bodies scroll independently on short screens,
  and the complete invited email remains readable.
- The deterministic Impeccable detector returned no findings. A separate
  finish review found no P0 issue; its P1 findings were corrected before
  deployment.

This is simpler than separate edit pages because operators retain directory
context. It is safer than email/name matching because accounts, access intent,
judge profiles, and identity-link targets are selected from server-owned IDs.

## Authentication UI simplification

`Open Viby Identity in New Tab` was removed from administrator and judge
production sign-in. Both screens now present `Continue with Viby` as the one
obvious primary action and use user-facing access-denial language. The private
judge credential remains a clearly secondary hybrid-mode fallback without
development-era implementation wording.

No callback, source, mode, freshness, browser-binding, replay, or transaction
policy changed. Production-safe launch inspection confirmed both administrator
and judge flows still use:

- Runtime origin: `https://viby.keit.ai`
- callback: `/admin/viby/callback`
- source: `vibe_admin_confirmation`
- mode: `admin`
- opaque state in the callback URL
- server-owned operation dispatch

## Invitation architecture

The additive `account_invitations` table stores a SHA-256 token hash, target
Better Auth user, server-owned access intent, explicit judge profile/event,
lifecycle state, inviter, expiry, and lifecycle timestamps. The token is
returned once and is never recoverable from storage.

The lifecycle is `pending`, `accepted`, `expired`, or `revoked`. Administrators
can regenerate, expire, or revoke an invitation. Regeneration invalidates the
old token and shows the new link once. No outbound mail transport was added;
the UI accurately says `Create invitation link`, and the operator copies that
link for secure delivery.

Opening `/invite/[token]` exchanges the URL secret for a same-site HttpOnly
browser handoff and redirects to `/invite/accept`, removing the secret from the
address bar. A recipient can create a password or continue with Viby.

- Password acceptance creates the credential and applies invitation access in
  one database transaction.
- Viby acceptance reuses the qualified shared callback and authoritative fresh
  linking flow.
- `account_invitation_viby_transactions` binds the invitation to the
  server-owned login/link transactions.
- The target Better Auth account is locked before linking. Browser binding,
  fresh verification, explicit confirmation, replay protection, and conflict
  handling remain mandatory.
- Authentication itself creates no authorization. Only the unexpired,
  unconsumed server-owned invitation applies its recorded grants.
- No email, display name, Runtime profile, or historical identity-link role is
  used to infer identity or access.

## People improvements

People & Access now shows administrator and judge badges, linked-Viby state,
password state, disabled/invited state, last sign-in, and creation date. Quick
filters cover All, Administrators, Judges, Disabled, Needs password change, and
Not linked to Viby. Search/filter counts are announced through an `aria-live`
region.

The person sheet supports profile updates, independent administrator and judge
grants, session invalidation, password reset, account enable/disable, invitation
lifecycle controls, and safe recent audit history. Judge revocation now
requires explicit destructive confirmation. Existing self-lockout and
last-active-administrator protections remain authoritative on the server.

## Account improvements

Account settings retain separate cards for Profile, Password, Recent sign-ins,
Linked identity, and Access. They now show the current device, last successful
sign-in, password last-changed state, and the existing required-password banner.
Read-only access continues to derive exclusively from live
`admin_authorizations` and event-scoped `judge_authorizations`.

## Security model

- Better Auth remains the interactive application session.
- Viby remains an identity-verification provider.
- Identity links grant no application access.
- Administrator and judge authorization remain independent.
- Judge authorization remains scoped to `evt_vibe_2025` and never replaces
  assignment or score-ownership checks.
- Invitation tokens are random, single-use, hashed at rest, expiring, and
  absent from audit output.
- Account/access mutations continue to require recent administrator
  authentication and exact same-origin requests.
- Temporary passwords and invitation links are displayed once and are never
  logged or retrievable.

## Validation

- Full unit suite: **260/260 passed**.
- Invitation/account-management focused unit tests: **19/19 passed** in the
  final focused run.
- Phase B Chromium, desktop and mobile: **28/28 passed**.
- Account/People Chromium, desktop and mobile: **6/6 passed** after the final
  design corrections.
- Administrator Chromium regression: **23/23 passed**.
- TypeScript (`tsc --noEmit`): passed.
- Changed-file ESLint: passed.
- Production build from the working tree: passed.
- Clean immutable-release `npm ci` and production build: passed.
- `git diff --check`: passed.
- Test-database isolation: missing configuration rejected, test audit write
  confined to the disposable database, canonical database unchanged.
- Migration on an online disposable canonical-shape backup: first run passed;
  second run passed with zero automatic invitation rows.
- Disposable data preserved: 2 users, 3 judges, 15 assignments, 12 scores.
- Disposable and production `PRAGMA foreign_key_check`: clean; integrity `ok`.
- Secret/sensitive-output scan found only test assertions for cookie-name
  behavior; no credential, assertion, token, cookie value, or private key was
  committed.
- Canonical pre-qualification SHA-256 and post-qualification SHA-256 were both
  `65547db69c0e7b74dee7e727c70b50b5ee3e5c3e5e882b95b2ab9f94f9ab6476`.
- WebKit was not run because `libmanette-0.2.so.0` and `libhyphen.so.0` remain
  unavailable on the host. Chromium desktop and mobile both passed.

## Deployment

Predeployment state:

- release: `982e95f09b273badfecf2acdb8a4b69512670829`
- PID/start: `446982`, `2026-07-31 00:10:07 EDT`
- restart count: 0
- local/public health: HTTP 200 / HTTP 200
- administrator mode: `better-auth`
- judge mode: `hybrid`
- canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- starting counts: 2 users, 8 sessions, 2 accounts, 1 administrator
  authorization, 1 judge authorization, 2 Viby links, 3 judge profiles, 15
  assignments, 12 scores, 200 audit events

A protected online SQLite backup was created at:

`/opt/vibe-hackathon/backups/local.db.pre-b45b-20260731T123638Z.sqlite`

It is mode `0600`, 491520 bytes, with SHA-256
`315e96fe069772f1d731f1931f8271528504be3e39adbc90ee0143eda1e92a02`.

The canonical invitation migration ran twice. Both runs reported 0 invitation
rows before/after, 0 automatic rows, and a passing FK check. Existing users,
authorizations, links, profiles, assignments, and scores were unchanged.

The immutable release was built from exact application commit
`9d7c899de8c3729da032af8377ff183850eb2621` at:

`/opt/vibe-hackathon/releases/9d7c899de8c3729da032af8377ff183850eb2621`

Its `.release-commit` matches the deployed commit. `npm ci` reported the
existing dependency baseline of 5 moderate and 12 high advisories; no automatic
dependency mutation was performed.

Only `vibe-hackathon.service` was restarted. Final service state:

- PID/start: `1683605`, `2026-07-31 08:38:41 EDT`
- restart count: 0
- active/running
- local/public health: HTTP 200 / HTTP 200
- administrator mode: `better-auth`
- judge mode: `hybrid`
- rollback release retained:
  `/opt/vibe-hackathon/releases/982e95f09b273badfecf2acdb8a4b69512670829`

## Production verification

- `/admin` and `/judge` render HTTP 200 with `Continue with Viby` and no
  development diagnostic button.
- Anonymous `/admin/dashboard` and `/judge/dashboard` redirect to their normal
  sign-in pages.
- The new admin endpoint remains protected by the centralized administrator API
  policy inventory; an unsupported anonymous GET returns 405 and mutations
  require the reviewed PATCH/POST policies.
- Production launch inspection confirmed the unchanged registered shared Viby
  contract for both administrator and judge operations.
- No invitation, user, account, authorization, link, judge profile, assignment,
  or score was created by deployment or smoke qualification.
- Final counts remain 2 users, 8 sessions, 2 accounts, 1 administrator
  authorization, 1 judge authorization, 2 Viby links, 0 invitations, 0
  invitation/Viby bridges, 3 judge profiles, 15 assignments, and 12 scores.
  The only new audit rows are sanitized, intentional anonymous-guard and Viby
  launch smoke events. Launch probes created expiring, one-time login
  transactions only; they created no session, identity link, or authorization.
- Final foreign-key check is clean and integrity check is `ok`.

## Viby status

Viby was unchanged.

## Final disposition

GO — PHASE B.4.5B INVITATIONS AND PEOPLE DEPLOYED
