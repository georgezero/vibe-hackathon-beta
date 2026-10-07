# Operations and rollback

Native chat uses the existing Vibe database and is disabled by default with
`VIBE_NATIVE_TEAM_CHAT_ENABLED=false`. A controlled pilot should additionally
set `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS` to an explicit test submission allowlist.

Migrations are additive and separate:

```text
VIBE_C2A_MIGRATION_CONFIRM="MIGRATE SUBMISSION MEMBERSHIPS DATABASE /absolute/path/local.db" \
  DB_FILE_NAME=/absolute/path/local.db npm run db:migrate:submission-memberships
VIBE_C2B_MIGRATION_CONFIRM="MIGRATE NATIVE CHAT DATABASE /absolute/path/local.db" \
  DB_FILE_NAME=/absolute/path/local.db npm run db:migrate:native-chat
```

Both commands refuse remote databases, symlinks, the protected backup, and
missing explicit confirmations. Run each twice and run `PRAGMA
foreign_key_check` before any pilot.

If messaging fails, the UI presents a bounded retryable unavailable state;
login, submissions, edit-token APIs, My Projects, administration, judging,
and public projects remain separate. Rollback disables the flag and restores
the prior immutable application release. Additive tables and message history
are preserved unless a verified migration corruption requires a database
restore.

## C.3 pilot gate

Disposable qualification is recorded in
`PHASE_C3_DISPOSABLE_QUALIFICATION.md`. Production remains disabled until an
operator approves one exact submission and two test accounts, verifies a
backup, runs both migrations twice, and confirms five-second revocation live.
The pilot uses `VIBE_NATIVE_TEAM_CHAT_ENABLED=true` plus
`VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=<exact-id>`; it is never a global
activation.

## C.5 workspace gate

C.5 adds a membership-gated project shell and a safe Activity projection. It
does not add a migration. Production remains on the synthetic
`sub_QUPapzbr` allowlist until an operator approves a real submission and its
owner. Do not expand the allowlist from an email, roster row, or matching user.

The approved deployment sequence is: verified backup, migration/integrity
checks if pending, immutable build, exact flag/allowlist configuration, restart
only Vibe Hackathon, then owner/teammate/revocation qualification. Remove real
IDs from the allowlist for the primary rollback; preserve additive chat,
membership, invitation, activity, and message history. Chatto and Viby are not
part of this rollback.

## C.5D deployment

The authenticated workspace is deployed, but native chat remains synthetic-only:
`VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=sub_QUPapzbr`. No real submission was added.
The deployed artifact is
`a70edc28326108dfc84a69af303f680ceaa7f735-c5-team-workspace-20260801T231500Z`;
the previous C4R release remains the rollback target. The deployment report
records the verified backup, twice-run migrations, PID, health, and remaining
authenticated walkthrough gate.
