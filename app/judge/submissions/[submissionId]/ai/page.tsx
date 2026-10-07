import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { db } from "@/lib/db";
import { judgeAssignments, judgingAssignmentStates, submissions, aiReviews } from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuthorizedJudgePage } from "@/lib/judge-page-auth";

interface Props {
  params: Promise<{ submissionId: string }>;
}

export default async function AiReviewPage({ params }: Props) {
  const { submissionId } = await params;

  const judge = await requireAuthorizedJudgePage();

  const sub_rows = await db.select().from(submissions).where(and(
    eq(submissions.id, submissionId),
    eq(submissions.eventId, judge.eventId),
  ));
  const sub = sub_rows[0];
  if (!sub) notFound();

  // Verify assignment
  const assignRows = await db.select().from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(
    and(eq(judgeAssignments.judgeId, judge.id), eq(judgeAssignments.submissionId, sub.id), or(isNull(judgingAssignmentStates.status), eq(judgingAssignmentStates.status, "active")))
  );
  if (!assignRows[0]) notFound();

  const reviewRows = await db.select().from(aiReviews).where(eq(aiReviews.submissionId, sub.id));
  const review = reviewRows[0] ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav
        variant="judge"
        authenticatedAccount={judge.authenticatedAccount}
      />

      <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6" style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>
          <Link href="/judge/dashboard" style={{ color: "var(--color-muted)", textDecoration: "none" }}>Assignments</Link>
          <span>/</span>
          <Link href={`/judge/submissions/${sub.id}`} style={{ color: "var(--color-muted)", textDecoration: "none" }}>{sub.projectTitle}</Link>
          <span>/</span>
          <span>AI Review</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-fg)", marginBottom: "0.25rem" }}>
              AI Review: {sub.projectTitle}
            </h1>
            <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>Automated pre-screening report</p>
          </div>
          {review && (
            <div className="flex items-center gap-3">
              <span className={`badge ${review.status === "complete" ? "badge-success" : review.status === "running" ? "badge-warning" : "badge-default"}`}>
                {review.status}
              </span>
              {review.generatedScore !== null && (
                <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)" }}>
                  {review.generatedScore}/100
                </div>
              )}
            </div>
          )}
        </div>

        {!review ? (
          <AiPendingView submissionId={sub.id} />
        ) : review.status === "pending" ? (
          <AiPendingView submissionId={sub.id} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            {review.generatedRationale && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
                  AI Summary
                </div>
                <p style={{ color: "var(--color-muted)", lineHeight: 1.7, fontSize: "0.9rem" }}>
                  {review.generatedRationale}
                </p>
              </div>
            )}

            {/* Status grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatusCard label="Compliance Check" value={review.complianceCheck ?? "pending"} />
              <StatusCard label="Demo URL" value={review.demoValidation ?? "pending"} />
              <StatusCard label="Screenshot" value={review.screenshotValidation ?? "pending"} />
              <StatusCard label="AI Review Status" value={review.status} />
            </div>

            {/* Detailed checks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReviewBlock title="Repo & README Review" content={review.repoReview ?? ""} icon="📄" />
              <ReviewBlock title="AGENTS.md Evaluation" content={review.agentsMdEvaluation ?? ""} icon="🤖" />
              <ReviewBlock title="Prompt Strategy Evaluation" content={review.promptStrategyEvaluation ?? ""} icon="💬" />
              <ReviewBlock title="Reliability Notes" content={review.reliabilityNotes ?? ""} icon="📊" />
            </div>

            {/* Suggested follow-up questions */}
            {((review.suggestedQuestions as string[]) ?? []).length > 0 && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>💡</span> Suggested Questions for Judges
                </div>
                <div className="flex flex-col gap-2">
                  {((review.suggestedQuestions as string[]) ?? []).map((q, i) => (
                    <div key={i} className="flex gap-3" style={{ padding: "0.75rem", background: "var(--color-surface-2)", borderRadius: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-subtle)", minWidth: "1.5rem" }}>
                        Q{i + 1}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "var(--color-fg)", lineHeight: 1.6 }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <Link href={`/judge/submissions/${sub.id}`} className="btn-secondary">
                ← Back to scoring
              </Link>
              <Link href="/judge/dashboard" className="btn-ghost">
                All assignments →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AiPendingView({ submissionId }: { submissionId: string }) {
  const PLACEHOLDER_CHECKS = [
    { label: "Compliance Check", desc: "Verifying required files: README, AGENTS.md, .env.example, seed script" },
    { label: "Repo & README Review", desc: "Analyzing documentation quality and completeness" },
    { label: "Demo URL Validation", desc: "Testing live demo URL for availability and response time" },
    { label: "Screenshot Validation", desc: "Checking screenshot URL and image quality" },
    { label: "AGENTS.md Evaluation", desc: "Evaluating AI agent instructions coverage (8 required sections)" },
    { label: "Prompt Strategy Evaluation", desc: "Reviewing docs/prompts.md or equivalent for depth and quality" },
    { label: "Reliability Assessment", desc: "Running multiple demo tests and logging response times" },
    { label: "Score Generation", desc: "Computing composite AI score and generating rationale" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🤖</div>
        <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem" }}>AI review pending</div>
        <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.6 }}>
          The automated AI review for submission <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{submissionId}</code> has not run yet. It will be triggered once judging begins.
        </p>
      </div>

      <div style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
        Checks that will run:
      </div>
      <div className="flex flex-col gap-2">
        {PLACEHOLDER_CHECKS.map((check) => (
          <div key={check.label} className="card" style={{ padding: "1rem" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.25rem" }}>{check.label}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>{check.desc}</div>
              </div>
              <span className="badge badge-default shrink-0">pending</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  const colorMap: Record<string, string> = {
    pass: "badge-success", live: "badge-success", valid: "badge-success", complete: "badge-success",
    partial: "badge-warning", pending: "badge-default", running: "badge-warning",
    fail: "badge-error", down: "badge-error", invalid: "badge-error",
  };
  return (
    <div className="card text-center" style={{ padding: "1rem" }}>
      <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.625rem" }}>
        {label}
      </div>
      <span className={`badge ${colorMap[value] ?? "badge-default"}`}>{value}</span>
    </div>
  );
}

function ReviewBlock({ title, content, icon }: { title: string; content: string; icon: string }) {
  return (
    <div className="card" style={{ padding: "1.125rem" }}>
      <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>{icon}</span> {title}
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.65 }}>{content}</p>
    </div>
  );
}
