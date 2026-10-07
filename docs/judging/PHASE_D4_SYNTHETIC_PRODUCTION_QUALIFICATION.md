# D.4R Synthetic Production Qualification

## Disposition

**CONDITIONAL GO.** The submission-scoped qualification gate is deployed and
disabled by default. Real results remain unpublished. The synthetic participant
Pending projection and isolation behavior passed; the authenticated production
administrator lifecycle remains a human gate because no approved administrator
credential was provided for this run.

## Baseline and release

- Repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`
- Branch: `phase-vh-m6-viby-better-auth-session`
- Implementation HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
- Deployed release: `a70edc283261-d4r-publication-20260803T005500Z`
- PID: `2987399`
- Restart count: `0`
- Local/public health: HTTP 200
- Rollback release: `a70edc283261-d4-publication-20260802T222135Z`
- Event publication state: `calculated`

The verified WAL-aware backup is
`/opt/vibe-hackathon/backups/local.db.pre-d4r-deploy-20260803T004000Z.sqlite`,
mode `0600`, 1,114,112 bytes, SHA-256
`996be7adfc53193e74893925456bd5db5f5ca65e3b5cc093ddae7a1012288a2e`. Integrity
and foreign-key checks passed.

## Qualification gate

The gate is server-owned and exact-ID based:

```text
VIBE_PUBLICATION_QUALIFICATION_ENABLED=false
VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST=
```

It accepts only valid `sub_<identifier>` IDs, rejects wildcard/empty segments and
malformed values, and never treats a browser parameter as an opt-in. With the gate
off, qualification rows are excluded from normal results/rankings/exports and an
authorized fixture member receives Pending. With the gate on, only the exact
allowlisted submission uses the q-release; non-allowlisted submissions remain
Pending. Disabling the gate immediately removes q visibility.

The q-release and q-revision tables are independent of the event release. Q
announcement content also has a submission-scoped table. No q operation updates the
event release or `events.winners_published_at`.

## Synthetic fixture

Namespace: `d4-publication-qualification-20260803-8f1c`.

| Object | ID |
| --- | --- |
| Participant | `d4q_participant_20260803_8f1c` |
| Judge A | `d4q_judge_a_20260803_8f1c` |
| Judge B | `d4q_judge_b_20260803_8f1c` |
| Submission | `sub_d9oPAhzQ` |
| Q release | `pqr_evt_vibe_2025_sub_d9oPAhzQ` |
| Q revision | `pqr_evt_vibe_2025_sub_d9oPAhzQ_rev_1` |
| Q announcement | `d4q-announcement-q-20260303` |

The submission is explicitly marked by the q table fixture marker
`d4-publication-qualification`. It has synthetic owner membership, two synthetic
submitted evaluations, one active synthetic award, a feedback row/comment, a finalist
marker, and a private-note sentinel. It is not a real participant submission and is
not chat-allowlisted.

Temporary credentials were stored only in mode-0600 files during setup, then
removed. Synthetic sessions were revoked, synthetic password credentials were
cleared, and synthetic judge authorizations were revoked. No administrator
credential was reset or created.

## Checks completed

- D.4 migration first run and rerun: idempotent; integrity/FK passed.
- Qualification configuration tests: disabled default, exact allowlist, malformed
  and empty fail-closed cases, and immediate disablement (5 tests passed).
- Full isolated unit suite: 247 tests across 46 files passed.
- TypeScript: passed.
- Production build: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.
- Deployment artifact scan: no database/environment/test artifacts included.
- Synthetic participant authenticated Pending route after deployment: passed.
- Event-level release remained calculated; no real publication became visible.
- Real baseline preserved separately: 3 judges, 15 assignments, 12 scores, 12
  private notes, 9 real submissions, and 1 real admin authorization.
- WebKit was not run because required host browser libraries are unavailable.

## Pending live administrator gate

The following must be performed with an approved administrator session while the
gate is temporarily set to the exact synthetic ID:

1. Open `/admin/publication` and verify synthetic-only rows/fixture labeling.
2. Use the same participant projection in Admin Preview.
3. Execute `calculated → reviewed → approved → published → archived`.
4. Qualify awards-only, feedback-later, and full approved revisions.
5. Verify withdrawal, republish, archive, exports, audit/revision history, and the
   private-note/judge-identity leak scans.
6. Disable the gate, revoke synthetic accounts, and confirm real results remain
   Pending.

No direct SQL lifecycle mutation is being represented as an authenticated admin
operation. This is the remaining human qualification gate.

## Preservation and rollback

The real event remains calculated and unpublished. Chat rooms/messages, participant
memberships, identity links, admin/judge authorizations, real assignments, scores,
notes, finalists, winners, and consensus records were not changed. Roll back the
application to the previous immutable release if required; preserve the additive
schema and fixture audit/history. Database restore is reserved for migration or
integrity failure.

Chatto was unchanged.

Viby was unchanged.
