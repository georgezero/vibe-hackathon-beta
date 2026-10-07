import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getCalibrationJudgeDetail } from "@/lib/calibration";

export const dynamic = "force-dynamic";

export default async function CalibrationJudgePage({ params }: { params: Promise<{ judgeId: string }> }) {
  await requireAdminSession();
  const { judgeId } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const detail = event ? await getCalibrationJudgeDetail(event.id, decodeURIComponent(judgeId)) : null;
  if (!detail) notFound();
  const average = detail.distribution.length ? (detail.distribution.reduce((sum, value) => sum + value, 0) / detail.distribution.length).toFixed(1) : "—";
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="calibration-page"><header className="calibration-detail-header"><div><Link className="calibration-back" href="/admin/calibration">← Calibration</Link><p className="eyebrow">Judge detail</p><h1>{detail.judge.name}</h1><p>{detail.judge.institution}</p></div></header><section className="calibration-metrics"><div className="calibration-metric"><span>Completed evaluations</span><strong>{detail.evaluations.length}</strong></div><div className="calibration-metric"><span>Average score</span><strong>{average}</strong></div><div className="calibration-metric"><span>Highest score</span><strong>{detail.distribution.length ? Math.max(...detail.distribution) : "—"}</strong></div><div className="calibration-metric"><span>Lowest score</span><strong>{detail.distribution.length ? Math.min(...detail.distribution) : "—"}</strong></div></section><section className="calibration-section"><div className="calibration-section-heading"><div><p className="eyebrow">Recent work</p><h2>Completed evaluations</h2></div><span className="calibration-muted">Private notes are never shown here.</span></div><div className="calibration-table-wrap"><table className="calibration-table"><thead><tr><th>Project</th><th>Score</th><th>Updated</th></tr></thead><tbody>{detail.evaluations.map((evaluation) => <tr key={evaluation.submissionId}><td><strong>{evaluation.projectTitle}</strong><small>{evaluation.submissionId}</small></td><td>{evaluation.score}</td><td>{evaluation.updatedAt ? new Date(evaluation.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td></tr>)}</tbody></table></div></section></main></div>;
}
