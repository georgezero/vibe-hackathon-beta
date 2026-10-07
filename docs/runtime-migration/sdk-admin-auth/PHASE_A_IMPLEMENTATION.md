# Phase A — Better Auth Password Administrators

Status: implemented locally; not deployed

Phase A deliberately precedes the Viby SDK and identity-link work. The existing
qualified Viby assertion adapter continues to issue `vibe_admin_session`.
Password administrators use only Better Auth sessions.

## Supported Better Auth APIs

- Configuration: `emailAndPassword.enabled`, `disableSignUp`, password bounds,
  and Better Auth's production rate limiter.
- Browser sign-in: `authClient.signIn.email()`.
- Server session lookup: `auth.api.getSession({ headers })`.
- Logout: `auth.api.signOut({ headers, asResponse: true })`.
- Password hashing for the operator provisioning command:
  `hashPassword()` from the public `better-auth/crypto` package export.

Better Auth owns password hashing, credential verification, session creation,
session rotation, cookies, expiry, and session deletion. No session rows are
inserted by application code and no private Better Auth module is imported.
Public email registration is disabled.

## Application authorization

`admin_authorizations` is an additive application-owned table with one row per
Better Auth user, an active/revoked state, grant source, timestamps, and a
database unique constraint. A Better Auth account, matching email, GitHub team
ownership, or valid session does not imply admin authorization.

`resolveAdminPrincipal()` performs live role checks for every protected admin
page and API. It returns a normalized, redacted principal for either Better
Auth or the transitional Viby cookie. If both mechanisms are simultaneously
valid, access fails closed until the browser logs out. The identities are never
merged.

Better Auth's public session data does not reliably identify whether a session
was established by a credential account or GitHub. Its normalized provenance
is therefore `better_auth_session`, never an inferred `email_password` value.
Viby retains its verified identity method. Provenance describes authentication;
it does not grant or alter application authorization.

## Operator workflow

1. Stop application writes and create a timestamped operational backup of the
   explicit production SQLite database. Never use or alter the protected
   `local.db.pre-p0-4.bak`.
2. Run the additive migration with a pre-existing, canonical, regular local
   SQLite file in `DB_FILE_NAME` and exact
   `VIBE_ADMIN_AUTH_MIGRATION_CONFIRM=MIGRATE ADMIN AUTH DATABASE <canonical-path>`.
   The migration refuses symlinks, non-files, inaccessible targets, the
   protected backup, remote URLs, and paths that do not contain the expected
   Vibe Hackathon schema. It validates the final table, columns, foreign key,
   constraints, indexes, and duplicate invariants inside the migration
   transaction. A valid rerun reports that the schema was already valid.
3. Create a mode-0600 password file outside the repository.
4. Run `npm run admin:provision-password -- --email <exact-email> --name
   <display-name> --password-file <absolute-path>` with the exact
   `VIBE_ADMIN_PROVISION_CONFIRM=PROVISION_PASSWORD_ADMIN:<db-path>:<normalized-email>`.
5. Securely destroy the password file after the administrator has confirmed
   sign-in. The command never prints the password or hash.

The command reuses an exact existing Better Auth user rather than duplicating
it, adds a credential account only when absent, and creates one explicit role
grant. A revoked grant is never silently reactivated.

Revocation uses `npm run admin:revoke-password -- --email <exact-email>` with
the target-bound `VIBE_ADMIN_REVOKE_CONFIRM`. Live page and API checks make it
effective immediately. Existing Better Auth sessions remain non-admin sessions
and can still be logged out.

Remote libSQL migration/provisioning is intentionally refused in Phase A.

## Login and logout

The admin entry page offers Viby first, followed by email/password. Password
errors are generic. A successful password verification creates only a Better
Auth session; authorization is checked at the dashboard.

Logout is a same-origin POST. It invokes Better Auth's supported sign-out API,
clears the transitional Viby cookie, and does not globally sign the user out of
shared Viby.

## Deployment and rollback

Deploy in a maintenance window: backup, migrate, provision, deploy the immutable
release, then validate password login, Viby login, logout, revocation, admin
pages/APIs, and provenance callbacks.

Rollback the application release without dropping the additive table. The old
release ignores it and continues accepting the qualified Viby cookie. Restore
the database backup only if the additive migration itself failed; do not use a
rollback to erase newly created unrelated application data.

## Deferred

Viby SDK adoption, Viby-to-Better-Auth session conversion, identity linking,
fresh-verification redesign, password reset/email delivery, distributed login
rate limiting, and removal of `vibe_admin_session` remain later phases.
