# Phase C.2A — Explicit submission membership

## Boundary

Submission roster metadata is descriptive only. Access requires a Better Auth
user and an active `submission_memberships` row. Ownership and membership are
not inferred from email, badge number, team roster, administrator role, judge
role, or edit-token possession.

## Model

`submission_memberships` stores `owner` and `teammate` memberships with
`invited`, `active`, and `revoked` lifecycle states. Partial unique indexes
enforce one active user/submission membership and one active owner per
submission. Revocations are retained and use restrictive foreign keys so an
account lifecycle action cannot delete submission history.

`submission_membership_invitations` stores only a SHA-256 token digest. The
raw `join_…` credential is returned once when an owner creates a link, expires
after seven days, is single-use, and is never written to audit metadata.

## Flows

- Explicit claim confirmation creates the owner record and active owner
  membership in one transaction.
- Existing explicit owners are reconciled by the additive migration using a
  stable `membership_owner_<owner-id>` identifier.
- Owners create bounded teammate links from the private team-management
  surface. Acceptance requires Better Auth authentication and explicit
  confirmation; it grants only team membership.
- Owners can revoke teammate memberships. Owner self-revocation and ownership
  transfer are not supported.

`/projects/join/<token>` stores the invitation briefly in an HttpOnly,
SameSite=Lax cookie and redirects to a confirmation page. The acceptance route
does not create accounts, mutate roster metadata, or grant admin/judge access.

## Migration and gate

`npm run db:migrate:submission-memberships` requires an absolute canonical
SQLite path and an explicit typed confirmation. It is additive, refuses the
protected pre-P0.4 backup and remote databases, fails closed on duplicate
owners, runs a foreign-key check, and is idempotent. It has only been tested
against disposable databases during this phase.
