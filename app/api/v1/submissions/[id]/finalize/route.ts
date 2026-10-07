import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, aiReviews, auditEvents, teamMembers } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { parseGithubUrl, fetchRepoFiles } from "@/lib/github-fetch";
import { scoreSubmission, buildAiReviewFields } from "@/lib/repo-scorer";
import { validateRepo } from "@/lib/validate-repo";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { isHardLockedStatus } from "@/lib/submission-finalization";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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

    if (isHardLockedStatus(sub.status)) {
      return NextResponse.json({ error: "Submission is locked" }, { status: 403 });
    }

    // A retry with the same key must return the original result without
    // creating another finalization audit event or resetting its timestamp.
    const idempotencyKey = req.headers.get("idempotency-key")?.trim().slice(0, 128) || null;
    if (idempotencyKey) {
      const previous = await db.select({ metadata: auditEvents.metadata })
        .from(auditEvents)
        .where(and(eq(auditEvents.entityType, "submission"), eq(auditEvents.entityId, id), eq(auditEvents.action, "submission_finalized")));
      const alreadyProcessed = previous.some((row: { metadata: unknown }) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        return metadata?.idempotencyKey === idempotencyKey;
      });
      if (alreadyProcessed) {
        return NextResponse.json({ success: true, status: "submitted", alreadyProcessed: true });
      }
    }

    // Deadline check
    const activeEvent = await getActiveEvent();
    // This is a bounded attempt signal after the edit credential and
    // submission have been authorized. It contains no token or project data;
    // the finalization result below remains the authoritative business event.
    void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_finalization_attempted", context: "submit", destination: "submit", outcome: "started" });
    const deadlineStatus = submissionDeadlineStatus(activeEvent);
    if (!deadlineStatus.open) {
      void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_finalization_rejected", context: "submit", destination: "submit", outcome: "guardrail", reason: "deadline" });
      return NextResponse.json(
        { error: "Submissions are closed", code: "DEADLINE_PASSED", label: deadlineStatus.label },
        { status: 403 }
      );
    }

    const memberRows = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, id)).orderBy(teamMembers.order);
    const readiness = computeSubmissionReadiness(sub, memberRows.map((member: typeof memberRows[number]) => ({
      name: member.name,
      badgeNumber: member.badgeNumber,
      isStudentTrainee: member.isStudentTrainee,
    })));
    if (readiness.missingRequiredItems.length > 0) {
      void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_finalization_rejected", context: "submit", destination: "submit", outcome: "guardrail", reason: "readiness_incomplete" });
      return NextResponse.json({
        error: "Project is not ready to submit",
        code: "READINESS_INCOMPLETE",
        missingItems: readiness.missingRequiredItems.map((item) => ({ key: item.key, label: item.label })),
        prizeEligibility: readiness.teamEligibility,
      }, { status: 422 });
    }

    const body = await req.json().catch(() => ({}));
    const source = (body.source as string) ?? "api";

    // Run field-level validation
    const validationResult = validateRepo({
      github_url: sub.githubUrl,
      demo_url: sub.demoUrl,
      agents_md_url: sub.agentsMdUrl,
      license: sub.license,
      sample_data: sub.sampleDataDescription,
      install: sub.setupInstructions,
      run: null,
      harnesses: sub.agentHarnesses,
      models: sub.agentModels,
      budget_tier: sub.budgetTier,
      readme_url: sub.readmeUrl,
      screenshot_url: sub.screenshotUrl,
      prompt_notes_url: sub.promptStrategyUrl,
    });

    const now = new Date();
    const firstSubmission = !["submitted", "finalized", "locked"].includes(sub.status);
    // Keep the original receipt timestamp on a permitted pre-deadline
    // re-finalization. `finalizedAt` is populated for newer rows while the
    // historical `submittedAt` field remains the public receipt timestamp.
    await db
      .update(submissions)
      .set({
        status: "submitted",
        submittedAt: sub.submittedAt ?? now,
        finalizedAt: sub.finalizedAt ?? now,
      })
      .where(and(eq(submissions.id, id), ne(submissions.status, "locked")));

    // ── Deterministic AI review from GitHub repo ──────────────────────────────
    let scoringDetails = null;
    let aiReviewId: string | null = null;

    if (sub.githubUrl) {
      const coords = parseGithubUrl(sub.githubUrl);
      if (coords) {
        try {
          const files = await fetchRepoFiles(coords);
          const scoring = scoreSubmission(files);
          const reviewFields = buildAiReviewFields(scoring);
          scoringDetails = scoring;

          const existingReviews = await db
            .select()
            .from(aiReviews)
            .where(eq(aiReviews.submissionId, id));

          if (existingReviews[0]) {
            aiReviewId = existingReviews[0].id;
            await db
              .update(aiReviews)
              .set({
                ...reviewFields,
                demoValidation: "pending",
                screenshotValidation: sub.screenshotUrl ? "pending" : "pending",
                scoringDetails: scoring as unknown as Record<string, unknown>,
                status: "complete",
                updatedAt: new Date(),
              })
              .where(eq(aiReviews.id, existingReviews[0].id));
          } else {
            aiReviewId = `rev_${nanoid(8)}`;
            await db.insert(aiReviews).values({
              id: aiReviewId,
              submissionId: id,
              ...reviewFields,
              demoValidation: "pending",
              screenshotValidation: "pending",
              scoringDetails: scoring as unknown as Record<string, unknown>,
              status: "complete",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } catch (err) {
          console.error("AI review generation failed (non-fatal):", err);
        }
      }
    }

    const auditId = idempotencyKey
      ? `finalize_${createHash("sha256").update(`${id}:${idempotencyKey}`).digest("hex").slice(0, 32)}`
      : nanoid();
    try {
      await db.insert(auditEvents).values({
        id: auditId,
        entityType: "submission",
        entityId: id,
        action: "submission_finalized",
        actorType: "team",
        metadata: { source, aiReviewId, validationScore: validationResult.score, idempotencyKey } as unknown as Record<string, unknown>,
        createdAt: now,
      });
    } catch (error) {
      // Two tabs can submit the same idempotency key concurrently. The
      // deterministic audit id makes the second insert a safe retry rather
      // than a duplicate finalization record.
      if (idempotencyKey && String(error).toLowerCase().includes("unique")) {
        void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_finalization_rejected", context: "submit", destination: "submit", outcome: "guardrail", reason: "duplicate_retry" });
        return NextResponse.json({ success: true, status: "submitted", alreadyProcessed: true });
      }
      throw error;
    }

    void recordParticipantJourneyEvent({ eventId: activeEvent.id, eventType: "participant_finalization_succeeded", context: "submit", destination: "submit", outcome: "success" });

    return NextResponse.json({
      success: true,
      status: "submitted",
      firstSubmission,
      prizeEligibility: readiness.teamEligibility,
      validationResult,
      aiReview: scoringDetails
        ? {
            id: aiReviewId,
            overall_score: scoringDetails.overall_score,
            repo_score: scoringDetails.repo_score,
            documentation_score: scoringDetails.documentation_score,
            reproducibility_score: scoringDetails.reproducibility_score,
            deployment_score: scoringDetails.deployment_score,
            agent_readiness_score: scoringDetails.agent_readiness_score,
            warnings: scoringDetails.warnings,
          }
        : null,
    });
  } catch (err) {
    console.error("POST /api/v1/submissions/[id]/finalize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
