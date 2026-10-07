import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import {
  accessSync,
  constants,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { nanoid } from "nanoid";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

function validatedDatabasePath(configured: string | undefined) {
  if (process.env.DATABASE_URL?.trim()) {
    throw new Error("Remote DATABASE_URL provisioning is not supported.");
  }
  if (!configured || !isAbsolute(configured)) {
    throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  }
  const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
  const requested = resolve(configured);
  if (requested === protectedBackup) {
    throw new Error("The protected pre-P0.4 backup cannot be provisioned.");
  }
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Target must be an existing regular, non-symlink file.");
  }
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) {
    throw new Error("Target must be its canonical non-protected path.");
  }
  return canonical;
}

function readPassword(path: string | undefined) {
  if (!path || !isAbsolute(path)) {
    throw new Error("--password-file must be an absolute path.");
  }
  const stat = lstatSync(path);
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || (stat.mode & 0o077) !== 0
    || stat.uid !== process.getuid?.()
  ) {
    throw new Error(
      "Password file must be operator-owned, regular, non-symlink, and mode 0600 or stricter.",
    );
  }
  const password = readFileSync(path, "utf8").replace(/\r?\n$/, "");
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must contain 8 through 128 characters.");
  }
  return password;
}

async function main() {
  const database = validatedDatabasePath(process.env.DB_FILE_NAME?.trim());
  const userId = argument("--user-id");
  const name = argument("--name");
  const email = argument("--email")?.toLowerCase();
  const password = readPassword(argument("--password-file"));
  if (!userId || !/^[A-Za-z0-9_-]{3,128}$/.test(userId)) {
    throw new Error("An explicit safe --user-id is required.");
  }
  if (!name) throw new Error("--name is required.");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("A valid exact --email is required.");
  }
  const expected = `PROVISION_PASSWORD_USER:${database}:${userId}:${email}`;
  if (process.env.VIBE_PASSWORD_USER_PROVISION_CONFIRM !== expected) {
    throw new Error("Confirmation is required for the exact database, user ID, and email.");
  }

  const passwordHash = await hashPassword(password);
  const sqlite = new Database(database);
  sqlite.pragma("foreign_keys = ON");
  try {
    const result = sqlite.transaction(() => {
      for (const table of ["users", "accounts"]) {
        if (!sqlite.prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        ).get(table)) {
          throw new Error(`Target is missing required Better Auth table: ${table}.`);
        }
      }
      const byId = sqlite.prepare(
        "SELECT id, name, email FROM users WHERE id=?",
      ).get(userId) as { id: string; name: string; email: string } | undefined;
      const byEmail = sqlite.prepare(
        "SELECT id FROM users WHERE lower(email)=?",
      ).all(email) as Array<{ id: string }>;
      if (byEmail.some((row) => row.id !== userId)) {
        throw new Error("The normalized email is already owned by another user.");
      }
      if (
        byId
        && (
          byId.email.toLowerCase() !== email
          || byId.name !== name
        )
      ) {
        throw new Error("The explicit user ID already has conflicting identity data.");
      }

      const now = Math.floor(Date.now() / 1000);
      let userResult: "created" | "retained" = "retained";
      if (!byId) {
        sqlite.prepare(`
          INSERT INTO users
            (id, name, email, email_verified, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?)
        `).run(userId, name, email, now, now);
        userResult = "created";
      }

      const credentials = sqlite.prepare(
        "SELECT id, account_id accountId, password FROM accounts WHERE user_id=? AND provider_id='credential'",
      ).all(userId) as Array<{
        id: string;
        accountId: string;
        password: string | null;
      }>;
      if (credentials.length > 1) {
        throw new Error("The Better Auth credential state is ambiguous.");
      }
      if (
        credentials[0]
        && (
          credentials[0].accountId !== userId
          || !credentials[0].password
        )
      ) {
        throw new Error("The existing Better Auth credential is incomplete.");
      }
      let credentialResult: "created" | "retained" = "retained";
      if (!credentials.length) {
        sqlite.prepare(`
          INSERT INTO accounts
            (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (?, ?, 'credential', ?, ?, ?, ?)
        `).run(nanoid(), userId, userId, passwordHash, now, now);
        credentialResult = "created";
      }

      return {
        userId,
        email,
        userResult,
        credentialResult,
        authorizationCreated: false,
      };
    })();
    console.log(JSON.stringify(result));
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Password user provisioning failed.",
  );
  process.exitCode = 1;
});
