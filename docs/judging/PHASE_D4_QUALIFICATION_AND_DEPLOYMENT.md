# Phase D.4 — Qualification and Deployment

## Disposition

The D.4R submission-scoped qualification boundary is deployed. Real results remain
unpublished (`publication_releases.status = calculated`, with no active event
publication awards, feedback, or announcements). The qualification gate is
explicitly disabled in production and its allowlist is empty.

Final gate: **conditional**. The synthetic fixture, accounts, and submission-scoped
publication rows were created safely and the participant Pending projection was
verified. A live administrator credential was not provided, so the authenticated
production lifecycle mutation (review → approve → publish → archive, withdrawal,
republish, and audit confirmation) was not executed. No credentials were reset or
created to bypass that human gate.

## Baseline and deployment

- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Starting/final implementation HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Previous release: `a70edc...-d1r-synthetic-qualification-20260802T194923Z`
- Deployed release: `a70edc283261-d4r-publication-20260803T005500Z`
- New service PID: `2987399`
- Start time: `2026-08-02 20:54:58 EDT`
- Restart count: `0`
- Local and public health: HTTP 200
- Public health origin: `https://vibe-hackathon-dev.ggg.ad`
- Rollback target: previous immutable release above

The D.4R deployment backup is:

`/opt/vibe-hackathon/backups/local.db.pre-d4r-deploy-20260803T004000Z.sqlite`

It is mode `0600`, 1,114,112 bytes, SHA-256
`996be7adfc53193e74893925456bd5db5f5ca65e3b5cc093ddae7a1012288a2e`, with SQLite
integrity and foreign-key checks passing. It was produced with SQLite's online
backup API so WAL contents are included. Existing backups were not overwritten.

The earlier protected pre-migration backup is:

`/opt/vibe-hackathon/backups/local.db.pre-d4-publication.20260802T220034Z.sqlite`

It is mode `0600`, 835,584 bytes, SHA-256
`990b35a2c3809c8bb0db14239c0153d8cfaea2f30008e386e9bdd9edb8b6edbc`, with SQLite
integrity and foreign-key checks passing. Existing backups were not overwritten.

