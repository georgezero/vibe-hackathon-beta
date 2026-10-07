# Phase A Production Deployment

Deployment date: 2026-07-28

- Deployed commit: `772ea8f9029b1d4d3bc4a43f0abc4001ed7d3d0d`
- Immutable release:
  `/opt/vibe-hackathon/releases/772ea8f9029b1d4d3bc4a43f0abc4001ed7d3d0d`
- Previous release:
  `/opt/vibe-hackathon/releases/1cc6394713aaef32425d763772f1e4b75857bdcc`
- Rollback backup:
  `/opt/vibe-hackathon/backups/local.db.pre-phase-a.20260728T195334-0400.bak`

The protected backup passed SQLite integrity validation before migration. The
additive admin-auth migration completed and an immediate rerun reported the
schema already valid. The operator provisioned `george@fff.ad` with one Better
Auth credential account and one active application-owned admin grant. The
temporary password file was securely removed.

Post-deployment validation confirmed local and public health, password rejection,
password login, dashboard authorization, logout, immediate role revocation and
restoration, Viby admin and agent launch redirects, public routes, managed port
ownership, and a stable service restart count. The previously qualified Viby,
agent-attribution, artifact, judge, and team-owner flows remain unchanged.

Rollback remains available by stopping the user-level application service,
atomically restoring the previous release symlink, restoring the verified
database backup only when schema/data rollback is required, and restarting the
previous release.
