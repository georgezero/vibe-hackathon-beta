import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, submissions } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { submissionId?: unknown; editToken?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  const editToken = typeof body?.editToken === "string" ? body.editToken.trim() : "";
  const row = submissionId && editToken
    ? (await db.select({ id: submissions.id, token: submissions.editToken }).from(submissions).where(eq(submissions.id, submissionId)).limit(1))[0]
    : null;
  if (!row || row.token !== editToken) {
    await db.insert(auditEvents).values({ id: nanoid(), entityType: "submission", entityId: submissionId || "unknown", action: "submission_resume_failed", actorType: "anonymous", metadata: {} as unknown as Record<string, unknown>, createdAt: new Date() });
    return NextResponse.json({ error: "We could not verify those submission details." }, { status: 403 });
  }
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "submission", entityId: row.id, action: "submission_resume_verified", actorType: "team", metadata: {} as unknown as Record<string, unknown>, createdAt: new Date() });
  const event = await getActiveEvent();
  void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_project_resumed", context: "resume", destination: "editor", outcome: "success" });
  return NextResponse.json({ next: `/submit/${editToken}/start` });
}
