import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { submissions, teamMembers, teams } from "@/lib/db/schema";
import { githubAuthRequired } from "@/lib/ownership-mode";
import { submissionLinks } from "@/lib/submission-links";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import type { InferSelectModel } from "drizzle-orm";

type TeamMember = InferSelectModel<typeof teamMembers>;
type Team = InferSelectModel<typeof teams>;
type Submission = InferSelectModel<typeof submissions>;

export async function POST(req: NextRequest) {
  if (githubAuthRequired()) {
    return NextResponse.json({ error: "Badge recovery is disabled when GitHub auth is required" }, { status: 403 });
  }

  const { contactEmail, ownerBadgeNumber } = await req.json();
  const email = String(contactEmail ?? "").trim();
  const badge = String(ownerBadgeNumber ?? "").trim();
  if (!email || !badge) return NextResponse.json({ error: "contactEmail and ownerBadgeNumber are required" }, { status: 400 });

  const matchingMembers: TeamMember[] = await db.select().from(teamMembers).where(
    and(eq(teamMembers.email, email), eq(teamMembers.badgeNumber, badge), eq(teamMembers.order, 0))
  );
  const teamIds = matchingMembers.map((member: TeamMember) => member.teamId).filter((id): id is string => Boolean(id));
  if (teamIds.length === 0) return NextResponse.json({ submissions: [] });

  const teamRows: Team[] = await db.select().from(teams).where(inArray(teams.id, teamIds));
  const allowedTeamIds = teamRows.filter((team: Team) => team.contactEmail === email).map((team: Team) => team.id);
  if (allowedTeamIds.length === 0) return NextResponse.json({ submissions: [] });

  const subRows: Submission[] = await db.select().from(submissions).where(inArray(submissions.teamId, allowedTeamIds));
  const allMembers: TeamMember[] = await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, subRows.map((sub: Submission) => sub.id)));
  return NextResponse.json({
    submissions: subRows.map((sub: Submission) => {
      const links = submissionLinks(sub.editToken, sub.id);
      const summary = computePrizeEligibility(allMembers.filter((member) => member.submissionId === sub.id).map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
      return { id: sub.id, teamName: sub.teamName, projectTitle: sub.projectTitle, editUrl: links.edit_url, previewUrl: links.preview_url, manageTeamUrl: links.start_url.replace("/start", "/team"), teamSize: summary.memberCount, badgeCount: summary.badgeCount, eligibleForPrize: summary.eligibleForPrize };
    }),
  });
}
