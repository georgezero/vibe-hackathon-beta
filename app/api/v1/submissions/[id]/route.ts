import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teamMembers, auditEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { submissionLinks } from "@/lib/submission-links";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { computeSubmissionEditVersion } from "@/lib/submission-edit-version";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return freeze.response;
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const rows = await db.select().from(submissions).where(eq(submissions.id, id));
    const sub = rows[0];

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (sub.editToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Only "locked" is a hard block; "submitted"/"finalized" can still be updated before deadline
    if (sub.status === "locked") {
      return NextResponse.json({ error: "Submission is locked" }, { status: 403 });
    }

    const body = await req.json();
    const source = (body.source as string) ?? "api";

    const expectedEditVersion = typeof body.expectedEditVersion === "string" ? body.expectedEditVersion.trim() : null;
    if (body.expectedEditVersion !== undefined && !expectedEditVersion) {
      return NextResponse.json({ error: "Invalid edit version", code: "INVALID_EDIT_VERSION" }, { status: 400 });
    }

    if (expectedEditVersion) {
      const currentMembers = await db.select().from(teamMembers)
        .where(eq(teamMembers.submissionId, id))
        .orderBy(teamMembers.order);
      const actualEditVersion = computeSubmissionEditVersion(sub as unknown as Record<string, unknown>, currentMembers as unknown as Record<string, unknown>[]);
      if (actualEditVersion !== expectedEditVersion) {
        const staleEvent = await getActiveEvent();
        void recordParticipantJourneyEvent({ eventId: staleEvent.id, eventType: "participant_stale_edit_detected", context: "editor", destination: "editor", outcome: "guardrail", reason: "stale_edit" });
        return NextResponse.json({
          error: "This project changed in another session. Reload before saving.",
          code: "STALE_PROJECT_EDIT",
          editVersion: actualEditVersion,
        }, { status: 409 });
      }
    }

    // Deadline check — all updates (draft or finalized) are blocked after deadline
    const activeEvent = await getActiveEvent();
    const deadlineStatus = submissionDeadlineStatus(activeEvent);
    if (!deadlineStatus.open) {
      void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_agent_update_rejected", context: "editor", destination: "editor", outcome: "guardrail", reason: "deadline" });
      await db.insert(auditEvents).values({
        id: nanoid(),
        entityType: "submission",
        entityId: id,
        action: "submission_update_rejected_deadline",
        actorType: "team",
        metadata: { source, deadlineLabel: deadlineStatus.label } as unknown as Record<string, unknown>,
        createdAt: new Date(),
      });
      return NextResponse.json(
        { error: "Submissions are closed", code: "DEADLINE_PASSED", label: deadlineStatus.label },
        { status: 403 }
      );
    }

    // Parse members from text format "Name — Role\nName2 — Role2"
    let parsedMembers: Array<{ name: string; role: string }> | undefined;
    if (typeof body.members === "string") {
      parsedMembers = body.members
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((line: string) => {
          const sep = line.includes("—") ? "—" : line.includes("-") ? "-" : null;
          if (sep) {
            const idx = line.indexOf(sep);
            return { name: line.slice(0, idx).trim(), role: line.slice(idx + sep.length).trim() };
          }
          return { name: line.trim(), role: "" };
        });
    }

    const updateData: Record<string, unknown> = {};
    const allowed = [
      "teamName", "contactEmail", "projectTitle", "problemStatement", "targetUsers",
      "demoUrl", "demoVideoUrl", "githubUrl", "screenshotUrl", "screenshotUrls", "readmeUrl", "agentsMdUrl",
      "promptStrategyUrl", "sampleDataDescription", "setupInstructions",
      "deployInstructions", "knownLimitations", "aiToolsUsed", "tags",
      "license", "agentHarnesses", "agentModels", "budgetTier",
      "estimatedHumanHours", "estimatedAgentHours", "vibeJsonRaw",
      "agentReportUrl", "agentReportRaw",
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }
    if (Array.isArray(body.screenshotUrls)) {
      const screenshotUrls = body.screenshotUrls
        .filter((url: unknown): url is string => typeof url === "string")
        .map((url: string) => url.trim())
        .filter(Boolean);
      updateData.screenshotUrls = screenshotUrls;
      updateData.screenshotUrl = screenshotUrls[0] ?? null;
    }

    const hasMemberUpdate = parsedMembers !== undefined;
    if (Object.keys(updateData).length > 0 || hasMemberUpdate) {
      // Submissions predate a persisted version column. The edit version sent
      // to the browser is a hash of the authoritative editable fields and
      // roster, so this remains migration-free while detecting stale browser
      // saves after an agent or another session changes the project.
      await db.update(submissions).set(updateData).where(eq(submissions.id, id));
    }

    // Handle members separately if provided
    if (parsedMembers !== undefined) {
      await db.delete(teamMembers).where(eq(teamMembers.submissionId, id));
      for (let i = 0; i < parsedMembers.length; i++) {
        await db.insert(teamMembers).values({
          id: nanoid(),
          teamId: sub.teamId ?? null,
          submissionId: id,
          name: parsedMembers[i].name,
          role: parsedMembers[i].role,
          order: i,
        });
      }
    }

    const wasFinalized = sub.status === "submitted";
    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "submission",
      entityId: id,
      action: wasFinalized ? "submission_updated_after_finalized" : "submission_updated",
      actorType: "team",
      metadata: { source, fields: Object.keys(updateData) } as unknown as Record<string, unknown>,
      createdAt: new Date(),
    });

    const refreshed = (await db.select().from(submissions).where(eq(submissions.id, id)))[0] ?? sub;
    const refreshedMembers = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, id)).orderBy(teamMembers.order);
    if (source === "agent") void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_agent_update_received", context: "editor", destination: "editor", outcome: "success" });
    const links = submissionLinks(token, id);
    return NextResponse.json({
      success: true,
      team_id: sub.teamId ?? null,
      status: sub.status,
      ...links,
      editUrl: links.edit_url,
      editVersion: computeSubmissionEditVersion(refreshed as unknown as Record<string, unknown>, refreshedMembers as unknown as Record<string, unknown>[]),
    });
  } catch (err) {
    console.error("PATCH /api/v1/submissions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
