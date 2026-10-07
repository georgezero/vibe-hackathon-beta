# Authentication and identity integration

## Authority chain

The proposed chain is:

```text
Better Auth user
  -> Vibe application principal
  -> explicit submission membership
  -> server-side Chatto provisioning
  -> mapped Chatto user and room membership
  -> Chatto session
```

Chatto must never decide submission ownership, team membership, administrator
status, judge status, or event scope. Vibe must send only the minimum display
identity needed by Chatto.

## Identity mapping

Add a Vibe-owned durable mapping in a later integration migration:

```text
chat_identities
  user_id                 Better Auth user (RESTRICT)
  provider                chatto
  external_user_id        exact Chatto user ID
  status                  active | revoked
  provisioned_at
  revoked_at
  created_at / updated_at
```

Use a unique `(provider, user_id)` and `(provider, external_user_id)` pair.
Provisioning must be idempotent and keyed by Better Auth user ID, never by
email or display-name matching. Disabled or revoked Vibe users must have their
Chatto membership removed and their handoff refused.

## Handoff options

Chatto documents three relevant patterns:

- configured external providers (OIDC, GitHub, GitLab, Google, Discord),
  mapping identities by issuer/provider namespace plus subject;
- `/oauth/authorize` + PKCE for cross-origin clients, returning a short-lived
  authorization code and then an opaque delegated bearer token;
- normal Chatto cookie sessions or bearer tokens, with logout/revocation.

The current instance advertises no provider and has direct registration off.
The safest future path is to configure a supported OIDC/OAuth handoff and
register an allowlisted Vibe callback. Do not share Better Auth cookies,
broaden cookie domains, or put Chatto behind an iframe. If Chatto OAuth is used,
the Vibe callback must validate state/PKCE, exchange the code server-side, and
store no long-lived Chatto secret in the browser beyond Chatto's supported
session.

The public Chatto API does not currently expose a clearly scoped provisioning
endpoint. Operator user creation is local Unix-socket and root-equivalent;
admin user APIs are capability/RBAC protected. C.2B therefore needs either a
Chatto-supported service-account provisioning endpoint or a narrowly scoped
sidecar/adapter owned by the Chatto operator. Vibe should not tunnel the
operator socket into a public route.

## Linking and revocation

Provisioning and room membership must be server-to-server after Vibe has
verified an active owner/member relationship. A Chatto login must not create
Vibe users, ownership, judge access, or admin access. Revocation must remove the
Chatto user from every affected private room and invalidate/delegated sessions
according to Chatto's supported API; exact post-revocation cache behavior is a
C.2B test.

## C.1 dependency result

C.1 has an explicit submission owner account binding only when a claimant
completes the secure claim flow. It has no explicit Better Auth teammate
membership table, invited/pending teammate state, active/revoked membership
history, or teammate role model. Roster email/name fields are metadata and are
not an authorization source. A single claimed-owner pilot is safe; multi-user
team rooms require a minimal explicit membership phase first.
