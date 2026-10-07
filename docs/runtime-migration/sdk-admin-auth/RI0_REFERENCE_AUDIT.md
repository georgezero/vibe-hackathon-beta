# ri0 Reference Audit

Audited read-only on doro:

- repository: `/home/george/Downloads/src/ai/ri0/ri0-dev`
- branch: `main`
- commit: `6890ff4439827328acc229350cae0d68d9f6d8b0`
- subject: `doro-ri0: require fresh Viby verification for author login`
- committed tree: clean

The checkout had unrelated untracked local assets. Only committed files at the
audited commit informed this review.

## Reusable concepts

### Dual-login presentation

`app/login/page.tsx`, `components/reader/VibyVerifyButton.tsx`,
`components/auth/AuthDivider.tsx`, and
`components/auth/EmailPasswordSignInForm.tsx` present Viby as the primary
identity option and Better Auth email/password as the other login option.

Vibe can reuse the concept, not the styling or provider choice. Vibe currently
has GitHub OAuth rather than email/password.

### Linked-returning-user flow

`app/api/viby/author-callback/route.ts` redeems a Viby identity and queries
`author_identity_links`. A linked identity enters the application; an unlinked
identity gets a short-lived pending-link record and is redirected to
`/login/link-viby`.

`app/login/link-viby/actions.ts` requires a successful Better Auth
email/password login before inserting the Viby identity link. This is the right
high-level ownership proof: a Viby identity alone must not select an arbitrary
local account.

### Local logout plus fresh Viby re-entry

`components/layout/AppShell.tsx` signs out of Better Auth and marks the next
Viby login as fresh. `app/login/page.tsx` consumes the marker and starts Viby
with fresh verification.

Vibe should retain the distinction between local application logout and
Runtime identity logout, but should not depend on localStorage for a security
property.

## ri0 implementation details not to copy

### Private Better Auth session creation

`lib/author-viby-session.ts` reaches into `(auth as any).$context`, calls
`internalAdapter.createSession()`, reimplements Better Auth's cookie signature,
and writes the cookie itself. This is coupled to Better Auth internals and must
not be copied.

Vibe should implement a supported Better Auth plugin/endpoint extension using
the versioned exported API, or obtain an upstream-supported custom-provider
path. Better Auth 1.6.25 exports `createAuthEndpoint` and cookie helpers, but a
small compatibility spike and tests are required before choosing the exact
mechanism.

### Hand-written Runtime protocol

`lib/viby.ts` and `app/api/viby/start/route.ts` use the legacy GET protocol.
ri0 does not import the deployed Runtime SDK at this audited commit.

### Pending-link cookie

`lib/pending-viby.ts` stores identity data in a signed cookie and falls back to
the literal `dev-secret` when two environment secrets are absent. It is not a
durable, one-time, server-consumed transaction and the fallback is not suitable
for Vibe's fail-closed runtime model.

### Incomplete link invariants

`lib/db/schema.ts` gives `author_identity_links` uniqueness on provider and
provider user ID. It does not enforce one Viby identity per local author, and
`app/login/link-viby/actions.ts` performs a read followed by an insert without
an explicit transaction.

If another account already owns the Viby identity, the action does not report a
conflict and the newly signed-in user continues without owning that link.
Vibe needs atomic conflict handling and explicit user feedback.

### Callback state

The ri0 start route generates a `request_id` in the callback URL, but the
audited callback does not validate or consume that request ID. This is not a
model for callback CSRF protection.

## Better Auth reference

`lib/auth.ts` uses Better Auth 1.6.17, Drizzle, `nextCookies()`, and
email/password. `lib/auth-guard.ts` protects author pages by calling
`auth.api.getSession()`. Application middleware is not the primary auth guard.

The most valuable lesson is separation:

- Better Auth owns the local user session.
- A provider identity link selects the existing local user.
- Application page guards consume the Better Auth session.

The unsafe part is the private method used to manufacture that session.

## ri0 tests

Relevant tests are:

- `tests/e2e/author-login.spec.ts`
- `tests/e2e/viby-callback.spec.ts`
- `tests/e2e/viby-author-consent.spec.ts`
- `tests/e2e/logout.spec.ts`
- `tests/unit/viby-log-privacy.test.ts`

They demonstrate the intended user journey but do not cover atomic duplicate
linking, concurrent linking, pending-link replay, or public-API compatibility
for the session-creation mechanism.

## Applicability to Vibe

Conceptually reusable:

- two explicit login choices;
- pending-link confirmation by an already authenticated local user;
- direct return for an existing link;
- local logout followed by an explicit fresh-verification choice.

Application-specific or unsuitable:

- ri0 email/password UI;
- ri0 author schema and route names;
- private Better Auth session construction;
- signed pending-link cookie;
- legacy Runtime client;
- localStorage as the freshness control.
