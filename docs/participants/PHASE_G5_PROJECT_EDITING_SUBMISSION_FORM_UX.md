# Phase G.5 — Project Editing / Submission Form UX

## Disposition

**GO — G.5 PROJECT EDITING UX READY FOR PRODUCT REVIEW**

Recommendation: **RECOMMEND DEPLOYING G.5 TO PRODUCTION** after normal product
review and the existing immutable-release deployment procedure. G.5 was not
deployed to production in this phase.

Production remained on the G.4B release at
`/opt/vibe-hackathon/releases/g4b-team-formation-20260810T014826Z`, PID
`2898274`, restart count `0`, with local and public health HTTP 200. The
production database SHA remained
`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`.

Chatto, Viby, the standing Kentucky Vibes review environment, production
deadlines, judging, and publication were not changed.

## 1. Existing editing architecture

The guest/private editor is `/submit/:token`. Authenticated project-owner
workspace editing redirects through
`/api/submissions/owned/:id/edit` to that same editor, so the two participant
paths share field labels, validation presentation, save behavior, and the
private bearer edit boundary. `/submit/:token/preview` is the existing
judge-facing preview and `/submit/:token/team` remains the dedicated team
formation surface.

The editor writes through `PATCH /api/v1/submissions/:id` with the private edit
token. The server remains authoritative for event freeze, deadline, lock,
ownership, readiness, and finalization. G.5 does not add fields, a media
backend, autosave, or a schema migration.

The existing field inventory is:

- project title, team name, and contact email;
- problem statement and target users;
- demo URL, optional demo video URL, GitHub URL, screenshot URLs, README URL,
  AGENTS.md URL, and prompt-strategy URL;
- license;
- sample-data notes, setup/deployment instructions, and known limitations;
- selected AI tools.

Team roster/member editing is intentionally not duplicated in the project
form. The form shows a concise team/eligibility summary and links to Team.

**G.5 requires no canonical schema migration.** The only server-side
correctness addition is the migration-free edit fingerprint described below;
no schema or migration file was added for this phase.

## 2. Project-story structure

The long form now follows a flexible project story rather than database order:

1. Project basics — project title, team name, contact email.
2. The problem — problem statement and recommended target users.
3. Your solution — setup, deployment notes, and known limitations.
4. Demo & code — demo, video, repository, README, AGENTS.md, license, and
   screenshots.
5. Data & implementation — sample-data notes, AI tools, and optional prompt
   strategy.
6. Team — eligibility/access summary with a Manage team link.

Participants can jump between sections with the in-page navigator. It is not a
forced wizard, preserving non-linear manual/agent/team work.

## 3. Field inventory and required/optional metadata

The metadata lives in `lib/project-editor.ts`. The ten required fields exactly
match `lib/submission-readiness.ts`: team name, contact email, project title,
problem statement (minimum 30 characters), demo URL, GitHub URL, screenshot,
license, AGENTS.md URL, and sample-data notes (minimum 20 characters).

Target users is recommended rather than a blocker because it is not part of the
authoritative G.3 required set. Demo video, README, prompt strategy, setup,
deployment notes, known limitations, and AI-tool selection are optional.

Each field has a consistent Required, Recommended, or Optional treatment and
participant-facing helper copy. URL entry accepts only HTTPS in the client UX;
the server remains authoritative and no external URL is fetched while typing.
Draft saves may be partial. Entered malformed URLs or too-short entered text
are called out inline; empty required fields remain in the readiness summary
instead of preventing a participant from safely saving work in progress.

## 4. Section completion and overall progress

The editor header shows `N of 10 required items complete` and the number still
requiring attention. Each story section shows its required-item count. This is
an orientation aid, not a score, percentage game, or second dashboard.

The same readiness vocabulary is consumed by Preview and finalization. Prize
eligibility remains separate from project completeness: a missing badge can
produce a team eligibility warning without becoming an invented submission
blocker.

## 5. Save model and dirty state

G.5 keeps explicit manual Save/Save draft actions. Status is announced as
Saved, Unsaved changes, or Saving… and is only set to Saved after a successful
server response. Entered values remain in the form after validation or network
failure. A browser before-unload warning is installed only while there are
unsaved changes; successful saves do not create needless prompts.

Preview and Review & submit are visible in the same action hierarchy. A dirty
Review & submit first saves the draft, then uses the existing explicit G.3
confirmation/finalization path.

## 6. Stale browser/agent protection

The submissions schema has no persisted `updatedAt` version column. Adding one
would have broadened this application/UI phase into an unqualified migration.
Instead, `lib/submission-edit-version.ts` computes a migration-free SHA-256
fingerprint over the authoritative editable project fields, status, and ordered
roster fields (never the bearer edit token).

