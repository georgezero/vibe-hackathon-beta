# Operations and rollback

Keep the current snapshot and its checksum in protected storage. Before any
activation, create a fresh snapshot and verify it. Activate only a writable
clone; never make an immutable artifact writable in place.

If activation fails, use the exact `event:restore:current` command from
`DATABASE_SWITCHING_AND_RESTORE.md` with the preserved `current` artifact. The
restore tool creates another automatic pre-restore backup and rolls back
automatically on health failure. Confirm the event ID/slug is
`evt_vibe_2025`/`vibe-hackathon-2026`, real assignment/score counts are
unchanged, event publication remains unpublished, health is 200, and the user
systemd service reports the expected PID and restart count.

No Chatto, Viby, Cloudflare, or unrelated service is restarted. Simulation
artifacts can be removed only by exact recorded path after no process references
them. Credential files are removed separately.

For E.1, prefer the separate `kentucky-vibes.service` instance and local TLS
proxy documented in `../runbooks/KENTUCKY_VIBES_INSTANCE_OPERATIONS.md`. Stop
only those services after a mock event. The current service remains on port
3000 and must retain its E.0 checksum.
