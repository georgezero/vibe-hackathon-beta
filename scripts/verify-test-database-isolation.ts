import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const repository = process.cwd();
const canonical = join(repository, "local.db");
const tsx = join(
  repository,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);
const probe = join(repository, "scripts", "test-database-write-probe.ts");
const checksum = () =>
  createHash("sha256").update(readFileSync(canonical)).digest("hex");
const canonicalBefore = checksum();

const unsafeEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
};
delete unsafeEnvironment.DB_FILE_NAME;
delete unsafeEnvironment.VIBE_TEST_DATABASE_ROOT;
delete unsafeEnvironment.DATABASE_URL;
delete unsafeEnvironment.DATABASE_AUTH_TOKEN;
const unsafe = spawnSync(tsx, [probe], {
  cwd: repository,
  env: unsafeEnvironment,
  encoding: "utf8",
});
if (unsafe.status === 0) {
  throw new Error("Isolation probe unexpectedly accepted missing test database configuration.");
}
if (!`${unsafe.stdout}\n${unsafe.stderr}`.includes("Test database isolation")) {
  throw new Error("Isolation probe failed for an unexpected reason.");
}

const disposableRoot = mkdtempSync(join(tmpdir(), "vibe-test-isolation-proof-"));
try {
  const databasePath = join(disposableRoot, "probe.db");
  const safeEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DB_FILE_NAME: databasePath,
    VIBE_TEST_DATABASE_ROOT: disposableRoot,
  };
  delete safeEnvironment.DATABASE_URL;
  delete safeEnvironment.DATABASE_AUTH_TOKEN;
  const safe = spawnSync(tsx, [probe], {
    cwd: repository,
    env: safeEnvironment,
    encoding: "utf8",
  });
  if (safe.status !== 0) {
    throw new Error(`Disposable isolation probe failed:\n${safe.stdout}\n${safe.stderr}`);
  }
  const disposable = new Database(databasePath, { readonly: true });
  const auditCount = disposable
    .prepare("SELECT count(*) AS count FROM audit_events")
    .get() as { count: number };
  disposable.close();
  if (auditCount.count !== 1) {
    throw new Error(`Expected one audit row in disposable database; found ${auditCount.count}.`);
  }
} finally {
  rmSync(disposableRoot, { recursive: true, force: true });
}

const canonicalAfter = checksum();
if (canonicalAfter !== canonicalBefore) {
  throw new Error("Canonical database checksum changed during the isolation proof.");
}

console.log(
  JSON.stringify({
    missingConfiguration: "rejected",
    disposableAuditRows: 1,
    canonicalDatabase: "unchanged",
  }),
);
