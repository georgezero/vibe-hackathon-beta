# Phase H.2 — Observability / Participant Feedback Readiness

Status: **GO — H.2 OBSERVABILITY / PARTICIPANT FEEDBACK READY FOR PRODUCT REVIEW**

Recommendation: **RECOMMEND DEPLOYING H.2, THEN OBSERVING REAL PARTICIPANT USE BEFORE DEFINING H.3**

H.2 adds a small, privacy-preserving observation layer around the deployed
G.1–G.5 and H.1 participant journey. It is not a UX redesign, a clickstream
collector, or a general analytics platform. Production was not migrated,
restarted, seeded, or otherwise changed during this phase.

## Starting architecture and production boundary

The H.1 production baseline remained:

- release: `/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`;
- production PID at H.1B qualification: `400946`, restart count `0`;
- local and public health: HTTP 200;
- canonical database SHA-256:
  `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`;
- active event: `evt_vibe_2025` / `vibe-hackathon-2026`;
- event unfrozen, submission and judging deadlines unset;
- D.4 publication release calculated and unpublished;
- standing Kentucky Vibes, Chatto, and Viby unchanged.

The H.2 implementation was qualified against a disposable copy of the H.1
Kentucky Vibes open fixture. No production telemetry rows, feedback, account,
project, invitation, message, or social content was created.

## Existing observability audit

Before adding anything, the following existing sources were reviewed:

| Existing source | What it already proves | H.2 treatment |
| --- | --- | --- |
| `audit_events` and application/admin audit helpers | Authoritative business and operator actions, including creation, edits, claims, finalization, and admin changes | Kept authoritative; not overloaded with analytics |
| Submission status/readiness/finalization | Project counts, readiness, finalized state, deadline/freeze decisions | Derived directly for aggregate metrics |
| Invitation and membership tables | Created, accepted, expired, revoked, and access state | Derived where durable state is authoritative |
| Project activity and edit-version checks | Hosted updates and stale-write correctness | Existing correctness remains authority; bounded stale signal is additive |
| Native Team Chat, DMs, and Community records | Access and message counts/read state | No message bodies or conversation content are copied into telemetry |
| Agent update/API paths | Hosted agent update success/rejection | Meaningful outcome signal only; no prompts, code, URLs, or tokens |
| Event Health/admin infrastructure | Organizer operational state and authorization | Reused auth and navigation conventions; separate product-observation page |

The distinction is intentional: business records answer what happened to the
event, while H.2 journey events answer which participant-facing transition was
observed. A telemetry write can fail without changing the business action.

## Event taxonomy

`participant_journey_events` accepts a fixed taxonomy rather than arbitrary
event names. It covers meaningful transitions only:

- entry: start viewed, project created/resumed, claim completed;
- home/work: My Projects viewed, project/workspace opened, return to My Projects;
- editing: editor viewed, draft saved/validation failure, stale edit;
- agent: instructions/handoff, hosted update received/rejected, return to Preview;
- review/submission: Preview, readiness complete/incomplete, finalization attempt,
  success/rejection, receipt;
- team: invitation created/accepted/expired/revoked/wrong-account and access
  revocation;
- social: People/profile/message, Community/channel/message, Team Chat open/message;
- navigation: Explore opened and selection of fixed destinations.

There are no keystroke, field-focus, arbitrary-click, replay, URL, referrer,
search-term, or message-content events.

## Derived versus new signals

| Question/metric | Classification | Source |
| --- | --- | --- |
| Projects started, active, finalized | Authoritative derived | `submissions` status/timestamps scoped to the active event/window |
| Invitations accepted | Authoritative derived | invitation status/accepted timestamp joined through event submissions |
| Message/community/Team Chat use | New bounded journey event when an interaction is not safely reconstructed; durable message counts remain authoritative | Existing communication stores plus fixed transition signals |
| Start/editor/Preview/Explore/return transitions | New bounded journey event | Server or client transition instrumentation with fixed enums |
| Readiness blockers/finalization guards | Authoritative guardrail outcome plus bounded reason | Existing readiness/deadline/freeze authority; no client authority |
| Participant feedback | Separate qualitative record | Explicit participant submission, not inferred sentiment |
| Engagement score, sentiment, replay, heatmap | Not collected | Privacy and interpretation cost exceed usefulness |

