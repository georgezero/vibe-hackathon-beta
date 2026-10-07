import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auditEvents, events, submissions, teamMembers, teams } from "@/lib/db/schema";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { submissionDeadlineStatus } from "@/lib/events";
import type { InferSelectModel } from "drizzle-orm";

type TeamMember = InferSelectModel<typeof teamMembers>;

interface RouteContext {
  params: Promise<{ id: string }>;
}

type IncomingMember = {
  id?: string;
  name?: string;
  email?: string;
  badgeNumber?: string;
  affiliation?: string;
  degrees?: string;
  isStudentTrainee?: boolean;
};

function cleanMember(member: IncomingMember) {
  return {
    id: String(member.id ?? "").trim(),
    name: String(member.name ?? "").trim(),
    email: String(member.email ?? "").trim() || null,
    badgeNumber: String(member.badgeNumber ?? "").trim() || null,
    affiliation: String(member.affiliation ?? "").trim() || null,
    degrees: String(member.degrees ?? "").trim() || null,
    isStudentTrainee: Boolean(member.isStudentTrainee),
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const sub = (await db.select().from(submissions).where(eq(submissions.id, id)))[0];
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  if (token !== sub.editToken) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

  const members: TeamMember[] = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, id)).orderBy(teamMembers.order);
  const owner = members[0] ?? null;
  const summary = computePrizeEligibility(members.map((member) => ({
    name: member.name,
    badgeNumber: member.badgeNumber,
    isStudentTrainee: member.isStudentTrainee,
  })));

  return NextResponse.json({
    submissionId: sub.id,
    teamId: sub.teamId,
    teamName: sub.teamName,
    owner,
    members,
    summary,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const freeze = await assertEventNotFrozen();
  if (freeze.response) return freeze.response;
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

  const sub = (await db.select().from(submissions).where(eq(submissions.id, id)))[0];
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (sub.editToken !== token) return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  if (sub.status === "locked") return NextResponse.json({ error: "Submission is locked" }, { status: 403 });
  if (sub.eventId) {
    const event = (await db.select().from(events).where(eq(events.id, sub.eventId)).limit(1))[0];
    if (event && !submissionDeadlineStatus(event).open) {
      return NextResponse.json({ error: "Submissions are closed", code: "DEADLINE_PASSED" }, { status: 403 });
    }
  }

  const body = await req.json();
  const owner = cleanMember(body.owner ?? {});
  const members: ReturnType<typeof cleanMember>[] = Array.isArray(body.members) ? body.members.map((member: IncomingMember) => cleanMember(member)) : [];

  if (!owner.name || !owner.email || !owner.badgeNumber) {
    return NextResponse.json({ error: "Owner name, email, and badge number are required" }, { status: 400 });
  }

  const normalizedMembers = members.filter((member) => member.name || member.email || member.badgeNumber || member.affiliation || member.degrees || member.isStudentTrainee);
  if (normalizedMembers.length > 5) return NextResponse.json({ error: "Team size is limited to 6 people including owner" }, { status: 400 });
  for (const member of normalizedMembers) {
    if (!member.name) return NextResponse.json({ error: "Each teammate row requires a name" }, { status: 400 });
  }

  await db.update(submissions).set({ teamName: body.teamName ? String(body.teamName).trim() : sub.teamName, contactEmail: owner.email }).where(eq(submissions.id, id));
  if (sub.teamId) {
    await db.update(teams).set({
      name: body.teamName ? String(body.teamName).trim() : sub.teamName,
      contactEmail: owner.email,
      affiliation: owner.affiliation,
      updatedAt: new Date(),
    }).where(eq(teams.id, sub.teamId));
  }

  const existingOwner = (await db.select().from(teamMembers).where(and(eq(teamMembers.submissionId, id), eq(teamMembers.order, 0))))[0];
  if (existingOwner) {
    await db.update(teamMembers).set({
      name: owner.name,
      email: owner.email,
      badgeNumber: owner.badgeNumber,
      affiliation: owner.affiliation,
      degrees: owner.degrees,
      isStudentTrainee: owner.isStudentTrainee,
      role: "Owner",
    }).where(eq(teamMembers.id, existingOwner.id));
  } else {
    await db.insert(teamMembers).values({
      id: nanoid(),
      teamId: sub.teamId ?? null,
      submissionId: id,
      name: owner.name,
      email: owner.email,
      badgeNumber: owner.badgeNumber,
      affiliation: owner.affiliation,
      degrees: owner.degrees,
      isStudentTrainee: owner.isStudentTrainee,
      role: "Owner",
      order: 0,
    });
  }

  await db.delete(teamMembers).where(and(eq(teamMembers.submissionId, id), sql`${teamMembers.order} > 0`));
  for (let i = 0; i < normalizedMembers.length; i++) {
    const member = normalizedMembers[i];
    await db.insert(teamMembers).values({
      id: nanoid(),
      teamId: sub.teamId ?? null,
      submissionId: id,
      name: member.name,
      email: member.email,
      badgeNumber: member.badgeNumber,
      affiliation: member.affiliation,
      degrees: member.degrees,
      isStudentTrainee: member.isStudentTrainee,
      role: null,
      order: i + 1,
    });
  }

  const all = [owner, ...normalizedMembers];
  const summary = computePrizeEligibility(all);
  await db.insert(auditEvents).values({
    id: nanoid(),
    entityType: "submission",
    entityId: id,
    action: "team_updated",
    actorType: "team",
    metadata: { memberCount: summary.memberCount, badgeCount: summary.badgeCount } as unknown as Record<string, unknown>,
    createdAt: new Date(),
  });

  return NextResponse.json({ success: true, summary });
}
