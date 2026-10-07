import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

type Arguments = {
  database?: string;
  action?: "inspect" | "grant" | "revoke";
  userId?: string;
  judgeId?: string;
  eventId?: string;
  provenance?: string;
  grantedByUserId?: string;
  authorizationId?: string;
  reason?: string;
  dryRun: boolean;
  apply: boolean;
  confirm?: string;
};

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = { dryRun: false, apply: false };
  const values = new Set([
    "--database",
    "--action",
    "--user-id",
    "--judge-id",
    "--event-id",
    "--provenance",
    "--granted-by-user-id",
    "--authorization-id",
    "--reason",
    "--confirm",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (argument === "--apply") {
      result.apply = true;
      continue;
    }
    if (!values.has(argument)) throw new Error(`Unknown argument: ${argument}.`);
    const value = argv[index + 1]?.trim();
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
    index += 1;
    if (argument === "--database") result.database = value;
    if (argument === "--action") {
      if (!["inspect", "grant", "revoke"].includes(value)) {
        throw new Error("Action must be inspect, grant, or revoke.");
      }
      result.action = value as Arguments["action"];
    }
    if (argument === "--user-id") result.userId = value;
    if (argument === "--judge-id") result.judgeId = value;
    if (argument === "--event-id") result.eventId = value;
    if (argument === "--provenance") result.provenance = value;
    if (argument === "--granted-by-user-id") result.grantedByUserId = value;
    if (argument === "--authorization-id") result.authorizationId = value;
    if (argument === "--reason") result.reason = value;
    if (argument === "--confirm") result.confirm = value;
  }
  return result;
}

function validatedDatabasePath(configured: string | undefined) {
  if (!configured || !isAbsolute(configured)) {
    throw new Error("--database must be an explicit absolute SQLite path.");
  }
  const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
  const requested = resolve(configured);
  if (requested === protectedBackup) {
    throw new Error("The protected pre-P0.4 backup cannot be inspected or modified.");
  }
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Database must be an existing regular, non-symlink file.");
  }
  accessSync(requested, constants.R_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) {
    throw new Error("Database must be its canonical non-protected path.");
  }
  return canonical;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const database = validatedDatabasePath(args.database);
  if (!args.action) throw new Error("--action is required.");
  if (args.dryRun && args.apply) throw new Error("--dry-run and --apply are mutually exclusive.");
  if (args.action !== "inspect") accessSync(database, constants.W_OK);

  const validation = new Database(database, { readonly: true, fileMustExist: true });
  try {
    if (!validation.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='judge_authorizations'",
    ).get()) {
      throw new Error("judge_authorizations migration is required.");
    }
  } finally {
    validation.close();
  }

  process.env.DB_FILE_NAME = database;
  delete process.env.DATABASE_URL;
  const repository = await import("../lib/judge-authorizations");

  if (args.action === "inspect") {
    if (args.apply || args.dryRun) throw new Error("Inspect does not accept mutation flags.");
    console.log(JSON.stringify({
      database,
      ...(await repository.inspectJudgeAuthorizationState()),
    }, null, 2));
    return;
  }

  if (args.action === "grant") {
    if (!args.userId || !args.judgeId || !args.eventId || !args.provenance) {
      throw new Error("Grant requires --user-id, --judge-id, --event-id, and --provenance.");
    }
    const input = {
      userId: args.userId,
      judgeId: args.judgeId,
      eventId: args.eventId,
      grantProvenance: args.provenance,
      grantedByUserId: args.grantedByUserId ?? null,
    };
    const preview = repository.previewJudgeAuthorizationGrant(input);
    if (args.dryRun) {
      console.log(JSON.stringify({ database, dryRun: true, preview }, null, 2));
      return;
    }
    if (!args.apply) throw new Error("Grant requires either --dry-run or --apply.");
    const expected = `GRANT JUDGE AUTHORIZATION ${args.userId} ${args.judgeId} ${args.eventId} ON ${database}`;
    if (args.confirm !== expected) {
      throw new Error(`Grant confirmation required: ${JSON.stringify(expected)}.`);
    }
    console.log(JSON.stringify({
      database,
      result: repository.grantJudgeAuthorization(input),
    }, null, 2));
    return;
  }

  if (!args.authorizationId || !args.reason) {
    throw new Error("Revoke requires --authorization-id and --reason.");
  }
  if (args.dryRun) {
    const state = await repository.inspectJudgeAuthorizationState();
    const authorization = state.authorizations.find(
      (row: { id: string }) => row.id === args.authorizationId,
    );
    console.log(JSON.stringify({
      database,
      dryRun: true,
      result: authorization
        ? { status: "ready", authorization }
        : { status: "not_found" },
    }, null, 2));
    return;
  }
  if (!args.apply) throw new Error("Revoke requires either --dry-run or --apply.");
  const expected = `REVOKE JUDGE AUTHORIZATION ${args.authorizationId} ON ${database}`;
  if (args.confirm !== expected) {
    throw new Error(`Revoke confirmation required: ${JSON.stringify(expected)}.`);
  }
  console.log(JSON.stringify({
    database,
    result: repository.revokeJudgeAuthorization({
      authorizationId: args.authorizationId,
      reason: args.reason,
    }),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Judge authorization operation failed.");
  process.exitCode = 1;
});
