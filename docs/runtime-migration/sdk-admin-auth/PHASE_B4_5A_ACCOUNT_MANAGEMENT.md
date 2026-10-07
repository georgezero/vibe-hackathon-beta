# Phase B.4.5A — Account Management, Password Lifecycle, and People & Access

Status: deployed and qualified  
Date: 2026-07-30

## Repository state

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting HEAD: `1b750158fea029716008f105f08e59574a30bc57`
- Final deployed application HEAD:
  `982e95f09b273badfecf2acdb8a4b69512670829`
- Final repository HEAD consists of the deployed application HEAD plus this
  report-only documentation commit.
- Merge base with `origin/main`: `36d42eb153c767f0935213acd8d4f4e100acfbe5`
- Protected/unrelated untracked paths at baseline: `.claude/`, `.codex/`, and `local.db.pre-p0-4.bak`
- Starting production release: `e03f726143d5cf2436d13fbd7fa4d99c53b16988`
- Starting production PID: `225509`
- Starting process time: `2026-07-30 22:46:51 EDT`
- Starting service state: active/running, zero restarts
- Starting local/public health: HTTP 200 / HTTP 200
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Starting database timestamp: `2026-07-28 19:54:37.363388871 -0400`
- Starting counts: 2 users, 8 sessions, 2 accounts, 1 administrator authorization, 1 judge authorization, 2 Viby identity links, 3 judge profiles, 15 assignments, and 12 scores
- Starting foreign-key check: clean
- Administrator mode: `better-auth`
- Judge mode: `hybrid`
- Runtime endpoint: `https://viby.keit.ai`

## Baseline findings

Better Auth 1.6.25 already owns interactive users, credential accounts, and sessions. The shared application principal already derives administrator and event-scoped judge roles from live application-owned authorization rows. Viby identity links are role-neutral and grant no role.

The missing substrate is application-owned account lifecycle metadata. Better Auth deliberately remains the credential and session store; an additive application table will hold only status and password-lifecycle policy such as `active`/`disabled` and `password_change_required`.

No mutable role field will be added to a Better Auth user. Administrator and judge access will continue to be resolved from `admin_authorizations` and `judge_authorizations`.

## Proposed information architecture

### Account

`/account` is one signed-in settings surface composed of five focused cards:

1. **Profile** — display name, email, created date, and last sign-in.
2. **Password** — create or change a Better Auth password, with the current-password step shown only when applicable.
3. **Sessions** — current session first, then other sessions with individual revocation and a sign-out-everywhere action.
4. **Linked identity** — linked/not-linked Viby status and a handoff to the existing secure linking flow.
5. **Access** — read-only administrator and current-event judge status with explicit explanatory copy.

The cards avoid a single long form, distinguish editable from read-only data, and put the most common personal action near its context.

### People & Access

`/admin/people` is an identity-management console:

- a compact summary strip;
- a primary **Create account** action;
- search, access filter, and sort controls;
- a responsive people table with inline authentication and access badges;
- a side sheet for editing one person without losing table context;
- a dedicated danger section for disabling access-sensitive state;
- confirmation dialogs for consequential changes;
- a one-time credential handoff dialog that cannot be reopened after dismissal.

The table answers “who has access?” at a glance. Progressive disclosure keeps password reset, session revocation, and access changes out of the scanning surface until one person is selected.

## Reusable components and interaction flow

- `SettingsCard` establishes a consistent heading, description, content, and action rhythm.
- `StatusBadge` expresses account, authentication, and access state without relying on color alone.
- `ConfirmDialog` provides keyboard-safe confirmation for destructive or self-affecting operations.
- `ToastRegion` announces success and failure without moving the surrounding layout.
- `OneTimePasswordDialog` reveals a generated credential only in the immediate response and clears it on close.
- `PeopleTable` and `PersonSheet` share a safe person DTO; neither receives password hashes, session tokens, internal Runtime identifiers, or raw provenance.

The primary flows are:

1. Create account → validate → recent-admin check → generate/hash temporary password → optional explicit grants → one-time handoff.
2. Select person → edit profile/access/status in a side sheet → confirm sensitive action → refresh derived state.
3. Signed-in user → update profile/password or revoke sessions in the relevant Account card.

This is simpler than separate pages for every person or a single large account form: context remains visible, advanced actions stay hidden until needed, and access decisions remain visibly separate from authentication methods.

## Implementation summary

Phase B.4.5A adds an application-owned account lifecycle layer around Better
Auth without moving authentication or authorization:

