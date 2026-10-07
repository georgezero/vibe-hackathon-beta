# Viby Integration Plan

**Date:** 2026-06-07
**Worktree:** `/home/george/Downloads/src/ai/agentpacs/vibe-hackathon-viby`
**Source repo:** `git@github.com:georgezero/vibe-hackathon-landing-dev.git`
**Branch:** `viby-integration-discovery`
**Scope:** Discovery and architecture only. No behavior changes.

> Historical discovery document. Its judge-token and early admin-token
> descriptions are not operational instructions. Current organizer behavior is
> in `docs/VIBY_ADMIN_INTEGRATION.md`; current judge behavior is in
> `docs/JUDGE_AUTHENTICATION.md`. Judge credentials are no longer delivered to
> browser code, placed in URLs, or used as API bearer tokens.

## Executive Summary

Viby should be integrated as an identity confirmation layer, not as Vibe
Hackathon's authorization system.

Vibe Hackathon already has several authorization mechanisms:

- Admin access is currently a client-side dev token flow.
- Judges use judge tokens and assignment checks.
- Team editing uses submission edit tokens.
- GitHub OAuth exists through Better Auth, mainly for team owner registration
  and recovery when configured.

The smallest useful Viby integration is not participant accounts. It is an
operator-facing confirmation step for high-trust roles:

```text
Admin -> Staff -> Judge
```

Viby can assert:

```text
This is George.
This identity session is fresh.
This assertion is for vibe-hackathon.
```

Vibe must still decide:

```text
George may access admin.
George is staff.
George is this judge.
This team token may edit this submission.
```

## Current Architecture

### Authentication Model

There is no single app-wide authentication model.

The app currently combines:

- Better Auth with GitHub provider.
- A client-side admin token login.
- Judge tokens in route params and bearer headers.
- Submission edit tokens in URLs and bearer headers.
- Badge/email recovery in non-GitHub ownership mode.

Better Auth is configured in `lib/auth.ts`. It uses Drizzle-backed tables
`users`, `sessions`, `accounts`, and `verifications` from `lib/db/schema.ts`.
GitHub is the only configured social provider.

Relevant files:

- `lib/auth.ts`
- `lib/auth-client.ts`
- `lib/team-auth.ts`
- `app/api/auth/[...all]/route.ts`
- `components/GitHubSignInButton.tsx`

`getTeamSessionUser()` reads a Better Auth session from request headers and
joins the `accounts` table to find a GitHub account. This is currently used for
team registration and recovery, not for admin or judge access.

### Admin Access

This section originally documented the pre-Viby baseline. Current admin access
uses a signed Viby-backed organizer session, an exact allowlist, and the
centralized `withAdminApi()` boundary for every `/api/admin/*` handler.
Mutations require an exact same-origin request. `/api/admin/seed` is exact
development-only and has no bearer/local-storage authorization path.

Implication for Viby:

Viby can add identity confirmation for admin workflows, but it should not be
treated as the only fix for admin authorization. The Vibe side needs a real
server-side admin authorization check before a hosted integration is trusted.

### Judge Access

Judges are token-based.

Schema:

- `judges.token`
- `judge_assignments.judge_id`
- `judge_assignments.submission_id`
- `human_scores.judge_id`

Routes:

- `/judge` loads all judge tokens for the login form.
- `/judge/:token` looks up the judge by token.
- `/judge/:token/:submissionId` verifies the judge exists and is assigned to
  that submission.
- `POST /api/scores` requires `Authorization: Bearer <judgeToken>` and verifies
  the judge assignment before writing scores.
- `GET /api/judge/data?token=...&submissionId=...` also verifies judge token
  and assignment.

Implication for Viby:

The first judge integration should not remove judge tokens. It should bind a
fresh Viby identity assertion to a judge-token session, then let the existing
judge token and assignment checks continue to authorize scoring.

### Staff Access

There is no distinct staff model in the current schema or routes.

Admin and staff are currently operational concepts rather than separate
database roles. Staff should probably be introduced as an allowlist/configured
role before Viby is used to confirm staff identity.

