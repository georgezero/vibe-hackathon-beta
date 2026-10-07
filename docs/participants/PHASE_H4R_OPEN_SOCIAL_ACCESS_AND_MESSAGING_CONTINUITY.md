# H.4R — Open Participant Social Access / Messaging Continuity

**Disposition:** GO — H.4R OPEN SOCIAL ACCESS / MESSAGING CONTINUITY READY FOR PRODUCT REVIEW
**Recommendation:** RECOMMEND H.4R.1 PRODUCTION DEPLOYMENT (separate approval required)

H.4R is an isolated implementation and qualification phase. It changes the
global social access policy; it does not deploy a production release.

## 1. Operator policy decision

Direct participant review found that the earlier event-participant gate made
the social layer discontinuous. An authenticated person could discover a
profile but could not naturally start a DM, and a person with no current-event
submission relationship could not use Community. The approved policy is now:

| Layer | Access authority |
| --- | --- |
| People and discoverable profiles | authenticated active account + profile visibility |
| Direct Messages | authenticated active account + recipient/privacy/safety rules |
| Community | authenticated active account + selected/current event channel scope |
| My Projects, project workspace, Preview/editing | authoritative owner/member relationship |
| Team Chat | active submission membership |
| Judge/Admin/publication operations | existing role authorization |

Global social access is deliberately separate from project access. It does not
make an account a participant on a submission, and it does not grant Team Chat,
editing, invitation, judging, or administration capabilities.

## 2. Previous versus H.4R model

The previous H.4 implementation retained `isEventParticipant` checks in Direct
Message initiation and Community access. That was a valid fail-closed
implementation of the earlier product policy, but it was too restrictive for
the intended platform-social experience. H.4R removes only the submission
owner/membership prerequisite from global social operations. Disabled or
revoked accounts remain denied by the existing account-control domain.

The H.4 Kentucky review fixture contributed to the observed discontinuity: the
review account was authenticated but had no current-event owner/member row.
The fixture was not evidence that project authorization should be loosened;
it exposed the mismatch between the desired social policy and the inherited
event gate.

## 3. People and profile visibility

`/people` remains authenticated and the directory still exposes only public,
discoverable, non-deactivated profiles with an active account. Directory
project cards remain limited to published/archived projects in the selected
event. A private profile is not made public by this change.

The directory projection applies the public, discoverable, active-profile
projection and marks only whether a card is the viewer's own profile. Every
other returned card is messageable by policy; there is no second hidden
`canMessage` eligibility calculation.

## 4. Direct Message initiation

The authoritative `findOrCreateDirectConversation` path is unchanged as the
conversation authority. It still:

- derives the sender from the authenticated application principal at the API;
- requires an active sender account;
- resolves a public/discoverable active recipient;
- treats the legacy `allowIncoming` value as compatibility data only;
- rejects self-message and either-direction blocks;
- canonicalizes the pair and reuses the existing one-to-one conversation;
- handles uniqueness races by returning the canonical existing conversation.

The only removed condition is a shared active-event owner/member relationship.
No second chat primitive or conversation-creation endpoint was introduced.

`MessageProfileButton` is now present on each eligible People card and remains
on an eligible public profile. It shows a bounded pending state, calls the
existing endpoint, and routes to `/messages/:conversationId`. Own profiles do
not render the action. External profile links remain secondary.

## 5. Community access and event scope

Community content remains event-scoped. The current/selected event determines
which channel record and messages are loaded; there is no new cross-event
message pool. An authenticated active account may read ordinary channels and
post to discussion channels without an owner/member row. Announcement posting
remains organizer/admin-only, archived channels remain read-only, and reports,
tombstones, safe identity projection, moderation, hidden-event handling, and
account-control checks remain authoritative.

`canAccessCommunity` is a presentation projection of active-account eligibility.
Every page and API still calls the independent Community authorization path.
Unknown channels and denied accounts retain generic route denial, so the URL
does not become an event-existence probe.

## 6. Navigation and H.1/H.3 continuity

H.1 ordering remains stable:

`My Projects · Projects · Community · Messages · Explore · Start a project`

Community is visible to an authenticated active account even when My Projects
is empty. People remains under Explore rather than being promoted to a new
global category. H.3 empty states remain truthful; no synthetic content is
needed to make an empty Community or Messages surface useful.

Messages continues to direct a person to People, whose cards now complete the
handoff with one action. Team Chat remains project-local and is never added to
global navigation.

## 7. Zero-project persona and authorization matrix

The isolated qualification account `participant@kentucky-vibes.org` was active,
had zero projects, zero owners, and zero memberships. It could:

- open My Projects, People, Messages, and Community;
- view discoverable profiles;
- start a permitted DM;
- read and post in the synthetic General channel;
- read but not post in Announcements.

The same account received the existing private-workspace denial and HTTP 403
from the Team Chat submission API. It did not receive judge/admin capability.
Unauthenticated People/Community access retained the login bridge; direct
unauthorized Community/API access remained generic or authentication-denied.

## 8. Blocking, privacy, and identity

The implementation does not reveal block ownership, recipient account state,
emails, badge numbers, Better Auth IDs, Viby IDs, conversation bodies, or
Community bodies in eligibility projections or generic errors. Existing Direct
Message block, report, preference, disabled-account, and history semantics are
unchanged. Community identity uses the existing safe display projection and
does not force a private profile to become discoverable.

