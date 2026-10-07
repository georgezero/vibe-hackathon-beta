# Participant Experience Observability Runbook

This runbook covers the bounded H.2 observation layer. H.2B is deployed on
production as an additive observation layer; this document does not authorize
future migrations, synthetic production seeding, or product changes.

## What the layer collects

The layer stores fixed participant journey transitions and optional short
feedback, scoped to an event. It does not store arbitrary URLs, clickstream,
IP addresses, user-agent strings, tokens, project/chat content, message bodies,
Better Auth IDs, or Viby assertions. Authoritative event, submission, team,
membership, communication, judging, and publication records remain separate.

Raw journey rows are retained for 90 days; feedback rows for 180 days. This is
an observation retention policy, not a deletion policy for business or audit
history.

## Review

An explicitly authorized organizer opens:

`/admin/participant-experience`

Use Today, Last 24 hours, Last 7 days, or Event to date. Read the denominator
shown with the journey progression. Treat guardrails (readiness, deadline,
freeze, authorization) as expected policy until frequency, repetition, and
participant feedback suggest otherwise. Review authoritative operational pages
before changing event or participant state.

Feedback state changes are intentionally limited to New, Reviewed, Resolved,
and Dismissed and are audited as `participant_feedback_status_updated`.

## Disposable qualification / migration

Always target an explicit absolute regular non-symlink disposable SQLite file.
Never use the canonical production DB for these commands.

```bash
DB_FILE_NAME=/absolute/path/to/clone.sqlite \
VIBE_H2_MIGRATION_CONFIRM="MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE /absolute/path/to/clone.sqlite" \
npm run db:migrate:participant-experience

VIBE_EVENT_SIMULATION=1 NODE_ENV=test \
DB_FILE_NAME=/absolute/path/to/clone.sqlite \
VIBE_H2_OBSERVATION_CONFIRM="SEED H2 OBSERVATION DATABASE /absolute/path/to/clone.sqlite" \
npm run db:seed:h2-observation -- evt_kentucky_vibes
```

The migration is additive and idempotent. Re-run integrity and foreign-key
checks after it. The seed command refuses production and requires simulation
mode plus exact confirmation; it is never a production smoke command.

## Cleanup

Run only against a disposable or explicitly approved observation database after
checking its path and backup status:

```bash
DB_FILE_NAME=/absolute/path/to/clone.sqlite \
VIBE_H2_CLEANUP_CONFIRM="CLEANUP H2 PARTICIPANT EXPERIENCE DATABASE /absolute/path/to/clone.sqlite" \
npm run db:cleanup:participant-experience
```

The cleanup script deletes only expired H.2 telemetry/feedback rows. It does
not delete authoritative audit, submission, roster, membership, invitation,
chat, DM, Community, judging, or publication rows. Record the target, UTC
timestamp, counts, integrity result, and FK result in the event operator log.

## Event-day interpretation

1. Select a bounded window and note the event state/deadline separately.
2. Compare Start, project, editor, Preview, finalization attempt, and finalized
   unique-participant counts; do not call the display a linear funnel.
3. Review friction reasons alongside denominator and feedback category.
4. Check authoritative readiness/finalization/deadline data before escalating a
   guardrail.
5. Treat repeated stale edits, repeated validation failures, or invitation
   expiry clusters as investigation signals, not automatic participant blame.
6. Do not export or copy participant digests; the dashboard intentionally hides
   them.
7. Document a bounded next product question. Do not make automated UX changes
   from telemetry.

## Access and boundaries

Only authenticated administrators may view or change the dashboard. Judges and
ordinary participants must receive denial and cannot use it for participant
enumeration. Do not expose feedback text in public pages or send it through
Chatto/Viby. Do not restart or alter Chatto/Viby while reviewing H.2.

## H.2B production activation

Production observation activated at `2026-08-10T20:49:56Z` on
`/opt/vibe-hackathon/releases/h2-observability-20260810T205000Z` (HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735`, source fingerprint
`c8eebc29ef95e54729c383e538d18bbf80fd025201010aae5823b8ba2c4a4575`). The
canonical migration was guarded, run twice on a disposable copy and twice on
production, and followed by integrity/FK checks. Only
`vibe-hackathon.service` was restarted. Chatto, Viby, Kentucky Vibes, and
unrelated services were not restarted.

The initial read-only smoke left 4 null-participant `participant_start_viewed`
rows and 0 feedback rows. These are intentional anonymous Start-view signals,
not synthetic participant journeys. Do not add rows to make the dashboard look
active; wait for organic participant use. The standing Kentucky Vibes hostname
still has an unrelated Cloudflare 530 because its configured origin on port
3455 has no running service; its DB was not changed.

Rollback is application-only: atomically restore the prior H.1 release and
restart only `vibe-hackathon.service`. Keep additive H.2 tables and real rows.
Restore the DB only for migration corruption, integrity/FK failure, unexpected
authoritative business mutation, or corruption.

## First observation review

At the first meaningful event window, record the window and event lifecycle,
then review:

1. Start/project/editor/Preview/finalization signals with their denominators.
2. Authoritative submission/readiness/finalization counts alongside the signals.
3. Repeated bounded friction reasons and feedback categories.
4. Device class only as desktop/mobile/unknown.
5. Feature adoption in aggregate, never per participant.

Do not conclude that a low transition rate proves a UX defect. Investigate
revisits, readiness state, deadline/freeze state, error repetition, and explicit
feedback before defining H.3. Do not export digests, identify participants,
rank activity, or automate interventions.
