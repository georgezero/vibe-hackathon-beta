import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
const expectedColumns = [
  "id", "user_id", "handle", "display_name", "headline", "bio", "affiliation",
  "degrees", "website_url", "github_url", "linkedin_url", "interests", "visibility", "discoverable",
  "deactivated_at", "created_at", "updated_at",
];

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) throw new Error("Remote DATABASE_URL migration is not supported.");
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  const requested = resolve(configured);
  if (requested === protectedBackup) throw new Error("The protected pre-P0.4 backup cannot be migrated.");
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) throw new Error("Target must be its canonical non-protected path.");
  return canonical;
}

function tableExists(sqlite: Database.Database, name: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function validate(sqlite: Database.Database) {
  const columns = (sqlite.prepare("PRAGMA table_info(user_profiles)").all() as Array<{ name: string }>).map((column) => column.name);
  const expectedWithoutDiscovery = expectedColumns.filter((column) => column !== "discoverable");
  const sameOrder = columns.length === expectedColumns.length && columns.every((column, index) => column === expectedColumns[index]);
  // ALTER TABLE appends the new preference on legacy F.0A tables. Accept that
  // additive order while keeping the fresh-table contract deterministic.
  const appendedLegacyOrder = columns.length === expectedColumns.length
    && columns[columns.length - 1] === "discoverable"
    && columns.slice(0, -1).every((column, index) => column === expectedWithoutDiscovery[index]);
  if (!sameOrder && !appendedLegacyOrder) {
    throw new Error("user_profiles has an incompatible column set.");
  }

  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_list(user_profiles)").all() as Array<{ from: string; table: string; to: string; on_delete: string }>;
  if (!foreignKeys.some((foreignKey) => foreignKey.from === "user_id" && foreignKey.table === "users" && foreignKey.to === "id" && foreignKey.on_delete === "RESTRICT")) {
    throw new Error("user_profiles.user_id must reference users(id) with ON DELETE RESTRICT.");
  }

  const sql = String((sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_profiles'").get() as { sql: string }).sql)
    .replace(/["`]/g, "")
    .replace(/user_profiles\./g, "")
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ",")
    .toLowerCase();
  for (const fragment of [
    "visibility in ('private', 'public')",
    "display_name is null or length(trim(display_name)) between 2 and 100",
    "length(handle) between 3 and 30",
    "handle not glob '*[^a-z0-9-]*'",
    "handle not like '%--%'",
  ]) {
    if (!sql.includes(fragment.replace(/,\s*/g, ","))) throw new Error(`user_profiles constraint is missing: ${fragment}.`);
  }

  const indexNames = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='user_profiles' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
  for (const index of ["user_profiles_handle_unique", "user_profiles_user_unique", "user_profiles_visibility_idx", "user_profiles_discovery_idx"]) {
    if (!indexNames.includes(index)) throw new Error(`user_profiles index is missing: ${index}.`);
  }
  const handleIndex = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='user_profiles_handle_unique'").get() as { sql: string } | undefined;
  const handleIndexSql = handleIndex?.sql
    ?.replace(/["`]/g, "")
    .replace(/user_profiles\./g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!handleIndexSql?.includes("where handle is not null")) throw new Error("user_profiles handle index must permit nullable handles and enforce non-null uniqueness.");
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
}

const target = targetPath();
const expectedConfirmation = `MIGRATE USER PROFILES DATABASE ${target}`;
if (process.env.VIBE_USER_PROFILES_MIGRATION_CONFIRM !== expectedConfirmation) {
  throw new Error(`Confirmation required: ${JSON.stringify(expectedConfirmation)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  if (!tableExists(sqlite, "users")) throw new Error("Target is missing required application table: users.");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        handle TEXT,
        display_name TEXT,
        headline TEXT,
        bio TEXT,
        affiliation TEXT,
        degrees TEXT,
        website_url TEXT,
        github_url TEXT,
        linkedin_url TEXT,
        interests TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        discoverable INTEGER NOT NULL DEFAULT 0,
        deactivated_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT user_profiles_visibility_check CHECK (visibility IN ('private', 'public')),
        CONSTRAINT user_profiles_display_name_length_check CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 2 AND 100),
        CONSTRAINT user_profiles_handle_format_check CHECK (
          handle IS NULL OR (
            length(handle) BETWEEN 3 AND 30
            AND handle NOT GLOB '*[^a-z0-9-]*'
            AND handle NOT GLOB '-*'
            AND handle NOT GLOB '*-'
            AND handle NOT LIKE '%--%'
          )
        ),
        CONSTRAINT user_profiles_headline_length_check CHECK (headline IS NULL OR length(headline) <= 160),
        CONSTRAINT user_profiles_bio_length_check CHECK (bio IS NULL OR length(bio) <= 2000),
        CONSTRAINT user_profiles_affiliation_length_check CHECK (affiliation IS NULL OR length(affiliation) <= 160),
        CONSTRAINT user_profiles_degrees_length_check CHECK (degrees IS NULL OR length(degrees) <= 120)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_unique ON user_profiles(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_handle_unique ON user_profiles(handle) WHERE handle IS NOT NULL;
      CREATE INDEX IF NOT EXISTS user_profiles_visibility_idx ON user_profiles(visibility);
    `);
    const columns = (sqlite.prepare("PRAGMA table_info(user_profiles)").all() as Array<{ name: string }>).map((column) => column.name);
    if (!columns.includes("discoverable")) {
      sqlite.exec("ALTER TABLE user_profiles ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 0;");
    }
    sqlite.exec("CREATE INDEX IF NOT EXISTS user_profiles_discovery_idx ON user_profiles(visibility, discoverable);");
    validate(sqlite);
  })();
  const profiles = Number((sqlite.prepare("SELECT count(*) AS count FROM user_profiles").get() as { count: number }).count);
  console.log(JSON.stringify({ database: target, profiles, automaticRowsCreated: 0, idempotent: true, foreignKeyCheck: "passed" }));
} finally {
  sqlite.close();
}
