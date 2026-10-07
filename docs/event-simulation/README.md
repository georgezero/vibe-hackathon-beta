# Event database snapshots and simulation

Phase E.0 adds an operator-managed workflow for preserving the current event
and exercising the application against a separate `kentucky-vibes` event. The
current event remains the source of truth. Simulation artifacts are immutable
SQLite files and are never written by the production service.

## Safety boundary

The production database is `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`.
The preserved snapshot is:

`/opt/vibe-hackathon/database-snapshots/current-event-vibe-hackathon-2026-20260803T013302Z-939852c5309e.sqlite`

SHA-256: `175d642962b10edb4d6f0ca3602b35a9b4fbeaa90f39dabff014a13a5fd4d7c0`.

No activation or database replacement was performed in E.0. The approved next
step is a human-controlled activation using the exact confirmation documented
in [the operations runbook](../runbooks/EVENT_DATABASE_OPERATIONS.md).

## Commands

```sh
npm run db:event:snapshot
npm run db:event:list
npm run db:event:inspect -- current
npm run db:event:status
VIBE_EVENT_SIMULATION=1 npm run event:db:create -- kentucky-vibes --profile realistic --seed 20260802
npm run event:db:validate -- kentucky-vibes-base
VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario healthy-event --seed 20260802
```

The restore and activation commands deliberately stop at the exact typed
confirmation prompt unless an operator supplies the complete source, target,
and event string. They never accept `yes` as confirmation.

Seed and simulation commands require the explicit `VIBE_EVENT_SIMULATION=1`
environment marker (or a development/test runtime), and reject any event slug
other than `kentucky-vibes`.

See [the current snapshot](CURRENT_EVENT_SNAPSHOT.md), [switching and restore](DATABASE_SWITCHING_AND_RESTORE.md), [the seed](KENTUCKY_VIBES_SEED.md), [scenarios](KENTUCKY_VIBES_SIMULATION.md), and [the operator runbook](../runbooks/EVENT_DATABASE_OPERATIONS.md).

E.1 isolated-instance qualification is recorded in
`KENTUCKY_VIBES_INSTANCE.md`, `AUTHENTICATED_SCALE_QUALIFICATION.md`,
`SCENARIO_QUALIFICATION.md`, and `PHASE_E1_SCALE_QUALIFICATION.md`. The
loopback-service operations are in
`../runbooks/KENTUCKY_VIBES_INSTANCE_OPERATIONS.md`.

E.2 preparation and the human-observation templates are in
`PHASE_E2_HUMAN_MOCK_EVENT.md`, `HUMAN_OBSERVATION_FINDINGS.md`, and
`EVENT_READINESS_BACKLOG.md`. No human rehearsal is considered complete until
approved testers have filled those records.

E.3 event-day qualification and the operator runbook are in
`PHASE_E3_EVENT_DAY_READINESS.md` and
`../runbooks/EVENT_DAY_OPERATIONS.md`. E.3's synthetic qualification is not a
substitute for the approved human rehearsal; production remains protected and
real results remain unpublished.
