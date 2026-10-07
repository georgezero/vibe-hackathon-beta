import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const defaults = [
  { slug: "general", name: "General", description: "Event-wide discussion for participants.", type: "discussion", postingPolicy: "participants", sortOrder: 10 },
  { slug: "announcements", name: "Announcements", description: "Official updates from the event organizers.", type: "announcements", postingPolicy: "admins_only", sortOrder: 20 },
  { slug: "team-up", name: "Team-up", description: "Find teammates and collaborators for your next build.", type: "discussion", postingPolicy: "participants", sortOrder: 30 },
  { slug: "technical-help", name: "Technical help", description: "Ask implementation questions and share what is working.", type: "discussion", postingPolicy: "participants", sortOrder: 40 },
] as const;

function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1]?.trim() : undefined; }
function targetPath() {
  const configured = process.env.DB_FILE_NAME?.trim();
  if (process.env.DATABASE_URL?.trim()) throw new Error("Remote databases are not supported.");
  if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  const requested = resolve(configured); const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular non-symlink file.");
  const canonical = realpathSync(requested); if (canonical !== requested) throw new Error("Target must be canonical.");
  accessSync(canonical, constants.R_OK | constants.W_OK); return canonical;
}

const eventId = arg("--event");
if (!eventId) throw new Error("Usage: community:provision-defaults -- --event <event-id> [--dry-run] [--confirm]");
const dryRun = process.argv.includes("--dry-run");
const target = targetPath();
const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  const event = sqlite.prepare("SELECT id, name FROM events WHERE id = ?").get(eventId) as { id: string; name: string } | undefined;
  if (!event) throw new Error(`Event not found: ${eventId}`);
  const existing = sqlite.prepare("SELECT slug, name, description, type, posting_policy AS postingPolicy, status, sort_order AS sortOrder FROM community_channels WHERE event_id = ? ORDER BY sort_order, name").all(eventId) as Array<Record<string, unknown>>;
  const existingSlugs = new Set(existing.map((row) => String(row.slug)));
  const planned = defaults.filter((row) => !existingSlugs.has(row.slug));
  console.log(JSON.stringify({ database: target, event, dryRun, existing, planned }, null, 2));
  if (dryRun || planned.length === 0) process.exit(0);
  const expected = `PROVISION COMMUNITY DEFAULTS ${target} ${eventId}`;
  if (process.env.VIBE_F3_PROVISION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
  const now = Math.floor(Date.now() / 1000);
  const insert = sqlite.prepare("INSERT INTO community_channels (id,event_id,slug,name,description,type,visibility,posting_policy,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?, 'participants', ?, 'active', ?, ?, ?)");
  sqlite.transaction(() => { for (const row of planned) insert.run(`channel_${row.slug}_${eventId}`, eventId, row.slug, row.name, row.description, row.type, row.postingPolicy, row.sortOrder, now, now); })();
  console.log(JSON.stringify({ provisioned: planned.map((row) => row.slug), idempotent: true }));
} finally { sqlite.close(); }
