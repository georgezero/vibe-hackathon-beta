import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "vibe-viby-link-migration-"));
  directories.push(directory);
  const databasePath = path.join(directory, "application.db");
  const source = new Database(databasePath);
  source.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
  source.close();
  return databasePath;
}

function migrate(databasePath: string, env: Record<string, string> = {}) {
  return execFileSync(
    path.join(process.cwd(), "node_modules", ".bin", "tsx"),
    ["scripts/migrate-viby-identity-links.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DB_FILE_NAME: databasePath, ...env },
      encoding: "utf8",
    },
  );
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Viby identity-link migration", () => {
  it("creates the additive schema and remains idempotent for an absolute disposable target", () => {
    const databasePath = fixture();
    expect(migrate(databasePath)).toContain('"integrity":"ok"');
    expect(migrate(databasePath)).toContain('"integrity":"ok"');

    const sqlite = new Database(databasePath, { readonly: true });
    expect(sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'viby_identity_links'",
    ).get()).toBeTruthy();
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    sqlite.close();
  });

  it("refuses production without the exact confirmation and leaves the database unchanged", () => {
    const databasePath = fixture();
    const beforePath = `${databasePath}.before`;
    copyFileSync(databasePath, beforePath);

    expect(() => migrate(databasePath, { NODE_ENV: "production" })).toThrow(
      /Production migration requires VIBE_IDENTITY_LINK_MIGRATION_CONFIRM/,
    );

    const before = new Database(beforePath, { readonly: true });
    const after = new Database(databasePath, { readonly: true });
    expect(after.prepare("SELECT name FROM sqlite_master ORDER BY name").all()).toEqual(
      before.prepare("SELECT name FROM sqlite_master ORDER BY name").all(),
    );
    before.close();
    after.close();
  });

  it("accepts only the exact production confirmation", () => {
    const databasePath = fixture();
    expect(() => migrate(databasePath, {
      NODE_ENV: "production",
      VIBE_IDENTITY_LINK_MIGRATION_CONFIRM: "yes",
    })).toThrow(/Production migration requires/);
    expect(migrate(databasePath, {
      NODE_ENV: "production",
      VIBE_IDENTITY_LINK_MIGRATION_CONFIRM: "CREATE_VIBY_IDENTITY_LINKS",
    })).toContain('"integrity":"ok"');
  });
});
