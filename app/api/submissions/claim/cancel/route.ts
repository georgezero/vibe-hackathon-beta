import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, submissionClaimTransactions } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { SUBMISSION_CLAIM_BINDING_COOKIE, SUBMISSION_CLAIM_COOKIE } from "@/lib/submission-claim";

export async function POST(request: NextRequest) {
  const id = request.cookies.get(SUBMISSION_CLAIM_COOKIE)?.value;
  if (id) {
    const rows = await db.select({ submissionId: submissionClaimTransactions.submissionId }).from(submissionClaimTransactions).where(eq(submissionClaimTransactions.id, id)).limit(1);
    await db.update(submissionClaimTransactions).set({ status: "cancelled" }).where(eq(submissionClaimTransactions.id, id));
    if (rows[0]) await db.insert(auditEvents).values({
      id: nanoid(), entityType: "submission", entityId: rows[0].submissionId,
      action: "submission_claim_cancelled", actorType: "team", actorId: null,
      metadata: { transactionId: id } as unknown as Record<string, unknown>, createdAt: new Date(),
    });
  }
  const response = NextResponse.json({ success: true });
  for (const name of [SUBMISSION_CLAIM_COOKIE, SUBMISSION_CLAIM_BINDING_COOKIE]) response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 0, expires: new Date(0) });
  return response;
}
