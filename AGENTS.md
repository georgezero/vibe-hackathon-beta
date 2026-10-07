# AGENTS.md — Vibe Hackathon Platform

AI coding agent runbook. Everything an agent needs to understand, run, modify, and deploy this project.

## Understanding This Repo

This is a **Next.js 16 App Router** application — a competition platform for AI-assisted hackathons.

Key conventions:
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. This is not older Next.js.
- All pages use CSS variables for theming. Do not hardcode colors; use `var(--color-fg)`, `var(--color-accent)`, etc.
- Tailwind 4 uses CSS-first config. Theme tokens live in `app/globals.css` under `@theme`.
- Mock data lives in `lib/mock-data.ts`, but current public, judge, admin, vote, and submission flows read from the DB.
- Dynamic route `params` are promises. Server components use `await params`; client components use `use(params)`.
- No file uploads. Submission artifacts are URLs only.

## Ranking Logic

Final rankings are derived from raw DB data and are not stored over the source records.

Formula:

```text
official_score =
  human_average_score * 70%
  + ai_reproducibility_score * 30%
```

Definitions:
- `human_average_score`: average completed human judge score on a 0-100 scale.
- `ai_reproducibility_score`: deterministic reproducibility score from `ai_reviews.scoring_details.reproducibility_score`; falls back to `generated_score` for older rows.
- People's Choice rankings are audience-vote only.
- Audience voting remains separate from official judging and does not affect official score by default.

Rank status:
- `incomplete`: missing completed human judging or missing AI score data.
- `provisional`: computable score, but not every assigned judge has completed their review.
- `final`: computable score and all assigned judge reviews are complete.

Admin warning badges:
- `missing AI review`
- `incomplete judge reviews`
- `judge score outlier`
- `no audience votes`
- `repo validation warning`

## Award Badges

`components/AwardBadges.tsx` renders compact reusable award pills. Badge derivation lives in `lib/award-badges.ts` and uses existing ranking, People's Choice, AI consensus, agent-native, and presentation calculations.

Supported award badge types:
- `judge-choice`
- `peoples-choice`
- `ai-choice`
- `best-agent-native`
- `best-presentation`

Public pages must not reveal badges before `winnersPublishedAt`; the helper returns no public badges until winners are published. It also respects event toggles: `showJudgeChoice`, `showPeoplesChoice`, `showAIChoice`, and `showSpecialAwards`.

## Keyboard Shortcuts v1

`hooks/useKeyboardShortcuts.ts` handles shared registration. It ignores input, textarea, select, contenteditable targets, modifier-key chords, and touch/mobile devices.

Platform convention: `j` means next/forward/down; `k` means previous/back/up.

Supported public shortcuts:
- `/projects`: `j` / `k` select next/previous card, `Enter` opens selected project, `/` is reserved for future search/filter. No card is selected on initial load; first `j` selects the first card and first `k` does nothing. Once selected, card navigation wraps at the ends.
- `/project/:id`: `←` / `→` previous/next project, `j` / `k` next/previous screenshot navigation, `g` GitHub, `d` demo, `v` open vote dialog, `c` copy link, `p` back to projects, `?` shortcut help.
- `ESC` closes shortcut/lightbox dialogs.

Supported judging shortcuts:
- `/judge/dashboard`: `j` / `k` select next/previous assigned submission, `Enter` opens selected submission, `?` shortcut help.
- `/judge/submissions/:id`: `j` / `k` next/previous rubric field, `←` / `→` previous/next assigned submission, focused rubric fields accept `1–9` directly and `0` for 10, `Cmd/Ctrl+Enter` submits the current scorecard, `p` returns to the judge assignment list, `?` shortcut help.
- Scorecard project navigation with unsaved edits opens a dirty-state dialog with Save & Continue, Discard Changes, and Cancel.

Judge authentication:
- Better Auth is the only interactive application session for judges.
- `GET /api/judge/data` and `POST /api/scores` must use `withJudgeApi()` and an
  explicit `JUDGE_API_POLICIES` entry.
- Judge identity always comes from the Better Auth-backed application principal
  and active event-scoped `judge_authorizations`. Never accept a judge ID or
  credential from a URL, query string, bearer header, client prop, or body.
- Judge mutations require the exact serialized configured Origin.
- Viby identity links establish identity only and never grant judge access.

