import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { githubAuthRequired } from "@/lib/ownership-mode";

export async function GET() {
  let dbOk = false;
  let activeEventName: string | null = null;
  let activeEventId: string | null = null;
  let activeEventFrozen = false;

  try {
    const rows = await db.select().from(events);
    dbOk = true;
    const active = rows.find((e: (typeof rows)[number]) => e.isActive);
    if (active) {
      activeEventName = active.displayName ?? active.name;
      activeEventId = active.id;
      activeEventFrozen = Boolean(active.isFrozen);
    }
  } catch {
    dbOk = false;
  }

  const baseUrlConfigured = !!process.env.VIBE_HACKATHON_BASE_URL;
  const baseUrl = process.env.VIBE_HACKATHON_BASE_URL ?? "http://localhost:3000";

  return NextResponse.json({
    status: "ok",
    database: dbOk ? "ok" : "error",
    activeEvent: activeEventId ? { id: activeEventId, name: activeEventName, eventFrozen: activeEventFrozen } : null,
    eventFrozen: activeEventFrozen,
    baseUrl,
    baseUrlConfigured,
    githubAuthRequired: githubAuthRequired(),
    version: process.env.npm_package_version ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? null,
    timestamp: new Date().toISOString(),
  });
}
