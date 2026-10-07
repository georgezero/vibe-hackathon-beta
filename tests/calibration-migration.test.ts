import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("calibration migration", () => {
  it("creates thresholds idempotently for every event", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-calibration-"));
    const file = join(dir, "db.sqlite");
    const sqlite = new Database(file);
    sqlite.exec("CREATE TABLE events (id TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE submissions (id TEXT PRIMARY KEY);");
    sqlite.exec("INSERT INTO events VALUES ('evt_test')");
    sqlite.close();
    const env = { ...process.env, DB_FILE_NAME: file, VIBE_D3_MIGRATION_CONFIRM: `MIGRATE CALIBRATION DATABASE ${file}` };
    execFileSync("npx", ["tsx", "scripts/migrate-calibration.ts"], { env, stdio: "pipe" });
    execFileSync("npx", ["tsx", "scripts/migrate-calibration.ts"], { env, stdio: "pipe" });
    const check = new Database(file, { readonly: true });
    expect(check.prepare("SELECT count(*) AS count FROM calibration_thresholds").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) AS count FROM calibration_consensus_reviews").get()).toEqual({ count: 0 });
    check.close();
  });
});
