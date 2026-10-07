# Phase E.2 — Human mock event preparation

## Status

This run prepared a fresh mock-event database and isolated credentials, but no
approved human testers were available in the execution window. No human
behavior, support burden, or debrief finding is claimed.

Prepared at `2026-08-03 00:26 EDT` on host `paui`.

## Baseline

- repository: `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`;
- branch: `phase-vh-m6-viby-better-auth-session`;
- HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`;
- production PID: `2987399`, restart count `0`, HTTP 200;
- production checksum: `939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`;
- Kentucky services: stopped (`kentucky-vibes.service` and local TLS proxy,
  ports `3010` and `3240` free);
- host capacity at preparation: approximately 137 GB free disk and 5 GB
  available memory; no sustained load was generated;
- source artifact: `kentucky-vibes-e1-qualified-20260803T031000Z.sqlite`;
- source checksum: `fc99add53310b92988c26cdc1ce72962f1f0ce1e6471ee4ad951c9c9f2ef53c2`;
- environment: `/opt/vibe-hackathon/instances/kentucky-vibes/.env`, mode 0600;
- access: loopback `3010` behind loopback TLS proxy `3240`.

## Fresh mock database

The writable clone was created through SQLite online backup, staged through a
temporary file, fsynced, and atomically renamed:

`/opt/vibe-hackathon/instances/kentucky-vibes/data/mock-event-20260803T042200Z.sqlite`

The applicable migrations were run twice. The historical Viby Better Auth
migration was not rerun because the qualified artifact already contains a newer
compatible constraint; it fails closed rather than rewriting that schema. The
clone passed integrity and foreign-key checks and retained event
`evt_kentucky_vibes` / `kentucky-vibes`, calculated publication state, and
fixture provenance. Event-scoped counts are 75 submissions, 265 assignments,
250 completed scores, and 45 seeded chat rooms. The smoke walkthrough opened
four additional rooms through the normal application path, so the prepared
writable clone/snapshot contains 49 rooms and 225 messages; this is an
expected preparation delta, not a human-event observation.

The source artifact retains two historical Viby identity-link rows belonging
to preserved non-synthetic users from the source database. No synthetic user
has a Viby identity link, the isolated Viby flow was disabled/fake-configured,
and no Viby request or production Viby mutation occurred.

## Credential and roster preparation

An administrator was provisioned through `provision-password-admin.ts` and
participant/judge passwords were rotated through the authenticated account
password endpoint. A mode-0600 roster and credentials were kept outside the
repository at `/opt/vibe-hackathon/instances/kentucky-vibes/e2-credentials/`.
They were removed after preparation because no testers were assigned. No
credentials appear in this document.

The proposed roster covers complete/incomplete owners, two teams, an active
teammate, three judge workloads, an administrator, and an unauthorized
negative-control persona. Tester aliases remain unassigned.

No approved human tester names, aliases, or schedule were provided, so the
roster is intentionally a template rather than a completed participant list.

## Automated preparation smoke

After rotation, administrator, judge, and participant logins returned 200. The
admin Judging/Results/Calibration/Publication routes, judge dashboard and
Evaluation, and participant workspace/Messages/Results all returned 200 on the
loopback TLS origin. Production remained running with the same PID and checksum.

## Human protocol

When approved testers are available, regenerate credentials from the E.1 seed
tooling, start both Kentucky services, and use the round-based protocol in
`MOCK_EVENT_REPORT.md`. Give goals rather than scripted clicks. Record only
synthetic observations and stop immediately for security, publication, data,
or session-isolation incidents.

## Snapshot and final state

Because no human event started, the preserved artifact is a pre-event prepared
snapshot, not a post-event result:

`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-human-mock-prep-20260803T042500Z.sqlite`

SHA-256: `fbed7a842e49502fb2e14cd974f5288f3c376497ed4995b17fa074b40b2ca482`.
Integrity and foreign keys passed. Both Kentucky services are stopped and
temporary credentials/WAL sidecars were removed. The E.1 qualified artifact is
unchanged. The writable clone remains stopped and is not an active service
target; a future rehearsal should create another fresh clone rather than rely
on this prepared copy.

## Decision

The next phase is the human rehearsal itself, not product expansion. No D.5 AI
work should begin until the human workflow is observed and the findings are
prioritized.

CONDITIONAL — approved human testers and a completed 60–120 minute rehearsal are pending
