import Database from "better-sqlite3";
import { isAbsolute, resolve } from "path";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const configured = process.env.DB_FILE_NAME?.trim();
const email = argument("--email")?.toLowerCase();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote DATABASE_URL revocation is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
if (!email) throw new Error("An exact --email is required.");
const target = resolve(configured);
if (process.env.VIBE_ADMIN_REVOKE_CONFIRM !== `REVOKE_PASSWORD_ADMIN:${target}:${email}`) {
  throw new Error("Confirmation required for the exact target and normalized email.");
}
const sqlite = new Database(target);
try {
  const result = sqlite.transaction(() => {
    const users = sqlite.prepare("SELECT id FROM users WHERE lower(email) = ?").all(email) as Array<{ id: string }>;
    if (users.length !== 1) throw new Error("Expected exactly one normalized user match.");
    const now = Math.floor(Date.now() / 1000);
    const update = sqlite.prepare(`
      UPDATE admin_authorizations
      SET status = 'revoked', revoked_at = ?, updated_at = ?
      WHERE user_id = ? AND status = 'active' AND revoked_at IS NULL
    `).run(now, now, users[0].id);
    return update.changes ? "revoked" : "already-revoked-or-not-authorized";
  })();
  console.log(JSON.stringify({ result }));
} finally {
  sqlite.close();
}