## 9. Performance and implementation shape

People cards use one bounded batch eligibility projection rather than one
block/preference query per card. The directory performs bounded count/options,
page, project, and eligibility queries; it does not preload every conversation.
Project listing remains event-scoped. Community navigation uses the existing
active-account check and bounded unread projection; no new global SSE/WebSocket
connection was added.

## 10. Kentucky qualification fixture

Qualification used a fresh disposable backup-derived clone, not the standing
Kentucky service or production:

`/opt/vibe-hackathon/instances/kentucky-vibes-h4r-qualification-20260811T050137Z/data/h4r-qualified.sqlite`

Clone SHA-256 at creation:
`b1f9a5909a83a6475c308bd1171039f040ee66e37e1b7f783f264ec6097eb7ca`

The clone inherited the seeded Kentucky Vibes test data. Browser qualification
added one synthetic zero-project-account DM conversation and one synthetic
Community General message; it did not modify production, the standing
Kentucky database, Chatto, or Viby. The final clone counts were 28 DM
conversations, 137 DM messages, 5 Community channels, 94 Community messages,
and 95 H.2 journey rows. These are fixture evidence only, not participant
behavior conclusions.

## 11. Browser journeys

Desktop Chromium, using the zero-project account, verified:

1. My Projects rendered the empty project state and still showed Community.
2. People showed compact Message actions on eligible cards.
3. People → Message opened a new DM.
4. People → profile → Message reused the same conversation ID.
5. Messages remained reachable after the handoff.
6. Community opened at HTTP 200 without a project relationship.
7. General accepted one synthetic qualification post.
8. Announcements rendered read-only guidance with no composer.
9. `/projects/kv_submission_0001` rendered the existing private-workspace
   denial, and `/api/chat/submissions/kv_submission_0001` returned 403.

At approximately 390×844, People → Message → DM, profile Message, Community,
mobile navigation, and the zero-project home were checked. The measured
`document.documentElement.scrollWidth === window.innerWidth` invariant held
for the tested mobile surfaces. Message remained a labeled, tappable control.

Screenshots are synthetic and stored in
[`screenshots/h4r/`](screenshots/h4r/), with the reviewed contact sheet at
[`screenshots/h4r/contact-sheet.png`](screenshots/h4r/contact-sheet.png).

## 12. Focused and regression tests

- H.4R source/policy checks: 4 passed.
- H.4 continuity, Direct Messages, and Community focused suites: 14 passed.
- Profile directory suite: 12 passed.
- Full repository suite: **347 passed across 66 files**, including the
  unaffiliated Community read/post and disabled-account omission assertions.
- TypeScript: passed.
- Production build: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.
- Impeccable detector: changed-surface review passed; only pre-existing global
  stylesheet detector findings were reported outside H.4R selectors.

The full suite was run under the repository's isolated test harness. Existing
Viby guardrail stderr is expected diagnostic output; no Viby behavior changed.

## 13. Accessibility and visual review

The People card actions use semantic links/buttons with visible labels and
existing focus styles. The profile Message action remains near the profile
header actions; external links are not promoted above it. The mobile menu keeps
Community in the same authenticated hierarchy, with no hidden-but-focusable
Community entry for an inactive account. Review followed the Impeccable Design
guidance for restrained action hierarchy, clear social vocabulary, and mobile
touch targets. This was agent-operated review, not independent human usability
testing.

## 14. Migration and production boundary

H.4R requires **no schema migration**. No Drizzle schema, migration script, or
database table/index was added. All changes are application policy, projection,
UI, and test changes. The standing Kentucky CF URL was not restarted or
mutated for H.4R, and no production release, account, DM, Community message,
membership, project, deadline, publication, Chatto, or Viby state was changed.

## 15. Product recommendation

The required invariants now hold in the isolated environment:

`People → Message → DM`
`People → Profile → Message → DM`
`Community visible → Community accessible`
`private workspace / Team Chat → project authorization required`

**GO — H.4R OPEN SOCIAL ACCESS / MESSAGING CONTINUITY READY FOR PRODUCT REVIEW**

H.4R.1 supersedes this recommendation. Recommend a separate, explicitly
approved **H.4R.1 production deployment** after the universal People messaging
qualification in the companion report.

## H.4R.1 supersession

H.4R.1 removes the remaining separate Direct Message eligibility concept. The
old model was:

    visible People record + preference/event/recipient eligibility
        → sometimes Message

The qualified model is:

    visible People record + viewer is not self
        → Message

The server still rejects self-targeting, inactive/deactivated accounts,
blocked pairs, malformed recipients, and duplicate pairs. Recipient session
presence is never consulted: a signed-in sender can create and send to an
active discoverable recipient with zero sessions, and the recipient sees the
durable unread conversation after a later login. Historical `allowIncoming`
rows and the compatibility preferences endpoint remain storage/audit
compatibility only; they do not gate initiation or sending. Project workspace
and Team Chat authorization are unchanged. See
[`PHASE_H4R1_UNIVERSAL_PEOPLE_MESSAGING.md`](PHASE_H4R1_UNIVERSAL_PEOPLE_MESSAGING.md).
