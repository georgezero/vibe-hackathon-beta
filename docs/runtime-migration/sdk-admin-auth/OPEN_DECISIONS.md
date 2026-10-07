# Open Decisions

These decisions block or materially shape implementation.

## Runtime owner

1. What versioned delivery mechanism will make the Runtime SDK consumable by
   connected applications: package, workspace artifact, or reviewed vendored
   source?
2. Will the deployed SDK be corrected for `assertion_id`, nested response
   parsing, exact state comparison, typed agent payloads, and fresh launch
   options?
3. What is the supported Runtime logout route and return URL contract?
4. Will the `vibe-hackathon` registration enable modern POST while retaining
   legacy GET during transition?
5. Who provisions and rotates the dedicated Vibe client credential?
6. What Runtime assertion fields authoritatively prove freshness and issue
   time?

## Application owner

1. Must every admin own a Better Auth GitHub account, or is another Better Auth
   local provider required?
2. May one local user link more than one Viby identity?
3. May a non-admin link Viby for future non-admin use, or is linking admin-only
   in the first release?
4. Is the environment allowlist retained only for bootstrap, and what is its
   removal date?
5. Is admin role a separate `user_roles` record or retained temporarily on the
   identity link?
6. What fresh-verification age is required for:
   - initial admin entry;
   - destructive organizer actions;
   - role/link recovery?
7. Should local logout also sign out from Runtime, or should the UI offer two
   explicit choices?
8. Are verified artifacts previews or durable provenance records?

## Better Auth

1. Can Better Auth 1.6.25 support the required custom Viby provider/session
   endpoint entirely through exported, versioned APIs?
2. If not, is a bounded Better Auth update acceptable, or should an upstream
   provider plugin be produced first?
3. How should GitHub OAuth behave when it is optional under badge-mode team
   ownership but required for admin linking?
4. Should admin sessions have the same TTL as team-owner sessions or a shorter
   policy?

## Operations

1. What is the compatibility-window duration?
2. Which operator approves the mapping from current Viby admin subjects to
   Better Auth user IDs?
3. What is the rollback retention window for the schema and environment
   backups?
4. When will `local.db.pre-p0-4.bak` be securely retained or destroyed under
   its existing runbook?
5. Is production local SQLite or remote libSQL the long-term supported target
   for this migration?

## Recommended decisions

- Require an existing Better Auth GitHub account for first-release admin
  linking; do not create users silently from Viby profile data.
- Enforce one active Viby identity per Better Auth user and one user per Viby
  identity.
- Separate roles from identity links.
- Retain the environment allowlist for one reviewed bootstrap migration only.
- Make Vibe logout and Runtime logout explicit separate choices.
- Treat artifacts as preview-only until durable provenance retention is
  separately approved.
- Stop implementation if a supported Better Auth extension or corrected SDK is
  unavailable.
