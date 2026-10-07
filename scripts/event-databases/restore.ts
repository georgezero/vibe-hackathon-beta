import { existsSync, lstatSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { CANONICAL_DB, SNAPSHOT_DIR, assertRegular, assertSchemaCompatible, ensureDir, fsyncDir, fsyncPath, inspectDatabase, makeTypedConfirmation, nowUtcStamp, onlineBackup, parseArg, resolveArtifact, setWritableMode, verifyChecksumSidecar, verifySummary } from "./common";

const sourceInput = process.argv[2];
const target = resolve(parseArg("--target") || CANONICAL_DB);
const expectedEvent = parseArg("--event") || parseArg("--event-slug");
const service = parseArg("--service") || "vibe-hackathon.service";
const serviceManager = parseArg("--service-manager") || "systemctl --user";
const confirm = parseArg("--confirm");

function run(command: string, args: string[]) { return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function serviceRun(action: string) { return serviceManager === "systemctl --user" ? run("systemctl", ["--user", action, service]) : run(serviceManager, [action, service]); }
function health() { try { run("curl", ["--fail", "--silent", "--show-error", "--max-time", "8", "http://127.0.0.1:3000/api/health"]); return true; } catch { return false; } }
async function main() {
  if (!sourceInput) throw new Error("Usage: npm run db:event:restore -- <artifact-or-alias> --event <event-id-or-slug> --confirm '<exact confirmation>'.");
  const source = resolveArtifact(sourceInput);
  verifyChecksumSidecar(source);
  assertSchemaCompatible(source);
  const sourceSummary = inspectDatabase(source); verifySummary(sourceSummary);
  if (expectedEvent && sourceSummary.event?.id !== expectedEvent && sourceSummary.event?.slug !== expectedEvent) throw new Error(`Source event ${sourceSummary.event?.id}/${sourceSummary.event?.slug} does not match --event ${expectedEvent}.`);
  if (lstatSync(target).isSymbolicLink()) throw new Error(`Restore target cannot be a symlink: ${target}`);
  if (!existsSync(target) || !lstatSync(target).isFile()) throw new Error(`Restore target must be an existing regular file: ${target}`);
  const canonicalTarget = assertRegular(target);
  const expected = makeTypedConfirmation("RESTORE VIBE DATABASE", source, canonicalTarget, sourceSummary.event?.id || sourceSummary.event?.slug || "unknown");
  if (confirm !== expected) throw new Error(`Exact confirmation required. Set --confirm to:\n${expected}`);
  if (source === canonicalTarget) throw new Error("Source and target are identical.");
  ensureDir(SNAPSHOT_DIR);
  const preRestore = join(SNAPSHOT_DIR, `pre-restore-${nowUtcStamp()}-${inspectDatabase(canonicalTarget).checksum.slice(0,12)}.sqlite`);
  // The online backup is deliberately made before stopping the service so WAL
  // pages are included and an automatic rollback is always available.
  await onlineBackup(canonicalTarget, preRestore);
  const current = inspectDatabase(canonicalTarget); verifySummary(current);
  console.log(JSON.stringify({ source, sourceEvent: sourceSummary.event, target: canonicalTarget, preRestore, confirmation: "accepted", sourceChecksum: sourceSummary.checksum, targetChecksum: current.checksum }, null, 2));
  let stopped = false;
  let replaced = false;
  try {
    serviceRun("stop"); stopped = true;
    const tmp = join(dirname(canonicalTarget), `.${canonicalTarget.split("/").pop()}.${process.pid}.restore.tmp`);
    if (existsSync(tmp)) unlinkSync(tmp);
    await onlineBackup(source, tmp, { immutable: false }); setWritableMode(tmp); fsyncPath(tmp); renameSync(tmp, canonicalTarget); replaced = true; fsyncDir(dirname(canonicalTarget));
    serviceRun("start"); stopped = false;
    let ready = false; for (let i = 0; i < 24; i += 1) { if (health()) { ready = true; break; } await new Promise((r) => setTimeout(r, 500)); }
    if (!ready) throw new Error("Service health did not recover after restore.");
    const activated = inspectDatabase(canonicalTarget); verifySummary(activated);
    if (expectedEvent && activated.event?.id !== expectedEvent && activated.event?.slug !== expectedEvent) throw new Error("Activated event does not match expected event.");
    console.log(JSON.stringify({ restored: true, service, health: "passed", activated }, null, 2));
  } catch (error) {
    if (!replaced && stopped) { try { serviceRun("start"); } catch {} }
    // If replacement happened and health failed, restore the verified backup.
    if (replaced) {
      try { serviceRun("stop"); } catch {}
      try { const rollbackTmp = join(dirname(canonicalTarget), `.${canonicalTarget.split("/").pop()}.${process.pid}.rollback.tmp`); if (existsSync(rollbackTmp)) unlinkSync(rollbackTmp); await onlineBackup(preRestore, rollbackTmp, { immutable: false }); setWritableMode(rollbackTmp); fsyncPath(rollbackTmp); renameSync(rollbackTmp, canonicalTarget); fsyncDir(dirname(canonicalTarget)); serviceRun("start"); } catch (rollbackError) { console.error(`AUTOMATIC ROLLBACK FAILED: ${rollbackError instanceof Error ? rollbackError.message : rollbackError}`); }
    }
    throw error;
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