- Better Auth remains authoritative for users, credential hashes, and sessions.
- `user_account_controls` stores only active/disabled state and temporary
  password-change policy.
- `admin_authorizations` and event-scoped `judge_authorizations` remain the
  only protected-role sources.
- `/account` is available to every authenticated Better Auth user.
- `/admin/people` is available only to a live authorized administrator.
- account and access mutations require exact same-origin requests and a Better
  Auth session created within the preceding ten minutes.
- every successful administrative mutation writes a sanitized audit event.

No mutable role column was added. Viby links remain role-neutral.

## Account page

`/account` contains separate Profile, Password, Sessions, Linked identity, and
Access cards. It shows safe account metadata only: name, email, creation date,
last recorded successful sign-in, linked/not-linked state, and derived live
access. It does not render Better Auth IDs, authorization IDs, Runtime subjects,
session tokens, password hashes, or raw provenance.

The password card supports both a normal Better Auth password change and
creating a password for a Viby-only account. Credential-state selection is
server-derived; a browser cannot claim that an existing password account is a
passwordless account to bypass current-password verification.

The session card uses Better Auth revocation APIs for individual, other, and
all-session invalidation. The current global account menu now contains Account,
administrator-only People & Access, and Log out actions on desktop and mobile.

## People & Access

`/admin/people` provides:

- name/email search;
- access filters and name/creation/activity sorting;
- live account, administrator, and current-event judge summaries;
- authentication and access badges;
- account creation through a focused dialog;
- person editing in a responsive side sheet;
- explicit judge-profile selection;
- account enable/disable;
- independent administrator and judge grant/revoke;
- password reset and session revocation;
- confirmation dialogs, status feedback, empty state, and loading skeleton.

The side sheet traps keyboard focus, closes with Escape, and restores focus to
the invoking Manage button. Native dialogs provide keyboard-safe confirmation
and one-time password handoff. Reduced-motion users receive a static loading
skeleton.

## Temporary password lifecycle

Account creation and reset generate a cryptographically random temporary
password. Only its Better Auth hash is persisted. The plaintext exists only in
the immediate no-store response and one-time dialog state; closing or reloading
cannot recover it.

`password_change_required` is enforced by the shared application principal.
Admin and judge protected entry points send the user to
`/account?password=required`. Completing the Better Auth password change clears
the requirement. A desktop/mobile browser regression verified temporary
password login, required-change routing, successful replacement, logout, and
login with the replacement password.

## Authorization management

Administrator and judge grants remain independent. Judge grants always target
the canonical event and require an explicitly selected existing judge profile;
email, display name, judge token, and Viby identity are never mapping inputs.

Revocation preserves profiles, assignments, scores, and authorization history.
Account disablement revokes Better Auth sessions while preserving grants for a
later deliberate re-enable. Self-disable, self-password-reset, and
self-administrator-revocation require explicit confirmation. Removing or
disabling the last active administrator fails closed.

## Security model

The shared principal rejects disabled or malformed account lifecycle state.
Better Auth session creation also rejects disabled users. Missing additive
account-control rows retain the existing active behavior, so migration creates
no implicit policy rows.

Administrative mutations require a current administrator grant, exact
same-origin request, and recent Better Auth authentication. Password hashes,
temporary passwords, sessions, Runtime assertions, callback state, and cookies
are excluded from audit metadata. Audit records contain actor, target,
operation, result, timestamp, and event context where applicable.

The existing Viby link flow is reused through an exact `/account` return-path
allowlist. Lookalike and nested account paths fail closed to the operation
default. No Viby assertion, callback, freshness, or linking policy changed.

## Tests

- Full isolated unit suite: **256/256 passed** across 37 files.
- Focused account/principal/migration/API inventory: **27/27 passed**.
- Phase B desktop/mobile Chromium regression: **24/24 passed**.
- Focused Account and People & Access desktop/mobile Chromium, including the
  required-password lifecycle: **4/4 passed**.
- Established administrator Chromium regression: **23/23 passed**.
- TypeScript: passed.
- Changed-file ESLint: 0 errors; two existing `next/no-img-element` warnings in
  the shared event-logo navigation remain.
- Production build: passed.
- `git diff --check`: passed.
- Test-database isolation: passed; missing configuration rejected, disposable
  audit writes isolated, canonical database unchanged.
- Secret, private-key, token/cookie, attribution, and sensitive-output scans:
  passed. Internal `passwordHash` variables were confirmed to be Better Auth
  hash values and are never rendered or logged.
