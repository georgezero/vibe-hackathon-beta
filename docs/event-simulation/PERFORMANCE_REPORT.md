# Performance report

## Conditions and budgets

Measurements were local to host `paui`, Node 22, Next 16.2.12, SQLite WAL, and
the 75-submission realistic dataset. Initial budgets were the E.1 targets
(participant pages <750 ms p95, judge pages <1 s p95, admin operations pages
<1.5–2 s p95, exports <5 s, SSE delivery <2 s). The evidence below is a smoke
qualification sample, not a production SLA claim.

## Findings

- participant workspace responses: 179–450 ms;
- judge routes: 227–338 ms;
- admin operations routes: 268–577 ms;
- CSV/JSON exports: HTTP 200, 83–27,499 bytes for the synthetic dataset;
- ten valid SSE connections: 72–189 ms first frame, no errors;
- no unbounded page overflow observed on mobile.

No route exceeded its initial smoke budget. No N+1 or missing-index change was
justified by this sample, so no ranking, calibration, authorization, or schema
semantics were changed in E.1. Continuous load and 25/50-connection tests
remain future work because the application rate-limits each principal to four
realtime connections per minute.

The realistic base artifact is 1,904,640 bytes. Scenario artifacts are
1,904,640 bytes except operations stress at 1,912,832 bytes. Integrity, FK,
backup, and boot checks passed. Run a human mock event and a longer multi-user
load profile before treating these values as capacity limits.

No human-event performance sample exists yet. E.2 preparation smoke used the
same local budgets and did not mutate production.

The E.2 smoke was a bounded route-health check only; it is not a substitute for
the approved 60–120 minute human observation or multi-user performance run.
No latency, support-burden, or mobile-observation claim is made for E.2.
