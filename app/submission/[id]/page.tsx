export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, teamMembers, aiReviews, audienceVotes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { getSubmissionById, getAiReview } from "@/lib/mock-data";
import { getRankingData, type FinalRanking } from "@/lib/rankings";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import SubmissionClient from "./SubmissionClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({ params }: Props) {
  const { id } = await params;

  // Try DB first, fall back to mock
  let sub: {
    id: string;
    projectTitle: string | null;
    teamName: string;
    status: string;
    screenshotUrl: string | null;
    problemStatement: string | null;
    targetUsers: string | null;
    aiToolsUsed: unknown;
    knownLimitations: string | null;
    demoUrl: string | null;
    githubUrl: string | null;
    readmeUrl: string | null;
    agentsMdUrl: string | null;
    promptStrategyUrl: string | null;
    agentReportUrl?: string | null;
    setupInstructions: string | null;
    tags: unknown;
    members: Array<{ name: string; role: string }>;
    audienceVotes: number;
    agentHarnesses: string[] | null;
    agentModels: string[] | null;
    budgetTier: string | null;
    estimatedHumanHours: number | null;
    estimatedAgentHours: number | null;
  } | null = null;

  let aiReview: {
    status: string;
    generatedRationale: string | null;
    generatedScore: number | null;
    complianceCheck: string | null;
    demoValidation: string | null;
    screenshotValidation: string | null;
    repoReview: string | null;
    agentsMdEvaluation: string | null;
    promptStrategyEvaluation: string | null;
    reliabilityNotes: string | null;
    suggestedQuestions: unknown;
    scoringDetails?: unknown;
  } | null = null;

  const dbRows = await db.select().from(submissions).where(eq(submissions.id, id));
  if (dbRows[0]) {
    const dbSub = dbRows[0];
    const members = await db.select().from(teamMembers)
      .where(eq(teamMembers.submissionId, id))
      .orderBy(teamMembers.order);
    const voteRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, id));
    const totalVotes = voteRows[0]?.total ?? 0;

    const reviewRows = await db.select().from(aiReviews).where(eq(aiReviews.submissionId, id));
    if (reviewRows[0]) aiReview = reviewRows[0];

    sub = {
      id: dbSub.id,
      projectTitle: dbSub.projectTitle,
      teamName: dbSub.teamName,
      status: dbSub.status,
      screenshotUrl: dbSub.screenshotUrl,
      problemStatement: dbSub.problemStatement,
      targetUsers: dbSub.targetUsers,
      aiToolsUsed: dbSub.aiToolsUsed,
      knownLimitations: dbSub.knownLimitations,
      demoUrl: dbSub.demoUrl,
      githubUrl: dbSub.githubUrl,
      readmeUrl: dbSub.readmeUrl,
      agentsMdUrl: dbSub.agentsMdUrl,
      promptStrategyUrl: dbSub.promptStrategyUrl,
      agentReportUrl: dbSub.agentReportUrl,
      setupInstructions: dbSub.setupInstructions,
      tags: dbSub.tags,
      members: members.map((m: { name: string; role: string | null }) => ({ name: m.name, role: m.role ?? "" })),
      audienceVotes: totalVotes,
      agentHarnesses: dbSub.agentHarnesses ?? null,
      agentModels: dbSub.agentModels ?? null,
      budgetTier: dbSub.budgetTier ?? null,
      estimatedHumanHours: dbSub.estimatedHumanHours ?? null,
      estimatedAgentHours: dbSub.estimatedAgentHours ?? null,
    };
  } else {
    // Fall back to mock data
    console.warn(`Submission ${id} not found in DB, using mock data`);
    const mockSub = getSubmissionById(id);
    if (!mockSub) notFound();
    const mockReview = getAiReview(id);
    if (mockReview) aiReview = mockReview;
    sub = {
      id: mockSub.id,
      projectTitle: mockSub.projectTitle,
      teamName: mockSub.teamName,
      status: mockSub.status,
      screenshotUrl: mockSub.screenshotUrl,
      problemStatement: mockSub.problemStatement,
      targetUsers: mockSub.targetUsers,
      aiToolsUsed: mockSub.aiToolsUsed,
      knownLimitations: mockSub.knownLimitations,
      demoUrl: mockSub.demoUrl,
      githubUrl: mockSub.githubUrl,
      readmeUrl: mockSub.readmeUrl,
      agentsMdUrl: mockSub.agentsMdUrl,
      promptStrategyUrl: mockSub.promptStrategyUrl,
      agentReportUrl: null,
      setupInstructions: mockSub.setupInstructions,
      tags: mockSub.tags,
      members: mockSub.members,
      audienceVotes: mockSub.audienceVotes,
      agentHarnesses: null,
      agentModels: null,
      budgetTier: null,
      estimatedHumanHours: null,
      estimatedAgentHours: null,
    };
  }

  if (!sub) notFound();
  const rankingData = await getRankingData();
  const voting = audienceVotingStatus(await getActiveEvent());
  const ranking: FinalRanking | undefined = rankingData.rankings.find((row) => row.submissionId === sub.id);
  const scoringDetails = aiReview?.scoringDetails as {
    repo_score?: number;
    documentation_score?: number;
    reproducibility_score?: number;
    deployment_score?: number;
    agent_readiness_score?: number;
    overall_score?: number;
  } | undefined;

  const statusColors: Record<string, string> = {
    draft: "badge-default",
    submitted: "badge-warning",
    finalized: "badge-success",
    locked: "badge-default",
  };

  const tags = (sub.tags as string[]) ?? [];
  const aiToolsUsed = (sub.aiToolsUsed as string[]) ?? [];

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />

      <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 py-10 flex-1">
        {/* Breadcrumb */}
        <div className="mb-6" style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>
          <Link href="/projects" style={{ color: "var(--color-muted)", textDecoration: "none" }}>Projects</Link>
          <span className="mx-2">/</span>
          <span>{sub.projectTitle}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main content */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge ${statusColors[sub.status] ?? "badge-default"}`}>{sub.status}</span>
                {tags.map((tag) => (
                  <span key={tag} className="badge badge-default">{tag}</span>
                ))}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--color-fg)",
                  marginBottom: "0.5rem",
                }}
              >
                {sub.projectTitle}
              </h1>
              <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
                by <strong style={{ color: "var(--color-fg)" }}>{sub.teamName}</strong>
                {" · "}
                {sub.members.map((m) => m.name).join(", ")}
              </p>
            </div>

            {/* Screenshot */}
            {sub.screenshotUrl && (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)" }}>
                <img
                  src={sub.screenshotUrl}
                  alt={sub.projectTitle ?? ""}
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            )}

            {/* Problem statement */}
            <Section title="Problem Statement">
              <p style={{ color: "var(--color-muted)", lineHeight: 1.75 }}>{sub.problemStatement}</p>
            </Section>

            {/* Target users */}
            <Section title="Target Users">
              <p style={{ color: "var(--color-muted)", lineHeight: 1.75 }}>{sub.targetUsers}</p>
            </Section>

            {/* AI tools */}
            {aiToolsUsed.length > 0 && (
              <Section title="AI Tools Used">
                <div className="flex flex-wrap gap-2">
                  {aiToolsUsed.map((tool) => (
                    <span key={tool} className="badge badge-2">{tool}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* Known limitations */}
            {sub.knownLimitations && (
              <Section title="Known Limitations">
                <p style={{ color: "var(--color-muted)", lineHeight: 1.75, fontSize: "0.875rem" }}>{sub.knownLimitations}</p>
              </Section>
            )}

            {sub.agentReportUrl && (
              <Section title="Agent Evidence">
                <ExtLink href={sub.agentReportUrl} label="Agent report" />
              </Section>
            )}

            {/* AI Review preview */}
            {aiReview && aiReview.status === "complete" && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem" }}>AI Review Summary</h3>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success" title="Deterministic checks from GitHub repo — file presence, license, README headings, AGENTS.md sections">Verified</span>
                    <span className="badge badge-success">Complete</span>
                    {aiReview.generatedScore !== null && (
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "var(--color-accent)",
                      }}>
                        {aiReview.generatedScore}/100
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.65, marginBottom: "1rem" }}>
                  {aiReview.generatedRationale}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ReviewItem label="Compliance" value={aiReview.complianceCheck ?? "pending"} />
                  <ReviewItem label="Demo" value={aiReview.demoValidation ?? "pending"} />
                  <ReviewItem label="Screenshot" value={aiReview.screenshotValidation ?? "pending"} />
                  <ReviewItem label="AGENTS.md" value={aiReview.status} />
                </div>
              </div>
            )}

            {ranking && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}>
                  <h3 style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem" }}>
                    Judging Summary
                  </h3>
                  <span className={`badge ${ranking.rankStatus === "final" ? "badge-success" : ranking.rankStatus === "provisional" ? "badge-warning" : "badge-error"}`}>
                    {ranking.rankStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: "1rem" }}>
                  <SummaryMetric label="Official" value={ranking.officialScore} suffix="/100" />
                  <SummaryMetric label="Human avg" value={ranking.humanAverageScore} suffix="/100" />
                  <SummaryMetric label="AI reproducibility" value={ranking.aiReproducibilityScore} suffix="/100" />
                  <SummaryMetric label="Audience votes" value={ranking.audienceVotes} />
                </div>
                {scoringDetails && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" style={{ marginBottom: "1rem" }}>
                    <SummaryMetric label="Repo" value={scoringDetails.repo_score ?? null} suffix="/100" small />
                    <SummaryMetric label="Docs" value={scoringDetails.documentation_score ?? null} suffix="/100" small />
                    <SummaryMetric label="Repro" value={scoringDetails.reproducibility_score ?? null} suffix="/100" small />
                    <SummaryMetric label="Deploy" value={scoringDetails.deployment_score ?? null} suffix="/100" small />
                    <SummaryMetric label="Agent ready" value={scoringDetails.agent_readiness_score ?? null} suffix="/100" small />
                  </div>
                )}
                <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
                  Formula: {ranking.scoringFormula}
                </div>
                <div className="flex flex-col gap-2">
                  {ranking.humanScores.length === 0 ? (
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>No human judge scores recorded yet.</div>
                  ) : ranking.humanScores.map((score) => (
                    <div key={score.id} className="flex items-center justify-between gap-3" style={{ fontSize: "0.8125rem" }}>
                      <span style={{ color: "var(--color-fg)" }}>{score.judgeName}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: score.completed ? "var(--color-accent)" : "var(--color-subtle)", fontWeight: 700 }}>
                        {score.completed && score.score !== null ? `${score.score}/100` : "incomplete"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <div className="flex flex-col gap-4">
            {/* Vote card — client component */}
            <SubmissionClient submissionId={sub.id} initialVotes={voting.resultsVisible ? sub.audienceVotes : 0} votingOpen={voting.open} votingStatus={voting.label} resultsVisible={voting.resultsVisible} />

            {/* Links */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Links</div>
              <div className="flex flex-col gap-2">
                {sub.demoUrl && <ExtLink href={sub.demoUrl} label="Live Demo" />}
                {sub.githubUrl && <ExtLink href={sub.githubUrl} label="GitHub Repo" />}
                {sub.readmeUrl && <ExtLink href={sub.readmeUrl} label="README" />}
                {sub.agentsMdUrl && <ExtLink href={sub.agentsMdUrl} label="AGENTS.md" />}
                {sub.promptStrategyUrl && <ExtLink href={sub.promptStrategyUrl} label="Prompt Strategy" />}
              </div>
            </div>

            {/* Self-reported agent metadata */}
            {(sub.agentHarnesses || sub.agentModels || sub.budgetTier || sub.estimatedHumanHours !== null || sub.estimatedAgentHours !== null) && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "0.875rem" }}>
                  <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem" }}>Agentic Development</div>
                  <span className="badge" style={{ background: "rgba(234,179,8,0.12)", color: "rgb(161,120,0)", fontSize: "0.65rem", padding: "0.15rem 0.4rem" }} title="Values reported by the team — not verified by platform">Self-reported</span>
                </div>
                <div className="flex flex-col gap-2" style={{ fontSize: "0.8125rem" }}>
                  {sub.agentHarnesses && sub.agentHarnesses.length > 0 && (
                    <div>
                      <div style={{ color: "var(--color-subtle)", marginBottom: "0.25rem" }}>Harnesses</div>
                      <div className="flex flex-wrap gap-1">{sub.agentHarnesses.map((h) => <span key={h} className="badge badge-default" style={{ fontSize: "0.7rem" }}>{h}</span>)}</div>
                    </div>
                  )}
                  {sub.agentModels && sub.agentModels.length > 0 && (
                    <div>
                      <div style={{ color: "var(--color-subtle)", marginBottom: "0.25rem" }}>Models</div>
                      <div className="flex flex-wrap gap-1">{sub.agentModels.map((m) => <span key={m} className="badge badge-default" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>{m}</span>)}</div>
                    </div>
                  )}
                  {sub.budgetTier && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--color-subtle)" }}>Budget tier</span>
                      <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{sub.budgetTier}</span>
                    </div>
                  )}
                  {(sub.estimatedHumanHours !== null || sub.estimatedAgentHours !== null) && (
                    <div className="flex justify-between">
                      <span style={{ color: "var(--color-subtle)" }}>Hours (human / agent)</span>
                      <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                        {sub.estimatedHumanHours ?? "—"} / {sub.estimatedAgentHours ?? "—"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Team info */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Team</div>
              <div className="flex flex-col gap-2">
                {sub.members.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <span style={{ fontSize: "0.875rem", color: "var(--color-fg)" }}>{m.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)" }}>{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Setup */}
            {sub.setupInstructions && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Quick Setup</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.6 }}>{sub.setupInstructions}</p>
              </div>
            )}

            <Link href="/projects" className="btn-ghost" style={{ justifyContent: "center" }}>
              ← Back to projects
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem", marginBottom: "0.75rem" }}>{title}</h2>
      {children}
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-ghost"
      style={{ fontSize: "0.8125rem", padding: "0.25rem 0.5rem", justifyContent: "space-between" }}
    >
      <span>{label}</span>
      <span>↗</span>
    </a>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  const colorMap: Record<string, string> = {
    pass: "badge-success",
    live: "badge-success",
    valid: "badge-success",
    complete: "badge-success",
    partial: "badge-warning",
    pending: "badge-default",
    fail: "badge-error",
    down: "badge-error",
    invalid: "badge-error",
  };
  return (
    <div className="text-center">
      <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <span className={`badge ${colorMap[value] ?? "badge-default"}`}>{value}</span>
    </div>
  );
}

function SummaryMetric({ label, value, suffix, small }: { label: string; value: number | null; suffix?: string; small?: boolean }) {
  return (
    <div style={{ padding: small ? "0.6rem" : "0.75rem", border: "1px solid var(--color-border)", borderRadius: 10 }}>
      <div style={{ fontSize: "0.65rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--color-fg)", fontSize: small ? "0.875rem" : "1rem" }}>
        {value === null ? "—" : value}{value !== null && suffix}
      </div>
    </div>
  );
}