Supported admin shortcuts:
- `/admin/dashboard` and deep-link tab routes: `←` / `→` previous/next tab, wrapping at the ends.
- Numeric jumps: `1` Overview, `2` Submissions, `3` Rankings, `4` Judges, `5` AI Reviews, `6` Audience Votes, `7` Analytics, `8` Export, `9` Event Settings, `0` Demo Checklist.
- Quick jumps: `a` AI Reviews, `s` Submissions, `e` Event Settings, `r` Release Checklist.
- Admin shortcuts are navigation-only. Do not bind shortcuts to run evals, import results, publish winners, seed/reset data, export bundles, voting controls, or settings changes.

Do not add audience voting, AI review action, destructive, or command-palette shortcuts in this slice. Future command palette work should be separate.

## Judge Calibration

Judge calibration is computed from completed human scores:
- `reviews assigned`: assignment count.
- `reviews completed`: completed score count.
- `average score given`: judge mean on the 0-100 scale.
- `standard deviation`: spread of completed scores.
- `average deviation from panel mean`: mean absolute distance from the submission's completed human panel mean.
- `outlier count`: reviews where judge score differs from panel mean by at least 20 points.

## Export Instructions

Admin exports are available from the authenticated Export tab. Every export
request is protected by the signed organizer session and current Viby
allowlist; do not document or automate them as unauthenticated curl requests.

## Submission Readiness

Admin route: `/admin/dashboard/submission-readiness`.

Readiness is computed by `lib/submission-readiness.ts` and reused by private submission preview pages and the admin readiness dashboard. The dashboard is operations-only: it does not edit submissions, send reminders, or change judging/voting state.

Checks include team name, contact email, project title, problem statement, demo URL, GitHub URL, screenshot URL, license, AGENTS.md URL, sample data notes, and team eligibility.

Dashboard polish:
- `Ready to Finalize` means all readiness checks are complete and the submission is not finalized yet.
- `Prize Eligible` counts submissions where every listed team member has a badge number.
- Missing item badges show the first five items plus `+N more`.
- `Contact Team` is a mailto action using the private admin-only contact email.
- Public `/project/:id` may show safe team roster fields only: name, degree(s), institution/affiliation, and student/trainee status.
- Admin submissions and readiness rows include `View Team`, which opens the private roster drawer with emails, badge numbers, badge verification status, degrees, affiliations, and student/trainee status.
- Public pages must never expose team emails, badge numbers, edit tokens, recovery links, ownership type, or badge verification status.
- Admin export dataset `team_roster` includes the private roster fields for organizer prize verification.

## Live Status Map

`/status` uses `components/InstitutionWorldMap.tsx` for the public institution network map.
`components/status/ParticipationVisualization.tsx` wraps the visualization card and owns the `Map | Globe` toggle.

Rules:
- Keep status data, institution aggregation, geocoding, polling, and privacy behavior in `lib/event-status.ts`, `lib/institution-geo.ts`, and `/api/v1/status/live`.
- The map is SVG/CSS-only. Do not add canvas, WebGL, or external map/animation libraries.
- Current visual model is a dot-matrix world: continent shapes are implied by deterministic low-opacity SVG dots, institution nodes pulse softly, and the event hub remains a slightly brighter dot.
- Do not render visible map text labels for the event hub or event name.
- Do not render visible continent polygons, coastlines, borders, graticules, or landmass strokes.
- Do not reintroduce lines, hub-and-spoke routing, mesh paths, moving particles, traveling packets, route dashes, or animations that read as missiles, flights, or targeting.
- The fullscreen map button and `F` shortcut are presentation-only and must not alter `/api/v1/status/live` polling/data semantics. `ESC` closes fullscreen.
- Respect `prefers-reduced-motion`: disable pulses and keep static dots.

Globe view:
- `components/status/ParticipationGlobe.tsx` uses COBE only.
- Do not replace it with `react-globe.gl`, `three-globe`, Mapbox, Cesium, or a GIS-style map.
- COBE must remain dynamically loaded only when Globe mode is selected.
- The Globe view must not render labels, country names, arcs, paths, or connection lines.
- The `Map | Globe` selection persists in `localStorage` key `vibe-status-map-view`.
- Auto-rotation should stay very slow, pause during drag, resume after 5 seconds, and preserve orientation across live status refreshes.

## MCP Server

```bash
VIBE_BASE_URL=http://localhost:3000 npm run mcp
```

Exposes `vibe.list_requirements`, `vibe.validate_repo`, `vibe.create_submission`, `vibe.update_submission`, `vibe.finalize_submission`, and `vibe.get_submission_status`.

Submission create/update responses include `start_url`, `edit_url`, `preview_url`, and `finalize_url` generated from `VIBE_HACKATHON_BASE_URL` via `getBaseUrl()`. Agents should hand `preview_url` to the human team lead and stop after draft updates unless explicitly instructed to finalize.

