# Phase F.3 — Event Community Channels

**Disposition:** GO — F.3 EVENT COMMUNITY READY FOR PRODUCT REVIEW
**Review window:** 2026-08-09 (EDT)
**Starting repository HEAD:** `a70edc28326108dfc84a69af303f680ceaa7f735`
**Environment:** isolated Kentucky Vibes only

F.3 adds event-scoped community channels alongside the existing project Team
Chat and person-to-person Direct Messages:

| Surface | Scope | Authorization |
| --- | --- | --- |
| Team Chat | one submission/team | existing submission membership |
| Messages | two durable people | authenticated participant + DM policy |
| Community | one event | authenticated active account; admin exception for moderation/announcements |

Production was not migrated or restarted. Chatto and Viby were not modified.

## Architecture

Community is an explicit domain rather than a nullable extension of Team Chat
or DMs. The additive schema is:

- `community_channels`: event, safe slug, type, posting policy, active/archived
  status, and ordering;
- `community_messages`: plain-text message, author, idempotent client message
  ID, and moderation tombstone fields;
- `community_message_events`: SSE/polling delivery cursor;
- `community_channel_read_states`: per-user read position;
- `community_message_reports`: bounded participant reports and admin review
  state.

All channel queries join the requested event. An authenticated active account is
admitted to ordinary event channels; submission owner/member relationships are
not required for global Community access. Roster email/name matching is never
used. Active administrators may moderate and read channels, and may post to
`announcements`; moderation authorization remains separate from ordinary
discussion posting.

Channel slugs are lowercase ASCII, hyphen-separated, 2–40 characters, unique
within an event, and protected by a centralized reserved set (`admin`, `api`,
`community`, `messages`, `people`, `projects`, `status`, `winners`, and other
application destinations). Channel IDs stay out of normal URLs.

## Participant behavior

The participant routes are:

- `/community` — event channel list and empty/selection state;
- `/community/:slug` — a channel conversation with bounded history,
  `Load older messages`, plain-text composer, profile links for public
  identities, and an archived read-only state.

Discussion channels allow active accounts to post. `announcements` is readable
by active accounts but accepts posts only from active administrators.
Private profiles still receive a stable minimal participant name in community;
public profiles add the safe `/people/:handle` link and optional headline or
affiliation. No email, badge, account/Viby ID, role, judge data, chat-private
data, or authorization metadata enters the participant projection.

Community blocking follows the F.2 decision: participant blocks continue to
deny DMs, but do not hide messages in a shared event channel. Reports are
bounded (`harassment`, `spam`, `off_topic`, `other`) and do not automatically
ban or notify the reported user. Administrators remove messages with a
participant-visible tombstone, preserving message identity and audit history.

The existing SSE transport is reused for the active channel only, with the
qualified polling fallback and server-side authorization on every poll. Read
state is per user and unread counts are bounded (displayed as `9+`). Channel
history is limited to 50 messages per request. There are no email/push/browser
notifications, channel search, threads, attachments, reactions, or presence.

## Navigation and design

Authenticated active-account navigation includes Community next to People and
Messages. The design inherits the dark Professional token system and the F.2
conversation rhythm: a quiet channel list, restrained unread pills, compact
participant identity, readable message stream, and a single-column mobile
conversation. It is intentionally not a Discord/Slack-style server sidebar.

The admin-only `/admin/community` surface is separate from `/admin/people`.
It lists channels, archives/unarchives, creates a bounded channel, and reviews
reports. Organizer posting still happens through the normal channel composer,
so the same audited authorization path is used for announcements.

## Migration and provisioning

`scripts/migrate-community-channels.ts` is additive, idempotent, and requires
an explicit absolute database path plus confirmation:

```bash
VIBE_F3_MIGRATION_CONFIRM="MIGRATE COMMUNITY CHANNELS DATABASE /absolute/path.sqlite" \
  npm run db:migrate:community-channels
```

Schema migration does not create channels or messages. Default channels are a
separate explicit, dry-run-first operation:

```bash
npm run community:provision-defaults -- --event evt_kentucky_vibes --dry-run
VIBE_F3_PROVISION_CONFIRM="PROVISION COMMUNITY DEFAULTS /absolute/path.sqlite evt_kentucky_vibes" \
  npm run community:provision-defaults -- --event evt_kentucky_vibes --confirm
```

Provisioning is idempotent and creates only `general`, `announcements`,
`team-up`, and `technical-help`. No production event was provisioned in F.3.
Event lifecycle currently uses manual archive/unarchive; automatic post-event
channel lifecycle is deferred to the event-operations policy rather than
inventing a second event state machine.

## Kentucky Vibes fixture

The stable review URL is:

`https://kentucky-vibes-f0b.ggg.ad`

It uses the isolated service, Better Auth origin, cookies, database, TLS proxy,
and named Cloudflare tunnel. The fixture contains six synthetic public,
discoverable participants (Maya Rivera, Alex Chen, Priya Nair, Jordan Lee, Sam
Okafor, and Elena Park), plus existing synthetic regression identities. All
emails use `.example.invalid`; no Viby links or real identities are used.

The live event fixture has:

- four active defaults and one archived qualification channel (`f3-temporary`);
- 87 plain-text messages after the browser qualification pass (37 General, 8
  Announcements, 19 Team-up, 23 Technical help);
- one bounded message report and one organizer tombstone;
- realistic multi-line, long-history, unread, profile-linked, and
  announcement-only states.

The synthetic organizer credential is protected at:

`/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/credentials/f3-admin.password`