Implication for Viby:

For the first integration, "staff" can be a configured allowlist outside the
participant/team model. Do not infer staff status from Viby identity alone.

### Team Token Model

Teams and project submissions are primarily controlled by submission edit
tokens.

Schema:

- `submissions.edit_token` is unique and required.
- `submissions.team_id` links to `teams.id`.
- `team_members.submission_id` and `team_members.team_id` represent the roster.
- `team_owners` and `submission_owners` exist only when a Better Auth GitHub
  owner is recorded.

Token flows:

- `POST /api/register-team` creates a team, submission, owner member, optional
  GitHub owner rows, and an `editToken`.
- `POST /api/v1/submissions` also creates a draft submission and `editToken`
  for API/MCP workflows.
- `/submit/:token`, `/submit/:token/start`, `/submit/:token/preview`,
  `/submit/:token/team`, and `/submit/:token/done` are private routes by
  possession of the token.
- `PATCH /api/v1/submissions/:id` requires
  `Authorization: Bearer <editToken>`.
- `POST /api/v1/submissions/:id/finalize` requires the same edit token.
- `POST /api/v1/submissions/:id/repo-analysis` requires the same edit token.
- `PATCH /api/v1/submissions/:id/team` requires the same edit token.
- `GET /api/submissions/token/:token` returns the private submission state by
  edit token.

Implication for Viby:

Do not remove edit tokens in the first integration. Viby can help link a human
identity to a team or owner record later, but the current edit-token workflow is
the operational backbone for teams and agents.

### Project Ownership Model

Project ownership is represented in two layers:

1. Possession of `submissions.edit_token`.
2. Optional Better Auth ownership through `submission_owners.user_id`.

When `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`, team registration requires a
GitHub-authenticated user. `team_owners` and `submission_owners` are created.
Recovery then uses the signed-in GitHub owner to list owned submissions and
regenerate edit tokens.

When `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false`, registration does not require
GitHub. Recovery uses contact email plus owner badge number.

### Authorization Model

Current authorization is endpoint-specific:

| Area | Current Authorization |
|---|---|
| Admin page | Viby assertion to signed organizer session |
| Admin dashboard page | Server-side organizer session gate |
| Admin event APIs | Central wrapper plus current exact allowlist |
| Admin seed API | Development-only wrapper plus session and exact Origin |
| Judge pages | Judge token in URL |
| Judge scoring API | `Authorization: Bearer <judgeToken>` plus assignment check |
| Team edit pages | Edit token in URL |
| Team/submission write APIs | `Authorization: Bearer <editToken>` |
| GitHub owner recovery | Better Auth session plus `submission_owners` |
| Badge recovery | Contact email plus owner badge number |
| Audience vote | Public with soft anti-spam / identity-voter v2 schema |

### GitHub OAuth Status

GitHub OAuth is implemented through Better Auth.

Files:

- `lib/auth.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`
- `components/GitHubSignInButton.tsx`
- `lib/team-auth.ts`
- `app/register-team/page.tsx`
- `app/recover/page.tsx`

The route `app/api/auth/github/start/route.ts` only redirects to `next`; it does
not start OAuth itself. Real OAuth is initiated client-side by
`authClient.signIn.social({ provider: "github", callbackURL })`.

GitHub OAuth is currently used for:

- Team registration when `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`.
- Team owner recovery at `/recover` when GitHub ownership mode is enabled.
- Regenerating edit tokens for owned submissions.

GitHub OAuth is not currently used for:

- Admin access.
- Judge access.
- Staff access.
- Day-to-day edit-token authorization.

### Submission Ownership and Updates

Submission ownership is operationally controlled by edit token. The GitHub owner
model can recover or regenerate edit tokens, but update/finalize APIs still
check only `submissions.edit_token`.

Important write endpoints:

- `PATCH /api/v1/submissions/:id`
- `POST /api/v1/submissions/:id/finalize`
- `POST /api/v1/submissions/:id/repo-analysis`
- `PATCH /api/v1/submissions/:id/team`

