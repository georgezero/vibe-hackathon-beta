import { execFileSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  openSync,
  closeSync,
  realpathSync,
  readFileSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { canonicalMigrationPaths } from "./migrations/index";

const cwd = process.cwd();
const protectedBackup = resolve(cwd, "local.db.pre-p0-4.bak");
const expectedUpgradeConfirmation = (target: string) => `MIGRATE ALL DATABASE ${target}`;
const expectedBootstrapConfirmation = (target: string) => `CREATE CURRENT SCHEMA DATABASE ${target}`;
const requiredBaselineTables = ["users", "sessions", "accounts", "events", "submissions"];

function fail(message: string): never {
  throw new Error(`Canonical database migration refused: ${message}`);
}

function targetPath({ allowCreate }: { allowCreate: boolean }) {
  if (process.env.DATABASE_URL?.trim()) fail("DATABASE_URL targets are not supported.");
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) {
    fail("DB_FILE_NAME must be an explicit absolute SQLite path.");
  }

  const requested = resolve(configured);
  if (requested === protectedBackup) fail("the protected pre-P0.4 backup cannot be migrated.");

  if (!existsSync(requested)) {
    if (!allowCreate) fail("the target does not exist; pass --bootstrap for a new database.");
    if (!existsSync(resolve(requested, ".."))) fail("the target parent directory does not exist.");
    closeSync(openSync(requested, "a", 0o600));
  }

  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) fail("the target must be an existing regular, non-symlink file.");
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) fail("the target must be its canonical non-protected path.");
  return canonical;
}

function schemaTables() {
  const schema = readFileSync(resolve(cwd, "lib/db/schema.ts"), "utf8");
  return [...schema.matchAll(/sqliteTable\("([^"]+)"/g)].map((match) => match[1]);
}

function inspectDatabase(target: string) {
  const sqlite = new Database(target, { fileMustExist: true, readonly: true });
  try {
    sqlite.pragma("foreign_keys = ON");
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((row) => row.name);
    const expectedTables = schemaTables();
    const missing = expectedTables.filter((table) => !tableNames.includes(table));
    if (missing.length) fail(`schema is missing expected tables: ${missing.join(", ")}`);
    const foreignKeys = sqlite.pragma("foreign_key_check") as unknown[];
    if (foreignKeys.length) fail("foreign-key check failed after migration.");
    const integrityRows = sqlite.pragma("integrity_check") as Array<{ integrity_check?: string }>;
    const integrity = integrityRows.map((row) => row.integrity_check ?? "unknown");
    if (integrity.length !== 1 || integrity[0] !== "ok") fail(`integrity check failed: ${integrity.join(", ")}`);
    return { tableCount: tableNames.length, expectedTableCount: expectedTables.length, foreignKeyCheck: "passed", integrity: "ok" };
  } finally {
    sqlite.close();
  }
}

function hasTables(target: string) {
  const sqlite = new Database(target, { fileMustExist: true, readonly: true });
  try {
    return (sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as { count: number }).count > 0;
  } finally {
    sqlite.close();
  }
}

function requireBaseline(target: string) {
  const sqlite = new Database(target, { fileMustExist: true, readonly: true });
  try {
    const missing = requiredBaselineTables.filter((table) => !sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
    if (missing.length) fail(`existing database is not a recognized application baseline; missing ${missing.join(", ")}`);
  } finally {
    sqlite.close();
  }
}

function runFreshBootstrap(target: string) {
  const expected = expectedBootstrapConfirmation(target);
  if (process.env.VIBE_DB_BOOTSTRAP_CONFIRM !== expected) {
    fail(`bootstrap confirmation is required: ${JSON.stringify(expected)}`);
  }
  const drizzleKit = resolve(cwd, "node_modules/.bin/drizzle-kit");
  if (!existsSync(drizzleKit)) fail("drizzle-kit executable is missing; install the committed lockfile first.");
  execFileSync(drizzleKit, ["push", "--config", "drizzle.config.ts"], {
    cwd,
    env: { ...process.env, DB_FILE_NAME: target, DATABASE_URL: "" },
    stdio: "inherit",
  });
}

function runUpgrade(target: string) {
  const expected = expectedUpgradeConfirmation(target);
  if (process.env.VIBE_DB_MIGRATION_CONFIRM !== expected) {
    fail(`upgrade confirmation is required: ${JSON.stringify(expected)}`);
  }
  requireBaseline(target);
  const tsx = resolve(cwd, "node_modules/.bin/tsx");
  if (!existsSync(tsx)) fail("tsx executable is missing; install the committed lockfile first.");
  for (const migration of canonicalMigrationPaths(cwd)) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "",
      DB_FILE_NAME: target,
      ...(migration.confirmationEnv ? { [migration.confirmationEnv]: migration.confirmation(target) } : {}),
    };
    execFileSync(tsx, [migration.absoluteScript], { cwd, env, stdio: "inherit" });
  }
}

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => arg !== "--bootstrap");
if (unknown.length) fail(`unknown argument(s): ${unknown.join(", ")}`);
const bootstrap = args.has("--bootstrap");
const target = targetPath({ allowCreate: bootstrap });
const existingTables = hasTables(target);

if (bootstrap) {
  if (existingTables) fail("--bootstrap is only valid for an empty SQLite database.");
  runFreshBootstrap(target);
} else {
  if (!existingTables) fail("the database is empty; pass --bootstrap with an explicit bootstrap confirmation.");
  runUpgrade(target);
}

console.log(JSON.stringify({
  database: target,
  mode: bootstrap ? "fresh-bootstrap" : "ordered-upgrade",
  migrationCount: bootstrap ? 0 : canonicalMigrationPaths(cwd).length,
  ...inspectDatabase(target),
}));
