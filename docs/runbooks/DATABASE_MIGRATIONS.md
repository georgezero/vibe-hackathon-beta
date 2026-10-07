# Database migrations and fresh bootstrap

The canonical production-safe migration command is:

```bash
DB_FILE_NAME=/absolute/path/to/application.sqlite \
VIBE_DB_MIGRATION_CONFIRM="MIGRATE ALL DATABASE /absolute/path/to/application.sqlite" \
npm run db:migrate
```

`DB_FILE_NAME` must be an absolute path to a regular, canonical, non-symlinked
SQLite file. Remote `DATABASE_URL` targets are rejected. The protected
`local.db.pre-p0-4.bak` file is rejected. The command is explicit and
idempotent; it runs the ordered entries in
[`scripts/migrations/index.ts`](../../scripts/migrations/index.ts), then checks
the current schema, SQLite integrity, and foreign keys.

## Fresh database

For a brand-new disposable or development database, use the explicit bootstrap
mode:

```bash
DB_FILE_NAME=/absolute/path/to/new.sqlite \
VIBE_DB_BOOTSTRAP_CONFIRM="CREATE CURRENT SCHEMA DATABASE /absolute/path/to/new.sqlite" \
npm run db:migrate -- --bootstrap
```

The bootstrap path creates the target file only when its parent already exists,
uses the repository schema to create the current 72-table shape, and verifies
the result. It refuses a database that already contains tables. It is not a
production upgrade shortcut.

## Existing database upgrades

Existing application databases use the explicit ordered additive scripts listed
in the manifest. The sequence is:

1. Viby identity links;
2. admin and Better Auth/Viby session layers;
3. judge authorizations (required by account controls), then account controls,
   profiles, invitations and generic login;
4. submission onboarding and memberships;
5. project Team Chat, Direct Messages and Community channels;
6. judging operations;
7. results, calibration and publication;
8. H.2 participant experience telemetry/feedback.

Every entry retains its historical guarded script and confirmation semantics.
The orchestrator supplies those confirmations only after its own explicit
whole-database confirmation. Existing databases are never silently inferred to
be production.

Run the command twice on a disposable copy during qualification. Both runs must
pass integrity/FK checks and preserve authoritative business rows. Do not test
the upgrade path against the canonical production database without the backup,
disposable-copy, and separately approved deployment procedure.

## `db:push` boundary

`npm run db:push` remains a development-only Drizzle schema synchronization
tool. It is not the production migration history and must not replace
`npm run db:migrate`. The canonical path intentionally does not depend on a
generated, ignored Drizzle SQL migration directory.

The individual historical commands remain available for focused qualification;
the corrected Viby command is:

```bash
npm run db:migrate:viby-identity-links
```
