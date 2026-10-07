import { resolve } from "node:path";

export type CanonicalMigration = {
  id: string;
  script: string;
  confirmationEnv?: string;
  confirmation: (target: string) => string;
};

/**
 * The cumulative application schema was introduced through additive, guarded
 * SQLite scripts rather than a generated Drizzle SQL history. Keep this order
 * explicit: later scripts validate or reference tables created by earlier
 * product layers.
 */
export const CANONICAL_MIGRATIONS: readonly CanonicalMigration[] = [
  {
    id: "A-viby-identity-links",
    script: "scripts/migrate-viby-identity-links.ts",
    confirmationEnv: "VIBE_IDENTITY_LINK_MIGRATION_CONFIRM",
    confirmation: () => "CREATE_VIBY_IDENTITY_LINKS",
  },
  {
    id: "B-admin-auth",
    script: "scripts/migrate-admin-auth.ts",
    confirmationEnv: "VIBE_ADMIN_AUTH_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE ADMIN AUTH DATABASE ${target}`,
  },
  {
    id: "B-viby-better-auth",
    script: "scripts/migrate-viby-better-auth.ts",
    confirmationEnv: "VIBE_PHASE_B_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE VIBY BETTER AUTH DATABASE ${target}`,
  },
  {
    id: "B4.4-viby-judge-login",
    script: "scripts/migrate-viby-judge-login.ts",
    confirmationEnv: "VIBE_PHASE_B44_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE VIBY JUDGE LOGIN DATABASE ${target}`,
  },
  {
    id: "B4-judge-authorizations",
    script: "scripts/migrate-judge-authorizations.ts",
    confirmationEnv: "VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE JUDGE AUTHORIZATIONS DATABASE ${target}`,
  },
  {
    id: "B-account-management",
    script: "scripts/migrate-account-management.ts",
    confirmationEnv: "VIBE_ACCOUNT_MANAGEMENT_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE ACCOUNT MANAGEMENT DATABASE ${target}`,
  },
  {
    id: "F0-user-profiles",
    script: "scripts/migrate-user-profiles.ts",
    confirmationEnv: "VIBE_USER_PROFILES_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE USER PROFILES DATABASE ${target}`,
  },
  {
    id: "B4.5-account-invitations",
    script: "scripts/migrate-account-invitations.ts",
    confirmationEnv: "VIBE_ACCOUNT_INVITATIONS_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE ACCOUNT INVITATIONS DATABASE ${target}`,
  },
  {
    id: "B4.7-viby-generic-login",
    script: "scripts/migrate-viby-generic-login.ts",
    confirmationEnv: "VIBE_PHASE_B47_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE VIBY GENERIC LOGIN DATABASE ${target}`,
  },
  {
    id: "C1-submission-onboarding",
    script: "scripts/migrate-submission-onboarding.ts",
    confirmationEnv: "VIBE_C1_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE SUBMISSION ONBOARDING DATABASE ${target}`,
  },
  {
    id: "C2A-submission-memberships",
    script: "scripts/migrate-submission-memberships.ts",
    confirmationEnv: "VIBE_C2A_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE SUBMISSION MEMBERSHIPS DATABASE ${target}`,
  },
  {
    id: "C2B-native-chat",
    script: "scripts/migrate-native-chat.ts",
    confirmationEnv: "VIBE_C2B_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE NATIVE CHAT DATABASE ${target}`,
  },
  {
    id: "F2-direct-messaging",
    script: "scripts/migrate-direct-messaging.ts",
    confirmationEnv: "VIBE_F2_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE DIRECT MESSAGING DATABASE ${target}`,
  },
  {
    id: "F3-community-channels",
    script: "scripts/migrate-community-channels.ts",
    confirmationEnv: "VIBE_F3_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE COMMUNITY CHANNELS DATABASE ${target}`,
  },
  {
    id: "D1-judging-operations",
    script: "scripts/migrate-judging-operations.ts",
    confirmationEnv: "VIBE_D1_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE JUDGING OPERATIONS DATABASE ${target}`,
  },
  {
    id: "D2-results",
    script: "scripts/migrate-results.ts",
    confirmationEnv: "VIBE_D2_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE RESULTS DATABASE ${target}`,
  },
  {
    id: "D3-calibration",
    script: "scripts/migrate-calibration.ts",
    confirmationEnv: "VIBE_D3_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE CALIBRATION DATABASE ${target}`,
  },
  {
    id: "D4-publication",
    script: "scripts/migrate-publication.ts",
    confirmationEnv: "VIBE_D4_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE PUBLICATION DATABASE ${target}`,
  },
  {
    id: "H2-participant-experience",
    script: "scripts/migrate-participant-experience.ts",
    confirmationEnv: "VIBE_H2_MIGRATION_CONFIRM",
    confirmation: (target) => `MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE ${target}`,
  },
] as const;

export function canonicalMigrationPaths(cwd = process.cwd()) {
  return CANONICAL_MIGRATIONS.map((migration) => ({
    ...migration,
    absoluteScript: resolve(cwd, migration.script),
  }));
}
