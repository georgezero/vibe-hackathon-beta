# Phase H.1B — Production Deployment: Navigation / Information Architecture

## Disposition

**GO — H.1 NAVIGATION / IA DEPLOYED AND QUALIFIED**

H.1 was deployed as an application-only immutable release. Production health,
anonymous navigation, publication gating, role boundaries, privacy, and the
canonical database remained healthy. No participant credential, project,
invitation, message, team, submission, or publication mutation was created for
qualification.

## 1. Production baseline

- Host: `paui`
- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Repository HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Current pre-deploy release: `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`
- Pre-deploy PID/start/restarts: `3250791` / `2026-08-10 00:08:56 EDT` / `0`
- Local/public health: HTTP 200, database `ok`
- Canonical DB: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon/local.db`
- Pre-deploy DB SHA-256: `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Integrity: `ok`; foreign-key violations: `[]`
- Active event: `evt_vibe_2025` / `vibe-hackathon-2026`
- Freeze: off (`is_frozen=0`)
- Submission and judging deadlines: not configured (`NULL`)
- Publication: `pr_evt_vibe_2025`, `calculated`, `published_at=NULL`
- Public/discoverable profiles: 3 private profile rows; no public directory
  population was created by this deployment
- DM conversations/messages: `0 / 0`
- Community channels/messages: `4 / 0`
- Submissions: `10` (`5 draft`, `5 finalized`)
- Teams/roster/owners: `10 / 28 / 2`
- Memberships: `2 active`, `3 revoked`; invitations: `3 revoked`
- Team Chat: `1` room, `6` messages, `2` read states
- Users/accounts: `11 / 11`
- Judges/assignments/scores: `5 / 17 / 14`
- Publication rows: `1`
- Viby identity links: `2`
- Rollback pointer: `/opt/vibe-hackathon/current.previous-h1b-20260810T131200Z`

Standing Kentucky Vibes remained healthy at
`https://kentucky-vibes-f0b.ggg.ad` (HTTP 200, `evt_kentucky_vibes`, unfrozen,
PID `2084020`, restart count `0`). Chatto and Viby were not restarted or
modified.

## 2. Viby/full-suite qualification gate

The H.1 report's Viby message was investigated rather than ignored. The exact
test is `tests/viby-better-auth-phase-b.test.ts`, whose child process
intentionally attempts a conflicting and then a revoked subject link. The
operator-safe migration policy correctly throws
`A conflicting or revoked subject link exists; refusing implicit replacement or
reactivation.`; the parent test asserts that error and passes.

Evidence:

- G.5B release: the exact test passed `6/6` with the expected child-process
  stderr.
- H.1 source tree: the exact test passed `6/6` with the same expected stderr.
- Clean isolated aggregate run (`--pool=threads --maxWorkers=1
  --no-file-parallelism --reporter=verbose`): **62 files / 325 tests passed**.
- No Viby, Better Auth, role, or migration test failure was introduced by H.1.

The earlier aggregate-runner hang was an execution-condition/harness issue; it
was resolved by the clean isolated runner conditions above. No Viby production
state, migration policy, or test was weakened.

## 3. Migration decision

**H.1 requires no canonical schema migration.** `lib/db/schema.ts` and
`drizzle.config.ts` are unchanged from G.5B, and no migration script, table, or
index was added. H.1 only reads the existing event freeze/deadline and bounded
publication-release state.

## 4. Verified backup

A fresh online SQLite backup was created without overwriting an earlier
artifact:

- Main artifact:
  `/opt/vibe-hackathon/backups/h1b-production-predeploy-20260810T130234Z.sqlite`
- Created: `2026-08-10T13:02:49.802Z`
- Size: `1,380,352` bytes; mode `0600`
- SHA-256:
  `498bfd83fde92c39548b1808bf67a93729900fac1cb9f4be16c430d74d204689`
- Source DB SHA-256:
  `6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`
- Source release: G.5B release above
- Source HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Backup integrity: `ok`; foreign-key violations: `[]`
- Metadata/checksum sidecars use the same basename and mode `0600`.

## 5. Packaging and alternate boot

The exact H.1 source tree was packaged at:

`/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`

- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Source-tree fingerprint: `02cf279ef2a6be045bd2970ae28c026143ce94458060d4143fee01aec657de7f`
- Build ID: `MNNFFZEXZbG9vRIphxX2D`
- Runtime dependency entries: `401`
- Next executable: present at `node_modules/.bin/next`
- Build/server manifests and static assets: present (`84` static files)
- Candidate size: approximately `944M`
- `.env`/`.env.local`, canonical DBs, clone/qualification DBs, and
  Playwright result artifacts: excluded
- Metadata: `RELEASE_METADATA.json`, `RELEASE_MANIFEST.txt`,
  `SOURCE_TREE_SHA256`

The release booted on alternate port `3076` against a copy of the verified
backup. `/api/health` and `/` returned HTTP 200 and database `ok`; the log
reported `Ready in 584ms`. The temporary server and database copy were stopped
and moved out of the runtime path afterward.

## 6. Build and test gate

