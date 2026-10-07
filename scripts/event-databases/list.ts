import { readdirSync, existsSync, readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { SNAPSHOT_DIR, inspectDatabase, verifyChecksumSidecar, verifySummary } from "./common";
try {
  const rows = readdirSync(SNAPSHOT_DIR).filter((name) => name.endsWith(".sqlite") && !lstatSync(join(SNAPSHOT_DIR, name)).isSymbolicLink()).map((name) => {
    const path = join(SNAPSHOT_DIR, name); try { const checksumSidecar = verifyChecksumSidecar(path); const summary = inspectDatabase(path); verifySummary(summary); return { artifact: path, event: summary.event, size: summary.size, checksum: summary.checksum, journalMode: summary.journalMode, validation: "passed", checksumSidecar, active: false, metadata: existsSync(`${path}.json`) ? JSON.parse(readFileSync(`${path}.json`, "utf8")) : null }; } catch (error) { return { artifact: path, validation: "failed", active: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  console.log(JSON.stringify({ directory: SNAPSHOT_DIR, aliases: ["current.sqlite", "kentucky-vibes-base.sqlite", "kentucky-vibes-simulated.sqlite"].filter((name) => existsSync(join(SNAPSHOT_DIR, name))), artifacts: rows }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
