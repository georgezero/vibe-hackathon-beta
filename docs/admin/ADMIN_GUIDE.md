# Administrator and organizer guide

Use this document as the durable starting point for event operations. Detailed
deployment, database, judging, publication, Community, and observability
runbooks remain the operational authorities linked below.

## Begin an event-day check

1. Sign in through `/admin` using the organizer identity and current Viby
   allowlist.
2. Open the dashboard Event Health and confirm the active event, deadlines,
   freeze state, readiness, judging coverage, and publication state.
3. Use **Submission Readiness** to find teams that need attention. Inspect
   private roster details only in the administrator surface.
4. Use **Judging**, **Results**, and **Publication** deliberately. Calculated
   or reviewed results remain private until the D.4 release is explicitly
   published.
5. Use `/admin/community` for event-scoped channel moderation and reports.
6. Use `/admin/participant-experience` for bounded journey aggregates and
   optional participant feedback. These signals are for product learning, not
   participant scoring or ranking.

## Important boundaries

- Administrator authorization is separate from Better Auth participant and
  judge sessions. Admin mutations require the signed organizer session, the
  current Viby allowlist, and the configured same-origin request policy.
- Never use SQLite or a browser shortcut to bypass edit-token, membership,
  judging, publication, or freeze rules.
- Public projections must not contain emails, badge numbers, edit/recovery
  tokens, private notes, judge identities, or private team/chat content.
- Team Chat is project-local. Direct Messages and Community are global social
  surfaces for authenticated active accounts, subject to their own safety and
  moderation rules; Community content remains event-scoped.
- Do not seed synthetic projects, messages, feedback, or accounts into the
  real event merely to make dashboards look populated.

## Operational references

- [`EVENT_DAY_OPERATIONS.md`](../runbooks/EVENT_DAY_OPERATIONS.md) — opening,
  judging, publication, and emergency response.
- [`EVENT_DATABASE_OPERATIONS.md`](../runbooks/EVENT_DATABASE_OPERATIONS.md) —
  snapshots, isolated event simulation, and guarded restore.
- [`COMMUNITY_OPERATIONS.md`](../runbooks/COMMUNITY_OPERATIONS.md) — channel
  provisioning, access, moderation, and archival.
- [`PARTICIPANT_EXPERIENCE_OBSERVABILITY.md`](../runbooks/PARTICIPANT_EXPERIENCE_OBSERVABILITY.md)
  — H.2 telemetry and feedback interpretation.
- [`JUDGE_AUTHENTICATION.md`](../JUDGE_AUTHENTICATION.md) — judge session and
  authorization contract.
