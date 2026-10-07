import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { audienceVotes, audienceVoters, submissions } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";

const VALID_METHODS = ["badge", "email", "invite_code", "anonymous"] as const;
type IdentityMethod = (typeof VALID_METHODS)[number];

function normalizeIdentity(method: IdentityMethod, value: string): string {
  const trimmed = value.trim();
  if (method === "badge") return trimmed.toLowerCase().replace(/\s+/g, "");
  if (method === "email") return trimmed.toLowerCase();
  return trimmed;
}

function hashIdentity(method: IdentityMethod, value: string): string {
  const normalized = normalizeIdentity(method, value);
  return createHash("sha256").update(`${method}:${normalized}`).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return NextResponse.json({ error: "Voting has closed.", eventFrozen: true }, { status: 403 });
    const body = await req.json();
    const { submissionId, identity, identityMethod: rawMethod, email: rawEmail } = body;

    if (!submissionId || typeof submissionId !== "string") {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const identityMethod: IdentityMethod = VALID_METHODS.includes(rawMethod) ? rawMethod : "anonymous";

    if (identityMethod !== "anonymous" && (!identity || typeof identity !== "string" || !identity.trim())) {
      return NextResponse.json({ error: `identity value is required for method '${identityMethod}'` }, { status: 400 });
    }

    const event = await getActiveEvent();
    const voting = audienceVotingStatus(event);

    if (!voting.open) {
      return NextResponse.json({ error: voting.label, votingOpen: false }, { status: 403 });
    }

    if (voting.votingMode !== "human") {
      return NextResponse.json({ error: "Voting mode not supported" }, { status: 403 });
    }

    // Verify submission exists
    const subRows = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, submissionId));
    if (!subRows[0]) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // For anonymous: fall through to fingerprint-based voting (use POST /api/votes)
    if (identityMethod === "anonymous") {
      const fingerprint = body.fingerprint ?? null;
      if (fingerprint) {
        const dupRows = await db.select({ id: audienceVotes.id }).from(audienceVotes).where(
          and(eq(audienceVotes.submissionId, submissionId), eq(audienceVotes.sessionFingerprint, fingerprint))
        );
        if (dupRows.length >= event.audienceVotesPerPerson) {
          return NextResponse.json({ success: false, alreadyVoted: true }, { status: 409 });
        }
      }
      await db.insert(audienceVotes).values({ id: nanoid(), submissionId, sessionFingerprint: fingerprint, createdAt: new Date() });
      const totalRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, submissionId));
      return NextResponse.json({ success: true, totalVotes: totalRows[0]?.total ?? 1 });
    }

    // Identity-based voting
    const identityHash = hashIdentity(identityMethod, identity);

    // Compute optional email hash — badge method only, organizer context, not used for dedupe
    const emailHash = (identityMethod === "badge" && rawEmail && typeof rawEmail === "string" && rawEmail.trim())
      ? createHash("sha256").update(`email:${rawEmail.trim().toLowerCase()}`).digest("hex")
      : null;

    // Look up or create voter
    const voterRows = await db.select().from(audienceVoters).where(
      and(eq(audienceVoters.eventId, event.id), eq(audienceVoters.identityHash, identityHash))
    );
    let voter = voterRows[0];

    if (voter) {
      // Count total votes by this voter across all submissions
      const voteCountRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.voterId, voter.id));
      const totalVotesByVoter = voteCountRows[0]?.total ?? 0;

    if (totalVotesByVoter >= event.audienceVotesPerPerson) {
        return NextResponse.json(
          { success: false, alreadyVoted: true, message: "This badge number has already been used to vote." },
          { status: 409 }
        );
      }

      // Check if already voted for this specific submission
      const subVoteRows = await db.select({ id: audienceVotes.id }).from(audienceVotes).where(
        and(eq(audienceVotes.voterId, voter.id), eq(audienceVotes.submissionId, submissionId))
      );
      if (subVoteRows.length > 0) {
        return NextResponse.json(
          { success: false, alreadyVoted: true, message: "You already voted for this project." },
          { status: 409 }
        );
      }

      // Update lastVoteAt and emailHash if newly provided
      const updateFields: Record<string, unknown> = { lastVoteAt: new Date() };
      if (emailHash && !voter.emailHash) updateFields.emailHash = emailHash;
      await db.update(audienceVoters).set(updateFields).where(eq(audienceVoters.id, voter.id));
    } else {
      // Create voter record
      const voterId = `avtr_${nanoid(12)}`;
      await db.insert(audienceVoters).values({
        id: voterId,
        eventId: event.id,
        identityMethod,
        identityHash,
        emailHash,
        createdAt: new Date(),
        lastVoteAt: new Date(),
      });
      const newVoterRows = await db.select().from(audienceVoters).where(eq(audienceVoters.id, voterId));
      voter = newVoterRows[0];
    }

    // Insert vote
    await db.insert(audienceVotes).values({
      id: nanoid(),
      submissionId,
      voterId: voter.id,
      createdAt: new Date(),
    });

    const totalRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, submissionId));
    return NextResponse.json({ success: true, totalVotes: totalRows[0]?.total ?? 1 });
  } catch (err) {
    console.error("POST /api/v1/audience-vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