For a WAL-safe logical comparison, an online SQLite snapshot after migration was
`cb210363f03eb0f355d70bb3778977120288b0e1a1907b84d836525521a07800` (1,056,768
bytes). The raw canonical main-file SHA remained `939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; WAL contents are included in the online snapshot and reflected by the row/schema checks below.

## Schema and migration

D.2 and D.3 prerequisite migrations were missing from the canonical database and
were applied before D.4 because D.4 references their result and consensus tables.
The D.2, D.3, and D.4 scripts were each run against the explicit canonical SQLite
path and rerun idempotently. D.4 added:

- `publication_releases` — one explicit event release state;
- `publication_revisions` — immutable participant-payload revision metadata;
- `publication_awards` — active/removed award assignments;
- `publication_feedback` and `publication_feedback_comments` — administrator
  summaries and explicitly releasable comments;
- `publication_announcements` — sanitized event announcement state.
- `publication_qualification_releases` — exact synthetic submission release state;
  no event publication side effect;
- `publication_qualification_revisions` — immutable synthetic payload revisions;
- `publication_qualification_announcements` — submission-scoped synthetic
  announcement state, isolated from the real event announcement.

All foreign keys are restrictive or set-null where history must survive account
deletion. Status/mode checks and partial uniqueness prevent invalid lifecycle and
duplicate active awards. Historical D.2 publication timestamps remain in their
original table; D.4 initialization always starts at `calculated` and does not infer
publication from a legacy timestamp.

## Canonical data validation

Post-migration and post-deployment counts (real baseline plus explicitly labeled
synthetic fixture):

| Data | Count |
| --- | ---: |
| Users | 8 (5 real + 3 synthetic) |
| Submissions | 10 (9 real + 1 synthetic) |
| Judges | 5 (3 real + 2 synthetic) |
| Assignments | 17 (15 real + 2 synthetic) |
| Human scores | 14 (12 real + 2 synthetic) |
| Private score notes | 14 (12 real + 2 synthetic) |
| Admin authorizations | 1 (real unchanged) |
| Judge authorizations | 3 (1 real + 2 synthetic, synthetic revoked after qualification) |
| Identity links | 2 |
| Submission memberships | 4 |
| Chat rooms/messages | 1 / 6 |
| D.4 event release/revisions | 1 / 1 (calculated) |
| D.4 qualification release/revisions/announcement | 1 / 1 / 1 (calculated/draft, gate off) |
| D.4 awards/feedback/comments | 1 / 1 / 1 (synthetic, excluded when gate off) |
| D.4 event announcements | 0 |

Evaluation states remain 3 `not_started` and 12 `submitted`. SQLite integrity is
`ok`; `foreign_key_check` is empty. No real score, assignment, note, ownership,
authorization, identity link, membership, or chat row changed.

The audit stream contains one additional expected `admin_session_rejected` record
from the signed-out production boundary check; no publication mutation audit was
created.

The D.4 release is:

```text
status: calculated
publication_mode: awards_only
show_scores: true
published_at: null
archived_at: null
```

No real participant result or feedback is visible. With qualification disabled, the
synthetic participant result route returns the normal Pending state and the fixture
is excluded from ordinary publication/ranking data. An unauthenticated request to a
real workspace results route returns only the signed-out private-workspace state;
the admin route redirects to the generic admin sign-in boundary.

## Disposable qualification

The disposable fixture used synthetic administrator, participant, and judge
accounts, a finalized synthetic submission, a submitted evaluation, a private note,
and publication controls. It verified:

- calculated/reviewed/approved/published progression;
- award assignment and participant visibility;
- private-note exclusion;
- participant route protection;
- desktop and mobile Chromium layout/no-overflow checks.

Result: **4/4 Chromium tests passed** (desktop and mobile, administrator and
participant flows). The full unit suite passed **243 tests across 45 files**. The
focused publication migration passed on a disposable database. TypeScript,
production build, changed-file ESLint, and `git diff --check` passed. WebKit was not
run because the host does not provide its required browser libraries.

Representative synthetic screenshots were captured at the stable desktop/mobile
viewports and reviewed for hierarchy, overflow, focus-safe controls, and the
participant/admin boundary:

- [Admin publication desktop](assets/phase-d4-admin-publication-desktop.png)
- [Admin publication mobile](assets/phase-d4-admin-publication-mobile.png)
- [Participant results desktop](assets/phase-d4-participant-results-desktop.png)
- [Participant results mobile](assets/phase-d4-participant-results-mobile.png)

The admin preview now calls the exact same sanitized participant projection as the
participant results page. It never includes private notes, judge identities,
judge-specific scores, consensus, calibration, audit metadata, or tokens.

## D.4R synthetic production boundary

Namespace: `d4-publication-qualification-20260803-8f1c`.

Synthetic IDs (no credentials or edit tokens are recorded):

- participant: `d4q_participant_20260803_8f1c`;
- judges: `d4q_judge_a_20260803_8f1c`, `d4q_judge_b_20260803_8f1c`;
- submission: `sub_d9oPAhzQ`;
- qualification release: `pqr_evt_vibe_2025_sub_d9oPAhzQ`;
- qualification announcement: `d4q-announcement-q-20260303`.

The server-owned controls are:

```text
VIBE_PUBLICATION_QUALIFICATION_ENABLED=false
VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST=
```

When enabled for the exact fixture only, the q-release is used by the participant
projection and admin operations; non-allowlisted submissions remain Pending and
cannot be selected through a browser-supplied ID. Q announcements are stored in a
separate submission-scoped table. The event release and `events.winners_published_at`
remain untouched.

The synthetic participant Pending state was verified after deployment. The
authenticated administrator lifecycle was intentionally not claimed: no approved
administrator credential was supplied for the live mutation walkthrough. Synthetic
passwords were removed, all synthetic sessions were revoked, and the two synthetic
judge authorizations were revoked. The fixture remains a clearly marked, gate-off
regression fixture; it is excluded from normal rankings/results/exports.

## Visibility and privacy

Before publication, participants see only the pending state. Awards, scores,
criterion averages, releasable comments, administrator summaries, and announcements
are withheld. Private judge notes are never copied into D.4, never included in the
admin preview, and never included in CSV/JSON publication exports. Chatto and Viby
were not modified.

## Rollback readiness

Application rollback is the previous immutable D.4 release
`a70edc283261-d4-publication-20260802T222135Z` followed by a restart of only
`vibe-hackathon`; additive D.4R tables and revision history remain. Database restore
is reserved for migration/integrity failure and uses the verified backup above. The
qualification gate can be disabled immediately; the event release remains
calculated, so no emergency real-result visibility rollback was required.

## Required next approval

Provide one approved administrator credential/session for the synthetic-only
walkthrough. With the gate temporarily enabled for `sub_d9oPAhzQ`, execute the
audited lifecycle and visibility checks, then disable the gate and revoke the
fixture accounts again. No real result should be published.
