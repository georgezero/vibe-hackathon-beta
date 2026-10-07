"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResultDetail } from "@/lib/results";

type Tie = { tieKey: string; score: number; submissionIds: string[]; status: "pending" | "resolved"; rationale: string | null } | null;
export default function TieReviewClient({ tie, details }: { tie: Tie; details: ResultDetail[] }) {
  const router = useRouter();
  const [rationale, setRationale] = useState(tie?.rationale ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const resolveTie = () => startTransition(async () => {
    if (!tie) return;
    setError(null);
    const response = await fetch("/api/admin/results", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "review_tie", tieKey: tie.tieKey, submissionIds: tie.submissionIds, score: tie.score, rationale }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(typeof result.error === "string" ? result.error : "The tie review could not be saved."); return; }
    router.refresh();
  });
  if (!tie) return <section className="results-empty"><h1>Tie not found</h1><p>This tie group is no longer present in the current calculation.</p><Link className="results-button secondary" href="/admin/results">Back to results</Link></section>;
  return <><div className="results-detail-top"><div><Link href="/admin/results" className="results-back">← Results</Link><h1>Tie review</h1><p>{tie.submissionIds.length} projects share a calculated score of {tie.score}.</p></div><span className={`results-state ${tie.status}`}>{tie.status === "resolved" ? "Resolved" : "Pending review"}</span></div>{error && <p className="results-error" role="alert">{error}</p>}<section className="results-tie-comparison">{details.map((detail) => <article className="results-tie-project" key={detail.row.submissionId}><div><span className="results-section-label">Project</span><h2>{detail.row.projectTitle}</h2><p>{detail.row.teamName} · {detail.row.institution}</p></div><div className="results-tie-score"><span>Average</span><strong>{detail.row.score}</strong><small>{detail.row.completedReviews} completed reviews</small></div><div className="results-tie-criteria">{detail.criterionBreakdown.map((criterion) => <div key={criterion.key}><span>{criterion.label}</span><strong>{criterion.average ?? "—"}</strong></div>)}</div><Link className="results-button compact secondary" href={`/admin/results/${encodeURIComponent(detail.row.submissionId)}`}>Open result</Link></article>)}</section><section className="results-section results-tie-resolution"><span className="results-section-label">Administrator review</span><h2>Record the decision rationale</h2><p>Review the side-by-side evidence, then record why the tie is resolved. This does not alter any judge score.</p><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={5} placeholder="Explain the tie review decision." aria-label="Tie review rationale" /><button className="results-button" disabled={pending || rationale.trim().length < 3} onClick={resolveTie}>{pending ? "Saving…" : tie.status === "resolved" ? "Update review" : "Mark tie resolved"}</button></section></>;
}
