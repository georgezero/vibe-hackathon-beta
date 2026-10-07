# Event database operator runbook

Run commands from the repository root. The active production database is never
implicitly selected by simulation commands.

## Snapshot and inspect

```sh
npm run db:event:snapshot
npm run db:event:list
npm run db:event:inspect -- current
npm run db:event:status
```

## Build and validate Kentucky Vibes

```sh
VIBE_EVENT_SIMULATION=1 npm run event:db:create -- kentucky-vibes --profile realistic --seed 20260802
npm run event:db:validate -- kentucky-vibes-base
```

## Create scenario artifacts

```sh
for scenario in healthy-event operations-stress calibration-challenge publication-rehearsal; do
  VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario "$scenario" --seed 20260802
done
```

## Restore current event (explicit confirmation required)

```sh
npm run event:restore:current -- \
  --confirm $'RESTORE VIBE DATABASE\nFROM /opt/vibe-hackathon/database-snapshots/current-event-vibe-hackathon-2026-20260803T013302Z-939852c5309e.sqlite\nTO /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db\nEVENT evt_vibe_2025'
```

The command prints the source checksum/event, creates a pre-restore backup, and
requires the full four-line string. `yes`, a wildcard, an empty source, a
symlink target, or a browser-controlled confirmation is rejected.

## Activate Kentucky Vibes (not run in E.0)

```sh
npm run event:db:activate:kentucky-vibes -- \
  --confirm $'RESTORE VIBE DATABASE\nFROM /opt/vibe-hackathon/database-snapshots/kentucky-vibes-base-realistic-20260802-20260803T022500Z.sqlite\nTO /home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db\nEVENT evt_kentucky_vibes'
```

After a human-approved activation, set the service environment to
`VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes`, verify synthetic health and personas,
then restore `current` before ending the maintenance window. A separate
simulation service/port is preferred for load testing.

## Cleanup

Remove only exact generated artifacts under
`/opt/vibe-hackathon/database-snapshots/` after confirming no process uses them.
For example, the cleanup wrapper requires the complete artifact path and exact
confirmation:

```sh
npm run db:event:cleanup:kentucky-vibes -- \
  --artifact /opt/vibe-hackathon/database-snapshots/kentucky-vibes-healthy-event-20260802.sqlite \
  --confirm 'DELETE SYNTHETIC EVENT ARTIFACT /opt/vibe-hackathon/database-snapshots/kentucky-vibes-healthy-event-20260802.sqlite'
```

Do not remove current-event snapshots, verified backups, the canonical DB, or
files by email/timestamp pattern. Remove temporary mode-0600 credential files
after the run.
