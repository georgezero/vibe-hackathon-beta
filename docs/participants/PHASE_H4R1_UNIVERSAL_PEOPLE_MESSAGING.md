# H.4R.1 — Universal People Messaging

**Disposition:** GO — H.4R.1 UNIVERSAL PEOPLE MESSAGING READY FOR PRODUCT REVIEW
**Recommendation:** RECOMMEND H.4R.1 PRODUCTION DEPLOYMENT (separate approval required)

H.4R.1 was implemented and qualified in a disposable Kentucky Vibes clone. It
was not deployed to production or to the standing Kentucky service.

## 1. Operator policy and previous model

H.4R removed project/event-membership gates from global People, Direct Messages,
and Community, but retained a second DM eligibility projection. That made a
visible People card potentially non-messageable because of a hidden
preference, block projection, or event-derived check. The operator-approved
policy is now:

    visible in People + viewer is not the owner
        → Message is available

People visibility remains the authoritative discovery boundary. The only
ordinary exceptions are the viewer's own card and profiles excluded upstream
because the account is disabled/deactivated or the profile is private and
non-discoverable. Blocks remain an explicit safety control enforced by the
server.

## 2. Audit and authoritative boundaries

The audit traced `/people`, `/people/:handle`, the safe profile projection,
conversation `findOrCreate`, DM send/read/block/report, account controls,
Community access, H.1 navigation, and the Kentucky synthetic fixtures.

The old discontinuity was in two places: People called
`directMessageEligibilityForUsers`, and profile rendering called
`canInitiateDirectMessage`; both consulted more than the directory's own
visibility projection. `eligibleRecipient` also rejected a stored
`allowIncoming = none` value. Community remains the H.4R active-account
policy, and project workspace/Team Chat continue to use submission membership.

## 3. New social policy

An authenticated active sender may start a durable DM with any other active,
discoverable person returned by People. The DM authority still enforces:

- authenticated active sender;
- no self-message;
- active/non-disabled recipient account;
- canonical one-to-one pair ordering and uniqueness-race reuse;
- either-direction block enforcement;
- bounded message validation and rate limits.

No project ownership, membership, shared event submission, roster, team,
special eligibility flag, or recipient session is required. A recipient may be
logged out or have zero sessions; messaging is asynchronous durable storage.
Existing conversations remain governed by block and account-state rules.

## 4. People and profile UI

`lib/people-directory.ts` now returns `isSelf`, not a per-card `canMessage`
calculation. It retains only bounded directory, filter, project-history, and
self-state work. Every non-self card renders the existing labeled
`MessageProfileButton` alongside `View profile`; no N+1 preference, block, or
conversation preload is needed.

Discoverable other-person profiles render `Message` near the profile header
actions. Own profiles retain `Edit profile` and never show “Message yourself.”
External Website/GitHub/LinkedIn links remain secondary. The existing button
creates or reuses the canonical conversation and routes to `/messages/:id`.

## 5. Legacy `allowIncoming` handling

The participant-facing “Who can message you?” control was removed from the
profile editor. The additive preference table and self-only compatibility API
remain so old stored rows and clients do not cause a schema or migration break.
`allowIncoming = none` is now ignored by DM initiation, conversation access,
and message sending; the API marks the response as deprecated and returns the
effective `participants` policy. Blocks, not a hidden preference, are the
participant safety mechanism. No schema deletion or migration was required.

## 6. Community and project boundaries

H.4R Community behavior is preserved: authenticated active accounts can use the
current event's Community without a project relationship; announcements remain
organizer-only and event/channel scope remains authoritative. Navigation is
presentation only and every Community route/API independently authorizes.

The same zero-project account remains denied private project workspaces and
Team Chat without owner/member authority. H.1 ordering, H.2 bounded telemetry,
H.3 empty states, Better Auth, Viby, judging, publication, blocking, and
reporting are unchanged.

## 7. Offline recipient qualification

