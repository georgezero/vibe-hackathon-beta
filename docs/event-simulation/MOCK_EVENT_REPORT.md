# Mock event report

The isolated service and synthetic personas were prepared for a human mock
event. Automated qualification covered the participant, judge, administrator,
results, calibration, publication, export, mobile, and bounded chat flows.

The human multi-user event itself was **not run** in this qualification window.
No approved testers were supplied, so no human login, invitation, scoring,
conflict/reassignment, or publication-rehearsal observation is claimed. The
prepared pre-event snapshot is recorded in `PHASE_E2_HUMAN_MOCK_EVENT.md`.

## Checklist for the next run

1. Start `kentucky-vibes.service` and the local TLS proxy.
2. Assert `/api/health.activeEvent.id = evt_kentucky_vibes`.
3. Use only credentials shown by the named-persona command.
4. Have 4–8 participants exercise workspace, invitations, chat, and
   finalization.
5. Have 3–5 judges score, freeze/reopen, and handle one synthetic conflict.
6. Have administrators inspect Judging, Results, Calibration, and Publication.
7. Keep results unpublished; capture confusion, delays, and workarounds.
8. Stop both Kentucky services and rotate/remove temporary credentials.

This missing human interaction is the remaining E.2 readiness gate.
