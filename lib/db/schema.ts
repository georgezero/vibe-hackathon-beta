import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Better Auth tables ─────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  githubId: text("github_id").unique(),
  githubUsername: text("github_username"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Durable, user-owned identity data. This is deliberately separate from
// Better Auth credentials, event-scoped memberships/rosters, and privileged
// judge/administrator authorizations. Profile data never grants access.
export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  // A private/lazy profile may not have a handle until the user explicitly
  // chooses one. Handles are normalized and validated by lib/user-profiles.
  handle: text("handle"),
  // Nullable so a safe shell can exist when Better Auth users.name is empty;
  // F.0B profile editing will require a non-empty display name before public
  // visibility can be selected.
  displayName: text("display_name"),
  headline: text("headline"),
  bio: text("bio"),
  affiliation: text("affiliation"),
  degrees: text("degrees"),
  websiteUrl: text("website_url"),
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  interests: text("interests", { mode: "json" }).$type<string[]>(),
  visibility: text("visibility", { enum: ["private", "public"] })
    .notNull()
    .default("private"),
  // Directory listing is a separate, explicit opt-in. Public profile links
  // remain possible without making a participant searchable.
  discoverable: integer("discoverable", { mode: "boolean" })
    .notNull()
    .default(false),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("user_profiles_user_unique").on(table.userId),
  uniqueIndex("user_profiles_handle_unique")
    .on(table.handle)
    .where(sql`${table.handle} IS NOT NULL`),
  index("user_profiles_visibility_idx").on(table.visibility),
  index("user_profiles_discovery_idx").on(table.visibility, table.discoverable),
  check(
    "user_profiles_visibility_check",
    sql`${table.visibility} IN ('private', 'public')`,
  ),
  check(
    "user_profiles_display_name_length_check",
    sql`${table.displayName} IS NULL OR length(trim(${table.displayName})) BETWEEN 2 AND 100`,
  ),
  check(
    "user_profiles_handle_format_check",
    sql`(
      ${table.handle} IS NULL
      OR (
        length(${table.handle}) BETWEEN 3 AND 30
        AND ${table.handle} NOT GLOB '*[^a-z0-9-]*'
        AND ${table.handle} NOT GLOB '-*'
        AND ${table.handle} NOT GLOB '*-'
        AND ${table.handle} NOT LIKE '%--%'
      )
    )`,
  ),
  check(
    "user_profiles_headline_length_check",
    sql`${table.headline} IS NULL OR length(${table.headline}) <= 160`,
  ),
  check(
    "user_profiles_bio_length_check",
    sql`${table.bio} IS NULL OR length(${table.bio}) <= 2000`,
  ),
  check(
    "user_profiles_affiliation_length_check",
    sql`${table.affiliation} IS NULL OR length(${table.affiliation}) <= 160`,
  ),
  check(
    "user_profiles_degrees_length_check",
    sql`${table.degrees} IS NULL OR length(${table.degrees}) <= 120`,
  ),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("accounts_credential_user_unique")
    .on(table.userId)
    .where(sql`${table.providerId} = 'credential'`),
]);