## Storage and privacy model

Two additive tables are used when H.2 is deployed:

### `participant_journey_events`

Fields are limited to `id`, event ID, fixed event type, event-scoped one-way
participant digest (when an authenticated participant is available), device
class (`desktop`, `mobile`, `unknown`), fixed source/destination, fixed outcome
and reason, optional bounded duration, and server timestamp. The digest is
`SHA-256("h2:participant:" + eventId + ":" + userId)`; raw Better Auth IDs,
Viby subjects, names, emails, badge numbers, cookies, IPs, full user agents,
tokens, and content are not stored or projected to administrators.

### `participant_feedback`

Feedback is event-scoped and stores a fixed category, fixed page context,
participant digest, a short note (1,000 characters maximum), review state, and
review timestamps. The note is shown only to an authenticated administrator;
it is never included in public, project, profile, chat, judge, or participant
analytics surfaces. State changes are authorized through the admin API and
write an `audit_events` record.

SQLite CHECK constraints enforce the fixed enums, message length, digest shape,
duration bound, and feedback lifecycle. The migration also uses event foreign
keys with restrictive deletion semantics.

## Migration and retention

The migration is additive and idempotent:

```bash
DB_FILE_NAME=/absolute/path/to/disposable.sqlite \
VIBE_H2_MIGRATION_CONFIRM="MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE /absolute/path/to/disposable.sqlite" \
npm run db:migrate:participant-experience
```

It refuses remote databases, relative paths, symlinks, and missing exact
confirmation. It was run twice on the disposable fixture with integrity and
foreign-key checks passing. No production migration was run.

Raw journey telemetry is retained for 90 days and feedback for 180 days. The
cleanup script requires an explicit canonical path and typed confirmation:

```bash
DB_FILE_NAME=/absolute/path/to/disposable.sqlite \
VIBE_H2_CLEANUP_CONFIRM="CLEANUP H2 PARTICIPANT EXPERIENCE DATABASE /absolute/path/to/disposable.sqlite" \
npm run db:cleanup:participant-experience
```

Cleanup removes only rows older than the corresponding H.2 retention window.
It never deletes authoritative submissions, memberships, invitations, audit
history, chat, DMs, Community, judging, or publication records. Aggregates are
recomputed from the retained event-scoped rows and authoritative records; no
indefinite behavioral archive is implied.

## Aggregation definitions

The admin page is `/admin/participant-experience` and uses the existing
authenticated-admin authorization boundary. It supports Today, Last 24 hours,
Last 7 days, and Event to date, all computed using server timestamps.

The journey progression is intentionally non-linear. Its denominator is unique
event-scoped pseudonymous participants who generated a Start signal in the
selected window. A participant may revisit a stage or take a different route.
Finalization rate uses a separate truthful denominator: authoritative projects
created in the selected event/window. Counts are not a participant score and
must not be interpreted as causal conversion.

The page includes:

- experience overview: activity, projects, active projects, finalized rows,
  invitations, agent, Community, Messages, and Team Chat;
- journey progression: Start → project created/resumed → editor → Preview →
  finalization attempt → finalized;
- friction signals: readiness, validation, stale edit, deadline/freeze,
  invitation, authorization, rate-limit, duplicate retry, and invalid-link
  reasons;
- feature adoption: My Projects, coding agent, Team, Team Chat, People,
  Messages, Community, and Explore;
- fixed navigation destinations and coarse device class;
- timing median/P90 where an instrumented duration is available;
- bounded feedback review with New, Reviewed, Resolved, and Dismissed states.

Queries are event-scoped, indexed, bounded to the selected window, and feedback
is limited to the latest 50 rows shown in the admin surface. No admin endpoint
returns participant digests or private communication content.

