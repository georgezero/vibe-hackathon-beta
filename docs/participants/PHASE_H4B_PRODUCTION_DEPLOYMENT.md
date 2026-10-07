# Phase H.4B — Production Deployment: Participant Discovery / Communication Continuity

Date: 2026-08-11 (UTC)

## Disposition

**GO — H.4 PARTICIPANT DISCOVERY / COMMUNICATION CONTINUITY DEPLOYED AND QUALIFIED**

**HOLD — CORE PARTICIPANT EXPERIENCE SUFFICIENTLY MATURE**

H.4 is deployed as an application-only release. The next step is observation,
not another participant feature phase.

## Production baseline

The pre-deployment baseline was recorded on host `paui`:

- repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`;
- branch: `phase-vh-m6-viby-better-auth-session`;
- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`;
- current release: `/opt/vibe-hackathon/releases/h3-pre-event-activation-20260810T221150Z`;
- process PID: `184367`;
- process start: `2026-08-10 18:14:29 EDT`;
- restart count: `0`;
- canonical DB: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`;
- baseline DB SHA-256: `22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`;
- DB size/mode: `1,429,504` bytes / `0600`;
- integrity: `ok`;
- foreign keys: passed;
- event: `evt_vibe_2025` / `vibe-hackathon-2026`;
- event unfrozen; submission and judging deadlines unset;
- D.4 release `pr_evt_vibe_2025`: `calculated`, `published_at = NULL`;
- participant Results: unpublished;
- H.2 rows: 5 journey events, 0 feedback.

The whole-file SHA differs from older H.3B prose because the earlier H.4
qualification checkpoint consolidated the SQLite file/WAL representation. A
fresh H.4B backup was made from this current file, and deterministic hashes for
all authoritative business tables match the pre-deployment backup and the
H.3B business state.

The worktree contained cumulative phase changes and was not cleaned or reset.

## Backup

Fresh online backup:

`/opt/vibe-hackathon/backups/h4b-production-predeploy-20260811T021751Z.sqlite`

- source DB SHA: `22a886f44aa8cfe499b56a9c809c31d9b58e864e929c483508ab4405ec00b803`;
- backup SHA: `88f981156da5fac7343c7466dfd3dda90a730beb23402e21dd7795d2fd26a64c`;
- size/mode: `1,429,504` bytes / `0600`;
- integrity: `ok`;
- foreign keys: passed.

The backup was not overwritten and remains the rollback/data-integrity
evidence.

## Schema and authority checks

H.4 requires **no schema migration**. The Drizzle schema fingerprint matches
the deployed H.3 release and no migration script or table/index change is in
the H.4 release.

The profile Message action uses the existing `canInitiateDirectMessage`
eligibility check and existing idempotent `findOrCreate` conversation path.
Self, blocked, private, disabled, revoked, out-of-scope, and invalid-recipient
conditions remain server-authorized.

Community navigation uses `canAccessCommunity(userId, eventId?)`, which reuses
active-account, event-participation, and Community-admin authority. It is a
presentation projection only. Community pages and APIs retain independent
fail-closed authorization and generic denial for unauthorized direct requests.

## Qualification and package

The H.4B gate completed with:

- H.4/direct-message/Community/H.1 focused gate: 21 passed;
- full repository suite: 343 tests across 65 files passed;
- TypeScript: passed;
- production build: passed (Next.js 16.2.12; 69/69 static routes);
- changed-file ESLint: 0 errors, two existing image warnings in `Nav.tsx`;
- Impeccable detector: passed;
- `git diff --check`: passed;
- desktop/mobile qualification: passed with no horizontal overflow.

One first full-suite attempt reproduced the known shared-schema fixture race
(`users` already exists in `user-profiles`). The profile test passed in
isolation; the H.3 baseline passed twice with 339/339 tests; the H.4 suite
passed on the rerun with 343/343. No H.4, auth, Viby, or profile behavior was
changed to hide the harness condition.

The exact qualified immutable release is:

`/opt/vibe-hackathon/releases/h4-communication-continuity-20260811T023047Z`

- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`;
- source-tree SHA-256: `00df655e8ba89bd1998cc4c78d443dc5846e6e213289f00ba9acf7c9424a2a8a`;
- build ID: `OC6jWmn51_b9I0gpfSwZ4`;
- schema migration: none;
- runtime dependencies, Next executable, manifests, static assets, and release
  metadata present;
- environment files, databases, credentials, cookies, and test session state
  excluded.

## Alternate-port boot

The release booted against a disposable copy of the verified production backup
on port 3087. `/api/health` returned HTTP 200 with `database: ok`; `/`,
`/projects`, `/login`, `/community`, `/messages`, and `/winners` rendered with
the expected signed-out behavior (participant-only routes redirected to the
login bridge). The candidate was stopped after qualification. No production DB
was used for mutation testing.

