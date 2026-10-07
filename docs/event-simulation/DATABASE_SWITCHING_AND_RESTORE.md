# Database switching and restore

The current deployment uses a fixed writable path (`DB_FILE_NAME`) rather than
an active symlink. Immutable artifacts are cloned into a writable target; the
service never writes directly into a snapshot.

## Restore contract

```sh
npm run db:event:restore -- current \
  --target /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db \
  --event evt_vibe_2025 \
  --confirm $'RESTORE VIBE DATABASE\nFROM /opt/vibe-hackathon/database-snapshots/current-event-vibe-hackathon-2026-20260803T013302Z-939852c5309e.sqlite\nTO /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db\nEVENT evt_vibe_2025'
```

The command verifies source checksum, integrity, foreign keys, regular-file
target, event identity, and required schema tables. It creates an immutable
online backup of the current target under
`/opt/vibe-hackathon/database-snapshots/pre-restore-*`, stops only
`vibe-hackathon.service` in the user systemd manager, writes a temporary target
in the same directory, fsyncs, atomically renames, restarts, and checks health
and event identity. Health failure triggers automatic rollback from the
pre-restore backup.

`npm run event:restore:current` is a convenience wrapper that still requires
the full confirmation. Kentucky activation is equivalent:

```sh
npm run event:db:activate:kentucky-vibes -- \
  --confirm $'RESTORE VIBE DATABASE\nFROM /opt/vibe-hackathon/database-snapshots/kentucky-vibes-base-realistic-20260802-20260803T022500Z.sqlite\nTO /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db\nEVENT evt_kentucky_vibes'
```

E.0 did not execute either production-targeting command. A safe temp-target
restore was qualified with the same path checks, automatic backup, and health
check while the live service remained untouched.

## Failure behavior

Before replacement, errors leave the target untouched. After replacement, a
failed readiness/health check stops the service, restores the automatic backup
atomically, restarts it, and reports the rollback result. Chatto, Viby, and the
Cloudflare tunnel are not managed by these commands.
