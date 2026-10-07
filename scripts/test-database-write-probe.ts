import Database from "better-sqlite3";
import { assertTestDatabaseIsolation } from "@/lib/test-database-isolation";

async function main() {
  assertTestDatabaseIsolation();

  const databasePath = process.env.DB_FILE_NAME!;
  const sqlite = new Database(databasePath);
  sqlite.exec(`
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_type TEXT,
      actor_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  sqlite.close();

  const { logJudgeAudit } = await import("@/lib/judge-audit");
  await logJudgeAudit("judge_access_denied", {
    eventId: "evt_test_isolation",
    route: "test_database_write_probe",
    reason: "isolation_probe",
  });

  const verification = new Database(databasePath, { readonly: true });
  const row = verification
    .prepare(
      "SELECT count(*) AS count FROM audit_events WHERE action = ? AND json_extract(metadata, '$.reason') = ?",
    )
    .get("judge_access_denied", "isolation_probe") as { count: number };
  verification.close();
  if (row.count !== 1) {
    throw new Error(`Expected one disposable audit row; found ${row.count}.`);
  }
}

void main();
