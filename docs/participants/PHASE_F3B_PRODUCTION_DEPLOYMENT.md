# Phase F.3B — Production Deployment of Event Community Channels

**Disposition:** GO — EVENT COMMUNITY DEPLOYED AND QUALIFIED
**Deployment date:** 2026-08-09 (EDT)
**Production URL:** `https://vibe-hackathon-dev.ggg.ad`
**Kentucky Vibes review URL:** `https://kentucky-vibes-f0b.ggg.ad`

F.3/F.3A Community was deployed after the qualified Kentucky Vibes review. The
deployment kept Team Chat, Direct Messages, profiles, People, submissions,
judging, publication, Chatto, and Viby separate and unchanged.

## Baseline and release

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Previous release/rollback: `a70edc28326108dfc84a69af303f680ceaa7f735-f2b-participant-foundation-20260809T043133Z`
- Final release: `a70edc28326108dfc84a69af303f680ceaa7f735-f3b-community-20260809T142500Z`
- Canonical database: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deployment SHA-256: `de5fac3e0948339d79118656e7555e7fe86d9d10c90b051a5f9421e188f23f61`
- Pre-deployment backup: `/opt/vibe-hackathon/backups/production-pre-f3b-20260809T140021Z.sqlite` (0600, verified)
- Final database SHA-256: `b78b0bb1a5d503a7b3bf60218abf174a0367414a080322284faa83845fe3cdc5`

The deployment switched the immutable `current` link and restarted only
`vibe-hackathon.service`. The old PID was `3817485`; the final PID is
`1112475`, started at `2026-08-09 10:24:42 EDT`, with restart count `0`.
Local and public health both returned HTTP 200. Chatto and Viby were not
restarted.

## People identity verification

The repeated names visible in the Kentucky Vibes screenshots are distinct
synthetic profiles with coincidental names. The F.1 directory query reads one
row per durable `user_profiles.user_id`, then aggregates up to two project
references by project ID. It does not produce duplicate cards for a single
profile. No code change was needed.

## Migration and provisioning

The additive `migrate-community-channels` migration was applied to a disposable
canonical-shaped copy and rerun successfully, then applied and rerun against
production. Integrity and foreign-key checks passed each time. The migration
created schema only: no channels, messages, read states, or reports.

After the application health check, the explicit provisioning command was run
for `evt_vibe_2025`. Its dry-run planned exactly four channels and its mutation
was rerun idempotently with no further changes:

| slug | policy | status |
| --- | --- | --- |
| `general` | participants | active |
| `announcements` | admins only | active |
| `team-up` | participants | active |
| `technical-help` | participants | active |

Production began with four channels, zero community messages, zero read states,
zero reports, zero moderation tombstones, and no archived qualification
channel. Kentucky Vibes messages were not copied.

## Production smoke and authorization

A temporary account, `f3b-smoke@participant-smoke.example.invalid`, was created
through the supported password provisioning tool. It had no membership, judge
authorization, administrator authorization, or Viby link. Normal browser login
verified Account, Profile, private preview, People, Messages, logout, and the
existing private Team Chat denial boundary. The account was not made a
participant and no production message was posted.

The account's lazy profile remained private with no handle and
`discoverable = false`. Its sessions were revoked through account-management
operations, the account was disabled as a referential tombstone, and the
temporary password file was shredded. Final state is private/undiscoverable,
disabled, with zero sessions.

Because this bounded account was not an event participant, `/community` and
`/community/:slug` correctly failed closed with generic 404 behavior. An initial
smoke exposed a 500 on the Community landing page for this case; the route was
fixed to apply the same generic `participant_required`/`channel_forbidden`
handling as the channel route. The fix was rebuilt, linted, and deployed in the
final immutable release. Kentucky Vibes retained the positive participant and
admin-path qualification.

Unauthenticated checks returned redirects for `/community` and
`/community/:slug`, and 401 for Community APIs. A participant cannot reach
`/admin/community`; positive moderation and announcement paths remain qualified
in Kentucky Vibes and require an administrator authorization in production.
No production admin credential or synthetic production channel was used.

## Preservation and privacy

Production final counts include four community channels and zero community
messages/read states/reports/events. Direct conversations, direct messages,
blocks, reports, Team Chat rooms/messages, submissions, owners, memberships,
roster, judges, assignments, scores, publication records, and Viby links match
the verified pre-deployment backup. The only expected account-domain additions
are the bounded disabled smoke account/profile and its session/audit lifecycle.

The authoritative publication release remains `calculated` with no
`published_at`; no real results were published. Public route scans found no
Community content in public pages, profiles, or project output. Community APIs
and pages remain authenticated/event-scoped, and generic logs contained no
passwords, cookies, Viby assertions, tokens, or message bodies.

## Qualification and Kentucky demo

- F.3/F.3A focused coverage: passed.
- Full isolated suite after the bounded route fix and regression coverage: **290 tests passed across 56 files**.
- TypeScript, production build, changed-file ESLint, and `git diff --check`: passed.
- Desktop/mobile, realtime, moderation, accessibility, and overflow review: passed in Kentucky Vibes.
- Repository-wide lint still has the documented unrelated baseline failures outside the changed community files.
- Kentucky Vibes remains active at `https://kentucky-vibes-f0b.ggg.ad` with its synthetic channels/messages, named tunnel, and protected mode-0600 credentials.

## Rollback

Application rollback is the previous immutable release followed by restarting
only Vibe Hackathon and checking local/public health. The additive F.3 schema
can remain in place for an older release that ignores it. Database restore is
reserved for integrity/FK failure, migration corruption, or unexplained
business-table mutation; it was not required here.

## Final recommendation

**GO — EVENT COMMUNITY DEPLOYED AND QUALIFIED**
**HOLD F.4 — observe participant use before adding further community features.**

Do not import the Kentucky fixture or add channels, messages, reactions,
attachments, threads, presence, bots, or global community search without a
separate approved phase.