The private token GET returns `editVersion`. Browser saves send
`expectedEditVersion`; the PATCH route returns `409 STALE_PROJECT_EDIT` when a
hosted agent or another session changed the project since that browser load.
The browser preserves the entered values and tells the participant to reload.
Successful updates return a new fingerprint. Agent/API callers that do not
hold a browser snapshot continue to use the supported last-write operation and
are required to return to Preview; no realtime collaborative editing was added.

The isolated qualification explicitly ran: browser version A → supported
hosted agent update to version B → browser edit/save. Version B survived and
the stale browser save was denied.

## 7. Preview bridge and readiness links

The editor and Preview now form one visible sequence:

`Edit project → Judge-facing preview → Review & submit`.

The Preview route continues to use the authoritative G.3 readiness projection
and now links each missing required item back to the relevant editor section.
Preview remains a finished, judge-facing presentation rather than an editing
form. It contains no edit token, recovery URL, Team Chat/DM/Community content,
judge assignments, scores, notes, or admin state.

The agent panel is restrained: copy is available, the full prompt is behind an
advanced disclosure, and the prompt continues to require hosted updates,
complete-roster semantics, Preview return, and explicit human instruction for
finalization.

## 8. Team boundary

The editor reports people listed and prize eligibility, then links to the G.4
Team page. It does not duplicate roster or invitation controls. Team lead /
Teammates / Project access semantics remain owned by the Team surface.

## 9. Submitted, resubmittable, and closed states

Submitted projects remain editable before the authoritative deadline under the
existing G.3 policy and show that a new version must be submitted for judging.
Hard-locked, frozen, and deadline-passed projects no longer render a long wall
of disabled inputs. They show a readable submitted-project summary with
Preview and My Projects next actions. Deadline authorization still uses exact
server time; no browser clock or rounded copy can authorize a save.

The isolated clone temporarily changed only its copy of the event deadline from
the source `2026-08-01T12:00:00Z` (`1785585600`) to
`2026-12-31T23:59:00Z` (`1798761540`) for open-state qualification. A separate
past-deadline check returned `DEADLINE_PASSED`; the clone was restored before
checkpointing. The standing and production event deadlines were untouched.

## 10. Desktop/mobile/accessibility

The desktop editor uses a readable main column with a compact sticky section
navigator. At mobile widths it becomes a single column with horizontally
scrollable section links, full-width actions, comfortable text areas, and no
horizontal overflow. The save bar does not cover the mobile keyboard area.

Labels are associated with controls, helper/error text is linked with
`aria-describedby`, invalid fields are announced, tool choices expose
`aria-pressed`, and the save status is a live region. Required state is not
communicated by color alone. The closed state is explanatory rather than a
graveyard of disabled inputs.

The isolated 390×844 Chromium pass found no horizontal overflow. No independent
human usability study is claimed.

## 11. Kentucky Vibes qualification clone

A fresh clone was created at:

`/opt/vibe-hackathon/instances/kentucky-vibes-g5-qualification-20260810T030700Z`

It used a separate SQLite database (`data/g5.sqlite`), service port 3075,
HTTPS proxy port 3475, Better Auth origin `https://127.0.0.1:3475`, cookies,
and synthetic secrets. No Viby links or production credentials were used. The
temporary service and proxy were stopped after qualification; the temporary
`.env` and runtime secret files were securely removed.

The preserved qualified snapshot is:

`data/g5-qualified.sqlite`

SHA-256: `d89b2c92f3799cec04451cd0006d6362a79078d0e9353e4137f7a72a8c3c9814`

Mode is 0600. Final `PRAGMA integrity_check` was `ok` and
`PRAGMA foreign_key_check` returned zero rows.

Synthetic provenance retained in the snapshot:

- `sub_wsL_CMXR` — empty draft;
- `sub_2dVeUf37` — empty draft;
- `sub_dwGzE-WQ` — partial draft used for draft-save and validation checks;
- `sub_fsR71zgG` — submitted/resubmittable draft used for Preview and mobile;
- `sub_elE23n6s` and `sub_8G_rzqeT` — bounded debug drafts from the initial
  browser setup attempts.

No credential or token is retained in this document or screenshots.

## 12. Browser journeys

The clone exercised:

- New/manual: `/start` → private draft → project-story editor → partial Save
  → complete fields → Save → Preview/readiness.
- Return/readiness: editor section navigator and Preview missing-item links.
- Agent/manual mix: hosted PATCH update followed by browser reload and manual
  continuation.
