export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, aiReviews, aiJudgeRuns } from "@/lib/db/schema";
import { inArray, eq, type InferSelectModel } from "drizzle-orm";
import { getEventBranding } from "@/lib/event-branding";
import AiReviewsClient, { type PublicAiReviewEntry } from "./AiReviewsClient";
import { getAwardBadgeMap } from "@/lib/award-badges";

type Sub = InferSelectModel<typeof submissions>;
type AiReview = InferSelectModel<typeof aiReviews>;
type AiRun = InferSelectModel<typeof aiJudgeRuns>;

export default async function AiReviewsPage() {
  const [branding, awardBadgeMap] = await Promise.all([
    getEventBranding(),
    getAwardBadgeMap(),
  ]);

  const subRows: Sub[] = await db
    .select()
    .from(submissions)
    .where(inArray(submissions.status, ["submitted", "finalized"]));

  const entries: PublicAiReviewEntry[] = [];

  if (subRows.length > 0) {
    const subIds = subRows.map((s) => s.id);

    const [reviewRows, runRows]: [AiReview[], AiRun[]] = await Promise.all([
      db.select().from(aiReviews).where(inArray(aiReviews.submissionId, subIds)),
      db
        .select()
        .from(aiJudgeRuns)
        .where(inArray(aiJudgeRuns.submissionId, subIds))
        .where(eq(aiJudgeRuns.status, "complete")),
    ]);

    const reviewMap = Object.fromEntries(reviewRows.map((r) => [r.submissionId, r]));
    const runsBySubmission = runRows.reduce<Record<string, AiRun[]>>((acc, r) => {
      (acc[r.submissionId] ??= []).push(r);
      return acc;
    }, {});

    for (const sub of subRows) {
      const review = reviewMap[sub.id];
      const runs = runsBySubmission[sub.id] ?? [];

      entries.push({
        submissionId: sub.id,
        projectTitle: sub.projectTitle,
        teamName: sub.teamName,
        githubUrl: sub.githubUrl,
        deterministicStatus: review?.status ?? null,
        deterministicScore: review?.generatedScore ?? null,
        deterministicComplianceCheck: review?.complianceCheck ?? null,
        deterministicRationale: review?.generatedRationale ?? null,
        awardBadges: awardBadgeMap[sub.id] ?? [],
        llmRuns: runs.map((r) => {
          const scores = r.scoresJson as Record<string, number> | null;
          return {
            modelProvider: r.modelProvider,
            modelName: r.modelName,
            overallScore: scores?.overall_score ?? null,
            rationale: r.rationale,
            scoresJson: scores,
            riskFlags: Array.isArray((r.scoresJson as Record<string, unknown> | null)?.risk_flags)
              ? ((r.scoresJson as Record<string, unknown>).risk_flags as string[])
              : [],
            completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          };
        }),
      });
    }

    // Sort: reviewed with score first (desc), then unreviewed
    entries.sort((a, b) => {
      const aScore = a.deterministicScore ?? -1;
      const bScore = b.deterministicScore ?? -1;
      return bScore - aScore;
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />

      <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-0">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-default">{branding.eventName}</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
              marginBottom: "0.5rem",
            }}
          >
            AI Evaluations
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
            {entries.length} project{entries.length !== 1 ? "s" : ""} · reproducible AI evaluations
          </p>
        </div>
      </div>

      <AiReviewsClient entries={entries} />
    </div>
  );
}
