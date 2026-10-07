import { readFileSync } from "node:fs";
import { resolveArtifact, inspectDatabase, verifyChecksumSidecar, verifySummary } from "./common";
const input = process.argv[2] || "current";
try { const path = resolveArtifact(input); const checksumSidecar = verifyChecksumSidecar(path); const summary = inspectDatabase(path); verifySummary(summary); const metadata = (() => { try { return JSON.parse(readFileSync(`${path}.json`, "utf8")); } catch { return null; } })(); console.log(JSON.stringify({ artifact: path, checksumSidecar, metadata, summary }, null, 2)); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
