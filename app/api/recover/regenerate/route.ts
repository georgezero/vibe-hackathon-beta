import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { submissionOwners, submissions } from "@/lib/db/schema";
import { getTeamSessionUser } from "@/lib/team-auth";
import { submissionLinks } from "@/lib/submission-links";
import { githubAuthRequired } from "@/lib/ownership-mode";

export async function POST(req: NextRequest) {
  const user = await getTeamSessionUser();
  if (!githubAuthRequired()) {
    return NextResponse.json({ error: "Use edit links returned by badge recovery in badge mode" }, { status: 403 });
  }
  if (!user) return NextResponse.json({ error: "GitHub sign-in required" }, { status: 401 });
  const { submissionId } = await req.json();
  if (!submissionId) return NextResponse.json({ error: "submissionId is required" }, { status: 400 });

  const ownerRows = await db.select().from(submissionOwners).where(
    and(eq(submissionOwners.submissionId, String(submissionId)), eq(submissionOwners.userId, user.id))
  );
  if (!ownerRows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const editToken = `edit_${nanoid(16)}`;
  await db.update(submissions).set({ editToken }).where(eq(submissions.id, String(submissionId)));
  return NextResponse.json({ editToken, ...submissionLinks(editToken, String(submissionId)) });
}
