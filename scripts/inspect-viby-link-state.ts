import Database from "better-sqlite3";
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configured = process.env.DB_FILE_NAME?.trim();
const environment = process.env.VIBE_LINK_ENVIRONMENT?.trim();
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
if (!environment || new URL(environment).origin !== environment) {
  throw new Error("VIBE_LINK_ENVIRONMENT must be an exact URL origin.");
}
const requested = resolve(configured);
const stat = lstatSync(requested);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const target = realpathSync(requested);
if (target !== requested) throw new Error("DB_FILE_NAME must be canonical.");

const sqlite = new Database(target, { readonly: true, fileMustExist: true });
try {
  const rows = sqlite.prepare(`
    SELECT provider_id, subject_id, role, local_user_id, application_id, status,
           link_provenance, environment, binding_provenance, bound_at, revoked_at
    FROM viby_identity_links
  `).all() as Array<Record<string, unknown>>;
  const matching = rows.filter((row) => row.provider_id === "viby" && row.application_id === "vibe-hackathon");
  const boundActive = matching.filter((row) =>
    row.status === "active" && row.revoked_at === null && typeof row.local_user_id === "string").length;
  const claimable = matching.filter((row) =>
    row.status === "active"
    && row.revoked_at === null
    && row.local_user_id === null
    && row.role === "admin"
    && row.link_provenance === "operator"
    && row.binding_provenance === null
    && row.bound_at === null
    && (row.environment === null || row.environment === environment)).length;
  const revoked = matching.filter((row) => row.status === "revoked" || row.revoked_at !== null).length;
  const ambiguous = matching.length - boundActive - claimable - revoked;
  const conflictingUsers = Number((sqlite.prepare(`
    SELECT count(*) AS count FROM (
      SELECT local_user_id FROM viby_identity_links
      WHERE application_id='vibe-hackathon' AND local_user_id IS NOT NULL
      GROUP BY local_user_id HAVING count(*) > 1
    )
  `).get() as { count: number }).count);
  const activeAdminGrants = Number((sqlite.prepare(
    "SELECT count(*) AS count FROM admin_authorizations WHERE status='active'",
  ).get() as { count: number }).count);
  console.log(JSON.stringify({
    database: target,
    environment,
    boundActive,
    claimableUnboundLegacy: claimable,
    revoked,
    ambiguous,
    conflictingUsers,
    activeAdminGrants,
  }));
} finally {
  sqlite.close();
}
