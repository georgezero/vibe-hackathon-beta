import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { nanoid } from "nanoid";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const action = argument("--action");
const subject = argument("--subject");
const userId = argument("--user-id");
const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote link administration is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute path.");
if (!subject || !/^[A-Za-z0-9@._:-]{2,200}$/.test(subject)) throw new Error("An exact valid --subject is required.");
if (action !== "link" && action !== "revoke") throw new Error("--action must be link or revoke.");
if (action === "link" && !userId) throw new Error("--user-id is required when linking.");
const requested = resolve(configured);
if (requested === resolve(process.cwd(), "local.db.pre-p0-4.bak")) throw new Error("The protected backup is excluded.");
const stat = lstatSync(requested);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular file.");
accessSync(requested, constants.R_OK | constants.W_OK);
const target = realpathSync(requested);
if (target !== requested) throw new Error("DB_FILE_NAME must be canonical.");
const expected = `${action === "link" ? "LINK" : "REVOKE"} VIBY ADMIN ${subject}${userId ? ` TO ${userId}` : ""} IN ${target}`;
if (process.env.VIBE_IDENTITY_LINK_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  const now = Math.floor(Date.now() / 1000);
  const result = sqlite.transaction(() => {
    const existing = sqlite.prepare(`
      SELECT id, local_user_id, status, revoked_at FROM viby_identity_links
      WHERE application_id='vibe-hackathon' AND subject_id=?
    `).get(subject) as { id: string; local_user_id: string | null; status: string; revoked_at: number | null } | undefined;
    if (action === "revoke") {
      if (!existing) return { action, result: "not_found", subject };
      if (existing.status === "revoked") return { action, result: "retained", subject };
      sqlite.prepare("UPDATE viby_identity_links SET status='revoked', revoked_at=?, updated_at=? WHERE id=?")
        .run(now, now, existing.id);
      return { action, result: "revoked", subject };
    }
    const user = sqlite.prepare("SELECT id FROM users WHERE id=?").get(userId);
    if (!user) throw new Error("The exact Better Auth user ID does not exist.");
    if (existing) {
      if (existing.local_user_id === userId && existing.status === "active" && existing.revoked_at === null) {
        return { action, result: "retained", subject, userId };
      }
      throw new Error("A conflicting or revoked subject link exists; refusing implicit replacement or reactivation.");
    }
    const userConflict = sqlite.prepare(`
      SELECT subject_id FROM viby_identity_links
      WHERE application_id='vibe-hackathon' AND local_user_id=?
    `).get(userId);
    if (userConflict) throw new Error("The Better Auth user already has a Viby link.");
    sqlite.prepare(`
      INSERT INTO viby_identity_links
        (id, provider_id, subject_id, role, local_user_id, application_id, status,
         link_provenance, display_name, last_verified_at, created_at, updated_at)
      VALUES (?, 'viby', ?, 'admin', ?, 'vibe-hackathon', 'active',
              'operator', 'Linked Viby identity', ?, ?, ?)
    `).run(nanoid(), subject, userId, now, now, now);
    return { action, result: "created", subject, userId };
  })();
  console.log(JSON.stringify(result));
} finally {
  sqlite.close();
}
