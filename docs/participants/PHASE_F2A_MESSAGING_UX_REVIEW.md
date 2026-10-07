# Phase F.2A — Participant Messaging UX Review

**Disposition:** GO — F.2 participant messaging UX ready for review
**Review window:** 2026-08-09 (EDT)
**Starting/final repository HEAD:** `a70edc28326108dfc84a69af303f680ceaa7f735`
**Environment:** isolated Kentucky Vibes only

## Demo environment

The stable review URL is:

`https://kentucky-vibes-f0b.ggg.ad`

It is backed by the disposable database
`/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`,
the `kentucky-vibes-f0b.service` process (PID `3757155`, restart count `0`),
and the existing named Cloudflare tunnel. Health returned HTTP 200 with the
active event `kentucky-vibes`. Better Auth, cookies, database, service, and
origin are isolated from production; no Viby link is required for the demo.

The demo account is:

`f2a-demo@kentucky-vibes.example.invalid`

Its password is retained only in the mode-0600 file:

`/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/credentials/f2a-demo.password`

The reply account is retained at the corresponding
`f2a-reply.password` path. Passwords are intentionally not included here.

## Synthetic personas and fixture

The review fixture uses six synthetic, public and discoverable participant
profiles. They have no Viby identity or privileged role:

| Person | Affiliation | Interests |
| --- | --- | --- |
| Maya Rivera | Bluegrass Medical Center | Medical imaging, AI, Workflow |
| Alex Chen | Derby Health Labs | AI, Computer vision, Workflow |
| Priya Nair | Cumberland Imaging Institute | Medical imaging, Education, Clinical decision support |
| Jordan Lee | Riverbend University Hospital | Workflow, Education, Interoperability |
| Sam Okafor | Bluegrass Medical Center | Frontend, Workflow, Accessibility |
| Elena Park | Cumberland Imaging Institute | Medical imaging, AI, Patient education |

Maya is the review account and Alex is the second browser account used for
replies. Each persona has an explicit event membership; public project history
is derived from published Kentucky Vibes submissions, never from roster email
matching. Maya and Alex each have two published project references. The active
database also retains the earlier F.2 synthetic rows for regression context.

The Maya inbox contains five purpose-built conversations and 50 purpose-built
messages (the active database totals are 27 direct conversations and 137
messages after the prior F.2 fixture and browser qualification). The active
database retains two synthetic blocks and three bounded reports, including the
review report submitted through the UI. The demo
conversations include 3, 10, 25, 8, and 2 messages respectively, with recent
and older timestamps, a multiline/long-history thread, one unread thread, a
blocked relationship, and a reportable conversation. Maya has one unread
conversation with five unread messages; the remaining demo threads are read.

## Browser flow and screenshots

The primary flow was completed through the UI:

`People → Alex Chen profile → Message → existing conversation → Messages inbox`

The existing pair was opened rather than duplicated. Profile identity carried
into the conversation header, and the inbox back link remained understandable.

Screenshots are stored in
[`docs/participants/screenshots/f2a/`](./screenshots/f2a/):

- [People directory — desktop](./screenshots/f2a/01-people-desktop.png)
- [Public profile with Message — desktop](./screenshots/f2a/02-profile-message-desktop.png)
- [Inbox — desktop](./screenshots/f2a/03-inbox-desktop.png)
- [Twenty-five-message conversation — desktop](./screenshots/f2a/04-conversation-desktop.png)
- [Blocked conversation — desktop](./screenshots/f2a/05-blocked-conversation-desktop.png)
- [People directory — mobile](./screenshots/f2a/06-people-mobile.png)
- [Public profile — mobile](./screenshots/f2a/07-profile-mobile.png)
- [Inbox — mobile](./screenshots/f2a/08-inbox-mobile.png)
- [Conversation latest messages — mobile](./screenshots/f2a/09-conversation-mobile.png)
- [Composer — mobile](./screenshots/f2a/10-composer-mobile.png)
- [Report menu — desktop](./screenshots/f2a/11-report-menu-desktop.png)

The dark professional theme was reviewed at 1440px and approximately 390px.
The inbox has a clear list/detail split on desktop and becomes a single-column
conversation on mobile. Message bubbles, timestamps, unread pills, neutral
blocked copy, and the compact More menu remain visually native to Vibe
Hackathon rather than imitating a general-purpose chat product. Navigation was
also checked at 1280px (full primary navigation) and 1024px (responsive menu),
with no horizontal overflow or badge collision.

## Realtime, unread, block, and report findings

Two authenticated browser contexts were used. With Maya viewing the existing
Maya/Alex conversation, Alex sent `Realtime review ping`; Maya saw it without a
reload in **1.354 seconds**. Maya then returned to the inbox while Alex sent
`Inbox preview ping`; the inbox preview and unread pill updated in **5.045
seconds**, bounded by the five-second list refresh. Opening the thread marked
the unread state back to zero.

The blocked Sam conversation keeps history visible, removes the composer, and
shows neutral copy: “You can't send messages in this conversation.” The menu
offers Unblock participant and Report conversation without identifying who
initiated a block. The report menu and success feedback were exercised; report
data contains no message body or internal identifiers.

## Bounded polish

The only F.2A code change was a small inbox resilience improvement in
`app/messages/MessagesList.tsx`: the client refreshes the bounded conversation
summary endpoint every five seconds so latest-message previews and unread
counts remain useful when a reply arrives while the inbox is open. The
conversation view continues to use the qualified SSE/polling transport. No
new messaging capability or navigation destination was added.

## Qualification results

- Focused direct-messaging and migration tests: **4 passed**.
- Full isolated unit suite: **279 tests passed across 53 files**.
- TypeScript and production build: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.
- Desktop Chromium: People, profile Message action, inbox, 25-message thread,
  blocked state, report menu, and existing-conversation reuse passed.
- Mobile Chromium at 390×844: People, profile, inbox, conversation, composer,
  back navigation, and menus passed; `scrollWidth` remained exactly 390px on
  each reviewed route.
- Existing Team Chat regression endpoint remained healthy (HTTP 200); team
  chat storage and authorization were not changed.
- No passwords, real identities, PHI, tokens, or internal IDs appear in the
  screenshots or participant projections.

This was an **agent-operated browser rehearsal, not an independent human
usability study**. The screenshots support a visual/product review; they do
not claim human observation findings.

## Production boundary

F.2A was not deployed. Production remained on PID `2501204`, restart count
`0`, and HTTP 200. The production database remains
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; its
business data, publication state, Chatto, and Viby were not modified. The
Kentucky service and named tunnel remain active for direct operator review.

## Remaining limitations

F.2 intentionally does not include group conversations, channels, attachments,
reactions, edits/deletes, typing or presence, moderation review UI, push
notifications, or conversation search. SSE revocation remains bounded by the
existing authorization poll interval; HTTP authorization is immediate and the
browser run observed the expected bounded delivery behavior.

## Recommendation

**RECOMMEND DEPLOYING F.0–F.2 TO PRODUCTION** after explicit release approval.
The isolated journey is coherent, privacy-safe, and stable at the qualified
fixture scale. F.3 channels would be a separate community-product decision,
not a prerequisite for the participant-to-participant messaging workflow.

## F.2B deployment follow-up

The approved F.0–F.2 foundation was subsequently deployed additively in
`PHASE_F2B_PRODUCTION_DEPLOYMENT.md`. Production starts with zero profiles,
handles, discoverable users, direct conversations, messages, blocks, and
reports; the Kentucky Vibes demo remains the populated review environment.
