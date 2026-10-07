"use client";

import { useState } from "react";
import { AwardBadges } from "@/components/AwardBadges";
import type { AwardBadge } from "@/lib/award-badges";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

export interface PublicAiReviewEntry {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  githubUrl: string | null;
  deterministicStatus: string | null;
  deterministicScore: number | null;
  deterministicComplianceCheck: string | null;
  deterministicRationale: string | null;
  awardBadges: AwardBadge[];
  llmRuns: {
    modelProvider: string;
    modelName: string;
    overallScore: number | null;
    rationale: string | null;
    scoresJson: Record<string, number> | null;
    riskFlags: string[];
    completedAt: string | null;
  }[];
}

function download(content: string, filename: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const LLM_SCORE_KEYS = [
  "product_sense_score",
  "originality_score",
  "execution_score",
  "ai_collaboration_score",
  "usefulness_score",
  "presentation_score",
] as const;

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  return (
    <div style={{ flex: 1, height: 4, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${(score / max) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999 }} />
    </div>
  );
}

function SubmissionCard({ entry }: { entry: PublicAiReviewEntry }) {
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function copyEvalPrompt() {
    setCopying(true);
    try {
      const res = await fetch(`/api/v1/ai-eval/prompt/${entry.submissionId}`);
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
      }
    } finally {
      setCopying(false);
    }
  }

  async function downloadAgentEvalJson() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/ai-eval/packet/${entry.submissionId}`);
      if (res.ok) {
        const text = await res.text();
        download(text, `agent-eval-${entry.submissionId}.json`);
      }
    } finally {
      setDownloading(false);
    }
  }

  const completeRuns = entry.llmRuns.filter((r) => r.overallScore !== null);
  const consensusScore =
    completeRuns.length > 1
      ? Math.round(completeRuns.reduce((s, r) => s + (r.overallScore ?? 0), 0) / completeRuns.length)
      : null;

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={`/project/${entry.submissionId}`} style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem", marginBottom: "0.2rem", textDecoration: "none", display: "block" }}>
            {entry.projectTitle ?? entry.teamName}
          </a>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>{entry.teamName}</div>
          <div style={{ marginTop: entry.awardBadges.length > 0 ? "0.5rem" : 0 }}>
            <AwardBadges badges={entry.awardBadges} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0 }}>
          <button
            onClick={copyEvalPrompt}
            disabled={copying}
            className="btn-secondary"
            style={{ fontSize: "0.75rem" }}
          >
            {copying ? "📋 Copied!" : "📋 Eval Prompt"}
          </button>
          <button
            onClick={downloadAgentEvalJson}
            disabled={downloading}
            className="btn-secondary"
            style={{ fontSize: "0.75rem" }}
          >
            {downloading ? "Fetching…" : "⬇ Agent Eval JSON"}
          </button>
        </div>
      </div>

      {/* Deterministic review */}
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{ paddingBottom: "0.75rem", borderBottom: "1px solid var(--color-border)", marginBottom: "0.75rem" }}
      >
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 100 }}>
          Deterministic
        </span>
        {entry.deterministicStatus ? (
          <>
            <span className={`badge ${entry.deterministicStatus === "complete" ? "badge-success" : "badge-default"}`}>
              {entry.deterministicStatus}
            </span>
            {entry.deterministicScore !== null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-accent)", fontWeight: 700 }}>
                {entry.deterministicScore}/100
              </span>
            )}
            {entry.deterministicComplianceCheck && (
              <span className={`badge ${
                entry.deterministicComplianceCheck === "pass" ? "badge-success"
                : entry.deterministicComplianceCheck === "partial" ? "badge-warning"
                : "badge-error"
              }`}>
                {entry.deterministicComplianceCheck}
              </span>
            )}
          </>
        ) : (
          <span className="badge badge-default">pending</span>
        )}
      </div>

      {/* LLM evaluations */}
      <div>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: completeRuns.length > 0 ? "0.5rem" : 0 }}>
          LLM Evaluations ({completeRuns.length})
        </div>

        {/* Consensus */}
        {consensusScore !== null && (
          <div className="card" style={{ padding: "0.75rem 1rem", background: "var(--color-surface-2)", marginBottom: "0.5rem" }}>
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-subtle)" }}>Consensus</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent)", fontSize: "1rem" }}>{consensusScore}/100</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)" }}>
                {completeRuns.length} model{completeRuns.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {completeRuns.map((r, i) => {
                const label = `${r.modelProvider.replace("external/", "")}/${r.modelName}`;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-muted)", minWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                    <ScoreBar score={r.overallScore ?? 0} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-fg)", fontWeight: 600, minWidth: 28, textAlign: "right" }}>
                      {r.overallScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Individual runs */}
        {completeRuns.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "var(--color-subtle)", marginTop: "0.25rem" }}>
            No organizer LLM evaluations yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {completeRuns.map((run, i) => (
              <div key={i} className="card" style={{ padding: "0.875rem 1rem", background: "var(--color-surface-2)" }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-accent)" }}>
                    {run.modelProvider.replace("external/", "")}/{run.modelName}
                  </span>
                  {run.overallScore !== null && (
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent)", fontSize: "0.875rem" }}>
                      {run.overallScore}/100
                    </span>
                  )}
                  {run.completedAt && (
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginLeft: "auto" }}>
                      {run.completedAt.slice(0, 16).replace("T", " ")}
                    </span>
                  )}
                </div>
                {run.scoresJson && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {LLM_SCORE_KEYS.map((k) =>
                      run.scoresJson![k] !== undefined ? (
                        <span key={k} style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", fontFamily: "var(--font-mono)" }}>
                          {k.replace(/_score$/, "").replace(/_/g, " ")}:{" "}
                          <strong style={{ color: "var(--color-fg)" }}>{run.scoresJson![k]}</strong>
                        </span>
                      ) : null
                    )}
                  </div>
                )}
                {run.rationale && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.5rem", lineHeight: 1.6 }}>
                    {run.rationale}
                  </p>
                )}
                {run.riskFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {run.riskFlags.map((f, j) => (
                      <span key={j} style={{ fontSize: "0.6875rem", color: "var(--color-warning)", border: "1px solid var(--color-warning)", borderRadius: 4, padding: "0.1rem 0.4rem", opacity: 0.8 }}>
                        ⚠ {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiReviewsClient({ entries }: { entries: PublicAiReviewEntry[] }) {
  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-12 flex-1">
      {/* Explanation banner */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "2rem",
          background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))",
          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.375rem" }}>
          About these evaluations
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.65, margin: 0 }}>
          AI reviews shown here are organizer-run evaluations. You can run your own evaluation using{" "}
          <strong style={{ color: "var(--color-fg)" }}>Eval Prompt</strong> (paste into ChatGPT, Claude, Gemini, or your preferred AI agent harness like Hermes, Openclaw, Pi, Opencode) or{" "}
          <strong style={{ color: "var(--color-fg)" }}>Agent Eval JSON</strong> (structured input for scripts or local models).
          Public result submission is not enabled — contact organizers to discuss community evaluation.
        </p>
      </div>

      {entries.length === 0 ? (
        <ParticipantEmptyState className="card" title="AI evaluations will appear here" description="Organizer-run evaluations become available as teams submit projects and review material is ready." action={{ href: "/projects", label: "Explore projects", primary: false }} />
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <SubmissionCard key={entry.submissionId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