- WebKit: not run. The host still lacks `libmanette-0.2.so.0` and
  `libhyphen.so.0`; Chromium desktop and mobile are qualified.

The Impeccable design workflow informed the information architecture,
progressive disclosure, semantic dialogs/menu, hierarchy, responsive behavior,
focus management, empty/loading states, and visual review. Screens were
inspected at 1440×1000 and 412×915.

The additive migration ran twice on a consistent disposable canonical-shape
backup. Both runs reported zero automatic rows and passed FK validation.
Preserved counts were 2 users, 8 sessions, 2 accounts, 1 administrator
authorization, 1 judge authorization, 2 Viby links, 3 judge profiles, 15
assignments, and 12 scores.

## Deployment

Commit sequence:

1. `20aba46` — managed account lifecycle, API, migration, safeguards, and unit
   tests.
2. `2596585` — Account and People & Access UI, role-aware account menu,
   responsive interaction, and browser coverage.
3. `982e95f` — complete temporary-password UI handoff and end-to-end password
   lifecycle coverage.

Predeployment:

- previous release:
  `e03f726143d5cf2436d13fbd7fa4d99c53b16988`;
- previous PID/start:
  `225509`, `2026-07-30 22:46:51 EDT`;
- health: local/public HTTP 200;
- canonical database:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`;
- prequalification SHA-256:
  `350e197d52a29803e551383d9b16e9386d69cfe123db11492e1d21de75775312`;
- backup:
  `/opt/vibe-hackathon/backups/local.db.pre-b45a-20260731T035800Z.sqlite`;
- backup mode/size/SHA-256:
  `0600`, 479232 bytes,
  `cfca249e5ee6412ccb64f11f54195f98d66ac65c9668d545aaf6dc3b75abe079`.

The canonical migration ran twice. Both runs reported 0 rows before/after, 0
automatic rows, and a passing FK check. Existing user, session, account,
authorization, Viby-link, judge, assignment, and score counts were preserved.

An initial immutable cutover to `2596585` exposed a client-only form-event
lifetime bug during the newly added real password-change test. No database or
authentication integrity failure occurred. The bug was corrected, the
password lifecycle passed on desktop and mobile, and the final immutable
release was rebuilt from exact commit
`982e95f09b273badfecf2acdb8a4b69512670829`.

The clean archive contains a matching `.release-commit`; `npm ci` and the
production build passed. The first archive build attempt failed closed because
the required production origin was not loaded. Rebuilding with the unchanged
application environment succeeded. The existing dependency audit still
reports 5 moderate and 12 high advisories.

Only `vibe-hackathon.service` was restarted. Final state:

- release:
  `/opt/vibe-hackathon/releases/982e95f09b273badfecf2acdb8a4b69512670829`;
- PID/start:
  `446982`, `2026-07-31 00:10:07 EDT`;
- NRestarts: 0;
- Ready: 259 ms;
- administrator mode: `better-auth`;
- judge mode: `hybrid`;
- local/public health: HTTP 200 / HTTP 200.

## Production validation

Production-safe qualification verified:

- signed-out administrator and judge protected routes deny access;
- Ada password login reaches the authorized judge dashboard;
- `/account` renders and reports active current-event judge access with no
  administrator grant;
- Ada cannot access administrator routes;
- global logout clears the session and protected judge access;
- account navigation disappears after logout;
- signed-out judge and administrator Viby launches are accepted by the
  unchanged production Runtime;
- all production launch/callback behavior continues to use the qualified
  application transaction and shared callback architecture;
- no account, grant, link, judge profile, assignment, or score was created or
  modified by smoke qualification.

Final data counts are 2 users, 8 sessions, 2 accounts, 1 administrator
authorization, 1 judge authorization, 2 Viby links, 3 judge profiles, 15
assignments, and 12 scores. `user_account_controls` has 0 rows, as expected
until an account-management mutation occurs. FK validation is clean and
`integrity_check` is `ok`.

Intentional smoke activity produced only expected rejected-anonymous,
judge-password-login, Viby-launch, and logout audit events. No password,
credential, token, cookie, Runtime assertion, or callback state was recorded.

Administrator password/Viby callback completion and judge Viby callback
completion remain covered by the passing regression suites; production-safe
smoke proceeded through Runtime contract acceptance without performing another
human biometric verification or creating a new identity link.

## Viby status

Viby was unchanged.

## Final disposition

GO — PHASE B.4.5A ACCOUNT MANAGEMENT DEPLOYED