with mode `0600`. The password is intentionally not documented.

## Browser qualification

Desktop Chromium and 390×844 mobile Chromium were exercised with synthetic
participant and organizer sessions:

1. login → Community → General;
2. send a participant message and receive a reply in a second browser context;
3. verify channel unread/read behavior and the Team-up profile links;
4. verify `announcements` has no participant composer;
5. verify organizer posting works;
6. submit a report and remove the reported message from `/admin/community`;
7. verify the organizer tombstone;
8. create and archive a temporary channel;
9. verify archived history remains readable and has no composer;
10. verify Community → public profile → Message affordance;
11. verify 390px routes have no horizontal overflow.

The final live SSE observation delivered a reply to the open General channel in
approximately **1.263 seconds** without reload. The mobile checks reported no
overflow (`scrollWidth` equal to the 390px viewport) on Community, General, and
Announcements; the composer was reachable in the single-column conversation.

Representative screenshots are in
[`screenshots/f3/`](./screenshots/f3/):

- [Community home — desktop](./screenshots/f3/community-home-desktop.png) ·
  [mobile](./screenshots/f3/community-home-mobile.png)
- [General — desktop](./screenshots/f3/community-general-desktop.png) ·
  [mobile](./screenshots/f3/community-general-mobile.png)
- [Announcements — desktop](./screenshots/f3/community-announcements-desktop.png) ·
  [mobile](./screenshots/f3/community-announcements-mobile.png)
- [Team-up](./screenshots/f3/community-team-up-desktop.png) ·
  [Technical help](./screenshots/f3/community-technical-help-desktop.png)
- [Community → profile/message](./screenshots/f3/community-profile-message-desktop.png)
- [Community → profile/message — mobile](./screenshots/f3/community-profile-message-mobile.png)
- [Mobile composer](./screenshots/f3/community-composer-mobile.png)
- [Organizer moderation](./screenshots/f3/admin-community-moderation-final.png)

This was an agent-operated browser rehearsal, not an independent human
usability study.

## Tests and performance notes

- focused community domain suite: **4 passed** (plus 5 admin API inventory checks);
- full isolated unit suite: **283 passed across 54 files**;
- TypeScript: passed;
- production build: passed;
- full ESLint: passed;
- changed-file ESLint: passed (only the repository's existing `img` warnings
  remain in shared navigation);
- `git diff --check`: passed;
- desktop/mobile browser qualification: passed;
- disposable canonical-shape migration twice: integrity and foreign keys passed;
- Kentucky migration twice: integrity and foreign keys passed.

The channel list performs one bounded read-state projection per provisioned
channel, and the conversation performs one bounded history query plus one
identity projection. Only the active channel opens SSE; unused channels do not
open streams. A production-scale search service is not required for the
qualified event-sized fixture.

## Production disposition

F.3B deployed the qualified Community foundation to production after the
additive backup/migration procedure and explicit event provisioning. Production
now has exactly four active default channels for `evt_vibe_2025` and no seeded
messages, read states, reports, or archived test channels. Profiles, People,
Direct Messages, Team Chat, submissions, judging, publication, Chatto, and Viby
were preserved. The deployment record, final database verification, smoke
qualification, and rollback procedure are in
[`PHASE_F3B_PRODUCTION_DEPLOYMENT.md`](./PHASE_F3B_PRODUCTION_DEPLOYMENT.md).

## Deferred work

Group DMs, channel categories, threads, reactions, attachments, edits/deletes,
typing/presence, bots, AI moderation/summaries, public internet access, and
community search are intentionally deferred.

## H.4R social-access policy supersession

The original F.3 participant gate was intentionally superseded by H.4R. Event
channels remain event-scoped, but ordinary authenticated active accounts may
read and post in discussion channels without an owner or active submission
membership relationship. Announcement posting remains organizer/admin-only;
archived channels remain read-only; moderation, reporting, safe identity
projections, and hidden-event/channel fail-closed behavior are unchanged.
Private project workspaces and Team Chat continue to require their own
authoritative submission membership checks. See
[`PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md`](PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md).

## F.3A readability refinement

F.3A retained the event-channel architecture and introduced a presentation-only
readability pass. The stream now groups same-sender turns within a five-minute
same-day threshold, adds date separators, uses a restrained accent wash for
the signed-in user's own messages, hides Report behind hover/focus (while
keeping it available on touch), and renders moderation tombstones as muted
organizer rows. Announcement posts receive a small Organizer update label and
archived channels are visually secondary under an Archived subsection.

The live Kentucky Vibes fixture remains at
`https://kentucky-vibes-f0b.ggg.ad`. F.3A screenshots are in
[`screenshots/f3a/`](./screenshots/f3a/) and the detailed review, qualification
results, and deployment recommendation are in
[`PHASE_F3A_COMMUNITY_UX_REFINEMENT.md`](./PHASE_F3A_COMMUNITY_UX_REFINEMENT.md).

F.3A passed the focused suite (12 tests), the full suite (286 tests),
TypeScript, changed-file ESLint, production build, desktop/mobile Chromium,
the accessibility/overflow review, and a live two-browser SSE check. No
production, Chatto, or Viby state changed.

## Decision

**GO — F.3A COMMUNITY UX READY FOR PRODUCT REVIEW**
**RECOMMEND DEPLOYING F.3 TO PRODUCTION** after the normal production safety
review and explicit deployment approval. The authorization, event isolation,
moderation tombstone, realtime, and readability checks are green; F.3 channels
remain a deliberately small event-scoped community surface.
