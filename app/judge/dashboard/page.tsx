import Link from "next/link";
import { Nav } from "@/components/Nav";
import { db } from "@/lib/db";
import { judgeAssignments, judgingAssignmentStates, submissions, humanScores, teamMembers } from "@/lib/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { type InferSelectModel } from "drizzle-orm";
import { calcHumanAvgScore } from "@/lib/mock-data";
import { getActiveEvent, judgingDeadlineStatus } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { JudgeDashboardShortcuts } from "./JudgeDashboardShortcuts";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { requireAuthorizedJudgePage } from "@/lib/judge-page-auth";

type Sub = InferSelectModel<typeof submissions>;
type Score = InferSelectModel<typeof humanScores>;
type Member = InferSelectModel<typeof teamMembers>;

export const dynamic = "force-dynamic";

export default async function JudgeDashboardPage() {
  const [activeEvent, branding, judge] = await Promise.all([
    getActiveEvent(),
    getEventBranding(),
    requireAuthorizedJudgePage(),
  ]);
  const judgingStatus = judgingDeadlineStatus(activeEvent);

  const assignmentRows = await db.select({ assignment: judgeAssignments }).from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(and(eq(judgeAssignments.judgeId, judge.id), or(isNull(judgingAssignmentStates.status), eq(judgingAssignmentStates.status, "active"))));
  const assignments = assignmentRows.map((row: { assignment: InferSelectModel<typeof judgeAssignments> }) => row.assignment);
  const submissionIds = assignments.map((a: { submissionId: string }) => a.submissionId);

  const subs: Sub[] = submissionIds.length > 0
    ? await db.select().from(submissions).where(and(
      inArray(submissions.id, submissionIds),
      eq(submissions.eventId, judge.eventId),
    ))
    : [];
  const orderedSubs = submissionIds
    .map((id: string) => subs.find((sub: Sub) => sub.id === id))
    .filter((sub: Sub | undefined): sub is Sub => Boolean(sub));

  const allScores: Score[] = submissionIds.length > 0
    ? await db.select().from(humanScores).where(inArray(humanScores.submissionId, submissionIds))
    : [];

  const allMembers: Member[] = submissionIds.length > 0
    ? await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, submissionIds))
    : [];

  const completedCount = orderedSubs.filter((s: Sub) => {
    const score = allScores.find((sc: Score) => sc.submissionId === s.id && sc.judgeId === judge.id);
    return Boolean(score?.completed);
  }).length;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav
        variant="judge"
        eventLogoUrl={branding.logoUrl}
        authenticatedAccount={judge.authenticatedAccount}
      />
      <EventFreezeBanner />

      <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 py-10 flex-1">
        {/* Judging deadline banner */}
        <div
          className="mb-6 card"
          style={{
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            borderLeft: `3px solid ${!judgingStatus.open ? "var(--color-border)" : (judgingStatus.daysRemaining !== null && judgingStatus.daysRemaining <= 2) ? "var(--color-warning)" : "var(--color-success)"}`,
          }}
        >
          <span style={{ fontSize: "1rem" }}>
            {!judgingStatus.open ? "🔒" : (judgingStatus.daysRemaining !== null && judgingStatus.daysRemaining <= 2) ? "⚠️" : "✓"}
          </span>
          <span style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>{judgingStatus.label}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-subtle)", marginBottom: "0.25rem" }}>
              Judge dashboard · {branding.eventName}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--color-fg)",
              }}
            >
              {judge.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="card text-center" style={{ padding: "0.75rem 1.25rem" }}>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
                {completedCount}/{orderedSubs.length}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Completed
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>Review progress</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
              {Math.round((completedCount / Math.max(orderedSubs.length, 1)) * 100)}%
            </span>
          </div>
          <div style={{ height: 4, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(completedCount / Math.max(orderedSubs.length, 1)) * 100}%`,
                background: "var(--color-accent)",
                borderRadius: 999,
                transition: "width 500ms ease",
              }}
            />
          </div>
        </div>

        {/* Submissions list */}
        <JudgeDashboardShortcuts submissionIds={orderedSubs.map((sub: Sub) => sub.id)}>
        <div className="flex flex-col gap-3">
          {orderedSubs.map((sub: Sub) => {
            const score = allScores.find((sc: Score) => sc.submissionId === sub.id && sc.judgeId === judge.id);
            const subMembers = allMembers.filter((m: Member) => m.submissionId === sub.id);
            const avgScore = score?.completed ? calcHumanAvgScore({
              submissionId: sub.id,
              judgeId: judge.id,
              problemSelection: score.problemSelection ?? 0,
              productUsefulness: score.productUsefulness ?? 0,
              functionality: score.functionality ?? 0,
              uxDesign: score.uxDesign ?? 0,
              aiCollaboration: score.aiCollaboration ?? 0,
              originality: score.originality ?? 0,
              maintainability: score.maintainability ?? 0,
              presentationClarity: score.presentationClarity ?? 0,
              privateNotes: score.privateNotes ?? "",
              recommendation: (score.recommendation as "strong-yes" | "yes" | "maybe" | "no") ?? "maybe",
              completed: Boolean(score.completed),
            }) : null;

            return (
              <div
                key={sub.id}
                className="card"
                data-judge-submission-card={sub.id}
                style={{ padding: "1.25rem" }}
              >
                <div className="judge-assignment-head flex items-start justify-between gap-4 flex-wrap">
                  <div className="judge-assignment-copy flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {score?.completed ? (
                        <span className="badge badge-success">Reviewed</span>
                      ) : (
                        <span className="badge badge-warning">Pending</span>
                      )}
                      <span className={`badge badge-default`}>{sub.status}</span>
                      {((sub.tags as string[]) ?? []).map((t) => (
                        <span key={t} className="badge badge-default">{t}</span>
                      ))}
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "1rem", marginBottom: "0.25rem" }}>
                      {sub.projectTitle}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                      {sub.teamName} · {subMembers.map((m) => m.name).join(", ")}
                    </div>
                  </div>

                  <div className="judge-assignment-meta flex items-center gap-3">
                    {avgScore !== null && (
                      <div className="text-center">
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
                          {avgScore}
                        </div>
                        <div style={{ fontSize: "0.625rem", color: "var(--color-subtle)", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          avg
                        </div>
                      </div>
                    )}
                    <div className="judge-assignment-actions">
                      <Link href={`/judge/projects/${sub.id}`} className="btn-primary">Review project →</Link>
                      <Link href={`/judge/projects/${sub.id}/evaluation`} className="btn-secondary">{score?.completed ? "Continue evaluation" : "Start evaluation"}</Link>
                    </div>
                  </div>
                </div>

                {/* Quick links */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap" style={{ borderColor: "var(--color-border)" }}>
                  <a href={sub.demoUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                    ↗ Demo
                  </a>
                  <a href={sub.githubUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                    GitHub
                  </a>
                  <Link href={`/judge/submissions/${sub.id}/ai`} className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                    AI review
                  </Link>
                  {score?.recommendation && (
                    <span
                      className="ml-auto badge"
                      style={{
                        background: {
                          "strong-yes": "color-mix(in srgb, var(--color-success) 14%, transparent)",
                          "yes": "color-mix(in srgb, var(--color-success) 8%, transparent)",
                          "maybe": "color-mix(in srgb, var(--color-warning) 14%, transparent)",
                          "no": "color-mix(in srgb, var(--color-error) 14%, transparent)",
                        }[score.recommendation],
                        color: {
                          "strong-yes": "var(--color-success)",
                          "yes": "var(--color-success)",
                          "maybe": "var(--color-warning)",
                          "no": "var(--color-error)",
                        }[score.recommendation],
                      }}
                    >
                      {score.recommendation.replace("-", " ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </JudgeDashboardShortcuts>

        {orderedSubs.length === 0 && (
          <div className="card text-center" style={{ padding: "3rem" }}>
            <p style={{ color: "var(--color-subtle)" }}>No submissions assigned to you yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
