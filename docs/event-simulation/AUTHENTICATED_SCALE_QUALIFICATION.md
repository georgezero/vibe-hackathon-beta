# Authenticated scale qualification

## Qualification conditions

The service was exercised against the writable realistic clone, with event
assertion `evt_kentucky_vibes` before any browser mutation. Desktop Chromium
used `1440×1000`; mobile Chromium used `390×844`; both used the local TLS
proxy and synthetic password personas.

## Browser results

Administrator routes returned HTTP 200 on desktop and mobile:

- `/admin/judging`
- `/admin/results`
- `/admin/calibration`
- `/admin/publication`

Judge routes returned HTTP 200: `/judge/dashboard` and the synthetic Evaluation
route. Participant routes returned HTTP 200 for `/projects`, every workspace
tab, `/projects/:id/results`, and `/account`.

Judge and participant attempts to open administrator routes were redirected to
`/admin?reason=not_authorized`; their export API requests returned 403. Judge
Team Chat was absent. Participant Results showed the expected pending state.

Representative response times (single local request, not an SLA):

| route family | desktop | mobile |
| --- | ---: | ---: |
| admin Judging | 325 ms | 577 ms |
| admin Results | 378 ms | 281 ms |
| admin Calibration | 426 ms | 268 ms |
| admin Publication | 293 ms | 281 ms |
| judge dashboard | 247 ms | 338 ms |
| judge Evaluation | 230 ms | 227 ms |
| participant workspace routes | 204–350 ms | 179–291 ms |

Screenshots are retained outside the repository at
`/opt/vibe-hackathon/instances/kentucky-vibes/screenshots/e1/`, with desktop
and mobile captures for admin, judge, and participant surfaces. The metrics
record is `metrics.json`; no credentials or private notes were included.

## Native chat

The seeded chat data contains 45 Kentucky Vibes rooms, 225 messages, and 45
read states. A valid ten-connection SSE probe used ten distinct active
synthetic owners and rooms: all ten returned `200`, delivered the initial
`ready` frame, and established in 72–189 ms (1.338 s wall-clock for setup and
cleanup). Earlier same-user/non-member probes returned the designed 403/429
membership and rate-limit responses. The participant Messages route rendered
history, unread state, and the mobile composer without horizontal overflow.

## Accessibility and responsive review

Mobile DOM checks found no horizontal overflow on administrator, judge, or
participant routes. Screenshots show stacked cards and usable mobile tabs.
The existing UI still contains compact icon controls whose bounding boxes are
below 44 px in some dense admin tables; this is recorded as a polish item, not
a scale or authorization blocker.

## Exports and automated checks

Authenticated administrator CSV/JSON exports returned 200 and contained no
password, private-note sentinel, or session material. Judge and participant
export attempts returned 403. No result was published and no browser test
targeted the canonical DB.

- E.0 isolated suite: 252 tests passed;
- TypeScript: passed;
- production build: passed (Turbopack compile, TypeScript, static generation);
- changed event-tool ESLint: passed;
- `git diff --check`: passed;
- integrity and foreign keys: passed for base, writable clone, and scenarios.

The first un-tty build invocation left a stale Next build process holding
`.next/lock`; exact PIDs `3389903 → 3389973 → 3389974` had no listener and were
stopped. After removing only the unowned generated lock, the controlled build
completed normally. Production was not stopped or restarted.
