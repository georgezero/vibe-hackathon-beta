# H.4R.1 Kentucky Vibes CF Deployment

This is a bounded demo-environment deployment requested after the H.4R.1
production deployment. It does not change production, Chatto, or Viby.

## Deployment

- URL: https://kentucky-vibes-f0b.ggg.ad
- Service: `kentucky-vibes-f0b.service`
- Previous release: `/opt/vibe-hackathon/releases/h4-communication-continuity-20260811T023047Z`
- New release: `/opt/vibe-hackathon/releases/h4r1-universal-people-messaging-20260811T100205Z`
- Previous PID: `444998`
- New PID: `920580`
- Restart count: `0`
- Listener: `127.0.0.1:3050`
- Working directory: exact H.4R.1 release

Only the Kentucky Vibes service override and service process were changed.

## DB preservation

The seeded Kentucky DB was not migrated or seeded. A verified predeploy backup
was created at:

`/opt/vibe-hackathon/backups/kentucky-vibes-f0b-h4r1b-predeploy-20260811T101300Z.sqlite`

- Source SHA-256: `c386afd7f3c1dc6e240793eb82bfc79ee08a31a207382db6d3d85d1999fa4e41`
- Backup SHA-256: `de0f14023ebd1692f1dede7d4b48bdc3400ac3411fdf32fe763c526a7254a727`
- Source/backup mode: `0600`
- Backup integrity: `ok`
- Backup foreign-key check: passed

Post-restart seeded counts remained:

- 181 users
- 161 profiles
- 85 projects
- 27 DM conversations
- 137 DM messages
- 5 Community channels
- 93 Community messages
- integrity `ok`, foreign keys passed

The live Kentucky DB SHA remained `c386afd7f3c1dc6e240793eb82bfc79ee08a31a207382db6d3d85d1999fa4e41`.

## Qualification

Public routes `/`, `/projects`, `/login`, `/winners`, `/status`, `/ai-evals`,
`/people`, `/community`, and `/messages` returned HTTP 200 through the CF URL.
Kentucky `/api/health` returned HTTP 200/database ok with active event
`evt_kentucky_vibes` / `Kentucky Vibes Hackathon`.

Production remained on H.4R.1 PID `913466` and HTTP 200. No production data,
Chatto, Viby, or publication state was changed.

## Follow-up fixture clarity update

After deployment, a read-only review found six duplicate display-name pairs in
the synthetic fixture: Alex Chen, Elena Park, Jordan Lee, Maya Rivera, Priya
Nair, and Sam Okafor. These were distinct `f2a-*` communication personas and
`kv_user_*` builder accounts, not duplicate account rows.

At the operator's request, both `users.name` and
`user_profiles.display_name` were updated for those 12 synthetic accounts with
explicit suffixes such as `Alex Chen (Reply)` and `Alex Chen (Builder 002)`.
Handles, account IDs, projects, memberships, DMs, and Community content were
not changed.

Pre-update backup:

`/opt/vibe-hackathon/backups/kentucky-vibes-f0b-unique-names-pre-20260811T102000Z.sqlite`

- Pre-update DB SHA-256: `c386afd7f3c1dc6e240793eb82bfc79ee08a31a207382db6d3d85d1999fa4e41`
- Post-update DB SHA-256: `a75aad9036c050a027b9efc410ba6f40f0d144b4f24b34698b3339e8c8eee653`
- Integrity: `ok`
- Foreign keys: passed
- Discoverable duplicate display names remaining: `0`
