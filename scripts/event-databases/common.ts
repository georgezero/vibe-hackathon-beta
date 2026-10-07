import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, closeSync, chmodSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const SNAPSHOT_DIR = resolve(process.env.VIBE_EVENT_DATABASE_DIR?.trim() || "/opt/vibe-hackathon/database-snapshots");
export const CANONICAL_DB = resolve(process.env.DB_FILE_NAME?.trim() || join(process.cwd(), "local.db"));

export function ensureDir(path: string) { mkdirSync(path, { recursive: true, mode: 0o700 }); }
export function sha256(path: string) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
export function modeString(mode: number) { return `0${(mode & 0o777).toString(8).padStart(3, "0")}`; }
export function assertRegular(path: string, allowMissing = false) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) { if (allowMissing) return absolute; throw new Error(`Database path does not exist: ${absolute}`); }
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Database path must be a regular non-symlink file: ${absolute}`);
  return realpathSync(absolute);
}
export function assertNotCanonical(path: string) {
  const candidate = resolve(path);
  if (candidate === CANONICAL_DB || (existsSync(candidate) && realpathSync(candidate) === CANONICAL_DB)) {
    throw new Error(`Refusing to target the canonical database: ${CANONICAL_DB}`);
  }
}
export function fsyncPath(path: string) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function fsyncDir(path: string) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function setImmutableMode(path: string) { chmodSync(path, 0o440); }
export function setWritableMode(path: string) { chmodSync(path, 0o600); }
export function nowUtcStamp() { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
export function parseArg(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1]?.trim() : undefined; }
export function hasFlag(name: string) { return process.argv.includes(name); }
export function requiredArg(name: string) { const value = parseArg(name); if (!value) throw new Error(`Missing ${name}.`); return value; }

export type DbSummary = {
  database: string; size: number; mode: string; checksum: string; journalMode: string;
  sqliteVersion: string; integrity: string; foreignKeys: string[]; event?: { id: string; slug: string; name: string; active: boolean };
  counts: Record<string, number>;
};

export function tableExists(db: Database.Database, table: string) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}
export function countTable(db: Database.Database, table: string) {
  if (!tableExists(db, table)) return 0;
  return Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
}
export function inspectDatabase(path: string): DbSummary {
  const database = assertRegular(path);
  const db = new Database(database, { readonly: true, fileMustExist: true });
  try {
    const stat = statSync(database);
    const event = db.prepare("SELECT id,slug,name,is_active active FROM events WHERE is_active=1 ORDER BY id LIMIT 1").get() as { id: string; slug: string; name: string; active: number } | undefined;
    const counts: Record<string, number> = {};
    for (const table of ["users","accounts","sessions","viby_identity_links","submissions","submission_owners","submission_memberships","submission_membership_invitations","judges","judge_authorizations","judge_assignments","human_scores","judging_evaluation_states","judging_assignment_states","publication_feedback","publication_feedback_comments","publication_awards","publication_releases","publication_qualification_releases","publication_qualification_revisions","publication_announcements","publication_qualification_announcements","audit_events","participant_journey_events","participant_feedback","chat_rooms","chat_messages","chat_read_states","result_finalists","result_winners"]) counts[table] = countTable(db, table);
    const integrity = String(db.pragma("integrity_check", { simple: true }));
    const foreignKeys = db.pragma("foreign_key_check") as Array<Record<string, unknown>>;
    return { database, size: stat.size, mode: modeString(stat.mode), checksum: sha256(database), journalMode: String(db.pragma("journal_mode", { simple: true })), sqliteVersion: String((db.prepare("select sqlite_version() v").get() as { v: string }).v), integrity, foreignKeys: foreignKeys.map((row) => JSON.stringify(row)), event: event && { id: event.id, slug: event.slug, name: event.name, active: Boolean(event.active) }, counts };
  } finally { db.close(); }
}

export function assertSchemaCompatible(path: string) {
  const database = assertRegular(path); const db = new Database(database, { readonly: true, fileMustExist: true });
  try { const required = ["events", "users", "accounts", "submissions", "judges", "judge_assignments", "human_scores"]; const missing = required.filter((table) => !tableExists(db, table)); if (missing.length) throw new Error(`Database schema is incompatible; missing tables: ${missing.join(", ")}`); } finally { db.close(); }
}

export async function onlineBackup(source: string, destination: string, options: { immutable?: boolean } = {}) {
  const src = assertRegular(source); const dest = resolve(destination);
  ensureDir(dirname(dest));
  if (existsSync(dest)) throw new Error(`Refusing to overwrite existing artifact: ${dest}`);
  const db = new Database(src, { readonly: true, fileMustExist: true });
  try { await db.backup(dest); } finally { db.close(); }
  // Make the artifact self-contained. A WAL/SHM sidecar is not part of an
  // immutable snapshot contract and makes read-only cloning unsafe.
  const normalized = new Database(dest);
  try { normalized.pragma("wal_checkpoint(TRUNCATE)"); normalized.pragma("journal_mode = DELETE"); } finally { normalized.close(); }
  for (const sidecar of [`${dest}-wal`, `${dest}-shm`, `${dest}-journal`]) if (existsSync(sidecar)) unlinkSync(sidecar);
  if (options.immutable !== false) setImmutableMode(dest); else chmodSync(dest, 0o600);
  fsyncPath(dest); fsyncDir(dirname(dest));
  return dest;
}

export function verifySummary(summary: DbSummary) {
  if (summary.integrity !== "ok") throw new Error(`SQLite integrity check failed for ${summary.database}: ${summary.integrity}`);
  if (summary.foreignKeys.length) throw new Error(`Foreign-key check failed for ${summary.database}.`);
}

export function writeMetadata(path: string, metadata: unknown) {
  const out = `${path}.json`; writeFileSync(out, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o440 }); fsyncPath(out); return out;
}
export function writeChecksum(path: string) {
  const out = `${path}.sha256`; writeFileSync(out, `${sha256(path)}  ${basename(path)}\n`, { mode: 0o440 }); fsyncPath(out); return out;
}
export function verifyChecksumSidecar(path: string) {
  const sidecar = `${path}.sha256`; if (!existsSync(sidecar)) return false;
  const expected = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0]; const actual = sha256(path);
  if (!/^[a-f0-9]{64}$/i.test(expected) || expected.toLowerCase() !== actual) throw new Error(`Checksum sidecar mismatch for ${path}.`);
  return true;
}

export function resolveArtifact(input: string) {
  ensureDir(SNAPSHOT_DIR);
  const aliases: Record<string, string> = { current: join(SNAPSHOT_DIR, "current.sqlite"), "kentucky-vibes-base": join(SNAPSHOT_DIR, "kentucky-vibes-base.sqlite"), "kentucky-vibes-simulated": join(SNAPSHOT_DIR, "kentucky-vibes-simulated.sqlite") };
  const requested = aliases[input] ?? (isAbsolute(input) ? input : join(SNAPSHOT_DIR, input));
  if (!existsSync(requested)) throw new Error(`Snapshot/artifact not found: ${input}`);
  // Aliases are intentionally symlinks; the resolved immutable artifact must
  // itself be a regular non-symlink file.
  return lstatSync(requested).isSymbolicLink() ? assertRegular(realpathSync(requested)) : assertRegular(requested);
}

export function makeTypedConfirmation(prefix: string, source: string, target: string, event: string) {
  return `${prefix}\nFROM ${resolve(source)}\nTO ${resolve(target)}\nEVENT ${event}`;
}
