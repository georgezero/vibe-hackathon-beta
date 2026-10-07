"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResultDetail } from "@/lib/results";

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
export default function ResultDetailClient({ detail }: { detail: ResultDetail | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const operate = (payload: Record<string, unknown>) => startTransition(async () => {
    setError(null);
    const response = await fetch("/api/admin/results", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(typeof result.error === "string" ? result.error : "The decision could not be saved."); return; }
    router.refresh();
  });
  if (!detail) return <section className="results-empty"><h1>Result not found</h1><p>This submission is not part of the active event.</p><Link className="results-button secondary" href="/admin/results">Back to results</Link></section>;
  const row = detail.row;
  return <>
    <div className="results-detail-top"><div><Link href="/admin/results" className="results-back">← Results</Link><h1>{row.projectTitle}</h1><p>{row.teamName} · {row.institution} · {row.submissionId}</p></div><div className="results-actions"><span className={`results-state ${row.incomplete ? "incomplete" : "ranked"}`}>{row.incomplete ? "Incomplete" : `Rank ${row.rank}`}</span>{row.finalist ? <span className="results-state finalist">Finalist</span> : <button className="results-button secondary" disabled={pending || row.incomplete} onClick={() => operate({ operation: "add_finalist", submissionId: row.submissionId })}>Mark finalist</button>}{row.winner ? <span className="results-state winner">{label(row.winner)}</span> : <button className="results-button secondary" disabled={pending || row.incomplete} onClick={() => operate({ operation: "assign_winner", submissionId: row.submissionId, category: "grand_prize" })}>Assign Grand Prize</button>}</div></div>
    {error && <p className="results-error" role="alert">{error}</p>}
    <section className="results-detail-summary"><div><span>Average score</span><strong>{row.score ?? "—"}</strong></div><div><span>Median</span><strong>{row.median ?? "—"}</strong></div><div><span>Spread</span><strong>{row.standardDeviation === null ? "—" : `±${row.standardDeviation}`}</strong></div><div><span>Reviews</span><strong>{row.completedReviews}/{row.requiredReviews}</strong></div><div><span>High / low</span><strong>{row.high ?? "—"} / {row.low ?? "—"}</strong></div></section>
    <section className="results-detail-grid"><div className="results-section"><div className="results-section-heading"><div><span className="results-section-label">Evidence</span><h2>Completed evaluations</h2></div><span className="results-muted">Private notes are not shown</span></div><div className="results-evaluation-list">{detail.evaluations.map((evaluation) => <article className="results-evaluation" key={evaluation.judgeId}><div><strong>{evaluation.judgeName}</strong><span>Submitted {evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleDateString() : "—"}</span></div><b>{evaluation.score}</b></article>)}{detail.evaluations.length === 0 && <p className="results-muted">No completed evaluations count toward this result yet.</p>}</div><div className="results-score-distribution" aria-label="Overall score distribution">{detail.evaluations.map((evaluation) => <div className="results-score-bar" key={`distribution-${evaluation.judgeId}`}><span>{evaluation.judgeName}</span><div><i style={{ width: `${Math.min(100, Math.max(0, evaluation.score))}%` }} /></div><strong>{evaluation.score}</strong></div>)}</div></div><div className="results-section"><div className="results-section-heading"><div><span className="results-section-label">Decision record</span><h2>Result state</h2></div></div><dl className="results-detail-dl"><div><dt>Submission</dt><dd>{label(row.submissionState)}</dd></div><div><dt>Calculation</dt><dd>{row.incomplete ? "Awaiting complete panel" : "Ranked"}</dd></div><div><dt>Tie</dt><dd>{row.tieStatus === "none" ? "No tie detected" : label(row.tieStatus)}</dd></div><div><dt>Publication</dt><dd>{row.published ? "Published" : "Private"}</dd></div></dl><label className="results-reason-label" htmlFor="result-rationale">Tie-review rationale</label><textarea id="result-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Use the dedicated tie review for tied projects." rows={3} /><p className="results-muted">A result is calculated first, reviewed by an administrator, then published as a separate action.</p></div></section>
    <section className="results-section"><div className="results-section-heading"><div><span className="results-section-label">Criterion breakdown</span><h2>Panel distribution</h2></div></div><div className="results-table-wrap"><table className="results-table"><thead><tr><th>Criterion</th><th>Average</th><th>Minimum</th><th>Maximum</th><th>Variance</th></tr></thead><tbody>{detail.criterionBreakdown.map((criterion) => <tr key={criterion.key}><td><strong>{criterion.label}</strong></td><td>{criterion.average ?? "—"}</td><td>{criterion.minimum ?? "—"}</td><td>{criterion.maximum ?? "—"}</td><td>{criterion.variance ?? "—"}</td></tr>)}</tbody></table></div></section>
  </>;
}
