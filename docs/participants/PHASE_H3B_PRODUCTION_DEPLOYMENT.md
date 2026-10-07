# Phase H.3B — Production Deployment of Pre-Event Activation / Empty States

Status: **GO — H.3 PRE-EVENT ACTIVATION / EMPTY STATES DEPLOYED AND QUALIFIED**
Recommendation: **HOLD — CORE PARTICIPANT EXPERIENCE SUFFICIENTLY MATURE**

Deployment was application-only. No synthetic projects, profiles, messages,
teams, invitations, awards, feedback, publication changes, or event-state
changes were made in production.

## 1. Production baseline

Baseline was captured on host `paui` at `2026-08-10T22:04:08Z` (18:04:08
EDT).

| Item | Value |
| --- | --- |
| Repository | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon` |
| Branch | `phase-vh-m6-viby-better-auth-session` |
| HEAD | `a70edc28326108dfc84a69af303f680ceaa7f735` |
| Worktree | Dirty from the qualified cumulative participant work; no unrelated cleanup performed |
| Previous release | `/opt/vibe-hackathon/releases/h2-observability-20260810T205000Z` |
| Previous PID/start | `118106`, `2026-08-10 16:49:55 EDT` |
| Restart count | `0` |
| Local/public health | HTTP 200 / HTTP 200 |
| Canonical DB | `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db` |
| Pre-deploy DB SHA-256 | `c625e70ce96a8d6e664c4fb3eed3fd7a89aa33db0ab3ce34832c9f96093de944` |
| DB size/mode | 1,425,408 bytes / 0600 |
| Integrity/FK | `ok` / passed |
| Active event | `evt_vibe_2025` / `vibe-hackathon-2026` |
| Frozen | `false` |
| Submission deadline | unset |
| Judging deadline | unset |
| D.4 release | `pr_evt_vibe_2025`, `calculated`, `published_at = NULL` |
| Participant Results | unpublished |

The authoritative pre-deploy counts were: 11 users/accounts, 3 profiles, 10
submissions, 2 owners, 5 active submission memberships, 28 roster members, 3
revoked invitation records, 10 teams, 1 Team Chat room with 6 messages, 0 DM
conversations/messages, 4 Community channels with 0 messages, 5 judges, 17
assignments, 14 human scores, 1 publication release, and 2 Viby identity
links. H.2 contained 4 journey rows and 0 feedback rows. These counts and
content hashes were captured before deployment and compared after smoke.

## 2. Backup

A fresh online SQLite backup was created before deployment:

`/opt/vibe-hackathon/backups/h3b-production-predeploy-20260810T220604Z.sqlite`

- source DB SHA-256: `c625e70ce96a8d6e664c4fb3eed3fd7a89aa33db0ab3ce34832c9f96093de944`;
- backup SHA-256: `65cc44579db589c8af71683973328d590f9864fdfbb066c5cfd026dffe74b5e0`;
- size: 1,429,504 bytes;
- mode: 0600;
- `PRAGMA integrity_check`: `ok`;
- `PRAGMA foreign_key_check`: passed.

The prior H.2 backup was not overwritten.

## 3. Migration determination

H.3 adds no authoritative schema or migration. The qualified H.3 changes are
presentation/projection code, the shared empty-state component, and disposable
fixture/test tooling. Existing H.2 telemetry tables were already present in
the canonical database. No migration command was run in production.

The release metadata records `databaseMigration: false`.

## 4. D.4 publication authority

Before and after deployment the production release remained:

```text
publication release: pr_evt_vibe_2025
status: calculated
published_at: NULL
```

The deployed source uses the D.4 release status for landing orientation,
participant navigation, `/winners`, status-stage publication, and My Projects
result actions. `events.winners_published_at` is not used independently to
make participant Results available. The legacy field remains populated in the
fixture for compatibility testing, but participant Results stayed unpublished.

The Status page may show separately configured public audience-vote and
organizer AI-evaluation projections. Its `officialLeaderboard` remained null
and `winnersPublished` remained false; no official rankings, awards, scores,
or judge notes were exposed through the H.3 publication path.

The deployed `/api/v1/status/live` smoke returned
`winnersPublished: false`, `officialLeaderboard: null`, and
`resultsVisible: true`; the last value is the existing audience-results
configuration and does not publish D.4 official results.

## 5. Qualified source and package

The exact qualified source was packaged as:

`/opt/vibe-hackathon/releases/h3-pre-event-activation-20260810T221150Z`

| Item | Value |
| --- | --- |
| HEAD | `a70edc28326108dfc84a69af303f680ceaa7f735` |
| Source-tree SHA-256 | `669212af368c7a815440f45e9c9f129af7af53d5e4b49c5474d61735c31cac44` |
| Build ID | `Rr7AqA41NRxno7CqijUlH` |
| Build/package timestamp | `2026-08-10T22:13:22Z` |

The fingerprint uses the established sorted source-file SHA-256/path manifest,
excluding `node_modules`, `.next`, test-result directories, credentials,
databases, and release metadata. The package contains the Next runtime,
`.next/server`, static assets, metadata, and the server entrypoint. It excludes
`.env`, `.env.local`, production/Kentucky/fixture databases, storage states,
and H.3 screenshots. The accidental disposable `cloneDB` artifact found in
the source packaging input was quarantined outside the release and is not in
the candidate.

## 6. Test and build gates

- Full repository suite: **339 tests across 64 files passed**.
- H.3/H.1/H.2/G-focused qualification: **147 tests across 17 files passed**
  with file parallelism disabled. A parallel multi-file invocation exposed a
  known test-fixture cleanup race; serial isolation passed and the full suite
  passed. The guarded Viby subprocess diagnostics are expected policy tests,
  not failures.
- TypeScript: passed.
- Production build: passed; 69/69 static pages generated.
- Changed H.3 lint: 0 errors, 6 existing image/unused-variable warnings.
- `git diff --check`: passed.
- H.3 Impeccable detector: passed during qualification.
- The H.3 desktop/mobile screenshot set and `contact-sheet.png` were reviewed
  before packaging; no credentials or private participant data were present.

## 7. Alternate-port boot

The candidate was booted on `127.0.0.1:3077` against a disposable copy of the
verified backup at:

`/opt/vibe-hackathon/instances/h3b-production-alt-20260810T221500Z/data/canonical.sqlite`

Health returned HTTP 200 with `database: ok`. `/`, `/projects`, `/winners`,
`/start`, `/start/resume`, and `/login` returned 200. `/admin/participant-experience`
returned the expected unauthenticated 307 redirect, and the direct Results
route rendered “Results aren’t published yet.” Integrity and FK checks passed
on the disposable copy. The candidate process was stopped after qualification.

## 8. Deployment

The previous current pointer was preserved at:

`/opt/vibe-hackathon/rollback/h3b-previous-20260810T221429Z`

which points to the H.2 release. The current pointer was then atomically
switched to the H.3 release and only `vibe-hackathon.service` was restarted.

| Item | Value |
| --- | --- |
| Old release | `/opt/vibe-hackathon/releases/h2-observability-20260810T205000Z` |
| New release | `/opt/vibe-hackathon/releases/h3-pre-event-activation-20260810T221150Z` |
| Old PID | `118106` |
| New PID | `184367` |
| New process start | `2026-08-10 18:14:29 EDT` |
| Restart count | `0` |
| Listener | `0.0.0.0:3000` |
| Local/public health | HTTP 200 / HTTP 200 |

Chatto, Viby, Kentucky Vibes, and unrelated services were not restarted.

## 9. Read-only production smoke

Anonymous production checks returned the following:

| Route | Result |
| --- | --- |
| `/` | 200; “Submissions are open”; Start available; real counts shown |
| `/start` | 200 |
| `/start/resume` | 200 |
| `/projects` | 200; sparse/public-safe gallery |
| `/login` | 200 |
| `/winners` | 200; truthful unpublished state |
| `/status` | 200; D.4 official results remain unavailable |
| `/ai-evals` | 200; public-safe organizer-evaluation orientation |
| `/account/projects` | 200 sign-in boundary; no private project state |
| `/admin/participant-experience` | 307 to `session_required` |

No production participant credential was created or used. No authenticated
positive state was manufactured; the isolated H.3 fixture remains the evidence
for empty My Projects, People, Messages, Community, Team Chat, and published
Results states.

## 10. H.2 telemetry delta

The H.2 observation layer remained active. Read-only `/start` probes generated
one expected anonymous `participant_start_viewed` signal:

```text
participant_journey_events: 4 → 5
participant_feedback:      0 → 0
```

The anonymous rows have no participant digest, contain only the fixed
`participant_start_viewed` taxonomy and bounded start destination, and do not
contain arbitrary URLs or content. The DB WAL was checkpointed after smoke;
legitimate H.2 telemetry was not deleted merely to preserve the old SHA.

## 11. Business-data preservation

After smoke:

- final DB SHA-256: `c5799df5cb3f97fe8b685d5208663dd10643130951395e43911c27d62f75a67a`;
- size/mode: 1,429,504 bytes / 0600;
- integrity: `ok`;
- foreign keys: passed;
- event remained unfrozen with no deadlines;
- D.4 remained `calculated` with `published_at = NULL`.

All pre-H.3 authoritative table counts and deterministic content hashes
matched the baseline. This includes submissions/project content, owners,
teams/roster, memberships, invitations, Team Chat, DMs, Community, judges,
assignments, scores/reviews, publication, audience votes, and Viby links. No
authoritative business mutation occurred.

## 12. Privacy and authorization

Public responses and the H.2 row sentinel found no live edit/recovery/
invitation tokens, participant digests, Better Auth/Viby identifiers, private
emails, badge numbers, private roster fields, Team Chat/DM/Community bodies,
judge IDs/notes, or unpublished awards/results. The only token-shaped text in
the landing response is the existing documentation example with a visibly
placeholder `edit_xxxxxxxxxxxxxxxx` value; it is not a production credential.

Unauthenticated My Projects and Participant Experience admin access remained
non-authorizing. Positive admin authorization and all authenticated empty/
published states remain covered by the isolated H.3 qualification and focused
authorization tests; no production admin account was provisioned for smoke.

## 13. Mobile smoke

At approximately 390×844, `/`, `/projects`, `/winners`, `/status`, and
`/ai-evals` all measured `document.documentElement.scrollWidth ===
window.innerWidth === 390`. CTAs, empty/unpublished copy, and public navigation
were readable with no horizontal overflow or clipped actions.

## 14. Kentucky exception

The standing `https://kentucky-vibes-f0b.ggg.ad` origin still returns Cloudflare
HTTP 530 because its configured origin has no running service. This is the
pre-existing standing-demo tunnel/service condition. It is unrelated to H.3;
the standing DB/configuration was not changed, and the H.3 disposable fixtures
were not copied into production or the standing environment.

## 15. Rollback

Rollback is application-only: atomically restore the H.2 pointer from the
rollback target, restart only `vibe-hackathon.service`, and verify local/public
HTTP 200. No database restore is needed for presentation behavior. The H.2
telemetry rows should be retained under the documented retention policy; DB
restore is reserved for corruption, failed integrity/FK checks, or unexpected
authoritative business mutation.

## 16. Final assessment

H.3 production deployment is qualified. The product now presents deliberate
open-event, sparse, empty, closed, judging, unpublished-results, and
low-observation states without manufacturing production activity or weakening
publication/authorization boundaries.

**GO — H.3 PRE-EVENT ACTIVATION / EMPTY STATES DEPLOYED AND QUALIFIED**

**HOLD — CORE PARTICIPANT EXPERIENCE SUFFICIENTLY MATURE**

H.2 remains active for organic observation. No H.4 feature should be defined
from the synthetic fixture or the first few sparse telemetry rows alone.
