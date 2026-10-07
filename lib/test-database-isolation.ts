import { isAbsolute, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

export const TEST_DATABASE_ROOT_ENV = "VIBE_TEST_DATABASE_ROOT";

export function assertTestDatabaseIsolation(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
) {
  if (env.NODE_ENV !== "test") return;

  if (env.DATABASE_URL?.trim()) {
    throw new Error(
      "Test database isolation: DATABASE_URL must be unset; tests may only use an explicit disposable SQLite database.",
    );
  }

  const configuredDatabase = env.DB_FILE_NAME?.trim();
  const configuredRoot = env[TEST_DATABASE_ROOT_ENV]?.trim();
  if (!configuredDatabase || !configuredRoot) {
    throw new Error(
      `Test database isolation: DB_FILE_NAME and ${TEST_DATABASE_ROOT_ENV} are required.`,
    );
  }
  if (!isAbsolute(configuredDatabase) || !isAbsolute(configuredRoot)) {
    throw new Error(
      "Test database isolation: the database and disposable root must be absolute paths.",
    );
  }

  const databasePath = resolve(configuredDatabase);
  const disposableRoot = resolve(configuredRoot);
  const temporaryRoot = resolve(tmpdir());
  const databaseRelativeToRoot = relative(disposableRoot, databasePath);
  const rootRelativeToTmp = relative(temporaryRoot, disposableRoot);

  if (
    !databaseRelativeToRoot
    || databaseRelativeToRoot === ".."
    || databaseRelativeToRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(databaseRelativeToRoot)
  ) {
    throw new Error(
      "Test database isolation: DB_FILE_NAME must be a child of the configured disposable root.",
    );
  }
  if (
    rootRelativeToTmp === ".."
    || rootRelativeToTmp.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(rootRelativeToTmp)
  ) {
    throw new Error(
      "Test database isolation: the disposable root must be inside the operating-system temporary directory.",
    );
  }

  const canonicalDatabase = resolve(cwd, "local.db");
  const protectedBackup = resolve(cwd, "local.db.pre-p0-4.bak");
  if (databasePath === canonicalDatabase || databasePath === protectedBackup) {
    throw new Error(
      "Test database isolation: canonical and protected database paths are forbidden.",
    );
  }
}