## Team Registration v1

Better Auth is the auth layer for team ownership and recovery only. Required env vars:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH` defaults to `false`

GitHub OAuth callback URL: `https://<deployment>/api/auth/callback/github`.

Human-owned registration route: `/register-team`.

Rules:
- One GitHub OAuth identity is required for the team owner.
- Do not require every teammate to authenticate.
- Team size is max 6 including the owner.
- Owner badge number is required.
- Teammate rows require name if present. Badge number is recommended for prize eligibility but does not block registration.
- Existing edit-token workflow remains the editing authority for `/submit/:token`, preview, API updates, MCP updates, and finalize.
- Registration collects only team name, owner contact email, and owner badge number, then redirects to `/submit/:token/start`.
- `/submit/:token/start` offers manual web-form completion and agent-assisted completion using the shared copyable prompt.
- `/submit/:token/team` manages private team member data and prize eligibility using the same edit token.
- Prize eligibility is complete only when every team member has a badge number.
- Student/trainee status is tracked and counted, but does not affect prize eligibility yet.
- `PATCH /api/v1/submissions/:id/team` is replace-style: `owner` plus `members[]` becomes the complete current roster.
- Agents must send the complete intended roster every time. Omitted teammates are removed.
- Do not revert to older registration details unless the human explicitly asks.
- `/submit/:token/start` exposes two prompt variants: initial owner-only setup and current roster revision. These prompts do not mutate data by themselves.

Agents should not register teams unless explicitly instructed. A human team owner should register via GitHub first, then hand the edit/preview URLs to the agent.

Badge numbers are stored for organizer eligibility verification and must stay admin-only. Do not expose raw badge numbers in public pages, public APIs, AI eval prompts, or public AI eval bundles.

Recovery route: `/recover`. A signed-in GitHub owner can list owned submissions, open edit/preview links, and regenerate an edit token. Email recovery is not implemented.

Ownership modes:
- GitHub mode: `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`; stronger ownership, requires Better Auth GitHub OAuth.
- Badge mode: `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false`; simpler setup, no OAuth app required, ownership/recovery uses contact email plus owner badge number.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Demo / Production Setup

Required `.env.local` for production:

```bash
NODE_ENV=production
VIBE_HACKATHON_BASE_URL=https://your-deployment.example.com
VIBY_BASE_URL=https://your-viby-deployment.example.com
VIBY_APP_SLUG=vibe-hackathon
VIBE_ADMIN_VIBY_USER_IDS=your-reviewed-viby-user-id
VIBE_ADMIN_SESSION_SECRET=your-random-admin-session-secret-at-least-32-characters
VIBE_JUDGE_EVENT_ID=evt_vibe_2025
```

Optional branding overrides (DB values take priority):

```bash
VIBE_HACKATHON_EVENT_NAME="RSNA 2026"
VIBE_HACKATHON_EVENT_LOGO_URL="https://www.rsna.org/-/media/images/rsna/annual-meeting/2026/rsna_2026_logo_color_fin.png"
```

## Admin Dashboard Deep Links

| URL | Tab |
|-----|-----|
| `/admin/dashboard` | Overview (default) |
| `/admin/dashboard/submissions` | Submissions |
| `/admin/dashboard/rankings` | Rankings |
| `/admin/dashboard/judges` | Judges |
| `/admin/dashboard/ai-reviews` | AI Reviews (admin) |
| `/admin/dashboard/audience-votes` | Audience Votes |
| `/admin/dashboard/analytics` | Analytics |
| `/admin/dashboard/export` | Export |
| `/admin/dashboard/demo-checklist` | Demo Checklist + Reset |

