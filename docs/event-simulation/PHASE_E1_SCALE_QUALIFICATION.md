# Phase E.1 scale qualification

## Baseline and instance

Host `paui`; repository
`/home/george/Downloads/src/ai/agentpacs/vibe-hackathon`; branch
`phase-vh-m6-viby-better-auth-session`; HEAD
`a70edc28326108dfc84a69af303f680ceaa7f735`. Current release is
`/opt/vibe-hackathon/releases/a70edc283261-d4r-publication-20260803T005500Z`.
The current service stayed healthy at PID `2987399`, restart count `0`. The
Kentucky instance used port `3010` with local HTTPS qualification on `3240`.
No public hostname was created.

The selected immutable base is the E.0 realistic artifact, SHA
`097a3f47d5d5ac946472741cf622b9a237b891d31ac23491806e142ac2179122`. The
writable clone passed twice-run migrations, integrity, and FK checks. It
contains 85 total submissions (75 Kentucky Vibes), 160 users (150 synthetic
plus isolated operator additions), 35 judge profiles (30 synthetic plus
preserved rows), 282 total assignments (265 synthetic), 264 completed human
scores (250 synthetic), 46 rooms (45 synthetic), 231 messages (225 synthetic),
and 47 read states (45 synthetic). The event-scoped synthetic fixture has no
Viby identity links; two historical links inherited from the source snapshot
remain tied to preserved current-event users and cannot authenticate synthetic
accounts.

## Qualification result

Authenticated desktop and mobile Chromium flows passed for administrator,
judge, and participant personas. Admin dashboards, judge Evaluation, complete
participant workspace, pending Results, role denials, exports, mobile layout,
and valid ten-room SSE all passed. Scenario artifacts all passed integrity/FK
and temporary health boot checks. Production database checksum, PID, counts,
health, and unpublished state remained unchanged.

The final writable state was captured with SQLite's online backup API after
stopping the Kentucky service. The immutable WAL-safe artifact is
`kentucky-vibes-e1-qualified-20260803T031000Z.sqlite`, SHA
`fc99add53310b92988c26cdc1ce72962f1f0ce1e6471ee4ad951c9c9f2ef53c2`.

The first uncontrolled build attempt hung while holding `.next/lock`; the
exact abandoned process tree was stopped and only the generated lock removed.
A controlled TTY build then passed compile, TypeScript, page generation, and
route finalization. This is documented in
`AUTHENTICATED_SCALE_QUALIFICATION.md`.

## Persona and operator commands

```sh
npm run event:persona:list -- kentucky-vibes
npm run event:persona:show -- kentucky-vibes admin
systemctl --user status kentucky-vibes.service --no-pager -l
curl -k https://127.0.0.1:3240/api/health
```

Passwords are never included in this report. The mode-0600 persona file is
outside the repository.

## Remaining gate

The service is technically ready, but the approved human multi-user mock event
has not been conducted. E.2 prepared a fresh clone, rotated temporary
credentials, completed automated smoke checks, and captured a pre-event
snapshot; it did not claim human observations. The exact checklist is in
`MOCK_EVENT_REPORT.md` and the preparation record is
`PHASE_E2_HUMAN_MOCK_EVENT.md`. Until that walkthrough is completed, do not
expose a public hostname and keep the Kentucky service stopped by default.

CONDITIONAL — approved human multi-user Kentucky Vibes mock-event walkthrough remains pending
