# Scale and performance report

The realistic profile contains 75 synthetic submissions, 150 synthetic users,
30 synthetic judges, 265 synthetic assignments, 250 completed evaluations, 45
private chat rooms, 225 messages, and 45 read-state rows.
SQLite integrity and foreign-key checks passed after base creation and all four
scenario clones.

An isolated Next.js production process booted the healthy scenario in about
0.2 seconds after startup, reported database health 200, and served the public
smoke set (`/`, `/projects`, `/api/v1/status/live`) with HTTP 200. The process
ran on port 3332 and was terminated. No production process was restarted.

E.0 measured startup and HTTP smoke health only. Full authenticated page-load,
export, ranking, calibration, and query-plan timing remains an activation gate;
no speculative indexes or ranking changes were made. The recommended next step
is a separate non-production service/port with a writable clone and stable
synthetic personas, rather than swapping the live database during a load test.