All use `Authorization: Bearer <editToken>`.

### Existing Extension Points

The cleanest Viby insertion points are places where the user is about to enter
or use an existing authority surface:

- Before `/admin/dashboard`: confirm identity, then check Vibe admin
  authorization.
- Before `/judge/:token`: confirm identity, then bind that Viby user to the
  judge token for the current browser session.
- Before `POST /api/scores`: optionally require a fresh Viby assertion in
  addition to the judge token for completed score submission.
- Before `/register-team`: later, link a Viby user to a team lead profile.
- Before `/recover`: later, use Viby identity as an additional recovery factor.
- Before `/submit/:token/team`: later, show "confirmed as team lead" without
  replacing edit-token authorization.

## Viby Integration Opportunities

### Priority 1: Admin, Staff, Judge

#### Admin

Recommended first target.

Current admin auth is the weakest part of the app because most admin dashboard
access and admin APIs are not server-gated. Viby should be introduced only as
identity confirmation, but the integration work should be paired with a Vibe
server-side admin authorization primitive.

Target flow:

```text
/admin
-> existing admin token or future admin allowlist check
-> Identify with Viby
-> Viby returns assertion for app "vibe-hackathon"
-> Vibe verifies assertion freshness and audience
-> Vibe checks this Viby user is allowed as admin
-> create Vibe admin session
-> /admin/dashboard
```

Do not let a Viby assertion alone grant admin.

#### Staff

Staff is not currently represented. Introduce staff as configuration or a Vibe
role mapping before wiring Viby.

Possible MVP:

```text
VIBY_STAFF_USER_IDS=...
VIBY_ADMIN_USER_IDS=...
```

That keeps authorization in Vibe while using Viby for identity.

#### Judge

Judge integration can preserve the judge token.

Target flow:

```text
/judge
-> enter judge token
-> Vibe verifies token exists
-> Identify with Viby
-> Vibe stores browser-local or server-side association:
   judge_token + viby_user_id + viby_session_id + expires_at
-> existing judge routes continue checking token and assignments
```

Later, Vibe can add `judge_identity_links` mapping judge rows to Viby user IDs.
That should not be Phase B unless needed.

### Priority 2: Team Leads and Team Members

Viby can help teams, but this should wait until admin/staff/judge is stable.

Potential uses:

- Link Viby user to team owner after registration.
- Confirm team lead before regenerating edit tokens.
- Confirm identity before team roster edits.
- Confirm team member attendance and prize eligibility.

Keep edit tokens in place during this phase. Viby should become an additional
identity signal, not a replacement for agent-friendly edit-token workflows.

### Priority 3: Participant Accounts

Participant accounts are the largest migration and should be last.

Potential future model:

- Viby user linked to `team_members`.
- Viby user linked to `submission_owners`.
- Badge identity, GitHub identity, and face identity can all be assertions on
  the same person.

Do not start here. It requires schema and UX migration across registration,
team management, recovery, audience voting, and prize eligibility.

## Risks

### Architectural Risks

- **Viby accidentally becomes authorization.** The integration must keep all
  role decisions in Vibe.
- **Admin false sense of security.** Adding Viby identity to the current admin
  pages without server-side Vibe authorization would look stronger than it is.
- **Token replacement too early.** Edit tokens are central to agent-assisted
  submission workflows. Removing them early would break MCP/API ergonomics.
- **Identity mismatch.** A Viby user may not match a GitHub owner, judge email,
  badge number, or team lead name unless Vibe owns an explicit linking process.
- **Assertion replay.** Viby assertions should be short-lived and audience-bound.
  Vibe should not accept stale assertions or assertions for other apps.
- **Operational dependency.** If Viby is down, admin/staff/judge workflows could
  be blocked. Define bypass policy before event day.

### Migration Risks

- Existing event databases may contain teams without GitHub owners.
- Badge ownership mode and GitHub ownership mode produce different ownership
  records.
- Admin APIs are not consistently protected today, so the first real integration
  may uncover security work outside Viby.