## Deployment

Rollback pointer created:

`/opt/vibe-hackathon/releases/rollback-h4b-20260811T023900Z`

The `current` symlink was atomically switched from H.3B to the immutable H.4
release. Only `vibe-hackathon.service` was restarted:

- old PID: `184367`;
- new PID: `437949`;
- new process start: `2026-08-10 22:37:57 EDT`;
- restart count: `0`;
- local health: HTTP 200 / database ok;
- public health: HTTP 200 / database ok.

Chatto, Viby, standing Kentucky, and unrelated services were not restarted or
modified.

## Production smoke and boundaries

Anonymous/read-only checks returned HTTP 200 for `/`, `/projects`, `/login`,
`/winners`, `/status`, and `/ai-evals`. `/people`, `/community`, and
`/messages` correctly redirected signed-out visitors to login with `returnTo`.
The public mobile checks at approximately 390×844 measured
`scrollWidth === innerWidth === 390` for the public route set.

Results remain unpublished. The direct `/winners` response showed the truthful
unpublished state; no winner, ranking, score, judge note, or internal D.4 state
was exposed. No public draft/private project data was added.

No approved production participant credential or existing eligible participant
pair was available for a safe positive DM/Community mutation smoke. Therefore
no production account, membership, DM, message, Community post, or synthetic
participant was created. Positive Profile → Message, conversation reuse, and
eligible/ineligible Community navigation are covered by the exact isolated H.4
browser qualification and deployed-source inspection. Production boundary
checks remain read-only.

## H.2 telemetry and privacy

H.2 remained active without a taxonomy change. Before and after the deployment
smoke there were 5 `participant_journey_events` and 0
`participant_feedback`; the smoke did not manufacture participant journey
activity. No feedback was created.

Public responses contained no live edit/recovery/invitation tokens, participant
digests, Better Auth/Viby identifiers, private emails, badge numbers, private
roster fields, DM/Community bodies, judge notes, or unpublished awards. The
landing page's existing code example contains visibly placeholder
`edit_xxxxxxxxxxxxxxxx` text only; it is documentation, not a credential.

## Business-data preservation

Post-deployment integrity remained `ok` and foreign-key check remained empty.
Authoritative table counts and deterministic hashes matched the fresh backup for
users/accounts/profiles, submissions, owners, teams/roster, memberships,
invitations, Team Chat, DMs/blocks/reports, Community/channels/read state,
judges, assignments, human scores, AI reviews, publication, and Viby links.
The expected DM and Community message counts remained zero. No authoritative
business data changed.

## Kentucky status

At the time of the H.4B production deployment, standing
`https://kentucky-vibes-f0b.ggg.ad` was not the release target and was not
modified. It remained a separate seeded test environment.

After the production deployment, a separate user-authorized test overlay was
applied to that Kentucky URL so the latest H.4 behavior could be exercised
there. The overlay uses the same immutable H.4 release, preserves the seeded
Kentucky `active.sqlite`, and restarts only `kentucky-vibes-f0b.service`.
The local app, HTTPS proxy, and Cloudflare tunnel are healthy (HTTP 200), and
the proxy/tunnel were not restarted. A fresh backup was recorded at:

`/opt/vibe-hackathon/backups/kentucky-vibes-f0b-pre-h4-20260811T024400Z.sqlite`

The Kentucky fixture had 181 users, 85 submissions, 27 DM conversations, 93
Community messages, and 33 H.2 journey rows before the overlay. Read-only
browser checks confirmed Profile → Message → existing DM reuse and eligible
Community access at desktop and 390px mobile widths. The checks added only
expected sessions, telemetry, and DM read-state activity; no message or
Community content was posted.

## Rollback

H.4 is application-only. If continuity or authorization regresses, atomically
restore the H.3 release through the rollback pointer, restart only
`vibe-hackathon.service`, and verify local/public HTTP 200. Do not restore the
database merely to undo application behavior; preserve legitimate H.2 rows.
Database restore is reserved for corruption, failed integrity/FK checks, or an
unexpected authoritative business mutation.

## Final recommendation

The deployed release preserves both required invariants:

`People → Profile → Message → DM`

`Community visible → Community accessible`

while preserving generic direct denial for unauthorized Community requests and
all existing server-side DM/Community boundaries.

**GO — H.4 PARTICIPANT DISCOVERY / COMMUNICATION CONTINUITY DEPLOYED AND QUALIFIED**

**HOLD — CORE PARTICIPANT EXPERIENCE SUFFICIENTLY MATURE**
