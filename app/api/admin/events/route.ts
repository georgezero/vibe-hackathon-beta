import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditEvents, events } from "@/lib/db/schema";
import { getAllEvents, getActiveEvent } from "@/lib/events";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { withAdminApi } from "@/lib/admin-api";

function parseDate(value: unknown): Date | null {
  if (typeof value === "string" && value) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function getEvents() {
  const activeEvent = await getActiveEvent();
  const allEvents = await getAllEvents();
  return NextResponse.json({ activeEvent, events: allEvents });
}

async function createEvent(req: NextRequest) {
  const body = await req.json();
  const id = `evt_${nanoid(8)}`;
  if (body.isActive) {
    await db.update(events).set({ isActive: false, updatedAt: new Date() });
  }
  await db.insert(events).values({
    id,
    name: body.name?.trim() || "New Vibe Hackathon",
    slug: body.slug?.trim() || id,
    isActive: Boolean(body.isActive),
    isFrozen: Boolean(body.isFrozen),
    startDate: parseDate(body.startDate),
    submissionDeadline: parseDate(body.submissionDeadline),
    judgingDeadline: parseDate(body.judgingDeadline),
    audienceVotingEnabled: body.audienceVotingEnabled ?? true,
    audienceAwardCount: Number(body.audienceAwardCount ?? 1),
    audienceVotesPerPerson: Number(body.audienceVotesPerPerson ?? 1),
    audienceVotingStartsAt: parseDate(body.audienceVotingStartsAt),
    audienceVotingEndsAt: parseDate(body.audienceVotingEndsAt),
    audienceResultsVisible: body.audienceResultsVisible ?? true,
    winnersPublishedAt: null,
    showJudgeChoice: body.showJudgeChoice ?? true,
    showPeoplesChoice: body.showPeoplesChoice ?? true,
    showAIChoice: body.showAIChoice ?? true,
    showSpecialAwards: body.showSpecialAwards ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return NextResponse.json({ id }, { status: 201 });
}

async function updateEvent(req: NextRequest) {
  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (body.isActive) {
    await db.update(events).set({ isActive: false, updatedAt: new Date() });
  }

  // Build update set — only include fields that were provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSet: Record<string, any> = { updatedAt: new Date() };

  if (body.name !== undefined) updateSet.name = body.name;
  if (body.displayName !== undefined) updateSet.displayName = body.displayName || null;
  if (body.logoUrl !== undefined) updateSet.logoUrl = body.logoUrl || null;
  if (body.tagline !== undefined) updateSet.tagline = body.tagline || null;
  if (body.externalUrl !== undefined) updateSet.externalUrl = body.externalUrl || null;
  if (body.isActive !== undefined) updateSet.isActive = body.isActive;
  if (body.isFrozen !== undefined) updateSet.isFrozen = Boolean(body.isFrozen);
  if (body.submissionDeadline !== undefined) updateSet.submissionDeadline = parseDate(body.submissionDeadline);
  if (body.judgingDeadline !== undefined) updateSet.judgingDeadline = parseDate(body.judgingDeadline);
  if (body.audienceVotingEnabled !== undefined) updateSet.audienceVotingEnabled = body.audienceVotingEnabled;
  if (body.audienceAwardCount !== undefined) updateSet.audienceAwardCount = Number(body.audienceAwardCount);
  if (body.audienceVotesPerPerson !== undefined) updateSet.audienceVotesPerPerson = Number(body.audienceVotesPerPerson);
  if (body.audienceVotingStartsAt !== undefined) updateSet.audienceVotingStartsAt = parseDate(body.audienceVotingStartsAt);
  if (body.audienceVotingEndsAt !== undefined) updateSet.audienceVotingEndsAt = parseDate(body.audienceVotingEndsAt);
  if (body.audienceResultsVisible !== undefined) updateSet.audienceResultsVisible = body.audienceResultsVisible;
  if (body.audienceVotingMode !== undefined) updateSet.audienceVotingMode = body.audienceVotingMode;
  if (body.audienceIdentityMethod !== undefined) updateSet.audienceIdentityMethod = body.audienceIdentityMethod;
  if (body.showJudgeChoice !== undefined) updateSet.showJudgeChoice = body.showJudgeChoice;
  if (body.showPeoplesChoice !== undefined) updateSet.showPeoplesChoice = body.showPeoplesChoice;
  if (body.showAIChoice !== undefined) updateSet.showAIChoice = body.showAIChoice;
  if (body.showSpecialAwards !== undefined) updateSet.showSpecialAwards = body.showSpecialAwards;

  // Publish / unpublish winners
  if (body.publishWinners === true) updateSet.winnersPublishedAt = new Date();
  if (body.unpublishWinners === true) updateSet.winnersPublishedAt = null;

  const currentRows = await db.select().from(events).where(eq(events.id, id));
  const wasFrozen = Boolean(currentRows[0]?.isFrozen);
  await db.update(events).set(updateSet).where(eq(events.id, id));
  if (body.isFrozen !== undefined && Boolean(body.isFrozen) !== wasFrozen) {
    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "event",
      entityId: id,
      action: Boolean(body.isFrozen) ? "event_frozen" : "event_unfrozen",
      actorType: "admin",
      metadata: { message: Boolean(body.isFrozen) ? "Event frozen by admin" : "Event unfrozen by admin" } as unknown as Record<string, unknown>,
      createdAt: new Date(),
    });
  }
  return NextResponse.json({ success: true });
}

export const GET = withAdminApi("GET /api/admin/events", getEvents);
export const POST = withAdminApi("POST /api/admin/events", createEvent);
export const PATCH = withAdminApi("PATCH /api/admin/events", updateEvent);