- Judge tokens may have been shared by email or copied into local workflows.
  Requiring Viby for all judge actions could disrupt judging unless rolled out
  as confirm-on-entry first.
- Participant linking could create duplicate identities if Viby enrollment,
  GitHub, badge, and email data are not reconciled carefully.

## Recommended MVP

The smallest useful integration is:

```text
Admin identity confirmation page for Vibe Hackathon.
```

MVP behavior:

1. Vibe keeps its existing admin token or adds an explicit admin allowlist.
2. Admin clicks "Confirm with Viby".
3. Viby returns an assertion scoped to `vibe-hackathon`.
4. Vibe verifies:
   - assertion audience is `vibe-hackathon`
   - assertion is fresh
   - Viby user is on Vibe's admin/staff allowlist
5. Vibe creates a Vibe-owned admin session.
6. Admin dashboard and admin APIs check the Vibe-owned admin session.

This produces real value because it confirms "who is operating the dashboard"
without touching teams, submissions, participant accounts, or edit tokens.

## Proposed Implementation Phases

### Phase A: Discovery

Status: this document.

Tasks:

- Map current authentication and authorization flows.
- Identify all token-based write paths.
- Identify GitHub OAuth status and ownership impact.
- Identify safe Viby insertion points.
- Do not modify behavior.

### Phase B: Admin/Staff/Judge Identity Confirmation

Goals:

- Add Viby as a step-up identity confirmation for admins, staff, and judges.
- Keep Vibe authorization decisions local to Vibe.
- Avoid schema-heavy participant migration.

Suggested implementation shape:

```text
Viby assertion payload
-> Vibe verification helper
-> Vibe role mapping / allowlist
-> Vibe-owned short-lived role session
```

Admin first:

- Add server-side admin authorization before or with Viby integration.
- Add a Viby confirmation entrypoint for admin.
- Protect admin dashboard and admin APIs with Vibe-owned admin session.

Judge second:

- Keep judge token.
- Add Viby confirmation after token entry.
- Optionally store a short-lived association between judge token and Viby
  session in Vibe.
- Continue checking assignments exactly as today.

Staff third:

- Add explicit staff allowlist/config.
- Use same Viby confirmation pattern as admin.

### Phase C: Participant Linking

Goals:

- Link Viby users to team owners and possibly team members.
- Preserve edit-token workflows.
- Improve recovery and event-day identity confidence.

Possible steps:

- Add optional Viby link for a team owner after registration.
- Use Viby as an additional factor before edit-token regeneration.
- Show confirmed team lead identity in team management.
- Later, link Viby users to individual `team_members` for attendance/prize
  workflows.

### Phase D: Optional Token Reduction

Only after Viby and Vibe role/session infrastructure are stable.

Potential reductions:

- Require Viby-confirmed owner identity before regenerating edit tokens.
- Allow team lead account/session to open edit surfaces without copying the edit
  token manually.
- Reduce judge-token exposure by moving judge access to Viby-confirmed judge
  sessions plus server-side judge mapping.

Do not eliminate edit tokens entirely unless an equally agent-friendly workflow
exists. Agents currently rely on bearer edit tokens for updates and finalization.

## Non-Goals for the First Integration

- No participant account migration.
- No replacement of Better Auth.
- No replacement of edit-token submission APIs.
- No OAuth redesign.
- No middleware rewrite.
- No schema migration in the discovery phase.
- No Viby-driven role grants.

## Open Questions

- Should Vibe verify Viby assertions by calling Viby server-to-server, or should
  Viby redirect back with a signed short-lived assertion payload?
- What should be the emergency bypass if Viby is unreachable during judging or
  event operations?
- Should admin/staff allowlists use Viby user IDs, emails, GitHub IDs, or a
  separate config file?
- Should judge-to-Viby linking be explicit in admin UI or opportunistic on first
  successful judge-token confirmation?
- Should Vibe keep an audit row for each accepted Viby assertion, or rely on
  Viby audit logs plus existing Vibe audit events?
