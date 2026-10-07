# Phase F.1 — People & Discovery

Status: qualified in the isolated Kentucky Vibes participant environment; production deployment intentionally deferred.

## Scope and decision

F.1 adds a lightweight, authenticated People directory for the current event. It is a participant/community surface, separate from `/admin/people`, and does not add follows, messaging, recommendations, popularity ranking, or search infrastructure.

The directory uses a two-step privacy policy:

- `visibility = public` permits a direct `/people/:handle` profile.
- `discoverable = true` is a separate, explicit opt-in for People search.
- `discoverable` defaults to false. Existing public profiles remain unlisted.
- Making a profile private forces `discoverable` false. Republishing does not silently opt the profile back into discovery.

The directory is authenticated-only. A signed-out request redirects to the normal login flow. Public individual profiles remain available through their public links.

## Discovery eligibility

A card is returned only when all of the following are true:

1. The profile is public, discoverable, has a valid handle, and is not deactivated.
2. The Better Auth account is active (or has no account-control row for legacy users).
3. The person has explicit current-event participation as a submission owner or active `submission_memberships` member.

Judge-only, admin-only, roster-only, revoked, private, public-unlisted, disabled, and deactivated identities are excluded. Event participation is never inferred from email, names, roster snapshots, judge authorization, or administrator authorization.

## Safe projection and query behavior

`lib/people-directory.ts` owns the directory projection. `DiscoverableParticipantCard` contains only handle, display name, initials, headline, affiliation, explicit interests, and up to two publication-safe project references. It contains no email, user/account ID, badge, Viby, role, invitation, chat, score, audit, or private project data.

Search is parameterized and case-insensitive across display name, headline, affiliation, explicit interests, and publication-safe project/team names. Interest and institution filters use only explicit profile values. Results sort by display name/handle and are bounded to 24 cards per page; query-string state preserves search, filters, and page. Public project references come from the existing published/archived publication policy and explicit owner/membership joins.

At the Kentucky Vibes scale (150 users), the directory uses a bounded profile query plus one count, one filter-option query, and two batched project-reference queries. It does not perform per-card project queries or scan chat, audit, roster emails, or authorization data.

## UI and participant controls

- `/people` is a compact professional contact sheet with search, interest, institution, pagination, empty state, and safe profile/project links.
- `People` is in participant-facing navigation; the admin navigation remains `/admin/people` and uses a separate operational projection.
- `/account/profile` has an explicit “Show my profile in People search” control. It is disabled while private and does not change event access, membership, judging, admin authorization, Viby, or publication.
- My Projects shows one restrained prompt: complete a profile, preview a ready profile, or open directory settings for a public-but-unlisted profile.
- The visual direction follows the established Vibe Hackathon system: a quiet, typed contact sheet with compact identity cards rather than an admin table. Desktop and 390px mobile review found no horizontal overflow.

## Kentucky Vibes qualification

The standing isolated environment is `https://kentucky-vibes-f0b.ggg.ad`, backed by the writable test database for this qualification. A synthetic mix was prepared without touching the preserved artifact: 40 public+discoverable builders, public-unlisted profiles, private profiles, incomplete profiles, multiple represented institutions/interests, project owners, judges with no project membership, and publication-safe project references. No real names or production identities were used.

Verified through the authenticated browser flow:

- `/people` loads with 40 synthetic cards and pagination.
- Search and combined interest/institution filtering return sensible subsets.
- Result → public profile → project navigation works.
- Public-unlisted and private profiles are absent from the directory while their explicit public/private behavior remains intact.
- Profile discovery opt-in is visible and persisted; private transition disables it.
- Desktop screenshot reviewed at 1440px; mobile screenshot reviewed at 390px; mobile `scrollWidth === clientWidth`.
- Signed-out `/people` redirects to `/login?returnTo=%2Fpeople`.

## Tests and qualification

- F.0 profile domain and F.1 directory tests pass, including explicit participation, default false, privacy, filtering, and private-transition behavior; the full isolated unit suite passes **275 tests**.
- TypeScript, changed-file ESLint, production build, and `git diff --check` pass.
- The repository's known unrelated full-lint React purity baseline remains documented; no new F.1 lint errors were introduced.
- Before F.2B, production was not migrated or restarted. Chatto and Viby were
  not modified.

## Production strategy

F.0A–F.1 remain isolated for now. Before deployment, run the additive `user_profiles` migration twice against a verified backup, confirm the discovery index and default false, verify no automatic profile/handle/discoverability changes, and rerun authorization/publication regressions. Deploy F.0 + F.1 together only after explicit production approval.

## Remaining F.2 work

Participant messaging/community work remains separate. F.2 may consider messaging or community mechanics, but must preserve profile privacy, event-scoped participation, and the separation from Chatto.

## Production rollout

F.1 was deployed with the F.0–F.2 foundation in the F.2B release. Existing
production users were not made public or discoverable; the additive migration
created no profile rows and the authenticated directory therefore starts with
its safe empty state. See `PHASE_F2B_PRODUCTION_DEPLOYMENT.md` for the
preservation evidence.
