# Phase F.0C — Public Participant Profiles

Date: 2026-08-08
Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Final HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735` (working-tree qualification; no release commit)

## Outcome

F.0C adds the public participant profile route at `/people/:handle` and keeps
the public surface deliberately narrow. The implementation was qualified on
the isolated Kentucky Vibes environment only. Production was not migrated or
restarted; its database, publication state, Chatto, and Viby remain unchanged.

## Public route and projection

`app/people/[handle]/page.tsx` resolves profiles through
`getPublicProfilePageByHandle()` in `lib/user-profiles.ts`. The route never
queries Better Auth accounts, sessions, Viby links, authorization tables, or
raw roster data. The repository keeps the internal user id private while
deriving the page from the safe profile, explicit owner/membership, event, and
D.4 publication joins.

The route returns a generic Next 404 for invalid, nonexistent, private,
deactivated, or disabled profiles. GET and HEAD have the same public/non-public
status behavior. Private and unknown handles receive generic noindex metadata;
public profiles receive a safe title, description, canonical URL, and profile
Open Graph metadata. No profile sitemap or directory was added.

Allowed content is display name, initials, headline, affiliation/degrees, bio,
validated links, interests, published project history, and published awards.
The projection contains no email, Better Auth id, account/session data, Viby
data, roles, judge data, scores, calibration, consensus, audit data, chat,
tokens, or internal ranking state.

## Project and award history

Project history is derived only from explicit `submission_owners` and active
`submission_memberships`, joined through `submissions.event_id` and a
published/archived `publication_releases` row. Roster email/name matching is
never used. Awards are derived from active `publication_awards` under the same
publication-safe release boundary. The public page strips internal
publication-state fields before rendering.

The shared `ProfilePreview` presentation now renders the same safe project and
award cards in private preview and public mode. Project cards link to the
existing public `/project/:id` page. On public project surfaces, a separate
“Public participant profiles” group links only explicit authenticated owner or
active-member accounts with public profiles; it never maps a roster row by
name/email.

## Visual and accessibility review

The private preview remains the visual baseline. Public mode changes only the
status label and page framing, adds a restrained project link, and preserves
the same initials, hierarchy, links, tags, omission of empty sections, and
publication-safe content. An authenticated owner sees a subtle Edit profile
action; the public body is otherwise identical for every viewer.

The public profile uses semantic headings, text labels for links and awards,
decorative initials (the name is already announced), keyboard-visible native
links, and no color-only state. Desktop Chromium and a 390px mobile viewport
were reviewed. Both reported `scrollWidth === clientWidth`; the profile card,
project link, and mobile navigation remained usable without horizontal
overflow.

## Kentucky Vibes qualification

Environment: `https://kentucky-vibes-f0b.ggg.ad`
Service: `kentucky-vibes-f0b.service` (port 3050)
TLS proxy: `kentucky-vibes-f0b-https-proxy.service` (port 3455)
Writable database: `/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`

The environment was cloned from the preserved E.3C artifact:
`/opt/vibe-hackathon/database-snapshots/kentucky-vibes-e3c-agent-rehearsal-20260808T210301Z.sqlite`
(SHA-256 `e6aa09d091663bd971341284918f5906399e65651ebf59e710f26251b20497f4`).
The clone passed migration rerun, integrity, foreign-key, and event identity
checks. Only synthetic accounts and isolated data were used.

Qualification cases included:

- private `f0b-admin` and public `maya-rivera` profiles;
- a complete synthetic public profile `derby-builder` with one synthetic
  published project, interests, links, and award-safe project history;
- minimal/empty profile behavior and generic private/unknown resolution;
- authenticated owner Edit profile visibility;
- disabled/deactivated/private/nonexistent generic resolution in the focused
  domain suite;
- long/sentinel privacy scanning. Synthetic values such as emails, badge
  markers, Viby subjects, judge notes, and edit tokens were absent from public
  HTML/RSC/metadata.

For the visual project-history check, one synthetic Kentucky Vibes release was
marked published in the disposable database only. No production or real-event
result was published.

Observed HTTP results:

| Case | GET | HEAD | Metadata |
| --- | ---: | ---: | --- |
| public `derby-builder` | 200 | 200 | profile title + canonical |
| private `f0b-admin` | 404 | 404 | generic noindex |
| unknown handle | 404 | 404 | generic noindex |

## Regression

- F.0C/F.0A profile domain tests, including safe page and explicit profile-link
  projections: **10 passed** in the focused file.
- Full isolated repository suite: **272 tests passed** across 51 files.
- TypeScript: passed.
- Changed-file ESLint: passed.
- Production build: passed; `/people/[handle]` is dynamic and listed in the
  build route manifest.
- `git diff --check`: passed.
- Desktop and mobile Chromium browser checks: passed.

## Production disposition

No F.0A migration or F.0C deployment was applied to production in this slice.
The canonical production database remains SHA-256
`939852c5309eb2155515616be33ec5f1b7924506ca1ea44584a74f4a360a73b3`; no
production service restart occurred. Chatto and Viby were not modified.

Before a production rollout, run the already qualified additive profile
migration against a verified backup, rerun it, check integrity/foreign keys,
confirm zero automatic public profiles/handles, then deploy and verify login,
Account, profile editing, generic unknown handles, and publication state.

## F.0D follow-up

F.0D qualified the shared participant identity component, the single My Projects
profile shortcut, explicit account-backed Team-tab identity context, and the
public project profile-link presentation. The formal roster remains the
authoritative project snapshot; no email/name matching or synchronization was
introduced. Activity and native chat attribution were intentionally unchanged.
Details and qualification evidence are in
`docs/participants/PHASE_F0D_PROFILE_PROJECT_INTEGRATION.md`.

F.1 owns any `/people` directory, search, event-only visibility, and
discovery/indexing policy. Avatar uploads, public role badges, social features,
recommendations, and analytics remain out of scope.

**GO FOR F.1 — PEOPLE & DISCOVERY**