// Application-owned lifecycle policy for Better Auth users. Better Auth
// remains authoritative for credentials and sessions; this table carries only
// application status and password-change policy.
export const userAccountControls = sqliteTable("user_account_controls", {
  userId: text("user_id").primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  passwordChangeRequired: integer("password_change_required", { mode: "boolean" })
    .notNull()
    .default(false),
  temporaryPasswordIssuedAt: integer("temporary_password_issued_at", { mode: "timestamp" }),
  passwordChangedAt: integer("password_changed_at", { mode: "timestamp" }),
  disabledAt: integer("disabled_at", { mode: "timestamp" }),
  disabledByUserId: text("disabled_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("user_account_controls_status_idx").on(table.status),
  index("user_account_controls_password_change_idx").on(table.passwordChangeRequired),
  check(
    "user_account_controls_status_check",
    sql`${table.status} IN ('active', 'disabled')`,
  ),
  check(
    "user_account_controls_disabled_state_check",
    sql`(
      (${table.status} = 'active' AND ${table.disabledAt} IS NULL)
      OR (${table.status} = 'disabled' AND ${table.disabledAt} IS NOT NULL)
    )`,
  ),
]);

// Single-use onboarding authority. The token itself is never stored: only its
// SHA-256 digest. Access intent is applied only when the invitation is
// accepted, and remains separate from authentication state.
export const accountInvitations = sqliteTable("account_invitations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "expired", "revoked"] })
    .notNull()
    .default("pending"),
  grantAdmin: integer("grant_admin", { mode: "boolean" }).notNull().default(false),
  grantJudge: integer("grant_judge", { mode: "boolean" }).notNull().default(false),
  judgeProfileId: text("judge_profile_id")
    .references(() => judges.id, { onDelete: "restrict" }),
  eventId: text("event_id").notNull()
    .references(() => events.id, { onDelete: "restrict" }),
  invitedByUserId: text("invited_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  expiredAt: integer("expired_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("account_invitations_user_idx").on(table.userId),
  index("account_invitations_status_idx").on(table.status),
  index("account_invitations_expires_idx").on(table.expiresAt),
  index("account_invitations_event_idx").on(table.eventId),
  uniqueIndex("account_invitations_pending_user_unique")
    .on(table.userId)
    .where(sql`${table.status} = 'pending'`),
  uniqueIndex("account_invitations_pending_judge_unique")
    .on(table.judgeProfileId, table.eventId)
    .where(sql`${table.status} = 'pending' AND ${table.grantJudge} = 1`),
  check(
    "account_invitations_status_check",
    sql`${table.status} IN ('pending', 'accepted', 'expired', 'revoked')`,
  ),
  check(
    "account_invitations_judge_intent_check",
    sql`(${table.grantJudge} = 0 AND ${table.judgeProfileId} IS NULL)
      OR (${table.grantJudge} = 1 AND ${table.judgeProfileId} IS NOT NULL)`,
  ),
  check(
    "account_invitations_lifecycle_check",
    sql`(
      (${table.status} = 'pending' AND ${table.acceptedAt} IS NULL AND ${table.expiredAt} IS NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'accepted' AND ${table.acceptedAt} IS NOT NULL AND ${table.expiredAt} IS NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'expired' AND ${table.acceptedAt} IS NULL AND ${table.expiredAt} IS NOT NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'revoked' AND ${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NOT NULL)
    )`,
  ),
]);

// Application-owned authorization for Better Auth identities. Authentication
// alone never grants organizer access.
export const adminAuthorizations = sqliteTable("admin_authorizations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
  grantSource: text("grant_source").notNull().default("operator"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("admin_authorizations_user_unique").on(table.userId),
  index("admin_authorizations_status_idx").on(table.status),
  check("admin_authorizations_status_check", sql`${table.status} IN ('active', 'revoked')`),
]);

// Viby identity links bind a verified external subject to a local user. They
// do not grant authorization or replace Better Auth sessions.
export const vibyIdentityLinks = sqliteTable("viby_identity_links", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().default("viby"),
  subjectId: text("subject_id").notNull(),
  // Historical compatibility only. Authorization never derives from this
  // column; linkScope carries the role-neutral binding semantics.
  role: text("role", { enum: ["admin"] }).notNull(),
  linkScope: text("link_scope", {
    enum: ["legacy_admin", "identity"],
  }).notNull().default("legacy_admin"),
  localUserId: text("local_user_id").references(() => users.id, { onDelete: "set null" }),
  applicationId: text("application_id").notNull().default("vibe-hackathon"),
  status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
  linkProvenance: text("link_provenance").notNull().default("operator"),
  environment: text("environment"),
  bindingProvenance: text("binding_provenance"),
  boundAt: integer("bound_at", { mode: "timestamp" }),
  displayName: text("display_name").notNull(),
  lastVerifiedAt: integer("last_verified_at", { mode: "timestamp" }).notNull(),
  lastAuthenticatedAt: integer("last_authenticated_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("viby_identity_links_provider_subject_role_unique").on(table.providerId, table.subjectId, table.role),
  uniqueIndex("viby_identity_links_application_subject_unique").on(table.applicationId, table.subjectId),
  uniqueIndex("viby_identity_links_application_user_unique")
    .on(table.applicationId, table.localUserId)
    .where(sql`${table.localUserId} IS NOT NULL`),
  index("viby_identity_links_role_idx").on(table.role),
  check("viby_identity_links_status_check", sql`${table.status} IN ('active', 'revoked')`),
  check(
    "viby_identity_links_scope_check",
    sql`${table.linkScope} IN ('legacy_admin', 'identity')`,
  ),
]);

export const vibyLoginTransactions = sqliteTable("viby_login_transactions", {
  id: text("id").primaryKey(),
  stateHash: text("state_hash").notNull().unique(),
  browserBindingHash: text("browser_binding_hash").notNull(),
  operation: text("operation", { enum: ["application_login", "admin_login", "judge_login"] }).notNull(),
  returnTo: text("return_to").notNull(),
  expectedAudience: text("expected_audience").notNull(),
  freshnessRequired: integer("freshness_required", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp" }),
  failureCode: text("failure_code"),
}, (table) => [
  index("viby_login_transactions_expires_idx").on(table.expiresAt),
  check("viby_login_transactions_operation_check", sql`${table.operation} IN ('application_login', 'admin_login', 'judge_login')`),
]);

export const vibySessionHandoffs = sqliteTable("viby_session_handoffs", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  transactionId: text("transaction_id").notNull()
    .references(() => vibyLoginTransactions.id, { onDelete: "cascade" }),
  identityLinkId: text("identity_link_id").notNull()
    .references(() => vibyIdentityLinks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vibySubjectHash: text("viby_subject_hash").notNull(),
  operation: text("operation", { enum: ["application_login", "admin_login", "judge_login"] }).notNull(),
  returnTo: text("return_to").notNull(),
  verificationKind: text("verification_kind", { enum: ["fresh", "remembered"] }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp" }),
}, (table) => [
  index("viby_session_handoffs_expires_idx").on(table.expiresAt),
  check("viby_session_handoffs_operation_check", sql`${table.operation} IN ('application_login', 'admin_login', 'judge_login')`),
]);

export const adminSessionProvenance = sqliteTable("admin_session_provenance", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }).unique(),
  authenticationMethod: text("authentication_method", {
    enum: ["better_auth_viby"],
  }).notNull(),
  identityLinkId: text("identity_link_id").notNull()
    .references(() => vibyIdentityLinks.id, { onDelete: "restrict" }),
  vibySubjectHash: text("viby_subject_hash").notNull(),
  operation: text("operation", { enum: ["application_login", "admin_login", "judge_login"] }).notNull().default("admin_login"),
  verificationKind: text("verification_kind", { enum: ["fresh", "remembered"] }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("admin_session_provenance_link_idx").on(table.identityLinkId),
  check(
    "admin_session_provenance_method_check",
    sql`${table.authenticationMethod} = 'better_auth_viby'`,
  ),
  check(
    "admin_session_provenance_operation_check",
    sql`${table.operation} IN ('application_login', 'admin_login', 'judge_login')`,
  ),
]);

export const vibyIdentityLinkTransactions = sqliteTable("viby_identity_link_transactions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  browserBindingHash: text("browser_binding_hash").notNull(),
  vibySubject: text("viby_subject").notNull(),
  vibySubjectHash: text("viby_subject_hash").notNull(),
  applicationId: text("application_id").notNull(),
  environment: text("environment").notNull(),
  identitySessionId: text("identity_session_id").notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp" }).notNull(),
  assertionCorrelationHash: text("assertion_correlation_hash").notNull(),
  expectedUserId: text("expected_user_id").references(() => users.id, { onDelete: "restrict" }),
  returnTo: text("return_to").notNull(),
  operation: text("operation", { enum: ["application_login", "admin_login", "judge_login"] }).notNull().default("admin_login"),
  transactionType: text("transaction_type", {
    enum: ["create_new_link", "claim_unbound_legacy_link"],
  }).notNull().default("create_new_link"),
  status: text("status", { enum: ["pending", "confirmed", "cancelled", "failed"] }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp" }),
  cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
  failureCode: text("failure_code"),
}, (table) => [
  index("viby_link_transactions_expires_idx").on(table.expiresAt),
  index("viby_link_transactions_subject_idx").on(table.vibySubjectHash),
  check("viby_link_transactions_status_check", sql`${table.status} IN ('pending', 'confirmed', 'cancelled', 'failed')`),
  check(
    "viby_link_transactions_type_check",
    sql`${table.transactionType} IN ('create_new_link', 'claim_unbound_legacy_link')`,
  ),
  check(
    "viby_link_transactions_operation_check",
    sql`${table.operation} IN ('application_login', 'admin_login', 'judge_login')`,
  ),
]);

export const vibyLegacyIdentityClaims = sqliteTable("viby_legacy_identity_claims", {
  transactionId: text("transaction_id").primaryKey()
    .references(() => vibyIdentityLinkTransactions.id, { onDelete: "cascade" }),
  identityLinkId: text("identity_link_id").notNull()
    .references(() => vibyIdentityLinks.id, { onDelete: "restrict" }),
  expectedStatus: text("expected_status", { enum: ["active"] }).notNull(),
  expectedUserUnbound: integer("expected_user_unbound", { mode: "boolean" }).notNull().default(true),
  expectedApplicationId: text("expected_application_id").notNull(),
  expectedEnvironment: text("expected_environment").notNull(),
  expectedSubjectHash: text("expected_subject_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("viby_legacy_claims_link_idx").on(table.identityLinkId),
  check("viby_legacy_claims_status_check", sql`${table.expectedStatus} = 'active'`),
  check("viby_legacy_claims_unbound_check", sql`${table.expectedUserUnbound} = 1`),
]);

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Submissions ────────────────────────────────────────────
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  isFrozen: integer("is_frozen", { mode: "boolean" }).notNull().default(false),
  startDate: integer("start_date", { mode: "timestamp" }),
  submissionDeadline: integer("submission_deadline", { mode: "timestamp" }),
  judgingDeadline: integer("judging_deadline", { mode: "timestamp" }),
  audienceVotingEnabled: integer("audience_voting_enabled", { mode: "boolean" }).notNull().default(true),
  audienceAwardCount: integer("audience_award_count").notNull().default(1),
  audienceVotesPerPerson: integer("audience_votes_per_person").notNull().default(1),
  audienceVotingStartsAt: integer("audience_voting_starts_at", { mode: "timestamp" }),
  audienceVotingEndsAt: integer("audience_voting_ends_at", { mode: "timestamp" }),
  audienceResultsVisible: integer("audience_results_visible", { mode: "boolean" }).notNull().default(true),
  // v2 audience voting
  audienceVotingMode: text("audience_voting_mode").notNull().default("disabled"), // "disabled" | "human" | "agent" | "hybrid"
  audienceIdentityMethod: text("audience_identity_method").notNull().default("anonymous"), // "badge" | "email" | "invite_code" | "anonymous"
  winnersPublishedAt: integer("winners_published_at", { mode: "timestamp" }),
  showJudgeChoice: integer("show_judge_choice", { mode: "boolean" }).notNull().default(true),
  showPeoplesChoice: integer("show_peoples_choice", { mode: "boolean" }).notNull().default(true),
  showAIChoice: integer("show_ai_choice", { mode: "boolean" }).notNull().default(true),
  showSpecialAwards: integer("show_special_awards", { mode: "boolean" }).notNull().default(true),
  // Branding
  displayName: text("display_name"),
  logoUrl: text("logo_url"),
  tagline: text("tagline"),
  externalUrl: text("external_url"),
  // LLM judging settings (experimental — does not affect official score unless enabled)
  llmJudgingEnabled: integer("llm_judging_enabled", { mode: "boolean" }).notNull().default(false),
  llmJudgingAffectsOfficialScore: integer("llm_judging_affects_official_score", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
  editToken: text("edit_token").notNull().unique(),
  status: text("status", { enum: ["draft", "submitted", "finalized", "locked"] })
    .notNull()
    .default("draft"),

  // Team info
  teamName: text("team_name").notNull(),
  contactEmail: text("contact_email").notNull(),

  // Project details
  projectTitle: text("project_title"),
  problemStatement: text("problem_statement"),
  targetUsers: text("target_users"),

  // Artifacts (URLs only — no file uploads)
  demoUrl: text("demo_url"),
  demoVideoUrl: text("demo_video_url"),
  githubUrl: text("github_url"),
  screenshotUrl: text("screenshot_url"),
  screenshotUrls: text("screenshot_urls", { mode: "json" }).$type<string[]>(),
  readmeUrl: text("readme_url"),
  agentsMdUrl: text("agents_md_url"),
  promptStrategyUrl: text("prompt_strategy_url"),
  agentReportUrl: text("agent_report_url"),

  // Documentation
  sampleDataDescription: text("sample_data_description"),
  setupInstructions: text("setup_instructions"),
  deployInstructions: text("deploy_instructions"),
  knownLimitations: text("known_limitations"),

  // AI tools (stored as JSON array)
  aiToolsUsed: text("ai_tools_used", { mode: "json" }).$type<string[]>(),

  // Extended vibe.json fields
  license: text("license"),
  agentHarnesses: text("agent_harnesses", { mode: "json" }).$type<string[]>(),
  agentModels: text("agent_models", { mode: "json" }).$type<string[]>(),
  budgetTier: text("budget_tier"),
  estimatedHumanHours: real("estimated_human_hours"),
  estimatedAgentHours: real("estimated_agent_hours"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  vibeJsonRaw: text("vibe_json_raw"),
  agentReportRaw: text("agent_report_raw"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  finalizedAt: integer("finalized_at", { mode: "timestamp" }),
});

// ── Teams and GitHub owner registration ───────────────────
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  affiliation: text("affiliation"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const teamOwners = sqliteTable("team_owners", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  githubUserId: text("github_user_id").notNull(),
  githubLogin: text("github_login").notNull(),
  githubAvatarUrl: text("github_avatar_url"),
  githubProfileUrl: text("github_profile_url"),
  ownerBadgeNumber: text("owner_badge_number").notNull(),
  badgeVerificationStatus: text("badge_verification_status", { enum: ["unchecked", "verified", "mismatch", "unknown"] }).notNull().default("unchecked"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Repository reproduction evidence ───────────────────────
export const reproductionRuns = sqliteTable("reproduction_runs", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["not-started", "manual-pending", "running", "passed", "failed"] }).notNull().default("not-started"),
  mode: text("mode", { enum: ["manual", "container"] }).notNull().default("manual"),
  repoUrl: text("repo_url"),
  agentInstructionsUrl: text("agent_instructions_url"),
  installCommand: text("install_command"),
  runCommand: text("run_command"),
  evidenceNotes: text("evidence_notes"),
  logsUrl: text("logs_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Team members ───────────────────────────────────────────
export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  badgeNumber: text("badge_number"),
  badgeVerificationStatus: text("badge_verification_status", { enum: ["unchecked", "verified", "mismatch", "unknown"] }).notNull().default("unchecked"),
  affiliation: text("affiliation"),
  degrees: text("degrees"),
  isStudentTrainee: integer("is_student_trainee", { mode: "boolean" }).notNull().default(false),
  role: text("role"),
  order: integer("order").notNull().default(0),
});

// ── Submission ownership (GitHub recovery) ─────────────────
export const submissionOwners = sqliteTable("submission_owners", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("submission_owners_submission_unique").on(table.submissionId),
  index("submission_owners_user_idx").on(table.userId),
]);

// Explicit application membership for private submission resources. Roster
// metadata and matching email addresses never grant access; every chat/team
// operation must resolve one of these rows live.
export const submissionMembershipInvitations = sqliteTable("submission_membership_invitations", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull()
    .references(() => submissions.id, { onDelete: "restrict" }),
  invitedByUserId: text("invited_by_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  intendedMemberId: text("intended_member_id")
    .references(() => teamMembers.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role", { enum: ["teammate"] }).notNull().default("teammate"),
  status: text("status", { enum: ["pending", "accepted", "revoked", "expired"] })
    .notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("submission_membership_invitations_submission_idx").on(table.submissionId),
  index("submission_membership_invitations_status_idx").on(table.status),
  index("submission_membership_invitations_expires_idx").on(table.expiresAt),
  uniqueIndex("submission_membership_invitations_pending_member_unique")
    .on(table.submissionId, table.intendedMemberId)
    .where(sql`${table.status} = 'pending' AND ${table.intendedMemberId} IS NOT NULL`),
  check(
    "submission_membership_invitations_role_check",
    sql`${table.role} = 'teammate'`,
  ),
  check(
    "submission_membership_invitations_status_check",
    sql`${table.status} IN ('pending', 'accepted', 'revoked', 'expired')`,
  ),
  check(
    "submission_membership_invitations_lifecycle_check",
    sql`(
      (${table.status} = 'pending' AND ${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'accepted' AND ${table.acceptedAt} IS NOT NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} IN ('revoked', 'expired') AND ${table.revokedAt} IS NOT NULL)
    )`,
  ),
]);

export const submissionMemberships = sqliteTable("submission_memberships", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull()
    .references(() => submissions.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  role: text("role", { enum: ["owner", "teammate"] }).notNull(),
  status: text("status", { enum: ["invited", "active", "revoked"] }).notNull(),
  invitationId: text("invitation_id")
    .references(() => submissionMembershipInvitations.id, { onDelete: "restrict" }),
  invitedAt: integer("invited_at", { mode: "timestamp" }),
  joinedAt: integer("joined_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  revokedByUserId: text("revoked_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  revocationReason: text("revocation_reason"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("submission_memberships_submission_idx").on(table.submissionId),
  index("submission_memberships_user_idx").on(table.userId),
  index("submission_memberships_status_idx").on(table.status),
  index("submission_memberships_invitation_idx").on(table.invitationId),
  uniqueIndex("submission_memberships_active_user_submission_unique")
    .on(table.submissionId, table.userId)
    .where(sql`${table.status} = 'active'`),
  uniqueIndex("submission_memberships_active_owner_submission_unique")
    .on(table.submissionId)
    .where(sql`${table.status} = 'active' AND ${table.role} = 'owner'`),
  check(
    "submission_memberships_role_check",
    sql`${table.role} IN ('owner', 'teammate')`,
  ),
  check(
    "submission_memberships_status_check",
    sql`${table.status} IN ('invited', 'active', 'revoked')`,
  ),
  check(
    "submission_memberships_lifecycle_check",
    sql`(
      (${table.status} IN ('invited', 'active') AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)
    )`,
  ),
  check(
    "submission_memberships_role_invitation_check",
    sql`(${table.role} = 'owner' AND ${table.invitationId} IS NULL)
      OR (${table.role} = 'teammate' AND ${table.invitationId} IS NOT NULL)`,
  ),
]);

// Native owner/team chat. Rooms are private projections of explicit
// submission memberships; no application role grants room access.
export const chatRooms = sqliteTable("chat_rooms", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull()
    .references(() => submissions.id, { onDelete: "restrict" }),
  type: text("type", { enum: ["submission_private"] }).notNull().default("submission_private"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("chat_rooms_submission_idx").on(table.submissionId),
  index("chat_rooms_status_idx").on(table.status),
  uniqueIndex("chat_rooms_active_submission_unique")
    .on(table.submissionId)
    .where(sql`${table.status} = 'active'`),
  check("chat_rooms_type_check", sql`${table.type} = 'submission_private'`),
  check("chat_rooms_status_check", sql`${table.status} IN ('active', 'archived')`),
  check(
    "chat_rooms_lifecycle_check",
    sql`(${table.status} = 'active' AND ${table.archivedAt} IS NULL)
      OR (${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL)`,
  ),
]);

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull()
    .references(() => chatRooms.id, { onDelete: "restrict" }),
  authorUserId: text("author_user_id")
    .references(() => users.id, { onDelete: "restrict" }),
  messageType: text("message_type", { enum: ["user_message", "system_event"] }).notNull(),
  body: text("body").notNull(),
  clientMessageId: text("client_message_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  editedAt: integer("edited_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
}, (table) => [
  index("chat_messages_room_created_idx").on(table.roomId, table.createdAt),
  index("chat_messages_author_idx").on(table.authorUserId),
  uniqueIndex("chat_messages_client_idempotency_unique")
    .on(table.roomId, table.authorUserId, table.clientMessageId),
  check("chat_messages_type_check", sql`${table.messageType} IN ('user_message', 'system_event')`),
  check("chat_messages_author_check", sql`(${table.messageType} = 'system_event') OR ${table.authorUserId} IS NOT NULL`),
  check("chat_messages_body_length_check", sql`length(${table.body}) BETWEEN 1 AND 4000`),
]);

export const chatReadStates = sqliteTable("chat_read_states", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull()
    .references(() => chatRooms.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  lastReadMessageId: text("last_read_message_id"),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("chat_read_states_room_user_unique").on(table.roomId, table.userId),
  index("chat_read_states_user_idx").on(table.userId),
]);

export const chatEvents = sqliteTable("chat_events", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull()
    .references(() => chatRooms.id, { onDelete: "restrict" }),
  eventType: text("event_type", { enum: ["message_created", "membership_revoked", "room_archived"] }).notNull(),
  messageId: text("message_id").references(() => chatMessages.id, { onDelete: "set null" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("chat_events_room_id_idx").on(table.roomId, table.id),
  index("chat_events_created_idx").on(table.createdAt),
  check("chat_events_type_check", sql`${table.eventType} IN ('message_created', 'membership_revoked', 'room_archived')`),
]);

// Event-scoped participant community. This stays separate from submission
// Team Chat and durable direct conversations because its access policy is
// event participation, not project membership or a person-to-person pair.
export const communityChannels = sqliteTable("community_channels", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type", { enum: ["discussion", "announcements"] }).notNull().default("discussion"),
  visibility: text("visibility", { enum: ["participants"] }).notNull().default("participants"),
  postingPolicy: text("posting_policy", { enum: ["participants", "admins_only"] }).notNull().default("participants"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("community_channels_event_slug_unique").on(table.eventId, table.slug),
  index("community_channels_event_status_idx").on(table.eventId, table.status),
  index("community_channels_event_sort_idx").on(table.eventId, table.sortOrder),
  check("community_channels_slug_check", sql`length(${table.slug}) BETWEEN 2 AND 40`),
  check("community_channels_name_check", sql`length(${table.name}) BETWEEN 1 AND 80`),
  check("community_channels_description_check", sql`length(${table.description}) BETWEEN 1 AND 240`),
  check("community_channels_type_check", sql`${table.type} IN ('discussion', 'announcements')`),
  check("community_channels_policy_check", sql`${table.postingPolicy} IN ('participants', 'admins_only')`),
  check("community_channels_status_check", sql`${table.status} IN ('active', 'archived')`),
]);

export const communityMessages = sqliteTable("community_messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => communityChannels.id, { onDelete: "restrict" }),
  authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  clientMessageId: text("client_message_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  removedAt: integer("removed_at", { mode: "timestamp" }),
  removedByUserId: text("removed_by_user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  index("community_messages_channel_created_idx").on(table.channelId, table.createdAt),
  index("community_messages_author_idx").on(table.authorUserId),
  uniqueIndex("community_messages_client_idempotency_unique").on(table.channelId, table.authorUserId, table.clientMessageId),
  check("community_messages_body_length_check", sql`length(${table.body}) BETWEEN 1 AND 4000`),
]);

export const communityMessageEvents = sqliteTable("community_message_events", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => communityChannels.id, { onDelete: "restrict" }),
  eventType: text("event_type", { enum: ["message_created"] }).notNull(),
  messageId: text("message_id").notNull().references(() => communityMessages.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("community_message_events_channel_idx").on(table.channelId, table.id),
  index("community_message_events_created_idx").on(table.createdAt),
  check("community_message_events_type_check", sql`${table.eventType} = 'message_created'`),
]);

export const communityChannelReadStates = sqliteTable("community_channel_read_states", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => communityChannels.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  lastReadMessageId: text("last_read_message_id").references(() => communityMessages.id, { onDelete: "set null" }),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("community_channel_read_states_unique").on(table.channelId, table.userId),
  index("community_channel_read_states_user_idx").on(table.userId),
]);

export const communityMessageReports = sqliteTable("community_message_reports", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => communityChannels.id, { onDelete: "restrict" }),
  messageId: text("message_id").notNull().references(() => communityMessages.id, { onDelete: "restrict" }),
  reporterUserId: text("reporter_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  category: text("category", { enum: ["harassment", "spam", "off_topic", "other"] }).notNull(),
  reason: text("reason"),
  status: text("status", { enum: ["open", "reviewed", "dismissed"] }).notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  index("community_message_reports_status_idx").on(table.status),
  index("community_message_reports_channel_idx").on(table.channelId),
  index("community_message_reports_message_idx").on(table.messageId),
  check("community_message_reports_category_check", sql`${table.category} IN ('harassment', 'spam', 'off_topic', 'other')`),
  check("community_message_reports_status_check", sql`${table.status} IN ('open', 'reviewed', 'dismissed')`),
  check("community_message_reports_reason_length_check", sql`${table.reason} IS NULL OR length(${table.reason}) <= 500`),
]);

// Direct participant messaging is deliberately separate from submission chat.
// A direct conversation is a durable, canonical two-person relationship; its
// initiation is event-scoped, while the stored conversation can survive later
// event changes. Profile data and directory visibility never grant access.
export const directConversations = sqliteTable("direct_conversations", {
  id: text("id").primaryKey(),
  participantAUserId: text("participant_a_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  participantBUserId: text("participant_b_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("direct_conversations_pair_unique").on(table.participantAUserId, table.participantBUserId),
  index("direct_conversations_a_idx").on(table.participantAUserId),
  index("direct_conversations_b_idx").on(table.participantBUserId),
  check("direct_conversations_distinct_check", sql`${table.participantAUserId} <> ${table.participantBUserId}`),
  check("direct_conversations_order_check", sql`${table.participantAUserId} < ${table.participantBUserId}`),
]);

export const directConversationMembers = sqliteTable("direct_conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull()
    .references(() => directConversations.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("direct_conversation_members_unique").on(table.conversationId, table.userId),
  index("direct_conversation_members_user_idx").on(table.userId),
]);

export const directMessages = sqliteTable("direct_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull()
    .references(() => directConversations.id, { onDelete: "restrict" }),
  authorUserId: text("author_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  clientMessageId: text("client_message_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("direct_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  index("direct_messages_author_idx").on(table.authorUserId),
  uniqueIndex("direct_messages_client_idempotency_unique").on(table.conversationId, table.authorUserId, table.clientMessageId),
  check("direct_messages_body_length_check", sql`length(${table.body}) BETWEEN 1 AND 4000`),
]);

export const directMessageReadStates = sqliteTable("direct_message_read_states", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull()
    .references(() => directConversations.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  lastReadMessageId: text("last_read_message_id")
    .references(() => directMessages.id, { onDelete: "set null" }),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("direct_message_read_states_unique").on(table.conversationId, table.userId),
  index("direct_message_read_states_user_idx").on(table.userId),
]);

export const directMessageEvents = sqliteTable("direct_message_events", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull()
    .references(() => directConversations.id, { onDelete: "restrict" }),
  eventType: text("event_type", { enum: ["message_created"] }).notNull(),
  messageId: text("message_id").notNull()
    .references(() => directMessages.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("direct_message_events_conversation_idx").on(table.conversationId, table.id),
  index("direct_message_events_created_idx").on(table.createdAt),
  check("direct_message_events_type_check", sql`${table.eventType} = 'message_created'`),
]);

export const participantBlocks = sqliteTable("participant_blocks", {
  blockerUserId: text("blocker_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  blockedUserId: text("blocked_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("participant_blocks_pair_unique").on(table.blockerUserId, table.blockedUserId),
  index("participant_blocks_blocked_idx").on(table.blockedUserId),
  check("participant_blocks_distinct_check", sql`${table.blockerUserId} <> ${table.blockedUserId}`),
]);

export const directMessageReports = sqliteTable("direct_message_reports", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull()
    .references(() => directConversations.id, { onDelete: "restrict" }),
  reporterUserId: text("reporter_user_id").notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  category: text("category", { enum: ["harassment", "spam", "other"] }).notNull(),
  reason: text("reason"),
  status: text("status", { enum: ["open", "reviewed", "dismissed"] }).notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("direct_message_reports_status_idx").on(table.status),
  index("direct_message_reports_conversation_idx").on(table.conversationId),
  check("direct_message_reports_category_check", sql`${table.category} IN ('harassment', 'spam', 'other')`),
  check("direct_message_reports_status_check", sql`${table.status} IN ('open', 'reviewed', 'dismissed')`),
  check("direct_message_reports_reason_length_check", sql`${table.reason} IS NULL OR length(${table.reason}) <= 500`),
]);

export const participantMessagingPreferences = sqliteTable("participant_messaging_preferences", {
  userId: text("user_id").primaryKey()
    .references(() => users.id, { onDelete: "restrict" }),
  allowIncoming: text("allow_incoming", { enum: ["participants", "none"] })
    .notNull().default("participants"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  check("participant_messaging_preferences_allow_check", sql`${table.allowIncoming} IN ('participants', 'none')`),
]);

// A short-lived, browser-bound proof that a user supplied the private edit
// token before choosing to claim a submission. The raw token is never stored
// here; only its digest is retained until the one-time transaction is consumed.
export const submissionClaimTransactions = sqliteTable("submission_claim_transactions", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  editTokenHash: text("edit_token_hash").notNull(),
  browserBindingHash: text("browser_binding_hash").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["pending", "confirmed", "cancelled", "expired"] }).notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
}, (table) => [
  index("submission_claim_transactions_token_idx").on(table.editTokenHash),
  index("submission_claim_transactions_submission_idx").on(table.submissionId),
  index("submission_claim_transactions_browser_idx").on(table.browserBindingHash),
  index("submission_claim_transactions_status_idx").on(table.status),
  index("submission_claim_transactions_expires_idx").on(table.expiresAt),
  check("submission_claim_transactions_status_check", sql`${table.status} IN ('pending', 'confirmed', 'cancelled', 'expired')`),
]);

// ── Judges ─────────────────────────────────────────────────
export const judges = sqliteTable("judges", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Event-scoped application authorization for a Better Auth user to act as an
// existing judge profile. Authentication, assignments, and scores remain
// separate concerns.
export const judgeAuthorizations = sqliteTable("judge_authorizations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  judgeId: text("judge_id").notNull().references(() => judges.id, { onDelete: "restrict" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["invited", "active", "revoked"] }).notNull(),
  grantProvenance: text("grant_provenance").notNull(),
  grantedByUserId: text("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  invitedAt: integer("invited_at", { mode: "timestamp" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  revocationReason: text("revocation_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("judge_authorizations_user_idx").on(table.userId),
  index("judge_authorizations_judge_idx").on(table.judgeId),
  index("judge_authorizations_event_idx").on(table.eventId),
  index("judge_authorizations_status_idx").on(table.status),
  index("judge_authorizations_user_event_idx").on(table.userId, table.eventId),
  index("judge_authorizations_judge_event_idx").on(table.judgeId, table.eventId),
  index("judge_authorizations_status_event_idx").on(table.status, table.eventId),
  uniqueIndex("judge_authorizations_active_user_event_unique")
    .on(table.userId, table.eventId)
    .where(sql`${table.status} = 'active'`),
  uniqueIndex("judge_authorizations_active_judge_event_unique")
    .on(table.judgeId, table.eventId)
    .where(sql`${table.status} = 'active'`),
  check(
    "judge_authorizations_status_check",
    sql`${table.status} IN ('invited', 'active', 'revoked')`,
  ),
  check(
    "judge_authorizations_lifecycle_check",
    sql`(
      (${table.status} = 'invited' AND ${table.invitedAt} IS NOT NULL AND ${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'active' AND ${table.acceptedAt} IS NOT NULL AND ${table.revokedAt} IS NULL)
      OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)
    )`,
  ),
]);

// Server-owned bridge between an invitation and the existing registered Viby
// login/link transaction. Runtime never receives invitation authority.
export const accountInvitationVibyTransactions = sqliteTable("account_invitation_viby_transactions", {
  loginTransactionId: text("login_transaction_id").primaryKey()
    .references(() => vibyLoginTransactions.id, { onDelete: "cascade" }),
  invitationId: text("invitation_id").notNull()
    .references(() => accountInvitations.id, { onDelete: "restrict" }),
  linkTransactionId: text("link_transaction_id")
    .references(() => vibyIdentityLinkTransactions.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("account_invitation_viby_link_unique").on(table.linkTransactionId),
  index("account_invitation_viby_invitation_idx").on(table.invitationId),
]);

// ── Judge assignments ──────────────────────────────────────
export const judgeAssignments = sqliteTable("judge_assignments", {
  id: text("id").primaryKey(),
  judgeId: text("judge_id").notNull().references(() => judges.id, { onDelete: "cascade" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("judge_assignments_judge_submission_unique")
    .on(table.judgeId, table.submissionId),
]);

// Operational state is deliberately separate from the historical assignment
// record. Reassignment never deletes an assignment; it marks the old record
// superseded and creates a new active record.
export const judgingAssignmentStates = sqliteTable("judging_assignment_states", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull().references(() => judgeAssignments.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["active", "superseded", "removed"] }).notNull().default("active"),
  conflictStatus: text("conflict_status", { enum: ["clear", "declared", "recused", "withdrawn", "replacement_required"] }).notNull().default("clear"),
  replacementAssignmentId: text("replacement_assignment_id"),
  reason: text("reason"),
  changedByUserId: text("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  changedAt: integer("changed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("judging_assignment_states_assignment_unique").on(table.assignmentId),
  index("judging_assignment_states_status_idx").on(table.status),
  index("judging_assignment_states_conflict_idx").on(table.conflictStatus),
]);

export const judgingEvaluationStates = sqliteTable("judging_evaluation_states", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull().references(() => judgeAssignments.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["not_started", "draft", "submitted", "frozen", "reopened"] }).notNull().default("not_started"),
  reason: text("reason"),
  frozenAt: integer("frozen_at", { mode: "timestamp" }),
  reopenedAt: integer("reopened_at", { mode: "timestamp" }),
  changedByUserId: text("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  changedAt: integer("changed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("judging_evaluation_states_assignment_unique").on(table.assignmentId),
  index("judging_evaluation_states_status_idx").on(table.status),
]);

// ── Human judge scores ─────────────────────────────────────
export const humanScores = sqliteTable("human_scores", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  judgeId: text("judge_id").notNull().references(() => judges.id, { onDelete: "cascade" }),

  // 8 rubric categories (1–10 each)
  problemSelection: integer("problem_selection"),
  productUsefulness: integer("product_usefulness"),
  functionality: integer("functionality"),
  uxDesign: integer("ux_design"),
  aiCollaboration: integer("ai_collaboration"),
  originality: integer("originality"),
  maintainability: integer("maintainability"),
  presentationClarity: integer("presentation_clarity"),

  privateNotes: text("private_notes"),
  recommendation: text("recommendation", { enum: ["strong-yes", "yes", "maybe", "no"] }),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("human_scores_judge_submission_unique")
    .on(table.judgeId, table.submissionId),
]);

// ── AI reviews ─────────────────────────────────────────────
export const aiReviews = sqliteTable("ai_reviews", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),

  complianceCheck: text("compliance_check", { enum: ["pass", "partial", "fail", "pending"] }).default("pending"),
  repoReview: text("repo_review"),
  demoValidation: text("demo_validation", { enum: ["live", "down", "pending"] }).default("pending"),
  screenshotValidation: text("screenshot_validation", { enum: ["valid", "invalid", "pending"] }).default("pending"),
  agentsMdEvaluation: text("agents_md_evaluation"),
  promptStrategyEvaluation: text("prompt_strategy_evaluation"),
  reliabilityNotes: text("reliability_notes"),

  generatedScore: real("generated_score"),
  generatedRationale: text("generated_rationale"),
  suggestedQuestions: text("suggested_questions", { mode: "json" }).$type<string[]>(),
  scoringDetails: text("scoring_details", { mode: "json" }).$type<Record<string, unknown>>(),

  status: text("status", { enum: ["pending", "running", "complete"] }).notNull().default("pending"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Evaluation tokens (submission-scoped, for external LLM eval) ───────────
export const aiEvaluationTokens = sqliteTable("ai_evaluation_tokens", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdBy: text("created_by"),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

// ── LLM judge runs ─────────────────────────────────────────
export const aiJudgeRuns = sqliteTable("ai_judge_runs", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
  modelProvider: text("model_provider").notNull(), // "mock" | "anthropic" | "openai" | "gemini" | "local"
  modelName: text("model_name").notNull(),
  status: text("status", { enum: ["pending", "running", "complete", "failed"] }).notNull().default("pending"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  error: text("error"),
  inputSummary: text("input_summary"),
  rawResponseJson: text("raw_response_json", { mode: "json" }).$type<Record<string, unknown>>(),
  scoresJson: text("scores_json", { mode: "json" }).$type<Record<string, unknown>>(),
  rationale: text("rationale"),
  costEstimate: real("cost_estimate"),
  tokenEstimate: integer("token_estimate"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Audience voters (identity-based, v2) ───────────────────
export const audienceVoters = sqliteTable("audience_voters", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  identityMethod: text("identity_method").notNull(),
  identityHash: text("identity_hash").notNull(), // sha256(normalize(badge/email/code))
  emailHash: text("email_hash"), // sha256(normalize(email)) — optional, for organizer context only
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  lastVoteAt: integer("last_vote_at", { mode: "timestamp" }),
});

// ── Audience votes ─────────────────────────────────────────
export const audienceVotes = sqliteTable("audience_votes", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  // v1 soft anti-spam: session fingerprint
  sessionFingerprint: text("session_fingerprint"),
  ipHash: text("ip_hash"),
  // v2 identity-based: FK to audienceVoters
  voterId: text("voter_id").references(() => audienceVoters.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Audit log ──────────────────────────────────────────────
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // "submission" | "judge" | "score" | etc.
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // "created" | "updated" | "locked" | etc.
  actorType: text("actor_type"), // "team" | "judge" | "admin" | "ai"
  actorId: text("actor_id"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// H.2 participant-experience telemetry is deliberately separate from the
// authoritative audit log. These rows are bounded, event-scoped product
// signals; they never carry arbitrary payloads, private content, or bearer
// credentials. Aggregation/retention may remove them without changing the
// business history represented by auditEvents.
export const participantJourneyEvents = sqliteTable("participant_journey_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  eventType: text("event_type", { enum: [
    "participant_start_viewed",
    "participant_project_created",
    "participant_project_resumed",
    "participant_project_claim_started",
    "participant_project_claim_completed",
    "participant_project_claim_failed",
    "participant_my_projects_viewed",
    "participant_project_opened",
    "participant_next_action_followed",
    "participant_editor_viewed",
    "participant_draft_saved",
    "participant_save_validation_failed",
    "participant_stale_edit_detected",
    "participant_agent_instructions_revealed",
    "participant_agent_handoff_copied",
    "participant_agent_update_received",
    "participant_agent_update_rejected",
    "participant_returned_to_preview",
    "participant_preview_viewed",
    "participant_readiness_incomplete",
    "participant_readiness_complete",
    "participant_finalization_confirmation_opened",
    "participant_finalization_attempted",
    "participant_finalization_succeeded",
    "participant_finalization_rejected",
    "participant_receipt_viewed",
    "participant_invitation_created",
    "participant_invitation_accepted",
    "participant_invitation_expired",
    "participant_invitation_revoked",
    "participant_invitation_wrong_account",
    "participant_project_access_revoked",
    "participant_people_viewed",
    "participant_messages_viewed",
    "participant_profile_viewed",
    "participant_message_initiated",
    "participant_dm_created",
    "participant_community_opened",
    "participant_community_channel_opened",
    "participant_community_message_posted",
    "participant_team_chat_opened",
    "participant_team_chat_message_posted",
    "participant_explore_opened",
    "participant_navigation_destination_selected",
    "participant_workspace_returned",
  ] as const }).notNull(),
  // A one-way event-scoped digest is sufficient for unique-participant
  // aggregates without exposing Better Auth IDs to administrators.
  participantHash: text("participant_hash"),
  deviceClass: text("device_class", { enum: ["desktop", "mobile", "unknown"] }).notNull().default("unknown"),
  source: text("source", { enum: ["start", "resume", "my_projects", "editor", "preview", "team", "invitation", "team_chat", "people", "messages", "community", "explore", "workspace", "submit", "unknown"] }),
  destination: text("destination", { enum: ["start", "resume", "my_projects", "editor", "preview", "team", "invitation", "team_chat", "people", "messages", "community", "explore", "workspace", "submit", "status", "ai_evals", "results", "unknown"] }),
  outcome: text("outcome", { enum: ["success", "failure", "guardrail", "viewed", "started", "abandoned"] }),
  reason: text("reason", { enum: ["readiness_incomplete", "validation", "stale_edit", "deadline", "frozen", "expired_invitation", "revoked_invitation", "wrong_account", "unauthorized", "rate_limited", "duplicate_retry", "invalid_token", "unknown"] }),
  context: text("context", { enum: ["start", "resume", "my_projects", "editor", "preview", "team", "invitation", "workspace", "people", "messages", "community", "team_chat", "explore", "submit", "unknown"] }),
  durationMs: integer("duration_ms"),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("participant_journey_events_event_time_idx").on(table.eventId, table.occurredAt),
  index("participant_journey_events_event_type_idx").on(table.eventId, table.eventType, table.occurredAt),
  index("participant_journey_events_participant_idx").on(table.eventId, table.participantHash, table.occurredAt),
  check("participant_journey_events_type_check", sql`${table.eventType} IN ('participant_start_viewed','participant_project_created','participant_project_resumed','participant_project_claim_started','participant_project_claim_completed','participant_project_claim_failed','participant_my_projects_viewed','participant_project_opened','participant_next_action_followed','participant_editor_viewed','participant_draft_saved','participant_save_validation_failed','participant_stale_edit_detected','participant_agent_instructions_revealed','participant_agent_handoff_copied','participant_agent_update_received','participant_agent_update_rejected','participant_returned_to_preview','participant_preview_viewed','participant_readiness_incomplete','participant_readiness_complete','participant_finalization_confirmation_opened','participant_finalization_attempted','participant_finalization_succeeded','participant_finalization_rejected','participant_receipt_viewed','participant_invitation_created','participant_invitation_accepted','participant_invitation_expired','participant_invitation_revoked','participant_invitation_wrong_account','participant_project_access_revoked','participant_people_viewed','participant_messages_viewed','participant_profile_viewed','participant_message_initiated','participant_dm_created','participant_community_opened','participant_community_channel_opened','participant_community_message_posted','participant_team_chat_opened','participant_team_chat_message_posted','participant_explore_opened','participant_navigation_destination_selected','participant_workspace_returned')`),
  check("participant_journey_events_device_check", sql`${table.deviceClass} IN ('desktop','mobile','unknown')`),
  check("participant_journey_events_source_check", sql`${table.source} IS NULL OR ${table.source} IN ('start','resume','my_projects','editor','preview','team','invitation','team_chat','people','messages','community','explore','workspace','submit','unknown')`),
  check("participant_journey_events_destination_check", sql`${table.destination} IS NULL OR ${table.destination} IN ('start','resume','my_projects','editor','preview','team','invitation','team_chat','people','messages','community','explore','workspace','submit','status','ai_evals','results','unknown')`),
  check("participant_journey_events_outcome_check", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('success','failure','guardrail','viewed','started','abandoned')`),
  check("participant_journey_events_reason_check", sql`${table.reason} IS NULL OR ${table.reason} IN ('readiness_incomplete','validation','stale_edit','deadline','frozen','expired_invitation','revoked_invitation','wrong_account','unauthorized','rate_limited','duplicate_retry','invalid_token','unknown')`),
  check("participant_journey_events_context_check", sql`${table.context} IS NULL OR ${table.context} IN ('start','resume','my_projects','editor','preview','team','invitation','workspace','people','messages','community','team_chat','explore','submit','unknown')`),
  check("participant_journey_events_participant_hash_check", sql`${table.participantHash} IS NULL OR (${table.participantHash} NOT GLOB '*[^0-9a-f]*' AND length(${table.participantHash}) BETWEEN 16 AND 64)`),
  check("participant_journey_events_duration_check", sql`${table.durationMs} IS NULL OR (${table.durationMs} >= 0 AND ${table.durationMs} <= 86400000)`),
]);

export const participantFeedback = sqliteTable("participant_feedback", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  participantHash: text("participant_hash"),
  category: text("category", { enum: ["confusing", "could_not_complete", "broken", "suggestion", "other"] }).notNull(),
  context: text("context", { enum: ["start", "resume", "my_projects", "editor", "preview", "team", "invitation", "workspace", "people", "messages", "community", "team_chat", "explore", "submit", "unknown"] }).notNull().default("unknown"),
  message: text("message").notNull(),
  status: text("status", { enum: ["new", "reviewed", "resolved", "dismissed"] }).notNull().default("new"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  index("participant_feedback_event_status_idx").on(table.eventId, table.status, table.createdAt),
  index("participant_feedback_event_time_idx").on(table.eventId, table.createdAt),
  check("participant_feedback_category_check", sql`${table.category} IN ('confusing','could_not_complete','broken','suggestion','other')`),
  check("participant_feedback_context_check", sql`${table.context} IN ('start','resume','my_projects','editor','preview','team','invitation','workspace','people','messages','community','team_chat','explore','submit','unknown')`),
  check("participant_feedback_participant_hash_check", sql`${table.participantHash} IS NULL OR (${table.participantHash} NOT GLOB '*[^0-9a-f]*' AND length(${table.participantHash}) BETWEEN 16 AND 64)`),
  check("participant_feedback_message_length_check", sql`length(trim(${table.message})) BETWEEN 1 AND 1000`),
  check("participant_feedback_status_check", sql`${table.status} IN ('new', 'reviewed', 'resolved', 'dismissed')`),
  check("participant_feedback_review_check", sql`(${table.status} = 'new' AND ${table.reviewedAt} IS NULL) OR (${table.status} <> 'new' AND ${table.reviewedAt} IS NOT NULL)`),
]);

// ── Results review and publication ────────────────────────────────────────
// Results are deliberately separate from score records. Scores remain the
// source of truth; these tables capture organizer decisions and publication
// state without rewriting judge evidence.
export const resultTieReviews = sqliteTable("result_tie_reviews", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  tieKey: text("tie_key").notNull(),
  status: text("status", { enum: ["pending", "resolved"] }).notNull().default("pending"),
  rationale: text("rationale"),
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("result_tie_reviews_event_key_unique").on(table.eventId, table.tieKey),
  index("result_tie_reviews_event_status_idx").on(table.eventId, table.status),
  check("result_tie_reviews_status_check", sql`${table.status} IN ('pending', 'resolved')`),
  check("result_tie_reviews_lifecycle_check", sql`(
    (${table.status} = 'pending' AND ${table.resolvedAt} IS NULL)
    OR (${table.status} = 'resolved' AND ${table.resolvedAt} IS NOT NULL)
  )`),
]);

export const resultTieReviewSubmissions = sqliteTable("result_tie_review_submissions", {
  id: text("id").primaryKey(),
  tieReviewId: text("tie_review_id").notNull().references(() => resultTieReviews.id, { onDelete: "cascade" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  score: real("score").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("result_tie_review_submissions_unique").on(table.tieReviewId, table.submissionId),
  index("result_tie_review_submissions_submission_idx").on(table.submissionId),
]);

export const resultFinalists = sqliteTable("result_finalists", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("result_finalists_active_unique").on(table.eventId, table.submissionId).where(sql`${table.status} = 'active'`),
  index("result_finalists_event_status_idx").on(table.eventId, table.status),
  check("result_finalists_status_check", sql`${table.status} IN ('active', 'removed')`),
]);

export const resultWinners = sqliteTable("result_winners", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  category: text("category", { enum: ["grand_prize", "runner_up", "honorable_mention", "custom"] }).notNull(),
  awardLabel: text("award_label"),
  status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("result_winners_active_category_unique").on(table.eventId, table.category).where(sql`${table.status} = 'active'`),
  uniqueIndex("result_winners_active_submission_category_unique").on(table.eventId, table.submissionId, table.category).where(sql`${table.status} = 'active'`),
  index("result_winners_event_status_idx").on(table.eventId, table.status),
  check("result_winners_category_check", sql`${table.category} IN ('grand_prize', 'runner_up', 'honorable_mention', 'custom')`),
  check("result_winners_status_check", sql`${table.status} IN ('active', 'removed')`),
  check("result_winners_custom_label_check", sql`(${table.category} = 'custom' AND ${table.awardLabel} IS NOT NULL) OR (${table.category} <> 'custom')`),
]);

export const resultPublicationStates = sqliteTable("result_publication_states", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["calculated", "reviewed", "published"] }).notNull().default("calculated"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("result_publication_states_event_unique").on(table.eventId),
  index("result_publication_states_status_idx").on(table.status),
  check("result_publication_states_status_check", sql`${table.status} IN ('calculated', 'reviewed', 'published')`),
  check("result_publication_states_published_at_check", sql`(${table.status} = 'published' AND ${table.publishedAt} IS NOT NULL) OR (${table.status} <> 'published' AND ${table.publishedAt} IS NULL)`),
]);

// ── Calibration and consensus (advisory) ───────────────────────────────────
// These records never mutate judge scores. They capture organizer review and
// event-specific detection thresholds alongside the immutable score evidence.
export const calibrationThresholds = sqliteTable("calibration_thresholds", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  overallVarianceThreshold: real("overall_variance_threshold").notNull().default(64),
  criterionVarianceThreshold: real("criterion_variance_threshold").notNull().default(4),
  outlierDifferenceThreshold: real("outlier_difference_threshold").notNull().default(20),
  minimumEvaluations: integer("minimum_evaluations").notNull().default(2),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("calibration_thresholds_event_unique").on(table.eventId),
  check("calibration_thresholds_values_check", sql`${table.overallVarianceThreshold} > 0 AND ${table.criterionVarianceThreshold} > 0 AND ${table.outlierDifferenceThreshold} > 0 AND ${table.minimumEvaluations} >= 2`),
]);

export const calibrationConsensusReviews = sqliteTable("calibration_consensus_reviews", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["in_review", "complete", "flagged"] }).notNull().default("in_review"),
  discussion: text("discussion"),
  flaggedReason: text("flagged_reason"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("calibration_consensus_reviews_event_submission_unique").on(table.eventId, table.submissionId),
  index("calibration_consensus_reviews_event_status_idx").on(table.eventId, table.status),
  check("calibration_consensus_reviews_status_check", sql`${table.status} IN ('in_review','complete','flagged')`),
  check("calibration_consensus_reviews_completion_check", sql`(${table.status} = 'complete' AND ${table.completedAt} IS NOT NULL) OR (${table.status} <> 'complete')`),
]);

// ── D.4 publication and participant feedback ───────────────────────────────
// Publication is deliberately separate from ranking and score evidence. A
// release is an explicit organizer decision; nothing becomes participant-visible
// merely because a score or winner exists.
export const publicationReleases = sqliteTable("publication_releases", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["calculated", "reviewed", "approved", "published", "archived"] }).notNull().default("calculated"),
  publicationMode: text("publication_mode", { enum: ["awards_only", "awards_feedback", "feedback_later", "everything"] }).notNull().default("awards_only"),
  showScores: integer("show_scores", { mode: "boolean" }).notNull().default(true),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_releases_event_unique").on(table.eventId),
  index("publication_releases_status_idx").on(table.status),
  check("publication_releases_status_check", sql`${table.status} IN ('calculated','reviewed','approved','published','archived')`),
  check("publication_releases_mode_check", sql`${table.publicationMode} IN ('awards_only','awards_feedback','feedback_later','everything')`),
]);

// D.4R is deliberately narrower than the event release. These rows are only
// active when the server-side qualification gate names an exact synthetic
// submission; they can never make the event globally published.
export const publicationQualificationReleases = sqliteTable("publication_qualification_releases", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  fixtureMarker: text("fixture_marker").notNull(),
  status: text("status", { enum: ["calculated", "reviewed", "approved", "published", "archived"] }).notNull().default("calculated"),
  publicationMode: text("publication_mode", { enum: ["awards_only", "awards_feedback", "feedback_later", "everything"] }).notNull().default("awards_only"),
  showScores: integer("show_scores", { mode: "boolean" }).notNull().default(true),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_qualification_releases_event_submission_unique").on(table.eventId, table.submissionId),
  index("publication_qualification_releases_status_idx").on(table.status),
  index("publication_qualification_releases_submission_idx").on(table.submissionId),
  check("publication_qualification_releases_marker_check", sql`${table.fixtureMarker} = 'd4-publication-qualification'`),
  check("publication_qualification_releases_status_check", sql`${table.status} IN ('calculated','reviewed','approved','published','archived')`),
  check("publication_qualification_releases_mode_check", sql`${table.publicationMode} IN ('awards_only','awards_feedback','feedback_later','everything')`),
]);

export const publicationQualificationRevisions = sqliteTable("publication_qualification_revisions", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => publicationQualificationReleases.id, { onDelete: "restrict" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  revision: integer("revision").notNull(),
  status: text("status", { enum: ["calculated", "reviewed", "approved", "published", "archived"] }).notNull(),
  publicationMode: text("publication_mode", { enum: ["awards_only", "awards_feedback", "feedback_later", "everything"] }).notNull(),
  showScores: integer("show_scores", { mode: "boolean" }).notNull(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_qualification_revisions_release_revision_unique").on(table.releaseId, table.revision),
  index("publication_qualification_revisions_submission_created_idx").on(table.submissionId, table.createdAt),
  check("publication_qualification_revisions_status_check", sql`${table.status} IN ('calculated','reviewed','approved','published','archived')`),
  check("publication_qualification_revisions_mode_check", sql`${table.publicationMode} IN ('awards_only','awards_feedback','feedback_later','everything')`),
]);

export const publicationQualificationAnnouncements = sqliteTable("publication_qualification_announcements", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  markdown: text("markdown"),
  status: text("status", { enum: ["draft", "published", "withdrawn"] }).notNull().default("draft"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_qualification_announcements_event_submission_unique").on(table.eventId, table.submissionId),
  index("publication_qualification_announcements_submission_idx").on(table.submissionId),
  check("publication_qualification_announcements_status_check", sql`${table.status} IN ('draft','published','withdrawn')`),
]);

export const publicationRevisions = sqliteTable("publication_revisions", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => publicationReleases.id, { onDelete: "restrict" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  revision: integer("revision").notNull(),
  status: text("status", { enum: ["calculated", "reviewed", "approved", "published", "archived"] }).notNull(),
  publicationMode: text("publication_mode", { enum: ["awards_only", "awards_feedback", "feedback_later", "everything"] }).notNull(),
  showScores: integer("show_scores", { mode: "boolean" }).notNull(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_revisions_release_revision_unique").on(table.releaseId, table.revision),
  index("publication_revisions_event_created_idx").on(table.eventId, table.createdAt),
  check("publication_revisions_status_check", sql`${table.status} IN ('calculated','reviewed','approved','published','archived')`),
  check("publication_revisions_mode_check", sql`${table.publicationMode} IN ('awards_only','awards_feedback','feedback_later','everything')`),
]);

export const publicationAwards = sqliteTable("publication_awards", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  category: text("category").notNull(),
  label: text("label").notNull(),
  status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_awards_active_category_unique").on(table.eventId, table.category).where(sql`${table.status} = 'active'`),
  uniqueIndex("publication_awards_active_submission_category_unique").on(table.eventId, table.submissionId, table.category).where(sql`${table.status} = 'active'`),
  index("publication_awards_event_status_idx").on(table.eventId, table.status),
  check("publication_awards_status_check", sql`${table.status} IN ('active','removed')`),
]);

export const publicationFeedback = sqliteTable("publication_feedback", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  administratorSummary: text("administrator_summary"),
  status: text("status", { enum: ["draft", "released", "withdrawn"] }).notNull().default("draft"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  releasedAt: integer("released_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_feedback_event_submission_unique").on(table.eventId, table.submissionId),
  index("publication_feedback_event_status_idx").on(table.eventId, table.status),
  check("publication_feedback_status_check", sql`${table.status} IN ('draft','released','withdrawn')`),
  check("publication_feedback_release_check", sql`(${table.status} = 'released' AND ${table.releasedAt} IS NOT NULL) OR (${table.status} <> 'released')`),
]);

export const publicationFeedbackComments = sqliteTable("publication_feedback_comments", {
  id: text("id").primaryKey(),
  feedbackId: text("feedback_id").notNull().references(() => publicationFeedback.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  status: text("status", { enum: ["draft", "released", "withdrawn"] }).notNull().default("draft"),
  sourceJudgeId: text("source_judge_id").references(() => judges.id, { onDelete: "set null" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  releasedAt: integer("released_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("publication_feedback_comments_feedback_idx").on(table.feedbackId),
  check("publication_feedback_comments_status_check", sql`${table.status} IN ('draft','released','withdrawn')`),
  check("publication_feedback_comments_release_check", sql`(${table.status} = 'released' AND ${table.releasedAt} IS NOT NULL) OR (${table.status} <> 'released')`),
]);

export const publicationAnnouncements = sqliteTable("publication_announcements", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  markdown: text("markdown"),
  status: text("status", { enum: ["draft", "published", "withdrawn"] }).notNull().default("draft"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  uniqueIndex("publication_announcements_event_unique").on(table.eventId),
  check("publication_announcements_status_check", sql`${table.status} IN ('draft','published','withdrawn')`),
]);
