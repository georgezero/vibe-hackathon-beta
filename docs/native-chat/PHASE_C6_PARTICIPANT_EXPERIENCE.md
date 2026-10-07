# Phase C.6 — Participant Experience

## Scope and disposition

Phase C.6 is a product-design and UX polish pass over the deployed C.5 team
workspace. It does not change authentication, authorization, native-chat
transport, membership semantics, or rollout controls. No deployment was made in
this phase; production remains on the C.5 workspace release with native chat
limited to the synthetic pilot `sub_QUPapzbr`.

## Design rationale

The participant journey now starts from a single home: **My Projects**. Each
project is represented as a compact, high-signal card with its current state,
readiness percentage, team count, recent activity, unread-message state, and a
single primary action: **Open workspace**. Secondary actions remain contextual
to the member’s role.

Inside a project, the workspace shell keeps the project context visible while
the tabs provide a predictable information architecture:

`Overview` · `Team` · `Messages` · `Activity` · `Preview` · `Status`

The Overview answers “what should I do next?” with a readiness checklist,
role-aware next actions, recent activity, and a message preview. Activity is a
structured project timeline, while Messages remains human conversation. This
separation avoids turning an audit log into a chat feed or making chat carry
durable project state.

## Information hierarchy

1. Project identity and current state.
2. Readiness and the next useful action.
3. People and explicit workspace membership.
4. Conversation and unread state (only for the allowlisted pilot).
5. Durable project activity, preview, and status details.

Owner and teammate affordances are derived from the existing active membership;
no email match, administrator role, or judge role grants workspace access.

## Surface changes

- **My Projects:** responsive cards show title, team, Owner/Teammate status,
  Draft/Ready to submit/Submitted state, readiness progress, badge readiness,
  activity recency, team size, unread messages, and role-appropriate actions.
- **Overview:** readiness, next actions, recent activity, and recent messages
  are presented as distinct panels with a clear primary path.
- **Team:** formal roster entries and authenticated workspace members are
  displayed separately. Profile cards make account status and affiliation easy
  to scan without implying that roster metadata is authorization.
- **Messages:** the existing SSE/polling implementation is unchanged. The
  visual shell now emphasizes a quiet timeline, human/system distinction,
  keyboard-safe composer, and the privacy warning. The empty state reads
  “No messages yet. Introduce yourself or ask your teammates a question.”
- **Activity:** safe participant-facing events are grouped into a timeline by
  day. Internal audit names and payloads remain hidden.
- **Preview:** authenticated workspace preview uses the hosted submission
  state and keeps edit-token recovery separate.
- **Status:** completion, submission state, deadline, readiness, and judging
  state are intentionally separate.
- **Account:** the existing project-workspace summary remains the identity hub;
  project ownership and teammate membership are shown as scoped capabilities,
  not as a new global participant role.

## Accessibility and responsive behavior

- Existing semantic headings, labels, live regions, and links are preserved.
- Focus-visible styling uses the existing design tokens.
- Primary and secondary controls retain the shared button hierarchy.
- Mobile workspace tabs scroll horizontally rather than clipping content.
- Cards collapse to one column below the existing breakpoint.
- Message composer controls remain comfortable touch targets and stay anchored
  while the timeline scrolls.
- Reduced-motion users receive static card/timeline treatment.
- Empty, loading, unavailable, and revoked-access states use plain language.
- No authenticated workspace URL contains an edit token.

## Empty and unavailable states

- Projects: “Create your first project” with Start and Claim actions.
- Team: a clear distinction between the formal roster and joined workspace
  members; pending and revoked states remain explicit.
- Messages: “No messages yet” plus the privacy warning.
- Activity: “Project activity will appear here as your team works.”
- Non-allowlisted chat: “Team messages are not enabled for this project yet.”
- Chat outage: the existing bounded unavailable state keeps project editing,
  preview, account, admin, judge, and public routes independent.

## Visual system

The implementation extends the established Vibe Hackathon dark-professional
system using existing CSS variables for color, typography, borders, and focus
states. Layouts favor whitespace, a restrained card count, compact status chips,
and one obvious primary action. No separate chat visual language was added.

## Qualification

- `npx tsc --noEmit` passed after the C.6 edits.
- `git diff --check` passed.
- Full isolated unit suite: **237 tests passed across 40 files**. The harness
  emitted expected Better Auth warnings and guarded fixture-script errors while
  retaining an exit status of 0. No production database was used or changed.
- Production build completed normally with Next.js 16.2.12: compilation,
  TypeScript, page generation (55/55), and route optimization all passed.
- Authenticated C.3 Chromium qualification passed **4/4** using the completed
  production build through a disposable HTTPS loopback proxy: desktop and
  mobile owner/team messaging, invitation, unread state, SSE revocation, and
  signed-out denial.
- WebKit remains unavailable because the host libraries are not installed.
- Changed-file ESLint and `git diff --check` passed; repository-wide baseline
  lint debt was not broadened.

## Screenshots

The authenticated browser fixture captured deterministic synthetic screenshots
for both desktop Chromium and mobile Chromium. They contain only synthetic C3
content and no tokens or credentials.

Desktop: [My Projects](screenshots/c6-desktop-chromium-projects.png) ·
[Overview](screenshots/c6-desktop-chromium-overview.png) ·
[Team](screenshots/c6-desktop-chromium-team.png) ·
[Messages](screenshots/c6-desktop-chromium-messages.png) ·
[Activity](screenshots/c6-desktop-chromium-activity.png) ·
[Status](screenshots/c6-desktop-chromium-status.png) ·
[Account](screenshots/c6-desktop-chromium-account.png)

Mobile: [My Projects](screenshots/c6-mobile-chromium-projects.png) ·
[Overview](screenshots/c6-mobile-chromium-overview.png) ·
[Team](screenshots/c6-mobile-chromium-team.png) ·
[Messages](screenshots/c6-mobile-chromium-messages.png) ·
[Activity](screenshots/c6-mobile-chromium-activity.png) ·
[Status](screenshots/c6-mobile-chromium-status.png) ·
[Account](screenshots/c6-mobile-chromium-account.png)

Review found no blocking hierarchy, overflow, clipping, or role-control issue.
The mobile tab strip is intentionally horizontally scrollable and the composer
remains keyboard-safe.

## Future roadmap

- Capture approved desktop/mobile screenshots during the next deployment review.
- Add richer activity projections only when backed by explicit product events.
- Continue the controlled native-chat pilot before considering wider rollout.
- Keep attachments, DMs, public rooms, notifications, and owner transfer out of
  this surface until separately designed and approved.

## Deployment note

The qualified C.6 release was deployed after the gates above. A first artifact
packaging attempt omitted dependencies and was rejected by systemd with
`203/EXEC`; the artifact was corrected by linking the already-qualified
dependency tree, then restarted cleanly with zero restarts. See the detailed
deployment report for the exact release and post-deploy state.

Chatto was unchanged.

Viby was unchanged.

CONDITIONAL GO — post-deployment authenticated walkthrough requires an approved synthetic credential handoff
