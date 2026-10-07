# Deployment and Rollback

## Preconditions

- Exact application and Runtime commits reviewed.
- Corrected Runtime SDK/route behavior deployed backward compatibly.
- Current legacy Vibe flow still passes before cutover.
- Vibe-specific confidential credential created, stored only in application
  secret configuration, and tested.
- Additive schema migration validated on a production copy.
- Every legacy admin identity has an approved local-account mapping or an
  explicit no-access outcome.
- Protected database and environment backups verified.
- The pre-existing `local.db.pre-p0-4.bak` has an approved secure disposition;
  it is not bundled into a release.

## Immutable release sequence

1. Capture current application and Runtime baselines.
2. Create a clean immutable application release from the approved commit.
3. Run clean install, tests, and production build outside the mutable worktree.
4. Enter the documented application maintenance window for schema work.
5. Back up and apply only the approved additive application migration.
6. Validate schema, mappings, and rollback backup.
7. Atomically switch the application release.
8. Restart only the Vibe application service.
9. Verify local and public health before enabling new session issuance.
10. Run one reviewed account-link and admin login.
11. Monitor sanitized logs and restart count.

Do not restart Runtime during the application deployment.

## Protocol transition

Runtime protocol changes must be backward compatible:

- current legacy GET continues while the dual-read application is qualified;
- modern POST is enabled only for the Vibe registration after credential
  provisioning;
- application switches to modern redemption;
- legacy GET is disabled for Vibe only after the application compatibility
  window and rollback decision.

Do not enable modern POST and disable legacy GET in one irreversible step.

## Credential rotation

1. Create a second active Vibe client credential.
2. install it in application secret configuration without command-line or log
   exposure;
3. restart only the application and verify redemption;
4. revoke the old Runtime credential;
5. verify old credential rejection and new credential success.

## Rollback triggers

- callback state mismatch for valid flows;
- inability to redeem through the corrected SDK;
- Better Auth session not established or wrong cookie scope;
- link conflict or duplicate not handled atomically;
- role revocation not immediate;
- agent/artifact cross-use;
- unexpected login failures in the compatibility cohort;
- secret or assertion material in logs;
- build/startup/health regression.

## Rollback procedure

1. Stop new application access if database consistency is in doubt.
2. Disable new Better Auth session issuance through the reviewed feature gate.
3. Restore the previous immutable Vibe release.
4. Restore application environment metadata if it changed.
5. Restart only Vibe.
6. Keep the corrected Runtime deployed if it is backward compatible.
7. Re-enable legacy application redemption only while Runtime legacy GET remains
   allowed.
8. Revoke sessions or client credentials created by the failed release if
   their integrity is uncertain.
9. Restore the application database only when the additive migration itself
   caused corruption; otherwise preserve it for diagnosis.

Do not delete new identity-link data automatically, reactivate revoked links,
or resurrect expired legacy cookies.

## Final retirement

After at least one full legacy-cookie TTL and the approved observation window:

- verify no legacy-cookie use;
- remove legacy acceptance;
- remove `VIBE_ADMIN_SESSION_SECRET`;
- disable Runtime legacy GET for Vibe;
- destroy rollback backups according to retention policy;
- update the canonical authentication and operations documentation.
