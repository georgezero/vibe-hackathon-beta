# Community Channel Operations

This runbook covers the event-scoped Community channel feature introduced in
F.3. It does not operate Team Chat, Direct Messages, Chatto, or Viby.

## Provision defaults (explicitly)

Never infer the event for provisioning. First dry-run with an explicit event ID
and absolute canonical database path:

```bash
npm run community:provision-defaults -- --event <event-id> --dry-run
```

Review the plan. To mutate, use the exact confirmation printed by the command:

```bash
VIBE_F3_PROVISION_CONFIRM="PROVISION COMMUNITY DEFAULTS <db-path> <event-id>" \
  npm run community:provision-defaults -- --event <event-id> --confirm
```

The operation is idempotent. It creates only these four defaults:

- `general` — participant discussion;
- `announcements` — organizer-only posting;
- `team-up` — participant discussion;
- `technical-help` — participant discussion.

The migration itself never provisions channels.

## Schema migration

The additive migration must be qualified on a disposable copy first and then
run twice on the approved database:

```bash
VIBE_F3_MIGRATION_CONFIRM="MIGRATE COMMUNITY CHANNELS DATABASE <db-path>" \
  npm run db:migrate:community-channels
```

Run `PRAGMA integrity_check` and `PRAGMA foreign_key_check` after each database
change. Expected first-run production state is zero community channels,
messages, reports, and read states until explicit event provisioning and user
activity occur.

## Production deployment record (F.3B)

The production event is `evt_vibe_2025`. F.3B applied and reran the additive
migration, then explicitly provisioned `general`, `announcements`, `team-up`,
and `technical-help` after the application health check. Provisioning was
dry-run first and the second mutation was idempotent. Production intentionally
contains no seeded community content. The full evidence is in
[`PHASE_F3B_PRODUCTION_DEPLOYMENT.md`](../participants/PHASE_F3B_PRODUCTION_DEPLOYMENT.md).

For an event-day change, use the same sequence: verified backup, disposable
copy migration/rerun, production migration/rerun, integrity/FK checks, then an
explicit event-ID provisioning dry-run. Never infer the event from the active
singleton and never copy Kentucky Vibes fixtures into production.

## Access and moderation

Authenticated active accounts may read and post ordinary discussion channels in
the selected/current event. Owning or joining a submission is not required for
global Community access. People, Direct Messages, and Community are the global
social layer; private project workspace and Team Chat continue to require
authoritative project membership.

Administrators may read all event channels and post announcements. Ordinary
participants may read announcements but cannot post there. Disabled or revoked
accounts, unauthenticated requests, unavailable/hidden event contexts, and
cross-event access remain denied. Judges follow the same global social policy
only when they also have a normal active account; judge authorization alone does
not grant project or moderation privileges.

Open `/admin/community` for the bounded moderation surface. Administrators can
archive/unarchive channels, create a channel with a safe slug, inspect reports,
and remove a message. Removal is a tombstone (`Message removed by an
organizer.`), not destructive participant-visible deletion, and is audited.
Participants cannot edit or delete messages. Channel reports are bounded and
must not be used to infer account details or automatically ban a participant.

Archived channels retain history, stop accepting participant posts, stop
accumulating unread counts, and remain available at the same route. The current
event lifecycle has no automatic archive job; archive/unarchive is an explicit
admin operation until event-operations policy supplies that transition.

## Event-day operations

- **Create a channel:** use `/admin/community` or the audited admin API with an
  explicit event-scoped request. Keep slugs lowercase, short, and reserved-word
  safe.
- **Archive/unarchive:** update channel status from `/admin/community`.
  Archived channels remain readable, stop posting and unread accumulation, and
  are not deleted.
- **Post an announcement:** open `#announcements` as an administrator. The
  server enforces `admins_only`; hiding the participant composer is not the
  authorization boundary.
- **Inspect reports:** use the Reports section in `/admin/community`. Review
  only the selected event's bounded report metadata.
- **Remove a message:** use the moderation action to create the participant
  tombstone `Message removed by an organizer.`; the action is audited and does
  not expose removed content in participant projections.
- **Disable Community:** first stop provisioning/new access with the existing
  release/feature-gate procedure if available, then preserve schema and history.
  Do not delete real messages as a rollback step.
- **Emergency rollback:** switch `/opt/vibe-hackathon/current` to the prior
  immutable release, restart only Vibe Hackathon, and verify local/public
  health. Leave additive Community tables in place unless integrity or
  unexplained business mutation requires a verified database restore.

## Safety checks

Before approving a change, confirm:

- channel access joins the requested event and never uses roster email/name
  matching;
- the participant projection contains no email, badge, Better Auth/Viby ID,
  role, judge data, or private profile fields;
- announcement posting is server-authorized, not merely hidden in the UI;
- message body does not enter generic logs, URLs, metadata, or public pages;
- only the active channel opens an SSE stream;
- archive/revocation causes HTTP authorization failure and no subsequent
  participant delivery;
- Team Chat tables, DMs, publication, judging, Chatto, and Viby remain
  unchanged.

## Kentucky Vibes review environment

Keep `https://kentucky-vibes-f0b.ggg.ad` running for product review. Its
service, proxy, and named tunnel are isolated from production. Synthetic
credentials are kept in mode-0600 files under
`/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/credentials/`;
never print or commit those passwords.

Useful checks:

```bash
systemctl --user is-active kentucky-vibes-f0b.service \
  kentucky-vibes-f0b-https-proxy.service \
  kentucky-vibes-f0b-cloudflared.service
curl -fsS https://kentucky-vibes-f0b.ggg.ad/api/health
```

Do not seed or copy this fixture into production. Keep Community channels and
messages event-private; they are not public profile/project content and must
not be indexed or added to a sitemap.
