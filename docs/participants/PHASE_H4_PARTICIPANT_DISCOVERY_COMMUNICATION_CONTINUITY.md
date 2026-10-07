# H.4 — Participant Discovery / Communication Continuity

## Disposition

**GO — H.4 PARTICIPANT DISCOVERY / COMMUNICATION CONTINUITY READY FOR PRODUCT REVIEW**

Recommendation: use a separate, bounded production-deployment phase. H.4 was
qualified only in a disposable Kentucky Vibes clone; production, the standing
Kentucky Vibes instance, Chatto, and Viby were not changed.

Qualified source checkout: branch `phase-vh-m6-viby-better-auth-session`, HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735` (the worktree also contains prior
phase changes, so the HEAD is recorded for context rather than as a clean-tree
claim).

## Scope and starting architecture

H.4 was intentionally a continuity fix rather than a People, Messages,
Community, or navigation redesign.

- People is the existing `/people` directory and `/people/:handle` public
  profile route.
- Profile eligibility is projected by `canInitiateDirectMessage`, which uses
  the existing Direct Messages authorization rules: authenticated active
  participant, public/discoverable eligible recipient, event relationship,
  messaging preference, block state, and self-recipient protection.
- `MessageProfileButton` uses the existing
  `POST /api/direct-messages/conversations` endpoint and navigates to the
  returned `/messages/:conversationId` route.
- `findOrCreateDirectConversation` remains the authoritative conversation
  operation. Its canonical participant ordering, unique pair constraint, and
  uniqueness-race fallback make repeated/concurrent initiation idempotent.
- Community pages and APIs continue to authorize independently through
  `resolveCommunityChannelAccess` and retain the generic not-found mapping for
  unauthorized access.

No schema migration was required. H.4 adds no tables, indexes, or business
fields.

## Audit findings and root causes

### Profile → Message

The profile surface already contained the qualified Message handoff from the
existing Direct Messages work: it checked `ownsProfileHandle`, called
`canInitiateDirectMessage` for another participant, and rendered
`MessageProfileButton`. The audit confirmed that this was the correct domain
mechanism, not a missing second messaging primitive. H.4 retained it,
exercised it end-to-end, and added focused regression coverage for the handoff,
self-profile behavior, and conversation reuse/concurrency.

### Community visible → 404

The discontinuity was an application projection bug. `NavPublic` previously
treated an authenticated display account as sufficient to show Community. F.3
Community authorization was stricter: an active account also needed explicit
event participation (owner or active membership) or active Community admin
authorization. The Kentucky synthetic account
`f0b-participant-2@kentucky-vibes.example.invalid` had no active event
membership/owner relationship, so its direct Community request correctly
returned generic 404, while the old navigation incorrectly offered the link.

The fixture was therefore correctly ineligible; it exposed the navigation bug.
H.4 did not loosen Community authorization.

## H.4 implementation

`canAccessCommunity(userId, eventId?)` was added as a presentation-only
projection in `lib/community-channels.ts`. It reuses the same active-account,
event-participant, and Community-admin checks used by Community routes.

`NavPublic` now resolves the application principal server-side, derives
`communityAvailable` for the active event, and only obtains the Community
unread projection when the account is eligible. `Nav` defaults
`communityAvailable` to false and renders Community only when the authenticated
account and the authoritative projection both permit it. Navigation remains a
hint, never an authorization boundary.

The existing Profile → Message button remains visually consistent with the
profile action row. Existing Messages empty-state copy (“Find a participant in
People and choose Message…”) is now truthful because the complete handoff is
qualified.

## Authorization and privacy invariants

- Own profiles never show Message; the API also rejects self-message attempts.
- Public profile visibility alone does not grant DM eligibility.
- Blocked, disabled, revoked, out-of-event, and messaging-disabled accounts
  remain governed by the existing server-side Direct Messages policy.
- Conversation creation is one-to-one and idempotent; no duplicate pair is
  created by repeated or concurrent requests.
- Community navigation is omitted for an ineligible account, but every direct
  Community page/API request still independently authorizes.
- Unauthenticated, nonparticipant, cross-event, revoked/disabled, and
  participant-ineligible Community requests retain the existing generic 404;
  no event/channel existence signal was added.
- Event scope uses durable event, submission, owner, membership, and account
  IDs. Names, emails, profile text, project titles, tokens, cookies, Better
  Auth identifiers, and Viby assertions are not used as authorization
  substitutes.
- No new message content or participant secrets are logged.

## Disposable Kentucky qualification fixture

Qualification used:

`/opt/vibe-hackathon/instances/kentucky-vibes-h4-qualification-20260811T014003Z/data/h4.sqlite`

The clone was served locally over an isolated HTTPS loopback origin on port
3075, with a separate DB, cookie origin, and Better Auth origin. The H4 service
and proxy were stopped after qualification. The fixture was derived from
Kentucky Vibes data and was not the standing public instance.

Synthetic journeys used existing seeded participants, including:

- owner 001 (`derby-builder`) as an eligible participant;
- owner 003 (`ky-builder-003`) as the new-DM recipient;
- owner 041 as an eligible participant with an empty Messages state;
- `f0b-participant-2` as an authenticated but nonparticipant/ineligible
  Community account.

The clone was temporarily changed for two qualification-only states: owner 001
was revoked from its disposable event relationship to verify Community fail
closed, and one synthetic DM block was exercised. No standing Kentucky or
production row was modified.

## Browser journeys

Desktop Chromium and mobile Chromium (~390×844) exercised:

1. People → `ky-builder-003` profile → Message → a new conversation.
2. Repeating Message from that profile → the same conversation ID, with no
   duplicate conversation.
3. Conversation composer → a synthetic message in the disposable clone.
4. Messages empty state for owner 041 → Browse People → `derby-builder` profile
   → Message → conversation.
5. Self profile (`derby-builder`) → no Message action.
6. Existing block control → composer removed and neutral blocked copy shown;
   existing server tests also cover blocked API denial.
7. Eligible owner 001 → authenticated nav Community → Community landing/channel
   without a 404.
8. Ineligible `f0b-participant-2` → no Community nav link; direct `/community`
   returned HTTP 404 with only the generic not-found page.
9. Revoked owner 001 → next authoritative render omitted Community and direct
   access returned generic 404.
10. Mobile profile → Message → DM and mobile nav → Community, with no
    horizontal overflow (`scrollWidth === innerWidth`).

Synthetic screenshots are in [`docs/participants/screenshots/h4/`](screenshots/h4/),
including a reviewed [contact sheet](screenshots/h4/contact-sheet.png).

## Regression and qualification results

- H.4 continuity + Direct Messages + Community route/channel + H.1 navigation
  focused gate: **21 tests passed across 5 files**.
- Full repository suite: **343 tests passed across 65 files**. The suite still
  prints expected guard-rail errors from negative migration/Viby fixture cases;
  these are test assertions, not failures.
- TypeScript: passed.
- Production build: passed (Next.js 16.2.12; 69/69 static pages generated).
- Changed-file ESLint: 0 errors; two existing `@next/next/no-img-element`
  warnings in `Nav.tsx`.
- `git diff --check`: passed.
- Impeccable detector on changed participant UI: passed with no reported
  findings.
- Desktop/mobile browser checks: passed; no horizontal overflow.

The existing Direct Messages tests now include concurrent conversation
initiation and continue to cover private/nonparticipant recipients, blocks,
self-message denial, and idempotent message behavior. Community tests cover
explicit event participation, admin access, generic route denial, and the new
presentation projection.

## Production boundary and limitations

No production release, participant, DM, Community channel/message, membership,
Chatto, or Viby resource was changed. Production was only health-probed. A
passive SQLite WAL checkpoint was used during final integrity verification; it
consolidated the existing file/WAL representation but did not change
authoritative rows. The standing Kentucky Vibes public service remained active
and separate; the disposable H.4 service was stopped and its qualification DB
was preserved as evidence.

The browser qualification is synthetic agent-operated evidence, not
independent human usability testing. Existing F.0B seeded Community content
means the eligible clone view is populated; the authorization result, not the
content volume, is the H.4 assertion.

## Product review conclusion

H.4 now satisfies the two continuity invariants:

`People → Profile → Message → DM`

and:

`Community visible → Community accessible`

while preserving:

`direct unauthorized Community request → generic denial`

Proceed to a separate, explicitly approved production deployment phase. Do not
deploy from this qualification phase.

## H.4B production deployment addendum

H.4 was subsequently deployed in the separately approved H.4B phase as the
immutable release
`/opt/vibe-hackathon/releases/h4-communication-continuity-20260811T023047Z`.
The deployment required no schema migration. The production candidate passed
alternate-port health and route checks, and only `vibe-hackathon.service` was
restarted. Production finished healthy at HTTP 200 locally and publicly with
the event still unfrozen, deadlines unset, and D.4 publication calculated but
unpublished.

No production participant, membership, DM, Community message, or synthetic
account was created for qualification. Positive DM idempotency and eligible /
ineligible Community journeys remain grounded in the isolated H.4 browser
fixture. Anonymous production checks preserved login bridges and generic
Community denial. H.2 telemetry remained 5 journey rows and 0 feedback rows.
Authoritative business-table counts and hashes matched the fresh H.4B backup;
no business mutation occurred.

See the complete deployment record in
[`PHASE_H4B_PRODUCTION_DEPLOYMENT.md`](PHASE_H4B_PRODUCTION_DEPLOYMENT.md).

The H.4 release was also installed, by explicit operator request, on the
standing seeded Kentucky Vibes test URL for hands-on review. This is a separate
test overlay, not a production data deployment: the seeded DB was backed up,
only the Kentucky app unit was restarted, and the HTTPS proxy/Cloudflare tunnel
remained active.

## H.4R policy supersession

Direct review after H.4 found that the remaining active-event participation
gate was too restrictive for global social use. H.4R supersedes that narrow
eligibility assumption: authenticated active accounts may use People,
discoverable public profiles, eligible Direct Messages, and current-event
Community without owning or joining a submission. H.4's project and Team Chat
authorization boundaries remain unchanged. The H.4R implementation and
qualification record is in
[`PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md`](PHASE_H4R_OPEN_SOCIAL_ACCESS_AND_MESSAGING_CONTINUITY.md).
