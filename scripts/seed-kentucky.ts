import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ensureDir, inspectDatabase, onlineBackup, verifySummary } from "./event-databases/common";

// Build the existing Kentucky fixture from an empty schema, without copying
// an operator's current event, accounts, sessions, or production data.
async function main() {
  if (process.env.DATABASE_URL?.trim()) throw new Error("This demo seed supports local SQLite only. Unset DATABASE_URL.");
  if (process.env.NODE_ENV === "production" && process.env.VIBE_EVENT_SIMULATION !== "1") {
    throw new Error("A production demo seed requires VIBE_EVENT_SIMULATION=1.");
  }
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--profile", "--seed"].includes(key) || !value || options.has(key)) {
      throw new Error("Usage: npm run db:seed:kentucky -- [--profile small|realistic|stress] [--seed INTEGER]");
    }
    options.set(key, value);
  }
  const profile = options.get("--profile") ?? "realistic";
  const seed = options.get("--seed") ?? "20260802";
  if (!["small", "realistic", "stress"].includes(profile)) throw new Error("Profile must be small, realistic, or stress.");
  if (!Number.isSafeInteger(Number(seed))) throw new Error("Seed must be a safe integer.");

  const target = resolve(process.env.DB_FILE_NAME?.trim() || "local.db");
  let targetExists = false;
  try { lstatSync(target); targetExists = true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (targetExists) throw new Error(`Refusing to replace an existing database: ${target}. Choose a new DB_FILE_NAME.`);
  ensureDir(dirname(target));
  const credentialsDir = resolve("data/credentials");
  ensureDir(credentialsDir);
  const temporary = mkdtempSync(join(tmpdir(), "vibe-kentucky-"));
  const base = join(temporary, "base.sqlite");
  const artifact = join(temporary, "kentucky.sqlite");
  const credentials = join(credentialsDir, `kentucky-${profile}-${Date.now()}.json`);
  const tsx = resolve("node_modules/.bin/tsx");
  try {
    execFileSync(tsx, ["scripts/migrate-all.ts", "--bootstrap"], {
      env: {
        ...process.env, DATABASE_URL: "", DB_FILE_NAME: base,
        VIBE_DB_BOOTSTRAP_CONFIRM: `CREATE CURRENT SCHEMA DATABASE ${base}`,
      },
      stdio: "inherit",
    });
    const sqlite = new Database(base);
    try {
      sqlite.prepare("INSERT INTO events (id, name, slug, is_active) VALUES (?, ?, ?, 1)")
        .run("evt_beta_seed_base", "Empty seed base", "beta-seed-base");
    } finally { sqlite.close(); }
    execFileSync(tsx, [
      "scripts/event-databases/create-kentucky-vibes.ts", "kentucky-vibes",
      "--profile", profile, "--seed", seed, "--base", base,
      "--output-dir", temporary, "--output", artifact, "--credentials", credentials,
    ], {
      env: { ...process.env, DATABASE_URL: "", DB_FILE_NAME: base, VIBE_EVENT_DATABASE_DIR: temporary, VIBE_EVENT_SIMULATION: "1" },
      stdio: "inherit",
    });
    await onlineBackup(artifact, target, { immutable: false });
    const summary = inspectDatabase(target);
    verifySummary(summary);
    console.log(JSON.stringify({ database: target, credentials, event: summary.event, counts: summary.counts }, null, 2));
    console.log("Set VIBE_JUDGE_EVENT_ID=evt_kentucky_vibes before starting the app.");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Kentucky demo seed failed.");
  process.exitCode = 1;
});
