import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const instance = resolve(process.env.VIBE_KENTUCKY_INSTANCE_DIR?.trim() || "/opt/vibe-hackathon/instances/kentucky-vibes");
const credentialsPath = resolve(instance, "credentials/personas.json");
const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
  event: string;
  eventId: string;
  personas: Record<string, Record<string, unknown>>;
};

const argumentsList = process.argv.slice(2);
const action = argumentsList.shift();
if (argumentsList[0] === "kentucky-vibes") argumentsList.shift();
const requestedName = argumentsList[0];
if (!action || !["list", "show"].includes(action)) throw new Error("Usage: tsx scripts/event-databases/persona.ts <list|show> [persona] [--reveal].");
if (credentials.event !== "kentucky-vibes" || credentials.eventId !== "evt_kentucky_vibes") throw new Error("Persona file is not a Kentucky Vibes fixture.");

if (action === "list") {
  console.log(JSON.stringify({ event: credentials.event, personas: Object.entries(credentials.personas).map(([name, value]) => ({ name, role: value.role, userId: value.userId, submissionId: value.submissionId ?? null })) }, null, 2));
  process.exit(0);
}

if (!requestedName || requestedName.startsWith("--")) throw new Error("A single persona name is required for show.");
const persona = credentials.personas[requestedName];
if (!persona) throw new Error(`Unknown persona: ${requestedName}.`);
const reveal = argumentsList.includes("--reveal");
const output: Record<string, unknown> = { name: requestedName, ...persona };
if (typeof output.passwordFile === "string") {
  const passwordFile = resolve(output.passwordFile);
  const mode = statSync(passwordFile).mode & 0o777;
  if (mode & 0o077) throw new Error("Persona password file must remain operator-private (mode 0600 or stricter).");
  if (reveal) output.password = readFileSync(passwordFile, "utf8").trim();
}
if (!reveal) {
  delete output.password;
  output.password = "<redacted; pass --reveal for this named persona only>";
}
console.log(JSON.stringify(output, null, 2));
