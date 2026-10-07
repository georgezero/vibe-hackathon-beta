# Viby Admin Playwright Tests

**Date:** 2026-06-07

## Purpose

The Playwright suite protects the Phase B1/B1.5 authorization boundary:

```text
Viby identity
-> Vibe assertion verification
-> Vibe allowlist authorization
-> Vibe admin session
```

It is not a visual regression suite.

## How To Run

```bash
npm run test:e2e
```

The Playwright config starts Vibe on port `3200`, runs `npm run db:push`, and
uses a mock Viby assertion server on port `3201`.

If browsers are missing:

```bash
npx playwright install chromium
```

## Covered Scenarios

- `/admin/dashboard` redirects to `/admin?reason=session_required` without an
  admin session
- `/`, `/projects`, `/status`, and `/presentation` remain public
- `/admin` primary Viby confirmation link points to
  `/apps/vibe-hackathon/start`, not generic mock-host
- automatic Viby callback redirects back with `assertionId` only and creates a
  Vibe admin session for an allowlisted user
- automatic Viby callback denies a non-allowlisted user
- logout clears access and the dashboard becomes inaccessible again
- invalid assertions do not create admin sessions
- expired and wrong-audience assertions are denied
- mock-host assertions are intentionally rejected for admin
- non-allowlisted Viby users are denied
- allowlisted Viby users receive an admin session and see the identity chip
- tampered admin session cookies are rejected

## Intentionally Not Covered

- real Viby face capture or assertion creation
- screenshots and visual layout comparisons
- participant, team member, judge, or edit-token identity linking
- all `/api/admin/*` route hardening, which remains a documented follow-up

Treat this suite as a release gate for admin identity confirmation. If a change
breaks admin auth, logout, allowlist enforcement, or the public/private route
split, the suite should fail immediately.
