import { existsSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { CANONICAL_DB, SNAPSHOT_DIR, ensureDir, inspectDatabase, onlineBackup, nowUtcStamp, setImmutableMode, sha256, verifySummary, writeChecksum, writeMetadata } from "./common";

async function main() {
  ensureDir(SNAPSHOT_DIR);
  const summary = inspectDatabase(CANONICAL_DB); verifySummary(summary);
  const stamp = nowUtcStamp();
  const shortSha = summary.checksum.slice(0, 12);
  const slug = summary.event?.slug.replace(/[^a-zA-Z0-9-]/g, "-") || "unknown-event";
  const artifact = join(SNAPSHOT_DIR, `current-event-${slug}-${stamp}-${shortSha}.sqlite`);
  await onlineBackup(summary.database, artifact);
  const validated = inspectDatabase(artifact); verifySummary(validated);
  const release = (() => { try { return execFileSync("readlink", ["-f", "/opt/vibe-hackathon/current"], { encoding: "utf8" }).trim(); } catch { return null; } })();
  const metadata = { createdAtUtc: new Date().toISOString(), sourceCanonicalPath: summary.database, applicationRelease: release, repositoryHead: (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } })(), event: validated.event ?? null, fileSize: validated.size, fileMode: validated.mode, checksum: validated.checksum, sqliteVersion: validated.sqliteVersion, journalMode: validated.journalMode, integrity: validated.integrity, foreignKeys: validated.foreignKeys, counts: validated.counts, backupMethod: "SQLite better-sqlite3 online backup API", serviceHealthBefore: "verified by operator before snapshot", schemaVersion: "application schema + additive D.0-D.4 migrations" };
  writeMetadata(artifact, metadata); writeChecksum(artifact);
  const alias = join(SNAPSHOT_DIR, "current.sqlite"); if (existsSync(alias)) unlinkSync(alias); symlinkSync(artifact, alias); setImmutableMode(artifact);
  const pointer = join(SNAPSHOT_DIR, "current.pointer.json"); if (existsSync(pointer)) unlinkSync(pointer); writeFileSync(pointer, `${JSON.stringify({ alias: "current", artifact, checksum: sha256(artifact), event: validated.event }, null, 2)}\n`, { mode: 0o440 });
  console.log(JSON.stringify({ artifact, metadata: `${artifact}.json`, checksum: `${artifact}.sha256`, alias, summary: validated }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
