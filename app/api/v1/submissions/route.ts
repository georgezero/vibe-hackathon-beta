import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, auditEvents, teams } from "@/lib/db/schema";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { nanoid } from "nanoid";
import { submissionLinks } from "@/lib/submission-links";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export async function POST(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return freeze.response;
    const body = await req.json();
    const { teamName, contactEmail } = body;

    if (!teamName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json(
        { error: "teamName and contactEmail are required" },
        { status: 400 }
      );
    }

    const activeEvent = await getActiveEvent();
    const deadlineStatus = submissionDeadlineStatus(activeEvent);
    if (!deadlineStatus.open) {
      return NextResponse.json(
        { error: "Submissions are closed", label: deadlineStatus.label },
        { status: 403 }
      );
    }

    const id = `sub_${nanoid(8)}`;
    const editToken = `edit_${nanoid(16)}`;
    const teamId = `team_${nanoid(10)}`;

    await db.insert(teams).values({
      id: teamId,
      eventId: activeEvent.id,
      name: teamName.trim(),
      contactEmail: contactEmail.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(submissions).values({
      id,
      teamId,
      eventId: activeEvent.id,
      editToken,
      teamName: teamName.trim(),
      contactEmail: contactEmail.trim(),
      status: "draft",
      createdAt: new Date(),
    });

    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "submission",
      entityId: id,
      action: "submission_created",
      actorType: "team",
      metadata: { source: "web" } as unknown as Record<string, unknown>,
      createdAt: new Date(),
    });
    void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_project_created", context: "start", destination: "editor", outcome: "success" });

    const links = submissionLinks(editToken, id);
    return NextResponse.json(
      {
        id,
        team_id: teamId,
        editToken,
        status: "draft",
        ...links,
        editUrl: links.edit_url,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/v1/submissions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
