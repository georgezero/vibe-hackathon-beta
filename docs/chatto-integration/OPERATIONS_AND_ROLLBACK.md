# Operations, backup, and rollback

## Current state

Chatto is a Docker Compose stack with Chatto, NATS, LiveKit, and a Cloudflare
Tunnel path. Persistent state is external NATS JetStream, not a Chatto container
mount. The public `/health` route is an HTML shell, so monitoring must use an
explicit Chatto/operator probe, container health, or a newly agreed endpoint.

The current logs show repeated LiveKit TLS handshake failures. This does not
prove text messaging is broken, but it makes voice/calls unsuitable for the
pilot and should be tracked separately.

## Backup and restore

Use the documented `chatto backup` command with encryption and protected key
custody. Backups should be version-pinned, checksummed, access-controlled, and
tested in an isolated NATS/Chatto copy. `--include-keys` creates sensitive,
decryptable material and must not be used casually. Restore requires Chatto to
be stopped when external NATS is used; restore conflict policy and downtime
must be rehearsed before production data exists.

## Upgrade and rollback

- pin the image digest rather than `latest`;
- record Chatto source/image versions and NATS schema compatibility;
- take an encrypted backup before upgrade;
- rehearse restore and rollback in isolation;
- canary API discovery, room reads, message writes, and realtime after upgrade;
- keep Vibe routes and authorization independent so Chatto rollback cannot take
  down submissions, login, judging, or administration.

Do not make a Chatto migration part of a Vibe database transaction. Provisioning
must be idempotent and retryable with a visible pending/error state.

## Resource and failure isolation

Monitor NATS storage growth, JetStream lag, container memory/CPU, log rotation,
LiveKit errors, tunnel availability, and message/API latency. If Chatto is
unavailable, Vibe should show a bounded “messaging unavailable” state while
submission editing and other application paths continue normally.

No production backup, restart, configuration change, or database connection
was made during C.2A.
