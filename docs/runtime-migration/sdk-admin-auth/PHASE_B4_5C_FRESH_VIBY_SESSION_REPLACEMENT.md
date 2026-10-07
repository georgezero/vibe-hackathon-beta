# Phase B.4.5C — Fresh Viby Session Replacement

## Repository state

- Host: `paui`.
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`.
- Branch: `phase-vh-m6-viby-better-auth-session`.
- Starting repository HEAD: `1c4bae4e3b4991c2c83b619e55cfc1cad256b4cf`.
- Starting deployed application: `9d7c899de8c3729da032af8377ff183850eb2621`.
- Starting PID: `1683605`.
- Administrator mode: `better-auth`.
- Judge mode: `hybrid`.

Final repository, application, release, and process identifiers are recorded in
the deployment section after cutover.

## Defect and root cause

The administrator and judge sign-in pages resolved an existing Better Auth
session before authorization. An authenticated account without the requested
role correctly failed authorization, but the ordinary `Continue with Viby`
link created a new Viby transaction without first invalidating that application
session. The user was left to discover a separate `Clear sessions` or
`Use another account` recovery action.

The failure was application-side, not a Viby Runtime defect. Application logout
and upstream Viby state are separate. A deliberate Viby sign-in needs fresh
Runtime interaction, but it must first terminate the current application
session. The old launch route did neither as one ordered operation.

## Implementation

### Fresh Viby sign-in

`beginFreshVibySignIn()` is the shared server-only boundary for interactive
sign-in operations. It accepts only the explicit operations `admin_login`,
`judge_login`, and `invitation_acceptance`. It performs these steps in order:

1. resolves the current Better Auth session;
2. invalidates that session through Better Auth;
3. verifies that the same cookie no longer resolves an application session;
4. clears only application-owned session, legacy, callback, handoff, linking,
   and invitation cookies;
5. creates the new opaque server-owned transaction;
6. preserves only the new browser-binding state, plus the invitation handoff
   when the invitation operation requires it;
7. returns a non-cacheable redirect to Viby.

Admin and judge entry forms now use same-origin `POST /api/viby/start` requests.
Browser input can select only the allow-listed entry surface. Callback route,
operation policy, return destination, freshness, and authorization remain
server-owned. The qualified shared Runtime contract remains:

- callback: `/admin/viby/callback`;
- source: `vibe_admin_confirmation`;
- mode: `admin`;
- authoritative fresh verification requested.

The rollback `legacy` administrator mode retains its existing signed callback
state and callback handler while receiving the same ordered application-session
cleanup before launch.

### Sign-in versus linking

The product now has two explicit server routes with different invariants:

- **Continue with Viby** replaces any existing application login and starts a
  new fresh sign-in transaction.
- **Link identity** requires an authenticated application principal, preserves
  that session, and enters the existing browser- and account-locked linking
  flow through `POST /api/viby/link`.

No browser parameter can turn one operation into the other. Linking still
grants neither administrator nor judge authorization.

### Password replacement

Password authentication uses a same-origin application route around Better
Auth. Invalid credentials leave the existing session intact. After successful
authentication, the previous session row is invalidated and only the newly
issued Better Auth cookie is returned. Internal callback destinations are an
exact allow-list, including the existing admin and judge linking confirmation
pages.

### User experience

The normal production UI no longer presents `Clear sessions` or
`Use another account` as required recovery steps. Authenticated-but-unauthorized
states contain one concise warning, an ordinary `Continue with Viby` primary
action, and a subtle explanation that continuing signs out the current account.
Password sign-in remains available with a secondary button treatment. The
hybrid private judge credential remains in its separate compatibility card.

The Account page's `Link identity` action is deliberately unchanged in meaning:
it keeps and locks the current account.

#### Durable UI decisions

- **Thesis:** explicit Viby sign-in replaces hidden cleanup mechanics. The
  primary action performs the account replacement; recovery is not presented
  as a separate session-maintenance task.
- **Visual continuity:** this is a narrow extension of the incumbent centered
  authentication surface, not a replacement visual world. It keeps the
  charcoal surfaces, coral action color, amber warning treatment, semantic CSS
  variables, and established Syne/Plus Jakarta Sans typography.
- **First viewport hierarchy:** the unauthorized state presents one warning and
  one sign-in card. `Continue with Viby` is the full-width coral primary action;
  email/password sign-in remains in the same card behind an `OR` divider and
  ends with the outlined secondary action.
- **Judge compatibility:** in hybrid mode, the private judge credential stays
  below the unified sign-in card as a separate fallback. It does not compete
  with Viby or password sign-in inside the primary card.
- **Account-linking boundary:** `Link identity` remains a distinct account
  operation and must not inherit the replacement-session story or secondary
  password treatment from these sign-in entry surfaces.

#### Finish review verdict

**PASS for the scoped administrator and judge sign-in extension.** The final
review confirmed that the shipped surfaces preserve the incumbent visual
system and centered auth composition, explain the unauthorized-account state,
make Viby the clear primary action, keep password sign-in secondary, and retain
the hybrid judge fallback below. The review's one correction was to demote the
password submit action on sign-in entry surfaces from primary to secondary;
that correction is present in the reviewed implementation. This UI verdict
does not replace the deployment and real-human qualification gates below.

## Security and authorization

- Better Auth remains the only canonical interactive application session.
- Viby remains an identity-verification provider, not an application session.
- Administrator access still requires live `admin_authorizations`.
- Judge access still requires live event-scoped `judge_authorizations` for
  `evt_vibe_2025`, followed by assignment and score-ownership checks.
- Identity links grant no role.
- Callback operation dispatch remains transaction-derived.
- Browser binding, account locking, expiry, cancellation, replay rejection,
  authoritative freshness, safe destinations, and same-origin mutation checks
  are unchanged.
- Application cleanup is an explicit cookie allow-list; unrelated cookies are
  not deleted.

## Automated qualification

- Impeccable detector: zero findings.
- Impeccable finish review: **PASS for the scoped UI extension** after the
  password CTA was corrected to secondary only on sign-in entry surfaces;
  linking pages keep password authentication primary.
- Full unit suite: **263/263 passed** across 39 files.
- Focused authentication suite: **87/87 passed** across 13 files.
- Phase B desktop/mobile Chromium: **28/28 passed**.
- Administrator Chromium: **24/24 passed**.
- Invitation continuation after logout: **2/2 passed** on desktop/mobile.
- TypeScript: passed.
- Changed-file ESLint: passed.
- Production build: passed.
- `git diff --check`: passed.
- Disposable invitation migration: first run passed; identical rerun passed;
  zero automatic rows created.
- Disposable SQLite integrity: `ok`; foreign-key violations: `0`.
- Disposable profiles/assignments/scores: `3` / `15` / `12`.
- WebKit: attempted and unavailable because the host lacks
  `libmanette-0.2.so.0` and `libhyphen.so.0`; Chromium desktop and mobile are
  the deployment gate.

Before automated qualification the canonical logical fingerprint was
`c2f2e7222af74155eea72c126e05db6c9817142595f0cf9c9eb0d032c35b6545`.
After the complete final unit, browser, migration, TypeScript, build, lint,
design, and scan gates it remained byte-for-byte logically identical:

- logical SHA-256: `c2f2e7222af74155eea72c126e05db6c9817142595f0cf9c9eb0d032c35b6545`;
- integrity: `ok`; foreign-key violations: `0`;
- users/accounts/sessions: `2` / `2` / `10`;
- administrator/judge authorizations: `1` / `1`;
- Viby identity links: `2`;
- judge profiles/assignments/scores: `3` / `15` / `12`;
- audit events: `210`.

No automated qualification process changed the canonical database.

## Deployment

- Deployable application commit and immutable release:
  `aa2ac45e98ad1c2f74f9e642a55d10ef0b0d3545`.
- Rollback release retained:
  `9d7c899de8c3729da032af8377ff183850eb2621`.
- Pre-deployment database backup:
  `/opt/vibe-hackathon/backups/local.db.pre-b45c-20260731T141004Z.sqlite`;
  mode `0600`; 548,864 bytes; SHA-256
  `6b24f87be595e5a072d61699057e1f3eb4b5505e3fcabdbaf8dd82f05b18d5de`.
- This phase has no schema change, so no canonical migration was required.
- Only `vibe-hackathon.service` was restarted. Viby and unrelated services were
  not restarted.
- Previous PID: `1683605`.
- New PID: `1942408`; started `2026-07-31 10:13:29 EDT`; restart count `0`;
  service state `active/running`.
- The listener on port 3000 is the new PID and the immutable release's
  `.release-commit` exactly matches the deployable application commit.
- Local health: HTTP 200 with database `ok`.
- Public health: HTTP 200 with database `ok`.
- Anonymous `/admin/dashboard` and `/judge/dashboard` requests redirect to
  their respective sign-in pages with private/no-store responses.
- Direct GET requests to the admin and judge interactive launch endpoint return
  HTTP 405. A same-origin POST is required to create a transaction.

## Human live qualification

The first human attempt failed at the required fresh Runtime interaction gate.
The operator logged
out of the judge profile and selected the ordinary `Continue with Viby` action.
The application did not retain the prior application principal, but Runtime did
not present a fresh verification/profile-selection interaction. It returned the
previously selected Ada identity, after which the application correctly denied
administrator access because Ada has no administrator authorization.

The corresponding server-owned transaction and redeemed handoff establish the
boundary precisely:

- transaction operation: `admin_login`;
- transaction freshness required: `true`;
- launch contract from the deployed code:
  `context.forceIdentityCheck=true` and `freshIdentity=1`;
- transaction was new, one-time, and consumed without a failure code;
- redeemed Runtime verification kind: `fresh`;
- resolved Better Auth user: the existing Ada judge account;
- result: authenticated but not administrator-authorized.

No unsupported chooser parameter or application-side validation bypass was
added in response to that observation.

The operator then repeated the complete cross-role flow and confirmed that it
worked. Server evidence corroborates the successful retry:

1. A new `admin_login` transaction required freshness, was consumed once, and
   produced a fresh handoff for the independently authorized administrator
   Better Auth user.
2. Administrator logout was recorded.
3. A new `judge_login` transaction required freshness, was consumed once, and
   produced a fresh handoff for Ada's distinct Better Auth user.
4. `judge_viby_login_succeeded` was recorded for Ada, followed by judge logout.

This proves judge-to-administrator and administrator-to-judge session
replacement with distinct principals. The operator confirmed the intended
interactive behavior on the retry. The already-authorized direct-navigation
and account-locked Link identity boundaries remain covered by the passed
browser and focused authentication suites; no duplicate link was created.

## Audit and database verification

Post-deployment SQLite integrity is `ok` and foreign-key violations are `0`.
Current counts after the completed human qualification are
users/accounts/sessions `2` / `2` / `9`, administrator and
judge authorizations `1` / `1`, Viby identity links `2`, judge
profiles/assignments/scores `3` / `15` / `12`, and audit events `221`.

The sole new audit event after cutover is the intentional anonymous
`admin_session_rejected` event produced by the protected-route smoke check. No
authorization, identity link, profile, assignment, or score row changed.
All additional audit events correspond to the intentional deployment smoke and
human qualification attempts. No authorization, identity-link, assignment, or
score mutation occurred. Integrity remains `ok` with zero foreign-key
violations.

## Viby status

Viby was unchanged.

## Final disposition

GO — PHASE B.4.5C FRESH VIBY SESSION REPLACEMENT DEPLOYED
