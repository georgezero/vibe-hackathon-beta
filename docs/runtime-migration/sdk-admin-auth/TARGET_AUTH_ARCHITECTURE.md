# Target Authentication Architecture

## Boundary

The modernization must preserve this boundary:

| Runtime owns | Vibe Hackathon owns |
| --- | --- |
| Face/identity verification | Better Auth users and sessions |
| Assertion issuance and expiry | Identity links |
| Single-use assertion redemption | Admin and judge roles |
| Fresh identity verification | Page and API authorization |
| Registered audience, mode, callback | Team/submission ownership |
| Runtime identity-session lifecycle | Agent action meaning |
| Confidential connected-app credential verification | Artifact provenance and persistence |

Vibe must not reproduce face verification, Runtime session state, or assertion
replay protection. Runtime must not decide who is a Vibe admin, judge, team
owner, or submission editor.

## Target components

### Runtime client adapter

A thin server-only module should wrap the corrected, versioned Runtime SDK. It
should expose application-oriented operations without reimplementing protocol:

- begin admin verification;
- begin agent attribution;
- begin artifact attribution;
- validate callback transport and exact application transaction;
- redeem a human or agent assertion once;
- map Runtime error categories to non-sensitive application outcomes.

It must not know Vibe roles or create Better Auth sessions.

### Callback transaction store

Replace the single signed callback cookie with database-backed one-time
transactions. Store only a digest of a 256-bit random browser nonce.

Each record binds:

- flow and callback path;
- safe relative return path;
- expected Runtime mode and actor policy;
- initiating Better Auth user/session when present;
- project and artifact type when relevant;
- creation, expiry, and consumed timestamps;
- outcome category, without assertion or credential values.

The browser cookie carries only the opaque nonce and a transaction identifier.
Consumption must be atomic and must occur in the same application operation
that accepts the callback result.

### Better Auth principal

The Better Auth session identifies the local user. It does not imply admin
authorization.

A central `AdminPrincipal` resolver should:

1. obtain the Better Auth session through `auth.api.getSession()`;
2. load the active application role;
3. load the active Viby identity link and its current status;
4. enforce any required recent Viby verification;
5. return a normalized principal used by both server pages and `withAdminApi()`.

The existing centralized admin route policy registry, Origin checks, and audit
behavior remain in place.

### Identity link

An identity link maps the stable Runtime provider subject to one Better Auth
user. Authorization is a separate application role decision.

The target must not rely on display name, tag, email, client-supplied local user
ID, or request query data for the link.

### Admin role

Admin access remains explicitly application-owned and revocable. The existing
environment allowlist may bootstrap a reviewed link during a bounded migration,
but it must not remain an alternative permanent authorization plane.

## Login paths

### Better Auth first

The user signs in through the existing GitHub Better Auth flow. A user with an
active admin role can use the application. If policy requires a recent Viby
verification, the application redirects to the step-up flow.

### Viby first

The user verifies with Viby.

- Existing active link: issue a Better Auth session for the linked user through
  a supported Better Auth extension, then evaluate the application role.
- No link: create a short-lived pending-link transaction and require Better
  Auth GitHub sign-in before an explicit link confirmation.
- Revoked/conflicting link: deny without identifying the account that owns it.

### Logged-in account linking

An authenticated Better Auth user explicitly starts “Link Viby.” The callback
transaction is bound to that user and current session. A successful fresh Viby
assertion creates the link atomically if no conflicting link exists.

## Better Auth integration surface

Better Auth 1.6.25 exports `createAuthEndpoint` and cookie helpers, and its
first-party plugins create sessions inside registered endpoints. It does not
expose a simple public `auth.api.createSessionForUser()` method in the installed
version.

Implementation must begin with a small compatibility proof using a supported
custom Better Auth plugin/endpoint. It must not:

- use `(auth as any).$context`;
- duplicate Better Auth cookie signing;
- write the session token cookie manually;
- invoke a private route from a browser with a user ID.

If the installed version cannot support a versioned custom provider/endpoint
without private APIs, stop and coordinate an isolated Better Auth upgrade or
upstream provider adapter. Do not copy ri0's workaround.

## Fresh verification

Fresh verification is a Runtime operation. Vibe should:

- request it for admin login and sensitive step-up;
- bind that request to a one-time callback transaction;
- accept Runtime evidence only from a redeemed assertion for the expected mode;
- record `lastFreshVerifiedAt` or equivalent application assurance metadata;
- enforce a separately approved maximum age for sensitive actions.

Vibe should not infer freshness from a display value, browser flag, or the mere
existence of a Viby link.

## Logout

Provide two explicit operations:

- **Sign out of Vibe Hackathon:** revoke the current Better Auth session, clear
  legacy admin and callback cookies, and remain independent of Runtime.
- **Sign out of Vibe and Viby:** perform local logout, then use a verified
  Runtime logout contract when one exists.

The Runtime SDK's current logout helper is not deployable and must not be used
until the Runtime supplies a real, validated route.

## Request flow

```text
Browser
  -> Vibe begin endpoint
     -> durable callback transaction
     -> Runtime start URL
  -> Runtime verification and consent
  -> Vibe callback with opaque assertion ID + state
     -> consume exact callback transaction
     -> corrected SDK redemption (server to server)
     -> resolve/create identity link
     -> supported Better Auth session endpoint
     -> central AdminPrincipal authorization
  -> protected Vibe page/API
```
