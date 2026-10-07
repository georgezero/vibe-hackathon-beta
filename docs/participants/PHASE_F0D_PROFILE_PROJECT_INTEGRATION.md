# Phase F.0D — Profile / Project Integration

Date: 2026-08-08
Starting HEAD: `a70edc28326108dfc84a69af303f680ceaa7f735`
Qualification: isolated Kentucky Vibes build only

## Outcome

F.0D connects durable participant identity to existing project surfaces without
creating a directory or changing authorization. The qualified environment is:

`https://kentucky-vibes-f0b.ggg.ad`

Production was not migrated, restarted, or otherwise changed. Chatto and Viby
were not modified.

## Integration surfaces

`lib/user-profiles.ts` now provides `ParticipantIdentityData` and a batched
`listParticipantIdentitiesForUsers()` operation. It contains only display name,
initials, optional public handle, and optional public headline/affiliation.
Internal IDs exist only as repository map keys and are not passed to UI
components. `components/ParticipantIdentity.tsx` renders compact/full context
and creates a `/people/:handle` link only for an active public profile.

`/account/projects` has one profile shortcut above the workspaces:

- incomplete/no profile: **Build your hackathon profile** → Complete profile;
- complete private profile: **Your profile is ready** → Preview profile;
- public profile with a handle: **Your public profile** → View profile.

The shortcut is informational and never gates project access, eligibility,
submissions, judging, or chat.

`/projects/:submissionId/team` continues to show the formal roster as the
authoritative information submitted for that project. A separate authenticated
workspace-members section uses explicit active memberships and the safe identity
component. The signed-in user alone receives Complete your profile, Your profile
is private, or View your profile. Owners and administrators cannot edit another
person's durable profile.

Roster-only people remain ordinary roster members with no inferred account,
profile state, or link. Profile edits do not rewrite roster information, and
roster edits do not write to `user_profiles`.

The public project Team section uses the same identity presentation for public
owner/member profiles. It remains publication-safe and never maps a roster row
by email or name. Private, missing, disabled, deactivated, and roster-only
people remain plain roster text with no private-profile indicator.

Activity and native chat retain their established stable attribution. F.0D did
not expand Activity data or change chat authorization/sender semantics; profile
links can be considered later only where explicit participant-safe actor IDs
already exist.

## Completion policy

The six-detail informational signal is centralized in
`lib/profile-completeness.ts` and reused by the editor, Account, My Projects,
and Team integration. It counts display name, handle, headline, affiliation,
bio, and one link or interest. It has no security or eligibility meaning.

## Privacy and authorization

Qualification confirmed:

- no email, badge number, Better Auth ID, Viby data, token, or authorization
  state is passed to the identity component;
- no profile-induced project, chat, judge, administrator, or team access;
- no public discovery signal for private profiles;
- no roster-name/email matching;
- no profile link for roster-only or revoked current membership;
- explicit membership and publication-safe project boundaries remain in force.

## Kentucky Vibes qualification

The isolated service was rebuilt and restarted without touching production:

- `kentucky-vibes-f0b.service`, port 3050;
- `kentucky-vibes-f0b-https-proxy.service`, port 3455;
- `https://kentucky-vibes-f0b.ggg.ad`;
- synthetic event `evt_kentucky_vibes`;
- writable database `/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/data/active.sqlite`.

The browser pass used a synthetic owner account and normal navigation. It
verified Account, My Projects, the Team tab, the public project profile group,
and the public profile. The owner saw View your profile only on their own
workspace row. A 390px Team walkthrough reported
`scrollWidth === clientWidth`; the public project link resolved to the synthetic
`derby-builder` profile without exposing internal IDs.

## Qualification results

- focused profile tests: **11 passed**;
- full isolated suite: **273 tests passed** across 51 files;
- TypeScript: passed;
- changed-file ESLint: passed;
- production build: passed;
- desktop Chromium integration walkthrough: passed;
- mobile Chromium Team walkthrough: passed, no horizontal overflow;
- `git diff --check`: passed.

## Production disposition

Before F.2B, F.0A–F.0D were isolated qualification work. The canonical
production database was not migrated or restarted; no production profile was
created or made public. Chatto and Viby remained unchanged.

The completed rollout applied the additive `user_profiles` migration to a
verified backup, reran it, verified integrity and foreign keys, confirmed zero
automatic public profiles/handles, and deployed with Account, project, profile,
and authorization regressions covered by isolated qualification. See
`PHASE_F2B_PRODUCTION_DEPLOYMENT.md` for production evidence.

## Remaining F.1 scope

F.1 may add a deliberate People directory, search/discovery policy, indexing,
and future discovery affordances. Avatar uploads, event-only visibility, social
interactions, recommendations, public judge/admin badges, and roster
synchronization remain out of scope.

**GO FOR F.1 — PEOPLE & DISCOVERY**

F.1 adds the explicit `discoverable` opt-in and authenticated current-event
People directory described in `PHASE_F1_PEOPLE_AND_DISCOVERY.md`. Public but
unlisted profiles remain absent from directory results.

## Production rollout

The F.0 foundation through F.2 direct messaging was deployed together in the
F.2B release. The production migration is additive and lazy: it creates the
profile/messaging schema but no profiles, handles, public state, or messages.
Account and project identity remain separate from roster snapshots, judging,
authorization, Chatto, and Viby.
