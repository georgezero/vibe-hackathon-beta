import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

describe("role-neutral Better Auth password-user provisioning", () => {
  it("creates a complete credential account without creating a role", async () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-password-user-"));
    const database = join(directory, "application.db");
    const passwordFile = join(directory, "password");
    writeFileSync(passwordFile, "qualified-password-value\n", { mode: 0o600 });
    chmodSync(passwordFile, 0o600);
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at INTEGER,
        refresh_token_expires_at INTEGER,
        scope TEXT,
        password TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE admin_authorizations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL
      );
      CREATE TABLE judge_authorizations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL
      );
    `);
    sqlite.close();

    const environment = {
      ...process.env,
      DB_FILE_NAME: database,
      DATABASE_URL: "",
      VIBE_PASSWORD_USER_PROVISION_CONFIRM:
        `PROVISION_PASSWORD_USER:${database}:judge_user_ada:judgeada@example.test`,
    };
    const args = [
      "tsx",
      "scripts/provision-password-user.ts",
      "--user-id",
      "judge_user_ada",
      "--name",
      "Ada Judge",
      "--email",
      "judgeada@example.test",
      "--password-file",
      passwordFile,
    ];
    const first = JSON.parse(execFileSync("npx", args, {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    }));
    const second = JSON.parse(execFileSync("npx", args, {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    }));

    expect(first).toMatchObject({
      userId: "judge_user_ada",
      userResult: "created",
      credentialResult: "created",
      authorizationCreated: false,
    });
    expect(second).toMatchObject({
      userResult: "retained",
      credentialResult: "retained",
      authorizationCreated: false,
    });

    const validation = new Database(database, {
      readonly: true,
      fileMustExist: true,
    });
    const account = validation.prepare(
      "SELECT password FROM accounts WHERE user_id='judge_user_ada'",
    ).get() as { password: string };
    expect(await verifyPassword({
      hash: account.password,
      password: "qualified-password-value",
    })).toBe(true);
    expect(validation.prepare(
      "SELECT count(*) count FROM admin_authorizations",
    ).get()).toEqual({ count: 0 });
    expect(validation.prepare(
      "SELECT count(*) count FROM judge_authorizations",
    ).get()).toEqual({ count: 0 });
    validation.close();
  });

  it("requires exact confirmation and refuses conflicting email ownership", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-password-user-reject-"));
    const database = join(directory, "application.db");
    const passwordFile = join(directory, "password");
    writeFileSync(passwordFile, "qualified-password-value\n", { mode: 0o600 });
    chmodSync(passwordFile, 0o600);
    const sqlite = new Database(database);
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL, image TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id), password TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      INSERT INTO users VALUES
        ('other-user','Other','judgeada@example.test',1,NULL,1,1);
    `);
    sqlite.close();

    expect(() => execFileSync("npx", [
      "tsx",
      "scripts/provision-password-user.ts",
      "--user-id",
      "judge_user_ada",
      "--name",
      "Ada Judge",
      "--email",
      "judgeada@example.test",
      "--password-file",
      passwordFile,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DB_FILE_NAME: database,
        DATABASE_URL: "",
        VIBE_PASSWORD_USER_PROVISION_CONFIRM:
          `PROVISION_PASSWORD_USER:${database}:judge_user_ada:judgeada@example.test`,
      },
      stdio: "pipe",
    })).toThrow();
  });
});
