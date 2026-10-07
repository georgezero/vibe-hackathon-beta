import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertNotCanonical, inspectDatabase, makeTypedConfirmation, onlineBackup, resolveArtifact, sha256, verifyChecksumSidecar, verifySummary } from "@/scripts/event-databases/common";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "vibe-event-db-test-")); const source = join(root, "source.sqlite"); const db = new Database(source); db.exec("CREATE TABLE events (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, is_active INTEGER NOT NULL); INSERT INTO events VALUES ('evt_test','test-event','Test Event',1);"); db.close(); return { root, source };
}

describe("event database snapshot safeguards", () => {
  it("creates a WAL-safe isolated backup with matching event identity", async () => {
    const { root, source } = fixture(); const target = join(root, "snapshot.sqlite");
    try { const sourceSummary = inspectDatabase(source); await onlineBackup(source, target, { immutable: false }); const targetSummary = inspectDatabase(target); verifySummary(targetSummary); expect(targetSummary.event).toEqual(sourceSummary.event); expect(targetSummary.integrity).toBe("ok"); expect(targetSummary.foreignKeys).toEqual([]); expect(statSync(target).size).toBeGreaterThan(0); } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("requires exact restore confirmation text", () => {
    const expected = makeTypedConfirmation("RESTORE VIBE DATABASE", "/tmp/source.sqlite", "/tmp/target.sqlite", "evt_test"); expect(expected).toContain("EVENT evt_test"); expect(expected).not.toBe("yes");
  });

  it("rejects canonical targets and symlinked artifacts", () => {
    expect(() => assertNotCanonical(process.env.DB_FILE_NAME || "local.db")).toThrow(/canonical database/);
    const { root, source } = fixture(); const alias = join(root, "alias.sqlite"); symlinkSync(source, alias); expect(resolveArtifact(alias)).toBe(source); rmSync(root, { recursive: true, force: true });
  });

  it("produces a stable checksum for an immutable artifact", async () => {
    const { root, source } = fixture(); const target = join(root, "snapshot.sqlite"); try { await onlineBackup(source, target, { immutable: false }); expect(sha256(target)).toMatch(/^[a-f0-9]{64}$/); expect(readFileSync(target).length).toBeGreaterThan(0); } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects a tampered checksum sidecar", async () => {
    const { root, source } = fixture(); const target = join(root, "snapshot.sqlite"); try { await onlineBackup(source, target, { immutable: false }); writeFileSync(`${target}.sha256`, `${"0".repeat(64)}  snapshot.sqlite\n`); expect(() => verifyChecksumSidecar(target)).toThrow(/checksum sidecar mismatch/i); } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