- H.1 focused suite: `7` passed
- G.1–G.5 focused regressions: `40` passed
- Clean aggregate suite: `325` tests across `62` files passed
- TypeScript: passed
- Production build: passed after a clean `.next` build
- Changed-file ESLint: `0` errors, two existing `@next/next/no-img-element`
  warnings
- `git diff --check`: passed
- Impeccable detector: clean on the qualified H.1 navigation/workspace files
- Desktop/mobile H.1 browser evidence: passed with no horizontal overflow

## 7. Deployment

The `current` symlink was atomically switched from G.5B to the candidate and
only `vibe-hackathon.service` was restarted. Chatto, Viby, Kentucky Vibes, and
unrelated services were not restarted.

- Old release: `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`
- New release: `/opt/vibe-hackathon/releases/h1-navigation-20260810T130607Z`
- Old PID: `3250791`
- New PID: `400946`
- New process start: `2026-08-10 09:13:12 EDT`
- Restart count: `0`
- Listener: `0.0.0.0:3000`
- Ready log: `✓ Ready in 1193ms`
- Local/public health: HTTP 200, database `ok`

## 8. Production-safe navigation qualification

Anonymous read-only routes `/`, `/start`, `/start/resume`, `/projects`, and
`/login` returned HTTP 200. Anonymous production navigation showed `Projects`,
`Explore`, `Start a project`, and `Log in`; its Explore menu contained `Status`
and `AI Evals`, with no `Results` because the authoritative publication release
is still calculated/unpublished. Private People, Messages, Community, and My
Projects were not presented as anonymous global destinations. Public project
pages remained reachable.

The legacy `/winners` compatibility page source is unchanged from G.5B. The
event retains an older non-null `winners_published_at` compatibility value while
the authoritative D.4 release is calculated/unpublished, as documented in H.0;
H.1 does not use that legacy value for navigation or participant publication
state. No H.1 publication mutation occurred. Reconciling that historical
compatibility route is a separate cleanup candidate, not a change made during
this application-only deployment.

`/messages`, `/community`, and `/people` preserve their login bridges;
admin/judge routes preserve their protected redirects. `/account/projects`
shows the safe “Sign in to view My Projects” empty state without private project
fields.

No approved participant credential was available for a production login. No
synthetic production account was created because the qualified H.1 open,
closed, published, desktop, 1024px, mobile, account-menu, active-workspace,
unread, and role fixtures already exercise the authenticated branch against the
same packaged source tree. This was a deliberate no-mutation boundary, not an
authorization bypass.

Production-safe screenshots are in
`docs/participants/screenshots/h1b/` (anonymous desktop/mobile header, menu,
and Explore states); they contain no credentials or private data.

## 9. Navigation, roles, and event-state invariants

The deployed source retains the qualified H.1 hierarchy:

- authenticated participant work starts at `My Projects`;
- `Projects` remains direct public/event discovery;
- `Community` and `Messages` remain visible but secondary;
- `Explore` groups `Status`, `People`, `AI Evals`, and publication-authoritative
  `Results`;
- `Start a project` is shown only while the server says creation is open;
- `Results` is absent while D.4 is `calculated` and `published_at` is `NULL`;
- Team Chat remains inside the project workspace, never global navigation;
- the active project title/local tabs outrank global secondary navigation;
- admin and judge branches remain independent;
- login `returnTo` and compatibility routes remain unchanged;
- unread Messages remains bounded and discoverable without a realtime global
  connection.

The H.1 closed/frozen and published fixtures covered deadline/freeze and
publication-positive behavior without changing production event state.

## 10. Accessibility, performance, and privacy

The deployed menu uses semantic navigation, `aria-haspopup`, `aria-expanded`,
`aria-current`, Escape-to-close, focus return, descriptive unread labels, and a
single-column mobile menu. The 1024px collapse and approximately 390px mobile
fixtures had no horizontal overflow or clipped menu.

The navigation adds one bounded publication-release status lookup. It does not
query every project, message, channel, or Team Chat room, and it opens no global
SSE/WebSocket connection. The deployed navigation projection contains only safe
role, event/publication state, identity display, and bounded unread counts.
No edit/recovery/invitation token, Better Auth/Viby ID, judge data, score,
private note, Team Chat, DM, or Community body was present in anonymous
navigation payloads.

## 11. Business-data preservation

After deployment and read-only smoke, the canonical DB remained byte-for-byte:

`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`

Size (`1,380,352` bytes), mtime, integrity (`ok`), foreign-key check (`[]`),
critical counts, publication state, and Viby link count remained unchanged.
No project, roster, membership, invitation, Team Chat, DM, Community, judging,
score, publication, Viby link, or result row was created or changed.

## 12. Rollback

For an application-only regression, atomically point `/opt/vibe-hackathon/current`
to `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z` using
the recorded rollback pointer, restart only `vibe-hackathon.service`, and
verify local/public HTTP 200. A database restore is reserved for integrity/FK
failure, corruption, or an unexpected business mutation; it is not needed to
undo navigation presentation.

## 13. Next direction

**HOLD — observe real participant use.** G.1–G.5 and H.1 now cover the core
participant lifecycle and the remaining H.0 concerns are P2-level polish or
empty-state observations. Gather real event feedback before opening another
major implementation phase.
