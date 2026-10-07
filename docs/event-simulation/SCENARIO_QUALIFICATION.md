# Scenario qualification

Each immutable scenario was independently checked before boot and then booted
as a temporary writable clone on port `3011`. The temporary process was stopped
after its health check; the Kentucky Vibes service and the current service were
never swapped.

| scenario | SHA-256 | synthetic submissions | assignments | scores | integrity/FK | boot |
| --- | --- | ---: | ---: | ---: | --- | --- |
| healthy | `966d30b8bd845aed8b8baa6cfcd2bcbf964eeec4b23f74e930aedbf5758a9d9e` | 75 | 265 | 250 | pass | 200 |
| operations stress | `d2d17c18083f7928ffc32f01c9b2df1ae14bf3535e2fc4222f967ada98c603cc` | 75 | 265 | 250 | pass | 200 |
| calibration challenge | `00d8b8b4c2cae15c7449ce558b4c791cd17e761251f68611f88291bc5ad82470` | 75 | 265 | 250 | pass | 200 |
| publication rehearsal | `e514e9aab092769d1e2915fb814bea114a61aed781da29d3e09497e2fddd5292` | 75 | 265 | 250 | pass | 200 |

Startup was 1.6–1.7 seconds after the first warmed build. The artifacts remain
immutable and the base was not modified. Scenario browser review was limited to
health/event identity and database validation; a human multi-user mock event
has not yet been run.