Normal guardrails are not automatically defects. For example, a readiness
incomplete or deadline denial may be correct. Organizers should compare
frequency, repeated attempts, device context, and optional feedback before
planning product work.

## Participant feedback

Authenticated participants see a restrained `Send feedback` link on My Projects
and the participant project workspace. It opens an inline, keyboard-usable form
with five categories:

- Something was confusing;
- I couldn't complete a task;
- Something seems broken;
- I have a suggestion;
- Other.

The form explicitly asks participants not to include passwords, private links,
or message content, limits notes to 1,000 characters, and allows cancellation
without interrupting work. Submission is limited to three notes per participant
per hour. It returns a bounded success, retry, or rate-limit state and does not
attach hidden form fields, tokens, URLs, or chat content.

The administrator can review the note and set a small lifecycle state. A state
change is auditable and remains event-scoped. This is intentionally not a
ticketing system.

## Instrumentation boundaries

Server instrumentation observes authoritative transitions such as project
creation, resume, claim completion, Preview/readiness, authorized finalization
attempts and outcomes, agent update outcomes, invitation creation/acceptance,
and guest editor access.
The H.1 navigation component sends only fixed Explore/open and destination
signals. The client tracker is one-shot and sends no content. Telemetry calls
are best-effort; a failed write never blocks save, invite, message, or
finalization paths.

Guest editor access is recorded server-side after the private submission has
already been authorized; the private edit token is not placed in the event.
Authenticated journeys use the event API and an event-scoped digest. The API
accepts only the fixed enum payload and derives the active event server-side.
Authenticated event writes are bounded to 120 requests per participant per
minute; the tracker treats a rate-limit response as non-blocking.

## Kentucky Vibes fixture

A disposable copy of the H.1 open SQLite fixture was used during browser work
and checkpointed as:

`/opt/vibe-hackathon/instances/kentucky-vibes-h2-qualification-20260810T153500Z/data/h2-qualified.sqlite`

The checkpoint SHA-256 is
`06b8e5595b7f6efe04ae065ab44796efa41dab6c9259c6277f16b24169c2dd86`. Its
`QUALIFICATION.json` records the source, deterministic seed counts, and
integrity/FK results. Temporary browser service credentials and sessions were
not retained.

The fixture was migrated and seeded with the simulation-only command:

```bash
VIBE_EVENT_SIMULATION=1 NODE_ENV=test \
DB_FILE_NAME=/absolute/path/to/disposable.sqlite \
VIBE_H2_OBSERVATION_CONFIRM="SEED H2 OBSERVATION DATABASE /absolute/path/to/disposable.sqlite" \
npm run db:seed:h2-observation -- evt_kentucky_vibes
```

The deterministic seed produced 42 journey events and four synthetic feedback
notes across desktop/mobile, smooth and incomplete journeys, agent use,
invitation/team activity, People/Messages/Community/Explore use, validation,
stale edit, and expired invitation cases. Existing synthetic authoritative
submissions supplied the project/finalization denominator. A separate synthetic
admin account and participant account were used only on the disposable server;
their credentials are not retained in this report.

## Browser qualification and screenshots

The local isolated service ran on an alternate port with the disposable DB.
Browser checks covered:

1. administrator sign-in and Participant Experience overview;
2. overview, journey progression, friction, adoption, navigation, device, and
   feedback review rendering;
3. synthetic feedback state update to Resolved, including an audit row;
4. participant sign-in to My Projects;
5. feedback form, validation-preserving submission, success state, and mobile
   form at approximately 390×844;
6. admin layout at approximately 390×844.

The review set is in [screenshots/h2](screenshots/h2/INDEX.md), including the
[contact sheet](screenshots/h2/contact-sheet.png). Screenshots are synthetic
qualification evidence, not human usability findings.

## Performance

