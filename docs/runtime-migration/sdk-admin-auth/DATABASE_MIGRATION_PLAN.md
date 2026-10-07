# Database Migration Plan

This is a schema plan, not an executable migration.

## Current relevant tables

- Better Auth: `users`, `sessions`, `accounts`, `verifications`.
- Runtime authorization: `viby_identity_links`.
- Admin auditing: current audit storage used by `lib/admin-audit.ts`.

The existing link table mixes provider identity, role, profile display, and
nullable local account identity.

## Recommended target records

### `identity_links`

If renaming the existing table would create unnecessary operational risk, the
same shape may be introduced additively in `viby_identity_links`.

Required fields:

- `id`
- `provider` (`viby`)
- `provider_subject_id`
- `user_id` non-null FK to Better Auth `users`
- `status` (`active`, `revoked`, `conflict_hold`)
- `display_name` as non-authoritative profile metadata
- `linked_at`
- `last_verified_at`
- `last_fresh_verified_at`
- `revoked_at`
- `created_at`, `updated_at`

Constraints:

- unique provider plus provider subject;
- unique active provider plus user if one Viby identity per user is approved;
- no role column as the sole authorization source;
- indexed user and active-status lookups.

SQLite and libSQL must use equivalent constraints. If a cross-provider partial
unique index is not portable enough, model active status so a normal composite
unique index can enforce the invariant.

### `user_roles`

Required fields:

- `id`
- `user_id`
- `role` (`admin`; future roles only by explicit migration)
- `status`
- `granted_by`
- `granted_at`
- `revoked_by`, `revoked_at`
- `created_at`, `updated_at`

Unique user plus role prevents duplicate active authorization records. If the
project elects to keep role in the existing link table for the first bounded
release, document that this couples role recovery to provider recovery and
retain a later separation milestone.

### `auth_callback_transactions`

Required fields:

- `id`
- `nonce_hash`
- `flow`
- `callback_path`
- `return_path`
- `expected_mode`
- `expected_actor`
- initiating `user_id` and session binding when present
- optional project and artifact type
- `created_at`, `expires_at`, `consumed_at`
- `outcome`

Use 256-bit random nonces and a one-way digest. Uniqueness on the nonce digest
and an atomic `consumed_at IS NULL` update enforce one-time behavior.

### `pending_identity_links`

Required fields:

- `id`
- provider and provider subject
- originating callback transaction
- verified display metadata
- expected Better Auth flow binding
- `created_at`, `expires_at`, `consumed_at`

Do not store assertion IDs or Runtime credentials.

## Data conversion

1. Back up the exact target using the established protected-backup procedure.
2. Add target tables/columns and constraints without removing current records.
3. Resolve every active `viby_identity_links.local_user_id IS NULL` row:
   - match only through explicit operator-reviewed mapping;
   - never match by display name or email;
   - keep unresolved rows in legacy authorization state during compatibility.
4. Create or confirm the local admin role separately.
5. Validate uniqueness before adding final unique constraints.
6. Enable dual-read, new-write behavior.
7. After the compatibility window, require non-null local user IDs for active
   links and retire legacy authorization rows.

The environment allowlist is an input to an operator-reviewed bootstrap report,
not an automatic local-user matching mechanism.

## Deployment compatibility matrix

| Code | Old schema | Additive schema | Final schema |
| --- | --- | --- | --- |
| Current code | Works | Works if existing columns preserved | Must not be used |
| Dual-read code | Must fail readiness or run without new issuance | Works | Works if compatibility fields retained |
| Final code | Must fail readiness | Works after completed mappings | Works |

Use additive schema first. Do not deploy final code before all required mappings
and constraints validate.

## Migration command requirements

The current identity-link migration script uses a direct
`NODE_ENV === "production"` confirmation check. Its replacement must:

- use the central fail-closed runtime policy;
- require an explicit absolute database target;
- display and bind confirmation to a sanitized target identity;
- distinguish local SQLite from remote libSQL;
- create and verify a protected rollback backup;
- be idempotent and stage-aware;
- never print identity or secret values;
- test real SQLite transaction and interruption behavior.

Do not activate the separate P0.4 credential migration as part of this work.
The pre-existing P0.4 backup must be handled under its own runbook.

## Rollback data behavior

Additive tables can remain if application rollback occurs. Rollback should:

- stop issuing Better Auth sessions from Viby;
- restore legacy principal resolution only during the approved window;
- preserve new link and role rows for investigation;
- revoke sessions created by the failed release if their semantics are in
  doubt;
- never restore a consumed Runtime assertion or pending callback transaction.
