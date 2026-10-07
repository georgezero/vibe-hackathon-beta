import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audienceVotes, submissions } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";

export async function POST(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return NextResponse.json({ error: "Voting has closed.", eventFrozen: true }, { status: 403 });
    const body = await req.json();
    const { submissionId, fingerprint } = body;

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }
    const event = await getActiveEvent();
    const voting = audienceVotingStatus(event);
    if (!voting.open) {
      return NextResponse.json({ error: voting.label, votingOpen: false }, { status: 403 });
    }

    // Verify submission exists
    const subRows = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, submissionId));
    if (!subRows[0]) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Get current vote count
    const countRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, submissionId));
    const currentTotal = countRows[0]?.total ?? 0;

    // Check vote limit by fingerprint
    if (fingerprint) {
      const dupRows = await db.select({ id: audienceVotes.id }).from(audienceVotes).where(
        and(
          eq(audienceVotes.submissionId, submissionId),
          eq(audienceVotes.sessionFingerprint, fingerprint)
        )
      );
      if (dupRows.length >= event.audienceVotesPerPerson) {
        return NextResponse.json({ success: false, alreadyVoted: true, totalVotes: currentTotal });
      }
    }

    // Insert vote
    await db.insert(audienceVotes).values({
      id: nanoid(),
      submissionId,
      sessionFingerprint: fingerprint ?? null,
      createdAt: new Date(),
    });

    const newCountRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, submissionId));
    const newTotal = newCountRows[0]?.total ?? currentTotal + 1;

    return NextResponse.json({ success: true, totalVotes: newTotal });
  } catch (err) {
    console.error("POST /api/votes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
