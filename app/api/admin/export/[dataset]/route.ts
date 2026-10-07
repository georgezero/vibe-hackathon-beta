import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJudgeRuns, aiReviews, audienceVotes, audienceVoters, events, humanScores, judges, submissions, teamMembers, teamOwners, teams } from "@/lib/db/schema";
import { getRankingData } from "@/lib/rankings";
import { getActiveEvent } from "@/lib/events";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import type { InferSelectModel } from "drizzle-orm";
import { withAdminApi } from "@/lib/admin-api";

type SubmissionRow = InferSelectModel<typeof submissions>;
type TeamMemberRow = InferSelectModel<typeof teamMembers>;

interface Props {
  params: Promise<{ dataset: string }>;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

async function exportDataset(req: NextRequest, { params }: Props) {
  const { dataset } = await params;
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const rankingData = await getRankingData();
  const activeEvent = await getActiveEvent();

  if (dataset === "event-bundle") {
    const bundle = {
      schema: "vibe-hackathon-event-bundle-v1",
      exported_at: new Date().toISOString(),
      eventFrozen: Boolean(activeEvent.isFrozen),
      event: activeEvent,
      submissions: (await db.select().from(submissions)).map(({ editToken: _et, ...rest }: { editToken: string; [key: string]: unknown }) => rest),
      teams: await db.select().from(teams),
      team_members: await db.select().from(teamMembers),
      team_owners: await db.select().from(teamOwners),
      judges: await db.select({
        id: judges.id,
        name: judges.name,
        email: judges.email,
        createdAt: judges.createdAt,
      }).from(judges),
      human_scores: await db.select().from(humanScores),
      ai_reviews: await db.select().from(aiReviews),
      ai_evaluations: await db.select().from(aiJudgeRuns),
      audience_votes: await db.select().from(audienceVotes),
      audience_voters: await db.select().from(audienceVoters),
      rankings: rankingData.rankings,
      winners: {
        judge_choice: rankingData.rankings.find((r) => r.rank === 1) ?? null,
        peoples_choice: rankingData.peoplesChoiceRankings[0] ?? null,
      },
    };
    return NextResponse.json(bundle, {
      headers: { "Content-Disposition": `attachment; filename="event-bundle.json"` },
    });
  }

  const data: Record<string, unknown[]> = {
    submissions: await db.select().from(submissions),
    human_scores: rankingData.humanScores,
    ai_reviews: await db.select().from(aiReviews),
    audience_votes: await db.select().from(audienceVotes),
    final_rankings: rankingData.rankings,
    peoples_choice: rankingData.peoplesChoiceRankings,
    judge_calibration: rankingData.judgeCalibration,
  };

  if (dataset === "team_roster") {
    const [subRows, memberRows] = await Promise.all([
      db.select().from(submissions),
      db.select().from(teamMembers),
    ]);
    const membersBySubmission: Record<string, TeamMemberRow[]> = {};
    for (const member of memberRows as TeamMemberRow[]) {
      if (!membersBySubmission[member.submissionId]) membersBySubmission[member.submissionId] = [];
      membersBySubmission[member.submissionId].push(member);
    }
    const rosterRows = (subRows as SubmissionRow[]).flatMap((sub: SubmissionRow) => {
      const members = (membersBySubmission[sub.id] ?? []).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      const summary = computePrizeEligibility(members.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
      return members.map((member) => ({
        "Team name": sub.teamName,
        "Project title": sub.projectTitle ?? "",
        "Member name": member.name,
        Role: member.order === 0 ? "Team Lead" : "Teammate",
        Email: member.email ?? "",
        "Badge number": member.badgeNumber ?? "",
        "Degree(s)": member.degrees ?? "",
        Institution: member.affiliation ?? "",
        "Student/trainee": member.isStudentTrainee ? "Yes" : "No",
        "Badge verification status": member.badgeVerificationStatus,
        "Prize eligibility": summary.eligibleForPrize ? "Eligible" : "Incomplete",
      }));
    });

    if (format === "csv") {
      return new NextResponse(toCsv(rosterRows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="team_roster.csv"`,
        },
      });
    }

    return NextResponse.json(rosterRows, {
      headers: { "Content-Disposition": `attachment; filename="team_roster.json"` },
    });
  }

  const rows = data[dataset];
  if (!rows) {
    return NextResponse.json({ error: "Unknown export dataset" }, { status: 404 });
  }

  if (format === "csv") {
    return new NextResponse(toCsv(rows as Array<Record<string, unknown>>), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset}.csv"`,
      },
    });
  }

  return NextResponse.json(rows, {
    headers: { "Content-Disposition": `attachment; filename="${dataset}.json"` },
  });
}

export const GET = withAdminApi("GET /api/admin/export/[dataset]", exportDataset);
