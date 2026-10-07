import { existsSync, lstatSync, unlinkSync } from "node:fs";
import { basename } from "node:path";
import { SNAPSHOT_DIR, parseArg, resolveArtifact } from "./common";

try {
  const input = parseArg("--artifact") || process.argv[2];
  if (!input) throw new Error("An exact --artifact path or alias is required.");
  const artifact = resolveArtifact(input);
  if (artifact.includes("current-event-")) throw new Error("Current-event snapshots are protected and cannot be cleaned up here.");
  const expected = `DELETE SYNTHETIC EVENT ARTIFACT ${artifact}`;
  if (parseArg("--confirm") !== expected) throw new Error(`Exact confirmation required: ${expected}`);
  for (const path of [artifact, `${artifact}.json`, `${artifact}.sha256`, `${artifact}-wal`, `${artifact}-shm`, `${artifact}-journal`]) if (existsSync(path) && !lstatSync(path).isSymbolicLink()) unlinkSync(path);
  console.log(JSON.stringify({ removed: basename(artifact), directory: SNAPSHOT_DIR, confirmation: "accepted" }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