The admin aggregate query performs four bounded event-scoped reads in parallel,
with event/time and event/type indexes. Participant pages make at most a small
best-effort telemetry request; no SSE/WebSocket or global navigation stream was
added. Feedback submission is a single bounded request. The qualification
browser showed no participant-page blocking attributable to telemetry; the
admin page loaded the seeded data in the isolated local service without an
unbounded scan. Production performance must be observed after deployment using
the same bounded windows.

## Tests and checks

The H.2-focused suite covers:

- fixed taxonomy and one-way digest privacy;
- server-time windows and upper bounds;
- additive migration idempotency and FK validation;
- valid/invalid event recording and resume context;
- event-scoped aggregation and authoritative submission/invitation derivation;
- feedback length/category validation and three-per-hour rate limit;
- retention cleanup behavior;
- admin API policy and mutation classification.

The focused regression run passed 42 tests across seven files, including H.2,
admin route inventory, G.1 onboarding, G.3 readiness, G.4 team formation, G.5
editor, and H.1 navigation. TypeScript, production build, changed-file ESLint,
git diff check, and the Impeccable detector passed.

The full existing suite was rerun under serialized, disposable-database
conditions and passed **63 files / 332 tests**. The Viby migration-policy test
still intentionally emits the expected child-process diagnostic about refusing
conflicting/revoked subject-link replacement, but the test passes. The shared
profile-schema collision was resolved in the H.2 test fixture by dropping only
temporary H.2-owned tables/rows after the fixture; no profile or Viby
assertions were weakened and no product behavior changed.

No test was weakened, and no Viby, Chatto, judge, publication, or
authorization semantics were changed.

## Limitations and interpretation runbook

- H.2 does not prove why a participant abandoned a path; it identifies bounded
  signals for human review.
- Anonymous Start views cannot be tied to an authenticated participant unless a
  later supported claim/return transition supplies that context.
- A single participant can revisit a stage, so signal counts exceed unique
  participant counts.
- Social usage is intentionally coarse and never inspects conversation text.
- Device class is only desktop/mobile/unknown from the viewport breakpoint; it
  is not browser profiling.
- The synthetic Kentucky numbers demonstrate instrumentation and dashboard
  interpretation only. They are not real participant behavior.
- Telemetry does not become authority for deadlines, readiness, membership,
  Team Chat, judging, publication, or identity.

On event day, organizers should review the selected window, compare friction to
the denominator and feedback, inspect the authoritative operational page before
calling a guardrail a defect, and record any follow-up as a bounded product
decision. See [Participant Experience Observability runbook](../runbooks/PARTICIPANT_EXPERIENCE_OBSERVABILITY.md).

## Production boundary and recommendation

H.2B deployed the additive observation layer after a verified backup,
disposable migration/rerun, full suite/build, and explicit operator approval.
Production activation began at `2026-08-10T20:49:56Z`; the initial read-only
smoke produced four intentionally anonymous Start signals and no feedback.
The canonical production database remains authoritative for all business
domains. H.2 must not modify Chatto, Viby, publication, real projects, teams,
invitations, chat, DMs, Community, or event deadlines.

See [PHASE_H2B_PRODUCTION_DEPLOYMENT.md](PHASE_H2B_PRODUCTION_DEPLOYMENT.md)
for migration, release, PID, privacy, preservation, rollback, and observation
runbook evidence.

**GO — H.2 OBSERVABILITY / PARTICIPANT FEEDBACK DEPLOYED AND QUALIFIED**

**HOLD — OBSERVE REAL PARTICIPANT USE BEFORE DEFINING H.3.**

## H.3 boundary follow-up

The operator later confirmed that a practical real-participant population was
not available, so H.3 was authorized as a separate empty-state/product-
activation question rather than inferred from sparse H.2 numbers. H.3 did not
expand the fixed H.2 telemetry taxonomy, did not backfill synthetic telemetry,
and did not alter the H.2 production observation layer. Its disposable fixtures
and recommendation are documented in
`PHASE_H3_PRE_EVENT_ACTIVATION_EMPTY_STATES.md`.
