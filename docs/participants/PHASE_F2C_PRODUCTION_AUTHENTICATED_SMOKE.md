# Phase F.2C — Production Authenticated Participant Smoke Qualification

## Disposition

The deployed F.0–F.2 participant foundation passed the bounded authenticated
production smoke using one synthetic Better Auth account. No real participant,
administrator, judge, Viby identity, submission, team membership, assignment,
score, Team Chat message, direct message, block, or report was created.

## Baseline

- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`.
- Release: `a70edc28326108dfc84a69af303f680ceaa7f735-f2b-participant-foundation-20260809T043133Z`.
- PID `3817485`; restart count `0`; start `2026-08-09 00:32:42 EDT`.
- Production and public health: HTTP 200.
- Pre-smoke canonical SHA: `0d4b9c492b27a4ae9cc5f9f2585efb4fe39bf8031d5174b1a26e8890f149120f`.
- Integrity: `ok`; foreign-key check: passed.
- Before smoke: 8 users, 8 accounts, 26 sessions, 0 profiles, 0 direct
  conversations/messages/blocks/reports, 10 submissions, 2 owners, 5
  memberships, 28 roster rows, 5 judges, 17 assignments, 14 scores, 1 Team
  Chat room, and 6 Team Chat messages.
- D.4 publication remained `calculated` with `published_at = null`.
- Kentucky Vibes remained healthy and isolated at
  `https://kentucky-vibes-f0b.ggg.ad`.

## Synthetic account and login

The supported `scripts/provision-password-user.ts` operator tool created one
account using the synthetic identity
`f2c-smoke@participant-smoke.example.invalid` and display name `F2C Synthetic
Participant`. A strong password was kept in a mode-0600 file outside the
repository and was never printed or documented. The account had no Viby link,
admin authorization, judge authorization, submission owner row, or membership.

Playwright started at the real production `/login` route and completed the
email/password flow without cookie injection. The normal participant landing
and navigation loaded; the Account access card showed Participant active,
Administrator not granted, Judge not granted, and no project claimed.

## Participant smoke results

### Account and profile

- `/account` showed the participant-centered Profile card, empty project state,
  Security, and no privileged access.
- `/account/profile` lazily created one profile with `visibility = private`,
  `discoverable = false`, and `handle = null`.
- A bounded synthetic edit saved and reloaded the display name, headline,
  affiliation, interests, and handle `f2c-smoke-participant`. Visibility
  remained private and directory listing remained unchecked.
- `/account/profile/preview` rendered the synthetic identity and omitted email,
  user ID, Viby data, authorization data, fabricated projects, and awards.
- The private handle returned generic 404 behavior both signed in and signed
  out; no “profile is private” disclosure or email appeared.

### People and Messages

- Authenticated `/people` showed `0 people in the participant directory` and
  the safe empty state. The synthetic profile did not produce a directory
  result because it remained private and undiscoverable. Existing production
  users were not exposed.
- `/messages` showed `No messages yet`, the People CTA, no Team Chat room, and
  no internal identifiers. No production DM was initiated.
- A known synthetic nonexistent Team Chat route rendered the private-room
  denial boundary: “An explicit active owner or teammate membership is
  required.” No submission or membership data was created.
- A synthetic nonexistent direct-conversation read returned HTTP 403 with the
  safe `conversation_forbidden` response.

### Authorization and logout

- `/admin`, `/admin/people`, and `/admin/judging` rendered the participant-safe
  administrator-denied boundary.
- `/judge/dashboard` rendered the participant-safe judge-denied boundary.
- Normal menu logout completed to `/?signed_out=1`; subsequent `/people` and
  `/messages` requests redirected to login, and `/account` no longer exposed
  authenticated account data.
- A post-cleanup login attempt failed while the account was disabled.

## Cleanup

The supported account-management domain revoked 7 remaining synthetic sessions
and disabled the account. The browser logout had already removed the current
session. The password file was shredded and no active synthetic session
remained.

The account and profile were retained rather than directly deleted because the
F.0A profile foreign key is `ON DELETE RESTRICT`. Final synthetic state is:

- account status: `disabled`;
- profile: retained, private, undiscoverable, synthetic handle;
- sessions: `0`;
- direct conversations/messages/blocks/reports: `0`;
- Viby/admin/judge/membership/ownership relationships: `0`.

## Final preservation verification

After an explicit WAL checkpoint, the final canonical SHA is
`de5fac3e0948339d79118656e7555e7fe86d9d10c90b051a5f9421e188f23f61`.
Integrity and foreign-key checks passed. Compared with the pre-smoke baseline,
only the expected synthetic lifecycle rows changed: one user, one credential
account, one private profile, one account-control row, one messaging-preference
row, and bounded audit entries. Sessions returned to the baseline count of 26.

All business-table hashes/counts remained unchanged:

- submissions, owners, memberships, roster;
- judges, authorizations, assignments, scores;
- native Team Chat rooms/messages;
- publication records and Viby links;
- direct conversations/messages, blocks, and reports remained zero.

Production PID, restart count, release, health, publication state, Chatto, and
Viby were unchanged. Kentucky Vibes remained active and populated for review.

## Remaining risk

The qualification account is intentionally retained disabled as a synthetic
tombstone because deleting its profile would violate the durable-profile
referential boundary. It cannot log in or resolve publicly. No production
participant has been made public or discoverable.