- Stale edit: version A browser state was rejected after hosted version B.
- Invalid field: malformed HTTP URL produced actionable HTTPS validation while
  preserving entered values.
- Submitted/resubmittable: supported finalization created a submitted state
  that remained editable before the temporary clone deadline.
- Deadline: a past-deadline clone state rendered read-only project content and
  a direct PATCH returned `403 DEADLINE_PASSED`; the event was restored.
- Mobile: editor, Preview, submitted view, and horizontal-overflow check at
  approximately 390×844.

The isolated performance pass measured approximately 1,381 ms initial editor
load, 306 ms save, 88 ms in-page section navigation, and 363 ms Preview
navigation. These are bounded smoke measurements, not production SLAs.

## 13. Screenshots

Screenshots are stored in `docs/participants/screenshots/g5/`:

- `g5-desktop-empty-start.png`
- `g5-desktop-empty-editor.png`
- `g5-desktop-complete-editor.png`
- `g5-desktop-stale-edit.png`
- `g5-desktop-inline-validation.png`
- `g5-desktop-preview.png`
- `g5-desktop-submitted-resubmittable.png`
- `g5-desktop-deadline-closed.png`
- `g5-mobile-editor.png`
- `g5-mobile-preview.png`
- `g5-mobile-submitted.png`

Recovery details remained collapsed; no private token or judging data was
captured. The folder contains 24 captures, including locator-level desktop
views for section navigation, required/optional hierarchy, readiness, Demo &
code, Team, save state, and agent action, plus mobile views for the editor top,
section navigation, long text, URL fields, save/Preview actions, and submitted
state.

## 14. Tests and quality gates

- G.5 focused suite: **7 passed**.
- Full unit suite: **318 passed across 61 files**.
- G.3 readiness/finalization, G.4 team/invitation, G.2 home, G.1 onboarding,
  F.0–F.3, Better Auth, Viby, Team Chat, DMs, Community, judging/admin, and
  publication boundary tests: included in the full suite and passed.
- TypeScript: passed.
- Production build: passed.
- Changed-file ESLint: no errors. The existing Next remote-image advisory is
  present for the editor/Preview screenshot render, consistent with the
  established URL-only media architecture.
- `git diff --check`: passed.
- Impeccable detector: no findings on G.5 page/helper/test targets. Existing
  unrelated global stylesheet findings were not introduced by the G.5 target
  rules.
- Desktop and mobile Chromium: passed; no mobile horizontal overflow.

## 15. Privacy/security

The private edit token remains the bearer editing boundary and appears only in
the existing protected Recovery disclosure and Authorization header. It is not
included in the edit fingerprint. The editor, Preview, and agent disclosure do
not expose Better Auth/Viby IDs, judge data, scores, private notes, or private
communication. Finalization, ownership, event freeze, deadline, and CSRF
boundaries remain the existing server-side controls.

## 16. Performance and limitations

The editor uses one private submission GET and one bounded PATCH per explicit
save. It does not add per-field requests, polling, realtime collaboration, or
caching infrastructure. Section navigation is client-local. The hash-based
stale-write check is intentionally a bounded browser/agent protection; it is
not a multi-writer transactional version system for concurrent agents.

The screenshot field remains URL-only, license remains free text, and the
existing event policy/readiness rules are unchanged. Team management remains a
separate G.4 surface. These are deliberate scope boundaries, not new policy.

## 17. Cleanup and production recommendation

The temporary G.5 service/proxy were stopped. Its temporary environment and
runtime secret files were removed. The qualified SQLite snapshot is preserved
for review; the clone passed integrity/FK checks. The standing Kentucky Vibes
service remains active and unchanged, and both standing and production health
checks returned HTTP 200 after cleanup.

G.5 is ready for product review. **Recommend deploying G.5 to production**
through the next approved immutable-release procedure; do not deploy as part of
this qualification phase.

## G.5B production closure

G.5 was subsequently deployed and qualified in production as the immutable
release `/opt/vibe-hackathon/releases/g5b-project-editing-20260810T041000Z`.
The service remained healthy (PID `3250791`, restart count `0`), no schema
migration was required, and the canonical database SHA remained
`6f67f9b38d47582a61eb58edc4eea477ab2496fd97b24050590b4546044cc994`.
Read-only anonymous/private-denial smoke passed; no real project was edited.
See [`PHASE_G5B_PRODUCTION_DEPLOYMENT.md`](PHASE_G5B_PRODUCTION_DEPLOYMENT.md)
for release, backup, packaging, privacy, and preservation evidence.

Next direction: **H.0 — End-to-End Participant Experience Audit** before
adding another major participant feature.
