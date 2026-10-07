import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, submissionOwners, submissions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  const { id } = await params;
  if (!session?.user) return NextResponse.redirect(new URL("/login?returnTo=/account/projects", request.url));
  const rows = await db.select({ token: submissions.editToken }).from(submissionOwners).innerJoin(submissions, eq(submissions.id, submissionOwners.submissionId)).where(and(eq(submissionOwners.submissionId, id), eq(submissionOwners.userId, session.user.id))).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "submission", entityId: id, action: "submission_owner_accessed", actorType: "user", actorId: session.user.id, metadata: { access: "edit" } as unknown as Record<string, unknown>, createdAt: new Date() });
  return NextResponse.redirect(new URL(`/submit/${rows[0].token}`, request.url));
}