## Public Pages

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/status` | Live event status — stage, metrics, institutions, leaderboards, activity |
| `/projects` | Project gallery (audience voting) |
| `/ai-evals` | Public AI evaluations — Eval Prompt + Agent Eval JSON downloads |
| `/audience` | People's Choice standings |
| `/winners` | Published winners |
| `/submit` | Submit a project |
| `/submit/:token/preview` | Private draft preview and readiness checklist |
| `/submit/instructions` | Submission guide |

## Demo Video Support

Submissions support an optional `demoVideoUrl` field. Supported providers: **YouTube**, **Loom**, **Vimeo**.

`lib/video.ts` exports `detectVideo(url)` → `{ provider, embedUrl } | null`. Unknown providers get a plain link, not an iframe.

Project detail page (`/project/:id`) renders an embedded 16:9 player below the hero if `demoVideoUrl` is set. Unsupported URLs fall back to "Open Demo Video →".

vibe.json:
```json
{ "project": { "demo_video_url": "https://www.loom.com/share/..." } }
```

Projects page cards show a "▶ Video" link if `demoVideoUrl` is present. Winner cards show "▶ Demo Available" button.

## Screenshot URLs

Submissions support multiple screenshots via `screenshotUrls: string[]`.

Backward compatibility: if only `screenshotUrl` is present, `resolveScreenshotUrls()` (`lib/screenshots.ts`) wraps it in an array. All rendering code uses this utility — no migration needed.

`screenshotUrl` (single field) is always kept in sync with `screenshotUrls[0]` for legacy compatibility.

vibe.json supports both:
```json
{ "project": { "screenshot_urls": ["https://...", "https://..."] } }
{ "project": { "screenshot_url": "https://..." } }
```

Agent Eval JSON (`agent-eval-*.json`) includes `screenshotUrls[]` in the submission block.

## AI Evaluation Terminology

| Term | Meaning |
|------|---------|
| **Eval Prompt** | Markdown prompt suitable for ChatGPT / Claude / Gemini / manual use |
| **Agent Eval JSON** | Structured evaluation bundle for agents, scripts, or local models |
| **Evaluation Result JSON** | Output from an AI evaluator — imported by admin only |

Public read-only endpoints (no auth required, no tokens exposed):

```bash
GET /api/v1/ai-eval/prompt/:submissionId   # returns eval-prompt-sub_xxx.md
GET /api/v1/ai-eval/packet/:submissionId   # returns agent-eval-sub_xxx.json
```

Admin endpoints (keep for backward compat, same data, older filenames):

```bash
GET /api/admin/ai-runs/prompt/:submissionId
GET /api/admin/ai-runs/packet/:submissionId
```

All `/api/admin/*` routes require a valid signed organizer session and current
Viby allowlist membership. Admin mutations also require an exact serialized
`Origin` matching `VIBE_HACKATHON_BASE_URL`.

External automation uses a submission-scoped evaluation token issued by an
allowlisted organizer with POST `/api/admin/ai-runs/token/:submissionId`:

```bash
GET  /api/v1/ai-eval/external/packet/:submissionId
GET  /api/v1/ai-eval/external/prompt/:submissionId
POST /api/v1/ai-eval/external/import/:submissionId
Authorization: Bearer <scoped-evaluation-token>
```

The token cannot access `/api/admin/*` or another submission. Public packet and
prompt GETs never create or expose tokens.

Public page: `/ai-evals` — shows organizer-run evaluations, Eval Prompt and Agent Eval JSON download buttons. No Import Result, Run Eval, Run Batch, or tokens exposed.

## Audience Voting v1

Audience voting is completely separate from official rankings (human judges + deterministic AI review).

Event config fields:
- `audienceVotingEnabled` — master on/off
- `audienceVotingMode` — `"disabled"` | `"human"` (agent/hybrid reserved for later)
- `audienceIdentityMethod` — `"badge"` | `"email"` | `"invite_code"` | `"anonymous"`
- `audienceVotesPerPerson` — total votes per identity (default 1)
- `audienceAwardCount` — how many People's Choice winners to show
- `audienceResultsVisible` — whether live results show on /audience and /projects

Voter identity:
- Raw badge numbers / emails are NEVER stored
- Stored: `sha256(method + ":" + normalize(value))`
- Normalization: lowercase + trim for all; strip whitespace for badge

Vote endpoint:
```bash
POST /api/v1/audience-vote
{ "submissionId": "sub_xxx", "identity": "RSNA12345", "identityMethod": "badge" }
# Returns: { "success": true, "totalVotes": 42 }
# Duplicate: 409 { "alreadyVoted": true, "message": "..." }
```

Tables:
- `audience_voters` — identity hashes per event (unique constraint on eventId + identityHash)
- `audience_votes` — individual votes with optional FK to audience_voters

## Health & Ops

```bash
# Health check
curl http://localhost:3000/api/health

# Demo reset is available from the authenticated admin dashboard only in an
# exact NODE_ENV=development runtime. It requires the organizer session and
# exact same-origin browser request.
```

## Useful Dev Commands

```bash
npm run db:push
npm run db:seed:kentucky # fresh Kentucky / Bluegrass demo (75 projects); refuses existing DB
npm run db:seed          # 8 mock teams
npm run db:seed:sim      # 10 radiology sim teams (full scores/reviews)
npm run db:seed:mixed    # 18 teams (8 mock + 10 sim)
npm run db:seed:media    # 5 media showcase projects plus fake judges/scores for shortcut testing
npm run db:studio
```

## Release Candidate Notes

Project links should converge on `/project/:id` for public showcase pages. Keep `/submission/:id` available for compatibility, but public cards, AI evals, winners, and audience standings should prefer `/project/:id`.

Release operations:

```bash
curl http://localhost:3000/api/health
```

Download the event bundle from the authenticated admin Export tab.

Admin release routes:

```txt
/admin/dashboard/event-settings
/admin/dashboard/release-checklist
/admin/dashboard/winners
```

## Future Operational Roadmap

Launch hardening work is intentionally deferred beyond `vibe-hackathon-demo-rc1`, `vibe-hackathon-media-rc1`, and `vibe-hackathon-awards-rc1`. These are roadmap items only; do not implement them unless explicitly requested.

Priority 1: Event Freeze / Lockdown. Implemented as an event-level `isFrozen` toggle in Event Settings. Freeze prevents new registrations, new submissions, submission edits, finalization, team edits, audience votes, judge score edits, and AI evaluation imports/runs while preserving admin viewing, readiness, rankings, analytics, exports, winner publishing, and unfreeze. Status: IMPLEMENTED.

Priority 2: Backup / Restore. Export Event Bundle exists. Import Event Bundle, Restore Event Bundle, and cross-machine migration are future work. Bundle coverage should include event settings, submissions, judges, scores, audience votes, AI evaluations, rankings, and winners. Status: PARTIALLY IMPLEMENTED.

Priority 3: Recovery Dashboard. Proposed route: `/admin/dashboard/recovery`. Candidate metrics include database health, active event, submission count, judge count, vote count, AI eval count, last backup timestamp, git SHA, and build version. Status: NOT IMPLEMENTED.

Priority 4: Production Environment Visibility. Add visible LOCAL, STAGING, or PRODUCTION environment labeling to reduce operator confusion. Status: NOT IMPLEMENTED.

Priority 5: Seed Safety. Protect `db:seed`, `db:seed:sim`, `db:seed:mixed`, and `db:seed:media` with confirmations, typed confirmation, environment restrictions, and production safeguards. Status: NOT IMPLEMENTED.

Priority 6: Version Visibility. Show git SHA, build date, and release tag, such as `vibe-hackathon-demo-rc1`, `vibe-hackathon-media-rc1`, or `vibe-hackathon-awards-rc1`. Status: NOT IMPLEMENTED.

Priority 7: Smoke Test Command. Future `npm run smoke` should exercise `/`, `/projects`, `/project/:id`, `/ai-evals`, `/winners`, `/submit`, `/admin/dashboard`, and `/api/health`. Status: NOT IMPLEMENTED.

Priority 8: Audit Log. Freeze and unfreeze transitions are logged as audit events. A full organizer audit dashboard remains future work. Status: PARTIALLY IMPLEMENTED.

## Presentation Mode

`/presentation` is a public broadcast screen for conference projectors. It uses finalized/locked projects only, the flat dot-matrix institution map, and a public-safe spotlight card plus team roster card.

Public data endpoint:

```bash
GET /api/v1/presentation/live
```

Controls: `Space` pause/resume, `←`/`→` previous/next project, `F` fullscreen, `Esc` exit fullscreen.

Privacy rules: never expose emails, badge numbers, edit tokens, recovery links, owner private metadata, or badge verification in presentation components or JSON. Public team fields are limited to name, role, degree(s), institution/affiliation, and student/trainee status.

Presentation rotation convention: use `buildPresentationInstitutionRotation(projects, seed, loop)` for `/presentation`. It guarantees geocoded institution-first coverage, round-robins projects within each institution across loops, and keeps ungeocoded projects in a fallback bucket after geocoded institutions. Validate with `npm run validate:presentation-rotation`.

Presentation rotation is dot-first. Use `buildPresentationDotRotation(projects, visibleInstitutions, seed, loop)` rather than lead-only grouping. Rotation items own the zoom target through `featuredInstitution`; do not infer zoom target from `project.leadInstitution`. `/presentation?debugPresentation=1` exposes the internal index, featured institution, project title, and reason for validation.

Presentation operations:
- `/admin/dashboard/presentation` provides the organizer eligibility/debug view for presentation mode.
- `/presentation` is the public projector route.
- `/presentation?debugPresentation=1` exposes the current rotation index, featured institution, project, and reason.
- Spotlight cards include a project link and QR placeholder; do not add private data to these fields.
- Keep the top-left institution badge aligned to the spotlight card inset so it reads as the current stop in the world-tour flow.
