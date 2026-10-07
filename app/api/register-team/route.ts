import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auditEvents, submissionOwners, submissions, teamMembers, teamOwners, teams } from "@/lib/db/schema";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { getTeamSessionUser } from "@/lib/team-auth";
import { submissionLinks } from "@/lib/submission-links";
import { githubAuthRequired, ownershipMode } from "@/lib/ownership-mode";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { ensureOwnerMembership } from "@/lib/submission-memberships";

interface TeammateInput {
  name?: string;
  email?: string;
  badgeNumber?: string;
  affiliation?: string;
  degrees?: string;
  isStudentTrainee?: boolean;
}

export async function POST(req: NextRequest) {
  const freeze = await assertEventNotFrozen();
  if (freeze.response) return freeze.response;
  const user = await getTeamSessionUser();
  const requireGitHub = githubAuthRequired();
  const body = await req.json();
  const guestStart = body.source === "start";
  if (requireGitHub && (!user || !user.githubId) && !guestStart) {
    return NextResponse.json({ error: "GitHub sign-in required" }, { status: 401 });
  }
  const githubLogin = user?.githubUsername ?? user?.name ?? (user?.githubId ? `github-${user.githubId}` : null);

  const teamName = String(body.teamName ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim();
  const ownerBadgeNumber = String(body.ownerBadgeNumber ?? "").trim();
  const affiliation = String(body.affiliation ?? "").trim() || null;
  const ownerDegrees = String(body.ownerDegrees ?? "").trim() || null;
  const ownerIsStudentTrainee = Boolean(body.ownerIsStudentTrainee);
  const description = String(body.description ?? "").trim() || null;
  const teammates = Array.isArray(body.teammates) ? body.teammates as TeammateInput[] : [];

  if (!teamName || !ownerName || !contactEmail || !ownerBadgeNumber) {
    return NextResponse.json({ error: "teamName, ownerName, contactEmail, and ownerBadgeNumber are required" }, { status: 400 });
  }

  const normalizedTeammates = teammates
    .map((member) => ({
      name: String(member.name ?? "").trim(),
      email: String(member.email ?? "").trim() || null,
      badgeNumber: String(member.badgeNumber ?? "").trim(),
      affiliation: String(member.affiliation ?? "").trim() || null,
      degrees: String(member.degrees ?? "").trim() || null,
      isStudentTrainee: Boolean(member.isStudentTrainee),
    }))
    .filter((member) => member.name || member.email || member.badgeNumber || member.affiliation || member.degrees || member.isStudentTrainee);

  if (normalizedTeammates.length > 5) {
    return NextResponse.json({ error: "Team size is limited to 6 people including the owner" }, { status: 400 });
  }
  for (const member of normalizedTeammates) {
    if (!member.name) {
      return NextResponse.json({ error: "Each teammate row requires a name" }, { status: 400 });
    }
  }

  const activeEvent = await getActiveEvent();
  const deadline = submissionDeadlineStatus(activeEvent);
  if (!deadline.open) {
    return NextResponse.json({ error: "Submissions are closed", label: deadline.label }, { status: 403 });
  }

  const teamId = `team_${nanoid(10)}`;
  const submissionId = `sub_${nanoid(8)}`;
  const editToken = `edit_${nanoid(16)}`;

  await db.insert(teams).values({
    id: teamId,
    eventId: activeEvent.id,
    name: teamName,
    contactEmail,
    affiliation,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(submissions).values({
    id: submissionId,
    teamId,
    eventId: activeEvent.id,
    editToken,
    teamName,
    contactEmail,
    status: "draft",
    createdAt: new Date(),
  });

  if (user?.githubId && githubLogin) {
    await db.insert(teamOwners).values({
      id: `owner_${nanoid(10)}`,
      teamId,
      userId: user.id,
      githubUserId: user.githubId,
      githubLogin,
      githubAvatarUrl: user.image,
      githubProfileUrl: `https://github.com/${githubLogin}`,
      ownerBadgeNumber,
      badgeVerificationStatus: "unchecked",
      createdAt: new Date(),
    });

    await db.insert(submissionOwners).values({
      id: nanoid(),
      submissionId,
      userId: user.id,
      createdAt: new Date(),
    });
    await ensureOwnerMembership({ submissionId, userId: user.id });
  }

  await db.insert(teamMembers).values({
    id: nanoid(),
    teamId,
    submissionId,
    name: ownerName,
    email: contactEmail,
    badgeNumber: ownerBadgeNumber,
    badgeVerificationStatus: "unchecked",
    affiliation,
    degrees: ownerDegrees,
    isStudentTrainee: ownerIsStudentTrainee,
    role: "Owner",
    order: 0,
  });

  for (let i = 0; i < normalizedTeammates.length; i++) {
    const member = normalizedTeammates[i];
    await db.insert(teamMembers).values({
      id: nanoid(),
      teamId,
      submissionId,
      name: member.name,
      email: member.email,
      badgeNumber: member.badgeNumber,
      badgeVerificationStatus: "unchecked",
      affiliation: member.affiliation,
      degrees: member.degrees,
      isStudentTrainee: member.isStudentTrainee,
      role: null,
      order: i + 1,
    });
  }

  await db.insert(auditEvents).values({
    id: nanoid(),
    entityType: "submission",
    entityId: submissionId,
    action: guestStart ? "submission_draft_created" : "team_registered",
    actorType: "team_owner",
    actorId: user?.id ?? null,
    metadata: { teamId, githubLogin, ownershipMode: ownershipMode(), teamSize: normalizedTeammates.length + 1 } as unknown as Record<string, unknown>,
    createdAt: new Date(),
  });

  const links = submissionLinks(editToken, submissionId);
  return NextResponse.json({
    id: submissionId,
    team_id: teamId,
    editToken,
    status: "draft",
    ...links,
    editUrl: links.edit_url,
  }, { status: 201 });
}
