# Phase B.4.3 — Production Deployment and Qualification

Date: 2026-07-30  
Host: `paui`  
Application origin: `https://vibe-hackathon-dev.ggg.ad`  
Runtime origin: `https://viby.keit.ai`

## Decision

Phase B.4.3 is deployed and the approved Ada judge path is operational in
`hybrid` mode. No rollback trigger occurred.

The B.4.4 gate remains conditional because no separately approved live account
or action was available for:

- an actual administrator password or Viby face-login regression;
- an authenticated Better Auth user with no judge authorization;
- an admin-and-judge combined-role session;
- production judge-authorization revocation.

Those boundaries remain covered by the completed automated/disposable suites.
The live signed-out administrator entry point, both authentication choices,
judge-only denial from the administrator area, application health, and the
unchanged administrator configuration were verified.

## 1. Release and pre-deployment record

- Branch: `phase-vh-m6-viby-better-auth-session`
- Approved/deployed application HEAD:
  `a03986974ad5ab03453990f7b7f3444e29773b3c`
- Starting tracked worktree: clean
- Protected untracked backup: `local.db.pre-p0-4.bak`
  - not opened, copied, modified, staged, or included in the release
- Pre-deployment release:
  `767e4fd1c4d704402973a60c76465eee2813709f`
- Pre-deployment PID: `809697`
- Pre-deployment start time: `2026-07-29 22:35:40 EDT`
- Pre-deployment restart count: `0`
- Pre-deployment administrator session mode: `better-auth`
- Pre-deployment judge authentication mode: implicit default `legacy`
- Canonical database:
  `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deployment main-file modification time:
  `2026-07-28 19:54:37.363388871 -0400`
- Pre-deployment local health: HTTP `200`
- Pre-deployment public health: HTTP `200`
- Judge profiles: `3`
- Assignments: `15`
- Scores: `12`
- Judge authorizations: `0`
- Better Auth users: `1`
- Approved Ada user ID: absent, with no conflicting ID or email
- Approved judge `judge_media_ada`: exactly one row
- Event `evt_vibe_2025`: exactly one row
- Duplicate assignment pairs: `0`
- Duplicate score pairs: `0`
- Foreign-key violations: `0`

The missing Ada user was the expected provisioning state. The exact ID and
email were both conflict-free before provisioning.

## 2. Protected backup

- Backup:
  `/opt/vibe-hackathon/backups/local.db.pre-b4-3.20260730T084633-0400.bak`
- Created: `2026-07-30 08:46:42 EDT`
- Mode: `0600`
- Owner: `george`
- Size: `393216` bytes
- SQLite integrity check: `ok`
- Foreign-key check: passed
- SHA-256:
  `925b555a6d3d5ea8f65aca7dfed9821f043b561e772b028b5549c1362c7b30b7`

The backup was created with SQLite's online backup API. The protected
pre-P0.4 backup was not accessed.

## 3. Canonical migration

The approved migration command targeted the absolute canonical database.

First run:

- schema: valid
- judges: `3`
- assignments: `15`
- scores: `12`
- judge authorizations: `0`
- automatic authorizations created: `0`
- foreign-key check: passed

Second identical run:

- schema: valid
- counts unchanged
- automatic authorizations created: `0`
- foreign-key check: passed
- idempotence demonstrated

All eleven required indexes exist:

- seven lookup indexes on judge authorization state;
- two partial active-authorization uniqueness indexes;
- unique assignment ownership;
- unique score ownership.

Post-migration integrity remained `ok`, with zero duplicate assignment or score
pairs.

## 4. Better Auth user provisioning

Exactly one user was provisioned:

- user ID: `b43_ada_XtwDOCT_2t1B`
- display name: `Ada Patel`
- email: `judgeada@fff.ad`
- user result: created
- credential account result: created
- judge authorization created by provisioning: `false`

The approved credential was supplied through hidden interactive input and a
mode-0600 temporary file. It did not appear on the command line, in retained
output, in this report, or in application logs. The temporary file was
securely removed.

The resulting account has exactly one credential account. Provisioning left
the judge-authorization count at zero.

## 5. Explicit Ada authorization

The ID-based dry run returned `ready`.

The confirmed mapping created:

- authorization ID: `P5i3sB6xV6NZLGN58s6ZL`
- Better Auth user: `b43_ada_XtwDOCT_2t1B`
- judge profile: `judge_media_ada`
- event: `evt_vibe_2025`
- status: `active`
- grant provenance: `operator_approved_b4_3_production`

Validation:

- exactly one matching active authorization;
- no other user mapped to Ada's judge profile for the event;
- Ada mapped to no other judge profile for the event;
- no Ben user or authorization created;
- no Cleo user or authorization created;
- profiles remained `3`;
- assignments remained `15`;
- scores remained `12`;
- foreign-key check passed.

## 6. Immutable build and deployment

- Release directory:
  `/opt/vibe-hackathon/releases/a03986974ad5ab03453990f7b7f3444e29773b3c`
- Embedded release commit:
  `a03986974ad5ab03453990f7b7f3444e29773b3c`
- Build start: `2026-07-30 08:49:15 EDT`
- Build completion: `2026-07-30 08:50:28 EDT`
- Clean install: passed
- Next.js 16.2.12 production build: passed
- Build warnings:
  - optional GitHub OAuth configuration remains absent;
  - npm reported existing dependency advisories.

The application symlink was switched atomically. Only
`vibe-hackathon.service` was restarted.

Effective environment:

- `VIBE_JUDGE_AUTH_MODE=hybrid`
- `VIBE_JUDGE_EVENT_ID=evt_vibe_2025`
- `VIBE_VIBY_SESSION_MODE=better-auth`
- canonical database path unchanged

Post-restart:

- PID: `2307060`
- start time: `2026-07-30 08:50:59 EDT`
- restart count: `0`
- service: active/running
- startup log: Next.js Ready in 183 ms
- local health: HTTP `200`
- public health: HTTP `200`
- Runtime root health: HTTP `200`

Viby was not modified or restarted.

## 7. Signed-out judge experience

`GET /judge` returned HTTP `200`.

Confirmed:

- Better Auth sign-in is visible;
- access is described as requiring active event authorization;
- legacy fallback is visible;
- legacy fallback is marked temporary;
- no Viby judge option is shown;
- no automatic Runtime redirect occurs.

## 8. Ada Better Auth login and identity resolution

The approved Ada credentials successfully established a normal Better Auth
session and opened `/judge/dashboard`.

Confirmed:

- dashboard heading: `Ada Patel`;
- Better Auth user: `b43_ada_XtwDOCT_2t1B`;
- server-resolved judge profile: `judge_media_ada`;
- authorization: `P5i3sB6xV6NZLGN58s6ZL`;
- event scope: `evt_vibe_2025`;
- dashboard assignment cards: `5`;
- Better Auth session cookie present;
- no custom judge cookie required for the Better Auth path.

An earlier aborted browser-harness session was removed through Better Auth's
supported revoke-other-sessions endpoint. Final active Ada session count after
logout is zero.

## 9. Assignment and score ownership

All five assigned submission pages returned HTTP `200`:

- `sub_media_a`
- `sub_media_b`
- `sub_media_c`
- `sub_media_d`
- `sub_media_e`

An unassigned submission page returned HTTP `404`, and the corresponding API
request returned HTTP `403`.

All five assigned API reads returned HTTP `200` and reported the
server-resolved judge ID `judge_media_ada`, even when an alternate browser
`judgeId` query value was supplied.

Existing scores loaded for four assigned submissions. The fifth assigned
submission correctly had no existing score.

No live score was created or updated because no established reversible
production score-mutation workflow was approved. The score fingerprint before
and after live qualification was identical:

- count: `12`
- aggregate update timestamp: unchanged

Live write ownership therefore relies on the already-passed disposable
qualification. No browser-supplied judge identity was accepted on the live
read path.

## 10. Same-origin and freeze behavior

- Harmless malformed same-origin score request: HTTP `400`
  - proves the request passed the origin boundary and reached payload
    validation;
  - produced no data mutation.
- Controlled cross-origin score request: HTTP `403`
  - produced no data mutation.

The event remains unfrozen. No production freeze toggle was performed.
Existing freeze enforcement and the informational judging-deadline policy
remain covered by automated regression tests and were not changed by this
deployment.

## 11. Role separation and hybrid behavior

Ada is judge-only:

- Judge navigation and dashboard work.
- Admin navigation is absent.
- `/admin/dashboard` redirects to the standard not-authorized outcome.
- No administrator authorization was created.

Legacy fallback:

- an approved existing legacy credential reached the judge dashboard;
- it created only the existing legacy judge cookie;
- it created no Better Auth user or judge authorization;
- legacy use was audited;
- no email or name matching occurred.

Hybrid precedence:

- a browser holding genuine Better Auth and legacy judge cookies resolved Ada
  from the Better Auth authorization;
- API identity remained `judge_media_ada`;
- the legacy cookie could not override the Better Auth identity;
- one `judge_auth_mode_conflict` event recorded
  `legacy_cookie_ignored`;
- no identities were merged.

Live admin-and-judge role switching was not performed because Ada has no admin
authorization and no separately approved combined-role account was available.
No admin grant was manufactured for qualification.

## 12. Logout

The shared account control logged Ada out.

Confirmed:

- Better Auth session removed;
- final active Ada session count: `0`;
- protected judge route redirected to `session_required`;
- a genuine legacy-only logout removed the legacy cookie;
- combined-cookie logout replaced the legacy credential with a zero-length,
  non-authorizing deletion marker;
- the zero-length marker cannot decode or authorize and protected access was
  denied;
- no active custom judge credential remained.

The zero-length browser marker is a minor presentation/storage cleanup risk,
not an authorization bypass.

## 13. Administrator and unauthorized qualification limits

Live administrator entry validation confirmed:

- `/admin` returns HTTP `200`;
- Better Auth email and password fields are available;
- password sign-in is available;
- Continue with Viby is available;
- administrator session mode remains `better-auth`;
- Ada cannot enter the administrator area.

An actual administrator password login and Viby face verification were not
performed because no administrator credential or interactive face operator
was available to this run. The full administrator automated suite passed
before deployment, and the deployed administrator code is the exact tested
release.

An authenticated no-role/no-judge live outcome was not performed because no
approved no-role account exists. No account was created solely for this test.

## 14. Revocation

Production Ada authorization was not revoked. No separate approval for a
production revocation test was supplied.

Immediate revocation and preservation of profiles, assignments, scores, and
independent admin access remain covered by the disposable qualification.

## 15. Audit and sensitive-output validation

Applicable production audit evidence exists:

- `judge_authorization_granted`: `1`
- `judge_password_login_succeeded`: present
- `judge_access_denied`: present
- `judge_logout`: present
- `legacy_judge_login_used`: present
- `judge_auth_mode_conflict`: `1`
- score mutation audit: absent, as no score mutation was performed

Audit metadata was compared against all current:

- judge credentials;
- Better Auth credential hashes;
- session tokens.

Exact sensitive matches: `0`.

The only keyword scan match was the safe diagnostic reason
`legacy_cookie_ignored`; its metadata keys were limited to user, judge,
authorization, event, mode, and reason identifiers.

Service startup/status output passed the sensitive-data scan. No password,
credential hash, judge token, session cookie value, Better Auth token, Runtime
assertion, or callback state was retained in this report.

## 16. Final database and service state

- Judges: `3`
- Assignments: `15`
- Scores: `12`
- Judge authorizations: `1`
- Ada exact active authorization: `1`
- Ben/Cleo authorizations: `0`
- Duplicate assignment pairs: `0`
- Duplicate score pairs: `0`
- Foreign-key violations: `0`
- SQLite integrity: `ok`
- Active Ada sessions after logout: `0`
- Main database file modification time:
  `2026-07-28 19:54:37.363388871 -0400`
- WAL modification time after qualification:
  `2026-07-30 08:57:35.757196872 -0400`
- Final release:
  `a03986974ad5ab03453990f7b7f3444e29773b3c`
- Final PID: `2307060`
- Final start time: `2026-07-30 08:50:59 EDT`
- Restart count: `0`
- Judge mode: `hybrid`
- Administrator mode: `better-auth`
- Local health: HTTP `200`
- Public health: HTTP `200`
- Viby: unchanged
- Rollback performed: no

## 17. Rollback

No rollback trigger occurred.

If rollback becomes necessary:

1. atomically restore release
   `767e4fd1c4d704402973a60c76465eee2813709f`;
2. set judge mode to `legacy`;
3. restart only `vibe-hackathon.service`;
4. verify local/public HTTP `200`;
5. verify administrator and legacy judge access;
6. preserve the additive schema, Ada user, authorization, assignments, scores,
   identity links, and audit history;
7. use the protected B.4.3 backup only for proven corruption and only after
   explicit approval;
8. do not modify Viby.

## 18. Gate for Phase B.4.4

Before an unconditional B.4.4 start:

1. an approved operator should perform one live administrator login on this
   release, including Viby if that regression is required;
2. use an approved combined-role account to confirm live role switching, or
   explicitly accept automated coverage;
3. use an approved no-role account to confirm the live authenticated
   unauthorized judge state, or explicitly accept automated coverage;
4. either approve a reversible Ada revocation/restoration test or explicitly
   accept disposable revocation coverage;
5. decide whether to remove the zero-length legacy-cookie deletion marker in a
   future presentation-only cleanup.

CONDITIONAL GO FOR B.4.4
