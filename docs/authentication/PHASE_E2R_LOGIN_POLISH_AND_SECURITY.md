# Phase E.2R — Login polish and authentication security

Date: 2026-08-08 (qualification and deployment completion)

## Scope

This release is limited to the shared password sign-in surface. It does not
change Better Auth, authorization records, CSRF enforcement, rate limiting,
production data, Chatto, or Viby.

## UX refinement

The shared `PasswordSignInForm` now uses semantic field groups and a deliberate
spacing rhythm:

- labels and controls use a tight `0.5rem` relationship;
- the two field groups use a consistent `1rem` form gap;
- the OR divider has a slightly more generous lower separation before Email;
- the submit/help relationship is kept compact without collapsing the card;
- the existing `.input` token is applied so both fields retain a visible,
  focusable control surface;
- the form remains full-width and reflows without horizontal overflow on small
  viewports.

Spacing is expressed through field grouping and grid `gap`, rather than a chain
of unrelated child margins. The card keeps the established Vibe Hackathon
surface, typography, and semantic color variables.

## Failed-login security fix

The previous form had no explicit HTML `method` or `action`. If the client
handler did not run, the browser defaulted to a GET submission and serialized
the email and password into the login URL.

The form is now explicitly POST-only and targets the application password
endpoint. The client fetch also uses `redirect: "manual"`, so an unexpected
redirect cannot be followed by the browser as part of the JSON flow.

The endpoint accepts both the existing JSON request and the native form POST:

- JSON failures remain a `401` JSON response and the current inline message is
  preserved;
- native form failures redirect to the validated login callback with only the
  fixed `reason=invalid_credentials` token;
- native form success redirects to the validated callback after copying the
  Better Auth session cookies;
- redirect URLs are built from the configured canonical origin, not an
  internal proxy origin;
- `Cache-Control: no-store, private` and `Referrer-Policy: no-referrer` are set
  on authentication responses;
- submitted email, password, and form values are never interpolated into a
  redirect URL or logged by this route.

Strict same-origin checks remain before body parsing, and Better Auth continues
to own password verification and production rate limiting.
The isolated repeated-failure check used synthetic credentials only; no rate
limit was disabled or relaxed, and generic failure messaging remained intact.

## Qualification evidence

Source and browser checks completed against an isolated synthetic database:

- Full unit suite: 254 tests passed.
- TypeScript: passed (`npx tsc --noEmit`).
- Changed-file ESLint: passed for the form, card, login route/page, global
  styles, and authentication browser test.
- Production build: passed (`npm run build`).
- Impeccable layout detector: no findings for the login targets.
- Hydrated desktop and mobile Chromium smoke through the isolated Kentucky
  Vibes HTTPS/CF URL: failed login kept the browser on the login path; no
  credential value appeared in the URL; no horizontal overflow was observed.
- Native no-JavaScript form smoke: the POST fallback returned a safe login
  redirect with only `returnTo` and `reason` query keys; no submitted value
  appeared in the URL.
- Successful password sign-in smoke: reached `/admin/dashboard` with a
  Better Auth session and no credential value in the URL.
- Computed spacing review: label-to-control `8px`, field-to-next-label `16px`,
  divider-to-Email `18.39px`, and no horizontal overflow at 1440px and 390px
  viewports.

During qualification the rebuilt source ran only on the isolated Kentucky
Vibes service (port `3020`, behind its existing temporary TLS/CF proxy);
production remained on its original release and was not restarted until the
documented deployment below.

The synthetic administrator fixture had a stale password hash after an earlier
credential rotation. Its hash was resynchronized from the existing mode-0600
operator password file on the isolated database only; no production account or
authorization was touched.

The legacy `viby-admin-auth.spec.ts` file also contains older route expectations
for unrelated administrator/Viby flows; those failures are pre-existing
coverage drift (for example, expecting `/admin?reason=session_required` where
the current route correctly uses `/login?returnTo=...`). The new native fallback
security test passed independently; no production service was restarted during
the isolated qualification.

## Deployment

The production database was snapshotted before cutover. The verified backup is:

`/opt/vibe-hackathon/database-snapshots/current-event-vibe-hackathon-2026-20260808T142239Z-939852c5309e.sqlite`

with normalized SQLite SHA-256
`175d642962b10edb4d6f0ca3602b35a9b4fbeaa90f39dabff014a13a5fd4d7c0`.
Integrity was `ok`, foreign-key violations were `0`, and the canonical
database SHA-256 remained
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`.
No migration or data write was performed.

Read-only post-deployment counts were unchanged from the pre-cutover snapshot:
8 users, 8 Better Auth accounts, 5 judges, 3 active judge authorizations, 17
assignments, 14 human scores, 14 non-empty private-note fields, 10 submissions,
1 publication release, and 1 finalist.

The application was deployed as the immutable overlay release
`/opt/vibe-hackathon/releases/a70edc28326108dfc84a69af303f680ceaa7f735-e2r-login-20260808T142000Z`,
with the previous D.4 release retained as the rollback target. Only
`vibe-hackathon.service` was restarted. Post-cutover PID was `1606838`, restart
count was `0`, and both local and public health returned HTTP 200 for event
`evt_vibe_2025`.

Post-deployment public checks included hydrated desktop/mobile failures and a
native no-JavaScript form failure. Each remained on `/login`; the native
redirect contained only `reason=invalid_credentials`, with no submitted email
or password. The Viby button remained present with action `/api/viby/start`.
The isolated synthetic qualification also verified successful password login
to `/admin/dashboard`; no production credential was used or printed.

## Data and service safety

All smoke tests used a cloned Kentucky Vibes synthetic database and isolated
HTTPS access (local proxy and the temporary qualification tunnel). The
canonical production database was not modified; the only production operation
was the documented application release restart. Chatto and Viby were
unchanged.
