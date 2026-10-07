# Kentucky Vibes deterministic seed

Definition: `kentucky-vibes` / `evt_kentucky_vibes` / **Kentucky Vibes Hackathon**. Seed version `e0.0.1`; default seed `20260802`; default profile `realistic`.

The seed starts from an immutable current-event snapshot, clones it to a new
writable SQLite file, deactivates the real event in that clone, and activates
only the synthetic event. The application must use
`VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes` when the artifact is run. Real rows
remain in the base clone for schema realism but have no active-event or
synthetic membership path and are not exposed to synthetic personas.

| profile | teams/submissions | users | judges | completed evaluations |
| --- | ---: | ---: | ---: | ---: |
| small | 10 | 25 | 6 | 25 |
| realistic | 75 | 150 | 30 | 250 |
| stress | 100 | 200 | 50 | 300 |

The qualified realistic artifact is
`kentucky-vibes-base-realistic-20260802-20260803T022500Z.sqlite` with SHA-256
`097a3f47d5d5ac946472741cf622b9a237b891d31ac23491806e142ac2179122`. It is
mode `0440`, journal mode DELETE, and passes SQLite integrity and foreign-key
checks.

The synthetic namespace uses `kv_` IDs and `.example.invalid` mailboxes. A
durable `event_fixture_registry` and `event_fixture_records` table records the
fixture name, seed, profile, and root IDs. The realistic registry has 75
teams/submissions, 150 users, 30 judges, 265 assignment roots, and 250 score
roots. There are 265 synthetic assignments: 250 completed (228 submitted and
22 frozen) plus 15 residual draft/not-started work. The artifact also contains
45 synthetic private chat rooms, 225 synthetic messages, and 45 synthetic
read-state rows, plus explicit memberships/invitations, calibration thresholds,
consensus fixtures, finalists, AI review fixtures, and no published synthetic
results.

Better Auth credential hashes are generated through `better-auth/crypto` using
the supported password format. A mode-0600 persona file is generated outside
the repository for an operator-run, non-production instance and removed after
qualification. No Viby identity links or real-domain email addresses are
generated.

```sh
VIBE_EVENT_SIMULATION=1 npm run event:db:create -- kentucky-vibes --profile realistic --seed 20260802
npm run event:db:validate -- kentucky-vibes-base
```

The command refuses an existing artifact, rejects the canonical path, requires
the exact `kentucky-vibes` slug, requires `VIBE_EVENT_SIMULATION=1` (or a
development/test runtime), and never mutates the canonical DB.