The direct-messaging focused fixture created a sender/recipient pair, inserted
the recipient's legacy `allowIncoming = none` row, and removed any recipient
session rows when a session table was present. The sender created/reused one
canonical conversation and persisted a message. Recipient history projected
the message and the recipient inbox showed an unread count; no session or
presence check exists in the DM authority. The recipient can subsequently log
in and use the normal Messages route.

## 8. Kentucky qualification

Browser qualification uses a fresh disposable clone derived from the Kentucky
Vibes test data. The standing service and its database were not changed. The
clone includes dense public/discoverable People fixtures, a zero-project
participant, an `allowIncoming = none` recipient, an existing DM pair, block
cases, Community channels, and project/Team Chat authorization boundaries.

Qualification clone:

    /opt/vibe-hackathon/instances/kentucky-vibes-h4r1-qualification-20260811T093202Z/data/h4r1-qualified.sqlite

The clone passed SQLite integrity and foreign-key checks before and after the
browser run. Browser probes generated only disposable synthetic conversation,
message, and session rows in this clone.

Synthetic qualification data is not evidence about real participant behavior.
No production accounts, DMs, messages, memberships, Community posts, Chatto,
Viby, or publication state were modified.

## 9. Required journeys

Desktop and approximately 390px mobile qualification covered:

1. Zero-project account → My Projects → People → Message directly from cards.
2. At least five People cards, each non-self card showing Message.
3. People → profile → Message, reusing the existing conversation.
4. Own card/profile with no Message-yourself action.
5. Legacy `allowIncoming = none` recipient still messageable.
6. Offline recipient with zero sessions receives durable message and later sees
   the unread conversation after login.
7. Blocked pair remains denied by the server with neutral UI.
8. Community is visible/usable for the zero-project account and the account
   posted one synthetic General-channel message.
9. Private project workspace and Team Chat remain denied to that account.

## 10. Screenshots and design review

Synthetic screenshots are stored in
[`screenshots/h4r1/`](screenshots/h4r1/), including dense People cards, profile
Message action, resulting DM, legacy-preference recipient, Community, and
mobile variants. A contact sheet is included at
[`screenshots/h4r1/contact-sheet.png`](screenshots/h4r1/contact-sheet.png).

Impeccable Design review kept Message labeled, restrained, and adjacent to
View profile; no icon-only mystery action, button soup, or new navigation
category was introduced. Mobile card actions remain tappable without horizontal
overflow.

## 11. Tests and quality gates

- H.4R.1 focused/source assertions: passed through the H.4R continuity suite.
- H.4R, H.4, Direct Messages, and Community focused tests: passed.
- Offline-recipient and legacy-preference regression: passed.
- Full repository suite: **348 tests across 66 files passed** in the isolated
  harness. Expected Viby guardrail stderr (conflicting/revoked fixture links
  and explicit migration-confirmation diagnostics) did not produce test
  failures and H.4R.1 does not touch Viby paths.
- H.1/H.2/H.3 and G.1–G.5 adjacent regressions: included in that full gate.
- TypeScript: passed.
- Production build: passed.
- Changed-file ESLint: passed with only existing warnings.
- `git diff --check`: passed.
- Impeccable detector/design review: passed.

## 12. Privacy, performance, and migration

No message body, recipient identity, token, cookie, IP, session, presence,
Better Auth ID, Viby assertion, or preference value is added to People
projections or telemetry. The directory no longer performs the H.4R batch DM
eligibility query, so card rendering is simpler and avoids per-card or batched
preference/block lookups. Conversation lookup remains click-time and
idempotent.

H.4R.1 requires **no schema migration**. The legacy preference table remains
additive compatibility storage; no existing authoritative table is changed.

## 13. Production boundary and recommendation

Production H.4 remains active. This phase did not change the canonical
database, production release, standing Kentucky service, Chatto, Viby,
publication, memberships, projects, Team Chat, or real messages. A separate
H.4R.1B deployment phase is required and must repeat the production safety and
authorization gates.

**GO — H.4R.1 UNIVERSAL PEOPLE MESSAGING READY FOR PRODUCT REVIEW**

**RECOMMEND H.4R.1 PRODUCTION DEPLOYMENT**
