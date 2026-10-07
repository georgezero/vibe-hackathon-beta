# Phase C.3 — Disposable Native Team Chat Qualification

Status: disposable qualification complete. No canonical migration, production
feature activation, deployment, or Chatto/Viby change was performed.

## Repository and production boundary

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- HEAD during qualification: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Worktree: implementation and documentation changes are uncommitted; no
  application commit or deployment was created.
- Previously deployed application: `0ec33b1ae1cf862112987198a91ff19abbfa662b`
- Production health before/after: HTTP 200; the production flag remains unset
  and therefore false.
- Local service observed: PID `970405`, started `2026-08-01 09:34:55 -0400`.
- Canonical database: `local.db`, unchanged at 598,016 bytes. It was never used
  by the qualification server.
- Chatto and Viby were unchanged.

The existing protected `local.db.pre-p0-4.bak` remained untouched. No real
participant, submission secret, assignment, score, authorization, or identity
link was used.

## Disposable dataset and isolation

The Playwright web server used `/tmp/vibe-hackathon-c3-playwright.db`, removed
and recreated for each run, with `VIBE_TEST_DATABASE_ROOT=/tmp`. It seeded one
synthetic owner, one synthetic teammate, one unrelated roster-email match, and
one draft submission with an explicit claimed owner. No canonical Better Auth
user was created.

The migration tests created a canonical-shape disposable SQLite database, ran
each migration twice, and confirmed that only explicit owners were reconciled.
No teammate membership was created from roster metadata.

## Schema and migration qualification

The additive tables are `submission_membership_invitations`,
`submission_memberships`, `chat_rooms`, `chat_messages`, `chat_read_states`,
and `chat_events`. Constraints enforce restrictive foreign keys, one active
owner per submission, one active membership per user/submission, one active
room per submission, bounded plain-text messages, and client-message
idempotency.

Focused migration tests: **3 passed**. They covered owner reconciliation,
ambiguous historical owners failing closed, native-chat idempotence, and
foreign-key validation. Both migration commands produced identical second-run
output. Accepted-to-revoked invitations preserve `accepted_at` while requiring
`revoked_at`, keeping membership history auditable.

## Owner and invitation qualification

Desktop and mobile Chromium verified owner sign-in, My Projects navigation,
lazy creation of exactly one private room, the empty state and privacy warning,
plain-text persistence, HTML escaping, invitation creation, clean-browser
teammate sign-in, explicit join confirmation, and one active teammate
membership. Owner, roster, and authorization records remained separate.

The invitation token is displayed only in the creation result, stored only as a
digest, absent from audit metadata, and transported in a short-lived HttpOnly
SameSite cookie. The cookie is cleared after acceptance. Raw invitation and
edit tokens are not logged or placed in ordinary page HTML.

## Two-browser messaging

The owner and teammate exchanged synthetic text in separate Chromium contexts.
The timeline persisted across refresh, the sender's unread count cleared on
view, and the same client message ID was idempotent. Conflicting reuse of a
client ID was rejected. SSE delivery and polling fallback use the same active
membership resolver. The stream cursor starts at zero and advances with
second-precision-safe timestamps so same-second events are not skipped.

## Revocation SLA

The owner revoked the teammate while the teammate room was open with an SSE
connection. Immediately after the owner DELETE committed, a teammate history
request returned HTTP 403. Within the bounded five-second window the teammate
UI displayed `Access revoked`, SSE authorization was no longer active, and the
owner remained functional. The owner posted a new message after revocation;
the open teammate client did not receive it. Subsequent history and unread
requests returned HTTP 403; hard reload was denied. Previously rendered content
remained visible locally, as expected, but no new server-authorized access was
allowed.

Repeated revoke is idempotent. The disposable browser flow then accepted a new
owner-issued invitation, restored exactly one active teammate membership and
the existing room mapping, and completed a final revoke. No production
regrant was attempted.

## Authorization negative matrix

The disposable browser suite denied room access for signed-out users,
unrelated users, matching roster-email users, admins, judges, and users of a
different submission. Submission ID possession and edit-token possession do
not create chat membership. The resolver is applied independently to room
opening, history, posting, read/unread, SSE, and reconnect operations.

Administrators and judges receive no room access from their application roles.
Only explicit active submission membership grants access.

## Delivery, unread, and outage behavior

- SSE is authenticated, same-origin, bounded to a 25-second stream, and
  rechecks membership every second.
- Polling fallback runs at one-second intervals after stream failure and turns
  an unauthorized response into the revoked state.
- Read/unread is per-user and revoked members cannot fetch or mutate it.
- Messages are plain text, escaped, and limited to 4,000 characters.
- Attachments, threads, reactions, DMs, calls, bots, search, and message
  edit/delete are intentionally omitted from this slice.
- Messaging errors are bounded to Messages; login, submissions, My Projects,
  administration, judging, and public projects do not depend on chat.

## Tests and scans

- Full unit suite: **237/237 passed** across 40 files.
- Focused migration suite: **3/3 passed**.
- C.1 Chromium regression: **4/4 passed**.
- Phase B Chromium regression: **28/28 passed**.
- C.3 native-chat Chromium: **4/4 passed** (desktop and mobile).
- TypeScript: passed.
- Changed-file ESLint: passed with zero errors and zero warnings. The
  repository-wide `npm run lint` command still reports 16 pre-existing errors
  in unrelated dashboard/presentation files; those files were not changed by
  this phase.
- Production build: passed; native routes were included in the build manifest.
- `npm run test:isolation`: passed; missing test configuration was rejected,
  disposable audit writes stayed disposable, and the canonical database stayed
  unchanged.
- `git diff --check`: passed.
- WebKit: unavailable because `libmanette-0.2.so.0` and `libhyphen.so.0` are
  missing on this host; no WebKit pass is claimed.

## Canonical database immutability

The final isolated full-unit run captured this unchanged fingerprint:

```text
before sha256 d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03
after  sha256 d5ad2bd55c3f6e8b4e280fa36a264c0b2ae3a27338b5f77bb4b514f87c5a4b03
before mtime/size 1785590865:598016
after  mtime/size 1785590865:598016
```

The canonical local database still has 8 submissions, 2 users, 0 submission
owners, no native-chat tables, and an empty foreign-key check. These are local
baseline counts, not pilot data.

## Proposed controlled pilot (not executed)

After explicit operator approval only:

1. take and verify a canonical database backup;
2. run both additive migrations twice against the explicit canonical path;
3. verify foreign keys, integrity, counts, and owner reconciliation;
4. set `VIBE_NATIVE_TEAM_CHAT_ENABLED=true` and
   `VIBE_NATIVE_TEAM_CHAT_SUBMISSIONS=<one-approved-submission-id>`;
5. deploy an immutable release and restart only Vibe Hackathon;
6. qualify one designated owner and one designated teammate with synthetic
   text and measure revocation from commit to denial/event closure;
7. set the flag false and restore the prior release if any gate fails.

No production submission, membership, message, or migration was created in
this phase. Additive tables may remain after application rollback; database
restore is reserved for migration or integrity failure.

## Disposition

The disposable implementation, browser, revocation, regrant, and changed-file
qualification gates pass. The repository-wide lint command still has 16
unrelated baseline errors, so that hygiene issue must be resolved or formally
waived before deployment. Explicit approval for a designated two-account
production pilot and canonical migration is also still required. Until those
gates are closed, chat remains disabled.

CONDITIONAL — repository-wide ESLint baseline errors and explicit pilot approval remain unresolved
