# Kentucky Vibes simulation scenarios

Each scenario clones the immutable realistic base; the base is never mutated.
Artifacts are mode `0440` and remain unpublished.

```sh
VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario healthy-event --seed 20260802
VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario operations-stress --seed 20260802
VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario calibration-challenge --seed 20260802
VIBE_EVENT_SIMULATION=1 npm run event:simulate -- kentucky-vibes-base --scenario publication-rehearsal --seed 20260802
```

| scenario | artifact | SHA-256 |
| --- | --- | --- |
| healthy event | `kentucky-vibes-healthy-event-20260802.sqlite` | `966d30b8bd845aed8b8baa6cfcd2bcbf964eeec4b23f74e930aedbf5758a9d9e` |
| operations stress | `kentucky-vibes-operations-stress-20260802.sqlite` | `d2d17c18083f7928ffc32f01c9b2df1ae14bf3535e2fc4222f967ada98c603cc` |
| calibration challenge | `kentucky-vibes-calibration-challenge-20260802.sqlite` | `00d8b8b4c2cae15c7449ce558b4c791cd17e761251f68611f88291bc5ad82470` |
| publication rehearsal | `kentucky-vibes-publication-rehearsal-20260802.sqlite` | `e514e9aab092769d1e2915fb814bea114a61aed781da29d3e09497e2fddd5292` |

The publication rehearsal adds only calculated/unpublished synthetic
qualification releases and rehearsal awards. Operations stress marks synthetic
drafts, not-started reviews, and replacement coverage. Calibration challenge
introduces strict/lenient score spread and flagged consensus reviews. The
runner uses deterministic timestamps and no real-time sleeps.

The realistic base was booted as a writable clone on port 3332 with
`VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes`; `/api/health`, `/`, `/projects`, and
`/api/v1/status/live` returned 200. The clone was stopped and removed after the
check; no second public hostname or Cloudflare route was created.
