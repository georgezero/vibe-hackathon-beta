# Kentucky Vibes instance operations

This runbook is for the isolated loopback instance only. It must never be used
to replace the current event database.

## Start, stop, health

```sh
systemctl --user start kentucky-vibes.service
systemctl --user start kentucky-vibes-https-proxy.service
systemctl --user status kentucky-vibes.service --no-pager -l
curl -k https://127.0.0.1:3240/api/health
systemctl --user stop kentucky-vibes-https-proxy.service
systemctl --user stop kentucky-vibes.service
```

## Personas

```sh
npm run event:persona:list -- kentucky-vibes
npm run event:persona:show -- kentucky-vibes judge_high_workload
```

The credential file is
`/opt/vibe-hackathon/instances/kentucky-vibes/credentials/personas.json` and
must remain mode `0600`, outside the repository. Do not print all credentials or
place them in screenshots/logs.

For a scheduled human rehearsal, regenerate a fresh roster under
`/opt/vibe-hackathon/instances/kentucky-vibes/e2-credentials/`, assign tester
aliases privately, and delete it after the event snapshot. The E.2 preparation
roster was unassigned and has been removed.

## Scenario checks

Scenario artifacts are immutable. Validate them before cloning:

```sh
npm run event:db:validate -- kentucky-vibes-base
sha256sum /opt/vibe-hackathon/database-snapshots/kentucky-vibes-*.sqlite
```

Use a new writable clone and a temporary loopback port for a scenario. Stop the
temporary process by its recorded PID before removing its directory. Never
write to a `0440` artifact.

## Current-event safety

```sh
curl -fsS http://127.0.0.1:3000/api/health
sha256sum /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db
systemctl --user show vibe-hackathon.service -p MainPID -p NRestarts -p ActiveState
```

Expected production checksum is
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`.
If it changes, stop Kentucky qualification and investigate before any further
action.

## Rollback and cleanup

Stop only the two Kentucky services, preserve immutable artifacts, and remove
only the exact writable instance directory after recording its checksum. Never
delete by email domain, timestamp, or wildcard. Keep the E.0 current-event
snapshot and all verified pre-restore backups.
