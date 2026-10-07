import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const disposableRoot = mkdtempSync(join(tmpdir(), "vibe-hackathon-vitest-"));
const executable = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

try {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DB_FILE_NAME: join(disposableRoot, "vitest.db"),
    VIBE_TEST_DATABASE_ROOT: disposableRoot,
    TMPDIR: disposableRoot,
    TMP: disposableRoot,
    TEMP: disposableRoot,
  };
  delete env.DATABASE_URL;
  delete env.DATABASE_AUTH_TOKEN;

  const result = spawnSync(executable, ["run", ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(disposableRoot, { recursive: true, force: true });
}
