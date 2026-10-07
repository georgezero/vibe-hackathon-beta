# Account Linking Design

## Invariants

1. A Runtime subject maps to at most one local Better Auth user.
2. A local user maps to at most one active Viby identity unless an explicit
   multi-identity policy is approved.
3. A link alone grants no role.
4. A request body, query string, display name, email, or browser state never
   selects the local user.
5. Link creation and conflict checks are one database transaction.
6. Revocation immediately prevents Viby-first login and admin authorization.
7. Link recovery is an audited organizer operation, not an automatic overwrite.

## First-time Viby-first flow

1. Browser starts a Viby login transaction.
2. Runtime performs the requested verification and returns an assertion.
3. Vibe atomically consumes its callback transaction and redeems the assertion.
4. Vibe looks up `(provider=viby, subject_id)`.
5. If no link exists, Vibe creates a short-lived server-side pending-link row
   containing the provider subject, verification metadata, transaction
   identifier, and expiry. Store no assertion or client credential.
6. Vibe redirects to the Better Auth GitHub sign-in flow.
7. After Better Auth returns, Vibe requires explicit “Link this Viby identity
   to this account” confirmation.
8. A transaction rechecks the pending link, Better Auth session, provider
   uniqueness, local-user uniqueness, expiry, and role eligibility.
9. Vibe creates the link, consumes the pending record, and records an audit
   event.
10. Admin access is granted only if the local user has an active admin role.

The pending-link transaction must be bound to the Better Auth flow state after
GitHub sign-in starts. An attacker must not be able to sign in separately and
claim another browser's pending identity.

## Returning linked user

1. Redeem a fresh Runtime assertion.
2. Resolve the one active link.
3. Reject missing, revoked, or conflicting data.
4. Create a Better Auth session through the approved extension.
5. Rotate away any pre-existing anonymous or lower-assurance application
   session to prevent fixation.
6. Evaluate the application role.

A linked non-admin may sign in to application features their local account is
authorized to use, but must receive no admin access.

## Logged-in Better Auth user linking Viby

1. Require a current Better Auth session.
2. Start a fresh Viby flow bound to the user ID and session token digest.
3. Redeem and verify the callback.
4. In one transaction, reject:
   - a subject linked to another user;
   - another active subject linked to this user when one-per-provider applies;
   - an expired/consumed callback transaction;
   - a changed or revoked Better Auth session.
5. Create the link and update assurance metadata.

The UI must display only the verified display label and make clear that linking
does not itself grant organizer privileges.

## Unauthorized user

An identity absent from the bootstrap allowlist and without an active admin role
may link to its own Better Auth account only if general account linking is an
approved feature. It must not gain admin access.

For a narrowly admin-only launch, the safer first release is:

- allow linking only for users already assigned an admin role, or
- allow a reviewed bootstrap subject to create the initial link and role in a
  one-time audited migration operation.

Do not persist a new durable admin role merely because a subject appeared in an
environment allowlist during a normal login.

## Duplicate and conflicting links

| Condition | Result |
| --- | --- |
| Same subject, same user, active | Idempotent success |
| Same subject, different user | Conflict; no identifying detail |
| Different subject, same user | Conflict unless multi-identity policy approved |
| Existing revoked link | Recovery required; never silently reactivate |
| Pending link consumed/expired | Restart linking |
| Two concurrent creates | Unique constraint selects one winner; loser gets conflict |

No “last write wins” behavior is permitted.

## Recovery

Recovery requires an authenticated, authorized admin who is not modifying their
only active recovery path, or an offline operator procedure.

The runbook should support:

- inspect non-secret link and role metadata;
- revoke a link;
- assign a replacement pending link;
- invalidate related Better Auth sessions;
- record actor, target, reason, timestamp, and outcome;
- preserve a rollback record without preserving Runtime assertions.

Display-name changes are profile updates, not identity changes.

## ri0 comparison

ri0 implements the useful Viby-first → Better Auth login → link sequence in
`app/api/viby/author-callback/route.ts` and
`app/login/link-viby/actions.ts`. It does not solve transactional conflicts,
one-link-per-user, durable pending state, or supported Better Auth session
creation. Those gaps are explicit requirements here.
