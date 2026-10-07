import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teamMembers, auditEvents, teams } from "@/lib/db/schema";
import { parseVibeJson, type VibeJson } from "@/lib/vibe-json";
import { validateRepo } from "@/lib/validate-repo";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { nanoid } from "nanoid";
import { submissionLinks } from "@/lib/submission-links";
import { assertEventNotFrozen } from "@/lib/event-freeze";

export async function POST(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return freeze.response;

    const body = await req.json();
    const { vibe_json } = body as { vibe_json: unknown };

    if (!vibe_json) {
      return NextResponse.json(
        { error: "vibe_json is required" },
        { status: 400 }
      );
    }

    const parsed = parseVibeJson(vibe_json);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const vj: VibeJson = parsed.data;

    const activeEvent = await getActiveEvent();
    const deadlineStatus = submissionDeadlineStatus(activeEvent);
    if (!deadlineStatus.open) {
      return NextResponse.json(
        { error: "Submissions are closed", code: "DEADLINE_PASSED", label: deadlineStatus.label },
        { status: 403 }
      );
    }

    // Build validation payload from vibe.json fields
    const validationPayload: Record<string, unknown> = {
      github_url: vj.project.github_url,
      demo_url: vj.project.demo_url,
      agents_md_url: vj.repo.agents_md_url,
      license: vj.repo.license,
      sample_data: vj.repo.sample_data,
      install: vj.repo.install,
      run: vj.repo.run,
      harnesses: vj.agentic_dev.harnesses,
      models: vj.agentic_dev.models,
      budget_tier: vj.agentic_dev.budget_tier,
      readme_url: vj.repo.readme_url,
      screenshot_url: vj.project.screenshot_urls?.[0] ?? vj.project.screenshot_url,
      prompt_notes_url: vj.agentic_dev.prompt_notes_url,
    };

    const validationResult = validateRepo(validationPayload);

    const id = `sub_${nanoid(8)}`;
    const editToken = `edit_${nanoid(16)}`;
    const teamId = `team_${nanoid(10)}`;

    await db.insert(teams).values({
      id: teamId,
      eventId: activeEvent.id,
      name: vj.team.name,
      contactEmail: vj.team.contact_email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(submissions).values({
      id,
      teamId,
      eventId: activeEvent.id,
      editToken,
      teamName: vj.team.name,
      contactEmail: vj.team.contact_email,
      status: "draft",
      projectTitle: vj.project.name,
      problemStatement: vj.project.summary,
      targetUsers: vj.project.target_users?.join(", ") ?? null,
      demoUrl: vj.project.demo_url,
      demoVideoUrl: vj.project.demo_video_url ?? null,
      githubUrl: vj.project.github_url,
      screenshotUrl: vj.project.screenshot_urls?.[0] ?? vj.project.screenshot_url ?? null,
      screenshotUrls: (vj.project.screenshot_urls?.length ? vj.project.screenshot_urls : null) ??
                      (vj.project.screenshot_url ? [vj.project.screenshot_url] : null),
      readmeUrl: vj.repo.readme_url ?? null,
      agentsMdUrl: vj.repo.agents_md_url,
      promptStrategyUrl: vj.agentic_dev.prompt_notes_url ?? null,
      agentReportUrl: vj.agentic_dev.agent_report_url ?? null,
      sampleDataDescription: vj.repo.sample_data ?? null,
      setupInstructions: vj.repo.install,
      deployInstructions: null,
      knownLimitations: vj.agentic_dev.known_limitations ?? null,
      license: vj.repo.license,
      agentHarnesses: vj.agentic_dev.harnesses,
      agentModels: vj.agentic_dev.models,
      budgetTier: vj.agentic_dev.budget_tier,
      estimatedHumanHours: vj.agentic_dev.estimated_human_hours ?? null,
      estimatedAgentHours: vj.agentic_dev.estimated_agent_hours ?? null,
      tags: vj.project.tags ?? null,
      vibeJsonRaw: JSON.stringify(vj),
      agentReportRaw: typeof body.agent_report_md === "string" ? body.agent_report_md : null,
      createdAt: new Date(),
    });

    // Insert team members if provided
    if (vj.team.members && vj.team.members.length > 0) {
      for (let i = 0; i < vj.team.members.length; i++) {
        const m = vj.team.members[i];
        await db.insert(teamMembers).values({
          id: nanoid(),
          teamId,
          submissionId: id,
          name: m.name,
          role: m.role ?? null,
          order: i,
        });
      }
    }

    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "submission",
      entityId: id,
      action: "submission_created",
      actorType: "team",
      metadata: { source: "api", method: "from-repo" } as unknown as Record<string, unknown>,
      createdAt: new Date(),
    });

    const links = submissionLinks(editToken, id);
    return NextResponse.json(
      {
        id,
        team_id: teamId,
        editToken,
        status: "draft",
        ...links,
        editUrl: links.edit_url,
        validationResult,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/v1/submissions/from-repo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
