import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { lstatSync, readFileSync } from "fs";
import { isAbsolute, resolve } from "path";
import { nanoid } from "nanoid";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
const databasePath = process.env.DB_FILE_NAME?.trim();
const email = argument("--email")?.toLowerCase();
const name = argument("--name");
const passwordFile = argument("--password-file");
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote DATABASE_URL provisioning is not supported.");
if (!databasePath || !isAbsolute(databasePath)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid exact --email is required.");
if (!name) throw new Error("--name is required.");
if (!passwordFile || !isAbsolute(passwordFile)) throw new Error("--password-file must be an absolute path.");
const passwordStat = lstatSync(passwordFile);
if (!passwordStat.isFile() || passwordStat.isSymbolicLink() || (passwordStat.mode & 0o077) !== 0) {
  throw new Error("Password file must be a regular, non-symlink file with mode 0600 or stricter.");
}
if (passwordStat.uid !== process.getuid?.()) throw new Error("Password file must be owned by the current operator.");
const password = readFileSync(passwordFile, "utf8").replace(/\r?\n$/, "");
if (password.length < 8 || password.length > 128) throw new Error("Password must contain 8 through 128 characters.");
const target = resolve(databasePath);
const expected = `PROVISION_PASSWORD_ADMIN:${target}:${email}`;
if (process.env.VIBE_ADMIN_PROVISION_CONFIRM !== expected) {
  throw new Error(`Confirmation required for the exact target and normalized email.`);
}
const passwordHash = await hashPassword(password);
const sqlite = new Database(target);
try {
  const result = sqlite.transaction(() => {
    const matches = sqlite.prepare("SELECT id, name FROM users WHERE lower(email) = ?").all(email) as Array<{ id: string; name: string | null }>;
    if (matches.length > 1) throw new Error("Ambiguous normalized email match.");
    const now = Math.floor(Date.now() / 1000);
    const userId = matches[0]?.id ?? nanoid();
    let userResult: "created" | "retained" = "retained";
    if (!matches.length) {
      sqlite.prepare(`
        INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(userId, name, email, now, now);
      userResult = "created";
    }
    const credential = sqlite.prepare(
      "SELECT id FROM accounts WHERE user_id = ? AND provider_id = 'credential'",
    ).get(userId);
    let credentialResult: "created" | "retained" = "retained";
    if (!credential) {
      sqlite.prepare(`
        INSERT INTO accounts
          (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
      `).run(nanoid(), userId, userId, passwordHash, now, now);
      credentialResult = "created";
    }
    const grant = sqlite.prepare(
      "SELECT status, revoked_at FROM admin_authorizations WHERE user_id = ?",
    ).get(userId) as { status: string; revoked_at: number | null } | undefined;
    if (grant && (grant.status !== "active" || grant.revoked_at !== null)) {
      throw new Error("A revoked or conflicting authorization exists; refusing implicit reactivation.");
    }
    let authorizationResult: "created" | "retained" = "retained";
    if (!grant) {
      sqlite.prepare(`
        INSERT INTO admin_authorizations
          (id, user_id, status, grant_source, created_at, updated_at)
        VALUES (?, ?, 'active', 'operator', ?, ?)
      `).run(nanoid(), userId, now, now);
      authorizationResult = "created";
    }
    return { userId, userResult, credentialResult, authorizationResult };
  })();
  console.log(JSON.stringify(result));
} finally {
  sqlite.close();
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator provisioning failed.");
  process.exitCode = 1;
});
