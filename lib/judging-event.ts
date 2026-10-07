import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

export const DEFAULT_JUDGING_EVENT_ID = "evt_vibe_2025";

export function currentJudgingEventId(
  configured = process.env.VIBE_JUDGE_EVENT_ID,
) {
  const eventId = configured?.trim() || DEFAULT_JUDGING_EVENT_ID;
  if (!eventId || eventId.length > 128) {
    throw new Error("The current judging event ID is invalid.");
  }
  return eventId;
}

export async function getJudgingEvent(eventId: string) {
  if (!eventId.trim()) return null;
  const rows = await db.select({
    id: events.id,
    name: events.name,
    slug: events.slug,
    isActive: events.isActive,
    isFrozen: events.isFrozen,
    judgingDeadline: events.judgingDeadline,
  }).from(events).where(eq(events.id, eventId)).limit(2);
  if (rows.length !== 1) return null;
  return rows[0];
}

export async function getCurrentJudgingEvent() {
  const eventId = currentJudgingEventId();
  const event = await getJudgingEvent(eventId);
  if (!event || !event.isActive) {
    throw new Error("The configured judging event is unavailable.");
  }
  return event;
}
